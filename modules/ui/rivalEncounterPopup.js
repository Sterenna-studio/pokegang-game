'use strict';

// ════════════════════════════════════════════════════════════════
//  rivalEncounterPopup.js — mur narratif du Pokédex
//
//  Avant ce système, l'onglet Pokédex s'ouvrait à la 1ère capture — un seuil
//  si bas qu'il n'apportait aucune raison de s'y intéresser. Ici, au 5e combat
//  de zone gagné après l'onboarding, le transfuge reconnaît un dresseur
//  ("suivi depuis le labo") et propose un choix à 3 (agent seul / à deux /
//  joueur seul) qui ne change que la réplique de fin — le combat en lui-même
//  est toujours gagnable (un simple Roucoul niveau 3). À l'issue, le
//  Pokédex volé au vaincu débloque réellement l'onglet — data/tab-unlocks-
//  data.js lit state.discoveryProgress.rivalPokedexUnlocked via la règle
//  'flag' de modules/systems/tabUnlocks.js.
//
//  Une save qui avait déjà le Pokédex débloqué sous l'ancienne règle
//  (`isTabRevealed`) ne voit jamais cette scène : evaluateTabUnlocks()
//  n'enlève jamais un onglet déjà révélé, donc rien à regagner.
//
//  Dépendances injectées via configureRivalEncounterPopup :
//    getState, saveState, notify, trainerSprite, openCombatPopup,
//    switchTab, checkTabUnlocks
//  Dépendances globalThis : calculateStats (même patron que zoneSystem.js
//    pour construire l'équipe adverse scriptée)
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';
import { TRAINER_TYPES } from '../../data/trainers-data.js';
import {
  hasReachedStep,
  normalizeOnboardingState,
  ONBOARDING_STEPS,
} from '../systems/onboardingFlow.js';
import { isTabRevealed } from '../systems/tabUnlocks.js';

export const RIVAL_TRAINER_KEY = 'rivalscout';
export const RIVAL_COMBAT_THRESHOLD = 5;
const RIVAL_SPECIES = 'pidgey';
const RIVAL_LEVEL = 3;

let _ctx = {};
let _bound = false;

export function configureRivalEncounterPopup(ctx = {}) {
  _ctx = { ..._ctx, ...ctx };
  _bindEvents();
}

const _state = () => _ctx.getState?.() ?? globalThis.state;
const _t = (fr, en) => (_state()?.lang === 'en' ? en : fr);

/** Même repli que advisor.js : le transfuge recruté pendant le tunnel, ou à
 * défaut le premier agent pour une save antérieure à l'onboarding V2. */
function _guideAgent(state) {
  const agents = state?.agents;
  if (!Array.isArray(agents) || !agents.length) return null;
  const guideId = normalizeOnboardingState(state?.onboarding).guideAgentId;
  return (guideId && agents.find(a => a.id === guideId)) || agents[0];
}

function _agentSpriteUrl(agent) {
  const sprite = agent?.sprite;
  if (typeof sprite === 'string' && /^(https?:|data:|\/)/.test(sprite)) return sprite;
  const key = sprite || agent?.spriteKey || 'rocketgrunt';
  return _ctx.trainerSprite?.(key) || `https://play.pokemonshowdown.com/sprites/trainers/${key}.png`;
}

/**
 * Pure : la scène ne doit s'offrir qu'une fois le tunnel TERMINÉ — même piège
 * que _funnelDone dans tabUnlocks.js : `!isOnboardingActive` seul laisserait
 * passer une save encore `not_started` (jamais commencée), donc
 * hasReachedStep(COMPLETED) explicitement, pas juste "pas en cours" — et
 * jamais si le Pokédex est déjà accessible (save antérieure à ce mur, ou
 * ancienne règle 'captures'). Exportée pour être testée sans DOM.
 */
export function shouldOfferRivalEncounter(state) {
  if (!state || !hasReachedStep(state, ONBOARDING_STEPS.COMPLETED)) return false;
  if (state.discoveryProgress?.rivalSceneShown) return false;
  if (isTabRevealed(state, 'tabPokedex')) return false;
  return true;
}
const _shouldOffer = shouldOfferRivalEncounter;

function _bindEvents() {
  if (_bound) return;
  _bound = true;
  EventBus.on(EVENTS.COMBAT_WON, ({ zoneId, trainerKey } = {}) => {
    if (trainerKey === RIVAL_TRAINER_KEY) return; // le combat scripté lui-même, pas un déclencheur
    const state = _state();
    if (!_shouldOffer(state)) return;
    if (!state.discoveryProgress) state.discoveryProgress = {};
    const n = (state.discoveryProgress.postOnboardingZoneCombats || 0) + 1;
    state.discoveryProgress.postOnboardingZoneCombats = n;
    _ctx.saveState?.();
    if (n >= RIVAL_COMBAT_THRESHOLD) {
      setTimeout(() => _openChallengePopup(zoneId), 700);
    }
  });
}

// ── Popup 1 : reconnaissance + choix ────────────────────────────
const CHALLENGE_ID = 'rival-challenge-popup';

function _openChallengePopup(zoneId) {
  if (document.getElementById(CHALLENGE_ID)) return;
  const state = _state();
  if (!_shouldOffer(state)) return; // la situation a pu changer pendant les 700ms d'attente
  const agent = _guideAgent(state);
  if (!agent) return; // pas de transfuge à incarner, pas de scène

  state.discoveryProgress.rivalSceneShown = true; // one-shot dès l'ouverture, jamais reproposée
  _ctx.saveState?.();

  const agentName = agent.name || _t('le transfuge', 'the defector');

  const overlay = document.createElement('div');
  overlay.id = CHALLENGE_ID;
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:7400;
    background:rgba(6,6,10,.75);
    display:flex; align-items:center; justify-content:center;
    padding:16px; animation:fadeIn .2s ease;
  `;
  const box = document.createElement('div');
  box.style.cssText = `
    width:min(420px,92vw);
    background:var(--bg-card); border:2px solid var(--gold-dim);
    border-radius:var(--radius); padding:18px;
    box-shadow:0 12px 40px rgba(0,0,0,.6);
    font-family:var(--font-body);
  `;
  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <img src="${_agentSpriteUrl(agent)}" style="width:40px;height:40px;image-rendering:pixelated;flex-shrink:0" onerror="this.style.visibility='hidden'">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">${_t('UNE TÊTE CONNUE', 'A FAMILIAR FACE')}</div>
    </div>
    <div style="font-size:12px;color:var(--text-dim);line-height:1.5;margin-bottom:16px">
      ${_t(
        `« Boss, ce petit gars-là... je l'ai suivi depuis le labo du Pr. Chen ! C'est une belle occasion. »`,
        `"Boss, that kid over there... I tailed him all the way from the Prof's lab! This is a good opportunity."`,
      )}
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="rcp-choice-btn" data-choice="agent" style="padding:10px;border-radius:6px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--font-pixel);font-size:9px;cursor:pointer;text-align:left">
        🕵 ${_t(`Laisse ${agentName} s'en occuper`, `Let ${agentName} handle it`)}
      </button>
      <button class="rcp-choice-btn" data-choice="duo" style="padding:10px;border-radius:6px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--font-pixel);font-size:9px;cursor:pointer;text-align:left">
        🤝 ${_t('On y va à deux', "Let's go together")}
      </button>
      <button class="rcp-choice-btn" data-choice="solo" style="padding:10px;border-radius:6px;background:var(--red);border:1px solid var(--red);color:#fff;font-family:var(--font-pixel);font-size:9px;cursor:pointer;text-align:left">
        ⚔ ${_t("Je m'en occupe seul", "I'll handle it myself")}
      </button>
    </div>
  `;
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  box.querySelectorAll('.rcp-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.remove();
      _resolveChoice(zoneId, btn.dataset.choice, agentName);
    });
  });
}

// ── Résolution du choix ──────────────────────────────────────────
function _buildRivalSpawn() {
  const stats = globalThis.calculateStats?.({ species_en: RIVAL_SPECIES, level: RIVAL_LEVEL, nature: 'hardy', potential: 1 }) || {};
  return {
    type: 'trainer',
    trainerKey: RIVAL_TRAINER_KEY,
    trainer: TRAINER_TYPES[RIVAL_TRAINER_KEY],
    team: [{ species_en: RIVAL_SPECIES, level: RIVAL_LEVEL, stats }],
  };
}

function _resolveChoice(zoneId, choice, agentName) {
  if (choice === 'agent') {
    _ctx.notify?.(_t(`🕵 ${agentName} s'en charge, discrètement.`, `🕵 ${agentName} handles it, quietly.`), '');
    _openAftermathPopup(choice, agentName);
    return;
  }

  // duo / solo → combat interactif normal, joué dans la zone comme n'importe
  // quel autre dresseur (openCombatPopup construit lui-même l'équipe côté
  // joueur à partir de ce qui est réellement assigné à cette zone).
  const onWin = (event) => {
    if (event?.trainerKey !== RIVAL_TRAINER_KEY) return;
    EventBus.off(EVENTS.COMBAT_WON, onWin);
    EventBus.off(EVENTS.COMBAT_LOST, onLose);
    _openAftermathPopup(choice, agentName);
  };
  const onLose = (event) => {
    if (event?.trainerKey !== RIVAL_TRAINER_KEY) return;
    EventBus.off(EVENTS.COMBAT_WON, onWin);
    EventBus.off(EVENTS.COMBAT_LOST, onLose);
    // Un Roucoul niveau 3 ne devrait jamais gagner — au cas où, on retente
    // dès le combat suivant plutôt que de bloquer la scène indéfiniment.
    const state = _state();
    if (state?.discoveryProgress) {
      state.discoveryProgress.postOnboardingZoneCombats = RIVAL_COMBAT_THRESHOLD - 1;
      state.discoveryProgress.rivalSceneShown = false;
    }
    _ctx.saveState?.();
    _ctx.notify?.(_t('Le petit dresseur détale...', 'The young trainer bolts...'), 'error');
  };
  EventBus.on(EVENTS.COMBAT_WON, onWin);
  EventBus.on(EVENTS.COMBAT_LOST, onLose);
  _ctx.openCombatPopup?.(zoneId, _buildRivalSpawn());
}

// ── Popup 2 : racket + Pokédex volé ─────────────────────────────
const AFTERMATH_ID = 'rival-aftermath-popup';

function _openAftermathPopup(choice, agentName) {
  if (document.getElementById(AFTERMATH_ID)) return;

  const theftLine = choice === 'solo'
    ? _t(
        'Le gamin détale en abandonnant son sac. Dedans : un Pokédex tout neuf.',
        'The kid bolts, leaving his bag behind. Inside: a brand-new Pokédex.',
      )
    : _t(
        `${agentName} fouille les poches du gamin. « Tiens, boss — un Pokédex. Ça pourrait nous servir. »`,
        `${agentName} goes through the kid's pockets. "Here, boss — a Pokédex. Could be useful."`,
      );

  const overlay = document.createElement('div');
  overlay.id = AFTERMATH_ID;
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:7400;
    background:rgba(6,6,10,.75);
    display:flex; align-items:center; justify-content:center;
    padding:16px; animation:fadeIn .2s ease;
  `;
  const box = document.createElement('div');
  box.style.cssText = `
    width:min(420px,92vw);
    background:var(--bg-card); border:2px solid var(--gold-dim);
    border-radius:var(--radius); padding:18px;
    box-shadow:0 12px 40px rgba(0,0,0,.6);
    font-family:var(--font-body);
  `;
  box.innerHTML = `
    <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold);margin-bottom:10px;text-align:center">
      ${_t('📖 BUTIN DE COMBAT', '📖 COMBAT SPOILS')}
    </div>
    <div style="font-size:12px;color:var(--text-dim);line-height:1.5;margin-bottom:12px">${theftLine}</div>
    <div style="font-size:11px;color:var(--text-dim);line-height:1.5;margin-bottom:16px;padding:10px;background:rgba(255,255,255,.04);border-radius:6px">
      ${_t(
        `« Voilà comment le gang se fait de l'argent, boss : on rackette les dresseurs qu'on croise. Ils casquent, ou ils dégagent. »`,
        `"This is how the gang makes money, boss: we shake down the trainers we run into. They pay up, or they clear off."`,
      )}
    </div>
    <button id="rcp-open-dex-btn" style="
      display:block; width:100%; padding:10px; border:none; border-radius:6px;
      background:var(--gold-dim); color:#1a1a1a; font-family:var(--font-pixel); font-size:10px;
      cursor:pointer;
    ">${_t('📖 Ouvrir le Pokédex', '📖 Open the Pokédex')}</button>
  `;
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  box.querySelector('#rcp-open-dex-btn').addEventListener('click', () => {
    overlay.remove();
    _grantPokedex();
  });
}

function _grantPokedex() {
  const state = _state();
  if (!state.discoveryProgress) state.discoveryProgress = {};
  state.discoveryProgress.rivalPokedexUnlocked = true;
  state.discoveryProgress.pokedexRevealPending = true;
  _ctx.saveState?.();
  _ctx.checkTabUnlocks?.();
  _ctx.switchTab?.('tabPokedex');
}
