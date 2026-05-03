/* Capture module extracted from app.js
 *
 * This module provides the `tryCapture` function, which handles the logic
 * for throwing a ball and capturing a Pokémon.  It deducts the ball from
 * inventory, creates the Pokémon object via `makePokemon`, applies bonus
 * potential, updates the pokédex and stats, logs the capture, triggers
 * notifications (including shiny popups), plays sound effects, and saves
 * state.  All dependencies (state, BALLS, notify, SFX, etc.) are aliased
 * from the global namespace.  The function is attached to `globalThis`
 * for backward compatibility.
 */
(() => {
  // Alias required globals
  const state         = globalThis.state;
  const BALLS         = globalThis.BALLS;
  const notify        = globalThis.notify;
  const SFX           = globalThis.SFX;
  const makePokemon   = globalThis.makePokemon;
  const speciesName   = globalThis.speciesName;
  const showShinyPopup= globalThis.showShinyPopup;
  const addLog        = globalThis.addLog;
  const t             = globalThis.t;
  const saveState     = globalThis.saveState;

  /**
   * Tente de capturer un Pokémon en utilisant la Ball active.
   * @param {string} zoneId - Identifiant de la zone où se déroule la capture.
   * @param {string} speciesEN - Espèce en anglais du Pokémon à capturer.
   * @param {number} bonusPotential - Bonus de potentiel à appliquer (0 par défaut).
   * @returns {object|null} - L'objet Pokémon créé ou null en cas d'échec.
   */
  function tryCapture(zoneId, speciesEN, bonusPotential = 0) {
    const ball = state.activeBall;
    if ((state.inventory[ball] || 0) <= 0) {
      notify(t('no_balls', { ball: BALLS[ball]?.fr || ball }));
      SFX.play('error');
      return null;
    }
    state.inventory[ball]--;
    const pokemon = makePokemon(speciesEN, zoneId, ball);
    if (!pokemon) return null;
    if (bonusPotential > 0) pokemon.potential = Math.min(5, pokemon.potential + bonusPotential);
    state.pokemons.push(pokemon);
    state.stats.totalCaught++;
    // Behavioural log — première capture
    if (!state.behaviourLogs) state.behaviourLogs = {};
    if (!state.behaviourLogs.firstCaptureAt) state.behaviourLogs.firstCaptureAt = Date.now();
    // Zone captures counter
    if (zoneId && state.zones[zoneId]) state.zones[zoneId].captures = (state.zones[zoneId].captures || 0) + 1;
    // Pokedex
    if (!state.pokedex[pokemon.species_en]) {
      state.pokedex[pokemon.species_en] = { seen: true, caught: true, shiny: pokemon.shiny, count: 1 };
    } else {
      state.pokedex[pokemon.species_en].caught = true;
      state.pokedex[pokemon.species_en].count++;
      if (pokemon.shiny) state.pokedex[pokemon.species_en].shiny = true;
    }
    if (pokemon.shiny) state.stats.shinyCaught++;
    // Fabric BG unlock
    globalThis._unlockFabricBg?.(pokemon.dex, pokemon.shiny);
    const name = speciesName(pokemon.species_en);
    const stars = '★'.repeat(pokemon.potential) + '☆'.repeat(5 - pokemon.potential);
    const shinyTag = pokemon.shiny ? ' ✨SHINY✨' : '';
    if (pokemon.shiny) {
      notify(`${name} ${stars}${shinyTag}`, 'gold');
      setTimeout(() => showShinyPopup(pokemon.species_en), 200);
    } else {
      notify(`${name} ${stars}`, pokemon.potential >= 4 ? 'gold' : 'success');
    }
    addLog(t('catch_success', { name }) + ` [${stars}]`);
    // SFX
    SFX.play('capture', pokemon.potential, pokemon.shiny);
    saveState();
    return pokemon;
  }

  // Export the function to the global scope
  Object.assign(globalThis, { tryCapture });
})();