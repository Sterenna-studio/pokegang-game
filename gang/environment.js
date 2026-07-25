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
//  Dépendances globalThis : state, saveState, notify, pokeSprite,
//    pokemonDisplayName, trainerSprite, COSMETIC_BGS, fabricBgUrl
// ════════════════════════════════════════════════════════════════

const CAMEO_MIN_DELAY_MS   = 45_000;
const CAMEO_MAX_DELAY_MS   = 90_000;
const CAMEO_SPAWN_CHANCE   = 0.5;
const CAMEO_SPEED_PX_PER_S = 45;

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
const INTERACTION_DURATION_MS = 2000;
const INTERACTION_COOLDOWN_MS = 20_000; // avant de pouvoir réinteragir avec le même partenaire
const PROXIMITY_SCAN_MS    = 1200;
const FRIEND_CHANCE        = 0.6;

// Interaction au clic — "câliner" un résident : pause brève du wander, petit
// rebond, et une bulle avec une réaction + les infos du Pokémon.
const CLICK_REACTION_ICONS    = ['💫', '✨', '⭐', '❤️', '😊', '🎵'];
const CLICK_REACTION_COOLDOWN_MS = 700; // anti-spam-clic
const CLICK_PAUSE_MS          = 900;    // durée de la pause + du rebond

let _timers    = [];   // tous les setTimeout actifs — nettoyés par stopEnvironmentZone()
let _residents = [];   // { el, x, y, w, h, interacting, lastPartner, lastInteractionAt, timer }
let _zoneEl    = null;

function _track(id) { _timers.push(id); return id; }

export function stopEnvironmentZone() {
  _timers.forEach(clearTimeout);
  _timers = [];
  _residents = [];
  _zoneEl = null;
}

// ── Fond de la zone (state.cosmetics.bossBg — réutilise le même catalogue
//    COSMETIC_BGS/unlockedBgs que le fond de page, juste un pointeur
//    d'équipement séparé) ───────────────────────────────────────────────
function _applyZoneBackground(viewportEl) {
  const state = globalThis.state;
  const key = state.cosmetics?.bossBg || null;
  const COSMETIC_BGS = globalThis.COSMETIC_BGS;
  const bg = key ? COSMETIC_BGS?.[key] : null;
  const isFabric = key && key.startsWith('fabric_');

  if (bg?.type === 'image') {
    viewportEl.style.backgroundImage = `url('${bg.url}')`;
    viewportEl.style.backgroundSize = 'cover';
    viewportEl.style.backgroundPosition = 'center';
  } else if (bg?.type === 'gradient') {
    viewportEl.style.backgroundImage = bg.gradient;
    viewportEl.style.backgroundSize = 'cover';
  } else if (isFabric) {
    const m = key.match(/^fabric_(\d+)(?:_v(\d+))?$/);
    const url = m ? globalThis.fabricBgUrl(parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) : 1) : null;
    if (url) {
      viewportEl.style.backgroundImage = `url('${url}')`;
      viewportEl.style.backgroundSize = '160px';
      viewportEl.style.backgroundRepeat = 'repeat';
    }
  } else {
    viewportEl.style.backgroundImage = 'linear-gradient(180deg,#0a1a12,#0d2418)';
    viewportEl.style.backgroundSize = 'cover';
  }
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
  const speed = WANDER_SPEED_MIN + Math.random() * (WANDER_SPEED_MAX - WANDER_SPEED_MIN);
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
    const pause = WANDER_MIN_PAUSE_MS + Math.random() * (WANDER_MAX_PAUSE_MS - WANDER_MIN_PAUSE_MS);
    entry.timer = _track(setTimeout(() => _wanderStep(entry, bounds), pause));
  }, duration * 1000));
}

function _spawnResident(viewportEl, imgUrl, label, bounds, pk) {
  const el = document.createElement('div');
  el.className = 'gang-env-sprite idle gang-env-clickable';
  el.title = label || '';
  el.innerHTML = `<div class="gang-env-sprite-inner"><img src="${imgUrl}" alt=""></div>`;
  const x = Math.random() * Math.max(0, bounds.width - 48);
  const y = bounds.groundTop + Math.random() * bounds.groundHeight;
  _setPosition(el, x, y);
  viewportEl.appendChild(el);

  const entry = {
    el, x, y, w: 48, h: 48, label, pk,
    interacting: false, lastPartner: null, lastInteractionAt: 0, lastClickAt: 0, timer: null,
  };
  el.addEventListener('click', () => _onResidentClick(viewportEl, entry, bounds));
  _residents.push(entry);
  entry.timer = _track(setTimeout(() => _wanderStep(entry, bounds), 200 + Math.random() * 2000));
  return entry;
}

// ── Interaction au clic sur un résident ───────────────────────────────────
function _showClickBadge(viewportEl, entry) {
  const pos  = _currentPos(entry.el);
  const icon = CLICK_REACTION_ICONS[Math.floor(Math.random() * CLICK_REACTION_ICONS.length)];
  const pk   = entry.pk;
  const NATURES = globalThis.NATURES;
  const info = pk
    ? `Lv.${pk.level}${pk.nature && NATURES?.[pk.nature] ? ` · ${NATURES[pk.nature].fr}` : ''}`
    : '';

  const badge = document.createElement('div');
  badge.className = 'gang-env-click-badge';
  // textContent (jamais innerHTML) : entry.label vient de pokemonDisplayName(),
  // texte libre (surnom joueur) — pas d'échappement HTML à faire ici puisqu'on
  // n'injecte jamais de balises.
  badge.textContent = [icon, entry.label, info].filter(Boolean).join(' ');
  badge.style.left = `${pos.x + 24}px`;
  badge.style.top  = `${pos.y - 10}px`;
  viewportEl.appendChild(badge);
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

  _showClickBadge(viewportEl, entry);

  entry.timer = _track(setTimeout(() => {
    entry.el.classList.remove('gang-env-clicked');
    entry.interacting = false;
    if (!entry.el.isConnected) return;
    entry.timer = _track(setTimeout(() => _wanderStep(entry, bounds), 200 + Math.random() * 500));
  }, CLICK_PAUSE_MS));
}

// ── Mini-interactions — deux résidents qui se croisent deviennent
//    brièvement amis (💕) ou ennemis (💢), se tournent l'un vers l'autre,
//    puis reprennent chacun leur route ────────────────────────────────────
function _showInteractionBadge(viewportEl, entryA, entryB, isFriend) {
  const posA = _currentPos(entryA.el);
  const posB = _currentPos(entryB.el);
  const midX = (posA.x + posB.x) / 2 + 24;
  const midY = Math.min(posA.y, posB.y) - 8;
  const badge = document.createElement('div');
  badge.className = `gang-env-interact ${isFriend ? 'friend' : 'enemy'}`;
  badge.textContent = isFriend ? '💕' : '💢';
  badge.style.left = `${midX}px`;
  badge.style.top  = `${midY}px`;
  viewportEl.appendChild(badge);
  _track(setTimeout(() => badge.remove(), INTERACTION_DURATION_MS + 300));
}

function _endInteraction(entry, bounds) {
  entry.interacting = false;
  entry.lastInteractionAt = Date.now();
  const pause = 300 + Math.random() * 800;
  entry.timer = _track(setTimeout(() => _wanderStep(entry, bounds), pause));
}

function _triggerInteraction(viewportEl, entryA, entryB, bounds) {
  if (entryA.interacting || entryB.interacting) return;
  const now = Date.now();
  if (entryA.lastPartner === entryB && now - entryA.lastInteractionAt < INTERACTION_COOLDOWN_MS) return;

  [entryA, entryB].forEach(e => { clearTimeout(e.timer); e.interacting = true; e.el.classList.add('idle'); });
  entryA.lastPartner = entryB;
  entryB.lastPartner = entryA;

  // Se tourner l'un vers l'autre pour "se faire face"
  _flip(entryA.el, entryA.x > entryB.x);
  _flip(entryB.el, entryB.x > entryA.x);

  _showInteractionBadge(viewportEl, entryA, entryB, Math.random() < FRIEND_CHANCE);

  _track(setTimeout(() => {
    _endInteraction(entryA, bounds);
    _endInteraction(entryB, bounds);
  }, INTERACTION_DURATION_MS));
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

// ── Cameo — agent ou pokémon favori qui traverse une fois puis disparaît ──
// (hors du système résident/collision — passage rapide et ponctuel)
function _spawnCameo(viewportEl, imgUrl, label, bounds, extraIconUrl) {
  const el = document.createElement('div');
  el.className = 'gang-env-sprite gang-env-cameo';
  el.title = label || '';
  el.innerHTML = `<div class="gang-env-sprite-inner"><img src="${imgUrl}" alt="">${extraIconUrl ? `<img class="gang-env-cameo-follow" src="${extraIconUrl}" alt="">` : ''}</div>`;
  const fromLeft = Math.random() < 0.5;
  const startX = fromLeft ? -60 : bounds.width + 60;
  const endX   = fromLeft ? bounds.width + 60 : -60;
  const y = bounds.groundTop + Math.random() * bounds.groundHeight;
  _setPosition(el, startX, y);
  _flip(el, !fromLeft);
  viewportEl.appendChild(el);

  requestAnimationFrame(() => {
    const duration = Math.max(4, bounds.width / CAMEO_SPEED_PX_PER_S);
    el.style.transition = `transform ${duration}s linear`;
    _setPosition(el, endX, y);
    _track(setTimeout(() => el.remove(), duration * 1000 + 200));
  });
}

function _scheduleCameos(viewportEl, bounds) {
  const delay = CAMEO_MIN_DELAY_MS + Math.random() * (CAMEO_MAX_DELAY_MS - CAMEO_MIN_DELAY_MS);
  _track(setTimeout(() => {
    if (!viewportEl.isConnected) return;
    if (Math.random() < CAMEO_SPAWN_CHANCE) {
      const state = globalThis.state;
      const roll = Math.random();
      if (roll < 0.5 && state.agents.length > 0) {
        const agent = state.agents[Math.floor(Math.random() * state.agents.length)];
        const hasTeam = agent.team && agent.team.length > 0;
        const followIcon = hasTeam && Math.random() < 0.6
          ? (() => {
              const pk = state.pokemons.find(p => p.id === agent.team[0]);
              return pk ? globalThis.pokeSprite(pk.species_en, pk.shiny) : null;
            })()
          : null;
        // agent.sprite est déjà une URL résolue (trainerSprite(agent.spriteKey)
        // appliqué à la création, cf. agent.js:72-73) — la re-passer à
        // trainerSprite() ici la traiterait à tort comme une clé brute.
        const cameoSprite = agent.spriteKey ? globalThis.trainerSprite(agent.spriteKey) : agent.sprite;
        _spawnCameo(viewportEl, cameoSprite, agent.name, bounds, followIcon);
      } else {
        const favs = state.pokemons.filter(p => p.favorite);
        if (favs.length > 0) {
          const pk = favs[Math.floor(Math.random() * favs.length)];
          _spawnCameo(viewportEl, globalThis.pokeSprite(pk.species_en, pk.shiny), globalThis.pokemonDisplayName?.(pk) || pk.species_en, bounds);
        }
      }
    }
    _scheduleCameos(viewportEl, bounds);
  }, delay));
}

// ════════════════════════════════════════════════════════════════
export function renderEnvironmentZone(rootContainer) {
  const zoneEl = rootContainer.querySelector('#gangEnvironmentZone');
  if (!zoneEl) return;
  stopEnvironmentZone();
  _zoneEl = zoneEl;

  zoneEl.innerHTML = `
    <button class="gang-zonebg-btn" id="gangZoneBgBtn" title="Changer le fond">🎨</button>
    <div class="gang-env-viewport" id="gangEnvViewport"></div>`;

  const viewportEl = zoneEl.querySelector('#gangEnvViewport');
  _applyZoneBackground(viewportEl);
  zoneEl.querySelector('#gangZoneBgBtn').addEventListener('click', () => _openZoneBgPicker(viewportEl));

  const state = globalThis.state;
  const rect = viewportEl.getBoundingClientRect();
  const bounds = {
    width: rect.width || 600,
    groundTop: (rect.height || 320) * 0.35,
    groundHeight: (rect.height || 320) * 0.55,
  };

  // Résidents permanents : vitrine + équipe active du boss
  const showcaseIds = (state.gang.showcase || []).filter(Boolean);
  for (const id of showcaseIds) {
    const pk = state.pokemons.find(p => p.id === id);
    if (pk) _spawnResident(viewportEl, globalThis.pokeSprite(pk.species_en, pk.shiny), globalThis.pokemonDisplayName?.(pk) || pk.species_en, bounds, pk);
  }
  const activeSlot = state.gang.bossTeamSlots?.[state.gang.activeBossTeamSlot || 0] || [];
  for (const id of activeSlot) {
    if (showcaseIds.includes(id)) continue; // évite un doublon si le même pokémon est aussi en vitrine
    const pk = state.pokemons.find(p => p.id === id);
    if (pk) _spawnResident(viewportEl, globalThis.pokeSprite(pk.species_en, pk.shiny), globalThis.pokemonDisplayName?.(pk) || pk.species_en, bounds, pk);
  }

  if (showcaseIds.length === 0 && activeSlot.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'gang-env-empty-hint';
    empty.textContent = 'Ajoutez des Pokémon à la vitrine pour les voir se balader ici.';
    viewportEl.appendChild(empty);
  } else {
    _scheduleProximityScan(viewportEl, bounds);
  }

  _scheduleCameos(viewportEl, bounds);
}
