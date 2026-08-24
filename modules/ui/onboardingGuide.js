'use strict';

// ════════════════════════════════════════════════════════════════
//  onboardingGuide.js — le transfuge Team Rocket qui sert de tutoriel
//
//  Il est planté sur le terrain de départ via l'ancrage sprite-sur-zone
//  existant (.zone-quest-encounter, construit pour les légendaires) : le
//  chaînage `getOnboardingGuideEncounterForZone` dans zoneWindows suffit,
//  aucun rendu ni CSS spécifique à maintenir pour ça. Sa réplique courante
//  est portée par le libellé sous le sprite — c'est la « bulle » du
//  tutoriel. La flèche/bandeau d'aide (`.onboarding-guide-help-*`) restent
//  stylés dans css/game-ui.css ; le sélecteur de recrutement (`obg-*`) est
//  dans css/onboarding.css — seules les positions calculées (left/top de la
//  flèche) restent inline, tout le reste y est statique.
//
//  Dépendances globalThis : state, saveState, notify, renderAll,
//    trainerSprite, rollNewAgent, recruitAgent, patchZoneWindow
// ════════════════════════════════════════════════════════════════

import { esc } from '../core/escape.js';
import { EventBus, EVENTS } from '../core/eventBus.js';
import {
  ONBOARDING_ZONE_ID,
  pickAmbushSprites,
  resolveAmbushSprites,
} from '../../data/onboarding-data.js';
import {
  ONBOARDING_STEPS,
  getOnboardingGuideLine,
  normalizeOnboardingState,
} from '../systems/onboardingFlow.js';
import { onGuideRecruited } from './onboarding.js';

const GUIDE_ENCOUNTER_ID = 'onboarding-guide';
const PICKER_ID = 'onboardingGuidePicker';
const HELP_ARROW_ID = 'onboarding-guide-help-arrow';
const HELP_BANNER_ID = 'onboarding-guide-help-banner';

let _ctx = {};
let _helpEventsBound = false;

export function configureOnboardingGuide(ctx = {}) {
  _ctx = { ..._ctx, ...ctx };
  _bindGuideHelpEvents();
}

function _bindGuideHelpEvents() {
  if (_helpEventsBound) return;
  _helpEventsBound = true;
  // La cible pointée vit sur tabAgents : en sortir la rend invisible sans la
  // faire disparaître (elle resterait plantée à l'écran, décorrélée de rien).
  EventBus.on(EVENTS.UI_TAB_CHANGED, ({ tabId } = {}) => {
    if (tabId !== 'tabAgents') _clearGuideHelp();
  });
}

const _state = () => _ctx.getState?.() ?? globalThis.state;
const _t = (fr, en) => (_state()?.lang === 'en' ? en : fr);

/** Étapes pendant lesquelles le transfuge est visible sur le terrain. */
const GUIDE_STEPS = new Set([
  ONBOARDING_STEPS.GUIDE_MET,
  ONBOARDING_STEPS.GUIDE_TEAM,
  ONBOARDING_STEPS.GUIDE_ZONE,
  ONBOARDING_STEPS.GUIDE_COMBAT,
]);

function _spriteUrl(key) {
  return globalThis.trainerSprite?.(key)
    || `https://play.pokemonshowdown.com/sprites/trainers/${key}.png`;
}

/**
 * rollNewAgent écrit une URL dans `sprite` et la clé dans `spriteKey`, mais les
 * saves de la préversion (et les fixtures de QA) ont pu recevoir une clé nue
 * dans `sprite`. On accepte les deux plutôt que d'afficher une image cassée.
 */
function _agentSpriteUrl(agent, fallbackKey) {
  const sprite = agent?.sprite;
  if (typeof sprite === 'string' && /^(https?:|data:|\/)/.test(sprite)) return sprite;
  return _spriteUrl(sprite || agent?.spriteKey || fallbackKey);
}

/**
 * Les candidats au ralliement sont les assaillants de l'embuscade, tirés au
 * sort au moment où ils débarquent et persistés dans la save. Le repli sur un
 * tirage frais ne sert qu'aux saves écrites avant que ce set n'existe.
 */
function _guideCandidates(state) {
  const resolved = resolveAmbushSprites(normalizeOnboardingState(state?.onboarding).ambushSprites);
  return resolved.length ? resolved : pickAmbushSprites();
}

function _guideAgent(state) {
  const id = normalizeOnboardingState(state?.onboarding).guideAgentId;
  return id ? state?.agents?.find(agent => agent.id === id) ?? null : null;
}

/**
 * Branché dans le chaînage des rencontres de quête de zoneWindows — même
 * mécanique que les légendaires, donc placement, badge et clic sont gratuits.
 */
export function getOnboardingGuideEncounterForZone(zoneId) {
  if (zoneId !== ONBOARDING_ZONE_ID) return null;
  const state = _state();
  const onboarding = normalizeOnboardingState(state?.onboarding);
  if (!GUIDE_STEPS.has(onboarding.step)) return null;

  const agent = _guideAgent(state);
  const line = getOnboardingGuideLine(state) || '';
  const sprite = onboarding.guideSprite || _guideCandidates(state)[0].key;
  return {
    id: GUIDE_ENCOUNTER_ID,
    // Libellé court sous le sprite, réplique complète dans la bulle au-dessus.
    name: agent?.name || _t('Transfuge', 'Defector'),
    bubble: line,
    icon: '💬',
    spriteUrl: agent ? _agentSpriteUrl(agent, sprite) : _spriteUrl(sprite),
    onClick: openGuideEncounter,
  };
}

// ── Aide guidée (« confie-moi un Pokémon », etc.) ───────────────────
// Flèche + bandeau flottants, positionnés en JS sur une cible arbitraire
// (potentiellement sur un AUTRE onglet que celui affiché au clic) — pas
// d'ancrage CSS relatif possible comme pour la flèche de première capture.
function _clearGuideHelp() {
  document.getElementById(HELP_ARROW_ID)?.remove();
  document.getElementById(HELP_BANNER_ID)?.remove();
}

function _pointGuideHelpAt(targetEl, text) {
  _clearGuideHelp();
  if (!targetEl) return false;
  targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const banner = document.createElement('div');
  banner.id = HELP_BANNER_ID;
  banner.className = 'onboarding-guide-help-banner';
  banner.textContent = text;
  document.body.appendChild(banner);

  const arrow = document.createElement('div');
  arrow.id = HELP_ARROW_ID;
  arrow.className = 'onboarding-guide-help-arrow';
  arrow.textContent = '👇';
  document.body.appendChild(arrow);

  // Après le scrollIntoView : la position finale n'est connue qu'une fois le
  // scroll (et un éventuel changement d'onglet) retombés. setTimeout, pas
  // requestAnimationFrame — rAF est intégralement suspendu tant que l'onglet
  // navigateur est masqué (contrairement à setTimeout, juste ralenti), donc
  // ne se déclencherait jamais si le joueur avait l'app en arrière-plan.
  setTimeout(() => {
    if (!document.getElementById(HELP_ARROW_ID)) return; // déjà refermé
    const r = targetEl.getBoundingClientRect();
    arrow.style.left = `${r.left + r.width / 2}px`;
    arrow.style.top = `${r.top - 30}px`;
  }, 0);
  return true;
}

/**
 * Attend que la cible existe avant d'y planter la flèche. Deviner un délai ne
 * marche pas : renderAgentsTab() est débouncé (80ms), et il diffère encore son
 * rendu si un champ de la grille a le focus — sans compter le bridage des
 * timers quand l'onglet navigateur est en arrière-plan. On sonde donc jusqu'à
 * ce que l'élément apparaisse, avec un plafond pour ne pas boucler à vide.
 */
function _pointGuideHelpWhenReady(selector, text, { tries = 24, intervalMs = 80 } = {}) {
  let left = tries;
  const attempt = () => {
    const target = document.querySelector(selector);
    if (target) { _pointGuideHelpAt(target, text); return; }
    if (--left > 0) setTimeout(attempt, intervalMs);
  };
  setTimeout(attempt, 0);
}

/** Guide vers l'écran d'affectation d'un Pokémon à cet agent (étape GUIDE_TEAM). */
function _guideToTeamAssignment(agentId) {
  // Le terrain de départ a fini son office : tout ce qui reste au transfuge
  // (équipe, zone, option de combat) se règle dans l'onglet Agents. Le laisser
  // ouvert affichait une fenêtre de zone vide par-dessus le fogmap au retour.
  _ctx.purgeOnboardingZone?.();
  _ctx.switchTab?.('tabAgents');
  _pointGuideHelpWhenReady(`.agent-team-slot[data-agent-team="${agentId}"]`, _t(
    'Les Pokémon que tu confies à tes agents sont utilisés en combat — donne-leur des Pokémon puissants et adaptés à leur zone.',
    'The Pokémon you give your agents get used in combat — give them strong Pokémon suited to their zone.',
  ));
  return true;
}

/**
 * Enchaîne automatiquement sur les deux étapes suivantes (zone, puis combat),
 * sans attendre un clic du joueur sur quoi que ce soit — contrairement à
 * _guideToTeamAssignment, qui répond à un clic sur le sprite du transfuge,
 * encore visible à ce moment-là sur le terrain. Ces deux étapes n'ont plus de
 * sprite : le terrain de départ est purgé depuis l'étape précédente, donc sans
 * cet enchaînement explicite le joueur se retrouverait sur l'onglet Agents
 * sans aucune indication de ce qu'il reste à faire. Le texte vient de
 * getOnboardingGuideLine(), pas d'un doublon codé en dur ici : il reflète déjà
 * la réplique de l'étape qu'on vient de committer (_commitStep() met à jour
 * state.onboarding.step de façon synchrone avant que l'appelant ne poursuive).
 */
export function guideToZoneAssignment(agentId) {
  _ctx.switchTab?.('tabAgents');
  _pointGuideHelpWhenReady(
    `.agents-zone-select[data-agent-id="${agentId}"]`,
    getOnboardingGuideLine(_state()),
  );
}

export function guideToCombatToggle(agentId) {
  _ctx.switchTab?.('tabAgents');
  _pointGuideHelpWhenReady(
    `button[data-ag-flag="${agentId}"][data-flag="autoCombat"]`,
    getOnboardingGuideLine(_state()),
  );
}

/** Repose le sprite immédiatement plutôt qu'au prochain tick de zone. */
export function refreshGuide() {
  // Un pas vient d'être franchi : quoi que la flèche pointait, ce n'est plus
  // à jour — c'est encore vrai si le pas franchi n'est pas celui qu'elle
  // aidait (ex. le joueur a fini une autre étape entre-temps).
  _clearGuideHelp();
  const win = document.getElementById(`zw-${ONBOARDING_ZONE_ID}`);
  if (win) globalThis.patchZoneWindow?.(ONBOARDING_ZONE_ID, win);
}

export function placeGuide() {
  refreshGuide();
}

export function clearGuide() {
  document.getElementById(PICKER_ID)?.remove();
  refreshGuide();
}

// ── Choix du look + recrutement ───────────────────────────────────
function _openSpritePicker() {
  if (document.getElementById(PICKER_ID)) return false;
  const state = _state();

  const overlay = document.createElement('div');
  overlay.id = PICKER_ID;
  overlay.className = 'obg-picker-overlay';
  overlay.innerHTML = `
    <div class="obg-picker-box">
      <div class="obg-picker-title">
        ${_t('UN TRANSFUGE', 'A DEFECTOR')}
      </div>
      <p class="obg-picker-desc">
        ${esc(getOnboardingGuideLine(state) || '')}
      </p>
      <div class="obg-picker-grid">
        ${_guideCandidates(state).map(entry => `
          <button data-guide-sprite="${esc(entry.key)}" class="obg-picker-option">
            <img src="${_spriteUrl(entry.key)}" alt="" class="obg-picker-option-img" onerror="this.style.visibility='hidden'">
            <span class="obg-picker-option-label">${esc(_t(entry.fr, entry.en))}</span>
          </button>`).join('')}
      </div>
      <div class="obg-picker-hint">
        ${_t('Lequel de tes assaillants déserte ? Il rejoint ton gang gratuitement.', 'Which of your attackers is defecting? He joins your gang for free.')}
      </div>
    </div>`;

  overlay.querySelectorAll('[data-guide-sprite]').forEach(button => {
    button.addEventListener('click', () => {
      const spriteKey = button.dataset.guideSprite;
      overlay.remove();
      _recruitGuide(spriteKey);
    });
  });
  document.body.appendChild(overlay);
  return true;
}

function _recruitGuide(spriteKey) {
  const candidate = globalThis.rollNewAgent?.();
  if (!candidate) return false;
  // Le look est imposé par le joueur ; le reste (nom, personnalité, stats)
  // reste tiré au sort comme pour n'importe quel agent. `sprite` est une URL et
  // `spriteKey` la clé (cf. rollNewAgent) : n'écrire que l'un des deux laissait
  // l'agent sans visage dans la barre de zone et l'onglet Agents, alors que
  // c'est justement le visage que le joueur vient de choisir.
  candidate.sprite = _spriteUrl(spriteKey);
  candidate.spriteKey = spriteKey;
  if (globalThis.recruitAgent?.(candidate, { source: 'onboarding', cost: 0 }) === false) return false;
  onGuideRecruited(candidate.id, spriteKey);
  _ctx.notify?.(_t(
    `${candidate.name} quitte la Team Rocket et rejoint ton gang.`,
    `${candidate.name} walks away from Team Rocket and joins your gang.`,
  ), 'gold');
  return true;
}

/**
 * Ouvre directement le sélecteur de recrutement, sans attendre que le joueur
 * remarque puis clique le sprite planté sur le terrain — appelé par
 * onboarding.js juste après le départ de Giovanni, pour enchaîner la
 * révélation du transfuge dans la continuité de sa fenêtre modale plutôt que
 * de renvoyer le joueur devant le terrain sans explication.
 */
export function autoOpenGuideEncounter() {
  const state = _state();
  const onboarding = normalizeOnboardingState(state?.onboarding);
  if (onboarding.step !== ONBOARDING_STEPS.GUIDE_MET || onboarding.guideAgentId) return false;
  return _openSpritePicker();
}

/** Clic sur le sprite du transfuge. */
export function openGuideEncounter() {
  const state = _state();
  const onboarding = normalizeOnboardingState(state?.onboarding);
  if (!GUIDE_STEPS.has(onboarding.step)) return false;
  // Pas encore recruté : c'est la scène de rencontre.
  if (onboarding.step === ONBOARDING_STEPS.GUIDE_MET && !onboarding.guideAgentId) {
    return _openSpritePicker();
  }
  // « Confie-moi un Pokémon » — plutôt qu'une simple notif qui laisse le
  // joueur deviner où aller, on l'y emmène directement, flèche à l'appui.
  if (onboarding.step === ONBOARDING_STEPS.GUIDE_TEAM) {
    return _guideToTeamAssignment(onboarding.guideAgentId);
  }
  // Déjà à bord, autre étape (zone/combat) : il se contente de répéter sa
  // demande en cours.
  const line = getOnboardingGuideLine(state);
  if (line) _ctx.notify?.(line, 'gold');
  return true;
}

Object.assign(globalThis, {
  getOnboardingGuideEncounterForZone,
  openGuideEncounter,
  autoOpenGuideEncounter,
});
