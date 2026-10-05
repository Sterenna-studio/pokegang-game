import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import { zoneShinyBonus, shinyRate } from '../modules/systems/shinyRates.js';
import {
  BASE_SHINY_RATE, AURA_SHINY_RATE, CHROMA_CHARM_MULT,
} from '../data/gameplay-config-data.js';
import { ZONE_LEVEL_BONUSES, ZONE_SHINY_BONUS_CAP } from '../data/zones-v2-config.js';

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} !== ${b}`);

// regions-config.js est un script classique : on l'exécute pour lire REGIONS_CONFIG.
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../data/regions-config.js', import.meta.url), 'utf8'), ctx);
const REGIONS = vm.runInContext('REGIONS_CONFIG', ctx);
const region = id => REGIONS.find(r => r.id === id);

const rate = (level, id, { aura = false, charm = false } = {}) => shinyRate({
  base: BASE_SHINY_RATE, aura, auraRate: AURA_SHINY_RATE, charm, charmMult: CHROMA_CHARM_MULT,
  zoneBonus: zoneShinyBonus(region(id), level, ZONE_SHINY_BONUS_CAP),
});

// ── Le taux de base n'a pas bougé ─────────────────────────────────────────────
near(BASE_SHINY_RATE, 0.005, 'base 0,5 %');
near(AURA_SHINY_RATE, 0.025, 'aura 2,5 %');
near(rate(1, 'kanto'), 0.005, 'niveau 1 = base');
near(rate(1, 'kanto', { charm: true }), 0.010, 'charme ×2 sur la base');
near(rate(1, 'kanto', { aura: true }), 0.025, 'aura');

// ── Plus de bonus de +5 à +20 points dans ZONE_LEVEL_BONUSES ──────────────────
for (const [lvl, b] of Object.entries(ZONE_LEVEL_BONUSES)) {
  assert.equal(b.shinyBonus, undefined, `niveau ${lvl} : le bonus chroma vient de la région`);
}

// ── Échelle par région, plafonnée ─────────────────────────────────────────────
near(rate(10, 'kanto'), 0.005 + 0.020, 'Kanto niveau 10');
near(rate(10, 'johto'), 0.005 + 0.025, 'Johto niveau 10');
near(rate(10, 'hoenn'), 0.005 + ZONE_SHINY_BONUS_CAP, 'Hoenn niveau 10 plafonné (3,2 % -> 2,5 %)');
near(rate(10, 'sinnoh'), 0.005 + ZONE_SHINY_BONUS_CAP, 'Sinnoh niveau 10 plafonné (4,2 % -> 2,5 %)');
near(rate(7, 'kanto'), 0.005 + 0.009, 'Kanto niveau 7 (et non plus 5,5 %)');

// ── Le Charme multiplie aussi le bonus de zone ────────────────────────────────
near(rate(10, 'kanto', { charm: true }), (0.005 + 0.020) * 2, 'charme sur le total');
near(rate(10, 'kanto', { aura: true, charm: true }), (0.025 + 0.020) * 2, 'aura + charme + zone');

// ── Monotone et bornée ────────────────────────────────────────────────────────
for (const r of REGIONS) {
  let prev = 0;
  for (let lvl = 1; lvl <= 10; lvl++) {
    const v = rate(lvl, r.id);
    assert.ok(v >= prev, `${r.id} niveau ${lvl} ne décroît pas`);
    assert.ok(v <= 0.005 + ZONE_SHINY_BONUS_CAP + 1e-12, `${r.id} niveau ${lvl} sous le plafond`);
    prev = v;
  }
}

// ── Entrées dégradées ─────────────────────────────────────────────────────────
assert.equal(zoneShinyBonus(null, 5, 1), 0);
assert.equal(zoneShinyBonus({}, 5, 1), 0);
assert.equal(zoneShinyBonus(region('kanto'), 99, 1), 0.020, 'niveau hors borne : dernier palier');
assert.equal(zoneShinyBonus(region('kanto'), 0, 1), 0, 'niveau 0 : premier palier');

console.log('test-shiny-rates: OK');
