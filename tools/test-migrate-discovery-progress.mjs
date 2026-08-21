import assert from 'node:assert/strict';

import { migrateSave } from '../state/migrateSave.js';
import { DEFAULT_STATE, SAVE_SCHEMA_VERSION } from '../state/defaultState.js';

// ── Régression : discoveryProgress ne doit PLUS retomber à ses défauts ─────
// Avant fix, seuls sinnohTeaseUnlocked/introFlashbackOffered/advisorLastSeen
// survivaient à migrateSave() — tout autre flag one-shot (itemsIntroShown,
// et par extension tout flag de la scène du rival) était silencieusement
// réinitialisé à CHAQUE chargement, faisant réapparaître sa popup à chaque
// session au lieu d'une seule fois par save.
const deps = { DEFAULT_STATE, SAVE_SCHEMA_VERSION, SPECIES_BY_EN: {}, uid: () => 'x' };

const saved = {
  _schemaVersion: SAVE_SCHEMA_VERSION,
  gang: { initialized: true },
  discoveryProgress: {
    itemsIntroShown: true,
    rivalSceneShown: true,
    rivalPokedexUnlocked: true,
    sinnohTeaseUnlocked: true,
    introFlashbackOffered: true,
    advisorLastSeen: 'first_agent',
    revealedTabs: ['tabMarket', 'tabPokedex', 'stale_removed_tab'],
    capturesSinceOnboarding: 12,
    agentOperations: 3,
  },
  onboarding: { step: 'completed' },
};

const result = migrateSave(saved, deps);
const dp = result.discoveryProgress;

// Flags déjà connus AVANT ce fix — ne doivent pas régresser.
assert.equal(dp.sinnohTeaseUnlocked, true);
assert.equal(dp.introFlashbackOffered, true);
assert.equal(dp.advisorLastSeen, 'first_agent');

// Flags freeform ajoutés depuis (items, rival) — c'est eux que le bug cassait.
assert.equal(dp.itemsIntroShown, true, 'itemsIntroShown doit survivre au reload');
assert.equal(dp.rivalSceneShown, true, 'rivalSceneShown doit survivre au reload');
assert.equal(dp.rivalPokedexUnlocked, true, 'rivalPokedexUnlocked doit survivre au reload');

// La sanitization existante (tabs invalides filtrées, compteurs numériques)
// doit continuer à s'appliquer par-dessus le merge élargi.
assert.deepEqual(dp.revealedTabs, ['tabMarket', 'tabPokedex']);
assert.equal(dp.capturesSinceOnboarding, 12);
assert.equal(dp.agentOperations, 3);
assert.equal(dp.sessionsSinceOnboarding, 0);

// Une save sans discoveryProgress du tout doit toujours retomber sur les
// défauts, sans throw.
const freshSaved = { gang: { initialized: false } };
const freshResult = migrateSave(freshSaved, deps);
assert.deepEqual(freshResult.discoveryProgress.revealedTabs, []);
assert.equal(freshResult.discoveryProgress.itemsIntroShown, false);

console.log('migrate discoveryProgress tests: ok');
