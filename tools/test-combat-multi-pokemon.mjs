import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const species = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
globalThis.SPECIES_BY_EN = Object.fromEntries(species.map((name) => [name, {
  en: name,
  fr: name,
  types: ['Normal'],
  baseAtk: 50,
  baseDef: 50,
  baseSpd: 50,
}]));
globalThis.MOVES_DATA = {
  Impact: { type: 'Normal', basePower: 120, category: 'physical' },
};
globalThis.rollMoves = () => ['Impact'];
globalThis.getTypeEffectiveness = () => 1;

const { resolveEventBattle } = await import('../modules/systems/eventCombat.js');
const { getTrainerPokemonEntries } = await import('../modules/systems/zoneCombat.js');
const {
  createCombatSequenceManager,
  isCombatSpriteVisible,
  nextCombatSpeed,
  normalizeCombatSpeed,
  renderCombatPokemonSprite,
  resumeCombatSpawnExpiry,
  scaleCombatDelay,
  suspendCombatSpawnExpiry,
  warnIfActiveEnemySpriteMissing,
} = await import('../modules/ui/combatSequence.js');
const { FALLBACK_POKEMON_SVG } = await import('../data/assets-data.js');
const { DEFAULT_STATE } = await import('../state/defaultState.js');

assert.equal(DEFAULT_STATE.settings.combatSpeed, 1);
assert.equal(normalizeCombatSpeed(undefined), 1);
assert.equal(normalizeCombatSpeed('5'), 5);
assert.equal(normalizeCombatSpeed(42), 1);
assert.deepEqual([nextCombatSpeed(1), nextCombatSpeed(5), nextCombatSpeed(100)], [5, 100, 1]);
assert.deepEqual([scaleCombatDelay(650, 1), scaleCombatDelay(650, 5), scaleCombatDelay(650, 100)], [650, 130, 16]);

function pokemon(species_en, { atk = 100, def = 10, spd = 100 } = {}) {
  return { species_en, level: 1, stats: { atk, def, spd }, moves: ['Impact'] };
}

function switchIndexes(battle, side) {
  return battle.turns.filter(turn => turn.type === 'switch' && turn.side === side)
    .map(turn => turn.teamIndex);
}

function assertNoFaintedAttackerActs(battle) {
  const fainted = { player: new Set(), enemy: new Set() };
  for (const turn of battle.turns) {
    if (turn.type === 'faint') fainted[turn.side].add(turn.teamIndex);
    if (turn.type === 'attack') {
      assert.equal(fainted[turn.side].has(turn.attackerIndex), false,
        `${turn.side} ${turn.attackerIndex} attacked after fainting`);
    }
  }
}

function assertSwitchesProgressToAttack(battle, side) {
  battle.turns.forEach((turn, index) => {
    if (turn.type !== 'switch' || turn.side !== side) return;
    const nextAttack = battle.turns.slice(index + 1).find(candidate => candidate.type === 'attack');
    assert.ok(nextAttack, `${side} switch ${turn.teamIndex} did not progress to another turn`);
    assert.ok(
      (nextAttack.side === side && nextAttack.attackerIndex === turn.teamIndex)
      || (nextAttack.side !== side && nextAttack.defenderIndex === turn.teamIndex),
      `${side} switch ${turn.teamIndex} was not the active combatant on the next attack`,
    );
  });
}

// A. Standard 3v3: two consecutive enemy replacements are explicit and
// ordered. The unused player reserves ensure the real team shape is 3v3.
{
  const battle = resolveEventBattle({
    playerTeam: [
      pokemon('alpha', { atk: 500, def: 500, spd: 500 }),
      pokemon('bravo'),
      pokemon('charlie'),
    ],
    enemyTeam: [pokemon('delta'), pokemon('echo'), pokemon('foxtrot')],
    random: () => 0,
  });
  assert.equal(battle.win, true);
  assert.deepEqual(switchIndexes(battle, 'enemy'), [0, 1, 2]);
  assert.equal(battle.enemyFinal.every(enemy => enemy.hp === 0 && enemy.fainted), true);
  assert.equal(battle.turns.filter(turn => turn.type === 'switch' && turn.side === 'enemy')
    .every(turn => turn.hp === turn.maxHp && turn.hp > 0), true);
  assertSwitchesProgressToAttack(battle, 'enemy');
  assertNoFaintedAttackerActs(battle);
}

// B. Player replacement after K.O.
{
  const battle = resolveEventBattle({
    playerTeam: [
      pokemon('alpha', { atk: 10, def: 10, spd: 10 }),
      pokemon('bravo', { atk: 10, def: 10, spd: 10 }),
      pokemon('charlie', { atk: 10, def: 10, spd: 10 }),
    ],
    enemyTeam: [pokemon('delta', { atk: 500, def: 500, spd: 500 })],
    random: () => 0,
  });
  assert.equal(battle.win, false);
  assert.deepEqual(switchIndexes(battle, 'player'), [0, 1, 2]);
  assertSwitchesProgressToAttack(battle, 'player');
  assertNoFaintedAttackerActs(battle);
}

// C. Raid roster flattening retains trainer/pokemon identity while the shared
// battle engine performs at least two enemy transitions.
{
  const raid = {
    type: 'raid',
    isRaid: true,
    raidTrainers: [
      { key: 'rocket-a', trainer: { fr: 'A' }, team: [pokemon('delta'), pokemon('echo')] },
      { key: 'rocket-b', trainer: { fr: 'B' }, team: [pokemon('foxtrot')] },
    ],
  };
  const entries = getTrainerPokemonEntries(raid);
  assert.deepEqual(entries.map(entry => [entry.trainerIndex, entry.index]), [[0, 0], [0, 1], [1, 0]]);
  const enemyTeam = entries.map(entry => ({
    ...entry.pokemon,
    combatMeta: {
      trainerIndex: entry.trainerIndex,
      pokemonIndex: entry.index,
      trainerKey: entry.trainerKey,
    },
  }));
  const battle = resolveEventBattle({
    playerTeam: [pokemon('alpha', { atk: 500, def: 500, spd: 500 }), pokemon('bravo'), pokemon('charlie')],
    enemyTeam,
    random: () => 0,
  });
  const switches = battle.turns.filter(turn => turn.type === 'switch' && turn.side === 'enemy');
  assert.deepEqual(switches.map(turn => turn.teamIndex), [0, 1, 2]);
  assert.deepEqual(switches.map(turn => turn.trainerIndex), [0, 0, 1]);
  assertSwitchesProgressToAttack(battle, 'enemy');
}

function makeFakeImage(anchor) {
  const classes = new Set();
  return {
    parentNode: null,
    ownerDocument: anchor.ownerDocument,
    dataset: {},
    style: { cssText: '', display: 'none', visibility: 'hidden', opacity: '0', transform: 'scale(0)' },
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
    },
    removeAttribute(name) { if (name === 'hidden') this.hidden = false; },
    isConnected: true,
    hidden: true,
  };
}

function makeFakeAnchor() {
  const anchor = {
    children: [],
    firstChild: null,
    ownerDocument: null,
    appendChild(node) { node.parentNode = this; this.children.push(node); this.firstChild ||= node; },
    insertBefore(node) { node.parentNode = this; this.children.unshift(node); this.firstChild = node; },
  };
  anchor.ownerDocument = {
    defaultView: { getComputedStyle: node => node.style },
    createElement: () => makeFakeImage(anchor),
  };
  return anchor;
}

// D. A failed network sprite becomes the explicit SVG fallback; reusing that
// same img for the next opponent restores every visibility-affecting field.
{
  const anchor = makeFakeAnchor();
  let img = renderCombatPokemonSprite({
    anchor,
    src: 'https://invalid.test/missing.png',
    alt: 'delta',
    className: 'combat-enemy-pk',
    style: 'width:56px;height:56px',
  });
  assert.equal(isCombatSpriteVisible(img), true);
  assert.equal(img.parentNode, anchor);
  assert.equal(anchor.children.length, 1);
  img.onerror();
  assert.equal(img.src, FALLBACK_POKEMON_SVG);
  assert.equal(img.classList.contains('combat-sprite-fallback'), true);
  assert.equal(isCombatSpriteVisible(img), true);

  img.style.display = 'none';
  img.style.visibility = 'hidden';
  img.style.opacity = '0';
  img = renderCombatPokemonSprite({
    anchor,
    previous: img,
    src: 'https://valid.test/next.png',
    alt: 'echo',
    className: 'combat-enemy-pk',
    style: 'width:56px;height:56px',
  });
  assert.equal(img.src, 'https://valid.test/next.png');
  assert.equal(img.style.display, 'block');
  assert.equal(img.style.visibility, 'visible');
  assert.equal(img.style.opacity, '1');
  assert.equal(isCombatSpriteVisible(img), true);
}

// E. Old timer callbacks are harmless after a newer combat generation starts,
// and completion can only happen once.
{
  let nextTimer = 0;
  const callbacks = new Map();
  const cleared = new Set();
  const manager = createCombatSequenceManager({
    setTimeoutRef(fn) { const id = ++nextTimer; callbacks.set(id, fn); return id; },
    clearTimeoutRef(id) { cleared.add(id); },
  });
  let mutations = 0;
  const first = manager.begin({ zoneId: 'test-zone' });
  const staleTimer = manager.schedule(first, () => { mutations += 100; }, 10);
  const second = manager.begin({ zoneId: 'test-zone' });
  assert.equal(cleared.has(staleTimer), true);
  callbacks.get(staleTimer)(); // simulate a callback already queued by the browser
  assert.equal(mutations, 0);
  const liveTimer = manager.schedule(second, () => { mutations += 1; }, 10);
  callbacks.get(liveTimer)();
  assert.equal(mutations, 1);
  let ended = 0;
  assert.equal(manager.finish(second, () => { ended += 1; }), true);
  assert.equal(manager.finish(second, () => { ended += 1; }), false);
  assert.equal(ended, 1);
}

// The encounter TTL is suspended while combat owns its DOM anchor and can be
// resumed only for a pre-start flee.
{
  const cleared = [];
  const spawn = { timeout: 77, expiresAt: 6000 };
  const remaining = suspendCombatSpawnExpiry(spawn, { now: 1000, clearTimeoutRef: id => cleared.push(id) });
  assert.deepEqual(cleared, [77]);
  assert.equal(remaining, 5000);
  assert.equal(spawn.timeout, null);
  let scheduled = null;
  resumeCombatSpawnExpiry(spawn, () => {}, {
    now: 2000,
    setTimeoutRef(fn, delay) { scheduled = { fn, delay }; return 88; },
  });
  assert.equal(scheduled.delay, 5000);
  assert.equal(spawn.timeout, 88);

  const persistentSpawn = { timeout: null, expiresAt: null };
  suspendCombatSpawnExpiry(persistentSpawn, { now: 1000, clearTimeoutRef: () => assert.fail('no timer to clear') });
  const resumed = resumeCombatSpawnExpiry(persistentSpawn, () => assert.fail('persistent spawn must not expire'), {
    now: 2000,
    setTimeoutRef: () => assert.fail('persistent spawn must not be scheduled'),
  });
  assert.equal(resumed, null);
}

// Watchdog: logical enemy alive + detached sprite must warn, never alter flow.
{
  const warnings = [];
  const warned = warnIfActiveEnemySpriteMissing({
    sequenceId: 9,
    zoneId: 'test-zone',
    spawnId: 'spawn-1',
    enemy: { index: 1, species_en: 'echo', hp: 12, spriteUrl: 'missing.png' },
    spriteEl: null,
    warn: (...args) => warnings.push(args),
  });
  assert.equal(warned, true);
  assert.equal(warnings.length, 1);
}

// Wiring regression for the original issue: the live UI must suspend the TTL
// and reject a stale TTL removal while its sequence owns the spawn.
{
  const source = await readFile(new URL('../modules/ui/zoneWindows.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../css/game-ui.css', import.meta.url), 'utf8');
  assert.match(source, /suspendCombatSpawnExpiry\(spawnObj\)/);
  assert.match(source, /combatSequences\.isActive\(currentCombat\.sequence\)/);
  assert.match(source, /EventBus\.emit\(EVENTS\.COMBAT_SEQUENCE_ENDED, \{ zoneId, sequenceId:/);
  assert.match(source, /raidTrainerLineupHtml\(spawnObj\)/);
  assert.match(source, /data-raid-trainer-index="\$\{trainerIndex\}"/);
  assert.match(source, /trainerSlot\?\.classList\.add\('is-active'\)/);
  assert.match(source, /enemySpriteAnchor = pokemonSlot/);
  assert.match(source, /combatSpeedButtonHtml\(\)/);
  assert.match(source, /scaleCombatDelay\(ms, getCombatSpeed\(\)\)/);
  assert.match(css, /\.raid-trainer-pokemon-slot:not\(:empty\) \{ width: 56px; \}/);
  assert.match(css, /\.zone-spawn\.zone-spawn-battle \.raid-trainer-lineup \{ scale: 1 1; \}/);
  assert.match(css, /\.zchud-speed \{/);
}

console.log('✓ combat multi-Pokémon: transitions, raid trainer lineup, speed control, sprite fallback, TTL and generation guards');
