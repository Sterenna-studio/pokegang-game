// ════════════════════════════════════════════════════════════════
//  CLOUD ACCOUNT MODULE
//  Extracted from app.js — Supabase auth, cloud saves, snapshots, leaderboard
// ════════════════════════════════════════════════════════════════
//
//  Supabase remains optional. app.js injects runtime dependencies through
//  configureCloudAccount() so this module does not need to read app internals
//  directly.
// ════════════════════════════════════════════════════════════════

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
  // Après connexion : proposer de charger la save cloud si plus récente
  await supaCheckCloudLoad();
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
      .from('player_saves')
      .upsert({
        user_id:  supaSession.user.id,
        slot:     getActiveSaveSlot(),
        state:    payload,
        saved_at: new Date().toISOString(),
      });
    if (!error) {
      supaLastSync = Date.now();
      _cloudSaveFingerprint = fp;
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
      .from('player_saves')
      .select('state, saved_at')
      .eq('user_id', supaSession.user.id)
      .eq('slot', getActiveSaveSlot())
      .single());
  } catch { return; }
  if (error || !data) return;

  const cloudTs = new Date(data.saved_at).getTime();
  const localTs = state._savedAt || 0;
  if (cloudTs > localTs) {
    const fmt = new Date(cloudTs).toLocaleString('fr-FR');
    showConfirm(
      `Une sauvegarde cloud plus récente existe (${fmt}).<br>Charger la sauvegarde cloud ? <span style="color:var(--text-dim);font-size:11px">(La save locale sera remplacée)</span>`,
      () => {
        setState(migrate(data.state));
        saveState();
        renderAll();
        notify('Sauvegarde cloud chargée !', 'success');
      },
      null,
      { confirmLabel: 'Charger', cancelLabel: 'Ignorer' }
    );
  }
}

async function supaForceCloudLoad() {
  if (!_supabase || !supaSession) return;
  let data, error;
  try {
    ({ data, error } = await _supabase
      .from('player_saves')
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
    const { error } = await _supabase.from('save_snapshots').insert({
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
        .from('save_snapshots')
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
        .from('save_snapshots')
        .select('id, saved_at')
        .eq('user_id', supaSession.user.id)
        .eq('slot', getActiveSaveSlot())
        .order('saved_at', { ascending: false });

      if (rows && rows.length > MAX_SNAPSHOTS) {
        const toDelete = rows.slice(MAX_SNAPSHOTS).map(r => r.id);
        await _supabase.from('save_snapshots').delete().in('id', toDelete);
        _snapshotCount = MAX_SNAPSHOTS;
      }
    }
  } catch { /* silencieux */ }
}

async function supaFetchSnapshots() {
  if (!_supabase || !supaSession) return [];
  const { data, error } = await _supabase
    .from('save_snapshots')
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
    .from('save_snapshots')
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
    },
    null,
    { confirmLabel: 'Restaurer', cancelLabel: 'Annuler', danger: true }
  );
}

async function supaUpdateLeaderboard() {
  if (!_supabase || !supaSession) return;
  await _supabase.from('players').upsert({
    user_id:            supaSession.user.id,
    gang_name:          state.gang.name        || 'Team ???',
    boss_name:          state.gang.bossName    || 'Boss',
    reputation:         state.gang.reputation  || 0,
    total_caught:       state.stats?.totalCaught  || 0,
    total_sold:         state.stats?.totalSold    || 0,
    shiny_count:        state.stats?.shinyCaught  || 0,
    shiny_species_count: getShinySpeciesCount(),
    dex_kanto_count:    getDexKantoCaught(),
    dex_national_count: getDexNationalCaught(),
    agents_count:       (state.agents || []).length,
    agents_elite_count: state.stats?.agentsEliteCount || 0,
    updated_at:         new Date().toISOString(),
  });
}

// ── Anonymous leaderboard push (works with or without auth) ──────
// Uses a local token as primary key; links user_id when authenticated.
// SQL schema for the 'leaderboard' table (run once in Supabase SQL editor):
//
//   CREATE TABLE leaderboard (
//     token                TEXT PRIMARY KEY,
//     user_id              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
//     gang_name            TEXT,
//     boss_name            TEXT,
//     boss_sprite          TEXT,
//     reputation           BIGINT  DEFAULT 0,
//     total_caught         INT     DEFAULT 0,
//     shiny_count          INT     DEFAULT 0,
//     shiny_species_count  INT     DEFAULT 0,
//     dex_kanto_count      INT     DEFAULT 0,
//     dex_national_count   INT     DEFAULT 0,
//     agents_count         INT     DEFAULT 0,
//     is_anonymous         BOOLEAN DEFAULT TRUE,
//     updated_at           TIMESTAMPTZ DEFAULT NOW()
//   );
//   ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "lb_read"   ON leaderboard FOR SELECT USING (true);
//   CREATE POLICY "lb_insert" ON leaderboard FOR INSERT WITH CHECK (true);
//   CREATE POLICY "lb_update" ON leaderboard FOR UPDATE USING (true) WITH CHECK (true);
async function supaUpdateLeaderboardAnon() {
  if (!_supabase) return;
  const now = Date.now();
  if (now - _lbLastPushAt < LB_PUSH_THROTTLE_MS) return;

  // Dirty check — skip if key stats haven't changed since last push
  const fp = `${state.gang.reputation}|${state.stats?.totalCaught}|${state.stats?.shinyCaught}|${state.gang.name}`;
  if (fp === _lbLastFingerprint) return;
  _lbLastFingerprint = fp;
  _lbLastPushAt = now;

  try {
    await _supabase.from('leaderboard').upsert({
      token:               getLeaderboardToken(),
      user_id:             supaSession?.user?.id ?? null,
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
      is_anonymous:        !supaSession,
      updated_at:          new Date().toISOString(),
    }, { onConflict: 'token' });
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
let _lbSortBy   = 'reputation';  // sort column key
let _lbPeriod   = 'alltime';    // 'alltime' | 'weekly' | 'daily'

// ── Leaderboard Tab ─────────────────────────────────────────────────
async function renderLeaderboardTab() {
  const tab = document.getElementById('tabLeaderboard');
  if (!tab) return;

  if (!supaConfigured()) {
    tab.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-dim);font-family:var(--font-pixel);font-size:10px">
      \u{1F3C6} CLASSEMENT<br><br><span style="font-size:9px;font-family:inherit">Supabase non configuré — le classement n'est pas disponible en mode hors-ligne.</span>
    </div>`;
    return;
  }

  const SORTS = [
    { key: 'reputation',          label: '⭐ Réputation'   },
    { key: 'dex_kanto_count',     label: '\u{1F4D6} Dex Kanto'   },
    { key: 'dex_national_count',  label: '\u{1F4D7} Dex National' },
    { key: 'shiny_species_count', label: '✨ Chromas'       },
    { key: 'total_caught',        label: '\u{1F3AF} Capturés'    },
    { key: 'total_sold',          label: '\u{1F4B0} Ventes'      },
    { key: 'total_money_earned',  label: '\u{1F4B5} Gains total'  },
  ];

  const PERIODS = [
    { key: 'alltime', label: 'All time' },
    { key: 'weekly',  label: 'Cette semaine' },
    { key: 'daily',   label: "Aujourd'hui" },
  ];

  const btnStyle = (active) =>
    `font-family:var(--font-pixel);font-size:7px;padding:4px 9px;border-radius:var(--radius-sm);cursor:pointer;` +
    `background:${active ? 'var(--red)' : 'var(--bg)'};` +
    `border:1px solid ${active ? 'var(--red)' : 'var(--border)'};` +
    `color:${active ? '#fff' : 'var(--text-dim)'}`;

  tab.innerHTML = `
    <div style="padding:16px;max-width:820px">
      <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold);margin-bottom:12px">\u{1F3C6} CLASSEMENT MONDIAL</div>

      <!-- Période -->
      <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;align-items:center">
        <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">PÉRIODE :</span>
        ${PERIODS.map(p => `<button class="lb-period-btn" data-period="${p.key}" style="${btnStyle(_lbPeriod === p.key)}">${p.label}</button>`).join('')}
        <button id="btnLbRefresh" style="${btnStyle(false)};margin-left:auto">⟳</button>
      </div>

      <!-- Catégorie -->
      <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
        <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">CATÉGORIE :</span>
        ${SORTS.map(s => `<button class="lb-sort-btn" data-sort="${s.key}" style="${btnStyle(_lbSortBy === s.key)}">${s.label}</button>`).join('')}
      </div>

      <!-- Ma position -->
      <div id="lbMyEntry" style="margin-bottom:10px;padding:10px 12px;background:rgba(255,204,90,.07);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);font-size:9px;color:var(--text-dim)">
        Chargement de votre position…
      </div>

      <!-- Tableau -->
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

  const SORT_COLS = {
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
    dex_kanto_count:     '\u{1F4D6} Kanto',
    dex_national_count:  '\u{1F4D7} National',
    shiny_species_count: '✨ Chroma',
    total_caught:        '\u{1F3AF} Cap.',
    total_sold:          '\u{1F4B0} Ventes',
    total_money_earned:  '\u{1F4B5} Gains',
  };

  const col = SORT_COLS[_lbSortBy] || 'reputation';

  // Period filter via updated_at
  const PERIOD_MS = { daily: 86400_000, weekly: 604800_000 };
  const cutoff = PERIOD_MS[_lbPeriod]
    ? new Date(Date.now() - PERIOD_MS[_lbPeriod]).toISOString()
    : null;

  let query = _supabase
    .from('leaderboard')
    .select('token, user_id, gang_name, boss_name, boss_sprite, reputation, total_caught, shiny_count, shiny_species_count, dex_kanto_count, dex_national_count, total_sold, total_money_earned, agents_count, is_anonymous, updated_at')
    .order(col, { ascending: false })
    .limit(50);

  if (cutoff) query = query.gte('updated_at', cutoff);

  const { data: rows, error } = await query;

  // Own entry (always alltime for "my rank" banner)
  const { data: myRow } = await _supabase
    .from('leaderboard')
    .select('gang_name, reputation, total_caught, shiny_species_count, dex_kanto_count, dex_national_count, total_sold, total_money_earned, updated_at')
    .eq('token', getLeaderboardToken())
    .maybeSingle();

  // Own rank in current period+sort
  let myRank = '—';
  if (myRow) {
    let rankQ = _supabase.from('leaderboard').select('token', { count: 'exact', head: true }).gt(col, myRow[col] || 0);
    if (cutoff) rankQ = rankQ.gte('updated_at', cutoff);
    const { count } = await rankQ;
    if (count !== null) myRank = `#${count + 1}`;
  }

  // My entry banner
  const myEntryEl = document.getElementById('lbMyEntry');
  if (myEntryEl) {
    if (myRow) {
      const updAgo = myRow.updated_at ? _lbAgo(new Date(myRow.updated_at)) : '?';
      myEntryEl.innerHTML = `
        <span style="color:var(--gold);font-family:var(--font-pixel);font-size:9px">${myRow.gang_name}</span>
        <span style="margin-left:12px">Rang <b style="color:var(--gold)">${myRank}</b></span>
        <span style="margin-left:12px;color:var(--text-dim)">⭐ ${(myRow.reputation||0).toLocaleString('fr-FR')}</span>
        <span style="margin-left:12px;color:var(--text-dim)">✨ ${myRow.shiny_species_count||0}</span>
        <span style="margin-left:12px;color:var(--text-dim)">\u{1F4D6} ${myRow.dex_kanto_count||0}/151</span>
        <span style="margin-left:auto;font-size:8px;opacity:.6">mis à jour ${updAgo}</span>`;
      myEntryEl.style.cssText += ';display:flex;align-items:center;gap:0';
    } else {
      myEntryEl.textContent = "Votre entrée n'est pas encore dans le classement.";
    }
  }

  const tableEl = document.getElementById('lbTable');
  if (!tableEl) return;

  if (error || !rows?.length) {
    const periodLabel = { alltime: 'all time', weekly: 'cette semaine', daily: "aujourd'hui" }[_lbPeriod] || '';
    tableEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-dim);font-size:10px">Aucune entrée ${periodLabel} — sois le premier !</div>`;
    return;
  }

  const MEDALS = ['\u{1F947}','\u{1F948}','\u{1F949}'];
  const sortLabel = SORT_LABELS[_lbSortBy] || '⭐ Rép.';

  tableEl.innerHTML = `
    <div style="display:grid;grid-template-columns:36px 1fr auto;border-bottom:1px solid var(--border);padding:6px 10px;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">
      <span>#</span><span>Gang</span><span style="text-align:right">${sortLabel}   ✨   \u{1F4D6}</span>
    </div>
    ${rows.map((p, i) => {
      const isMe  = p.token === getLeaderboardToken();
      const medal = MEDALS[i] || `<span style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim)">${i+1}</span>`;
      const nameTag = p.is_anonymous
        ? `<span style="font-size:8px;color:var(--text-dim)">Joueur anonyme <span style="opacity:.5">#${p.token.slice(-5)}</span></span>`
        : `<span style="font-size:9px">${p.gang_name}</span>`;
      const sprite = p.boss_sprite
        ? `<img src="https://play.pokemonshowdown.com/sprites/gen5/${p.boss_sprite}.png" style="width:32px;height:32px;image-rendering:pixelated" onerror="this.style.display='none'">`
        : `<div style="width:32px;height:32px;background:var(--bg);border-radius:4px"></div>`;
      const val = p[col] ?? 0;
      const valStr = typeof val === 'number' ? val.toLocaleString('fr-FR') : val;
      const ago = p.updated_at ? _lbAgo(new Date(p.updated_at)) : '';
      return `<div style="display:grid;grid-template-columns:36px auto 1fr auto;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--border);background:${isMe ? 'rgba(255,204,90,.07)' : ''};border-left:3px solid ${isMe ? 'var(--gold)' : 'transparent'}">
        <span style="text-align:center;font-size:14px">${medal}</span>
        ${sprite}
        <div style="min-width:0">
          ${isMe ? `<div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">${p.gang_name} <span style="font-size:7px;opacity:.7">◄ toi</span></div>` : nameTag}
          <div style="font-size:8px;color:var(--text-dim);margin-top:1px">${p.boss_name || ''}${ago ? ` · ${ago}` : ''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">${valStr}</div>
          <div style="font-size:8px;color:var(--text-dim);margin-top:2px">✨ ${p.shiny_species_count||0}   \u{1F4D6} ${p.dex_kanto_count||0}/151</div>
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
    return;
  }

  if (!supaSession) {
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
            <div style="font-family:var(--font-pixel);font-size:11px;margin-bottom:6px">${state.gang.name}</div>
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
            <div style="font-size:9px;color:var(--text)">${s.gang_name}</div>
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
}

// ════════════════════════════════════════════════════════════════

export {
  configureCloudAccount, initSupabase, supaConfigured, supaCloudSave, supaWriteSnapshot,
  supaUpdateLeaderboard, supaUpdateLeaderboardAnon, renderLeaderboardTab, renderCompteTab,
  updateSupaIndicator, updateSupaTabLabel,
};
