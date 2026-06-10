// ════════════════════════════════════════════════════════════════
//  CLOUD ACCOUNT MODULE
//  Extracted from app.js — Supabase auth, cloud saves, snapshots, leaderboard
// ════════════════════════════════════════════════════════════════
//
//  Supabase remains optional. app.js injects runtime dependencies through
//  configureCloudAccount() so this module does not need to read app internals
//  directly.
// ════════════════════════════════════════════════════════════════

import { initNitroBridge, redirectToNitroLogin } from '../nitro/nitro-bridge.js';
import { esc as _esc } from '../core/escape.js';

let cloudContext = {};

function configureCloudAccount(ctx = {}) {
  cloudContext = { ...cloudContext, ...ctx };
}

function requireContext(name) {
  const value = cloudContext[name];
  if (value === undefined) {
    throw new Error(`[cloudAccount] Missing context dependency: ${name}`);
  }
  return value;
}

function getState() {
  return requireContext('getState')();
}

function getActiveTab() {
  return requireContext('getActiveTab')();
}

function getActiveSaveSlot() {
  return requireContext('getActiveSaveSlot')();
}

function getSupabaseConfig() {
  return requireContext('getSupabaseConfig')();
}

function getSupabaseSdk() {
  return requireContext('getSupabaseSdk')();
}

function getDocument() {
  return requireContext('document');
}

function getStorage() {
  return requireContext('localStorage');
}

function getFetch() {
  return requireContext('fetch');
}

const state = new Proxy({}, {
  get(_target, prop) {
    return getState()?.[prop];
  },
  set(_target, prop, value) {
    const current = getState();
    if (!current) return false;
    current[prop] = value;
    return true;
  },
  ownKeys() {
    return Reflect.ownKeys(getState() ?? {});
  },
  getOwnPropertyDescriptor(_target, prop) {
    const current = getState() ?? {};
    return Object.getOwnPropertyDescriptor(current, prop) || {
      configurable: true,
      enumerable: true,
      writable: true,
      value: current[prop],
    };
  },
});

const document = new Proxy({}, {
  get(_target, prop) {
    const doc = getDocument();
    const value = doc?.[prop];
    return typeof value === 'function' ? value.bind(doc) : value;
  },
});

const localStorage = new Proxy({}, {
  get(_target, prop) {
    const storage = getStorage();
    const value = storage?.[prop];
    if (value === undefined) {
      if (prop === 'getItem') return () => null;
      if (prop === 'setItem') return () => {};
    }
    return typeof value === 'function' ? value.bind(storage) : value;
  },
});

function fetch(...args) {
  const fetchFn = getFetch();
  if (!fetchFn) throw new Error('[cloudAccount] Missing context dependency: fetch');
  return fetchFn(...args);
}

function slimPokemon(pokemon) {
  return requireContext('slimPokemon')(pokemon);
}

function setState(nextState) {
  return requireContext('setState')(nextState);
}

function migrate(saved) {
  return requireContext('migrate')(saved);
}

function saveState() {
  return requireContext('saveState')();
}

function renderAll() {
  return requireContext('renderAll')();
}

function notify(...args) {
  return requireContext('notify')(...args);
}

function showConfirm(...args) {
  return requireContext('showConfirm')(...args);
}

function getDexKantoCaught() {
  return requireContext('getDexKantoCaught')();
}

function getDexNationalCaught() {
  return requireContext('getDexNationalCaught')();
}

function getShinySpeciesCount() {
  return requireContext('getShinySpeciesCount')();
}

function switchTab(...args) {
  return requireContext('switchTab')(...args);
}

// ════════════════════════════════════════════════════════════════
// 23.  SUPABASE — AUTH & CLOUD SAVE
// ════════════════════════════════════════════════════════════════

let _supabase    = null;
let supaSession = null;
let supaLastSync = null;   // timestamp dernier cloud save réussi
let supaSyncing  = false;

// ── Session token — identifies a player row in the leaderboard, even if anonymous
// Persisted in localStorage so it survives page reloads.
const _LB_TOKEN_KEY = 'pg.lbToken';
let _lbToken = null;

function getLeaderboardToken() {
  if (_lbToken) return _lbToken;
  _lbToken = localStorage.getItem(_LB_TOKEN_KEY);
  if (!_lbToken) {
    _lbToken = 'anon_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem(_LB_TOKEN_KEY, _lbToken);
  }
  return _lbToken;
}

let _lbLastPushAt = 0;
const LB_PUSH_THROTTLE_MS = 60 * 60 * 1000; // push at most once every hour
let _lbLastFingerprint = ''; // dirty check — skip push if nothing changed

// ── Helpers ───────────────────────────────────────────────────────
function supaConfigured() {
  const { url } = getSupabaseConfig();
  return !!url && !url.includes('VOTRE_PROJET');
}

// ── Custom fetch : timeout 12 s ───────────────────────────────────────
function _supaFetch(url, options = {}) {
  const ctrl = new AbortController();
  const existing = options.signal;
  if (existing?.addEventListener) existing.addEventListener('abort', () => ctrl.abort());
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  return fetch(url, { ...options, signal: ctrl.signal })
    .catch(err => {
      if (err.name === 'AbortError') throw new Error('Supabase request timeout (12s)');
      throw err;
    })
    .finally(() => clearTimeout(timer));
}

// ── Mutex réentrant JS — remplace le Web Locks API pour GoTrue ───────
// Raison : GoTrue appelle _recoverAndRefresh() DEPUIS l'intérieur du lock
// courant quand une requête échoue (504). Le Web Locks API ne supporte pas la
// réentrance → deadlock de 5s → vol de lock → "Uncaught (in promise)".
// Un mutex JS simple est réentrant par nature (même thread) et évite tout ça.
function _makeSupaLock() {
  let _promise = Promise.resolve(); // chaîne de promesses sérialisées
  let _depth   = 0;                 // compteur de réentrance
  return async function supaLock(_name, _acquireTimeout, fn) {
    if (_depth > 0) {
      // Réentrant : exécuter fn directement sans attendre le mutex
      _depth++;
      try { return await fn(); } finally { _depth--; }
    }
    // Première acquisition : sérialiser derrière les appels précédents
    let release;
    const next = new Promise(r => (release = r));
    const prev = _promise;
    _promise    = next;
    await prev;
    _depth = 1;
    try {
      return await fn();
    } catch (err) {
      throw err;
    } finally {
      _depth = 0;
      release();
    }
  };
}

// ── Init ──────────────────────────────────────────────────────────
function initSupabase() {
  if (_supabase) return; // idempotent : déjà initialisé
  if (!supaConfigured()) return;
  const supabaseSdk = getSupabaseSdk();
  if (!supabaseSdk) {
    console.warn('PokéForge: Supabase SDK non chargé.');
    return;
  }
  try {
    const { url, anonKey } = getSupabaseConfig();
    _supabase = supabaseSdk.createClient(url, anonKey, {
      auth: {
        persistSession:     true,
        autoRefreshToken:   true,
        detectSessionInUrl: false,
        lock: _makeSupaLock(), // mutex JS réentrant, pas de Web Locks API
      },
      global: { fetch: _supaFetch },
    });

    // Restaurer la session existante (localStorage Supabase)
    _supabase.auth.getSession()
      .then(({ data }) => {
        supaSession = data.session || null;
        updateSupaIndicator();
        if (getActiveTab() === 'tabCompte') renderCompteTab();
      })
      .catch(err => {
        console.warn('PokéForge: getSession failed (réseau?)', err?.message ?? err);
      });

    // Écouter les changements d'auth (login / logout / refresh token)
    _supabase.auth.onAuthStateChange((_event, session) => {
      supaSession = session;
      updateSupaIndicator();
      updateSupaTabLabel();
      if (getActiveTab() === 'tabCompte') renderCompteTab();
    });
  } catch (e) {
    console.warn('PokéForge: Supabase init error', e);
  }
}

// ── Auth ──────────────────────────────────────────────────────────
async function supaSignIn(email, password) {
  if (!_supabase) return { error: 'Supabase non configuré' };
  const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  supaSession = data.session || supaSession;
  // Après connexion : proposer de charger la save cloud si plus récente
  await supaCheckCloudLoad();
  await supaUpdateLeaderboard();
  return { data };
}

async function supaSignUp(email, password) {
  if (!_supabase) return { error: 'Supabase non configuré' };
  const { data, error } = await _supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  return { data };
}

async function supaSignOut() {
  if (!_supabase) return;
  await _supabase.auth.signOut();
  supaLastSync    = null;
  supaSession     = null;
  _snapshotCount  = -1;   // reset so next login re-fetches real count
  _lbLastFingerprint = ''; // force leaderboard push on next login
  updateSupaIndicator();
  updateSupaTabLabel();
  if (getActiveTab() === 'tabCompte') renderCompteTab();
}

// ── Cloud Save ────────────────────────────────────────────────────
// Dirty-check fingerprint for cloud save — avoids upsert when nothing changed
let _cloudSaveFingerprint = '';

async function supaCloudSave() {
  if (!_supabase || !supaSession) return;
  if (supaSyncing) return;

  // Skip the upsert if key stats haven't changed since the last successful cloud write.
  // Uses the same fields as the leaderboard fingerprint + pokémon count + money.
  const fp = `${state.gang.reputation}|${state.stats?.totalCaught}|${state.pokemons?.length}|${state.gang.money}|${state._savedAt}`;
  if (fp === _cloudSaveFingerprint) return;

  supaSyncing = true;
  updateSupaIndicator();
  try {
    // Slim the payload the same way saveState() does for localStorage — avoids
    // writing derivable/default fields and keeps the JSONB blob as small as possible.
    const payload = { ...state, pokemons: state.pokemons.map(slimPokemon) };
    const { error } = await _supabase
      .from('pokegang_saves')
      .upsert({
        user_id:  supaSession.user.id,
        slot:     getActiveSaveSlot(),
        state:    payload,
        saved_at: new Date().toISOString(),
      });
    if (!error) {
      supaLastSync = Date.now();
      _cloudSaveFingerprint = fp;
      await supaUpdateLeaderboard();
    }
  } catch { /* silencieux — la save locale est toujours là */ }
  supaSyncing = false;
  updateSupaIndicator();
  if (getActiveTab() === 'tabCompte') renderCompteTab();
}

async function supaCheckCloudLoad() {
  if (!_supabase || !supaSession) return;
  let data, error;
  try {
    ({ data, error } = await _supabase
      .from('pokegang_saves')
      .select('state, saved_at')
      .eq('user_id', supaSession.user.id)
      .eq('slot', getActiveSaveSlot())
      .single());
  } catch { return; }
  if (error || !data) return;

  const cloudTs  = new Date(data.saved_at).getTime();
  const localTs  = state._savedAt || 0;
  if (cloudTs <= localTs) return; // local is already up-to-date

  const cloudRep  = data.state?.gang?.reputation  || 0;
  const localRep  = state.gang?.reputation         || 0;
  const cloudPkm  = (data.state?.pokemons?.length) || 0;
  const localPkm  = (state.pokemons?.length)        || 0;
  const fmt       = new Date(cloudTs).toLocaleString('fr-FR');

  // Si le cloud a significativement moins de progression → ignorer silencieusement
  // (évite d'écraser une save avancée avec un état vide ou early)
  const cloudScore = cloudRep + cloudPkm * 10;
  const localScore = localRep + localPkm * 10;
  if (cloudScore < localScore * 0.5) return;

  const repDiff   = cloudRep - localRep;
  const repLine   = repDiff >= 0
    ? `<span style="color:var(--gold)">⭐ ${cloudRep.toLocaleString()}</span> (${repDiff >= 0 ? '+' : ''}${repDiff.toLocaleString()} vs local)`
    : `<span style="color:var(--red)">⭐ ${cloudRep.toLocaleString()}</span> (<b>−${Math.abs(repDiff).toLocaleString()}</b> vs local)`;

  showConfirm(
    `☁ Save cloud du <b>${fmt}</b><br>
     ${repLine}<br>
     <span style="color:var(--text-dim);font-size:10px">${cloudPkm} Pokémon · Slot ${getActiveSaveSlot() + 1}</span><br>
     <span style="color:var(--text-dim);font-size:10px">La save locale sera remplacée.</span>`,
    () => {
      setState(migrate(data.state));
      saveState();
      renderAll();
      notify('Sauvegarde cloud chargée !', 'success');
      supaUpdateLeaderboard();
    },
    null,
    { confirmLabel: 'Charger le cloud', cancelLabel: 'Garder le local' }
  );
}

async function supaForceCloudLoad() {
  if (!_supabase || !supaSession) return;
  let data, error;
  try {
    ({ data, error } = await _supabase
      .from('pokegang_saves')
      .select('state, saved_at')
      .eq('user_id', supaSession.user.id)
      .eq('slot', getActiveSaveSlot())
      .single());
  } catch { notify('Erreur réseau — réessaie dans un moment.', 'error'); return; }
  if (error || !data) { notify('Aucune sauvegarde cloud trouvée.', 'error'); return; }

  const fmt = new Date(data.saved_at).toLocaleString('fr-FR');
  showConfirm(
    `Charger la save cloud du ${fmt} ?<br><span style="color:var(--text-dim);font-size:11px">La save locale sera écrasée.</span>`,
    () => {
      setState(migrate(data.state));
      saveState();
      renderAll();
      notify('Sauvegarde cloud chargée !', 'success');
      supaUpdateLeaderboard();
    },
    null,
    { confirmLabel: 'Charger', cancelLabel: 'Annuler', danger: true }
  );
}

// ── Rolling snapshots ─────────────────────────────────────────────
const MAX_SNAPSHOTS = 2;
let _snapshotCount = -1; // -1 = unknown (fetched lazily); avoids SELECT on every write

// Snapshot throttle — one snapshot per session at most every 30 minutes.
// The 5-min game loop calls this but the guard prevents actual DB writes more often.
let _lastSnapshotAt = 0;
const SNAPSHOT_THROTTLE_MS = 30 * 60 * 1000; // 30 min minimum between snapshots

async function supaWriteSnapshot() {
  if (!_supabase || !supaSession) return;

  // Rate-limit to one snapshot per 30 minutes (previously fired every 5 min)
  const now = Date.now();
  if (now - _lastSnapshotAt < SNAPSHOT_THROTTLE_MS) return;

  try {
    // Slim the payload — same as cloud save and localStorage
    const payload = { ...state, pokemons: state.pokemons.map(slimPokemon) };

    // 1. Insert new snapshot
    const { error } = await _supabase.from('pokegang_save_snapshots').insert({
      user_id:   supaSession.user.id,
      slot:      getActiveSaveSlot(),
      state:     payload,
      gang_name: state.gang?.name || 'Team ???',
      rep:       state.gang?.reputation || 0,
      saved_at:  new Date().toISOString(),
    });
    if (error) return;

    _lastSnapshotAt = now;

    // Track count client-side to avoid a SELECT on every write
    if (_snapshotCount < 0) {
      // First write since page load — fetch real count once
      const { count } = await _supabase
        .from('pokegang_save_snapshots')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', supaSession.user.id)
        .eq('slot', getActiveSaveSlot());
      _snapshotCount = count ?? MAX_SNAPSHOTS;
    } else {
      _snapshotCount++;
    }

    // 2. Prune only when over limit (avoids SELECT+DELETE every write)
    if (_snapshotCount > MAX_SNAPSHOTS) {
      const { data: rows } = await _supabase
        .from('pokegang_save_snapshots')
        .select('id, saved_at')
        .eq('user_id', supaSession.user.id)
        .eq('slot', getActiveSaveSlot())
        .order('saved_at', { ascending: false });

      if (rows && rows.length > MAX_SNAPSHOTS) {
        const toDelete = rows.slice(MAX_SNAPSHOTS).map(r => r.id);
        await _supabase.from('pokegang_save_snapshots').delete().in('id', toDelete);
        _snapshotCount = MAX_SNAPSHOTS;
      }
    }
  } catch { /* silencieux */ }
}

async function supaFetchSnapshots() {
  if (!_supabase || !supaSession) return [];
  const { data, error } = await _supabase
    .from('pokegang_save_snapshots')
    .select('id, gang_name, rep, saved_at')
    .eq('user_id', supaSession.user.id)
    .eq('slot', getActiveSaveSlot())
    .order('saved_at', { ascending: false })
    .limit(MAX_SNAPSHOTS);
  return (error || !data) ? [] : data;
}

async function supaRestoreSnapshot(snapshotId) {
  if (!_supabase || !supaSession) return;
  const { data, error } = await _supabase
    .from('pokegang_save_snapshots')
    .select('state, saved_at')
    .eq('id', snapshotId)
    .eq('user_id', supaSession.user.id)
    .single();
  if (error || !data) { notify('Snapshot introuvable.', 'error'); return; }

  const fmt = new Date(data.saved_at).toLocaleString('fr-FR');
  showConfirm(
    `Restaurer le snapshot du <b>${fmt}</b> ?<br><span style="color:var(--text-dim);font-size:11px">La save actuelle sera écrasée — exporte-la d'abord si nécessaire.</span>`,
    () => {
      setState(migrate(data.state));
      saveState();
      renderAll();
      notify(`⏪ Snapshot du ${fmt} restauré !`, 'success');
      supaUpdateLeaderboard();
    },
    null,
    { confirmLabel: 'Restaurer', cancelLabel: 'Annuler', danger: true }
  );
}

// ── Sérialise la vitrine pour l'API publique ─────────────────────────────────
function _buildShowcaseData() {
  const calcPrice  = globalThis.calculatePrice;
  const pokeSprite = globalThis.pokeSprite;
  const specName   = globalThis.speciesName;
  return (state.gang.showcase || []).map((id, i) => {
    if (!id) return { slot: i, empty: true };
    const pk = state.pokemons.find(p => p.id === id);
    if (!pk) return { slot: i, empty: true };
    return {
      slot:       i,
      species_en: pk.species_en,
      species_fr: globalThis.SPECIES_BY_EN?.[pk.species_en]?.fr || pk.species_en,
      level:      pk.level     || 1,
      potential:  pk.potential || 0,
      shiny:      pk.shiny     || false,
      price:      calcPrice    ? calcPrice(pk) : 0,
      sprite:     `https://play.pokemonshowdown.com/sprites/gen5/${pk.species_en}.png`,
    };
  });
}

// ── Sérialise l'équipe du boss pour l'API publique ───────────────────────────
function _buildBossTeamData() {
  return (state.gang.bossTeam || []).map((id, i) => {
    const pk = state.pokemons.find(p => p.id === id);
    if (!pk) return null;
    const pot = pk.potential || 0;
    const threat = pot >= 5 ? 'ÉLEVÉE' : pot >= 4 ? 'HAUTE' : pot >= 3 ? 'MODÉRÉE' : 'FAIBLE';
    return {
      slot:       i,
      species_en: pk.species_en,
      species_fr: globalThis.SPECIES_BY_EN?.[pk.species_en]?.fr || pk.species_en,
      level:      pk.level || 1,
      potential:  pot,
      shiny:      pk.shiny || false,
      threat,
      sprite:     `https://play.pokemonshowdown.com/sprites/gen5/${pk.species_en}.png`,
    };
  }).filter(Boolean);
}

// ── Calcule les badges pour l'API publique ───────────────────────────────────
function _buildBadgesData() {
  const kantoCaught   = globalThis.getDexKantoCaught?.()        ?? 0;
  const natCaught     = globalThis.getDexNationalCaught?.()     ?? 0;
  const shinySpecies  = globalThis.getShinySpeciesCount?.()     ?? 0;
  const kantoTotal    = globalThis.KANTO_DEX_SIZE               ?? 151;
  const natTotal      = globalThis.NATIONAL_DEX_SIZE            ?? 493;
  const badges = [];
  if (kantoCaught >= kantoTotal)                badges.push({ id: 'kanto_complete',    label: 'Kanto Complet',    icon: '🏅', color: '#ffcc5a' });
  if (natCaught   >= natTotal)                  badges.push({ id: 'national_complete', label: 'National Complet', icon: '🌐', color: '#4fc3f7' });
  if (shinySpecies >= 30)                       badges.push({ id: 'shiny_hunter',      label: 'Chasseur Shiny',   icon: '✦', color: '#e879f9' });
  if ((state.stats?.totalFightsWon || 0) >= 100) badges.push({ id: 'veteran',          label: 'Vétéran',          icon: '⚔', color: '#f97316' });
  if ((state.stats?.totalCaught    || 0) >= 500) badges.push({ id: 'great_hunter',     label: 'Grand Chasseur',   icon: '◎', color: '#22c55e' });
  return badges;
}

async function supaUpdateLeaderboard() {
  if (!_supabase || !supaSession) return;
  try {
    const purchases  = state.purchases || {};
    const regions    = ['kanto',
      purchases.johtoUnlocked  ? 'johto'  : null,
      purchases.hoennUnlocked  ? 'hoenn'  : null,
      purchases.sinnohUnlocked ? 'sinnoh' : null,
    ].filter(Boolean);

    const publicProfile = state.settings?.publicProfile ?? false;

    const payload = {
      user_id:            supaSession.user.id,
      gang_name:          state.gang.name        || 'Team ???',
      boss_name:          state.gang.bossName    || 'Boss',
      reputation:         state.gang.reputation  || 0,
      total_caught:       state.stats?.totalCaught     || 0,
      total_sold:         state.stats?.totalSold       || 0,
      shiny_count:        state.stats?.shinyCaught     || 0,
      shiny_species_count: globalThis.getShinySpeciesCount?.() || 0,
      dex_kanto_count:    globalThis.getDexKantoCaught?.()     || 0,
      dex_national_count: globalThis.getDexNationalCaught?.()  || 0,
      agents_count:       (state.agents || []).length,
      agents_elite_count: state.stats?.agentsEliteCount        || 0,
      updated_at:         new Date().toISOString(),
      // ── Champs API publique ──────────────────────────────────────────
      public_profile:     publicProfile,
      boss_sprite:        state.gang.bossSprite   || null,
      title_full:         globalThis.getBossFullTitle?.()  || null,
      total_fights_won:   state.stats?.totalFightsWon      || 0,
      chests_opened:      state.stats?.chestsOpened        || 0,
      pokemon_count:      state.pokemons?.length           || 0,
      money:              state.gang.money                 || 0,
      total_money_earned: state.stats?.totalMoneyEarned    || 0,
      regions_data:       regions,
      showcase_data:      publicProfile ? _buildShowcaseData()  : [],
      boss_team_data:     publicProfile ? _buildBossTeamData()  : [],
      badges_data:        publicProfile ? _buildBadgesData()    : [],
    };

    const { error } = await _supabase.from('pokegang_players').upsert(payload);
    if (error) console.warn('PokéForge: pokegang_players sync failed', error.message);
  } catch (err) {
    console.warn('PokéForge: pokegang_players sync failed', err?.message ?? err);
  }
}

// ── Toggle opt-in profil public ───────────────────────────────────────────────
async function supaTogglePublicProfile(enable) {
  if (!_supabase || !supaSession) return { error: 'Non connecté' };
  if (!state.settings) state.settings = {};
  state.settings.publicProfile = !!enable;
  globalThis.saveState?.();
  await supaUpdateLeaderboard();
  // Récupère le token généré par le trigger SQL
  if (enable) {
    const { data } = await _supabase
      .from('pokegang_players')
      .select('profile_token')
      .eq('user_id', supaSession.user.id)
      .maybeSingle();
    return { token: data?.profile_token || null };
  }
  return { ok: true };
}

globalThis.supaTogglePublicProfile = supaTogglePublicProfile;

// ── Monthly leaderboard snapshot (localStorage) ──────────────────
// Tracks cumulative stats at the start of each calendar month so we can
// compute deltas (rep/caught/shinies earned THIS month) client-side.
const _LB_MONTH_SNAP_KEY = 'pg.lb_month_snap';
function _lbMonthKey() { return new Date().toISOString().slice(0, 7); } // '2026-05'

function _getOrInitMonthSnap() {
  const currentMonth = _lbMonthKey();
  let snap = {};
  try { snap = JSON.parse(localStorage.getItem(_LB_MONTH_SNAP_KEY) || '{}'); } catch {}
  if (snap.month !== currentMonth) {
    snap = {
      month:        currentMonth,
      reputation:   state.gang.reputation   || 0,
      totalCaught:  state.stats?.totalCaught   || 0,
      shinyCaught:  state.stats?.shinyCaught   || 0,
      shinySpecies: getShinySpeciesCount(),
    };
    localStorage.setItem(_LB_MONTH_SNAP_KEY, JSON.stringify(snap));
  }
  return snap;
}

function _getMonthlyDeltas() {
  const snap = _getOrInitMonthSnap();
  return {
    month_key:             snap.month,
    rep_monthly:           Math.max(0, (state.gang.reputation   || 0) - snap.reputation),
    caught_monthly:        Math.max(0, (state.stats?.totalCaught   || 0) - snap.totalCaught),
    shiny_monthly:         Math.max(0, (state.stats?.shinyCaught   || 0) - snap.shinyCaught),
    shiny_species_monthly: Math.max(0, getShinySpeciesCount()            - snap.shinySpecies),
  };
}

// ── Anonymous leaderboard push (works with or without auth) ──────
// Uses a local token as primary key; links user_id when authenticated.
// Full Supabase schema: docs/supabase-setup.md and docs/supabase-schema.sql.
async function supaUpdateLeaderboardAnon() {
  if (!_supabase) return;
  const now = Date.now();
  if (now - _lbLastPushAt < LB_PUSH_THROTTLE_MS) return;

  // Dirty check — skip if key stats haven't changed since last push
  const fp = `${state.gang.reputation}|${state.stats?.totalCaught}|${state.stats?.shinyCaught}|${state.gang.name}`;
  if (fp === _lbLastFingerprint) return;
  _lbLastFingerprint = fp;
  _lbLastPushAt = now;

  const monthly = _getMonthlyDeltas();

  // L'écriture directe sur pokegang_leaderboard est révoquée côté anon/authenticated
  // (RLS) : on passe par l'Edge Function pokegang-leaderboard-submit, qui valide,
  // assainit (anti-XSS) et écrit via service role. user_id / is_anonymous /
  // updated_at sont dérivés serveur — inutile de les envoyer.
  const { url, anonKey } = getSupabaseConfig();
  const accessToken = supaSession?.access_token || anonKey;

  try {
    await _supaFetch(`${url}/functions/v1/pokegang-leaderboard-submit`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        anonKey,
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        token:               getLeaderboardToken(),
        gang_name:           state.gang.name        || 'Team ???',
        boss_name:           state.gang.bossName    || 'Boss',
        boss_sprite:         state.gang.bossSprite  || null,
        reputation:          state.gang.reputation  || 0,
        total_caught:        state.stats?.totalCaught        || 0,
        shiny_count:         state.stats?.shinyCaught        || 0,
        shiny_species_count: getShinySpeciesCount(),
        dex_kanto_count:     getDexKantoCaught(),
        dex_national_count:  getDexNationalCaught(),
        total_sold:          state.stats?.totalSold          || 0,
        total_money_earned:  state.stats?.totalMoneyEarned   || 0,
        agents_count:        (state.agents || []).length,
        // monthly deltas
        month_key:             monthly.month_key,
        rep_monthly:           monthly.rep_monthly,
        caught_monthly:        monthly.caught_monthly,
        shiny_monthly:         monthly.shiny_monthly,
        shiny_species_monthly: monthly.shiny_species_monthly,
      }),
    });
    await supaUpdateLeaderboard();
  } catch { /* silencieux */ }
}

// ── Top-bar indicator ─────────────────────────────────────────────
function updateSupaIndicator() {
  const el = document.getElementById('supaIndicator');
  if (!el) return;
  if (!supaConfigured()) { el.style.display = 'none'; return; }

  el.style.display = 'flex';
  if (!supaSession) {
    el.textContent = '☁';
    el.style.color = 'var(--text-dim)';
    el.title       = 'Non connecté — cliquer pour se connecter';
  } else if (supaSyncing) {
    el.textContent = '⟳';
    el.style.color = 'var(--gold)';
    el.title       = 'Synchronisation en cours…';
  } else if (supaLastSync) {
    const ago = Math.round((Date.now() - supaLastSync) / 1000);
    el.textContent = '☁';
    el.style.color = 'var(--green)';
    el.title       = `Cloud syncé il y a ${ago}s`;
  } else {
    el.textContent = '☁';
    el.style.color = '#ff9900';
    el.title       = 'Connecté — non encore syncé';
  }

  // Clic = aller sur l'onglet Compte
  el.onclick = () => switchTab('tabCompte');
}

// Mettre à jour le label du bouton tab Compte (connecté / non connecté)
function updateSupaTabLabel() {
  const btn = document.getElementById('tabBtnCompte');
  if (!btn) return;
  btn.textContent = supaSession ? '☁ Compte ●' : '☁ Compte';
  btn.style.color = supaSession ? 'var(--green)' : '';
}

// ── Leaderboard Tab ───────────────────────────────────────────────
let _lbSortBy   = 'reputation'; // sort column key
let _lbPeriod   = 'monthly';   // 'monthly' | 'alltime'

// Sorts available per period
const _LB_SORTS_MONTHLY = [
  { key: 'reputation',          label: '⭐ Réputation'   },
  { key: 'total_caught',        label: '🎯 Capturés'    },
  { key: 'shiny_species_count', label: '✨ Chromas'       },
];
const _LB_SORTS_ALLTIME = [
  { key: 'reputation',          label: '⭐ Réputation'   },
  { key: 'dex_kanto_count',     label: '📖 Dex Kanto'   },
  { key: 'dex_national_count',  label: '📗 Dex National' },
  { key: 'shiny_species_count', label: '✨ Chromas'       },
  { key: 'total_caught',        label: '🎯 Capturés'    },
  { key: 'total_sold',          label: '💰 Ventes'      },
  { key: 'total_money_earned',  label: '💵 Gains total'  },
];

async function renderLeaderboardTab() {
  const tab = document.getElementById('tabLeaderboard');
  if (!tab) return;

  if (!supaConfigured()) {
    tab.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-dim);font-family:var(--font-pixel);font-size:10px">
      🏆 CLASSEMENT<br><br><span style="font-size:9px;font-family:inherit">Supabase non configuré — le classement n'est pas disponible en mode hors-ligne.</span>
    </div>`;
    return;
  }

  const SORTS   = _lbPeriod === 'monthly' ? _LB_SORTS_MONTHLY : _LB_SORTS_ALLTIME;
  const PERIODS = [
    { key: 'monthly', label: '📅 Ce mois' },
    { key: 'alltime', label: '🌍 Depuis toujours' },
  ];

  // Reset sort if not valid for current period
  if (!SORTS.some(s => s.key === _lbSortBy)) _lbSortBy = 'reputation';

  const btnStyle = (active) =>
    `font-family:var(--font-pixel);font-size:7px;padding:4px 9px;border-radius:var(--radius-sm);cursor:pointer;` +
    `background:${active ? 'var(--red)' : 'var(--bg)'};` +
    `border:1px solid ${active ? 'var(--red)' : 'var(--border)'};` +
    `color:${active ? '#fff' : 'var(--text-dim)'}`;

  const monthLabel = new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' });

  tab.innerHTML = `
    <div style="padding:16px;max-width:820px">
      <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:12px">
        <span style="font-family:var(--font-pixel);font-size:12px;color:var(--gold)">🏆 CLASSEMENT MONDIAL</span>
        ${_lbPeriod === 'monthly' ? `<span style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim)">${monthLabel}</span>` : ''}
      </div>
      <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;align-items:center">
        <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">PÉRIODE :</span>
        ${PERIODS.map(p => `<button class="lb-period-btn" data-period="${p.key}" style="${btnStyle(_lbPeriod === p.key)}">${p.label}</button>`).join('')}
        <button id="btnLbRefresh" style="${btnStyle(false)};margin-left:auto">⟳</button>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
        <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">CATÉGORIE :</span>
        ${SORTS.map(s => `<button class="lb-sort-btn" data-sort="${s.key}" style="${btnStyle(_lbSortBy === s.key)}">${s.label}</button>`).join('')}
      </div>
      <div id="lbMyEntry" style="margin-bottom:10px;padding:10px 12px;background:rgba(255,204,90,.07);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);font-size:9px;color:var(--text-dim)">
        Chargement de votre position…
      </div>
      <div id="lbTable" style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;min-height:120px">
        <div style="padding:16px;color:var(--text-dim);font-size:10px;text-align:center">Chargement…</div>
      </div>
      <div style="margin-top:8px;font-size:8px;color:var(--text-dim);text-align:right">
        Top 50 · Mis à jour toutes les 2h si actif ·
        ${supaSession ? `<span style="color:var(--green)">Connecté ✓</span>` : `<span>Anonyme — <a href="#" id="lbGoLogin" style="color:var(--gold);text-decoration:none">Connecte-toi</a></span>`}
      </div>
    </div>`;

  tab.querySelectorAll('.lb-sort-btn').forEach(btn => {
    btn.addEventListener('click', () => { _lbSortBy = btn.dataset.sort; renderLeaderboardTab(); });
  });
  tab.querySelectorAll('.lb-period-btn').forEach(btn => {
    btn.addEventListener('click', () => { _lbPeriod = btn.dataset.period; renderLeaderboardTab(); });
  });
  tab.querySelector('#btnLbRefresh')?.addEventListener('click', () => renderLeaderboardTab());
  tab.querySelector('#lbGoLogin')?.addEventListener('click', e => { e.preventDefault(); switchTab('tabCompte'); });

  await supaUpdateLeaderboardAnon();
  _loadLeaderboardTable();
}

async function _loadLeaderboardTable() {
  if (!_supabase) return;

  const isMonthly    = _lbPeriod === 'monthly';
  const currentMonth = _lbMonthKey();

  const SORT_COLS_MONTHLY = {
    reputation:          'rep_monthly',
    total_caught:        'caught_monthly',
    shiny_species_count: 'shiny_species_monthly',
  };
  const SORT_COLS_ALLTIME = {
    reputation:          'reputation',
    dex_kanto_count:     'dex_kanto_count',
    dex_national_count:  'dex_national_count',
    shiny_species_count: 'shiny_species_count',
    total_caught:        'total_caught',
    total_sold:          'total_sold',
    total_money_earned:  'total_money_earned',
  };
  const SORT_LABELS = {
    reputation:          '⭐ Rép.',
    dex_kanto_count:     '📖 Kanto',
    dex_national_count:  '📗 National',
    shiny_species_count: '✨ Chroma',
    total_caught:        '🎯 Cap.',
    total_sold:          '💰 Ventes',
    total_money_earned:  '💵 Gains',
  };

  const SORT_COLS = isMonthly ? SORT_COLS_MONTHLY : SORT_COLS_ALLTIME;
  const col = SORT_COLS[_lbSortBy] || (isMonthly ? 'rep_monthly' : 'reputation');
  const selectFields = 'token, user_id, gang_name, boss_name, boss_sprite, reputation, total_caught, shiny_count, shiny_species_count, dex_kanto_count, dex_national_count, total_sold, total_money_earned, agents_count, is_anonymous, updated_at, month_key, rep_monthly, caught_monthly, shiny_monthly, shiny_species_monthly';

  let query = _supabase
    .from('pokegang_leaderboard')
    .select(selectFields)
    .order(col, { ascending: false })
    .limit(50);

  if (isMonthly) query = query.eq('month_key', currentMonth);

  const { data: rows, error } = await query;

  const { data: myRow } = await _supabase
    .from('pokegang_leaderboard')
    .select('gang_name, reputation, total_caught, shiny_species_count, dex_kanto_count, dex_national_count, total_sold, total_money_earned, updated_at, month_key, rep_monthly, caught_monthly, shiny_monthly, shiny_species_monthly')
    .eq('token', getLeaderboardToken())
    .maybeSingle();

  let myRank = '—';
  if (myRow) {
    const myVal = myRow[col] || 0;
    let rankQ = _supabase.from('pokegang_leaderboard').select('token', { count: 'exact', head: true }).gt(col, myVal);
    if (isMonthly) rankQ = rankQ.eq('month_key', currentMonth);
    const { count } = await rankQ;
    if (count !== null) myRank = `#${count + 1}`;
  }

  const myEntryEl = document.getElementById('lbMyEntry');
  if (myEntryEl) {
    if (myRow) {
      const updAgo = myRow.updated_at ? _lbAgo(new Date(myRow.updated_at)) : '?';
      const isSameMonth = myRow.month_key === currentMonth;
      if (isMonthly) {
        const repM = isSameMonth ? (myRow.rep_monthly           ?? 0) : 0;
        const capM = isSameMonth ? (myRow.caught_monthly        ?? 0) : 0;
        const shM  = isSameMonth ? (myRow.shiny_species_monthly ?? 0) : 0;
        const _s   = (n) => (n > 0 ? '+' : '') + n.toLocaleString('fr-FR');
        const repColor = repM < 0 ? 'var(--red)' : 'var(--text-dim)';
        myEntryEl.innerHTML = `
          <span style="color:var(--gold);font-family:var(--font-pixel);font-size:9px">${_esc(myRow.gang_name)}</span>
          <span style="margin-left:12px">Rang <b style="color:var(--gold)">${myRank}</b></span>
          <span style="margin-left:12px;color:${repColor}">⭐ ${_s(repM)} rép.</span>
          <span style="margin-left:12px;color:var(--text-dim)">🎯 ${_s(capM)}</span>
          <span style="margin-left:12px;color:var(--text-dim)">✨ ${_s(shM)}</span>
          <span style="margin-left:auto;font-size:8px;opacity:.6">${isSameMonth ? `maj ${updAgo}` : 'pas encore de données ce mois'}</span>`;
      } else {
        myEntryEl.innerHTML = `
          <span style="color:var(--gold);font-family:var(--font-pixel);font-size:9px">${_esc(myRow.gang_name)}</span>
          <span style="margin-left:12px">Rang <b style="color:var(--gold)">${myRank}</b></span>
          <span style="margin-left:12px;color:var(--text-dim)">⭐ ${(myRow.reputation||0).toLocaleString('fr-FR')}</span>
          <span style="margin-left:12px;color:var(--text-dim)">✨ ${myRow.shiny_species_count||0}</span>
          <span style="margin-left:12px;color:var(--text-dim)">📖 ${myRow.dex_kanto_count||0}/151</span>
          <span style="margin-left:auto;font-size:8px;opacity:.6">maj ${updAgo}</span>`;
      }
      myEntryEl.style.cssText += ';display:flex;align-items:center;gap:0;flex-wrap:wrap';
    } else {
      myEntryEl.textContent = "Votre entrée n'est pas encore dans le classement.";
    }
  }

  const tableEl = document.getElementById('lbTable');
  if (!tableEl) return;

  if (error || !rows?.length) {
    const periodLabel = isMonthly ? 'ce mois-ci' : 'all time';
    tableEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-dim);font-size:10px">Aucune entrée ${periodLabel} — sois le premier !</div>`;
    return;
  }

  const MEDALS = ['🥇','🥈','🥉'];
  const sortLabel = SORT_LABELS[_lbSortBy] || '⭐ Rép.';
  // Sign helper: prepends '+' for positive, nothing for negative (already has '-')
  const _sign = (n) => (typeof n === 'number' && n > 0) ? '+' : '';
  const _fmt  = (n) => typeof n === 'number' ? (_sign(n) + n.toLocaleString('fr-FR')) : String(n ?? 0);

  tableEl.innerHTML = `
    <div style="display:grid;grid-template-columns:36px 1fr auto;border-bottom:1px solid var(--border);padding:6px 10px;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">
      <span>#</span><span>Gang</span><span style="text-align:right">${isMonthly ? '📅 ' : ''}${sortLabel}</span>
    </div>
    ${rows.map((p, i) => {
      const isMe  = p.token === getLeaderboardToken();
      const medal = i < 3
        ? `<span style="font-size:18px">${MEDALS[i]}</span>`
        : `<span style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim)">${i+1}</span>`;
      const nameTag = p.is_anonymous
        ? `<span style="font-size:8px;color:var(--text-dim)">Joueur anonyme <span style="opacity:.5">#${p.token.slice(-5)}</span></span>`
        : `<span style="font-size:9px">${_esc(p.gang_name)}</span>`;
      const sprite = p.boss_sprite
        ? `<img src="https://play.pokemonshowdown.com/sprites/gen5/${_esc(p.boss_sprite)}.png" style="width:32px;height:32px;image-rendering:pixelated" onerror="this.style.display='none'">`
        : `<div style="width:32px;height:32px;background:var(--bg);border-radius:4px"></div>`;
      const val    = p[col] ?? 0;
      const valStr = isMonthly ? _fmt(val) : (typeof val === 'number' ? val.toLocaleString('fr-FR') : String(val ?? 0));
      const valColor = isMonthly && val < 0 ? 'var(--red)' : 'var(--gold)';
      const ago = p.updated_at ? _lbAgo(new Date(p.updated_at)) : '';
      const shM  = p.shiny_species_monthly ?? 0;
      const capM = p.caught_monthly        ?? 0;
      const secLine = isMonthly
        ? `✨ ${_fmt(shM)}   🎯 ${_fmt(capM)}`
        : `✨ ${p.shiny_species_count ?? 0}   📖 ${p.dex_kanto_count ?? 0}/151`;
      return `<div style="display:grid;grid-template-columns:36px auto 1fr auto;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--border);background:${isMe ? 'rgba(255,204,90,.07)' : ''};border-left:3px solid ${isMe ? 'var(--gold)' : 'transparent'}">
        <span style="text-align:center">${medal}</span>
        ${sprite}
        <div style="min-width:0">
          ${isMe ? `<div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">${_esc(p.gang_name)} <span style="font-size:7px;opacity:.7">◄ toi</span></div>` : nameTag}
          <div style="font-size:8px;color:var(--text-dim);margin-top:1px">${_esc(p.boss_name || '')}${ago ? ` · ${ago}` : ''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-family:var(--font-pixel);font-size:9px;color:${valColor}">${valStr}</div>
          <div style="font-size:8px;color:var(--text-dim);margin-top:2px">${secLine}</div>
        </div>
      </div>`;
    }).join('')}`;
}

function _lbAgo(date) {
  const ms = Date.now() - date.getTime();
  if (ms < 60_000)    return "à l'instant";
  if (ms < 3600_000)  return `il y a ${Math.round(ms/60_000)}min`;
  if (ms < 86400_000) return `il y a ${Math.round(ms/3600_000)}h`;
  return `il y a ${Math.round(ms/86400_000)}j`;
}

// ── Compte Tab UI ─────────────────────────────────────────────────
async function renderCompteTab() {
  const tab = document.getElementById('tabCompte');
  if (!tab) return;

  if (!supaConfigured()) {
    tab.innerHTML = `
      <div style="padding:40px;text-align:center;color:var(--text-dim)">
        <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold);margin-bottom:20px">☁ COMPTE CLOUD</div>
        <div style="font-size:11px;margin-bottom:12px">Supabase non configuré.</div>
        <div style="font-size:10px;line-height:1.8">
          1. Copie <code style="color:var(--gold)">game/config.example.js</code> → <code style="color:var(--gold)">game/config.js</code><br>
          2. Remplis <code>SUPABASE_URL</code> et <code>SUPABASE_ANON_KEY</code><br>
          3. Suis le guide SQL dans <code>docs/supabase-setup.md</code>
        </div>
      </div>`;
  } else if (!supaSession) {
    // ── Formulaire de connexion ──────────────────────────────────
    tab.innerHTML = `
      <div style="max-width:380px;margin:48px auto;padding:28px;background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius)">
        <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold);margin-bottom:8px;text-align:center">☁ COMPTE CLOUD</div>
        <div style="font-size:9px;color:var(--text-dim);text-align:center;margin-bottom:24px">
          Connecte-toi pour activer la sauvegarde cloud et le classement.
        </div>
        <div id="supaMsg" style="font-size:10px;min-height:18px;text-align:center;margin-bottom:12px"></div>
        <div style="margin-bottom:12px">
          <label style="font-size:9px;display:block;margin-bottom:4px;color:var(--text-dim);letter-spacing:.05em">EMAIL</label>
          <input id="supaEmail" type="email" placeholder="joueur@exemple.com" style="width:100%;padding:9px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:11px;outline:none">
        </div>
        <div style="margin-bottom:24px">
          <label style="font-size:9px;display:block;margin-bottom:4px;color:var(--text-dim);letter-spacing:.05em">MOT DE PASSE</label>
          <input id="supaPassword" type="password" placeholder="••••••••" style="width:100%;padding:9px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:11px;outline:none">
        </div>
        <div style="display:flex;gap:8px">
          <button id="btnSupaLogin"    style="flex:1;padding:11px;background:var(--red);border:none;border-radius:var(--radius-sm);color:#fff;font-family:var(--font-pixel);font-size:9px;cursor:pointer;letter-spacing:.04em">CONNEXION</button>
          <button id="btnSupaRegister" style="flex:1;padding:11px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text);font-family:var(--font-pixel);font-size:9px;cursor:pointer;letter-spacing:.04em">CRÉER COMPTE</button>
        </div>
      </div>`;

    const msg = () => tab.querySelector('#supaMsg');
    const setMsg = (txt, color) => {
      const el = msg();
      if (el) { el.textContent = txt; el.style.color = color || 'var(--text)'; }
    };

    tab.querySelector('#btnSupaLogin')?.addEventListener('click', async () => {
      const email    = tab.querySelector('#supaEmail')?.value.trim();
      const password = tab.querySelector('#supaPassword')?.value;
      if (!email || !password) { setMsg('Remplis tous les champs.', 'var(--red)'); return; }
      setMsg('Connexion…', 'var(--gold)');
      const { error } = await supaSignIn(email, password);
      if (error) setMsg(error, 'var(--red)');
    });

    tab.querySelector('#btnSupaRegister')?.addEventListener('click', async () => {
      const email    = tab.querySelector('#supaEmail')?.value.trim();
      const password = tab.querySelector('#supaPassword')?.value;
      if (!email || !password) { setMsg('Remplis tous les champs.', 'var(--red)'); return; }
      if (password.length < 6) { setMsg('Mot de passe trop court (6 caractères min).', 'var(--red)'); return; }
      setMsg('Création du compte…', 'var(--gold)');
      const { error } = await supaSignUp(email, password);
      if (error) setMsg(error, 'var(--red)');
      else setMsg('Compte créé ! Vérifie ton email pour confirmer, puis connecte-toi.', 'var(--green)');
    });

  } else {
    // ── Interface connectée ──────────────────────────────────────
    const user     = supaSession.user;
    const syncAgo  = supaLastSync
      ? `il y a ${Math.round((Date.now() - supaLastSync) / 1000)}s`
      : 'jamais';
    const syncColor = supaLastSync ? 'var(--green)' : '#ff9900';
    const syncLabel = supaSyncing ? '⟳ Synchronisation…' : supaLastSync ? `✅ Syncé ${syncAgo}` : '⚠ Non encore syncé';

    tab.innerHTML = `
      <div style="padding:16px;max-width:760px">
        <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold);margin-bottom:16px">☁ COMPTE CLOUD</div>

        <!-- Carte joueur -->
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
          ${state.gang.bossSprite
            ? `<img src="https://play.pokemonshowdown.com/sprites/gen5/${state.gang.bossSprite}.png" style="width:64px;height:64px;image-rendering:pixelated">`
            : ''}
          <div style="flex:1;min-width:160px">
            <div style="font-family:var(--font-pixel);font-size:11px;margin-bottom:6px">${_esc(state.gang.name)}</div>
            <div style="font-size:10px;color:var(--text-dim);margin-bottom:4px">${user.email}</div>
            <div style="font-size:10px">⭐ <b style="color:var(--gold)">${state.gang.reputation || 0}</b> réputation</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;min-width:160px">
            <div style="font-size:9px;color:${syncColor};text-align:right;margin-bottom:2px">${syncLabel}</div>
            <button id="btnSupaForceSave"  style="padding:7px 12px;background:var(--bg);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--green);font-size:9px;cursor:pointer;letter-spacing:.04em">↑ Sauvegarder maintenant</button>
            <button id="btnSupaLoadCloud"  style="padding:7px 12px;background:var(--bg);border:1px solid var(--blue);border-radius:var(--radius-sm);color:var(--blue);font-size:9px;cursor:pointer;letter-spacing:.04em">↓ Charger depuis le cloud</button>
            <button id="btnSupaLogout"     style="padding:7px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);font-size:9px;cursor:pointer">Déconnexion</button>
          </div>
        </div>

        <!-- Historique des snapshots -->
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px">
          <div style="font-family:var(--font-pixel);font-size:10px;color:var(--blue);margin-bottom:12px">📸 HISTORIQUE CLOUD <span style="font-size:7px;opacity:.6">(toutes les 5 min · 6 max)</span></div>
          <div id="supaSnapshots" style="min-height:40px">
            <div style="color:var(--text-dim);font-size:10px;padding:4px">Chargement…</div>
          </div>
        </div>

        <!-- Profil Public API -->
        ${(function() {
          const isPublic = state.settings?.publicProfile ?? false;
          const token    = state.settings?.profileToken  ?? null;
          const apiUrl   = token ? `https://pokegang.sterenna.fr/api/gang?token=${token}` : null;
          return `
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:16px">
          <div style="font-family:var(--font-pixel);font-size:9px;color:var(--blue);margin-bottom:8px">🔗 PROFIL PUBLIC / API</div>
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:10px;line-height:1.6">
            Rends ta fiche gang publique pour l'intégrer sur d'autres sites via l'API.<br>
            <a href="/docs/api.html" target="_blank" style="color:var(--blue)">→ Documentation API</a>
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:9px;color:var(--text)">
              <input type="checkbox" id="chkPublicProfile" ${isPublic ? 'checked' : ''} style="accent-color:var(--blue);width:16px;height:16px">
              Profil public activé
            </label>
            ${isPublic && apiUrl ? `
            <div style="flex:1;min-width:200px">
              <input id="apiUrlDisplay" type="text" readonly value="${apiUrl}"
                style="width:100%;padding:5px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);font-size:8px;color:var(--text-dim);cursor:pointer"
                onclick="this.select()" title="Cliquer pour sélectionner">
            </div>
            <button id="btnCopyApiUrl" style="font-size:8px;padding:5px 10px;background:var(--bg);border:1px solid var(--blue);border-radius:var(--radius-sm);color:var(--blue);cursor:pointer;white-space:nowrap">📋 Copier</button>
            ` : ''}
          </div>
        </div>`;
        })()}

        <!-- Lien classement -->
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:14px;display:flex;align-items:center;gap:12px">
          <div style="flex:1">
            <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:4px">🏆 CLASSEMENT MONDIAL</div>
            <div style="font-size:9px;color:var(--text-dim)">Visible depuis l'onglet dédié — disponible pour tous, même sans compte.</div>
          </div>
          <button id="btnGoLeaderboard" style="font-family:var(--font-pixel);font-size:8px;padding:8px 14px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer;white-space:nowrap">Voir 🏆</button>
        </div>
      </div>`;

    tab.querySelector('#btnSupaForceSave')?.addEventListener('click', async () => {
      _lbLastPushAt        = 0;   // forcer le throttle leaderboard
      _lbLastFingerprint   = '';   // forcer le dirty check leaderboard
      _cloudSaveFingerprint = '';  // forcer le dirty check cloud save
      await supaCloudSave();
      await supaUpdateLeaderboardAnon();
    });
    tab.querySelector('#btnSupaLoadCloud')?.addEventListener('click', async () => {
      await supaForceCloudLoad();
    });
    tab.querySelector('#btnSupaLogout')?.addEventListener('click', () => {
      showConfirm('Se déconnecter du compte cloud ?', async () => { await supaSignOut(); }, null, { danger: true, confirmLabel: 'Déconnecter', cancelLabel: 'Annuler' });
    });
    tab.querySelector('#btnGoLeaderboard')?.addEventListener('click', () => switchTab('tabLeaderboard'));

    // Toggle profil public
    tab.querySelector('#chkPublicProfile')?.addEventListener('change', async (e) => {
      const enable = e.target.checked;
      const result = await supaTogglePublicProfile(enable);
      if (enable && result?.token) {
        if (!state.settings) state.settings = {};
        state.settings.profileToken = result.token;
        globalThis.saveState?.();
      }
      renderCompteTab(); // refresh pour afficher l'URL
    });

    // Copier l'URL API
    tab.querySelector('#btnCopyApiUrl')?.addEventListener('click', () => {
      const url = tab.querySelector('#apiUrlDisplay')?.value;
      if (url) {
        navigator.clipboard.writeText(url).then(() => {
          const btn = tab.querySelector('#btnCopyApiUrl');
          if (btn) { btn.textContent = '✅ Copié !'; setTimeout(() => { btn.textContent = '📋 Copier'; }, 2000); }
        });
      }
    });

    // Charger les snapshots en async
    supaFetchSnapshots().then(snapshots => {
      const el = document.getElementById('supaSnapshots');
      if (!el) return;
      if (!snapshots.length) {
        el.innerHTML = `<div style="color:var(--text-dim);font-size:9px;font-style:italic">Aucun snapshot disponible — le premier sera créé dans 5 minutes.</div>`;
        return;
      }
      const now = Date.now();
      el.innerHTML = snapshots.map(s => {
        const ts      = new Date(s.saved_at);
        const diffMs  = now - ts.getTime();
        const diffMin = Math.round(diffMs / 60000);
        const ago     = diffMin < 1 ? 'à l\'instant'
                      : diffMin < 60 ? `il y a ${diffMin} min`
                      : `il y a ${Math.round(diffMin / 60)}h`;
        const label   = ts.toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
        return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1;min-width:0">
            <div style="font-size:9px;color:var(--text)">${_esc(s.gang_name)}</div>
            <div style="font-size:8px;color:var(--text-dim)">⭐ ${(s.rep||0).toLocaleString('fr-FR')} rép · ${label} <span style="opacity:.6">(${ago})</span></div>
          </div>
          <button data-snapshot-id="${s.id}" style="flex-shrink:0;font-family:var(--font-pixel);font-size:7px;padding:4px 8px;background:var(--bg);border:1px solid var(--blue);border-radius:var(--radius-sm);color:var(--blue);cursor:pointer;white-space:nowrap">⏪ Restaurer</button>
        </div>`;
      }).join('');

      el.querySelectorAll('[data-snapshot-id]').forEach(btn => {
        btn.addEventListener('click', () => supaRestoreSnapshot(Number(btn.dataset.snapshotId)));
      });
    });

  }

  // ── Section Nitro (couche bonus, toujours affichée) ─────────────
  _appendNitroSection(tab).catch(e =>
    console.warn('[PokéGang Nitro] Section render error:', e.message)
  );
}

// ════════════════════════════════════════════════════════════════
//  Nitro integration UI
// ════════════════════════════════════════════════════════════════

async function _appendNitroSection(tab) {
  const wrapper = document.createElement('div');
  wrapper.id = 'nitroSection';
  wrapper.style.cssText = 'padding:0 16px 16px;max-width:760px';
  wrapper.innerHTML = `
    <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:16px">
      <div style="font-family:var(--font-pixel);font-size:10px;color:#7ec8e3;margin-bottom:10px">🌐 COMPTE NITRO / GWEN HA STAR</div>
      <div id="nitroStatus" style="font-size:9px;color:var(--text-dim)">Vérification…</div>
    </div>`;
  tab.appendChild(wrapper);

  const statusEl = wrapper.querySelector('#nitroStatus');
  if (!statusEl) return;

  const nitro = await initNitroBridge();

  if (!nitro.available) {
    statusEl.innerHTML = `
      <div style="color:var(--text-dim)">Intégration Nitro indisponible pour le moment.</div>
      <div style="font-size:8px;color:var(--text-dim);margin-top:4px;opacity:.7">
        Le module partagé n'a pas pu être chargé (CORS, réseau ou maintenance).
        Le jeu continue localement.
      </div>`;
    return;
  }

  if (nitro.connected && nitro.user) {
    const name = nitro.displayName ?? nitro.user.email ?? '—';
    statusEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:160px">
          <div style="color:#7ec8e3;margin-bottom:4px">✅ Identité Nitro détectée</div>
          <div style="margin-bottom:2px"><b style="color:var(--text)">${_escHtml(name)}</b></div>
          <div style="color:var(--text-dim);font-size:8px">${_escHtml(nitro.user.email ?? '')}</div>
          <div style="color:var(--text-dim);font-size:7px;font-family:var(--font-mono,monospace);margin-top:4px;opacity:.55">id · ${_escHtml(nitro.user.id ?? '')}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <a href="https://nitro.sterenna.fr/star/" target="_blank" rel="noopener"
             style="padding:7px 12px;background:var(--bg);border:1px solid #7ec8e3;border-radius:var(--radius-sm);color:#7ec8e3;font-size:9px;text-decoration:none;text-align:center;white-space:nowrap">
            Voir mon espace ★ Star
          </a>
        </div>
      </div>
      <div style="font-size:7px;color:var(--text-dim);margin-top:10px;opacity:.65;line-height:1.5">
        PokéGang est sur un sous-domaine séparé. La liaison complète du compte
        (sauvegardes cloud Nitro, récompenses cross-app) sera ajoutée progressivement.
      </div>`;
  } else {
    statusEl.innerHTML = `
      <div style="color:var(--text-dim);margin-bottom:8px">Aucune session Nitro détectée.</div>
      <div style="font-size:8px;color:var(--text-dim);margin-bottom:10px;line-height:1.6;opacity:.8">
        PokéGang est hébergé sur un sous-domaine différent de Nitro.<br>
        Même avec CORS, la session ne se partage pas automatiquement.
        Connecte-toi à Nitro pour lier ton profil plus tard.
      </div>
      <button id="btnNitroLogin"
        style="padding:8px 14px;background:var(--bg);border:1px solid #7ec8e3;border-radius:var(--radius-sm);color:#7ec8e3;font-family:var(--font-pixel);font-size:8px;cursor:pointer;letter-spacing:.04em">
        Se connecter sur Nitro
      </button>`;
    wrapper.querySelector('#btnNitroLogin')?.addEventListener('click', () => {
      redirectToNitroLogin(window.location.href);
    });
  }
}

function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ════════════════════════════════════════════════════════════════

function getSupabaseClient() { return _supabase; }
function getSupaSession()  { return supaSession; }

export {
  configureCloudAccount, initSupabase, supaConfigured, supaCloudSave, supaWriteSnapshot,
  supaUpdateLeaderboard, supaUpdateLeaderboardAnon, renderLeaderboardTab, renderCompteTab,
  updateSupaIndicator, updateSupaTabLabel,
  getSupabaseClient, getSupaSession,
};
