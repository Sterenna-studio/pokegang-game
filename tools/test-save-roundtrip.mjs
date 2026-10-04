// Round-trip de sauvegarde : state → buildSavePayload() → JSON → migrateSave().
//
// slimPokemon() retire des champs jugés « dérivables » ou égaux à leur défaut
// avant sérialisation. Ce test vérifie qu'un cycle complet ne perd rien
// d'observable : soit le champ revient tel quel, soit il est reconstruit à une
// valeur équivalente par migrateSave(). Un champ qui disparaît silencieusement
// est un bug de persistance — le joueur perd l'information au rechargement.
//
//   node tools/test-save-roundtrip.mjs

import assert from 'node:assert/strict';
import { DEFAULT_STATE, SAVE_SCHEMA_VERSION } from '../state/defaultState.js';
import { buildSavePayload, slimPokemon, MAX_HISTORY } from '../state/serialization.js';
import { migrateSave, getMigrationSummary } from '../state/migrateSave.js';

let uidCounter = 0;
const deps = {
  DEFAULT_STATE,
  SAVE_SCHEMA_VERSION,
  SPECIES_BY_EN: {
    Pikachu:  { en: 'Pikachu',  fr: 'Pikachu',    dex: 25,  rarity: 'uncommon' },
    Eevee:    { en: 'Eevee',    fr: 'Évoli',      dex: 133, rarity: 'rare' },
    Dratini:  { en: 'Dratini',  fr: 'Minidraco',  dex: 147, rarity: 'rare' },
  },
  uid: () => `uid-${++uidCounter}`,
  now: () => 1_700_000_000_000,
};

const roundTrip = state => migrateSave(JSON.parse(JSON.stringify(buildSavePayload(state))), deps);

function makePokemon(over = {}) {
  return {
    id: 'pk-1', species_en: 'Pikachu', species_fr: 'Pikachu', dex: 25,
    level: 12, xp: 40, potential: 3, shiny: false, nature: 'Hardy',
    assignedTo: 'ag-1', cooldown: 15, homesick: true, favorite: true,
    nickname: 'Sparky', history: [], ...over,
  };
}

const failures = [];
const check = (label, fn) => {
  try { fn(); console.log('  ok   ' + label); }
  catch (e) { failures.push(label + ' — ' + e.message); console.log('  FAIL ' + label + '\n         ' + e.message); }
};

console.log('\n── champs non-défaut : doivent survivre tels quels ───────────────');

check('valeurs non-défaut préservées', () => {
  const state = structuredClone(DEFAULT_STATE);
  state.pokemons = [makePokemon()];
  const p = roundTrip(state).pokemons[0];
  for (const k of ['assignedTo', 'cooldown', 'homesick', 'favorite', 'xp', 'nickname', 'level', 'potential']) {
    assert.deepEqual(p[k], makePokemon()[k], `champ "${k}" : ${JSON.stringify(p[k])} au lieu de ${JSON.stringify(makePokemon()[k])}`);
  }
});

check('historique conservé et tronqué à MAX_HISTORY', () => {
  const long = Array.from({ length: MAX_HISTORY + 12 }, (_, i) => ({ t: i, ev: 'x' }));
  const state = structuredClone(DEFAULT_STATE);
  state.pokemons = [makePokemon({ history: long })];
  const p = roundTrip(state).pokemons[0];
  assert.equal(p.history?.length, MAX_HISTORY, `longueur ${p.history?.length}`);
  assert.equal(p.history.at(-1).t, long.at(-1).t, 'ce sont les entrées les PLUS RÉCENTES qui doivent rester');
});

console.log('\n── champs retirés par slimPokemon : reconstruits au chargement ? ──');

check('species_fr reconstruit depuis SPECIES_BY_EN', () => {
  const state = structuredClone(DEFAULT_STATE);
  state.pokemons = [makePokemon({ species_en: 'Eevee', species_fr: 'Évoli', dex: 133 })];
  const p = roundTrip(state).pokemons[0];
  assert.ok(p.species_fr, 'species_fr absent après rechargement');
  assert.equal(p.species_fr, 'Évoli');
});

check('dex reconstruit depuis SPECIES_BY_EN', () => {
  const state = structuredClone(DEFAULT_STATE);
  state.pokemons = [makePokemon({ species_en: 'Dratini', species_fr: 'Minidraco', dex: 147 })];
  const p = roundTrip(state).pokemons[0];
  assert.ok(p.dex !== undefined, 'dex absent après rechargement');
  assert.equal(p.dex, 147);
});

check('valeurs par défaut retirées puis restaurées', () => {
  const state = structuredClone(DEFAULT_STATE);
  state.pokemons = [makePokemon({ assignedTo: null, cooldown: 0, homesick: false, favorite: false, xp: 0 })];
  const p = roundTrip(state).pokemons[0];
  const expected = { assignedTo: null, cooldown: 0, homesick: false, favorite: false, xp: 0 };
  for (const [k, v] of Object.entries(expected)) {
    assert.deepEqual(p[k], v, `champ "${k}" : ${JSON.stringify(p[k])} au lieu de ${JSON.stringify(v)}`);
  }
});

console.log('\n── stabilité : un second cycle ne doit plus rien changer ─────────');

check('round-trip idempotent', () => {
  const state = structuredClone(DEFAULT_STATE);
  state.pokemons = [makePokemon(), makePokemon({ id: 'pk-2', species_en: 'Eevee', species_fr: 'Évoli', dex: 133, shiny: true })];
  state.gang.money = 123456;
  state.gang.reputation = 800;

  const once  = roundTrip(state);
  const twice = roundTrip(once);
  // _schemaVersion et les horodatages de migration peuvent bouger : on compare le reste
  const strip = s => { const c = structuredClone(s); delete c._schemaVersion; delete c.lastSave; return c; };
  assert.deepEqual(strip(twice), strip(once), 'le state n’est pas stable entre deux cycles');
});

check('état global non-pokémon préservé', () => {
  const state = structuredClone(DEFAULT_STATE);
  state.gang.money = 987654;
  state.gang.bossName = 'Giovanni';
  state.stats.totalCaught = 42;
  const out = roundTrip(state);
  assert.equal(out.gang.money, 987654, 'money');
  assert.equal(out.gang.bossName, 'Giovanni', 'bossName');
  assert.equal(out.stats.totalCaught, 42, 'totalCaught');
});

check('stock de Poké Balls hérité : remboursé 20₽/unité puis purgé, une seule fois', () => {
  const state = structuredClone(DEFAULT_STATE);
  state.gang.money = 1000;
  state.inventory.pokeball = 17;      // clé morte, présente dans les vieilles saves
  const once = roundTrip(state);
  assert.equal(once.gang.money, 1000 + 17 * 20, 'remboursement attendu au premier chargement');
  assert.ok(!('pokeball' in once.inventory), 'la clé doit être purgée');
  const twice = roundTrip(once);
  assert.equal(twice.gang.money, once.gang.money, 'le remboursement ne doit PAS se redéclencher');
});

console.log('\n── incubateurs retirés : remboursement au prix payé ──────────────');

// Ancien Marché : le k-ième incubateur coûtait 15 000 × 2^k (k = déjà possédés).
// On recalcule en les additionnant un par un plutôt qu'avec la forme fermée du code.
const paidFor = n => Array.from({ length: n }, (_, k) => 15000 * 2 ** k).reduce((a, b) => a + b, 0);

const withIncubators = (n, money = 1000) => {
  const state = structuredClone(DEFAULT_STATE);
  state.gang.money = money;
  state.inventory.incubator = n;   // clé morte, présente dans les saves existantes
  return state;
};

check('chaque quantité rembourse exactement ce qu\'elle a coûté', () => {
  for (const n of [1, 2, 3, 5, 10]) {
    const out = roundTrip(withIncubators(n));
    assert.equal(out.gang.money, 1000 + paidFor(n), n + ' incubateur(s) : ' + out.gang.money + ' au lieu de ' + (1000 + paidFor(n)));
  }
  assert.equal(paidFor(1), 15000, 'garde-fou sur la formule de référence');
  assert.equal(paidFor(10), 15345000, 'garde-fou : 10 incubateurs');
});

check('la clé est purgée et ne revient pas à 0', () => {
  const out = roundTrip(withIncubators(3));
  assert.ok(!('incubator' in out.inventory), 'inventory.incubator = ' + out.inventory.incubator);
});

check('le remboursement ne se rejoue jamais', () => {
  const once = roundTrip(withIncubators(4));
  const twice = roundTrip(once);
  const thrice = roundTrip(twice);
  assert.equal(twice.gang.money, once.gang.money, '2e chargement');
  assert.equal(thrice.gang.money, once.gang.money, '3e chargement');
});

check('zéro incubateur : aucun argent créé', () => {
  assert.equal(roundTrip(withIncubators(0, 5000)).gang.money, 5000);
  const noKey = withIncubators(0, 5000); delete noKey.inventory.incubator;
  assert.equal(roundTrip(noKey).gang.money, 5000, 'save sans la clé');
});

check('au-delà du plafond de 10 : rembourse 10, pas plus', () => {
  const out = roundTrip(withIncubators(25));
  assert.equal(out.gang.money, 1000 + paidFor(10), 'une valeur >10 ne vient que d\'un bug ou d\'une édition');
});

check('quantité non entière ou invalide : jamais NaN ni négatif', () => {
  for (const bad of [2.9, '3', -4, NaN, null, 'abc', Infinity]) {
    const out = roundTrip(withIncubators(bad));
    assert.ok(Number.isFinite(out.gang.money) && out.gang.money >= 1000, JSON.stringify(bad) + ' → ' + out.gang.money);
  }
  assert.equal(roundTrip(withIncubators(2.9)).gang.money, 1000 + paidFor(2), '2.9 est arrondi à 2, pas à 3');
});

check('la bannière de migration mentionne le remboursement', () => {
  const saved = { ...withIncubators(2), _schemaVersion: 17 };
  const fr = getMigrationSummary(saved, deps);
  assert.ok(fr.fields.some(f => /Incubateurs.*rembours/.test(f)), JSON.stringify(fr.fields));
  const en = getMigrationSummary({ ...saved, lang: 'en' }, deps);
  assert.ok(en.fields.some(f => /Incubators.*refunded/.test(f)), JSON.stringify(en.fields));
  const none = getMigrationSummary({ ...withIncubators(0), _schemaVersion: 17 }, deps);
  assert.ok(!none.fields.some(f => /ncubat/i.test(f)), 'ne rien annoncer à qui n\'en avait pas');
});

check('un incubateur ne déclenche plus le cadeau MissingNo', () => {
  const out = roundTrip(withIncubators(25));
  assert.ok(!out.pokemons.some(p => p.species_en === 'missingno'), 'MissingNo ne doit plus venir des incubateurs');
});

check('slimPokemon ne mute pas son entrée', () => {
  const original = makePokemon();
  const copy = structuredClone(original);
  slimPokemon(original);
  assert.deepEqual(original, copy, 'slimPokemon a modifié l’objet source');
});

console.log('');
if (failures.length) {
  console.error(`${failures.length} échec(s) :`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('OK — le cycle sauvegarde/chargement ne perd aucun champ observable.');
