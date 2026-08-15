import assert from 'node:assert/strict';

import { ADVISOR_FALLBACK, ADVISOR_LINES } from '../data/advisor-data.js';
import { ONBOARDING_STEPS } from '../modules/systems/onboardingFlow.js';

// ── Environnement minimal ─────────────────────────────────────────
// Seules les fonctions pures sont testées ici ; renderAdvisor touche au DOM
// et se vérifie en navigateur (même convention que onboardingPayoff.js).
globalThis.trainerSprite = key => `sprite:${key}`;

const {
  configureAdvisor,
  getAdvisorMessage,
  hasUnseenAdvice,
  isAdvisorVisible,
} = await import('../modules/ui/advisor.js');

const makeState = (over = {}) => ({
  lang: 'fr',
  gang: { initialized: true },
  agents: [{ id: 'ag-guide', name: 'Zane', spriteKey: 'burglar' }],
  onboarding: { step: ONBOARDING_STEPS.COMPLETED, guideAgentId: 'ag-guide' },
  discoveryProgress: {},
  ...over,
});

/** Branche getNextObjective sur une valeur fixe pour ce cas de test. */
const withObjective = objective => configureAdvisor({ getNextObjective: () => objective });

// ── Visibilité ────────────────────────────────────────────────────
assert.equal(isAdvisorVisible(null), false);
assert.equal(isAdvisorVisible(makeState()), true);
// Pendant le tunnel il tient déjà le terrain (onboardingGuide) : pas de doublon.
assert.equal(isAdvisorVisible(makeState({
  onboarding: { step: ONBOARDING_STEPS.GUIDE_TEAM, guideAgentId: 'ag-guide' },
})), false);
// Un slot vierge n'a personne à incarner.
assert.equal(isAdvisorVisible(makeState({ gang: { initialized: false } })), false);
assert.equal(isAdvisorVisible(makeState({ agents: [] })), false);

// ── Choix de la réplique ──────────────────────────────────────────
withObjective({ id: 'first_agent', tab: 'tabPC' });
const msg = getAdvisorMessage(makeState());
assert.equal(msg.id, 'first_agent');
assert.equal(msg.line, ADVISOR_LINES.first_agent.fr);
assert.equal(msg.tab, 'tabPC');

// Bilingue.
assert.equal(getAdvisorMessage(makeState({ lang: 'en' })).line, ADVISOR_LINES.first_agent.en);

// L'id composite `unlock_zone:<zone>` retombe sur la ligne générique, et le
// nom de la zone est injecté — sinon la bulle afficherait « {zone} ».
withObjective({ id: 'unlock_zone:mt_moon', tab: 'tabZones', zoneName: 'Mont Sélénite' });
const zoneMsg = getAdvisorMessage(makeState());
assert.equal(zoneMsg.id, 'unlock_zone:mt_moon');
assert.ok(zoneMsg.line.includes('Mont Sélénite'));
assert.ok(!zoneMsg.line.includes('{zone}'));

// Un objectif sans ligne dédiée ne doit pas produire de bulle vide.
withObjective({ id: 'objectif_inconnu', tab: null });
assert.equal(getAdvisorMessage(makeState()).line, ADVISOR_FALLBACK.fr);

// Pas d'objectif du tout → pas de message (et donc pas de « ! »).
withObjective(null);
assert.equal(getAdvisorMessage(makeState()), null);
assert.equal(hasUnseenAdvice(makeState()), false);

// ── Badge « ! » ───────────────────────────────────────────────────
withObjective({ id: 'first_agent', tab: 'tabPC' });
// Jamais entendu → il a du neuf.
assert.equal(hasUnseenAdvice(makeState()), true);
// Déjà entendu CET objectif → plus rien de neuf (le « ! » ne se rallume pas
// à chaque rechargement, c'est tout l'intérêt de persister l'id).
assert.equal(hasUnseenAdvice(makeState({
  discoveryProgress: { advisorLastSeen: 'first_agent' },
})), false);
// Un autre objectif déjà entendu ne masque pas le nouveau.
assert.equal(hasUnseenAdvice(makeState({
  discoveryProgress: { advisorLastSeen: 'first_catch' },
})), true);
// Invisible = jamais de badge, même avec un objectif neuf.
assert.equal(hasUnseenAdvice(makeState({ agents: [] })), false);

// ── Toutes les lignes couvrent les deux langues ───────────────────
for (const [id, entry] of Object.entries(ADVISOR_LINES)) {
  assert.ok(entry.fr && entry.en, `${id} doit avoir fr ET en`);
  // `{zone}` n'a de sens que pour la ligne de déblocage de zone : ailleurs il
  // s'afficherait tel quel, faute de zoneName à injecter.
  const usesZone = entry.fr.includes('{zone}') || entry.en.includes('{zone}');
  assert.equal(usesZone, id === 'unlock_zone', `${id} : placeholder {zone} inattendu`);
}

console.log('advisor tests: ok');
