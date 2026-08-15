import assert from 'node:assert/strict';

import { ONBOARDING_AMBUSH_LINES, ONBOARDING_GIOVANNI_LINES } from '../data/onboarding-data.js';
import { ONBOARDING_STEPS } from '../modules/systems/onboardingFlow.js';

// ── Environnement minimal ─────────────────────────────────────────
// Aucune interaction DOM n'est exercée ici : buildOnboardingFlashbackBeats
// est pur, et maybeOfferOnboardingFlashback court-circuite avant de toucher
// `document` tant que l'état n'est pas éligible — même convention que
// onboardingPayoff.js (helpers purs testés ici, rendu vérifié en navigateur).
globalThis.trainerSprite = key => `sprite:${key}`;

const {
  buildOnboardingFlashbackBeats,
  configureOnboardingFlashback,
  maybeOfferOnboardingFlashback,
} = await import('../modules/ui/onboardingFlashback.js');

const completedState = (extra = {}) => ({
  lang: 'fr',
  onboarding: {
    step: ONBOARDING_STEPS.COMPLETED,
    ambushWon: false,
    ambushSprites: ['scientist', 'cueball', 'gambler'],
    guideAgentId: null,
    ...extra.onboarding,
  },
  agents: extra.agents ?? [],
  discoveryProgress: { introFlashbackOffered: false, ...extra.discoveryProgress },
});

// ── Choix du visage du sbire ────────────────────────────────────────
// Priorité : leur transfuge recruté (l'histoire redevient littéralement la
// leur) > le tirage persisté de l'embuscade > un visage générique.
const withGuide = completedState({
  onboarding: { guideAgentId: 'ag-1' },
  agents: [{ id: 'ag-1', spriteKey: 'burglar' }],
});
assert.equal(buildOnboardingFlashbackBeats(withGuide)[0].sprite, 'sprite:burglar');

const withoutGuide = completedState();
assert.equal(buildOnboardingFlashbackBeats(withoutGuide)[0].sprite, 'sprite:scientist');

const bareLegacySave = completedState({ onboarding: { ambushSprites: [] } });
assert.equal(buildOnboardingFlashbackBeats(bareLegacySave)[0].sprite, 'sprite:rocketgrunt');

// Un guide sans spriteKey (save écrite par une préversion) retombe sur le
// tirage plutôt que d'afficher un sprite manquant.
const guideNoSpriteKey = completedState({
  onboarding: { guideAgentId: 'ag-1' },
  agents: [{ id: 'ag-1' }],
});
assert.equal(buildOnboardingFlashbackBeats(guideNoSpriteKey)[0].sprite, 'sprite:scientist');

// ── Contenu des répliques ─────────────────────────────────────────
const lostBeats = buildOnboardingFlashbackBeats(completedState({ onboarding: { ambushWon: false } }));
assert.equal(lostBeats.length, 5);
assert.equal(lostBeats[0].line, ONBOARDING_AMBUSH_LINES.lost.fr);
assert.equal(lostBeats[1].line, ONBOARDING_GIOVANNI_LINES.arrival.fr);
assert.equal(lostBeats[2].line, ONBOARDING_GIOVANNI_LINES.claim.fr);
assert.equal(lostBeats[3].line, ONBOARDING_GIOVANNI_LINES.offer.fr);
assert.equal(lostBeats[4].line, ONBOARDING_GIOVANNI_LINES.farewell.fr);
assert.equal(lostBeats[0].name, 'Sbire Rocket');
assert.ok(lostBeats.slice(1).every(beat => beat.name === 'Giovanni'));

// Le rare joueur qui gagne l'embuscade ne doit pas s'entendre parler d'une
// défaite dans son propre souvenir.
const wonBeats = buildOnboardingFlashbackBeats(completedState({ onboarding: { ambushWon: true } }));
assert.equal(wonBeats[0].line, ONBOARDING_AMBUSH_LINES.won.fr);
assert.equal(wonBeats[1].line, ONBOARDING_GIOVANNI_LINES.arrivalWon.fr);

// Bilingue.
const enBeats = buildOnboardingFlashbackBeats({ ...completedState(), lang: 'en' });
assert.equal(enBeats[0].line, ONBOARDING_AMBUSH_LINES.lost.en);
assert.equal(enBeats[0].name, 'Rocket Grunt');

// ── Éligibilité (pas de DOM tant qu'elle n'est pas remplie) ────────
configureOnboardingFlashback({ getState: () => null, saveState: () => { throw new Error('ne doit pas être appelé'); } });
assert.equal(maybeOfferOnboardingFlashback(), false);

const midTunnel = { onboarding: { step: ONBOARDING_STEPS.GUIDE_TEAM } };
configureOnboardingFlashback({ getState: () => midTunnel, saveState: () => { throw new Error('ne doit pas être appelé'); } });
assert.equal(maybeOfferOnboardingFlashback(), false);

const alreadyOffered = completedState({ discoveryProgress: { introFlashbackOffered: true } });
configureOnboardingFlashback({ getState: () => alreadyOffered, saveState: () => { throw new Error('ne doit pas être appelé'); } });
assert.equal(maybeOfferOnboardingFlashback(), false);

console.log('onboarding flashback tests: ok');
