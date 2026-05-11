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

function rollShiny() {
  let rate = globalThis.isBoostActive?.('aura') ? 0.025 : 0.005;
  if (globalThis.state?.purchases?.chromaCharm) rate *= 2;
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

function makePokemon(speciesEN, zoneId, ballType = 'pokeball') {
  const state = globalThis.state;
  const sp = SPECIES_BY_EN[speciesEN];
  if (!sp) return null;
  const nature    = rollNature();
  const potential = rollPotential(ballType);
  const shiny     = rollShiny();
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

function getPokemonPower(pokemon) {
  const s = pokemon.stats;
  return Math.round((s.atk + s.def + s.spd) * (pokemon.homesick ? 0.75 : 1));
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
  calculateStats, makePokemon, getPokemonPower,
  checkEvolution, evolvePokemon, tryAutoEvolution,
  showPokemonLevelPopup, levelUpPokemon,
});

export {};
