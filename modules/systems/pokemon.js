'use strict';

// ── Pokémon — création, stats, évolution, montée de niveau ──────────────────
//
// Dépendances classiques (bare name — classic <script> globals) :
//   SPECIES_BY_EN (data/species-data.js), EVO_BY_SPECIES (data/evolutions-data.js)
//
// Dépendances globalThis (ES module imports dans app.js) :
//   NATURE_KEYS, BALLS, NATURES  ← pas des classic scripts !
//   state, pick, uid, randInt, isBoostActive, calculatePrice, speciesName,
//   notify, saveState, SFX, playSE, _npanel_push,
//   resetPcRenderCache, renderPCTab, activeTab, showEvolutionChoicePopup

import {
  POWER_W_ATK, POWER_W_DEF, POWER_W_SPD,
  POWER_SOFT_CAP, POWER_SOFT_RATE,
  POWER_HOMESICK_MULT,
  POWER_SHINY_MULT,
  POWER_VAR_MIN, POWER_VAR_MAX,
} from '../../data/power-config-data.js';

function rollNature() {
  return globalThis.pick?.(globalThis.NATURE_KEYS);
}

function rollPotential(ballType) {
  const BALLS = globalThis.BALLS || {};
  const dist = BALLS[ballType]?.potential || BALLS.pokeball?.potential || [];
  const r = Math.random() * 100;
  let acc = 0;
  let result = 1;
  for (let i = 0; i < dist.length; i++) {
    acc += dist[i];
    if (r < acc) { result = i + 1; break; }
  }
  if (globalThis.isBoostActive?.('incense') && result < 5) result++;
  return result;
}

/**
 * Calcule si un Pokémon est shiny.
 * @param {number} [bonusRate=0] — bonus additif au taux de base (ex: 0.05 pour +5% zone niveau 10)
 */
function rollShiny(bonusRate = 0) {
  let rate = globalThis.isBoostActive?.('aura') ? 0.025 : 0.005;
  if (globalThis.state?.purchases?.chromaCharm) rate *= 2;
  rate += bonusRate;
  return Math.random() < rate;
}

function rollMoves(speciesEN) {
  const sp = SPECIES_BY_EN[speciesEN];
  if (!sp) return ['Charge', 'Griffe'];
  const pool = [...sp.moves];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const unique = [...new Set(pool)];
  return unique.slice(0, 2);
}

function calculateStats(pokemon) {
  const sp = SPECIES_BY_EN[pokemon.species_en];
  if (!sp) return { atk: 10, def: 10, spd: 10 };
  const NATURES = globalThis.NATURES || {};
  const nat = NATURES[pokemon.nature] || NATURES.hardy || { atk: 1, def: 1, spd: 1 };
  const potMult = 1 + pokemon.potential * 0.1;
  const lvlMult = 1 + pokemon.level / 100;
  return {
    atk: Math.round(sp.baseAtk * potMult * nat.atk * lvlMult),
    def: Math.round(sp.baseDef * potMult * nat.def * lvlMult),
    spd: Math.round(sp.baseSpd * potMult * nat.spd * lvlMult),
  };
}

/**
 * Crée un Pokémon capturé.
 * @param {string} speciesEN
 * @param {string} zoneId
 * @param {string} [ballType='pokeball']
 * @param {{ shinyBonus?: number }} [spawnCtx={}] — bonus de spawn injectés par spawnInZone (zone level)
 */
function makePokemon(speciesEN, zoneId, ballType = 'pokeball', spawnCtx = {}) {
  const state = globalThis.state;
  const sp = SPECIES_BY_EN[speciesEN];
  if (!sp) return null;
  const nature    = rollNature();
  const potential = rollPotential(ballType);
  const shiny     = rollShiny(spawnCtx.shinyBonus || 0);
  const level     = globalThis.randInt(3, 12);
  const pokemon = {
    id: `pk-${globalThis.uid()}`,
    species_fr: sp.fr,
    species_en: sp.en,
    dex: sp.dex,
    level,
    xp: 0,
    nature,
    potential,
    shiny,
    moves: rollMoves(speciesEN),
    capturedIn: zoneId,
    // Variance individuelle : tirée une seule fois à la capture, jamais re-rollée.
    // Range [POWER_VAR_MIN, POWER_VAR_MAX] — "personnalité" de l'individu.
    pcVariance: parseFloat((POWER_VAR_MIN + Math.random() * (POWER_VAR_MAX - POWER_VAR_MIN)).toFixed(3)),
    stats: {},
    assignedTo: null,
    cooldown: 0,
    history: [],
    favorite: false,
  };
  pokemon.stats = calculateStats(pokemon);
  pokemon.history.push({ type: 'captured', ts: Date.now(), zone: zoneId, ball: ballType });
  const obtainedValue = globalThis.calculatePrice?.(pokemon) ?? 0;
  if (!state.stats.mostExpensiveObtained || obtainedValue > (state.stats.mostExpensiveObtained.price || 0)) {
    const name = globalThis.speciesName?.(pokemon.species_en) ?? pokemon.species_en;
    state.stats.mostExpensiveObtained = { name, price: obtainedValue };
  }
  return pokemon;
}

/**
 * Formule partagée de puissance (PC) à partir des stats calculées.
 * Indépendante du Pokémon — utilisable pour les dresseurs et le boss.
 *
 * Poids : ATK > SPD > DEF (rôle offensif/actif valorisé).
 * Soft cap : au-delà de POWER_SOFT_CAP, les gains sont atténués pour
 * limiter les outliers DEF-lourds (ex-meta Crustabri, Steelix…).
 *
 * @param {{ atk: number, def: number, spd: number }} stats
 * @returns {number}
 */
function computePokemonPC(stats) {
  if (!stats) return 0;
  const raw = (stats.atk ?? 0) * POWER_W_ATK
            + (stats.def ?? 0) * POWER_W_DEF
            + (stats.spd ?? 0) * POWER_W_SPD;
  return raw <= POWER_SOFT_CAP
    ? raw
    : POWER_SOFT_CAP + (raw - POWER_SOFT_CAP) * POWER_SOFT_RATE;
}

function getPokemonPower(pokemon) {
  if (!pokemon?.stats) return 0;
  const raw = computePokemonPC(pokemon.stats);
  const shinyMult    = pokemon.shiny      ? POWER_SHINY_MULT    : 1;
  const variance     = pokemon.pcVariance ?? 1;
  const homesickMult = pokemon.homesick   ? POWER_HOMESICK_MULT : 1;
  return Math.round(raw * shinyMult * variance * homesickMult);
}

function checkEvolution(pokemon) {
  const evos = EVO_BY_SPECIES[pokemon.species_en];
  if (!evos) return null;
  const valid = evos.filter(e => e.req !== 'item' && typeof e.req === 'number' && pokemon.level >= e.req);
  if (valid.length === 0) return null;
  return valid[Math.floor(Math.random() * valid.length)];
}

function evolvePokemon(pokemon, targetEN) {
  const state = globalThis.state;
  const sp = SPECIES_BY_EN[targetEN];
  if (!sp) return false;
  const oldName = globalThis.speciesName?.(pokemon.species_en) ?? pokemon.species_en;
  pokemon.species_en = sp.en;
  pokemon.species_fr = sp.fr;
  pokemon.dex = sp.dex;
  pokemon.stats = calculateStats(pokemon);
  pokemon.moves = rollMoves(sp.en);
  if (pokemon.history) {
    pokemon.history.push({ type: 'evolved', ts: Date.now(), from: oldName, to: globalThis.speciesName?.(sp.en) ?? sp.en });
  }
  if (!state.pokedex[sp.en]) {
    state.pokedex[sp.en] = { seen: true, caught: true, shiny: pokemon.shiny, count: 1 };
  } else {
    state.pokedex[sp.en].caught = true;
    state.pokedex[sp.en].count++;
    if (pokemon.shiny) state.pokedex[sp.en].shiny = true;
  }
  showPokemonLevelPopup(pokemon, pokemon.level);
  const newName = globalThis.speciesName?.(sp.en) ?? sp.en;
  globalThis.notify?.(`${oldName} ${state.lang === 'fr' ? 'évolue en' : 'evolved into'} ${newName} !`, 'gold');
  globalThis.SFX?.play('evolve');
  globalThis.saveState?.();
  return true;
}

function tryAutoEvolution(pokemon) {
  const evos = EVO_BY_SPECIES[pokemon.species_en];
  if (!evos) return false;
  const valid = evos.filter(e => e.req !== 'item' && typeof e.req === 'number' && pokemon.level >= e.req);
  if (valid.length === 0) return false;

  if (valid.length === 1 || globalThis.state?.settings?.autoEvoChoice) {
    evolvePokemon(pokemon, valid[Math.floor(Math.random() * valid.length)].to);
    return true;
  }

  // Multiple choices + manual mode: show card popup
  globalThis.showEvolutionChoicePopup?.(pokemon, valid, targetEN => {
    evolvePokemon(pokemon, targetEN);
    globalThis.resetPcRenderCache?.();
    if (globalThis.activeTab === 'tabPC') globalThis.renderPCTab?.();
  });
  return false; // évolution en attente du choix utilisateur
}

function showPokemonLevelPopup(pokemon, newLevel) {
  globalThis._npanel_push?.({
    category: 'levelup',
    title:    `${globalThis.speciesName?.(pokemon.species_en) ?? pokemon.species_en} → Lv.${newLevel} !`,
    type:     'gold',
  });
}

function levelUpPokemon(pokemon, xpGain) {
  const state = globalThis.state;
  pokemon.xp += xpGain;
  const xpNeeded = pokemon.level * 20;
  let leveled = false;
  while (pokemon.xp >= xpNeeded && pokemon.level < 100) {
    pokemon.xp -= xpNeeded;
    pokemon.level++;
    leveled = true;
    if (pokemon.history) {
      pokemon.history.push({ type: 'levelup', ts: Date.now(), level: pokemon.level });
    }
  }
  if (leveled) {
    pokemon.stats = calculateStats(pokemon);
    tryAutoEvolution(pokemon);
    const isBossTeam   = state.gang.bossTeam.includes(pokemon.id);
    const isInTraining = state.trainingRoom?.pokemon?.includes(pokemon.id);
    if (isBossTeam || isInTraining) {
      globalThis.playSE?.('level_up', 0.5);
      showPokemonLevelPopup(pokemon, pokemon.level);
      globalThis.SFX?.play('levelUp');
    }
  }
  return leveled;
}

Object.assign(globalThis, {
  rollNature, rollPotential, rollShiny, rollMoves,
  calculateStats, makePokemon, getPokemonPower, computePokemonPC,
  checkEvolution, evolvePokemon, tryAutoEvolution,
  showPokemonLevelPopup, levelUpPokemon,
});

export {};
