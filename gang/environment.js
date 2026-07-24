'use strict';

// ════════════════════════════════════════════════════════════════
//  environment.js — zone d'environnement animée ("vivarium") où se
//  baladent les Pokémon de la vitrine, l'équipe active du boss, et
//  occasionnellement un agent ou un Pokémon favori du Pokédex.
//
//  v1 volontairement simple (explicitement "test") : pas de canvas,
//  pas de pathfinding — juste des sprites positionnés en absolu dont
//  la position cible change périodiquement via une transition CSS.
//
//  Dépendances globalThis : state, saveState, pokeSprite, trainerSprite,
//    COSMETIC_BGS, fabricBgUrl, SHOWCASE_SLOTS
// ════════════════════════════════════════════════════════════════

const CAMEO_MIN_DELAY_MS = 45_000;
const CAMEO_MAX_DELAY_MS = 90_000;
const CAMEO_SPAWN_CHANCE = 0.5;
const WANDER_MIN_PAUSE_MS = 1500;
const WANDER_MAX_PAUSE_MS = 4500;
const WANDER_PX_PER_SEC   = 40;

let _timers = [];        // tous les setTimeout actifs — nettoyés par stopEnvironmentZone()
let _zoneEl  = null;

function _track(id) { _timers.push(id); return id; }

export function stopEnvironmentZone() {
  _timers.forEach(clearTimeout);
  _timers = [];
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

// ── Déplacement — wander périodique simple ───────────────────────────────
function _flip(el, movingLeft) {
  el.style.transform = movingLeft ? 'scaleX(-1)' : 'scaleX(1)';
}

function _wanderStep(el, bounds) {
  if (!el.isConnected) return; // sprite retiré (changement de panneau) — arrêter la chaîne
  const curX = parseFloat(el.style.left) || 0;
  const maxX = Math.max(0, bounds.width - el.offsetWidth);
  const maxY = Math.max(0, bounds.groundHeight - el.offsetHeight);
  const targetX = Math.random() * maxX;
  const targetY = bounds.groundTop + Math.random() * maxY;
  const dist = Math.abs(targetX - curX);
  const duration = Math.max(1.2, dist / WANDER_PX_PER_SEC);

  _flip(el, targetX < curX);
  el.style.transition = `left ${duration}s ease-in-out, top ${duration}s ease-in-out`;
  el.style.left = `${targetX}px`;
  el.style.top = `${targetY}px`;

  _track(setTimeout(() => {
    if (!el.isConnected) return;
    const pause = WANDER_MIN_PAUSE_MS + Math.random() * (WANDER_MAX_PAUSE_MS - WANDER_MIN_PAUSE_MS);
    _track(setTimeout(() => _wanderStep(el, bounds), pause));
  }, duration * 1000));
}

function _spawnResident(viewportEl, imgUrl, label, bounds) {
  const el = document.createElement('div');
  el.className = 'gang-env-sprite';
  el.title = label || '';
  el.innerHTML = `<img src="${imgUrl}" alt="">`;
  el.style.left = `${Math.random() * Math.max(0, bounds.width - 48)}px`;
  el.style.top  = `${bounds.groundTop + Math.random() * bounds.groundHeight}px`;
  viewportEl.appendChild(el);
  _track(setTimeout(() => _wanderStep(el, bounds), 200 + Math.random() * 2000));
  return el;
}

// ── Cameo — agent ou pokémon favori qui traverse une fois puis disparaît ──
function _spawnCameo(viewportEl, imgUrl, label, bounds, extraIconUrl) {
  const el = document.createElement('div');
  el.className = 'gang-env-sprite gang-env-cameo';
  el.title = label || '';
  el.innerHTML = `<img src="${imgUrl}" alt="">${extraIconUrl ? `<img class="gang-env-cameo-follow" src="${extraIconUrl}" alt="">` : ''}`;
  const fromLeft = Math.random() < 0.5;
  const startX = fromLeft ? -60 : bounds.width + 60;
  const endX   = fromLeft ? bounds.width + 60 : -60;
  const y = bounds.groundTop + Math.random() * bounds.groundHeight;
  el.style.left = `${startX}px`;
  el.style.top  = `${y}px`;
  _flip(el, !fromLeft);
  viewportEl.appendChild(el);

  requestAnimationFrame(() => {
    const duration = Math.max(4, bounds.width / WANDER_PX_PER_SEC);
    el.style.transition = `left ${duration}s linear`;
    el.style.left = `${endX}px`;
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
        _spawnCameo(viewportEl, globalThis.trainerSprite(agent.sprite || agent.spriteKey), agent.name, bounds, followIcon);
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
    if (pk) _spawnResident(viewportEl, globalThis.pokeSprite(pk.species_en, pk.shiny), globalThis.pokemonDisplayName?.(pk) || pk.species_en, bounds);
  }
  const activeSlot = state.gang.bossTeamSlots?.[state.gang.activeBossTeamSlot || 0] || [];
  for (const id of activeSlot) {
    if (showcaseIds.includes(id)) continue; // évite un doublon si le même pokémon est aussi en vitrine
    const pk = state.pokemons.find(p => p.id === id);
    if (pk) _spawnResident(viewportEl, globalThis.pokeSprite(pk.species_en, pk.shiny), globalThis.pokemonDisplayName?.(pk) || pk.species_en, bounds);
  }

  if (showcaseIds.length === 0 && activeSlot.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'gang-env-empty-hint';
    empty.textContent = 'Ajoutez des Pokémon à la vitrine pour les voir se balader ici.';
    viewportEl.appendChild(empty);
  }

  _scheduleCameos(viewportEl, bounds);
}
