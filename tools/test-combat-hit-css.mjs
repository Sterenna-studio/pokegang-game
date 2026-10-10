// Garde-fou #93 : l'effet de coup ne doit pas relancer l'apparition des
// sprites de combat. Les deux classes écrivent la même propriété `animation` ;
// si la règle .combat-hit d'un sprite ne garde pas combatPkAppear dans sa
// liste, retirer .combat-hit recrée l'animation d'apparition (opacité 0) et
// le Pokémon clignote après chaque coup.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = (await readFile(new URL('../css/game-ui.css', import.meta.url), 'utf8'))
  .replace(/\/\*[\s\S]*?\*\//g, '');

function animationsFor(selector) {
  const out = [];
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const list = selectors.split(',').map(s => s.trim());
    if (!list.includes(selector)) continue;
    const m = body.match(/(?:^|;)\s*animation\s*:\s*([^;]+)/);
    if (m) out.push(m[1].trim());
  }
  return out;
}

for (const base of ['.combat-enemy-pk', '.combat-sent-pk']) {
  const appear = animationsFor(base);
  assert.ok(appear.some(a => a.startsWith('combatPkAppear')),
    `${base} doit jouer combatPkAppear à l'entrée`);

  const hit = animationsFor(`${base}.combat-hit`);
  assert.equal(hit.length, 1, `${base}.combat-hit doit avoir sa propre règle d'animation`);
  const names = hit[0].split(',').map(part => part.trim().split(/\s+/)[0]);
  assert.equal(names[0], 'combatPkAppear',
    `${base}.combat-hit doit garder combatPkAppear au premier rang pour ne pas la relancer`);
  assert.ok(names.includes('combatHit'), `${base}.combat-hit doit jouer combatHit`);
}

console.log('✓ combat hit CSS: l\'effet de coup ne relance pas l\'apparition des sprites');
