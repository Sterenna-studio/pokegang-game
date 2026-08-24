'use strict';

import { esc } from '../core/escape.js';
import { FALLBACK_TRAINER_SVG, LOGO_SMALL_URL } from '../../data/assets-data.js';
import { ONBOARDING_STEPS, normalizeOnboardingState } from '../systems/onboardingFlow.js';
import { detectPlatform } from '../systems/analytics.js';

const AUTO_START_DELAY_MS = 2000;

let _ctx = {};
let _bound = false;
let _showcaseInterval = null;
let _autoStartTimer = 0;

export function configureHub(ctx = {}) {
  _ctx = { ..._ctx, ...ctx };
}

const _t = (fr, en) => (_ctx.getState?.()?.lang === 'en' ? en : fr);
const _trainerSprite = name => _ctx.trainerSprite?.(name)
  || `https://play.pokemonshowdown.com/sprites/trainers/${name}.png`;

function _stopShowcase() {
  if (_showcaseInterval) clearInterval(_showcaseInterval);
  _showcaseInterval = null;
}

function _startShowcase() {
  const scenes = [
    () => `<div class="intro-scene-title">${_t('Capturez des Pokémon rares', 'Catch rare Pokémon')}</div>
      <div class="intro-scene-sprites intro-scene-sprites-col"><img src="${_ctx.pokeSprite?.('pikachu') || ''}" class="intro-scene-poke-img"><div class="intro-scene-pokeball">⚪</div></div>
      <div class="intro-scene-desc">${_t("Des centaines d'espèces à attraper", 'Hundreds of species to catch')}</div>`,
    () => `<div class="intro-scene-title">${_t('Combattez des Dresseurs', 'Battle Trainers')}</div>
      <div class="intro-scene-sprites intro-scene-vs-row"><div><img src="${_trainerSprite('red')}" class="intro-scene-trainer-img intro-scene-trainer-img-left"><div class="intro-hp-bar"><div class="intro-hp-fill intro-hp-demo-a"></div></div></div><div class="intro-scene-vs-label">VS</div><div><img src="${_trainerSprite('lance')}" class="intro-scene-trainer-img intro-scene-trainer-img-right"><div class="intro-hp-bar"><div class="intro-hp-fill intro-hp-demo-b"></div></div></div></div>
      <div class="intro-scene-desc">${_t('Montez en puissance et dominez', 'Grow stronger and dominate')}</div>`,
    () => `<div class="intro-scene-title">${_t('Développez votre Gang', 'Grow your Gang')}</div>
      <div class="intro-scene-sprites intro-scene-gang-row"><img src="${_trainerSprite('giovanni')}" class="intro-scene-gang-img"><div class="intro-scene-gang-stats"><div class="intro-scene-gang-label">${_t('RÉPUTATION', 'REPUTATION')}</div><div class="intro-scene-gang-value">1 337</div><div class="intro-scene-gang-meta">${_t('Agents : 5 · Zones : 4', 'Agents: 5 · Zones: 4')}</div></div></div>
      <div class="intro-scene-desc">${_t('Conquiers Kanto, un territoire à la fois', 'Conquer Kanto, one territory at a time')}</div>`,
  ];
  let sceneIndex = 0;
  const render = () => {
    const container = document.getElementById('introSceneContainer');
    if (!container) return;
    container.innerHTML = scenes[sceneIndex]();
    container.style.animation = 'none';
    container.offsetHeight;
    container.style.animation = 'sceneIn .4s ease';
    document.querySelectorAll('#introSceneDots .intro-dot').forEach((dot, index) => dot.classList.toggle('active', index === sceneIndex));
  };
  _stopShowcase();
  render();
  _showcaseInterval = setInterval(() => {
    sceneIndex = (sceneIndex + 1) % scenes.length;
    render();
  }, 3000);
}

function _isOnboardingPreview(preview) {
  if (!preview) return false;
  const onboarding = normalizeOnboardingState(preview.onboarding);
  return onboarding.step !== ONBOARDING_STEPS.NOT_STARTED && onboarding.step !== ONBOARDING_STEPS.COMPLETED;
}

// ── Démarrage auto d'une première partie (itch uniquement) ─────────
// Un joueur qui arrive depuis la page itch.io s'attend à jouer tout de
// suite, pas à choisir un slot. Pure (aucun accès DOM/état direct) pour
// être testable sans navigateur ; le site principal n'en profite pas
// (l'écran de sauvegardes y a un vrai rôle pour un joueur qui revient).
export function shouldAutoStartFirstGame(platform, hasAnySave) {
  return platform === 'itch' && !hasAnySave;
}

function _cancelAutoStart() {
  if (!_autoStartTimer) return;
  clearTimeout(_autoStartTimer);
  _autoStartTimer = 0;
}

function _maybeScheduleAutoStart() {
  _cancelAutoStart();
  const hasAnySave = [0, 1, 2].some(index => !!_ctx.getSlotPreview?.(index));
  if (!shouldAutoStartFirstGame(detectPlatform(), hasAnySave)) return;
  _autoStartTimer = setTimeout(() => {
    _autoStartTimer = 0;
    _stopShowcase();
    _ctx.startOnboarding?.({ slotIdx: 0, resume: false });
  }, AUTO_START_DELAY_MS);
}

function _renderSlots() {
  const slotsContainer = document.getElementById('introSlots');
  if (!slotsContainer) return;
  slotsContainer.innerHTML = [0, 1, 2].map(index => {
    const preview = _ctx.getSlotPreview?.(index);
    if (!preview) {
      return `<div class="intro-slot-card empty" data-slot="${index}" data-empty="1">
        <div class="isc-left"><div class="isc-slot-label">SLOT ${index + 1}</div><div class="isc-empty-icon">💾</div></div>
        <div class="isc-info"><div class="isc-empty-hint">${_t('Vide — cliquer pour nouvelle partie', 'Empty — click to start a new game')}</div></div>
        <div class="isc-actions"><button class="isc-btn isc-new" data-slot="${index}" title="${_t('Sélectionner', 'Select')}">✓</button></div>
      </div>`;
    }
    const inOnboarding = _isOnboardingPreview(preview);
    const date = preview.ts ? new Date(preview.ts).toLocaleDateString(_t('fr-FR', 'en-US'), { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
    const team = (preview.teamSprites || []).map(species => `<img class="isc-mini" src="${_ctx.pokeSprite?.(species) || ''}" alt="${esc(species)}" onerror="this.style.display='none'">`).join('');
    const agents = (preview.agentSprites || []).map(url => `<img class="isc-mini" src="${url}" alt="" onerror="this.style.display='none'">`).join('');
    return `<div class="intro-slot-card has-data" data-slot="${index}">
      <div class="isc-left"><div class="isc-slot-label">SLOT ${index + 1}</div><div class="isc-boss-wrap">
        ${preview.bossSprite ? `<img src="${_trainerSprite(preview.bossSprite)}" class="isc-boss-img" alt="${esc(preview.bossSprite)}" onerror="this.src='${FALLBACK_TRAINER_SVG}';this.onerror=null">` : '<div class="isc-boss-img-placeholder"></div>'}
        <span class="isc-boss-badge"><img src="${LOGO_SMALL_URL}" alt=""></span></div></div>
      <div class="isc-info">
        <div class="isc-gang-name">${inOnboarding ? _t('Opération en cours…', 'Operation in progress…') : esc(preview.name)}</div>
        <div class="isc-boss-name">${inOnboarding ? _t('Reprendre la première mission', 'Resume the first mission') : `${_t('Boss :', 'Boss:')} ${esc(preview.bossName || '—')} · ${preview.agentCount || 0} ${_t('agent' + ((preview.agentCount || 0) > 1 ? 's' : ''), 'agent' + ((preview.agentCount || 0) > 1 ? 's' : ''))}`}</div>
        <div class="isc-meta">${preview.pokemon} Pkm · ₽${(preview.money || 0).toLocaleString()} · ⭐${preview.rep}</div>
        <div class="isc-date">${date}${preview.playtime ? ` · ${_ctx.formatPlaytime?.(preview.playtime) || ''}` : ''}</div>
        <div class="isc-sprites-row"><div class="isc-sprites-group"><span class="isc-sprites-label">${_t('Équipe', 'Team')}</span>${team || '<span class="isc-sprites-empty">—</span>'}</div>${agents ? `<div class="isc-sprites-group isc-sprites-group-agents"><span class="isc-sprites-label">${_t('Agents', 'Agents')}</span>${agents}</div>` : ''}</div>
      </div>
      <div class="isc-actions"><button class="isc-btn isc-play" data-slot="${index}" title="${inOnboarding ? _t('Reprendre', 'Resume') : _t('Jouer', 'Play')}">▶</button><button class="isc-btn isc-del" data-slot="${index}" title="${_t('Supprimer', 'Delete')}">🗑</button></div>
    </div>`;
  }).join('');

  slotsContainer.querySelectorAll('.isc-play').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    const slotIdx = Number(button.dataset.slot);
    const preview = _ctx.getSlotPreview?.(slotIdx);
    _ctx.loadSlot?.(slotIdx);
    if (_isOnboardingPreview(preview)) {
      _stopShowcase();
      _ctx.startOnboarding?.({ slotIdx, resume: true });
      return;
    }
    _stopShowcase();
    document.getElementById('introOverlay')?.classList.remove('active');
    _ctx.renderAll?.();
  }));

  slotsContainer.querySelectorAll('.isc-del').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    const slotIdx = Number(button.dataset.slot);
    _ctx.showConfirm?.(_t(
      `Supprimer la sauvegarde Slot ${slotIdx + 1} ?<br><span class="isc-confirm-sub">Cette action est irréversible.</span>`,
      `Delete the save in Slot ${slotIdx + 1}?<br><span class="isc-confirm-sub">This action cannot be undone.</span>`,
    ), () => {
      _ctx.removeSlot?.(slotIdx);
      if (slotIdx === _ctx.getActiveSaveSlot?.()) _ctx.setActiveSaveSlot?.(0);
      _renderSlots();
    }, null, { danger: true, confirmLabel: _t('Supprimer', 'Delete'), cancelLabel: _t('Annuler', 'Cancel') });
  }));

  slotsContainer.querySelectorAll('.intro-slot-card.empty').forEach(element => element.addEventListener('click', () => {
    const slotIdx = Number(element.dataset.slot);
    if (Number.isInteger(slotIdx)) {
      _stopShowcase();
      _ctx.startOnboarding?.({ slotIdx, resume: false });
    }
  }));
}

function _bindOnce() {
  if (_bound) return;
  _bound = true;
  // Un joueur qui touche quoi que ce soit dans le hub a déjà pris la main —
  // le départ auto ne doit plus lui couper l'herbe sous le pied. Capture sur
  // l'overlay entier plutôt qu'un listener par bouton/slot (ceux-ci sont
  // reconstruits à chaque _renderSlots()).
  document.getElementById('introOverlay')?.addEventListener('click', _cancelAutoStart, true);
  document.getElementById('introSettingsBtn')?.addEventListener('click', () => _ctx.openSettingsModal?.());
  document.getElementById('introStartGameBtn')?.addEventListener('click', () => {
    const freeSlot = [0, 1, 2].find(index => !_ctx.getSlotPreview?.(index));
    if (freeSlot === undefined) {
      _ctx.notify?.(_t('Tous les emplacements sont pleins — supprime une sauvegarde pour commencer une nouvelle partie.', 'All save slots are full — delete a save to start a new game.'), 'error');
      return;
    }
    _stopShowcase();
    _ctx.startOnboarding?.({ slotIdx: freeSlot, resume: false });
  });
  document.getElementById('btnHubRepairSlot')?.addEventListener('click', () => _ctx.openHubSlotRepairModal?.());
  document.getElementById('btnHubImportSave')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = event => {
        try { _ctx.openHubImportModal?.(JSON.parse(event.target.result)); }
        catch { _ctx.notify?.(_t('Fichier invalide — impossible de lire la sauvegarde.', 'Invalid file — could not read the save.'), 'error'); }
      };
      reader.readAsText(file);
    });
    input.click();
  });
}

export function showIntro() {
  const overlay = document.getElementById('introOverlay');
  if (!overlay) return;
  overlay.classList.add('active');
  document.getElementById('introSettingsBtn')?.setAttribute('title', _t('Paramètres', 'Settings'));
  const text = (selector, value) => { const element = overlay.querySelector(selector); if (element) element.textContent = value; };
  text('.intro-tagline', _t('Prends le contrôle de Kanto.', 'Take control of Kanto.'));
  text('#introStartGameBtn', _t('▶ Commencer une partie', '▶ Start a game'));
  text('.intro-saves-label', _t('SAUVEGARDES', 'SAVES'));
  text('.intro-saves-hint', _t('Choisis ou crée une partie', 'Choose or create a game'));
  text('#btnHubImportSave', _t('📥 Importer une save', '📥 Import a save'));
  text('#btnHubRepairSlot', _t('🔧 Réparer une save', '🔧 Repair save'));
  _bindOnce();
  _renderSlots();
  _startShowcase();
  _maybeScheduleAutoStart();
}
