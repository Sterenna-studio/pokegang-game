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
//  caméos éligibles, fond de zone) vit dans modules/systems/
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

const _t = (fr, en) => (globalThis.state?.lang === 'en' ? en : fr);

const CAMEO_MIN_DELAY_MS   = 45_000;
const CAMEO_MAX_DELAY_MS   = 90_000;
const CAMEO_SPAWN_CHANCE   = 0.5;
const CAMEO_SPEED_PX_PER_S = 45;

const CAMEO_LEGS_MIN     = 2;
const CAMEO_LEGS_MAX     = 4;
const CAMEO_PAUSE_CHANCE = 0.65;
const CAMEO_PAUSE_MIN_MS = 1000;
const CAMEO_PAUSE_MAX_MS = 2600;
const CAMEO_Y_WOBBLE_PX  = 26;

const AMBIANCE_REFRESH_MS = 5 * 60_000;

const WEATHER_TYPES         = ['clear', 'clear', 'rain', 'snow'];
const WEATHER_REROLL_MIN_MS = 5 * 60_000;
const WEATHER_REROLL_MAX_MS = 10 * 60_000;
const RAIN_DROP_COUNT   = 26;
const SNOW_FLAKE_COUNT  = 18;

const WANDER_MIN_PAUSE_MS = 600;
const WANDER_MAX_PAUSE_MS = 5500;
const WANDER_SPEED_MIN    = 26;
const WANDER_SPEED_MAX    = 70;

const MIN_SPRITE_DIST      = 46;
const TARGET_RETRY_COUNT   = 5;
const SEEK_OTHER_CHANCE    = 0.35;
const INTERACTION_DIST_PX  = 44;
const INTERACTION_COOLDOWN_MS = 20_000;
const PROXIMITY_SCAN_MS    = 1200;
const INTERACTION_BADGE_MS = 2300;

const INTERACTION_KINDS = [
  { key: 'friend',  icon: '💕', weight: 35, pauseMs: 2000 },
  { key: 'playful', icon: '🎾', weight: 25, pauseMs: 2000, bounce: true },
  { key: 'curious', icon: '👀', weight: 15, pauseMs: 1300 },
  { key: 'sleepy',  icon: '😴', weight: 10, pauseMs: 3400 },
  { key: 'enemy',   icon: '💢', weight: 15, pauseMs: 2000, hostile: true },
];

const CLICK_REACTION_ICONS    = ['💫', '✨', '⭐', '❤️', '😊', '🎵'];
const CLICK_REACTION_COOLDOWN_MS = 700;
const CLICK_PAUSE_MS          = 900;

let _timers    = [];
let _residents = [];
let _zoneEl    = null;
let _liveCameoPool = [];

function _track(id) { _timers.push(id); return id; }

export function stopEnvironmentZone() {
  _timers.forEach(clearTimeout);
  _timers = [];
  _residents = [];
  _zoneEl = null;
  _liveCameoPool = [];
}

function _clearResidents(viewportEl) {
  for (const r of _residents) {
    clearTimeout(r.timer);
    r.el.remove();
  }
  _residents = [];
  viewportEl.querySelector('.gang-env-empty-hint')?.remove();
}

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

function _timeOfDayTint() {
  const h = new Date().getHours();
  if (h >= 22 || h < 5)  return 'rgba(8,12,36,.5)';
  if (h >= 5  && h < 8)  return 'rgba(255,175,120,.16)';
  if (h >= 18 && h < 22) return 'rgba(255,100,60,.20)';
  return 'transparent';
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

let _currentWeather = 'clear';

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

function _applyWeather(viewportEl) {
  viewportEl.querySelector('.gang-env-weather')?.remove();
  const weather = WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)];
  _currentWeather = weather;
  if (weather === 'clear') return;
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
    .filter(([, c]) => c.type !== 'fabric')
    .map(([key, c]) => {
      const own = unlocked.has(key);
      const isAct = active === key;
      const name = state.lang === 'en' ? (c.en || c.fr) : c.fr;
      const thumb = c.type === 'image'
        ? `background-image:url('${c.url}');background-size:cover;background-position:center`
        : `background:${c.gradient}`;
      return `<div class="gang-zonebg-card${isAct ? ' active' : ''}" data-bg-key="${key}" data-owned="${own}">
        <div class="gang-zonebg-thumb" style="${thumb}"></div>
        <div class="gang-zonebg-label">${name}</div>
        <div class="gang-zonebg-status">${isAct ? _t('[ ACTIF ]', '[ ACTIVE ]') : own ? _t('Équiper', 'Equip') : c.cost.toLocaleString() + '₽'}</div>
      </div>`;
    }).join('');

  modal.innerHTML = `
    <div class="gang-picker-box">
      <div class="gang-panel-title">${_t('FOND DE LA ZONE', 'ZONE BACKGROUND')}</div>
      <div class="gang-zonebg-grid">
        <div class="gang-zonebg-card${!active ? ' active' : ''}" data-bg-key="none" data-owned="true">
          <div class="gang-zonebg-thumb" style="background:linear-gradient(180deg,#0a1a12,#0d2418)"></div>
          <div class="gang-zonebg-label">${_t('Défaut', 'Default')}</div>
          <div class="gang-zonebg-status">${!active ? _t('[ ACTIF ]', '[ ACTIVE ]') : _t('Gratuit', 'Free')}</div>
        </div>
        ${cards}
      </div>
      <button id="gangZoneBgCancel">${_t('Fermer', 'Close')}</button>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelectorAll('[data-bg-key]').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.bgKey === 'none' ? null : el.dataset.bgKey;
      const owned = el.dataset.owned === 'true';
      if (key && !owned) {
        globalThis.notify?.(_t('Débloquez ce fond depuis le panneau Apparence.', 'Unlock this background from the Appearance panel.'), 'error');
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

function _currentPos(el) {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return { x: 0, y: 0 };
  const m = t.match(/matrix\(([^)]+)\)/);
  if (!m) return { x: 0, y: 0 };
  const parts = m[1].split(',').map(parseFloat);
  return { x: parts[4] || 0, y: parts[5] || 0 };
}

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
  return best || { x: Math.random() * maxX, y: bounds.groundTop + Math.random() * maxY };
}

function _wanderStep(entry, bounds) {
  if (!entry.el.isConnected) return;
  if (entry.interacting) return;

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

function _showClickBadge(entry) {
  const icon = CLICK_REACTION_ICONS[Math.floor(Math.random() * CLICK_REACTION_ICONS.length)];
  const info = entry.level != null
    ? `Lv.${entry.level}${entry.natureLabel ? ` · ${entry.natureLabel}` : ''}`
    : '';
  const badge = document.createElement('div');
  badge.className = 'gang-env-click-badge';
  badge.textContent = [icon, entry.label, info].filter(Boolean).join(' ');
  entry.el.appendChild(badge);
  _track(setTimeout(() => badge.remove(), 2400));
}

function _onResidentClick(viewportEl, entry, bounds) {
  if (entry.interacting) return;
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
  _flip(el, !fromLeft);
  viewportEl.appendChild(el);

  const bubble = dialogueLine ? document.createElement('div') : null;
  if (bubble) {
    bubble.className = `gang-env-speech-bubble${hostile ? ' hostile' : ''}`;
    bubble.textContent = dialogueLine;
  }

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
    const speed = CAMEO_SPEED_PX_PER_S * (0.7 + Math.random() * 0.6);
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
        : 80 + Math.random() * 200;
      _track(setTimeout(nextLeg, pause));
    }, duration * 1000));
  }

  requestAnimationFrame(nextLeg);
}

function _fireCameoFromPool(viewportEl, bounds, pool) {
  if (!pool || pool.length === 0) return;
  const entry = pool[Math.floor(Math.random() * pool.length)];
  const line = entry.lines?.length ? entry.lines[Math.floor(Math.random() * entry.lines.length)] : null;
  _spawnCameo(viewportEl, entry.spriteUrl, entry.label, bounds, entry.followIconUrl || null, line, !!entry.hostile);
}

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
      <span class="gang-source-label">${state.lang === 'en' ? (src.label_en || src.label) : src.label}</span>
      <span class="gang-source-count">${count}</span>
    </label>`;
  }).join('');

  modal.innerHTML = `
    <div class="gang-picker-box">
      <div class="gang-panel-title">${_t('ZONES AFFICHÉES', 'DISPLAYED ZONES')}</div>
      <div class="gang-source-list">${rows}</div>
      <button id="gangSourcesClose">${_t('Fermer', 'Close')}</button>
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
      renderEnvironmentZone(rootContainer);
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
    <button class="gang-zonebg-btn" id="gangZoneBgBtn" title="${_t('Changer le fond', 'Change background')}">🎨</button>
    <button class="gang-zonesrc-btn" id="gangZoneSrcBtn" title="${_t('Choisir les zones affichées', 'Choose displayed zones')}">👁</button>
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

  const residents = buildVivariumResidents(state);
  for (const r of residents) {
    _spawnResident(viewportEl, r.spriteUrl, r.label, bounds, { level: r.level, natureLabel: r.natureLabel });
  }

  if (residents.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'gang-env-empty-hint';
    empty.textContent = _t(
      'Ajoutez des Pokémon à une zone activée (👁) pour les voir se balader ici.',
      'Add Pokémon to an active zone (👁) to see them roam here.'
    );
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
    // Rendu distant (OBS) : pas de state disponible — EN par défaut.
    empty.textContent = 'No residents to display for now.';
    viewportEl.appendChild(empty);
  } else {
    _scheduleProximityScan(viewportEl, bounds);
  }

  _scheduleCameos(viewportEl, bounds, () => _liveCameoPool);
}

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
    empty.textContent = 'No residents to display for now.';
    viewportEl.appendChild(empty);
  }
}
