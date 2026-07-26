'use strict';

// ════════════════════════════════════════════════════════════════
//  environment.js — zone d'environnement animée ("vivarium") où se
//  baladent les Pokémon de la vitrine, l'équipe active du boss, et
//  occasionnellement un agent ou un Pokémon favori du Pokédex.
//
//  v1 volontairement simple (explicitement "test") : pas de canvas,
//  pas de pathfinding — juste des sprites positionnés en absolu dont
//  la position cible change périodiquement via une transition CSS.
//  Les résidents (vitrine + équipe boss) évitent de se superposer et
//  peuvent occasionnellement se rencontrer (mini-interaction ami/
//  ennemi) quand ils passent près l'un de l'autre.
//
//  La construction des données affichées (résidents résolus, pool de
//  cameos éligibles, fond de zone) vit dans modules/systems/
//  vivariumSnapshot.js, partagé avec le snapshot poussé vers Supabase
//  pour l'affichage distant (OBS) — ce fichier ne fait plus que du
//  rendu DOM/animation, local (state live) ou distant (blob figé) :
//  renderEnvironmentZone() lit `globalThis.state`, tandis que
//  renderEnvironmentZoneFromSnapshot()/updateEnvironmentSnapshot()
//  consomment un blob déjà résolu (gang/live-app.js).
//
//  Dépendances globalThis : state, saveState, notify, COSMETIC_BGS (ce
//    dernier uniquement pour le picker de fond _openZoneBgPicker — la
//    résolution du fond actif passe par vivariumSnapshot.js)
// ════════════════════════════════════════════════════════════════

import {
  VIVARIUM_SOURCES,
  buildVivariumResidents,
  buildVivariumCameoPool,
  buildVivariumBackgroundData,
} from '../modules/systems/vivariumSnapshot.js';

const CAMEO_MIN_DELAY_MS   = 45_000;
const CAMEO_MAX_DELAY_MS   = 90_000;
const CAMEO_SPAWN_CHANCE   = 0.5;
const CAMEO_SPEED_PX_PER_S = 45;

// Traversée en plusieurs étapes plutôt qu'une seule ligne droite (cf.
// _spawnCameo) — wobble vertical entre étapes + vitesse variable par étape,
// avec une pause possible (dont une garantie sur l'étape où le dialogue
// apparaît, pour laisser le temps de le lire).
const CAMEO_LEGS_MIN     = 2;
const CAMEO_LEGS_MAX     = 4;
const CAMEO_PAUSE_CHANCE = 0.65;
const CAMEO_PAUSE_MIN_MS = 1000;
const CAMEO_PAUSE_MAX_MS = 2600;
const CAMEO_Y_WOBBLE_PX  = 26;

// Ambiance jour/nuit — teinte de l'overlay recalculée périodiquement à
// partir de l'heure locale réelle (pas de cycle accéléré, v1 simple).
const AMBIANCE_REFRESH_MS = 5 * 60_000;

// Météo — reroll périodique parmi un petit set, particules CSS pures
// (mêmes conventions que le reste du fichier : pas de canvas).
const WEATHER_TYPES         = ['clear', 'clear', 'rain', 'snow']; // 'clear' pondéré x2 : le beau temps doit rester la norme
const WEATHER_REROLL_MIN_MS = 5 * 60_000;
const WEATHER_REROLL_MAX_MS = 10 * 60_000;
const RAIN_DROP_COUNT   = 26;
const SNOW_FLAKE_COUNT  = 18;

// Déplacement des résidents — plage large de vitesse/pause pour que ça ne
// soit pas un métronome (certains hops sont des petits dashes rapides,
// d'autres des ambles lentes avec une longue pause).
const WANDER_MIN_PAUSE_MS = 600;
const WANDER_MAX_PAUSE_MS = 5500;
const WANDER_SPEED_MIN    = 26; // px/s
const WANDER_SPEED_MAX    = 70; // px/s

// Anti-superposition + rencontres
const MIN_SPRITE_DIST      = 46; // px — distance mini visée entre deux résidents
const TARGET_RETRY_COUNT   = 5;
const SEEK_OTHER_CHANCE    = 0.35; // chance de viser près d'un autre résident plutôt qu'une case libre — accélère les rencontres
const INTERACTION_DIST_PX  = 44;
const INTERACTION_COOLDOWN_MS = 20_000; // avant de pouvoir réinteragir avec le même partenaire
const PROXIMITY_SCAN_MS    = 1200;
const INTERACTION_BADGE_MS = 2300;

// Variété de mini-interactions entre deux résidents qui se croisent — un tirage
// pondéré plutôt qu'un simple binaire ami/ennemi. `pauseMs` est la durée pendant
// laquelle les deux résidents restent face à face avant de reprendre leur route
// (cf. _endInteraction) ; `bounce` réutilise l'anim de rebond du clic pour un
// rendu plus vivant que le simple badge flottant.
const INTERACTION_KINDS = [
  { key: 'friend',  icon: '💕', weight: 35, pauseMs: 2000 },
  { key: 'playful', icon: '🎾', weight: 25, pauseMs: 2000, bounce: true },
  { key: 'curious', icon: '👀', weight: 15, pauseMs: 1300 },
  { key: 'sleepy',  icon: '😴', weight: 10, pauseMs: 3400 },
  { key: 'enemy',   icon: '💢', weight: 15, pauseMs: 2000, hostile: true },
];

// Interaction au clic — "câliner" un résident : pause brève du wander, petit
// rebond, et une bulle avec une réaction + les infos du Pokémon.
const CLICK_REACTION_ICONS    = ['💫', '✨', '⭐', '❤️', '😊', '🎵'];
const CLICK_REACTION_COOLDOWN_MS = 700; // anti-spam-clic
const CLICK_PAUSE_MS          = 900;    // durée de la pause + du rebond

let _timers    = [];   // tous les setTimeout actifs — nettoyés par stopEnvironmentZone()
let _residents = [];   // { el, x, y, w, h, interacting, lastPartner, lastInteractionAt, timer }
let _zoneEl    = null;
let _liveCameoPool = []; // dernier pool reçu — seulement utilisé par le rendu distant (blob)

function _track(id) { _timers.push(id); return id; }

export function stopEnvironmentZone() {
  _timers.forEach(clearTimeout);
  _timers = [];
  _residents = [];
  _zoneEl = null;
  _liveCameoPool = [];
}

// Retire les résidents actuellement affichés (DOM + timers) sans toucher aux
// boucles météo/ambiance/cameo — utilisé par updateEnvironmentSnapshot() pour
// rafraîchir juste la liste de résidents sur un poll, sans réinitialiser tout
// le reste (ce qui ferait clignoter la météo ou couper un cameo en vol).
function _clearResidents(viewportEl) {
  for (const r of _residents) {
    clearTimeout(r.timer);
    r.el.remove();
  }
  _residents = [];
  viewportEl.querySelector('.gang-env-empty-hint')?.remove();
}

// ── Fond de la zone (state.cosmetics.bossBg — réutilise le même catalogue
//    COSMETIC_BGS/unlockedBgs que le fond de page, juste un pointeur
//    d'équipement séparé) ───────────────────────────────────────────────
// Applique un descripteur de fond {type, url|value} (cf.
// vivariumSnapshot.js:buildVivariumBackgroundData) — factorisé pour être
// utilisable aussi bien avec `state` live qu'avec un blob distant figé.
function _applyBackgroundData(viewportEl, bgData) {
  if (bgData?.type === 'image' || bgData?.type === 'fabric') {
    viewportEl.style.backgroundImage = `url('${bgData.url}')`;
    if (bgData.type === 'fabric') {
      viewportEl.style.backgroundSize = '160px';
      viewportEl.style.backgroundRepeat = 'repeat';
    } else {
      viewportEl.style.backgroundSize = 'cover';
      viewportEl.style.backgroundPosition = 'center';
    }
  } else if (bgData?.type === 'gradient') {
    viewportEl.style.backgroundImage = bgData.value;
    viewportEl.style.backgroundSize = 'cover';
  } else {
    viewportEl.style.backgroundImage = 'linear-gradient(180deg,#0a1a12,#0d2418)';
    viewportEl.style.backgroundSize = 'cover';
  }
}

function _applyZoneBackground(viewportEl) {
  _applyBackgroundData(viewportEl, buildVivariumBackgroundData(globalThis.state));
}

// ── Ambiance jour/nuit — teinte calquée sur l'heure locale réelle (v1
//    simple, pas de cycle accéléré) ─────────────────────────────────────
function _timeOfDayTint() {
  const h = new Date().getHours();
  if (h >= 22 || h < 5)  return 'rgba(8,12,36,.5)';     // nuit
  if (h >= 5  && h < 8)  return 'rgba(255,175,120,.16)'; // aube
  if (h >= 18 && h < 22) return 'rgba(255,100,60,.20)';  // crépuscule
  return 'transparent';                                  // jour
}

function _applyAmbiance(viewportEl) {
  let overlay = viewportEl.querySelector('.gang-env-ambiance');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'gang-env-ambiance';
    viewportEl.appendChild(overlay);
  }
  overlay.style.background = _timeOfDayTint();
}

function _scheduleAmbianceRefresh(viewportEl) {
  _track(setTimeout(() => {
    if (!viewportEl.isConnected) return;
    _applyAmbiance(viewportEl);
    _scheduleAmbianceRefresh(viewportEl);
  }, AMBIANCE_REFRESH_MS));
}

// ── Réaction des résidents à la météo/l'heure — pluie et nuit ralentissent
// le wander (pauses plus longues, déplacements plus lents) sans jamais
// l'arrêter, plutôt que d'introduire un nouvel état/sprite "à l'abri"/
// "endormi" (garde le système à un seul mécanisme : _wanderStep). ────────
let _currentWeather = 'clear'; // mis à jour par _applyWeather()

function _isNightNow() {
  const h = new Date().getHours();
  return h >= 22 || h < 5;
}

function _environmentPaceFactor() {
  let pauseMult = 1;
  let speedMult = 1;
  if (_currentWeather === 'rain' || _currentWeather === 'snow') { pauseMult *= 1.6; speedMult *= 0.75; }
  if (_isNightNow()) { pauseMult *= 1.8; speedMult *= 0.7; }
  return { pauseMult, speedMult };
}

// ── Météo — reroll périodique, particules CSS pures (pas de canvas) ─────
function _applyWeather(viewportEl) {
  viewportEl.querySelector('.gang-env-weather')?.remove();

  const weather = WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)];
  _currentWeather = weather;
  if (weather === 'clear') return;

  // Distance de chute en px (transform: translateY(), pas top) — calculée
  // une fois depuis la hauteur réelle du viewport plutôt qu'en pourcentage,
  // pour rester sur une propriété compositée (voir commentaire CSS).
  const fallDistance = (viewportEl.getBoundingClientRect().height || 400) + 40;

  const layer = document.createElement('div');
  layer.className = `gang-env-weather gang-env-weather-${weather}`;
  const count = weather === 'rain' ? RAIN_DROP_COUNT : SNOW_FLAKE_COUNT;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = weather === 'rain' ? 'gang-env-raindrop' : 'gang-env-snowflake';
    p.style.left = `${Math.random() * 100}%`;
    p.style.setProperty('--fall-distance', `${fallDistance}px`);
    p.style.animationDelay = `${Math.random() * 3}s`;
    p.style.animationDuration = weather === 'rain'
      ? `${0.6 + Math.random() * 0.4}s`
      : `${3 + Math.random() * 2.5}s`;
    layer.appendChild(p);
  }
  viewportEl.appendChild(layer);
}

function _scheduleWeatherReroll(viewportEl) {
  const delay = WEATHER_REROLL_MIN_MS + Math.random() * (WEATHER_REROLL_MAX_MS - WEATHER_REROLL_MIN_MS);
  _track(setTimeout(() => {
    if (!viewportEl.isConnected) return;
    _applyWeather(viewportEl);
    _scheduleWeatherReroll(viewportEl);
  }, delay));
}

function _openZoneBgPicker(viewportEl) {
  const state = globalThis.state;
  const COSMETIC_BGS = globalThis.COSMETIC_BGS;
  const unlocked = new Set(state.cosmetics?.unlockedBgs || []);
  const active = state.cosmetics?.bossBg || null;

  const modal = document.createElement('div');
  modal.className = 'gang-picker-overlay';
  const cards = Object.entries(COSMETIC_BGS)
    .filter(([, c]) => c.type !== 'fabric') // fonds tissu gérés via le panneau Apparence uniquement
    .map(([key, c]) => {
      const own = unlocked.has(key);
      const isAct = active === key;
      const thumb = c.type === 'image'
        ? `background-image:url('${c.url}');background-size:cover;background-position:center`
        : `background:${c.gradient}`;
      return `<div class="gang-zonebg-card${isAct ? ' active' : ''}" data-bg-key="${key}" data-owned="${own}">
        <div class="gang-zonebg-thumb" style="${thumb}"></div>
        <div class="gang-zonebg-label">${c.fr}</div>
        <div class="gang-zonebg-status">${isAct ? '[ ACTIF ]' : own ? 'Équiper' : c.cost.toLocaleString() + '₽'}</div>
      </div>`;
    }).join('');

  modal.innerHTML = `
    <div class="gang-picker-box">
      <div class="gang-panel-title">FOND DE LA ZONE</div>
      <div class="gang-zonebg-grid">
        <div class="gang-zonebg-card${!active ? ' active' : ''}" data-bg-key="none" data-owned="true">
          <div class="gang-zonebg-thumb" style="background:linear-gradient(180deg,#0a1a12,#0d2418)"></div>
          <div class="gang-zonebg-label">Défaut</div>
          <div class="gang-zonebg-status">${!active ? '[ ACTIF ]' : 'Gratuit'}</div>
        </div>
        ${cards}
      </div>
      <button id="gangZoneBgCancel">Fermer</button>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelectorAll('[data-bg-key]').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.bgKey === 'none' ? null : el.dataset.bgKey;
      const owned = el.dataset.owned === 'true';
      if (key && !owned) {
        globalThis.notify?.('Débloquez ce fond depuis le panneau Apparence.', 'error');
        return;
      }
      state.cosmetics.bossBg = key;
      globalThis.saveState();
      _applyZoneBackground(viewportEl);
      modal.remove();
    });
  });
  modal.querySelector('#gangZoneBgCancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ── Déplacement des résidents ─────────────────────────────────────────────
// Position et sens de marche vivent sur deux éléments distincts (voir
// gang.css) : .gang-env-sprite porte translate() (transitionné, compositor-
// only — pas de left/top qui déclencheraient du layout à chaque frame),
// .gang-env-sprite-inner porte scaleX() (instantané). Les combiner sur le
// même élément ferait que la transition de position anime aussi le flip.
function _setPosition(el, x, y) {
  el.style.transform = `translate(${x}px, ${y}px)`;
}

function _flip(el, movingLeft) {
  const inner = el.querySelector('.gang-env-sprite-inner') || el;
  inner.style.transform = movingLeft ? 'scaleX(-1)' : 'scaleX(1)';
}

function _dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// entry.x/entry.y sont la position CIBLE du wander en cours, pas la position
// réelle à l'écran pendant la transition CSS qui y mène (plusieurs secondes
// pour les déplacements lents) — pour tout ce qui doit refléter où le sprite
// est VRAIMENT au moment de l'appel (scan de proximité, badge d'interaction),
// on relit la position interpolée en cours via le transform calculé.
function _currentPos(el) {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return { x: 0, y: 0 };
  const m = t.match(/matrix\(([^)]+)\)/);
  if (!m) return { x: 0, y: 0 };
  const parts = m[1].split(',').map(parseFloat);
  return { x: parts[4] || 0, y: parts[5] || 0 };
}

// Choisit une position cible : le plus souvent une case libre (en évitant
// les autres résidents), mais parfois volontairement proche d'un autre
// résident, pour que les rencontres arrivent par elles-mêmes plutôt que de
// compter uniquement sur le hasard du wander libre.
function _pickTarget(entry, bounds) {
  const maxX = Math.max(0, bounds.width - entry.w);
  const maxY = Math.max(0, bounds.groundHeight - entry.h);
  const others = _residents.filter(r => r !== entry);

  if (others.length > 0 && Math.random() < SEEK_OTHER_CHANCE) {
    const target = others[Math.floor(Math.random() * others.length)];
    const angle = Math.random() * Math.PI * 2;
    const approachDist = MIN_SPRITE_DIST + Math.random() * 20;
    const x = Math.min(maxX, Math.max(0, target.x + Math.cos(angle) * approachDist));
    const y = Math.min(bounds.groundTop + maxY, Math.max(bounds.groundTop, target.y + Math.sin(angle) * approachDist));
    return { x, y };
  }

  let best = null;
  for (let i = 0; i < TARGET_RETRY_COUNT; i++) {
    const x = Math.random() * maxX;
    const y = bounds.groundTop + Math.random() * maxY;
    const tooClose = others.some(o => _dist(x, y, o.x, o.y) < MIN_SPRITE_DIST);
    if (!tooClose) return { x, y };
    best = { x, y };
  }
  // Aucun essai n'est totalement libre — mieux vaut un léger chevauchement
  // occasionnel qu'un sprite bloqué indéfiniment sans jamais rebouger.
  return best || { x: Math.random() * maxX, y: bounds.groundTop + Math.random() * maxY };
}

function _wanderStep(entry, bounds) {
  if (!entry.el.isConnected) return;
  if (entry.interacting) return; // reprise explicite par _endInteraction

  const { x: targetX, y: targetY } = _pickTarget(entry, bounds);
  const dist  = _dist(entry.x, entry.y, targetX, targetY);
  const { pauseMult, speedMult } = _environmentPaceFactor();
  const speed = (WANDER_SPEED_MIN + Math.random() * (WANDER_SPEED_MAX - WANDER_SPEED_MIN)) * speedMult;
  const duration = Math.max(0.5, dist / speed);

  entry.el.classList.remove('idle');
  _flip(entry.el, targetX < entry.x);
  entry.el.style.transition = `transform ${duration}s ease-in-out`;
  entry.x = targetX;
  entry.y = targetY;
  _setPosition(entry.el, targetX, targetY);

  entry.timer = _track(setTimeout(() => {
    if (!entry.el.isConnected) return;
    entry.el.classList.add('idle');
    const pause = (WANDER_MIN_PAUSE_MS + Math.random() * (WANDER_MAX_PAUSE_MS - WANDER_MIN_PAUSE_MS)) * pauseMult;
    entry.timer = _track(setTimeout(() => _wanderStep(entry, bounds), pause));
  }, duration * 1000));
}

// `meta` transporte les infos déjà résolues affichées au clic ({level,
// natureLabel}) — jamais une référence live vers un Pokémon, pour que
// résidents locaux (state) et résidents distants (blob Supabase) suivent
// exactement le même chemin de code.
function _spawnResident(viewportEl, imgUrl, label, bounds, meta = {}) {
  const el = document.createElement('div');
  el.className = 'gang-env-sprite idle gang-env-clickable';
  el.title = label || '';
  el.innerHTML = `<div class="gang-env-sprite-inner"><img src="${imgUrl}" alt=""></div>`;
  const x = Math.random() * Math.max(0, bounds.width - 48);
  const y = bounds.groundTop + Math.random() * bounds.groundHeight;
  _setPosition(el, x, y);
  viewportEl.appendChild(el);

  const entry = {
    el, x, y, w: 48, h: 48, label, level: meta.level, natureLabel: meta.natureLabel,
    interacting: false, lastPartner: null, lastInteractionAt: 0, lastClickAt: 0, timer: null,
  };
  el.addEventListener('click', () => _onResidentClick(viewportEl, entry, bounds));
  _residents.push(entry);
  entry.timer = _track(setTimeout(() => _wanderStep(entry, bounds), 200 + Math.random() * 2000));
  return entry;
}

// ── Interaction au clic sur un résident ───────────────────────────────────
function _showClickBadge(entry) {
  const icon = CLICK_REACTION_ICONS[Math.floor(Math.random() * CLICK_REACTION_ICONS.length)];
  const info = entry.level != null
    ? `Lv.${entry.level}${entry.natureLabel ? ` · ${entry.natureLabel}` : ''}`
    : '';

  const badge = document.createElement('div');
  badge.className = 'gang-env-click-badge';
  // textContent (jamais innerHTML) : entry.label vient de pokemonDisplayName(),
  // texte libre (surnom joueur) — pas d'échappement HTML à faire ici puisqu'on
  // n'injecte jamais de balises.
  badge.textContent = [icon, entry.label, info].filter(Boolean).join(' ');
  // Enfant direct du sprite (jamais une position page recalculée à la main) :
  // suit son transform translate() si le résident se remet à marcher avant
  // que le badge n'ait fini de s'effacer (le wander reprend ~0.9-1.4s après
  // le clic, avant les 2.4s de vie du badge).
  entry.el.appendChild(badge);
  _track(setTimeout(() => badge.remove(), 2400));
}

function _onResidentClick(viewportEl, entry, bounds) {
  if (entry.interacting) return; // déjà en mini-interaction ami/ennemi ou en cooldown de clic
  const now = Date.now();
  if (now - (entry.lastClickAt || 0) < CLICK_REACTION_COOLDOWN_MS) return;
  entry.lastClickAt = now;

  clearTimeout(entry.timer);
  entry.interacting = true;
  entry.el.classList.add('idle', 'gang-env-clicked');

  _showClickBadge(entry);

  entry.timer = _track(setTimeout(() => {
    entry.el.classList.remove('gang-env-clicked');
    entry.interacting = false;
    if (!entry.el.isConnected) return;
    entry.timer = _track(setTimeout(() => _wanderStep(entry, bounds), 200 + Math.random() * 500));
  }, CLICK_PAUSE_MS));
}

// ── Mini-interactions — deux résidents qui se croisent tirent un type
//    d'interaction (ami/joueur/curieux/somnolent/rival, cf. INTERACTION_KINDS),
//    se tournent l'un vers l'autre, puis reprennent chacun leur route ──────
function _pickInteractionKind() {
  const total = INTERACTION_KINDS.reduce((sum, k) => sum + k.weight, 0);
  let r = Math.random() * total;
  for (const kind of INTERACTION_KINDS) {
    if (r < kind.weight) return kind;
    r -= kind.weight;
  }
  return INTERACTION_KINDS[0];
}

function _showInteractionBadge(entryA, kind) {
  const badge = document.createElement('div');
  badge.className = `gang-env-interact ${kind.hostile ? 'enemy' : 'friend'}`;
  badge.textContent = kind.icon;
  // Enfant du sprite A — les deux partenaires restent immobiles pendant toute
  // l'interaction, mais rester cohérent avec le reste du fichier (jamais une
  // position page figée à la main) évite toute désynchronisation si ce
  // comportement change plus tard.
  entryA.el.appendChild(badge);
  _track(setTimeout(() => badge.remove(), INTERACTION_BADGE_MS));
}

function _endInteraction(entry, bounds) {
  entry.interacting = false;
  entry.lastInteractionAt = Date.now();
  entry.el.classList.remove('gang-env-clicked');
  const pause = 300 + Math.random() * 800;
  entry.timer = _track(setTimeout(() => _wanderStep(entry, bounds), pause));
}

function _triggerInteraction(viewportEl, entryA, entryB, bounds) {
  if (entryA.interacting || entryB.interacting) return;
  const now = Date.now();
  if (entryA.lastPartner === entryB && now - entryA.lastInteractionAt < INTERACTION_COOLDOWN_MS) return;

  const kind = _pickInteractionKind();
  [entryA, entryB].forEach(e => {
    clearTimeout(e.timer);
    e.interacting = true;
    e.el.classList.add('idle');
    if (kind.bounce) e.el.classList.add('gang-env-clicked');
  });
  entryA.lastPartner = entryB;
  entryB.lastPartner = entryA;

  // Se tourner l'un vers l'autre pour "se faire face"
  _flip(entryA.el, entryA.x > entryB.x);
  _flip(entryB.el, entryB.x > entryA.x);

  _showInteractionBadge(entryA, kind);

  _track(setTimeout(() => {
    _endInteraction(entryA, bounds);
    _endInteraction(entryB, bounds);
  }, kind.pauseMs));
}

function _scheduleProximityScan(viewportEl, bounds) {
  _track(setTimeout(() => {
    if (!viewportEl.isConnected) return;
    for (let i = 0; i < _residents.length; i++) {
      for (let j = i + 1; j < _residents.length; j++) {
        const a = _residents[i], b = _residents[j];
        if (a.interacting || b.interacting) continue;
        const posA = _currentPos(a.el), posB = _currentPos(b.el);
        if (_dist(posA.x, posA.y, posB.x, posB.y) < INTERACTION_DIST_PX) {
          _triggerInteraction(viewportEl, a, b, bounds);
        }
      }
    }
    _scheduleProximityScan(viewportEl, bounds);
  }, PROXIMITY_SCAN_MS));
}

// ── Cameo — agent, infirmière, chercheur ou pokémon favori qui traverse une
// fois puis disparaît (hors du système résident/collision) — porte
// optionnellement une bulle de dialogue (dialogueLine). ──────────────────
function _spawnCameo(viewportEl, imgUrl, label, bounds, extraIconUrl, dialogueLine, hostile = false) {
  const el = document.createElement('div');
  el.className = 'gang-env-sprite gang-env-cameo';
  el.title = label || '';
  el.innerHTML = `<div class="gang-env-sprite-inner"><img src="${imgUrl}" alt="">${extraIconUrl ? `<img class="gang-env-cameo-follow" src="${extraIconUrl}" alt="">` : ''}</div>`;
  const fromLeft = Math.random() < 0.5;
  const startX = fromLeft ? -60 : bounds.width + 60;
  const endX   = fromLeft ? bounds.width + 60 : -60;
  const baseY  = bounds.groundTop + Math.random() * bounds.groundHeight;
  _setPosition(el, startX, baseY);
  _flip(el, !fromLeft); // direction constante sur toute la traversée — la progression horizontale ne fait jamais demi-tour d'une étape à l'autre
  viewportEl.appendChild(el);

  // Bulle en enfant DIRECT de `el` (pas de .gang-env-sprite-inner, qui porte
  // le flip via scaleX() — sinon le texte se retrouverait inversé quand le
  // personnage marche vers la gauche) : posée une fois ci-dessous à l'étape
  // choisie, elle suit ensuite le trajet sans jamais être repositionnée à la main.
  const bubble = dialogueLine ? document.createElement('div') : null;
  if (bubble) {
    bubble.className = `gang-env-speech-bubble${hostile ? ' hostile' : ''}`;
    bubble.textContent = dialogueLine; // jamais innerHTML — texte fixe interne, mais même discipline que le reste du fichier
  }

  // Traversée en plusieurs étapes plutôt qu'une seule ligne droite : chaque
  // étape vise une hauteur légèrement différente (wobble vertical, sauf la
  // dernière qui revient à baseY pour sortir proprement du cadre) avec une
  // vitesse propre. La bulle de dialogue (si présente) n'apparaît jamais
  // avant la 1re étape ni sur la dernière — toujours au moins une étape de
  // marge après, pour laisser le temps de la lire pendant la pause qui
  // l'accompagne obligatoirement.
  const legs = CAMEO_LEGS_MIN + Math.floor(Math.random() * (CAMEO_LEGS_MAX - CAMEO_LEGS_MIN + 1));
  const bubbleLeg = bubble ? 1 + Math.floor(Math.random() * (legs - 1)) : -1;
  let leg = 0;

  function nextLeg() {
    if (!el.isConnected) return;
    leg++;
    const progress = leg / legs;
    const x = startX + (endX - startX) * progress;
    const y = leg >= legs
      ? baseY
      : Math.min(bounds.groundTop + bounds.groundHeight, Math.max(bounds.groundTop, baseY + (Math.random() * 2 - 1) * CAMEO_Y_WOBBLE_PX));

    const cur = _currentPos(el);
    const dist = Math.max(1, _dist(cur.x, cur.y, x, y));
    const speed = CAMEO_SPEED_PX_PER_S * (0.7 + Math.random() * 0.6); // variation de vitesse — casse l'effet métronome/ligne droite
    const duration = Math.max(0.8, dist / speed);

    el.classList.remove('idle');
    el.style.transition = `transform ${duration}s ease-in-out`;
    _setPosition(el, x, y);

    _track(setTimeout(() => {
      if (!el.isConnected) return;

      if (leg === bubbleLeg) {
        el.classList.add('idle');
        el.appendChild(bubble);
      }

      if (leg >= legs) {
        _track(setTimeout(() => el.remove(), 300));
        return;
      }

      const shouldPause = leg === bubbleLeg || Math.random() < CAMEO_PAUSE_CHANCE;
      if (shouldPause) el.classList.add('idle');
      const pause = shouldPause
        ? CAMEO_PAUSE_MIN_MS + Math.random() * (CAMEO_PAUSE_MAX_MS - CAMEO_PAUSE_MIN_MS)
        : 80 + Math.random() * 200; // enchaînement quasi direct — la pause n'est pas systématique à chaque étape
      _track(setTimeout(nextLeg, pause));
    }, duration * 1000));
  }

  requestAnimationFrame(nextLeg);
}

// Tire un cameo au hasard dans un pool déjà construit (cf. vivariumSnapshot.js
// :buildVivariumCameoPool) et l'anime — partagé par le rendu local (pool
// reconstruit à chaque tirage depuis `state`) et le rendu distant (pool
// figé jusqu'au prochain fetch, cf. renderEnvironmentZoneFromSnapshot).
function _fireCameoFromPool(viewportEl, bounds, pool) {
  if (!pool || pool.length === 0) return;
  const entry = pool[Math.floor(Math.random() * pool.length)];
  const line = entry.lines?.length ? entry.lines[Math.floor(Math.random() * entry.lines.length)] : null;
  _spawnCameo(viewportEl, entry.spriteUrl, entry.label, bounds, entry.followIconUrl || null, line, !!entry.hostile);
}

function _fireCameoEvent(viewportEl, bounds) {
  _fireCameoFromPool(viewportEl, bounds, buildVivariumCameoPool(globalThis.state));
}

// `poolProvider` est appelé à CHAQUE tirage (pas une fois pour toutes) : côté
// rendu local ça garantit un pool toujours à jour avec `state` (comportement
// inchangé par l'extraction), côté rendu distant ça relit simplement la
// dernière valeur reçue (cf. _liveCameoPool) sans redéclencher de fetch.
function _scheduleCameos(viewportEl, bounds, poolProvider) {
  const delay = CAMEO_MIN_DELAY_MS + Math.random() * (CAMEO_MAX_DELAY_MS - CAMEO_MIN_DELAY_MS);
  _track(setTimeout(() => {
    if (!viewportEl.isConnected) return;
    if (Math.random() < CAMEO_SPAWN_CHANCE) _fireCameoFromPool(viewportEl, bounds, poolProvider());
    _scheduleCameos(viewportEl, bounds, poolProvider);
  }, delay));
}

function _openZoneSourcesPicker(rootContainer) {
  const state = globalThis.state;
  const active = new Set(state.cosmetics.vivariumSources || ['showcase', 'team']);

  const modal = document.createElement('div');
  modal.className = 'gang-picker-overlay';
  const rows = VIVARIUM_SOURCES.map(src => {
    const on = active.has(src.key);
    const count = src.ids(state).length;
    return `<label class="gang-source-row${on ? ' active' : ''}">
      <input type="checkbox" data-source-key="${src.key}" ${on ? 'checked' : ''}>
      <span class="gang-source-icon">${src.icon}</span>
      <span class="gang-source-label">${src.label}</span>
      <span class="gang-source-count">${count}</span>
    </label>`;
  }).join('');

  modal.innerHTML = `
    <div class="gang-picker-box">
      <div class="gang-panel-title">ZONES AFFICHÉES</div>
      <div class="gang-source-list">${rows}</div>
      <button id="gangSourcesClose">Fermer</button>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelectorAll('[data-source-key]').forEach(input => {
    input.addEventListener('change', () => {
      const key = input.dataset.sourceKey;
      const set = new Set(state.cosmetics.vivariumSources || []);
      if (input.checked) set.add(key); else set.delete(key);
      state.cosmetics.vivariumSources = [...set];
      globalThis.saveState();
      input.closest('.gang-source-row')?.classList.toggle('active', input.checked);
      renderEnvironmentZone(rootContainer); // reconstruit les résidents avec le nouveau set de sources
    });
  });
  modal.querySelector('#gangSourcesClose').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ════════════════════════════════════════════════════════════════
export function renderEnvironmentZone(rootContainer) {
  const zoneEl = rootContainer.querySelector('#gangEnvironmentZone');
  if (!zoneEl) return;
  stopEnvironmentZone();
  _zoneEl = zoneEl;

  zoneEl.innerHTML = `
    <button class="gang-zonebg-btn" id="gangZoneBgBtn" title="Changer le fond">🎨</button>
    <button class="gang-zonesrc-btn" id="gangZoneSrcBtn" title="Choisir les zones affichées">👁</button>
    <div class="gang-env-viewport" id="gangEnvViewport"></div>`;

  const viewportEl = zoneEl.querySelector('#gangEnvViewport');
  _applyZoneBackground(viewportEl);
  zoneEl.querySelector('#gangZoneBgBtn').addEventListener('click', () => _openZoneBgPicker(viewportEl));
  zoneEl.querySelector('#gangZoneSrcBtn').addEventListener('click', () => _openZoneSourcesPicker(rootContainer));

  _applyAmbiance(viewportEl);
  _scheduleAmbianceRefresh(viewportEl);
  _applyWeather(viewportEl);
  _scheduleWeatherReroll(viewportEl);

  const state = globalThis.state;
  const rect = viewportEl.getBoundingClientRect();
  const bounds = {
    width: rect.width || 600,
    groundTop: (rect.height || 320) * 0.35,
    groundHeight: (rect.height || 320) * 0.55,
  };

  // Résidents permanents : une ou plusieurs sources au choix du joueur
  // (state.cosmetics.vivariumSources — voir _openZoneSourcesPicker ci-dessus).
  const residents = buildVivariumResidents(state);
  for (const r of residents) {
    _spawnResident(viewportEl, r.spriteUrl, r.label, bounds, { level: r.level, natureLabel: r.natureLabel });
  }

  if (residents.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'gang-env-empty-hint';
    empty.textContent = 'Ajoutez des Pokémon à une zone activée (👁) pour les voir se balader ici.';
    viewportEl.appendChild(empty);
  } else {
    _scheduleProximityScan(viewportEl, bounds);
  }

  _scheduleCameos(viewportEl, bounds, () => buildVivariumCameoPool(globalThis.state));
}

// ════════════════════════════════════════════════════════════════
//  Variante distante — consomme un blob déjà résolu (Supabase) au lieu de
//  `globalThis.state`. Aucun picker (fond/sources) : lecture seule, rien à
//  écrire nulle part. Appelée par gang/live-app.js.
//
//  blob attendu : { residents: [{spriteUrl,label,level,natureLabel}],
//                    cameoPool: [{type,spriteUrl,label,followIconUrl?,
//                                 lines,hostile?}], backgroundData }
// ════════════════════════════════════════════════════════════════
export function renderEnvironmentZoneFromSnapshot(rootContainer, blob) {
  const zoneEl = rootContainer.querySelector('#gangEnvironmentZone');
  if (!zoneEl) return;
  stopEnvironmentZone();
  _zoneEl = zoneEl;
  _liveCameoPool = blob?.cameoPool || [];

  zoneEl.innerHTML = `<div class="gang-env-viewport" id="gangEnvViewport"></div>`;
  const viewportEl = zoneEl.querySelector('#gangEnvViewport');
  // Contrairement au rendu local (_applyZoneBackground, toujours peint — au
  // moins le dégradé par défaut), l'absence de fond équipé reste transparente
  // ici : c'est un overlay OBS par-dessus le flux réel, pas une page à soi.
  if (blob?.backgroundData) _applyBackgroundData(viewportEl, blob.backgroundData);

  _applyAmbiance(viewportEl);
  _scheduleAmbianceRefresh(viewportEl);
  _applyWeather(viewportEl);
  _scheduleWeatherReroll(viewportEl);

  const rect = viewportEl.getBoundingClientRect();
  const bounds = {
    width: rect.width || 600,
    groundTop: (rect.height || 320) * 0.35,
    groundHeight: (rect.height || 320) * 0.55,
  };

  const residents = blob?.residents || [];
  for (const r of residents) {
    _spawnResident(viewportEl, r.spriteUrl, r.label, bounds, { level: r.level, natureLabel: r.natureLabel });
  }

  if (residents.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'gang-env-empty-hint';
    empty.textContent = 'Aucun résident à afficher pour le moment.';
    viewportEl.appendChild(empty);
  } else {
    _scheduleProximityScan(viewportEl, bounds);
  }

  _scheduleCameos(viewportEl, bounds, () => _liveCameoPool);
}

// Rafraîchit juste résidents + pool de cameos + fond depuis un nouveau blob,
// sans redémarrer météo/ambiance/planification des cameos (cf. _clearResidents)
// — appelée à chaque poll après le premier rendu (renderEnvironmentZoneFromSnapshot).
export function updateEnvironmentSnapshot(blob) {
  if (!_zoneEl || !_zoneEl.isConnected) return;
  const viewportEl = _zoneEl.querySelector('#gangEnvViewport');
  if (!viewportEl) return;

  _liveCameoPool = blob?.cameoPool || [];
  if (blob?.backgroundData) _applyBackgroundData(viewportEl, blob.backgroundData);

  const rect = viewportEl.getBoundingClientRect();
  const bounds = {
    width: rect.width || 600,
    groundTop: (rect.height || 320) * 0.35,
    groundHeight: (rect.height || 320) * 0.55,
  };

  _clearResidents(viewportEl);
  const residents = blob?.residents || [];
  for (const r of residents) {
    _spawnResident(viewportEl, r.spriteUrl, r.label, bounds, { level: r.level, natureLabel: r.natureLabel });
  }
  if (residents.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'gang-env-empty-hint';
    empty.textContent = 'Aucun résident à afficher pour le moment.';
    viewportEl.appendChild(empty);
  }
}
