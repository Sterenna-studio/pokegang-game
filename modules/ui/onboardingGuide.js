'use strict';

// ════════════════════════════════════════════════════════════════
//  onboardingGuide.js — le transfuge Team Rocket qui sert de tutoriel
//
//  Il est planté sur le terrain de départ via l'ancrage sprite-sur-zone
//  existant (.zone-quest-encounter, construit pour les légendaires) : le
//  chaînage `getOnboardingGuideEncounterForZone` dans zoneWindows suffit,
//  aucun rendu ni CSS spécifique à maintenir. Sa réplique courante est
//  portée par le libellé sous le sprite — c'est la « bulle » du tutoriel.
//
//  Dépendances globalThis : state, saveState, notify, renderAll,
//    trainerSprite, rollNewAgent, recruitAgent, patchZoneWindow
// ════════════════════════════════════════════════════════════════

import { esc } from '../core/escape.js';
import {
  ONBOARDING_GUIDE_SPRITES,
  ONBOARDING_ZONE_ID,
} from '../../data/onboarding-data.js';
import {
  ONBOARDING_STEPS,
  getOnboardingGuideLine,
  normalizeOnboardingState,
} from '../systems/onboardingFlow.js';
import { onGuideRecruited } from './onboarding.js';

const GUIDE_ENCOUNTER_ID = 'onboarding-guide';
const PICKER_ID = 'onboardingGuidePicker';

let _ctx = {};

export function configureOnboardingGuide(ctx = {}) {
  _ctx = { ..._ctx, ...ctx };
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
  const sprite = onboarding.guideSprite || ONBOARDING_GUIDE_SPRITES[0].key;
  return {
    id: GUIDE_ENCOUNTER_ID,
    // Libellé court sous le sprite, réplique complète dans la bulle au-dessus.
    name: agent?.name || _t('Transfuge', 'Defector'),
    bubble: line,
    icon: '💬',
    spriteUrl: _spriteUrl(agent ? (agent.sprite || sprite) : sprite),
    onClick: openGuideEncounter,
  };
}

/** Repose le sprite immédiatement plutôt qu'au prochain tick de zone. */
export function refreshGuide() {
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
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:9999';
  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:22px;max-width:520px;width:94%;display:flex;flex-direction:column;gap:16px">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold);letter-spacing:.08em">
        ${_t('UN TRANSFUGE', 'A DEFECTOR')}
      </div>
      <p style="margin:0;font-size:12px;line-height:1.6;color:var(--text-dim)">
        ${esc(getOnboardingGuideLine(state) || '')}
      </p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        ${ONBOARDING_GUIDE_SPRITES.map(entry => `
          <button data-guide-sprite="${esc(entry.key)}"
            style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:96px">
            <img src="${_spriteUrl(entry.key)}" alt="" style="width:56px;height:56px;image-rendering:pixelated" onerror="this.style.visibility='hidden'">
            <span style="font-size:9px;color:var(--text-dim)">${esc(_t(entry.fr, entry.en))}</span>
          </button>`).join('')}
      </div>
      <div style="font-size:10px;color:var(--text-dim);text-align:center">
        ${_t('Choisis son allure — il rejoint ton gang gratuitement.', 'Pick how he looks — he joins your gang for free.')}
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
  // reste tiré au sort comme pour n'importe quel agent.
  candidate.sprite = spriteKey;
  if (globalThis.recruitAgent?.(candidate, { source: 'onboarding', cost: 0 }) === false) return false;
  onGuideRecruited(candidate.id, spriteKey);
  _ctx.notify?.(_t(
    `${candidate.name} quitte la Team Rocket et rejoint ton gang.`,
    `${candidate.name} walks away from Team Rocket and joins your gang.`,
  ), 'gold');
  return true;
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
  // Déjà à bord : il se contente de répéter sa demande en cours.
  const line = getOnboardingGuideLine(state);
  if (line) _ctx.notify?.(line, 'gold');
  return true;
}

Object.assign(globalThis, {
  getOnboardingGuideEncounterForZone,
  openGuideEncounter,
});
