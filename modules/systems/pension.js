// ════════════════════════════════════════════════════════════════
// pension.js — Pension & Eggs system
// Dependencies (globalThis): state, saveState, notify, speciesName,
//   pokeSprite, tryAutoIncubate, makePokemon, calculateStats,
//   getBaseSpecies, getPokemonPower, removePokemonFromAllAssignments,
//   showConfirm, updateTopBar, activeTab, renderPCTab,
//   SPECIES_BY_EN, EGG_HATCH_MS (re-exported below), BASE_PRICE,
//   POTENTIAL_MULT, ITEM_SPRITE_URLS
// ════════════════════════════════════════════════════════════════

let _pensionSearch = ''; // persisted across re-renders (like _trSearch in trainingRoom)

const EGG_HATCH_MS = {
  common:    1 * 60 * 1000,
  uncommon:  5 * 60 * 1000,
  rare:      15 * 60 * 1000,
  very_rare: 45 * 60 * 1000,
  legendary: 60 * 60 * 1000,
};
const EGG_GEN_MS = 5 * 60 * 1000; // new egg every 5 min when both slots filled

function pensionTick() {
  const state = globalThis.state;
  const p = state.pension;
  const now = Date.now();

  // Generate egg when both slots filled and timer elapsed
  if (p.slotA && p.slotB && p.eggAt && now >= p.eggAt) {
    const pkA = state.pokemons.find(pk => pk.id === p.slotA);
    const pkB = state.pokemons.find(pk => pk.id === p.slotB);
    if (pkA && pkB) {
      // Legendaries can't transmit species; if both legendary, skip egg
      const isLegA = SPECIES_BY_EN[pkA.species_en]?.rarity === 'legendary';
      const isLegB = SPECIES_BY_EN[pkB.species_en]?.rarity === 'legendary';
      if (isLegA && isLegB) {
        p.eggAt = now + EGG_GEN_MS; // reset timer, no egg from two legends
        saveState(); return;
      }
      // Non-legendary always transmits; if both non-legendary, random pick
      const parent = isLegA ? pkB : isLegB ? pkA : (Math.random() < 0.5 ? pkA : pkB);
      // Eggs always hatch at stage 1 of the evolution chain
      const baseSpeciesEn = getBaseSpecies(parent.species_en);
      const sp = SPECIES_BY_EN[baseSpeciesEn];
      if (sp && EGG_HATCH_MS[sp.rarity] !== null) {
        const hatchMs = EGG_HATCH_MS[sp.rarity] || EGG_HATCH_MS.common;
        const avgPot = Math.floor((pkA.potential + pkB.potential) / 2);
        const potential = Math.min(5, avgPot + (Math.random() < 0.2 ? 1 : 0));
        const shinyChance = (pkA.shiny && pkB.shiny) ? 0.15 : (pkA.shiny || pkB.shiny) ? 0.05 : 0.01;
        const egg = {
          id: `egg_${now}_${Math.random().toString(36).slice(2,7)}`,
          species_en: baseSpeciesEn,
          hatchAt: null,
          incubating: false,
          rarity: sp.rarity,
          potential,
          shiny: Math.random() < shinyChance,
          parentA: pkA.species_en,
          parentB: pkB.species_en,
        };
        state.eggs.push(egg);
        tryAutoIncubate();
        p.eggAt = now + EGG_GEN_MS;
        notify(`Un oeuf de ${speciesName(baseSpeciesEn)} a ete depose !${state.purchases?.autoIncubator ? ' (auto-incubé)' : ' Placez-le dans un incubateur.'}`, 'gold');
        saveState();
        if (activeTab === 'tabPC') renderPCTab();
      }
    }
  }
  // Start timer when both slots first filled
  if (p.slotA && p.slotB && !p.eggAt) {
    p.eggAt = now + EGG_GEN_MS;
    saveState();
  }
  // Clear timer if slots empty
  if (!p.slotA || !p.slotB) p.eggAt = null;

  // Hatch only incubating eggs that are ready
  const ready = state.eggs.filter(e => e.incubating && e.hatchAt && e.hatchAt <= now);
  for (const egg of ready) {
    const baseEn = getBaseSpecies(egg.species_en);
    const sp = SPECIES_BY_EN[baseEn];
    if (!sp) continue;
    const hatched = makePokemon(baseEn, 'pension', 'pokeball');
    if (hatched) {
      hatched.level = 1;
      hatched.xp = 0;
      hatched.potential = egg.potential;
      hatched.shiny = egg.shiny;
      hatched.stats = calculateStats(hatched);
      hatched.history = [{ type: 'hatched', ts: now }];
      state.pokemons.push(hatched);
      state.stats.totalCaught++;
      state.stats.eggsHatched = (state.stats.eggsHatched || 0) + 1;
      if (!state.pokedex[baseEn]) {
        state.pokedex[baseEn] = { seen: true, caught: true, shiny: egg.shiny, count: 1 };
      } else {
        state.pokedex[baseEn].caught = true;
        state.pokedex[baseEn].count++;
        if (egg.shiny) state.pokedex[baseEn].shiny = true;
      }
      notify(`L\'oeuf a eclore ! ${egg.shiny ? '[SHINY] ' : ''}${speciesName(baseEn)} Lv.1 ${'*'.repeat(egg.potential)} rejoint le PC.`, 'gold');
    }
    state.eggs = state.eggs.filter(e => e.id !== egg.id);
    saveState();
    if (activeTab === 'tabPC') renderPCTab();
  }
}

function renderPensionView(container) {
  const state = globalThis.state;
  const p = state.pension;
  const now = Date.now();
  const pkA = p.slotA ? state.pokemons.find(pk => pk.id === p.slotA) : null;
  const pkB = p.slotB ? state.pokemons.find(pk => pk.id === p.slotB) : null;

  const slotHtml = (pk, slot) => {
    if (pk) {
      return `<div class="pension-slot filled" data-pension-slot="${slot}">
        <img src="${pokeSprite(pk.species_en, pk.shiny)}" style="width:52px;height:52px">
        <div style="font-size:8px;margin-top:2px">${speciesName(pk.species_en)}</div>
        <div style="font-size:8px;color:var(--text-dim)">Lv.${pk.level} ${'*'.repeat(pk.potential)}</div>
        <button class="pension-remove-btn" data-slot="${slot}" style="margin-top:4px;font-size:8px;padding:2px 6px;background:var(--bg);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--red);cursor:pointer">Retirer</button>
      </div>`;
    }
    return `<div class="pension-slot empty" data-pension-slot="${slot}">
      <div style="font-size:9px;color:var(--text-dim)">Slot ${slot === 'slotA' ? 'A' : 'B'}</div>
      <div style="font-size:8px;color:var(--text-dim);margin-top:4px">Cliquer un Pokemon</div>
    </div>`;
  };

  const nextEggMs = p.eggAt ? Math.max(0, p.eggAt - now) : null;
  const nextEggStr = nextEggMs !== null ? `${Math.ceil(nextEggMs / 60000)}min` : '--';

  // ── Incubator slots ──
  const incubatorCount = state.inventory.incubator || 0;
  const incubatingEggs = state.eggs.filter(e => e.incubating);
  const freeSlots = incubatorCount - incubatingEggs.length;

  const incubatorHtml = (() => {
    if (incubatorCount === 0) {
      return `<div style="font-size:9px;color:var(--text-dim);padding:8px;text-align:center">
        Aucun incubateur — achetez-en un au Marche (15 000P)
      </div>`;
    }
    let html = '';
    // Active incubations
    for (const egg of incubatingEggs) {
      const rarity = egg.rarity || SPECIES_BY_EN[egg.species_en]?.rarity || 'common';
      const total = EGG_HATCH_MS[rarity] || EGG_HATCH_MS.common;
      const rem = Math.max(0, (egg.hatchAt || 0) - now);
      const pct = total > 0 ? Math.round((1 - rem / total) * 100) : 100;
      const remStr = rem <= 0 ? 'Pret !' : rem < 60000 ? `${Math.ceil(rem / 1000)}s` : `${Math.ceil(rem / 60000)}min`;
      html += `<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--gold-dim);border-radius:var(--radius-sm);margin-bottom:6px;background:var(--bg)">
        <img src="${ITEM_SPRITE_URLS.incubator}" style="width:24px;height:24px">
        <img src="${pokeSprite(egg.species_en)}" style="width:36px;height:36px">
        <div style="flex:1">
          <div style="font-size:9px">${speciesName(egg.species_en)}${egg.shiny ? ' [S]' : ''} ${'*'.repeat(egg.potential)}</div>
          <div style="background:var(--border);border-radius:2px;height:4px;margin-top:4px">
            <div style="background:var(--gold-dim);height:4px;border-radius:2px;width:${pct}%"></div>
          </div>
          <div style="font-size:8px;color:var(--gold);margin-top:2px">${remStr}</div>
        </div>
      </div>`;
    }
    // Free slots
    for (let i = 0; i < freeSlots; i++) {
      html += `<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px dashed var(--border);border-radius:var(--radius-sm);margin-bottom:6px;color:var(--text-dim);font-size:9px">
        <img src="${ITEM_SPRITE_URLS.incubator}" style="width:24px;height:24px;opacity:.4">
        <span>Incubateur libre — cliquez un oeuf ci-dessous</span>
      </div>`;
    }
    return html;
  })();

  // ── Waiting eggs (not incubating) ──
  const waitingEggs = state.eggs.filter(e => !e.incubating);
  const waitingHtml = waitingEggs.length
    ? waitingEggs.map(egg => {
        const rarity = egg.rarity || SPECIES_BY_EN[egg.species_en]?.rarity || 'common';
        const hatchTime = EGG_HATCH_MS[rarity] || EGG_HATCH_MS.common;
        const hatchStr = hatchTime < 60000 ? `${hatchTime/1000}s` : `${hatchTime/60000}min`;
        // Prix de vente : valeur marchande × 50 %
        const sellPrice = Math.round((BASE_PRICE[rarity] || 100) * (POTENTIAL_MULT[(egg.potential || 1) - 1] || 1) * 0.5);
        // Afficher parents sans révéler le Pokémon intérieur
        const parentsStr = egg.mystery
          ? 'Oeuf Mystère'
          : (egg.parentA && egg.parentB)
            ? `${speciesName(egg.parentA)} × ${speciesName(egg.parentB)}`
            : '? × ?';
        return `<div style="display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid var(--border)">
          <img src="${ITEM_SPRITE_URLS.incubator}" style="width:36px;height:36px;opacity:.85;image-rendering:pixelated">
          <div style="flex:1">
            <div style="font-size:9px;color:var(--gold)">Oeuf ${rarity} ${'*'.repeat(egg.potential || 1)}</div>
            <div style="font-size:8px;color:var(--text-dim)">${parentsStr} — éclosion : ${hatchStr}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-end">
            ${freeSlots > 0
              ? `<button class="pension-incubate-btn" data-egg-id="${egg.id}" style="font-size:8px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Incuber</button>`
              : ''}
            <button class="pension-sell-egg-btn" data-egg-id="${egg.id}" data-sell-price="${sellPrice}" style="font-size:8px;padding:3px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Vendre ${sellPrice.toLocaleString()}₽</button>
          </div>
        </div>`;
      }).join('')
    : `<div style="color:var(--text-dim);font-size:9px;padding:8px">Aucun oeuf en attente</div>`;

  // Pokemon picker (not in pension, not in team, not in training room, not legendary)
  const usedIds = new Set([p.slotA, p.slotB].filter(Boolean));
  const teamIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => teamIds.add(id));
  const trainingIds = new Set(state.trainingRoom?.pokemon || []);

  // Récupère la valeur de recherche persistée au niveau module (comme _trSearch)
  const pensionQ = _pensionSearch.toLowerCase();

  const allPensionCandidates = state.pokemons
    .filter(pk => !usedIds.has(pk.id) && !teamIds.has(pk.id) && !trainingIds.has(pk.id) && SPECIES_BY_EN[pk.species_en]?.rarity !== 'legendary')
    .sort((a, b) => getPokemonPower(b) - getPokemonPower(a));
  const candidates = pensionQ
    ? allPensionCandidates.filter(pk => speciesName(pk.species_en).toLowerCase().includes(pensionQ) || pk.species_en.includes(pensionQ))
    : allPensionCandidates;

  const pickerHtml = candidates.map(pk =>
    `<div class="pension-candidate" data-pk-id="${pk.id}" style="display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid var(--border);cursor:pointer">
      <img src="${pokeSprite(pk.species_en, pk.shiny)}" style="width:32px;height:32px">
      <div style="flex:1">
        <div style="font-size:10px">${speciesName(pk.species_en)} ${'*'.repeat(pk.potential)}${pk.shiny ? ' ✨' : ''}</div>
        <div style="font-size:9px;color:var(--text-dim)">Lv.${pk.level}</div>
      </div>
    </div>`
  ).join('') || `<div style="color:var(--text-dim);font-size:10px;padding:12px">Aucun Pokemon disponible</div>`;

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 220px;gap:16px;padding:12px">
      <div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">PENSION POKEMON</div>
          ${(p.slotA || p.slotB) ? `<button id="btnPensionClearAll" style="margin-left:auto;font-family:var(--font-pixel);font-size:8px;padding:4px 8px;background:var(--bg);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--red);cursor:pointer">Tout retirer</button>` : ''}
        </div>
        <div style="font-size:10px;color:var(--text-dim);margin-bottom:12px">Deposez deux Pokemon — un oeuf sera pond tous les ${EGG_GEN_MS/60000}min.</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          ${slotHtml(pkA, 'slotA')}
          ${slotHtml(pkB, 'slotB')}
        </div>
        ${pkA && pkB ? `<div style="font-size:9px;color:var(--text-dim);padding:6px 8px;background:var(--bg);border-radius:var(--radius-sm);margin-bottom:12px">Prochain oeuf dans : <b style="color:var(--gold)">${nextEggStr}</b></div>` : ''}

        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:6px">INCUBATEURS (${incubatingEggs.length}/${incubatorCount})</div>
        <div style="margin-bottom:12px">${incubatorHtml}</div>

        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:6px">OEUFS EN ATTENTE (${waitingEggs.length})</div>
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:180px;overflow-y:auto">${waitingHtml}</div>
      </div>
      <div>
        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:8px">CHOISIR UN POKEMON</div>
        <input id="pensionSearchInput" type="text" placeholder="Rechercher…" value="${pensionQ}"
          style="width:100%;padding:6px 8px;margin-bottom:6px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:10px;box-sizing:border-box;outline:none">
        <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">Cliquer pour placer dans slot vide</div>
        <div id="pensionPicker" style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:460px;overflow-y:auto">${pickerHtml}</div>
      </div>
    </div>`;

  // Clear all pension slots
  container.querySelector('#btnPensionClearAll')?.addEventListener('click', () => {
    state.pension.slotA = null;
    state.pension.slotB = null;
    state.pension.eggAt = null;
    saveState();
    notify('Pension vidée.', 'success');
    renderPensionView(container);
  });

  // Recherche pension — stockée au niveau module pour survivre aux re-renders
  container.querySelector('#pensionSearchInput')?.addEventListener('input', e => {
    _pensionSearch = e.target.value;
    renderPensionView(container);
  });

  container.querySelectorAll('.pension-remove-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      state.pension[btn.dataset.slot] = null;
      state.pension.eggAt = null;
      saveState();
      renderPensionView(container);
    });
  });

  // Place egg in incubator
  container.querySelectorAll('.pension-incubate-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (freeSlots <= 0) { notify('Pas d\'incubateur libre.'); return; }
      const egg = state.eggs.find(eg => eg.id === btn.dataset.eggId);
      if (!egg || egg.incubating) return;
      const rarity = egg.rarity || SPECIES_BY_EN[egg.species_en]?.rarity || 'common';
      egg.incubating = true;
      egg.hatchAt = Date.now() + (EGG_HATCH_MS[rarity] || EGG_HATCH_MS.common);
      saveState();
      notify(`Oeuf de ${speciesName(egg.species_en)} place en incubateur !`, 'gold');
      renderPensionView(container);
    });
  });

  // Sell waiting egg
  container.querySelectorAll('.pension-sell-egg-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const egg = state.eggs.find(eg => eg.id === btn.dataset.eggId);
      if (!egg || egg.incubating) return;
      const price = parseInt(btn.dataset.sellPrice) || 0;
      const rarity = egg.rarity || 'common';
      const parentsStr = egg.mystery ? 'Oeuf Mystère' : (egg.parentA && egg.parentB) ? `${speciesName(egg.parentA)} × ${speciesName(egg.parentB)}` : 'oeuf';
      showConfirm(
        `Vendre cet oeuf (${parentsStr}) pour ${price.toLocaleString()}₽ ?<br><span style="color:var(--text-dim);font-size:11px">Vous ne saurez jamais quel Pokémon était dedans.</span>`,
        () => {
          state.eggs = state.eggs.filter(eg => eg.id !== egg.id);
          state.gang.money += price;
          state.stats.totalMoneyEarned = (state.stats.totalMoneyEarned || 0) + price;
          saveState();
          updateTopBar();
          notify(`Oeuf vendu pour ${price.toLocaleString()}₽`, 'success');
          renderPensionView(container);
        },
        null,
        { danger: true, confirmLabel: 'Vendre', cancelLabel: 'Garder' }
      );
    });
  });

  container.querySelectorAll('.pension-candidate').forEach(el => {
    el.addEventListener('click', () => {
      const pkId = el.dataset.pkId;
      removePokemonFromAllAssignments(pkId);
      if (!state.pension.slotA) state.pension.slotA = pkId;
      else if (!state.pension.slotB && state.pension.slotA !== pkId) state.pension.slotB = pkId;
      else return;
      saveState();
      renderPensionView(container);
    });
  });
}

Object.assign(globalThis, { EGG_HATCH_MS, EGG_GEN_MS, pensionTick, renderPensionView });
export {};
