/**
 * Market Module — extracted from app.js section 9
 *
 * Depends on globals set by app.js:
 *   state, BASE_PRICE, POTENTIAL_MULT, NATURES, BALLS, MYSTERY_EGG_POOL,
 *   notify, SFX, saveState, t, addLog, speciesName,
 *   tryAutoIncubate, renderZonesTab, uid, weightedPick, getMysteryEggCost, playSE
 * Depends on globals from regular scripts: SPECIES_BY_EN, POKEMON_GEN1, ZONES
 * Exposes: calculatePrice, getMarketSaturation, decayMarketSales,
 *          removePokemonFromAllAssignments, sellPokemon, BOOST_ITEMS, buyItem
 */

// ════════════════════════════════════════════════════════════════
//  9.  MARKET MODULE
// ════════════════════════════════════════════════════════════════

function calculatePrice(pokemon) {
  const sp = SPECIES_BY_EN[pokemon.species_en];
  if (!sp) return 50;
  const base = globalThis.BASE_PRICE[sp.rarity] || 100;
  const potMult = globalThis.POTENTIAL_MULT[pokemon.potential - 1] || 1;
  const shinyMult = pokemon.shiny ? 10 : 1;
  const nat = globalThis.NATURES[pokemon.nature];
  const natMult = nat ? (nat.atk + nat.def + nat.spd) / 3 : 1;
  return Math.round(base * potMult * shinyMult * natMult);
}

// Returns the supply pressure as a percentage (0 = normal, 60 = max saturation)
function getMarketSaturation(species_en) {
  const sales = globalThis.state.marketSales[species_en];
  if (!sales) return 0;
  return Math.min(60, sales.count * 8);
}

// Decay market sales over time (called on load + periodically)
function decayMarketSales() {
  const state = globalThis.state;
  const now = Date.now();
  const DECAY_PER_HOUR = 1; // lose 1 sale unit per hour
  for (const species of Object.keys(state.marketSales)) {
    const s = state.marketSales[species];
    const hoursElapsed = (now - s.lastSale) / 3600000;
    const decay = Math.floor(hoursElapsed * DECAY_PER_HOUR);
    if (decay > 0) {
      s.count = Math.max(0, s.count - decay);
      s.lastSale = now;
      if (s.count === 0) delete state.marketSales[species];
    }
  }
}

function removePokemonFromAllAssignments(pkId) {
  const state = globalThis.state;
  // Équipe Boss
  state.gang.bossTeam = state.gang.bossTeam.filter(id => id !== pkId);
  // Formation
  if (state.trainingRoom) state.trainingRoom.pokemon = (state.trainingRoom.pokemon || []).filter(id => id !== pkId);
  // Pension
  if (state.pension?.slots) {
    const before = state.pension.slots.length;
    state.pension.slots = state.pension.slots.filter(id => id !== pkId);
    if (state.pension.slots.length < before) state.pension.eggAt = null;
  }
}

function sellPokemon(pokemonIds, _shinyConfirmed = false) {
  const state = globalThis.state;
  // Block noSell pokemon (ex: MissingNo)
  const noSellBlocked = pokemonIds.filter(id => {
    const p = state.pokemons.find(pk => pk.id === id);
    if (!p) return false;
    const species = POKEMON_GEN1.find(s => s.en === p.species_en);
    return species?.noSell === true;
  });
  if (noSellBlocked.length > 0) {
    globalThis.notify('Ce Pokémon ne peut pas être vendu.', 'error');
    pokemonIds = pokemonIds.filter(id => !noSellBlocked.includes(id));
    if (pokemonIds.length === 0) return;
  }
  // Filter out homesick pokemon — they cannot be sold
  const homesickBlocked = pokemonIds.filter(id => {
    const p = state.pokemons.find(pk => pk.id === id);
    return p && p.homesick;
  });
  if (homesickBlocked.length > 0) {
    globalThis.notify('Ce Pokémon souffre du mal du pays et ne peut pas être vendu.', 'error');
    pokemonIds = pokemonIds.filter(id => !homesickBlocked.includes(id));
    if (pokemonIds.length === 0) return;
  }
  // Block pension pokémon
  const pensionSet = globalThis.getPensionSlotIds();
  const pensionBlocked = pokemonIds.filter(id => pensionSet.has(id));
  if (pensionBlocked.length > 0) {
    globalThis.notify('Les Pokémon en pension ne peuvent pas être vendus.', 'error');
    pokemonIds = pokemonIds.filter(id => !pensionSet.has(id));
    if (pokemonIds.length === 0) return;
  }
  // Block training pokémon
  const trainingSet = new Set(state.trainingRoom?.pokemon || []);
  const trainingBlocked = pokemonIds.filter(id => trainingSet.has(id));
  if (trainingBlocked.length > 0) {
    globalThis.notify('Les Pokémon en formation ne peuvent pas être vendus.', 'error');
    pokemonIds = pokemonIds.filter(id => !trainingSet.has(id));
    if (pokemonIds.length === 0) return;
  }
  // Shiny confirmation
  if (!_shinyConfirmed) {
    const shinyIds = pokemonIds.filter(id => state.pokemons.find(p => p.id === id)?.shiny);
    if (shinyIds.length > 0) {
      const names = shinyIds.map(id => globalThis.speciesName(state.pokemons.find(p => p.id === id)?.species_en)).join(', ');
      const modal = document.createElement('div');
      modal.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center';
      modal.innerHTML = `<div style="background:var(--bg-panel);border:2px solid var(--gold);border-radius:var(--radius);padding:20px;max-width:360px;width:92%;display:flex;flex-direction:column;gap:14px">
        <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">⚠ Vente de Chromatique</div>
        <div style="font-size:11px;color:var(--text)">Tu t'apprêtes à vendre <b style="color:#ffcc5a">${shinyIds.length} Pokémon Shiny</b> :<br><span style="font-size:9px;color:#aaa">${names}</span></div>
        <div style="font-size:9px;color:var(--text-dim)">Cette action est irréversible.</div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="shinyCancel" style="font-family:var(--font-pixel);font-size:9px;padding:8px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
          <button id="shinyConfirm" style="font-family:var(--font-pixel);font-size:9px;padding:8px 14px;background:var(--bg);border:1px solid var(--gold);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Vendre quand même</button>
        </div>
      </div>`;
      document.body.appendChild(modal);
      modal.querySelector('#shinyCancel').addEventListener('click', () => modal.remove());
      modal.querySelector('#shinyConfirm').addEventListener('click', () => { modal.remove(); sellPokemon(pokemonIds, true); });
      return;
    }
  }

  let total = 0;
  const toRemove = new Set(pokemonIds);
  // Unassign from agents/boss
  for (const agent of state.agents) {
    agent.team = agent.team.filter(id => !toRemove.has(id));
  }
  state.gang.bossTeam = state.gang.bossTeam.filter(id => !toRemove.has(id));
  // Remove from favorites
  state.favorites = state.favorites.filter(id => !toRemove.has(id));

  for (const id of pokemonIds) {
    const idx = state.pokemons.findIndex(p => p.id === id);
    if (idx === -1) continue;
    const p = state.pokemons[idx];
    const soldPrice = calculatePrice(p);
    total += soldPrice;
    state.pokemons.splice(idx, 1);
    state.stats.totalSold++;
    // Track most expensive sale
    if (!state.stats.mostExpensiveSold || soldPrice > (state.stats.mostExpensiveSold.price || 0)) {
      state.stats.mostExpensiveSold = { name: globalThis.speciesName(p.species_en), price: soldPrice };
    }
  }
  state.gang.money += total;
  state.stats.totalMoneyEarned += total;
  globalThis.notify(globalThis.t('sold', { n: pokemonIds.length, price: total }), 'gold');
  globalThis.addLog(globalThis.t('sold', { n: pokemonIds.length, price: total }));
  globalThis.SFX.play('sell');
  globalThis.saveState();
  return total;
}

const BOOST_ITEMS = new Set(['incense', 'rarescope', 'aura', 'lure', 'superlure']);

function buyItem(itemDef) {
  const state = globalThis.state;
  const actualCost = itemDef.id === 'mysteryegg' ? globalThis.getMysteryEggCost() : itemDef.cost;
  if (state.gang.money < actualCost) {
    globalThis.notify(globalThis.t('not_enough'));
    globalThis.SFX.play('error');
    return false;
  }
  state.gang.money -= actualCost;
  state.stats.totalMoneySpent += actualCost;
  // Behavioural log — premier achat
  if (!state.behaviourLogs) state.behaviourLogs = {};
  if (!state.behaviourLogs.firstPurchaseAt) state.behaviourLogs.firstPurchaseAt = Date.now();

  // ── One-time gang upgrades ────────────────────────────────────
  const GANG_UPGRADES = new Set(['translator', 'autoSellAgent', 'scientist']);
  if (GANG_UPGRADES.has(itemDef.id)) {
    if (state.purchases[itemDef.id]) {
      globalThis.notify(state.lang === 'fr' ? 'Déjà possédé !' : 'Already owned!');
      state.gang.money += actualCost;
      state.stats.totalMoneySpent -= actualCost;
      return false;
    }
    state.purchases[itemDef.id] = true;
    const name = state.lang === 'fr' ? (itemDef.fr || itemDef.id) : (itemDef.en || itemDef.id);
    globalThis.notify(`${name} débloqué !`, 'gold');
    globalThis.saveState();
    return true;
  }

  if (itemDef.id === 'incubator') {
    state.inventory.incubator = (state.inventory.incubator || 0) + 1;
    globalThis.notify(`Incubateur obtenu ! Total: ${state.inventory.incubator}`, 'gold');
    globalThis.saveState();
    return true;
  }

  // ── Permis ailes (coût en items, pas en ₽) ───────────────────
  const WING_PERMIT_ITEMS = new Set(['tourbillon_permit','carillon_permit']);
  if (WING_PERMIT_ITEMS.has(itemDef.id)) {
    if (state.purchases[itemDef.id]) {
      globalThis.notify(state.lang === 'fr' ? 'Déjà possédé !' : 'Already owned!');
      return false;
    }
    const wc = itemDef.wingCost;
    const have = state.inventory[wc.item] || 0;
    if (have < wc.qty) {
      const itemName = wc.item === 'silver_wing' ? 'Argent\'Aile' : 'Arcenci\'Aile';
      globalThis.notify(`Il te faut ${wc.qty}× ${itemName} (tu en as ${have}).`, 'error');
      return false;
    }
    state.inventory[wc.item] -= wc.qty;
    state.purchases[itemDef.id] = true;
    const zone = ZONES.find(z => z.unlockItem === itemDef.id);
    const zLabel = zone ? (state.lang === 'fr' ? zone.fr : zone.en) : '';
    const pName  = state.lang === 'fr' ? itemDef.fr : itemDef.en;
    globalThis.notify(`${pName} obtenu !${zLabel ? ' → ' + zLabel + ' accessible' : ''}`, 'gold');
    globalThis.saveState();
    globalThis.renderZonesTab?.();
    return true;
  }

  const ZONE_UNLOCK_ITEMS = new Set(['map_pallet','casino_ticket','silph_keycard','boat_ticket']);
  if (ZONE_UNLOCK_ITEMS.has(itemDef.id)) {
    if (state.purchases[itemDef.id]) {
      globalThis.notify(state.lang === 'fr' ? 'Déjà possédé !' : 'Already owned!');
      state.gang.money += actualCost; // refund
      state.stats.totalMoneySpent -= actualCost;
      return false;
    }
    state.purchases[itemDef.id] = true;
    const zoneName = ZONES.find(z => z.unlockItem === itemDef.id);
    const name = state.lang === 'fr' ? (itemDef.fr || itemDef.id) : (itemDef.en || itemDef.id);
    const zLabel = zoneName ? (state.lang === 'fr' ? zoneName.fr : zoneName.en) : '';
    globalThis.notify(`${name} obtenu !${zLabel ? ' → ' + zLabel + ' accessible' : ''}`, 'gold');
    globalThis.saveState();
    globalThis.renderZonesTab?.();
    return true;
  }

  if (itemDef.id === 'mysteryegg') {
    const species_en = globalThis.weightedPick(globalThis.MYSTERY_EGG_POOL);
    const potential = Math.random() < 0.1 ? 3 : Math.random() < 0.4 ? 2 : 1;
    const shiny = Math.random() < 0.02;
    state.eggs.push({ id: globalThis.uid(), species_en, hatchAt: null, incubating: false, potential, shiny, mystery: true });
    state.purchases.mysteryEggCount = (state.purchases.mysteryEggCount || 0) + 1;
    globalThis.tryAutoIncubate();
    globalThis.notify(`🥚 Un œuf mystérieux est apparu… On se demande ce qu'il contient !`, 'gold');
    globalThis.saveState();
    return true;
  }

  // All consumables go to inventory — player activates manually from the Zone bag bar
  state.inventory[itemDef.id] = (state.inventory[itemDef.id] || 0) + itemDef.qty;
  const _itemName = state.lang === 'fr' ? (itemDef.fr || globalThis.BALLS[itemDef.id]?.fr || itemDef.id) : (itemDef.en || globalThis.BALLS[itemDef.id]?.en || itemDef.id);
  globalThis.notify(`${itemDef.qty}× ${_itemName} → sac`, 'success');
  globalThis.SFX.play('buy');
  globalThis.playSE('buy', 0.5);
  globalThis.saveState();
  return true;
}

Object.assign(globalThis, {
  calculatePrice,
  getMarketSaturation,
  decayMarketSales,
  removePokemonFromAllAssignments,
  sellPokemon,
  BOOST_ITEMS,
  buyItem,
});
export {};
