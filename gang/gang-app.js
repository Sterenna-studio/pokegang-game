'use strict';

// ════════════════════════════════════════════════════════════════
//  gang-app.js — boot minimal de la page cosmétique séparée
//  (pokegang.sterenna.fr/gang/)
//
//  Contrairement à app.js, ce boot NE démarre PAS le TickManager /
//  Scheduler / systèmes de zones-agents-combat : uniquement le
//  chargement/sauvegarde du même save (localStorage['pokeforge.v6'],
//  partagé par la même origine avec le jeu principal) et le rendu des
//  panneaux cosmétiques.
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../modules/core/eventBus.js';
import { createStore } from '../state/store.js';
import '../modules/ui/cosmetics.js'; // side-effect: expose applyCosmetics() sur globalThis
import '../modules/core/sprites.js';  // side-effect: expose pokeSprite/pokeIcon/trainerSprite/... sur globalThis
import {
  COSMETIC_BGS, FABRIC_SPECIES, PATCH_PIDS, fabricBgUrl, patchUrl,
} from '../data/zones-visuals-data.js';
import {
  SHOWCASE_SLOTS, BOSS_TEAM_SLOTS, AGENT_RANK_LABELS, NATURES,
} from '../data/game-config-data.js';
import { BALL_SPRITES, EGG_SPRITES } from '../data/assets-data.js';
import { BALLS, SHOP_ITEMS } from '../data/economy-data.js';
import { GYM_ORDER, JOHTO_GYM_ORDER, HOENN_GYM_ORDER, SINNOH_GYM_ORDER } from '../data/zones-config-data.js';
import { TRAINER_TYPES } from '../data/trainers-data.js';

import { renderMusicPanel, renderAppearancePanel, renderTitrePanel, renderVitrinePanel } from './panels.js';
import { renderEnvironmentZone, stopEnvironmentZone } from './environment.js';

// sprites.js expose ses fonctions via Object.assign(globalThis, {...}) plutôt
// que des exports nommés (même patron que cosmetics.js) — on les relit ici.
const { pokeSprite, pokeIcon, trainerSprite, speciesName, pokemonDisplayName } = globalThis;

// ── Toast (équivalent minimal de notify()) ───────────────────────
function notify(msg, type = '') {
  const host = document.getElementById('gangToastHost');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `gang-toast${type ? ' gang-toast-' + type : ''}`;
  el.textContent = msg;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 2600);
}

// ── Confirm modal (équivalent minimal de showConfirm()) ──────────
function showConfirm(message, onConfirm, onCancel = null, opts = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'gang-confirm-overlay';
  overlay.innerHTML = `
    <div class="gang-confirm-box">
      <div class="gang-confirm-msg">${message}</div>
      <div class="gang-confirm-actions">
        <button class="gang-confirm-cancel">${opts.cancelLabel || 'Annuler'}</button>
        <button class="gang-confirm-ok">${opts.confirmLabel || 'Confirmer'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.gang-confirm-ok').addEventListener('click', () => { overlay.remove(); onConfirm?.(); });
  overlay.querySelector('.gang-confirm-cancel').addEventListener('click', () => { overlay.remove(); onCancel?.(); });
  overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); onCancel?.(); } });
}

// SFX : la page cosmétique n'embarque pas le lecteur de sons du jeu — no-op.
const SFX = { play() {} };

// ── isZoneUnlocked (portée depuis modules/systems/zoneSystem.js:145) ─────
function isZoneUnlocked(zoneId) {
  const state = globalThis.state;
  const zone = ZONE_BY_ID[zoneId];
  if (!zone) return false;
  const zoneState = state.zones[zoneId];
  const wasPreviouslyAccessed = zoneState && (
    zoneState.unlocked === true || zoneState.combatsWon > 0 || zoneState.captures > 0
  );
  if (wasPreviouslyAccessed) {
    if (zone.unlockItem && !state.purchases?.[zone.unlockItem]) return false;
    return true;
  }
  if (state.gang.reputation < zone.rep) return false;
  if (zone.unlockItem && !state.purchases?.[zone.unlockItem]) return false;
  // Villes (arènes) : déblocage séquentiel — l'arène précédente de la même
  // région doit être battue (branche absente du portage initial, cf.
  // modules/systems/zoneSystem.js:165-184).
  if (zone.type === 'city') {
    const allOrders = [SINNOH_GYM_ORDER, HOENN_GYM_ORDER, JOHTO_GYM_ORDER, GYM_ORDER];
    for (const order of allOrders) {
      if (!order) continue;
      const idx = order.indexOf(zoneId);
      if (idx < 0) continue;
      if (idx > 0) {
        const prevId = order[idx - 1];
        if (!state.zones[prevId]?.gymDefeated) return false;
      }
      break;
    }
  }
  return true;
}

// ════════════════════════════════════════════════════════════════
//  Store — mêmes localStorage['pokeforge.v6'] que le jeu principal
// ════════════════════════════════════════════════════════════════
const store = createStore({
  localStorageRef: window.localStorage,
  notify,
  speciesByEn: typeof SPECIES_BY_EN !== 'undefined' ? SPECIES_BY_EN : {},
});

let state = store.load();
if (!state) {
  // store.load() renvoie null aussi bien quand la clé est absente que quand
  // son contenu est illisible (JSON.parse/migrateSave en échec, loggé en
  // console par le store) — on relit la clé brute nous-mêmes pour distinguer
  // les deux cas et ne pas orienter le joueur vers "relancez le jeu" quand
  // le vrai problème est une sauvegarde corrompue qui a besoin d'un import.
  const rawExists = !!window.localStorage.getItem(store.getSaveKey());
  const message = rawExists
    ? `Sauvegarde illisible ou corrompue. Relancez le jeu principal pour voir le détail de l'erreur — une restauration depuis un export ou le cloud sera peut-être nécessaire.`
    : `Aucune sauvegarde trouvée. Lancez d'abord le jeu principal, puis revenez ici.`;
  document.getElementById('gangPanelBody').innerHTML = `
    <div class="gang-empty-state">
      ${message}
      <br><a href="../index.html">← Lancer PokéGang</a>
    </div>`;
  throw new Error(`[gang] ${rawExists ? 'corrupted save' : 'no save found'}`);
}

// Écriture prudente : relit le localStorage à froid juste avant d'écrire,
// pour réduire (sans l'éliminer) le risque d'écraser une progression faite
// entre-temps dans l'onglet principal resté ouvert — cette page ne modifie
// jamais autre chose que les champs cosmétiques (cosmetics/showcase/titre/
// jukebox), donc un rechargement + ré-application de ces seuls champs avant
// écriture couvre l'essentiel des cas réels.
function saveState() {
  const fresh = store.load();
  if (fresh) {
    fresh.cosmetics = state.cosmetics;
    fresh.gang.showcase = state.gang.showcase;
    fresh.gang.titleA = state.gang.titleA;
    fresh.gang.titleB = state.gang.titleB;
    fresh.gang.titleC = state.gang.titleC;
    fresh.gang.titleD = state.gang.titleD;
    fresh.gang.titleLiaison = state.gang.titleLiaison;
    fresh.gang.money = state.gang.money;
    fresh.purchases = state.purchases;
    fresh.activeBall = state.activeBall;
    fresh.settings.jukeboxTrack = state.settings.jukeboxTrack;
    state = fresh;
    // Sans ceci, globalThis.state (seule référence lue/mutée par les
    // panneaux) et cette variable locale `state` divergent après la
    // première sauvegarde de la session : les champs primitifs (argent,
    // titres, piste jukebox) cesseraient silencieusement d'être relus par
    // saveState() à chaque appel suivant (les champs objet/tableau comme
    // cosmetics restent aliasés et donc corrects par accident, mais pas
    // les primitives réassignées).
    globalThis.state = fresh;
  }
  store.save();
  updateTopbar();
}

function updateTopbar() {
  document.getElementById('gangTopbarMoney').textContent = `${(state.gang.money || 0).toLocaleString()}₽`;
}

// ════════════════════════════════════════════════════════════════
//  Exposition globale — même convention que app.js (Object.assign)
// ════════════════════════════════════════════════════════════════
Object.assign(globalThis, {
  state, EventBus, EVENTS, notify, showConfirm, SFX, saveState, isZoneUnlocked,
  pokeSprite, pokeIcon, trainerSprite, speciesName, pokemonDisplayName,
  COSMETIC_BGS, FABRIC_SPECIES, PATCH_PIDS, fabricBgUrl, patchUrl,
  SHOWCASE_SLOTS, BOSS_TEAM_SLOTS, AGENT_RANK_LABELS, BALL_SPRITES, BALLS, SHOP_ITEMS, NATURES,
  EGG_SPRITES, TRAINER_TYPES,
});

EventBus.on(EVENTS.UI_NOTIFY, ({ msg, type }) => notify(msg, type));

// ════════════════════════════════════════════════════════════════
//  Navigation par panneaux
// ════════════════════════════════════════════════════════════════
const PANELS = [
  { id: 'appearance', icon: '🖼', label: 'Apparence', render: renderAppearancePanel },
  { id: 'music',      icon: '🎵', label: 'Musique',   render: renderMusicPanel },
  { id: 'titre',      icon: '🏆', label: 'Titre',     render: renderTitrePanel },
  { id: 'vitrine',    icon: '🏛', label: 'Vitrine',   render: renderVitrinePanel },
];

let activePanel = 'vitrine';

function renderNav() {
  const nav = document.getElementById('gangPanelNav');
  nav.innerHTML = PANELS.map(p => `
    <button class="gang-nav-btn${p.id === activePanel ? ' active' : ''}" data-panel="${p.id}">
      <span>${p.icon}</span> ${p.label}
    </button>`).join('');
  nav.querySelectorAll('[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
  });
}

function switchPanel(panelId) {
  if (activePanel === 'vitrine' && panelId !== 'vitrine') stopEnvironmentZone();
  activePanel = panelId;
  renderNav();
  const body = document.getElementById('gangPanelBody');
  const panel = PANELS.find(p => p.id === panelId);
  panel.render(body);
  if (panelId === 'vitrine') renderEnvironmentZone(body);
}

// ════════════════════════════════════════════════════════════════
//  Boot
// ════════════════════════════════════════════════════════════════
updateTopbar();
renderNav();
switchPanel(activePanel);
