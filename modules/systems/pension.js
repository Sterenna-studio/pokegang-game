// ════════════════════════════════════════════════════════════════
// pension.js — Pension & Eggs system
// Dependencies (globalThis): state, saveState, notify, speciesName,
//   pokeSprite, eggSprite, eggImgTag, EGG_SPRITES, tryAutoIncubate,
//   makePokemon, calculateStats, getBaseSpecies, getPokemonPower,
//   removePokemonFromAllAssignments, getMaxPensionSlots, getPensionSlotIds,
//   showConfirm, updateTopBar, activeTab, renderPCTab, switchTab,
//   SPECIES_BY_EN, EGG_HATCH_MS (re-exported below), BASE_PRICE,
//   POTENTIAL_MULT, ITEM_SPRITE_URLS
// ════════════════════════════════════════════════════════════════

let _pensionSearch = '';

const EGG_HATCH_MS = {
  common:    1 * 60 * 1000,
  uncommon:  5 * 60 * 1000,
  rare:      15 * 60 * 1000,
  very_rare: 45 * 60 * 1000,
  legendary: 60 * 60 * 1000,
};
const EGG_GEN_MS = 5 * 60 * 1000;

// ── Breeding pair: first two non-legendary Pokémon in slots[] ──
function _getBreedingPair() {
  const state = globalThis.state;
  const slots = state.pension?.slots || [];
  const pair = [];
  for (const id of slots) {
    if (pair.length >= 2) break;
    const pk = state.pokemons.find(p => p.id === id);
    if (pk) pair.push(pk);
  }
  return pair;
}

function pensionTick() {
  const state = globalThis.state;
  const p = state.pension;
  const now = Date.now();

  const pair = _getBreedingPair();
  const [pkA, pkB] = pair;

  // Generate egg when breeding pair ready and timer elapsed
  if (pkA && pkB && p.eggAt && now >= p.eggAt) {
    const isLegA = SPECIES_BY_EN[pkA.species_en]?.rarity === 'legendary';
    const isLegB = SPECIES_BY_EN[pkB.species_en]?.rarity === 'legendary';
    if (isLegA && isLegB) {
      p.eggAt = now + EGG_GEN_MS;
      saveState();
      return;
    }
    const parent = isLegA ? pkB : isLegB ? pkA : (Math.random() < 0.5 ? pkA : pkB);
    const baseSpeciesEn = getBaseSpecies(parent.species_en);
    const sp = SPECIES_BY_EN[baseSpeciesEn];
    if (sp && EGG_HATCH_MS[sp.rarity] !== null) {
      const avgPot = Math.floor((pkA.potential + pkB.potential) / 2);
      const potential = Math.min(5, avgPot + (Math.random() < 0.2 ? 1 : 0));
      const shinyChance = (pkA.shiny && pkB.shiny) ? 0.15 : (pkA.shiny || pkB.shiny) ? 0.05 : 0.01;
      const egg = {
        id: `egg_${now}_${Math.random().toString(36).slice(2, 7)}`,
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
      notify(
        `Un œuf mystérieux est apparu à la pension !${state.purchases?.autoIncubator ? ' (auto-incubé)' : ' Placez-le dans un incubateur.'}`,
        'gold',
      );
      saveState();
      if (activeTab === 'tabPC') renderPCTab();
    }
  }

  // Start timer when breeding pair first fills
  if (pkA && pkB && !p.eggAt) {
    p.eggAt = now + EGG_GEN_MS;
    saveState();
  }

  // Clear timer when pair incomplete
  if (!pkA || !pkB) p.eggAt = null;

  // Mark eggs as ready (status = 'ready') when hatchAt elapsed — don't auto-hatch
  // Keep incubating: true so the incubator count stays correct until the player hatches
  const justReady = state.eggs.filter(e => e.incubating && e.hatchAt && e.hatchAt <= now && e.status !== 'ready');
  if (justReady.length > 0) {
    for (const egg of justReady) egg.status = 'ready';
    saveState();
    notify(`${justReady.length > 1 ? `${justReady.length} œufs sont` : 'Un œuf est'} prêt${justReady.length > 1 ? 's' : ''} à éclore !`, 'gold');
    if (activeTab === 'tabPC') renderPCTab();
  }
}

// ── Silent batch-hatch helper (no animation — used by multi-hatch popup) ──
function _hatchEggSilent(egg) {
  const state = globalThis.state;
  const now = Date.now();
  const baseEn = getBaseSpecies(egg.species_en);
  const sp = SPECIES_BY_EN[baseEn];
  if (!sp) return null;
  const hatched = makePokemon(baseEn, 'pension', 'pokeball');
  if (!hatched) return null;
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
  state.eggs = state.eggs.filter(e => e.id !== egg.id);
  return hatched;
}

// ── Multiple hatch popup for ready eggs ─────────────────────────
function openHatchPopup() {
  const state = globalThis.state;
  const readyEggs = state.eggs.filter(e => e.status === 'ready');
  if (readyEggs.length === 0) return;

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center';

  const eggRows = readyEggs.map((egg, i) => {
    const rarity = egg.rarity || SPECIES_BY_EN[egg.species_en]?.rarity || 'common';
    const spName = speciesName(egg.species_en);
    const imgTag = globalThis.eggImgTag?.(egg, false, 'width:36px;height:36px;image-rendering:pixelated') || '🥚';
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid var(--border)">
      <input type="checkbox" class="hatch-sel" data-idx="${i}" checked style="width:16px;height:16px;cursor:pointer">
      ${imgTag}
      <div style="flex:1">
        <div style="font-size:10px">${spName} ${'★'.repeat(egg.potential)}${egg.shiny ? ' ✨' : ''}</div>
        <div style="font-size:8px;color:var(--text-dim)">${rarity}</div>
      </div>
    </div>`;
  }).join('');

  modal.innerHTML = `<div style="background:var(--bg-panel);border:2px solid var(--gold);border-radius:var(--radius);padding:20px;max-width:380px;width:94%;display:flex;flex-direction:column;gap:14px">
    <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">🥚 ŒUFS PRÊTS (${readyEggs.length})</div>
    <div style="max-height:320px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm)">${eggRows}</div>
    <div style="font-size:9px;color:var(--text-dim)">Sélectionne les œufs à faire éclore.</div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button id="hatchCancel" style="font-family:var(--font-pixel);font-size:9px;padding:8px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
      <button id="hatchConfirm" style="font-family:var(--font-pixel);font-size:9px;padding:8px 14px;background:var(--bg);border:1px solid var(--gold);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Faire éclore ✓</button>
    </div>
  </div>`;

  document.body.appendChild(modal);
  modal.querySelector('#hatchCancel').addEventListener('click', () => modal.remove());
  modal.querySelector('#hatchConfirm').addEventListener('click', () => {
    const selected = [...modal.querySelectorAll('.hatch-sel:checked')].map(cb => readyEggs[parseInt(cb.dataset.idx)]);
    if (selected.length === 0) { modal.remove(); return; }
    let count = 0;
    for (const egg of selected) {
      if (_hatchEggSilent(egg)) count++;
    }
    saveState();
    if (count > 0) notify(`${count} Pokémon ont éclos !`, 'gold');
    modal.remove();
    if (activeTab === 'tabPC') renderPCTab();
  });
}

// ── renderPensionView — merged pension + eggs view ──────────────
function renderPensionView(container) {
  const state = globalThis.state;
  const p = state.pension;
  const now = Date.now();

  const maxSlots = globalThis.getMaxPensionSlots();
  const slots = p.slots || [];
  const pair = _getBreedingPair();
  const [pkA, pkB] = pair;

  const nextEggMs = (pkA && pkB && p.eggAt) ? Math.max(0, p.eggAt - now) : null;
  const nextEggStr = nextEggMs !== null
    ? (nextEggMs < 60000 ? `${Math.ceil(nextEggMs / 1000)}s` : `${Math.ceil(nextEggMs / 60000)}min`)
    : '--';

  // ── Pension slots grid ──────────────────────────────────────
  const slotsHtml = slots.map((id, i) => {
    const pk = state.pokemons.find(p2 => p2.id === id);
    if (!pk) return '';
    const isBreeder = i < 2;
    return `<div class="pension-slot filled" style="position:relative;display:flex;flex-direction:column;align-items:center;padding:10px 6px;background:var(--bg);border:1px solid ${isBreeder ? 'var(--gold-dim)' : 'var(--border)'};border-radius:var(--radius-sm);gap:4px">
      ${isBreeder ? `<div style="position:absolute;top:4px;left:4px;font-size:7px;color:var(--gold);font-family:var(--font-pixel)">♥</div>` : ''}
      <img src="${pokeSprite(pk.species_en, pk.shiny)}" style="width:48px;height:48px;image-rendering:pixelated">
      <div style="font-size:8px;text-align:center;line-height:1.3">${speciesName(pk.species_en)}</div>
      <div style="font-size:8px;color:var(--text-dim)">Lv.${pk.level} ${'★'.repeat(pk.potential)}</div>
      <button class="pension-remove-btn" data-pk-id="${pk.id}" style="margin-top:2px;font-size:7px;padding:2px 6px;background:var(--bg);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--red);cursor:pointer">Retirer</button>
    </div>`;
  }).filter(Boolean);

  // Empty slots
  for (let i = slots.length; i < maxSlots; i++) {
    const isBreeder = i < 2;
    slotsHtml.push(`<div class="pension-slot empty" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 6px;background:var(--bg);border:1px dashed ${isBreeder ? 'var(--gold-dim)' : 'var(--border)'};border-radius:var(--radius-sm);min-height:100px;gap:4px">
      <div style="font-size:20px;opacity:.3">${isBreeder ? '♥' : '+'}</div>
      <div style="font-size:8px;color:var(--text-dim);text-align:center">${isBreeder ? 'Reproducteur' : 'Slot libre'}</div>
    </div>`);
  }

  // Buy extra slot button (if < 6 slots and player can afford)
  const SLOT_PRICES = [0, 0, 50000, 150000, 300000, 500000];
  const nextSlotCost = SLOT_PRICES[maxSlots] || null;
  const buySlotBtn = (maxSlots < 6 && nextSlotCost !== null)
    ? `<button id="btnBuyPensionSlot" style="font-family:var(--font-pixel);font-size:8px;padding:5px 10px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">+ Slot (${nextSlotCost.toLocaleString()}₽)</button>`
    : '';

  // ── Incubators ──────────────────────────────────────────────
  const incubatorCount = state.inventory.incubator || 0;
  const incubatingEggs = state.eggs.filter(e => e.incubating && e.status !== 'ready');
  const readyEggs = state.eggs.filter(e => e.status === 'ready');
  const waitingEggs = state.eggs.filter(e => !e.incubating && e.status !== 'ready');
  const freeIncubators = Math.max(0, incubatorCount - incubatingEggs.length);

  let incubatorHtml = '';
  if (incubatorCount === 0) {
    incubatorHtml = `<div style="font-size:9px;color:var(--text-dim);padding:8px;text-align:center;border:1px dashed var(--border);border-radius:var(--radius-sm)">Aucun incubateur — achetez-en un au Marché (15 000₽)</div>`;
  } else {
    for (const egg of incubatingEggs) {
      const rarity = egg.rarity || SPECIES_BY_EN[egg.species_en]?.rarity || 'common';
      const total = EGG_HATCH_MS[rarity] || EGG_HATCH_MS.common;
      const rem = Math.max(0, (egg.hatchAt || 0) - now);
      const pct = total > 0 ? Math.round((1 - rem / total) * 100) : 100;
      const remStr = rem <= 0 ? 'Prêt !' : rem < 60000 ? `${Math.ceil(rem / 1000)}s` : `${Math.ceil(rem / 60000)}min`;
      const imgTag = globalThis.eggImgTag?.(egg, false, 'width:32px;height:32px;image-rendering:pixelated') || '🥚';
      incubatorHtml += `<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--gold-dim);border-radius:var(--radius-sm);background:var(--bg)">
        <img src="${ITEM_SPRITE_URLS.incubator}" style="width:20px;height:20px;object-fit:contain;image-rendering:pixelated" onerror="this.style.display='none'">
        ${imgTag}
        <div style="flex:1">
          <div style="font-size:9px">${speciesName(egg.species_en)} ${'★'.repeat(egg.potential)}</div>
          <div style="background:var(--border);border-radius:2px;height:4px;margin-top:3px">
            <div style="background:var(--gold-dim);height:4px;border-radius:2px;width:${pct}%;transition:width .3s"></div>
          </div>
          <div style="font-size:8px;color:var(--gold);margin-top:2px">${remStr}</div>
        </div>
      </div>`;
    }
    for (let i = 0; i < freeIncubators; i++) {
      incubatorHtml += `<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px dashed var(--border);border-radius:var(--radius-sm);color:var(--text-dim);font-size:9px">
        <img src="${ITEM_SPRITE_URLS.incubator}" style="width:20px;height:20px;opacity:.35;image-rendering:pixelated" onerror="this.style.display='none'">
        <span>Incubateur libre</span>
      </div>`;
    }
  }

  // ── Waiting eggs (not incubating) ───────────────────────────
  const waitingEggsHtml = waitingEggs.map(egg => {
    const rarity = egg.rarity || SPECIES_BY_EN[egg.species_en]?.rarity || 'common';
    const imgTag = globalThis.eggImgTag?.(egg, false, 'width:28px;height:28px;image-rendering:pixelated') || '🥚';
    return `<div class="pension-egg-waiting" data-egg-id="${egg.id}" style="display:flex;align-items:center;gap:8px;padding:7px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);cursor:${freeIncubators > 0 ? 'pointer' : 'default'}" title="${freeIncubators > 0 ? 'Cliquer pour incuber' : 'Plus d\'incubateur libre'}">
      ${imgTag}
      <div style="flex:1">
        <div style="font-size:9px">${speciesName(egg.species_en)} ${'★'.repeat(egg.potential)}${egg.shiny ? ' ✨' : ''}</div>
        <div style="font-size:8px;color:var(--text-dim)">${rarity}</div>
      </div>
      ${freeIncubators > 0 ? `<div style="font-size:8px;color:var(--gold)">▶ Incuber</div>` : ''}
    </div>`;
  }).join('') || '';

  // ── Picker (candidates to add to pension) ──────────────────
  const pensionSet = globalThis.getPensionSlotIds();
  const teamIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => teamIds.add(id));
  const trainingIds = new Set(state.trainingRoom?.pokemon || []);
  const pensionFull = slots.length >= maxSlots;
  const q = _pensionSearch.toLowerCase();

  const allCandidates = state.pokemons
    .filter(pk => !pensionSet.has(pk.id) && !teamIds.has(pk.id) && !trainingIds.has(pk.id) && SPECIES_BY_EN[pk.species_en]?.rarity !== 'legendary')
    .sort((a, b) => getPokemonPower(b) - getPokemonPower(a));
  const candidates = q
    ? allCandidates.filter(pk => speciesName(pk.species_en).toLowerCase().includes(q) || pk.species_en.includes(q))
    : allCandidates;

  const pickerHtml = candidates.map(pk =>
    `<div class="pension-candidate" data-pk-id="${pk.id}" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid var(--border);cursor:${pensionFull ? 'default' : 'pointer'};opacity:${pensionFull ? '.5' : '1'}">
      <img src="${pokeSprite(pk.species_en, pk.shiny)}" style="width:30px;height:30px;image-rendering:pixelated">
      <div style="flex:1">
        <div style="font-size:10px">${speciesName(pk.species_en)} ${'★'.repeat(pk.potential)}${pk.shiny ? ' ✨' : ''}</div>
        <div style="font-size:8px;color:var(--text-dim)">Lv.${pk.level}</div>
      </div>
    </div>`,
  ).join('') || `<div style="color:var(--text-dim);font-size:9px;padding:12px;text-align:center">Aucun Pokémon disponible</div>`;

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 210px;gap:16px;padding:12px">
      <div style="display:flex;flex-direction:column;gap:14px">

        <!-- Pension slots -->
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">PENSION (${slots.length}/${maxSlots})</div>
            ${buySlotBtn}
            ${slots.length > 0 ? `<button id="btnPensionClearAll" style="margin-left:auto;font-family:var(--font-pixel);font-size:8px;padding:4px 8px;background:var(--bg);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--red);cursor:pointer">Tout retirer</button>` : ''}
          </div>
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:8px">
            Les 2 premiers slots (♥) forment le couple reproducteur — un œuf toutes les ${EGG_GEN_MS / 60000} min.
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${slotsHtml.join('')}</div>
          ${pkA && pkB ? `<div style="margin-top:8px;font-size:9px;color:var(--text-dim);padding:6px 8px;background:var(--bg);border-radius:var(--radius-sm)">Prochain œuf dans : <b style="color:var(--gold)">${nextEggStr}</b></div>` : ''}
        </div>

        <!-- Ready eggs -->
        ${readyEggs.length > 0 ? `
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="font-family:var(--font-pixel);font-size:10px;color:var(--green)">🥚 ŒUFS PRÊTS (${readyEggs.length})</div>
            <button id="btnHatchAll" style="margin-left:auto;font-family:var(--font-pixel);font-size:8px;padding:4px 10px;background:var(--bg);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--green);cursor:pointer">Faire éclore ▶</button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${readyEggs.map(egg => {
              const imgTag = globalThis.eggImgTag?.(egg, false, 'width:40px;height:40px;image-rendering:pixelated') || '🥚';
              return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;background:var(--bg);border:1px solid var(--green);border-radius:var(--radius-sm);min-width:70px">
                ${imgTag}
                <div style="font-size:8px;text-align:center">${speciesName(egg.species_en)}</div>
                <div style="font-size:8px;color:var(--text-dim)">${'★'.repeat(egg.potential)}${egg.shiny ? '✨' : ''}</div>
              </div>`;
            }).join('')}
          </div>
        </div>` : ''}

        <!-- Incubators -->
        <div>
          <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold);margin-bottom:8px">INCUBATEURS (${incubatingEggs.length}/${incubatorCount})</div>
          <div style="display:flex;flex-direction:column;gap:6px">${incubatorHtml || `<div style="font-size:9px;color:var(--text-dim);text-align:center;padding:8px">Aucun incubateur — achetez-en un au Marché</div>`}</div>
        </div>

        <!-- Waiting eggs -->
        ${waitingEggs.length > 0 ? `
        <div>
          <div style="font-family:var(--font-pixel);font-size:10px;color:var(--text-dim);margin-bottom:8px">EN ATTENTE D'INCUBATION (${waitingEggs.length})</div>
          <div style="display:flex;flex-direction:column;gap:6px">${waitingEggsHtml}</div>
        </div>` : ''}

      </div>

      <!-- Picker column -->
      <div>
        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:8px">AJOUTER À LA PENSION</div>
        <input id="pensionSearchInput" type="text" placeholder="Rechercher…" value="${_pensionSearch}"
          style="width:100%;padding:6px 8px;margin-bottom:6px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:10px;box-sizing:border-box;outline:none">
        <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">${pensionFull ? 'Pension pleine.' : 'Cliquer pour ajouter.'}</div>
        <div id="pensionPicker" style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:500px;overflow-y:auto">${pickerHtml}</div>
      </div>
    </div>`;

  // ── Event handlers ────────────────────────────────────────────

  container.querySelector('#btnPensionClearAll')?.addEventListener('click', () => {
    state.pension.slots = [];
    state.pension.eggAt = null;
    saveState();
    notify('Pension vidée.', 'success');
    renderPensionView(container);
  });

  container.querySelector('#btnBuyPensionSlot')?.addEventListener('click', () => {
    const cost = SLOT_PRICES[maxSlots];
    if (state.gang.money < cost) { notify('Fonds insuffisants.', 'error'); return; }
    state.gang.money -= cost;
    state.pension.extraSlotsPurchased = (state.pension.extraSlotsPurchased || 0) + 1;
    saveState();
    notify(`Slot de pension débloqué ! (${globalThis.getMaxPensionSlots()} slots)`, 'gold');
    renderPensionView(container);
  });

  container.querySelector('#btnHatchAll')?.addEventListener('click', () => openHatchPopup());

  container.querySelector('#pensionSearchInput')?.addEventListener('input', e => {
    _pensionSearch = e.target.value;
    renderPensionView(container);
  });

  container.querySelectorAll('.pension-remove-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.pkId;
      const before = state.pension.slots.length;
      state.pension.slots = state.pension.slots.filter(sid => sid !== id);
      if (state.pension.slots.length < before) state.pension.eggAt = null;
      saveState();
      renderPensionView(container);
    });
  });

  container.querySelectorAll('.pension-candidate').forEach(el => {
    el.addEventListener('click', () => {
      if (slots.length >= maxSlots) { notify('Pension pleine.', 'error'); return; }
      const pkId = el.dataset.pkId;
      removePokemonFromAllAssignments(pkId);
      if (!state.pension.slots.includes(pkId)) {
        state.pension.slots.push(pkId);
        saveState();
        renderPensionView(container);
      }
    });
  });

  // Click a waiting egg to incubate it
  container.querySelectorAll('.pension-egg-waiting').forEach(el => {
    el.addEventListener('click', () => {
      if (freeIncubators <= 0) return;
      const eggId = el.dataset.eggId;
      const egg = state.eggs.find(e => e.id === eggId);
      if (!egg || egg.incubating) return;
      const rarity = egg.rarity || SPECIES_BY_EN[egg.species_en]?.rarity || 'common';
      egg.incubating = true;
      egg.hatchAt = Date.now() + (EGG_HATCH_MS[rarity] || EGG_HATCH_MS.common);
      saveState();
      notify(`Œuf placé dans l'incubateur !`, 'success');
      renderPensionView(container);
    });
  });
}

Object.assign(globalThis, { EGG_HATCH_MS, EGG_GEN_MS, pensionTick, renderPensionView, openHatchPopup });
export {};
