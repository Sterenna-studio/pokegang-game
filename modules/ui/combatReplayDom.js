'use strict';

// Shared DOM layer for standard zone combats, raids and permanent event
// trainers. Business rules and rewards deliberately stay in their callers;
// this module only owns HUD controls and visual replay primitives.

export function bindCombatHudControls(hud, { onSpeed = null, onAction = null } = {}) {
  const speedButton = hud?.querySelector?.('.zchud-speed') ?? null;
  const actionButton = hud?.querySelector?.('.zchud-flee') ?? null;

  if (speedButton) {
    speedButton.onclick = typeof onSpeed === 'function'
      ? event => onSpeed({ event, button: speedButton, hud })
      : null;
  }
  if (actionButton) actionButton.onclick = typeof onAction === 'function' ? onAction : null;

  return { speedButton, actionButton };
}

export function mountCombatHud({
  documentRef = globalThis.document,
  viewport,
  zoneId,
  html,
  onSpeed = null,
  onAction = null,
} = {}) {
  if (!documentRef?.createElement || !viewport?.appendChild) return null;
  const hud = documentRef.createElement('div');
  hud.className = 'zone-combat-hud zone-combat-hud-minimal';
  hud.id = `zchud-${zoneId}`;
  hud.innerHTML = html || '';
  viewport.appendChild(hud);
  return { hud, ...bindCombatHudControls(hud, { onSpeed, onAction }) };
}

export function setCombatHudAction(hud, {
  label,
  disabled = false,
  onAction = null,
} = {}) {
  const button = hud?.querySelector?.('.zchud-flee') ?? null;
  if (!button) return null;
  if (label !== undefined) button.textContent = label;
  button.disabled = !!disabled;
  button.onclick = typeof onAction === 'function' ? onAction : null;
  return button;
}

export function createCombatReplayRunner({
  items = [],
  isActive = () => true,
  schedule,
  onItem = () => {},
  onComplete = () => {},
  getDelay = () => 0,
  initialDelay = 0,
} = {}) {
  let index = 0;
  let started = false;
  let completed = false;

  function step() {
    if (completed || !isActive()) return false;
    if (index >= items.length) {
      completed = true;
      onComplete();
      return true;
    }

    const itemIndex = index;
    const item = items[index++];
    onItem(item, itemIndex);
    if (!isActive()) return false;
    schedule?.(step, getDelay(item, itemIndex));
    return true;
  }

  function start() {
    if (started || completed || !isActive()) return false;
    started = true;
    schedule?.(step, initialDelay);
    return true;
  }

  return {
    start,
    step,
    getIndex: () => index,
    isCompleted: () => completed,
  };
}

export function createCombatReplayPresenter({
  documentRef = globalThis.document,
  combat,
  playerAnchor,
  enemyOverlayAnchor,
  resolveEnemySpriteAnchor = () => enemyOverlayAnchor,
  makeOverlay,
  setHpBar,
  renderSprite,
  speciesName = value => value,
  playerSpriteUrl,
  enemySpriteUrl,
  playerSpriteStyle = () => 'width:40px;height:40px;image-rendering:pixelated',
  enemySpriteStyle = () => 'width:56px;height:56px;image-rendering:pixelated',
  enemySpriteClass = 'combat-enemy-pk',
  enemySpriteSelector = '.combat-enemy-pk',
  logLine = () => {},
  formatAttack = () => '',
  formatFaint = turn => `${speciesName(turn.species_en)} K.O.`,
  playHitEffect = () => {},
  scheduleVisual,
  onSwitch = null,
} = {}) {
  let playerOverlay = null;
  let enemyOverlay = null;
  let playerSpriteHost = null;
  let enemySprite = null;

  function ensurePlayerOverlay() {
    if (!playerAnchor) return null;
    if (!playerOverlay) {
      playerOverlay = makeOverlay?.(playerAnchor, 'player') ?? null;
      playerSpriteHost = documentRef?.createElement?.('div') ?? null;
      if (playerSpriteHost) {
        playerSpriteHost.className = 'combat-sent-pk';
        playerAnchor.appendChild(playerSpriteHost);
      }
    }
    return playerOverlay;
  }

  function ensureEnemyOverlay() {
    if (!enemyOverlayAnchor) return null;
    if (!enemyOverlay) enemyOverlay = makeOverlay?.(enemyOverlayAnchor, 'enemy') ?? null;
    return enemyOverlay;
  }

  function switchTurn(turn) {
    const previous = combat.active[turn.side];
    const spriteUrl = turn.side === 'player'
      ? playerSpriteUrl?.(turn)
      : enemySpriteUrl?.(turn);
    const active = {
      side: turn.side,
      index: turn.teamIndex,
      oldIndex: previous?.index ?? null,
      trainerIndex: turn.trainerIndex ?? 0,
      pokemonIndex: turn.pokemonIndex ?? turn.teamIndex,
      species_en: turn.species_en,
      hp: turn.hp,
      maxHp: turn.maxHp,
      spriteUrl,
    };
    combat.active[turn.side] = active;

    if (turn.side === 'player') {
      const overlay = ensurePlayerOverlay();
      if (overlay) {
        overlay.name.textContent = `${speciesName(turn.species_en)} Lv.${turn.level}`;
        setHpBar?.(overlay, turn.hp, turn.maxHp);
      }
      if (playerSpriteHost) {
        renderSprite?.({
          anchor: playerSpriteHost,
          previous: playerSpriteHost.querySelector?.('.combat-player-pk') ?? null,
          src: spriteUrl,
          alt: speciesName(turn.species_en),
          className: 'combat-player-pk',
          style: playerSpriteStyle(turn),
          insertBefore: false,
        });
      }
    } else {
      const overlay = ensureEnemyOverlay();
      if (overlay) {
        overlay.name.textContent = `${speciesName(turn.species_en)} Lv.${turn.level}`;
        setHpBar?.(overlay, turn.hp, turn.maxHp);
      }
      const spriteAnchor = resolveEnemySpriteAnchor(turn, enemySprite) || enemyOverlayAnchor;
      if (enemySprite?.parentNode && enemySprite.parentNode !== spriteAnchor) enemySprite.remove?.();
      if (spriteAnchor) {
        enemySprite = renderSprite?.({
          anchor: spriteAnchor,
          previous: enemySprite || spriteAnchor.querySelector?.(enemySpriteSelector) || null,
          src: spriteUrl,
          alt: speciesName(turn.species_en),
          className: enemySpriteClass,
          style: enemySpriteStyle(turn),
        }) ?? null;
      }
    }

    onSwitch?.({ turn, previous, active, spriteUrl, playerSpriteHost, enemySprite });
    logLine(`${speciesName(turn.species_en)} entre en jeu !`);
    return true;
  }

  function attackTurn(turn) {
    const text = formatAttack(turn);
    if (text) logLine(text);
    const targetOverlay = turn.side === 'player' ? ensureEnemyOverlay() : ensurePlayerOverlay();
    setHpBar?.(targetOverlay, turn.defenderHp, turn.defenderMaxHp);
    const targetSide = turn.side === 'player' ? 'enemy' : 'player';
    const activeTarget = combat.active[targetSide];
    if (activeTarget && turn.defenderIndex === activeTarget.index) activeTarget.hp = turn.defenderHp;
    const targetSprite = turn.side === 'player'
      ? (enemySprite || enemyOverlayAnchor)
      : (playerSpriteHost || playerAnchor);
    playHitEffect(targetSprite, scheduleVisual);
    return true;
  }

  function faintTurn(turn) {
    const text = formatFaint(turn);
    if (text) logLine(text);
    const active = combat.active[turn.side];
    if (active?.index === turn.teamIndex) active.hp = 0;
    const sprite = turn.side === 'enemy'
      ? enemySprite
      : playerSpriteHost?.querySelector?.('.combat-player-pk');
    sprite?.classList?.remove('combat-hit');
    sprite?.classList?.add('fainted');
    return true;
  }

  function handle(turn) {
    if (turn?.type === 'switch') return switchTurn(turn);
    if (turn?.type === 'attack') return attackTurn(turn);
    if (turn?.type === 'faint') return faintTurn(turn);
    return false;
  }

  return {
    handle,
    switchTurn,
    attackTurn,
    faintTurn,
    ensurePlayerOverlay,
    ensureEnemyOverlay,
    getPlayerSpriteHost: () => playerSpriteHost,
    getEnemySprite: () => enemySprite,
  };
}
