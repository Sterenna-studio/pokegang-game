'use strict';

// ════════════════════════════════════════════════════════════════
//  environment.js — zone d'environnement animée ("vivarium") où se
//  baladent les Pokémon de la vitrine, l'équipe active du boss, et
//  occasionnellement un agent ou un Pokémon favori du Pokédex.
//
//  Déplacements par transitions CSS, sprites animés dans des canvas.
//  Placement et profondeur suivent les pieds à faible fréquence, sans
//  pathfinding. Les résidents évitent les destinations occupées et
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
import { attachPmdSprite, directionFromVector, stopPmdSprites } from './pmdSprites.js';
import { attachCharacterSprite } from './characterSprites.js';
import { HQ_AREAS, wantsHq } from '../modules/systems/vivariumZones.js';
import { devFeaturesEnabled } from '../modules/core/devFeatures.js';
import { createVivariumLayout, pickGroundTarget, readSpritePosition, DEFAULT_FOOTPRINT,
  groundIndex, groundClearance } from './vivariumLayout.js';

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

const _timers = new Set();
let _residents = [];
let _zoneEl    = null;
let _liveCameoPool = [];
let _resizeObserver = null;
let _bounds = null;
let _spriteMode = 'pmd';
const _pokemonCameos = new Set();
let _layout = null, _devPanel = null;

function _later(fn, delay) {
  const id = globalThis.setTimeout(() => { _timers.delete(id); fn(); }, delay);
  _timers.add(id);
  return id;
}
function _cancel(id) { globalThis.clearTimeout(id); _timers.delete(id); }

export function stopEnvironmentZone() {
  _devPanel?.dispose(); _devPanel = null;
  _layout?.dispose(); _layout = null;
  _timers.forEach(id => globalThis.clearTimeout(id));
  _timers.clear();
  _resizeObserver?.disconnect();
  _resizeObserver = null;
  _bounds = null;
  stopPmdSprites();
  _pokemonCameos.clear();
  _residents = [];
  _zoneEl = null;
  _liveCameoPool = [];
}

function _applyBackgroundData(viewportEl, bgData) {
  viewportEl.dataset.scene = bgData?.scene === 'hq' ? 'hq' : 'classic';
  viewportEl.querySelector('.gang-hq-labels')?.remove();
  if (bgData?.scene === 'hq') {
    const labels = document.createElement('div');
    labels.className = 'gang-hq-labels';
    for (const area of HQ_AREAS) {
      const label = document.createElement('span');
      label.textContent = _t(area.fr, area.en);
      label.style.left = `${(area.x + area.w / 2) * 100}%`;
      label.style.top = `${(area.y - .018) * 100}%`;
      labels.appendChild(label);
    }
    viewportEl.appendChild(labels);
  }
  if (bgData?.type === 'image' || bgData?.type === 'fabric') {
    viewportEl.style.backgroundImage = `url('${bgData.url}')`;
    if (bgData.type === 'fabric') {
      viewportEl.style.backgroundSize = '160px';
      viewportEl.style.backgroundRepeat = 'repeat';
    } else {
      viewportEl.style.backgroundSize = bgData.scene === 'hq' ? '100% 100%' : 'cover';
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
  _later(() => {
    if (!viewportEl.isConnected) return;
    _applyAmbiance(viewportEl);
    _scheduleAmbianceRefresh(viewportEl);
  }, AMBIANCE_REFRESH_MS);
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
  _later(() => {
    if (!viewportEl.isConnected) return;
    _applyWeather(viewportEl);
    _scheduleWeatherReroll(viewportEl);
  }, delay);
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
      state.cosmetics.vivariumScene = 'classic';
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
  _layout?.sync(el);
}

function _initLayout(viewport, bounds) {
  _layout = createVivariumLayout(viewport, { onBlocked(entry, position) {
    if (entry.interacting || !_residents.includes(entry)) return;
    _cancel(entry.timer);
    entry.el.style.transition = 'none';
    entry.x = position.x; entry.y = position.y;
    _setPosition(entry.el, entry.x, entry.y);
    _animate(entry, 'Idle');
    entry.el.classList.add('idle');
    entry.timer = _later(() => _wanderStep(entry, bounds), 600 + Math.random() * 700);
  } });
  if (devFeaturesEnabled()) {
    const layout = _layout, zone = _zoneEl;
    import('./vivariumDev.js').then(({ mountVivariumDev }) => {
      if (_layout !== layout || _zoneEl !== zone) return;
      _devPanel = mountVivariumDev({ zone, viewport, layout, bounds });
    }).catch(error => console.warn('[vivarium dev]', error));
  }
}

function _annotate(entry, node) {
  if (_layout) return _layout.annotate(entry, node);
  entry.el.appendChild(node);
  return () => node.remove();
}

function _flip(el, movingLeft) {
  const inner = el.querySelector('.gang-env-sprite-inner') || el;
  if (el._pmdAnimator) {
    // A loading/failed PMD sheet still displays the ordinary sprite. Only that
    // fallback may be mirrored; the directional canvas must never be mirrored.
    const fallback = inner.querySelector('img');
    if (fallback) fallback.style.scale = movingLeft ? '-1 1' : '1 1';
    return;
  }
  inner.style.transform = movingLeft ? 'scaleX(-1)' : 'scaleX(1)';
}

function _animate(entry, animation, dx = 0, dy = 0) {
  entry.animation = animation;
  entry.direction = directionFromVector(dx, dy, entry.direction || 0);
  entry.animator?.set(animation, entry.direction);
  _layout?.moving(entry, animation === 'Walk');
  if (dx || dy) _flip(entry.el, dx < 0);
}

// Swap the renderer only: preserve the resident, position, movement and badges.
function _applySpriteMode(entry) {
  entry.animator?.destroy();
  const inner = entry.el.querySelector('.gang-env-sprite-inner');
  inner.style.transform = '';
  const fallback = inner.querySelector('img');
  if (fallback) fallback.style.scale = '';
  entry.animator = _spriteMode === 'pmd' ? attachPmdSprite(inner, entry.data) : null;
  entry.el._pmdAnimator = entry.animator;
  entry.animator?.set(entry.animation || 'Idle', entry.direction || 0);
  _flip(entry.el, entry.direction >= 5 && entry.direction <= 7);
  _layout?.refresh(entry);
}

function _refreshSpriteModeHint() {
  const hint = _zoneEl?.querySelector('#gangSpriteModeHint');
  if (!hint) return;
  const count = _residents.filter(entry => entry.animator).length;
  const total = _residents.length;
  hint.hidden = _spriteMode !== 'pmd' || total === 0;
  hint.textContent = count
    ? _t(`${count}/${total} Pokémon compatibles Donjon Mystère`, `${count}/${total} Pokémon support Mystery Dungeon`)
    : _t('Pas de sprites Donjon Mystère pour ces Pokémon.', 'No Mystery Dungeon sprites for these Pokémon.');
  hint.title = _t('Les Pokémon sans animations Donjon Mystère disponibles conservent leurs sprites 2D.',
    'Pokémon without available Mystery Dungeon animations keep their 2D sprites.');
}

function _bindSpriteModeSelector(zoneEl) {
  const select = zoneEl.querySelector('#gangSpriteModeSelect');
  select.value = _spriteMode;
  select.addEventListener('change', () => {
    const nextMode = select.value === '2d' ? '2d' : 'pmd';
    if (nextMode === _spriteMode) return;
    _spriteMode = nextMode;
    const state = globalThis.state;
    state.cosmetics ||= {};
    state.cosmetics.vivariumSpriteMode = _spriteMode;
    globalThis.saveState();
    for (const entry of [..._residents, ..._pokemonCameos]) _applySpriteMode(entry);
    _refreshSpriteModeHint();
  });
}

function _freeze(entry) {
  const pos = _currentPos(entry.el);
  entry.el.style.transition = 'none';
  entry.x = pos.x; entry.y = pos.y;
  _setPosition(entry.el, pos.x, pos.y);
  _animate(entry, 'Idle');
}

function _watchBounds(viewportEl, bounds) {
  _bounds = bounds;
  if (typeof ResizeObserver === 'undefined') return;
  _resizeObserver = new ResizeObserver(() => {
    const rect = viewportEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const previousBounds = { ...bounds };
    bounds.width = rect.width;
    bounds.groundTop = rect.height * 0.35;
    bounds.groundHeight = rect.height * 0.55;
    for (const entry of _residents) {
      _freeze(entry);
      const before = _residentRange(entry, previousBounds), after = _residentRange(entry, bounds);
      const rx = Math.max(0, Math.min(1, (entry.x - before.minX) / Math.max(1, before.maxX - before.minX)));
      const ry = Math.max(0, Math.min(1, (entry.y - before.minY) / Math.max(1, before.maxY - before.minY)));
      entry.x = after.minX + rx * (after.maxX - after.minX);
      entry.y = after.minY + ry * (after.maxY - after.minY);
      _setPosition(entry.el, entry.x, entry.y);
      _layout?.refresh(entry);
      if (!entry.interacting) {
        _cancel(entry.timer);
        entry.timer = _later(() => _wanderStep(entry, bounds), 250);
      }
    }
    // Repack only where a narrower viewport actually made feet overlap.
    for (const entry of _residents) {
      const footprint = entry.animator?.footprint || DEFAULT_FOOTPRINT;
      const foot = { x: entry.x + 24, y: entry.y + 40, ...footprint };
      if (!_layout?.occupied(entry).some(other => groundClearance(foot, other) < 1)) continue;
      const next = _pickTarget(entry, bounds, false);
      entry.x = next.x; entry.y = next.y;
      _setPosition(entry.el, entry.x, entry.y);
      _layout.refresh(entry);
    }
  });
  _resizeObserver.observe(viewportEl);
}

function _dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function _currentPos(el) {
  return readSpritePosition(el);
}

function _residentRange(entry, bounds) {
  const inset = entry.animator?.insets || { left: 0, right: 0, bottom: 0 };
  const minX = Math.min(inset.left, Math.max(0, bounds.width - entry.w));
  return { minX, maxX: Math.max(minX, bounds.width - entry.w - inset.right),
    minY: bounds.groundTop,
    maxY: bounds.groundTop + Math.max(0, bounds.groundHeight - entry.h - inset.bottom) };
}

function _pickTarget(entry, bounds, seek = true) {
  return pickGroundTarget(_residentRange(entry, bounds), entry.animator?.footprint || DEFAULT_FOOTPRINT,
    _layout?.occupied(entry) || [], { seek });
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
  _animate(entry, 'Walk', targetX - entry.x, targetY - entry.y);
  entry.el.style.transition = `transform ${duration}s ease-in-out`;
  entry.x = targetX;
  entry.y = targetY;
  _setPosition(entry.el, targetX, targetY);

  entry.timer = _later(() => {
    if (!entry.el.isConnected) return;
    entry.el.classList.add('idle');
    _animate(entry, 'Idle');
    const pause = (WANDER_MIN_PAUSE_MS + Math.random() * (WANDER_MAX_PAUSE_MS - WANDER_MIN_PAUSE_MS)) * pauseMult;
    entry.timer = _later(() => _wanderStep(entry, bounds), pause);
  }, duration * 1000);
}

function _spawnResident(viewportEl, imgUrl, label, bounds, meta = {}) {
  const el = document.createElement('div');
  el.className = 'gang-env-sprite idle gang-env-clickable';
  el.title = label || '';
  el.innerHTML = `<div class="gang-env-sprite-inner"><img src="${imgUrl}" alt=""></div>`;
  const x = Math.random() * Math.max(0, bounds.width - 48);
  const y = bounds.groundTop + Math.random() * bounds.groundHeight;
  _setPosition(el, x, y);
  (_layout?.actorLayer || viewportEl).appendChild(el);

  const entry = {
    data: meta,
    el, x, y, w: 48, h: 48, label, level: meta.level, natureLabel: meta.natureLabel,
    interacting: false, lastPartner: null, lastInteractionAt: 0, lastClickAt: 0, timer: null,
  };
  _applySpriteMode(entry);
  const position = _pickTarget(entry, bounds, false);
  entry.x = position.x; entry.y = position.y;
  _setPosition(el, entry.x, entry.y);
  el.addEventListener('click', () => _onResidentClick(viewportEl, entry, bounds));
  _residents.push(entry);
  _layout?.register(entry, { yieldable: true });
  entry.timer = _later(() => _wanderStep(entry, bounds), 200 + Math.random() * 2000);
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
  const remove = _annotate(entry, badge);
  _later(remove, 2400);
}

function _onResidentClick(viewportEl, entry, bounds) {
  if (entry.interacting) return;
  const now = Date.now();
  if (now - (entry.lastClickAt || 0) < CLICK_REACTION_COOLDOWN_MS) return;
  entry.lastClickAt = now;

  _cancel(entry.timer);
  _freeze(entry);
  entry.interacting = true;
  entry.el.classList.add('idle', 'gang-env-clicked');

  _showClickBadge(entry);

  entry.timer = _later(() => {
    entry.el.classList.remove('gang-env-clicked');
    entry.interacting = false;
    if (!entry.el.isConnected) return;
    entry.timer = _later(() => _wanderStep(entry, bounds), 200 + Math.random() * 500);
  }, CLICK_PAUSE_MS);
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
  const remove = _annotate(entryA, badge);
  _later(remove, INTERACTION_BADGE_MS);
}

function _endInteraction(entry, bounds) {
  if (!_residents.includes(entry)) return;
  entry.interacting = false;
  entry.lastInteractionAt = Date.now();
  entry.el.classList.remove('gang-env-clicked');
  const pause = 300 + Math.random() * 800;
  entry.timer = _later(() => _wanderStep(entry, bounds), pause);
}

function _triggerInteraction(viewportEl, entryA, entryB, bounds) {
  if (entryA.interacting || entryB.interacting) return;
  const now = Date.now();
  if (entryA.lastPartner === entryB && now - entryA.lastInteractionAt < INTERACTION_COOLDOWN_MS) return;

  const kind = _pickInteractionKind();
  [entryA, entryB].forEach(e => {
    _cancel(e.timer);
    _freeze(e);
    e.interacting = true;
    e.el.classList.add('idle');
    if (kind.bounce) e.el.classList.add('gang-env-clicked');
  });
  entryA.lastPartner = entryB;
  entryB.lastPartner = entryA;

  _animate(entryA, 'Idle', entryB.x - entryA.x, entryB.y - entryA.y);
  _animate(entryB, 'Idle', entryA.x - entryB.x, entryA.y - entryB.y);

  _showInteractionBadge(entryA, kind);

  _later(() => {
    _endInteraction(entryA, bounds);
    _endInteraction(entryB, bounds);
  }, kind.pauseMs);
}

function _scheduleProximityScan(viewportEl, bounds) {
  _later(() => {
    if (!viewportEl.isConnected) return;
    // Read each actual CSS position once, then examine only nearby actors.
    const points = _residents.map((entry, order) => ({ ..._currentPos(entry.el), entry, order }));
    const index = groundIndex(points);
    for (const point of points) {
      for (const other of index.neighbors(point)) {
        if (other.order <= point.order) continue;
        const a = point.entry, b = other.entry;
        if (a.interacting || b.interacting) continue;
        if (_dist(point.x, point.y, other.x, other.y) < INTERACTION_DIST_PX) {
          _triggerInteraction(viewportEl, a, b, bounds);
        }
      }
    }
    _scheduleProximityScan(viewportEl, bounds);
  }, PROXIMITY_SCAN_MS);
}

function _spawnCameo(viewportEl, imgUrl, label, bounds, extraIconUrl, dialogueLine, hostile = false, pokemon = null, character = null) {
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
  (_layout?.actorLayer || viewportEl).appendChild(el);
  const cameo = { el, x: startX, y: baseY, w: 44, h: 44, label,
    data: pokemon || character, direction: fromLeft ? 2 : 6, animation: 'Walk' };
  if (pokemon) {
    _applySpriteMode(cameo);
    _pokemonCameos.add(cameo);
  } else if (character) {
    const inner = el.querySelector('.gang-env-sprite-inner');
    cameo.animator = attachCharacterSprite(inner, character);
    el._pmdAnimator = cameo.animator;
    if (cameo.animator) {
      inner.style.transform = '';
      el.classList.add('gang-env-character');
      _animate(cameo, 'Walk', fromLeft ? 1 : -1, 0);
    }
  }

  _layout?.register(cameo);

  const bubble = dialogueLine ? document.createElement('div') : null;
  if (bubble) {
    bubble.className = `gang-env-speech-bubble${hostile ? ' hostile' : ''}`;
    if (character && cameo.animator) {
      bubble.classList.add('with-portrait');
      const portrait = document.createElement('img');
      portrait.className = 'gang-env-speech-portrait';
      portrait.src = imgUrl;
      portrait.alt = '';
      portrait.onerror = () => portrait.remove();
      bubble.appendChild(portrait);
    }
    const text = document.createElement('span');
    text.textContent = dialogueLine;
    bubble.appendChild(text);
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
    cameo.x = x; cameo.y = y;

    el.classList.remove('idle');
    _animate(cameo, 'Walk', x - cur.x, y - cur.y);
    el.style.transition = `transform ${duration}s ease-in-out`;
    _setPosition(el, x, y);

    _later(() => {
      if (!el.isConnected) return;
      _animate(cameo, 'Idle');
      if (leg === bubbleLeg) {
        el.classList.add('idle');
        _annotate(cameo, bubble);
      }
      if (leg >= legs) {
        _later(() => { _layout?.unregister(cameo); cameo.animator?.destroy(); _pokemonCameos.delete(cameo); el.remove(); }, 300);
        return;
      }
      const shouldPause = leg === bubbleLeg || Math.random() < CAMEO_PAUSE_CHANCE;
      if (shouldPause) el.classList.add('idle');
      const pause = shouldPause
        ? CAMEO_PAUSE_MIN_MS + Math.random() * (CAMEO_PAUSE_MAX_MS - CAMEO_PAUSE_MIN_MS)
        : 80 + Math.random() * 200;
      _later(nextLeg, pause);
    }, duration * 1000);
  }

  _later(nextLeg, 0);
}

function _fireCameoFromPool(viewportEl, bounds, pool) {
  if (!pool || pool.length === 0) return;
  const entry = pool[Math.floor(Math.random() * pool.length)];
  const line = entry.lines?.length ? entry.lines[Math.floor(Math.random() * entry.lines.length)] : null;
  _spawnCameo(viewportEl, entry.spriteUrl, entry.label, bounds, entry.followIconUrl || null, line, !!entry.hostile,
    entry.type === 'favorite' ? entry : null, entry.type === 'favorite' ? null : entry);
}

function _scheduleCameos(viewportEl, bounds, poolProvider) {
  const delay = CAMEO_MIN_DELAY_MS + Math.random() * (CAMEO_MAX_DELAY_MS - CAMEO_MIN_DELAY_MS);
  _later(() => {
    if (!viewportEl.isConnected) return;
    if (Math.random() < CAMEO_SPAWN_CHANCE) _fireCameoFromPool(viewportEl, bounds, poolProvider());
    _scheduleCameos(viewportEl, bounds, poolProvider);
  }, delay);
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
  _spriteMode = globalThis.state?.cosmetics?.vivariumSpriteMode === '2d' ? '2d' : 'pmd';
  _zoneEl = zoneEl;

  zoneEl.innerHTML = `
    <div class="gang-sprite-mode-control">
      <label for="gangSpriteModeSelect">${_t('Sprites du vivarium', 'Vivarium sprites')}</label>
      <select id="gangSpriteModeSelect">
        <option value="2d">2D</option>
        <option value="pmd">${_t('Donjon Mystère', 'Mystery Dungeon')}</option>
      </select>
      <span class="gang-sprite-mode-hint" id="gangSpriteModeHint" hidden></span>
      <label for="gangSceneSelect">${_t('Décor', 'Scene')}</label>
      <select id="gangSceneSelect"><option value="hq">QG</option><option value="classic">${_t('Fond personnalisé', 'Custom background')}</option></select>
    </div>
    <button class="gang-zonebg-btn" id="gangZoneBgBtn" title="${_t('Changer le fond', 'Change background')}">🎨</button>
    <button class="gang-zonesrc-btn" id="gangZoneSrcBtn" title="${_t('Choisir les zones affichées', 'Choose displayed zones')}">👁</button>
    <div class="gang-env-viewport" id="gangEnvViewport"></div>
    <a class="gang-env-credits" href="https://eeveeexpo.com/resources/609/" target="_blank" rel="noopener noreferrer">${_t('Personnages', 'Characters')} : PurpleZaffre</a>`;

  const viewportEl = zoneEl.querySelector('#gangEnvViewport');
  _bindSpriteModeSelector(zoneEl);
  _applyZoneBackground(viewportEl);
  const sceneSelect = zoneEl.querySelector('#gangSceneSelect');
  sceneSelect.value = wantsHq(globalThis.state) ? 'hq' : 'classic';
  sceneSelect.addEventListener('change', () => {
    globalThis.state.cosmetics.vivariumScene = sceneSelect.value;
    globalThis.saveState();
    renderEnvironmentZone(rootContainer);
  });
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

  _watchBounds(viewportEl, bounds);
  _initLayout(viewportEl, bounds);
  const residents = buildVivariumResidents(state);
  for (const r of residents) {
    _spawnResident(viewportEl, r.spriteUrl, r.label, bounds, r);
  }
  _refreshSpriteModeHint();

  if (residents.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'gang-env-empty-hint';
    empty.textContent = _t(
      'Ajoutez des Pokémon à une zone activée (👁) pour les voir se balader ici.',
      'Add Pokémon to an active zone (👁) to see them roam here.'
    );
    viewportEl.appendChild(empty);
  }
  _scheduleProximityScan(viewportEl, bounds);

  _scheduleCameos(viewportEl, bounds, () => buildVivariumCameoPool(globalThis.state));
}

// ════════════════════════════════════════════════════════════════
//  Variante distante — consomme un blob déjà résolu (Supabase) au lieu de
//  `globalThis.state`. Aucun picker (fond/sources) : lecture seule, rien à
//  écrire nulle part. Appelée par gang/live-app.js.
//
//  blob attendu : { residents: [{id?,dex?,shiny?,spriteUrl,label,level,natureLabel}],
//                    cameoPool: [{type,spriteUrl,label,followIconUrl?,
//                                 lines,hostile?}], backgroundData }
// ════════════════════════════════════════════════════════════════
export function renderEnvironmentZoneFromSnapshot(rootContainer, blob) {
  const zoneEl = rootContainer.querySelector('#gangEnvironmentZone');
  if (!zoneEl) return;
  stopEnvironmentZone();
  _spriteMode = 'pmd'; // OBS stays independent of the local page's preference.
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

  _watchBounds(viewportEl, bounds);
  _initLayout(viewportEl, bounds);
  const residents = blob?.residents || [];
  for (const r of residents) {
    _spawnResident(viewportEl, r.spriteUrl, r.label, bounds, r);
  }

  if (residents.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'gang-env-empty-hint';
    // Rendu distant (OBS) : pas de state disponible — EN par défaut.
    empty.textContent = 'No residents to display for now.';
    viewportEl.appendChild(empty);
  }
  _scheduleProximityScan(viewportEl, bounds);

  _scheduleCameos(viewportEl, bounds, () => _liveCameoPool);
}

export function updateEnvironmentSnapshot(blob) {
  if (!_zoneEl || !_zoneEl.isConnected) return;
  const viewportEl = _zoneEl.querySelector('#gangEnvViewport');
  if (!viewportEl) return;

  _liveCameoPool = blob?.cameoPool || [];
  if (blob?.backgroundData) _applyBackgroundData(viewportEl, blob.backgroundData);

  // Reconcile by stable Pokémon id; older snapshots use display identity + index.
  // Preserve DOM, position, direction and animation phase across identical polls.
  const residents = blob?.residents || [];
  const key = (data, index) => data.id != null ? `id:${data.id}` : `legacy:${index}:${data.spriteUrl}:${data.label}`;
  const existing = new Map(_residents.map((entry, i) => [key(entry.data, i), entry]));
  const next = [];
  viewportEl.querySelector('.gang-env-empty-hint')?.remove();
  for (const [i, data] of residents.entries()) {
    let entry = existing.get(key(data, i));
    existing.delete(key(data, i));
    if (entry && (entry.data.dex !== data.dex || entry.data.shiny !== data.shiny || entry.data.spriteUrl !== data.spriteUrl)) {
      _cancel(entry.timer); _layout?.unregister(entry); entry.animator?.destroy(); entry.el.remove(); entry = null;
    }
    if (!entry) entry = _spawnResident(viewportEl, data.spriteUrl, data.label, _bounds, data);
    entry.data = data;
    entry.label = data.label; entry.level = data.level; entry.natureLabel = data.natureLabel;
    entry.el.title = data.label || '';
    next.push(entry);
  }
  for (const entry of existing.values()) {
    _cancel(entry.timer); _layout?.unregister(entry); entry.animator?.destroy(); entry.el.remove();
  }
  _residents = next;
  if (residents.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'gang-env-empty-hint';
    empty.textContent = 'No residents to display for now.';
    viewportEl.appendChild(empty);
  }
}
