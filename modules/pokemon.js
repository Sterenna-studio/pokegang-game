/* Pokémon module extracted from app.js
 *
 * This module bundles together functions that handle Pokémon creation,
 * evolution, stat calculation, moves, level ups, and related helpers.
 * Each function is exported to the global scope via `globalThis` so
 * existing references in the game code continue to work.  To keep the
 * module self‑contained, it aliases all of its dependencies from
 * `globalThis` (e.g. `pick`, `BALLS`, `NATURES`, etc.), which are
 * populated elsewhere in the application.
 */
(() => {
  // Pull dependencies from the global namespace.  These references point to
  // objects defined in other modules (or the original app.js) and will
  // reflect any updates made at runtime.
  const state          = globalThis.state;
  const pick           = globalThis.pick;
  const NATURE_KEYS    = globalThis.NATURE_KEYS;
  const BALLS          = globalThis.BALLS;
  const isBoostActive  = globalThis.isBoostActive;
  const SPECIES_BY_EN  = globalThis.SPECIES_BY_EN;
  const NATURES        = globalThis.NATURES;
  const randInt        = globalThis.randInt;
  const uid            = globalThis.uid;
  const calculatePrice = globalThis.calculatePrice;
  const speciesName    = globalThis.speciesName;
  const EVO_BY_SPECIES = globalThis.EVO_BY_SPECIES;
  const saveState      = globalThis.saveState;
  const notify         = globalThis.notify;
  const pokeSprite     = globalThis.pokeSprite;
  const playSE         = globalThis.playSE;
  const SFX            = globalThis.SFX;

  /**
   * Choisit une nature aléatoire parmi la liste `NATURE_KEYS`.
   */
  function rollNature() {
    return pick(NATURE_KEYS);
  }

  // Distribution de potentiel unique — indépendante du type de ball.
  // ★1:35% ★2:30% ★3:20% ★4:10% ★5:5%
  const POTENTIAL_DIST = [35, 30, 20, 10, 5];

  /**
   * Tire un potentiel 1–5 selon une distribution fixe.
   * L'Encens Chance ajoute +1 (plafonné à ★5).
   * Le type de ball n'a plus d'effet mécanique — uniquement cosmétique.
   */
  function rollPotential() {
    const r = Math.random() * 100;
    let acc = 0;
    let result = 1;
    for (let i = 0; i < POTENTIAL_DIST.length; i++) {
      acc += POTENTIAL_DIST[i];
      if (r < acc) { result = i + 1; break; }
    }
    if (isBoostActive('incense') && result < 5) result++;
    return result;
  }

  // ── Taux shiny de base par rareté ───────────────────────────────
  // Pokémon rares = plus difficiles à obtenir chromatiques.
  const SHINY_BASE_RATE = {
    common:    1 / 200,   // 0.500 %
    uncommon:  1 / 350,   // 0.286 %
    rare:      1 / 600,   // 0.167 %
    very_rare: 1 / 1000,  // 0.100 %
    legendary: 1 / 2000,  // 0.050 %
  };

  // ── Bonus chaîne (captures de la même espèce) ───────────────────
  // Chaque capture ajoute +5 % au multiplicateur, plafonné à ×6 (à 100 captures).
  // Exemples : 10 cap → ×1.5 | 25 cap → ×2.25 | 50 cap → ×3.5 | 100 cap → ×6
  function _chainBonus(count) {
    return 1 + Math.min(count * 0.05, 5);
  }

  /**
   * Détermine si un Pokémon est shiny.
   * Taux de base selon la rareté de l'espèce.
   * Multiplicateurs : Aura ×5, Chroma Charm ×2, chaîne de captures ×1–×6.
   */
  function rollShiny(speciesEN) {
    const rarity = SPECIES_BY_EN?.[speciesEN]?.rarity ?? 'common';
    let rate = SHINY_BASE_RATE[rarity] ?? SHINY_BASE_RATE.common;

    // Aura Shiny ×1.5
    if (isBoostActive('aura')) rate *= 1.5;

    // Chroma Charm ×2 (achat permanent)
    if (state?.purchases?.chromaCharm) rate *= 2;

    // Bonus chaîne : nb de captures de cette espèce
    const chainCount = globalThis.state?.pokedex?.[speciesEN]?.count ?? 0;
    if (chainCount > 0) rate *= _chainBonus(chainCount);

    return Math.random() < rate;
  }

  /**
   * Tire deux capacités aléatoires uniques depuis la liste du Pokémon.
   */
  function rollMoves(speciesEN) {
    const sp = SPECIES_BY_EN[speciesEN];
    if (!sp) return ['Charge', 'Griffe'];
    const pool = [...sp.moves];
    // Shuffle and pick 2 unique (or as many as available)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const unique = [...new Set(pool)];
    return unique.slice(0, 2);
  }

  /**
   * Calcule les statistiques d'attaque/défense/vitesse d'un Pokémon en
   * fonction de son espèce, de sa nature, de son potentiel et de son niveau.
   */
  function calculateStats(pokemon) {
    const sp = SPECIES_BY_EN[pokemon.species_en];
    if (!sp) return { atk: 10, def: 10, spd: 10 };
    const nat = NATURES[pokemon.nature] || NATURES.hardy;
    const potMult = 1 + pokemon.potential * 0.1;
    const lvlMult = 1 + pokemon.level / 100;
    return {
      atk: Math.round(sp.baseAtk * potMult * nat.atk * lvlMult),
      def: Math.round(sp.baseDef * potMult * nat.def * lvlMult),
      spd: Math.round(sp.baseSpd * potMult * nat.spd * lvlMult),
    };
  }

  /**
   * Génère un nouveau Pokémon en fonction de l'espèce et de la zone.
   * Initialise ses statistiques, son historique et met à jour les stats
   * globales (par ex. le Pokémon le plus cher obtenu).
   */
  function makePokemon(speciesEN, zoneId, ballType = 'pokeball') {
    const sp = SPECIES_BY_EN[speciesEN];
    if (!sp) return null;
    const nature    = rollNature();
    const potential = rollPotential();
    const shiny     = rollShiny(speciesEN);
    const level     = randInt(3, 12);
    const pokemon = {
      id: `pk-${uid()}`,
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
    // Initial history entry
    pokemon.history.push({ type: 'captured', ts: Date.now(), zone: zoneId, ball: ballType });
    // Track most expensive obtained
    const obtainedValue = calculatePrice(pokemon);
    if (!state.stats.mostExpensiveObtained || obtainedValue > (state.stats.mostExpensiveObtained.price || 0)) {
      state.stats.mostExpensiveObtained = { name: speciesName(pokemon.species_en), price: obtainedValue };
    }
    return pokemon;
  }

  /**
   * Calcule la puissance globale d'un Pokémon en sommant ses stats et en
   * appliquant un malus s'il a le mal du pays.
   */
  function getPokemonPower(pokemon) {
    const s = pokemon.stats;
    return Math.round((s.atk + s.def + s.spd) * (pokemon.homesick ? 0.75 : 1));
  }

  /**
   * Vérifie si le Pokémon peut évoluer selon les règles d'évolution de son espèce.
   */
  function checkEvolution(pokemon) {
    const evos = EVO_BY_SPECIES[pokemon.species_en];
    if (!evos) return null;
    for (const evo of evos) {
      if (evo.req === 'item') continue; // item evolutions handled separately
      if (typeof evo.req === 'number' && pokemon.level >= evo.req) {
        return evo;
      }
    }
    return null;
  }

  /**
   * Fait évoluer le Pokémon vers une nouvelle espèce en mettant à jour ses
   * propriétés et le Pokédex.  Retourne true si l'évolution a eu lieu.
   */
  function evolvePokemon(pokemon, targetEN) {
    const sp = SPECIES_BY_EN[targetEN];
    if (!sp) return false;
    const oldName = speciesName(pokemon.species_en);
    pokemon.species_en = sp.en;
    pokemon.species_fr = sp.fr;
    pokemon.dex = sp.dex;
    pokemon.stats = calculateStats(pokemon);
    pokemon.moves = rollMoves(sp.en);
    if (pokemon.history) {
      pokemon.history.push({ type: 'evolved', ts: Date.now(), from: oldName, to: speciesName(sp.en) });
    }
    // Update pokedex
    if (!state.pokedex[sp.en]) {
      state.pokedex[sp.en] = { seen: true, caught: true, shiny: pokemon.shiny, count: 1 };
    } else {
      state.pokedex[sp.en].caught = true;
      state.pokedex[sp.en].count++;
    }
    showPokemonLevelPopup(pokemon, pokemon.level);
    notify(`${oldName} ${state.lang === 'fr' ? 'évolue en' : 'evolved into'} ${speciesName(sp.en)} !`, 'gold');
    SFX.play('evolve'); // Evolution fanfare
    saveState();
    return true;
  }

  /**
   * Tente d'évoluer automatiquement un Pokémon en fonction de son niveau.
   */
  function tryAutoEvolution(pokemon) {
    const evo = checkEvolution(pokemon);
    if (evo) {
      evolvePokemon(pokemon, evo.to);
      return true;
    }
    return false;
  }

  /**
   * Affiche une pop‑up de niveau lorsque le Pokémon gagne un niveau.
   */
  function showPokemonLevelPopup(pokemon, newLevel) {
    // Routed to notification panel — no more overlapping floating divs
    globalThis._npanel_push?.({
      category: 'levelup',
      title:    `${speciesName(pokemon.species_en)} → Lv.${newLevel} !`,
      type:     'gold',
    });
  }

  /**
   * Augmente l'XP du Pokémon et gère les passages de niveau, l'évolution
   * automatique et les notifications associées.  Retourne true si un niveau
   * a été gagné.
   */
  function levelUpPokemon(pokemon, xpGain) {
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
      // Show popup only for boss team / active training (not passive background XP spam)
      const isBossTeam   = state.gang.bossTeam.includes(pokemon.id);
      const isInTraining = state.trainingRoom?.pokemon?.includes(pokemon.id);
      if (isBossTeam || isInTraining) {
        playSE('level_up', 0.5);
        showPokemonLevelPopup(pokemon, pokemon.level);
        SFX.play('levelUp');
      }
    }
    return leveled;
  }

  // Attach all exported functions to the global scope.  This preserves
  // backwards compatibility with code that still expects to find them on
  // `window`.
  Object.assign(globalThis, {
    rollNature,
    rollPotential,
    rollShiny,
    rollMoves,
    calculateStats,
    makePokemon,
    getPokemonPower,
    checkEvolution,
    evolvePokemon,
    tryAutoEvolution,
    showPokemonLevelPopup,
    levelUpPokemon,
  });
})();