import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { nextCombatSpeed } from '../modules/ui/combatSequence.js';
import {
  createCombatReplayPresenter,
  createCombatReplayRunner,
  mountCombatHud,
  setCombatHudAction,
} from '../modules/ui/combatReplayDom.js';

function makeClassList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach(name => values.add(name)),
    remove: (...names) => names.forEach(name => values.delete(name)),
    contains: name => values.has(name),
  };
}

function makeButton(className) {
  return {
    className,
    textContent: '',
    disabled: false,
    onclick: null,
    click() {
      if (!this.disabled) this.onclick?.({ currentTarget: this, target: this });
    },
  };
}

function makeElement(tagName = 'div') {
  const selectors = new Map();
  const element = {
    tagName: tagName.toUpperCase(),
    id: '',
    className: '',
    children: [],
    parentNode: null,
    style: {},
    classList: makeClassList(),
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    querySelector(selector) {
      if (selectors.has(selector)) return selectors.get(selector);
      return this.children.find(child => selector === `.${child.className}`) ?? null;
    },
    remove() {
      if (!this.parentNode) return;
      this.parentNode.children = this.parentNode.children.filter(child => child !== this);
      this.parentNode = null;
    },
    set innerHTML(value) {
      this._innerHTML = value;
      if (value.includes('zchud-speed')) selectors.set('.zchud-speed', makeButton('zchud-speed'));
      if (value.includes('zchud-flee')) selectors.set('.zchud-flee', makeButton('zchud-flee'));
    },
    get innerHTML() { return this._innerHTML || ''; },
  };
  return element;
}

const fakeDocument = { createElement: tagName => makeElement(tagName) };

// DOM wiring: speed cycles through all supported values and the action button
// replaces its flee handler with close instead of accumulating both handlers.
{
  const viewport = makeElement();
  const state = { settings: { combatSpeed: 1 } };
  let saves = 0;
  let flees = 0;
  let closes = 0;
  const mounted = mountCombatHud({
    documentRef: fakeDocument,
    viewport,
    zoneId: 'dom-test',
    html: '<button class="zchud-speed">×1</button><button class="zchud-flee">Fuir</button>',
    onSpeed({ button }) {
      state.settings.combatSpeed = nextCombatSpeed(state.settings.combatSpeed);
      button.textContent = `×${state.settings.combatSpeed}`;
      saves++;
    },
    onAction: () => { flees++; },
  });

  assert.equal(mounted.hud.id, 'zchud-dom-test');
  assert.equal(viewport.children[0], mounted.hud);
  mounted.speedButton.click();
  mounted.speedButton.click();
  mounted.speedButton.click();
  assert.equal(state.settings.combatSpeed, 1);
  assert.equal(mounted.speedButton.textContent, '×1');
  assert.equal(saves, 3);

  mounted.actionButton.click();
  assert.equal(flees, 1);
  setCombatHudAction(mounted.hud, { label: 'Combat en cours', disabled: true });
  mounted.actionButton.click();
  assert.equal(flees, 1, 'disabled in-progress button must not flee');
  setCombatHudAction(mounted.hud, { label: 'Fermer', onAction: () => { closes++; } });
  mounted.actionButton.click();
  assert.equal(flees, 1, 'close must replace the stale flee handler');
  assert.equal(closes, 1);
  assert.equal(mounted.actionButton.textContent, 'Fermer');
}

// Shared runner: ordered steps complete exactly once and stop immediately when
// the owning combat generation is no longer active.
{
  const queued = [];
  const seen = [];
  let active = true;
  let completed = 0;
  const runner = createCombatReplayRunner({
    items: [{ type: 'switch' }, { type: 'attack' }, { type: 'faint' }],
    isActive: () => active,
    schedule: callback => queued.push(callback),
    onItem: item => seen.push(item.type),
    onComplete: () => { completed++; },
  });
  assert.equal(runner.start(), true);
  assert.equal(runner.start(), false);
  while (queued.length) queued.shift()();
  assert.deepEqual(seen, ['switch', 'attack', 'faint']);
  assert.equal(completed, 1);
  assert.equal(runner.isCompleted(), true);

  const staleQueue = [];
  const staleSeen = [];
  active = true;
  const staleRunner = createCombatReplayRunner({
    items: [{ type: 'attack' }],
    isActive: () => active,
    schedule: callback => staleQueue.push(callback),
    onItem: item => staleSeen.push(item.type),
  });
  staleRunner.start();
  active = false;
  staleQueue.shift()();
  assert.deepEqual(staleSeen, []);
}

// Shared presenter: both combat paths now rely on this one state/DOM mutation
// pipeline for switch, attack and faint events.
{
  const playerAnchor = makeElement();
  const enemyAnchor = makeElement();
  const combat = { active: { player: null, enemy: null } };
  const logs = [];
  const hits = [];
  const overlays = {};

  function makeOverlay(_anchor, side) {
    const overlay = { name: { textContent: '' }, fill: { style: {} }, txt: { textContent: '' } };
    overlays[side] = overlay;
    return overlay;
  }
  function setHpBar(overlay, hp, maxHp) {
    if (!overlay) return;
    overlay.fill.style.width = `${Math.round(hp / maxHp * 100)}%`;
    overlay.txt.textContent = `${hp}/${maxHp}`;
  }
  function renderSprite({ anchor, previous, src, className }) {
    const sprite = previous || makeElement('img');
    sprite.src = src;
    sprite.className = className;
    if (!sprite.parentNode) anchor.appendChild(sprite);
    sprite.classList.remove('fainted');
    return sprite;
  }

  const presenter = createCombatReplayPresenter({
    documentRef: fakeDocument,
    combat,
    playerAnchor,
    enemyOverlayAnchor: enemyAnchor,
    makeOverlay,
    setHpBar,
    renderSprite,
    speciesName: value => value.toUpperCase(),
    playerSpriteUrl: turn => `back-${turn.species_en}.png`,
    enemySpriteUrl: turn => `front-${turn.species_en}.png`,
    logLine: text => logs.push(text),
    formatAttack: turn => `${turn.attackerSpecies} attacks`,
    formatFaint: turn => `${turn.species_en} fainted`,
    playHitEffect: target => hits.push(target),
  });

  presenter.handle({ type: 'switch', side: 'enemy', teamIndex: 0, species_en: 'alpha', level: 5, hp: 20, maxHp: 20 });
  assert.equal(combat.active.enemy.index, 0);
  assert.equal(presenter.getEnemySprite().src, 'front-alpha.png');
  presenter.handle({ type: 'attack', side: 'player', attackerSpecies: 'bravo', defenderIndex: 0, defenderHp: 7, defenderMaxHp: 20 });
  assert.equal(combat.active.enemy.hp, 7);
  assert.equal(overlays.enemy.txt.textContent, '7/20');
  assert.equal(hits.at(-1), presenter.getEnemySprite());
  presenter.handle({ type: 'faint', side: 'enemy', teamIndex: 0, species_en: 'alpha' });
  assert.equal(combat.active.enemy.hp, 0);
  assert.equal(presenter.getEnemySprite().classList.contains('fainted'), true);
  presenter.handle({ type: 'switch', side: 'player', teamIndex: 1, species_en: 'charlie', level: 6, hp: 18, maxHp: 18 });
  assert.equal(combat.active.player.index, 1);
  assert.ok(presenter.getPlayerSpriteHost().querySelector('.combat-player-pk'));
  assert.deepEqual(logs, ['ALPHA entre en jeu !', 'bravo attacks', 'alpha fainted', 'CHARLIE entre en jeu !']);
}

// Integration guard: standard and event entry points must both use the shared
// HUD, presenter and runner rather than reintroducing local turn interpreters.
{
  const source = await readFile(new URL('../modules/ui/zoneWindows.js', import.meta.url), 'utf8');
  assert.equal((source.match(/mountCombatHud\(\{/g) || []).length, 2);
  assert.equal((source.match(/onSpeed: handleCombatSpeedClick/g) || []).length, 2);
  assert.equal((source.match(/createCombatReplayPresenter\(\{/g) || []).length, 1);
  assert.equal((source.match(/const presenter = createZoneCombatReplayPresenter\(\{/g) || []).length, 2);
  assert.equal((source.match(/createCombatReplayRunner\(\{/g) || []).length, 2);
  assert.doesNotMatch(source, /function playSwitch\(/);
  assert.doesNotMatch(source, /addEventListener\('click'.*zchud-speed/);
}

console.log('combat replay DOM: shared presenter, runner and button wiring OK');
