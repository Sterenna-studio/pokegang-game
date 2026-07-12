import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const source = await readFile(path.join(process.cwd(), 'modules', 'systems', 'agent.js'), 'utf8');

const match = source.match(/const RARITY_XP = \{([^}]+)\};/);
assert.ok(match, 'RARITY_XP table should exist');

const table = Object.fromEntries(
  match[1].split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const [key, value] = part.split(':').map(s => s.trim());
      return [key, Number(value)];
    }),
);

assert.equal(table.common, 3);
assert.equal(table.uncommon, 5);
assert.equal(table.rare, 8);
assert.equal(table.very_rare, 15);
assert.equal(table.legendary, 20);
assert.equal(Object.hasOwn(table, 'epic'), false);
assert.ok(table.rare < table.very_rare);
assert.ok(table.very_rare < table.legendary);

console.log('agent capture XP tests passed');
