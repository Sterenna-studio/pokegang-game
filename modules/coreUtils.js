// ============================================================
// modules/coreUtils.js — Core utilities (ES module)
// Extracted from app.js §3 — zero behaviour change.
// ============================================================
//
// Live state accessor: always points to the current `state` object even after
// app.js reassigns it (e.g. on import/reset). Modules that mutate state should
// continue to do so via globalThis.state so all consumers see the change.
const _g = () => globalThis;
const _state     = () => _g().state;
const _speciesBy = () => _g().SPECIES_BY_EN;
const _getSprite = () => _g().getPokemonSprite;

// ════════════════════════════════════════════════════════════════
//  PURE HELPERS
// ════════════════════════════════════════════════════════════════

export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function formatIncome(n) {
  if (n >= 10000) return Math.round(n / 1000) + 'k';
  if (n >= 1000)  return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

export function formatPlaytime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
}

export function weightedPick(arr) {
  // arr: [{en, w}, ...] — returns en string
  const total = arr.reduce((s, e) => s + e.w, 0);
  let r = Math.random() * total;
  for (const e of arr) { r -= e.w; if (r <= 0) return e.en; }
  return arr[arr.length - 1].en;
}

export function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
export function uid()         { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function addLog(msg) {
  const state = _state();
  state.log.unshift({ msg, ts: Date.now() });
  if (state.log.length > 50) state.log.length = 50;
}

// ════════════════════════════════════════════════════════════════
//  SPRITE HELPERS
// ════════════════════════════════════════════════════════════════

export function sanitizeSpriteName(en) {
  // Showdown sprites use no hyphens: mr-mime → mrmime, nidoran-f → nidoranf
  return en.replace(/[^a-z0-9]/g, '');
}

// mode: 'gen1'|'gen2'|'gen3'|'gen4'|'gen5'|'ani'|'dex'|'home'
function _showdownSpriteUrl(en, mode, { shiny = false, back = false } = {}) {
  const name = sanitizeSpriteName(en);
  const sh   = shiny ? '-shiny' : '';
  const bk   = back  ? '-back'  : '';
  const ext  = mode === 'ani' ? 'gif' : 'png';
  let folder;
  switch (mode) {
    case 'gen1': folder = `gen1${sh}`;          break;
    case 'gen2': folder = `gen2${bk}${sh}`;     break;
    case 'gen3': folder = `gen3${bk}${sh}`;     break;
    case 'gen4': folder = `gen4${bk}${sh}`;     break;
    case 'ani':  folder = `ani${bk}${sh}`;      break;
    case 'dex':  folder = back ? `gen5${bk}${sh}` : `dex${sh}`;              break;
    case 'home': folder = back ? `gen5${bk}${sh}` : `home-centered${sh}`;    break;
    default:     folder = `gen5${bk}${sh}`;     break; // 'gen5' or unknown
  }
  return `https://play.pokemonshowdown.com/sprites/${folder}/${name}.${ext}`;
}

export function pokeSpriteVariant(en, variant = 'main', shiny = false) {
  const state      = _state();
  const SPECIES_BY_EN = _speciesBy();
  const getPokemonSprite = _getSprite();
  const mode = state?.settings?.spriteMode ?? 'local';
  if (mode === 'local' && variant !== 'showdown') {
    const sp = SPECIES_BY_EN?.[en];
    const dexId = sp?.dex;
    if (dexId && typeof getPokemonSprite === 'function') {
      const key = shiny && variant === 'main' ? 'shiny'
                : shiny && variant === 'back'  ? 'backShiny'
                : variant;
      const url = getPokemonSprite(dexId, key);
      if (url) return url;
    }
  }
  const sdMode = mode === 'local' ? 'gen5' : mode;
  return _showdownSpriteUrl(en, sdMode, { shiny });
}

export function pokeSprite(en, shiny = false) {
  return pokeSpriteVariant(en, 'main', shiny);
}

export function pokeSpriteBack(en, shiny = false) {
  const state      = _state();
  const SPECIES_BY_EN = _speciesBy();
  const getPokemonSprite = _getSprite();
  const mode = state?.settings?.spriteMode ?? 'local';
  if (mode === 'local') {
    const sp = SPECIES_BY_EN?.[en];
    const dexId = sp?.dex;
    if (dexId && typeof getPokemonSprite === 'function') {
      const url = getPokemonSprite(dexId, shiny ? 'backShiny' : 'back');
      if (url) return url;
    }
  }
  const sdMode = mode === 'local' ? 'gen5' : mode;
  return _showdownSpriteUrl(en, sdMode, { shiny, back: true });
}

export function pokeIcon(en) {
  return `https://play.pokemonshowdown.com/sprites/bwicons/${sanitizeSpriteName(en)}.png`;
}

// ── Egg sprites ──────────────────────────────────────────────────────────────

const _EGG_NB = 'https://www.pokepedia.fr/images/f/f5/Sprite_%C5%92uf_NB.png?20190202195308';

export const EGG_SPRITES = {
  common:    _EGG_NB,
  uncommon:  'https://www.pokepedia.fr/images/a/ab/Sprite_%C5%92uf_5_km_GO.png',
  rare:      'https://www.pokepedia.fr/images/7/70/Sprite_%C5%92uf_10_km_GO.png',
  very_rare: 'https://www.pokepedia.fr/images/a/a8/Sprite_%C5%92uf_12_km_GO.png',
  legendary: 'https://www.pokepedia.fr/images/a/a8/Sprite_%C5%92uf_12_km_GO.png',
  ready:     _EGG_NB,
  default:   _EGG_NB,
};

export function eggSprite(egg, ready = false) {
  if (ready) return EGG_SPRITES.ready;
  const rarity = egg?.rarity || 'common';
  return EGG_SPRITES[rarity] || EGG_SPRITES.default;
}

export function eggImgTag(egg, ready = false, style = '') {
  const SPECIES_BY_EN = _speciesBy();
  const fallback   = eggSprite(egg, ready);
  const bwFallback = _EGG_NB;
  const baseStyle  = `object-fit:contain;image-rendering:pixelated;${style}`;

  const isRevealed = (egg?.parentA && egg?.parentB) || (egg?.scanned && egg?.revealedSpecies);
  if (!ready && isRevealed && egg?.species_en) {
    const sp  = SPECIES_BY_EN?.[egg.species_en];
    const dex = sp?.dex;
    if (dex) {
      const pokeos = `https://s3.pokeos.com/pokeos-uploads/forgotten-dex/eggs/${dex}-animegg.png`;
      return `<img src="${pokeos}" style="${baseStyle}" onerror="if(!this._f1){this._f1=1;this.src='${fallback}'}else if(!this._f2){this._f2=1;this.src='${bwFallback}'}">`;
    }
  }
  return `<img src="${fallback}" style="${baseStyle}" onerror="if(!this._f1){this._f1=1;this.src='${bwFallback}'}">`;
}

// ── Trainer sprites ──────────────────────────────────────────────────────────

export const SPRITE_FIX = {
  agatha:          'agatha-gen1',
  lorelei:         'lorelei-gen1',
  phoebe:          'phoebe-gen3',
  drake:           'drake-gen3',
  channeler:       'channeler-gen1',
  cueball:         'cueball-gen1',
  rocker:          'rocker-gen1',
  tamer:           'tamer-gen1',
  cooltrainer:     'acetrainer',
  cooltrainerf:    'acetrainerf',
  rocketexecutive: 'rocketexecutive-gen2',
  pokemonrangerf:  'pokemonrangerf-gen3',
  policeman:       'policeman-gen8',
};

const CUSTOM_TRAINER_SPRITES = {
  giovanni: 'https://www.pokepedia.fr/images/archive/7/73/20230124191924%21Sprite_Giovanni_RB.png',
};

// Flat index built after trainer-sprites-grouped.json loads (_buildTrainerIndex)
export const _trainerJsonIndex = {};

export function _buildTrainerIndex(data) {
  if (!data?.trainers) return;
  const base   = 'https://play.pokemonshowdown.com/sprites/trainers/';
  const groups = data.trainers;
  for (const [groupName, groupData] of Object.entries(groups)) {
    if (groupName === 'factions') {
      for (const [, arr] of Object.entries(groupData)) {
        if (Array.isArray(arr)) arr.forEach(rel => {
          const slug = rel.replace(/\.png$/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
          _trainerJsonIndex[slug] = base + rel;
        });
      }
    } else if (typeof groupData === 'object' && !Array.isArray(groupData)) {
      for (const [key, rel] of Object.entries(groupData)) {
        const slug    = rel.replace(/\.png$/, '').toLowerCase();
        const keyNorm = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
        _trainerJsonIndex[slug]    = base + rel;
        _trainerJsonIndex[keyNorm] = base + rel;
      }
    }
  }
}

export function trainerSprite(name) {
  if (CUSTOM_TRAINER_SPRITES[name]) return CUSTOM_TRAINER_SPRITES[name];
  const norm = (name || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (_trainerJsonIndex[norm]) return _trainerJsonIndex[norm];
  const fixed = SPRITE_FIX[name] || name;
  return `https://play.pokemonshowdown.com/sprites/trainers/${fixed}.png`;
}

// SVG placeholder fallbacks (inline data URIs — no network dependency)
export const FALLBACK_TRAINER_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%231a1a1a'/%3E%3Ccircle cx='32' cy='20' r='10' fill='%23444'/%3E%3Cellipse cx='32' cy='50' rx='16' ry='14' fill='%23444'/%3E%3Ctext x='32' y='62' text-anchor='middle' font-size='8' fill='%23666'%3E%3F%3F%3C%2Ftext%3E%3C%2Fsvg%3E`;
export const FALLBACK_POKEMON_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%231a1a1a'/%3E%3Cellipse cx='32' cy='36' rx='20' ry='18' fill='%23333'/%3E%3Ccircle cx='32' cy='18' r='10' fill='%23333'/%3E%3Ctext x='32' y='62' text-anchor='middle' font-size='8' fill='%23555'%3E%3F%3C%2Ftext%3E%3C%2Fsvg%3E`;

export function safeTrainerImg(name, { style = '', cls = '' } = {}) {
  const src = trainerSprite(name);
  return `<img src="${src}" ${cls ? `class="${cls}"` : ''} style="${style}" alt="${name}" onerror="this.src='${FALLBACK_TRAINER_SVG}';this.onerror=null">`;
}

export function safePokeImg(species_en, { shiny = false, back = false, variant = 'main', style = '', cls = '' } = {}) {
  const src = back ? pokeSpriteBack(species_en, shiny) : pokeSpriteVariant(species_en, variant, shiny);
  return `<img src="${src}" ${cls ? `class="${cls}"` : ''} style="${style}" alt="${species_en}" onerror="this.src='${FALLBACK_POKEMON_SVG}';this.onerror=null">`;
}

// ── Species name helpers ─────────────────────────────────────────────────────

export function speciesName(en) {
  const SPECIES_BY_EN = _speciesBy();
  const state         = _state();
  if (!SPECIES_BY_EN?.[en]) return en;
  return state?.lang === 'fr'
    ? SPECIES_BY_EN[en].fr
    : en.charAt(0).toUpperCase() + en.slice(1);
}

export function pokemonDisplayName(p) {
  return p.nick || speciesName(p.species_en);
}

// ════════════════════════════════════════════════════════════════
//  SESSION TRACKING  (30-min idle = nouvelle session)
// ════════════════════════════════════════════════════════════════

const SESSION_KEY     = 'pg_session_baseline';
const SESSION_IDLE_MS = 30 * 60 * 1000;
let _sessionBaseline  = null;

export function initSession() {
  const state = _state();
  const now   = Date.now();
  const raw   = localStorage.getItem(SESSION_KEY);
  if (raw) {
    try {
      const saved = JSON.parse(raw);
      if (now - saved.ts < SESSION_IDLE_MS) {
        _sessionBaseline = saved;
        if (_sessionBaseline.caughtAtStart === undefined) _sessionBaseline.caughtAtStart = state.stats.totalCaught || 0;
        if (_sessionBaseline.soldAtStart   === undefined) _sessionBaseline.soldAtStart   = state.stats.totalSold   || 0;
        return;
      }
    } catch {}
  }
  _sessionBaseline = {
    ts:            now,
    money:         state.gang.money,
    rep:           state.gang.reputation,
    pokemon:       state.pokemons.length,
    shinies:       state.stats.shinyCaught    || 0,
    fights:        state.stats.totalFightsWon || 0,
    caughtAtStart: state.stats.totalCaught    || 0,
    soldAtStart:   state.stats.totalSold      || 0,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(_sessionBaseline));
}

export function _saveSessionActivity() {
  if (_sessionBaseline) {
    _sessionBaseline.ts = Date.now();
    localStorage.setItem(SESSION_KEY, JSON.stringify(_sessionBaseline));
  }
}

export function getSessionDelta() {
  const state = _state();
  if (!_sessionBaseline) return null;
  const dMoney  = state.gang.money              - _sessionBaseline.money;
  const dRep    = state.gang.reputation         - _sessionBaseline.rep;
  const dCaught = (state.stats.totalCaught    || 0) - (_sessionBaseline.caughtAtStart || 0);
  const dSold   = (state.stats.totalSold      || 0) - (_sessionBaseline.soldAtStart   || 0);
  const dShiny  = (state.stats.shinyCaught    || 0) - (_sessionBaseline.shinies       || 0);
  const dFights = (state.stats.totalFightsWon || 0) - (_sessionBaseline.fights        || 0);

  const fmtPos = (v, icon) => {
    if (v <= 0) return null;
    return `<span style="color:var(--green-dim,#4a8)">+${Math.abs(v) >= 1000 ? v.toLocaleString() : v} ${icon}</span>`;
  };
  const fmtAny = (v, icon) => {
    if (v === 0) return null;
    const sign  = v > 0 ? '+' : '';
    const color = v > 0 ? 'var(--green-dim,#4a8)' : 'var(--red)';
    return `<span style="color:${color}">${sign}${Math.abs(v) >= 1000 ? v.toLocaleString() : v} ${icon}</span>`;
  };

  return [
    dMoney  !== 0 ? fmtAny(dMoney,  '₽')  : null,
    dCaught  > 0  ? fmtPos(dCaught, '🎯') : null,
    dSold    > 0  ? `<span style="color:var(--text-dim)">-${dSold} 💱</span>` : null,
    dRep    !== 0 ? fmtAny(dRep,    '⭐') : null,
    dShiny   > 0  ? fmtPos(dShiny,  '✨') : null,
    dFights  > 0  ? fmtPos(dFights, '⚔')  : null,
  ].filter(Boolean).join(' · ');
}

// ════════════════════════════════════════════════════════════════
//  NEXT OBJECTIVE
// ════════════════════════════════════════════════════════════════

export function getNextObjective() {
  const state = _state();
  const openZones         = _g().openZones;
  const ZONES             = _g().ZONES;
  const isZoneUnlocked    = _g().isZoneUnlocked;
  const getAgentRecruitCost = _g().getAgentRecruitCost;

  const pc     = state.pokemons.length;
  const team   = state.gang.bossTeam.length;
  const agents = state.agents.length;
  const money  = state.gang.money;
  const rep    = state.gang.reputation;
  const zones  = openZones ? openZones.size : 0;
  const dex    = Object.values(state.pokedex).filter(e => e.caught).length;

  if (!state.gang.initialized)
    return { text: '👋 Crée ton Gang pour commencer', tab: null };
  if (pc === 0)
    return { text: '⚡ Capture ton premier Pokémon', detail: '→ Zones', tab: 'tabZones' };
  if (team === 0)
    return { text: '⚔ Place un Pokémon dans ton équipe Boss', detail: '→ PC', tab: 'tabPC' };
  if (team < 3)
    return { text: `⚔ Complète ton équipe Boss`, detail: `${team}/3`, tab: 'tabPC' };
  if (agents === 0) {
    const cost     = typeof getAgentRecruitCost === 'function' ? getAgentRecruitCost() : 10000;
    const progress = money >= cost ? 'Prêt !' : `₽${money.toLocaleString()}/${cost.toLocaleString()}`;
    return { text: '👤 Recrute ton premier agent', detail: progress, tab: 'tabPC' };
  }
  const nextLocked = ZONES ? ZONES.find(z => !isZoneUnlocked(z.id)) : null;
  if (nextLocked) {
    const req = nextLocked.repRequired || 0;
    if (req > 0)
      return { text: `🗺 Débloquer ${nextLocked.fr}`, detail: `Rép. ${rep}/${req}`, tab: 'tabZones' };
  }
  if (agents < 3)
    return { text: `👥 Avoir ${agents + 1} agents`, detail: `${agents}/3`, tab: 'tabAgents' };
  if (dex < 151)
    return { text: `📖 Pokédex ${dex}/151`, detail: `${151 - dex} espèces manquantes`, tab: 'tabPokedex' };
  return { text: '🏆 Pokédex complet — Tu domines Kanto !', detail: null, tab: null };
}

// ════════════════════════════════════════════════════════════════
//  BOOST HELPERS
// ════════════════════════════════════════════════════════════════

export function isBoostActive(boostId) {
  return (_state().activeBoosts[boostId] || 0) > Date.now();
}

export function boostRemaining(boostId) {
  const exp = _state().activeBoosts[boostId] || 0;
  return Math.max(0, Math.ceil((exp - Date.now()) / 1000));
}

export function activateBoost(boostId) {
  const state    = _state();
  const saveState = _g().saveState;
  if ((state.inventory[boostId] || 0) <= 0) return false;
  state.inventory[boostId]--;
  const duration = _g().BOOST_DURATIONS?.[boostId] || 90000;
  const base     = Math.max(Date.now(), state.activeBoosts[boostId] || 0);
  state.activeBoosts[boostId] = base + duration;
  saveState?.();
  return true;
}

// ════════════════════════════════════════════════════════════════
//  ASSET CONSTANTS
// ════════════════════════════════════════════════════════════════

export const BALL_SPRITES = {
  pokeball:  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png',
  greatball: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/great-ball.png',
  ultraball: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png',
  duskball:  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dusk-ball.png',
};

export const ITEM_SPRITE_URLS = {
  pokeball:      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png',
  greatball:     'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/great-ball.png',
  ultraball:     'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png',
  duskball:      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dusk-ball.png',
  masterball:    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png',
  lure:          'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/honey.png',
  superlure:     'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lure-ball.png',
  potion:        'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/potion.png',
  incense:       'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/luck-incense.png',
  rarescope:     'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/scope-lens.png',
  aura:          'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/shiny-stone.png',
  evostone:      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/fire-stone.png',
  rarecandy:     'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png',
  chestBoost:    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/big-nugget.png',
  translator:    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-flute.png',
  mysteryegg:    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/oval-stone.png',
  incubator:     'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/oval-stone.png',
  map_pallet:    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/town-map.png',
  casino_ticket: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/coin-case.png',
  silph_keycard: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/silph-scope.png',
  boat_ticket:   'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ss-ticket.png',
  pokecoin:      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/amulet-coin.png',
  silver_wing:   'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/silver-wing.png',
  rainbow_wing:  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rainbow-wing.png',
};

export function itemSprite(id) {
  const url = ITEM_SPRITE_URLS[id];
  return url
    ? `<img src="${url}" style="width:28px;height:28px;image-rendering:pixelated" onerror="this.style.display='none'">`
    : `<span style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim)">${id.toUpperCase().slice(0, 3)}</span>`;
}

export const CHEST_SPRITE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png';

// ════════════════════════════════════════════════════════════════
//  SFX ENGINE (Web Audio API)
// ════════════════════════════════════════════════════════════════

export const SFX = (() => {
  let ctx;
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }
  function playTone(freq, duration, type = 'square', volume = 0.15) {
    const c = getCtx();
    if (c.state === 'suspended') { c.resume().catch(() => {}); return; }
    const osc    = c.createOscillator();
    const gain   = c.createGain();
    const sfxMult = (_state()?.settings?.sfxVol ?? 80) / 100;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    gain.gain.setValueAtTime(volume * sfxMult, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration + 0.05);
  }
  return {
    ballThrow() {
      playTone(800, 0.15, 'sawtooth', 0.08);
      setTimeout(() => playTone(400, 0.1, 'sawtooth', 0.06), 80);
    },
    capture(potential, shiny) {
      const base = 520;
      playTone(base, 0.12, 'square', 0.12);
      setTimeout(() => playTone(base * 1.25, 0.12, 'square', 0.12), 100);
      setTimeout(() => playTone(base * 1.5,  0.15, 'square', 0.12), 200);
      if (potential >= 4) setTimeout(() => playTone(base * 2,   0.2,  'square', 0.15), 320);
      if (potential >= 5 || shiny) {
        setTimeout(() => playTone(base * 2.5, 0.25, 'sine',   0.18), 440);
        setTimeout(() => playTone(base * 3,   0.3,  'sine',   0.15), 580);
      }
      if (shiny) {
        setTimeout(() => {
          for (let i = 0; i < 5; i++) setTimeout(() => playTone(1200 + i * 200, 0.08, 'sine', 0.1), i * 60);
        }, 700);
      }
    },
    error()   { playTone(200, 0.2, 'sawtooth', 0.1); },
    levelUp() {
      playTone(523,  0.1,  'square', 0.1);
      setTimeout(() => playTone(659,  0.1,  'square', 0.1),  110);
      setTimeout(() => playTone(784,  0.15, 'square', 0.1),  220);
      setTimeout(() => playTone(1047, 0.2,  'sine',   0.12), 360);
    },
    coin() {
      playTone(988,  0.06, 'sine', 0.1);
      setTimeout(() => playTone(1318, 0.1, 'sine', 0.1), 80);
    },
    click()     { playTone(1200, 0.04, 'square', 0.05); },
    tabSwitch() {
      playTone(660, 0.06, 'sine', 0.07);
      setTimeout(() => playTone(880, 0.05, 'sine', 0.05), 50);
    },
    buy() {
      playTone(659, 0.08, 'sine', 0.1);
      setTimeout(() => playTone(880, 0.12, 'sine', 0.12), 80);
    },
    unlock() {
      playTone(440,  0.08, 'square', 0.1);
      setTimeout(() => playTone(554,  0.08, 'square', 0.1),  100);
      setTimeout(() => playTone(659,  0.08, 'square', 0.1),  200);
      setTimeout(() => playTone(880,  0.16, 'sine',   0.12), 310);
      setTimeout(() => playTone(1108, 0.2,  'sine',   0.1),  450);
    },
    menuOpen() {
      playTone(880,  0.08, 'sine', 0.07);
      setTimeout(() => playTone(1100, 0.1, 'sine', 0.06), 80);
    },
    menuClose() {
      playTone(660, 0.07, 'sine', 0.06);
      setTimeout(() => playTone(440, 0.09, 'sine', 0.05), 70);
    },
    chest() {
      playTone(660,  0.08, 'square', 0.08);
      setTimeout(() => playTone(880,  0.08, 'square', 0.09), 80);
      setTimeout(() => playTone(1100, 0.08, 'square', 0.1),  160);
      setTimeout(() => {
        for (let i = 0; i < 4; i++) setTimeout(() => playTone(1200 + i * 180, 0.07, 'sine', 0.07), i * 55);
      }, 260);
    },
    notify() {
      playTone(880,  0.07, 'sine', 0.08);
      setTimeout(() => playTone(1108, 0.1, 'sine', 0.07), 90);
    },
    sell() {
      playTone(660, 0.05, 'sine', 0.08);
      setTimeout(() => playTone(440, 0.08, 'sawtooth', 0.06), 70);
    },
    evolve() {
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((f, i) => setTimeout(() => playTone(f, 0.15, 'square', 0.12), i * 120));
      setTimeout(() => {
        for (let i = 0; i < 6; i++) setTimeout(() => playTone(1200 + i * 150, 0.1, 'sine', 0.1), i * 60);
      }, notes.length * 120 + 100);
    },
    _enabled() { return _state()?.settings?.sfxEnabled !== false; },
    play(name, ...args) {
      if (!this._enabled()) return;
      if (_state()?.settings?.sfxIndividual?.[name] === false) return;
      try { this[name]?.(...args); } catch {}
    },
  };
})();
