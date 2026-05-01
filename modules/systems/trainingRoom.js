// ════════════════════════════════════════════════════════════════
// trainingRoom.js — Training Room system
// Dependencies (globalThis): state, saveState, notify, updateTopBar,
//   activeTab, pcView, pokeSprite, speciesName, getPokemonPower,
//   levelUpPokemon, tryAutoEvolution, removePokemonFromAllAssignments,
//   renderTrainingTab (self-referential)
// ════════════════════════════════════════════════════════════════

let _trSearch = '';           // persisté entre re-renders
let _trSelected = new Set(); // IDs cochés pour ajout groupé

// Costs for extra slots 7..12 (index 0 = slot 7)
const TRAINING_EXTRA_SLOT_COSTS = [100_000, 250_000, 500_000, 1_000_000, 2_000_000, 3_000_000];

function getMaxTrainingSlots(tr) {
  return 6 + (tr.extraSlots || 0);
}

function renderTrainingTab() {
  const state = globalThis.state;
  const tab = (activeTab === 'tabPC' && pcView === 'training')
    ? document.getElementById('trainingInPC')
    : document.getElementById('tabTraining');
  if (!tab) return;

  const tr = state.trainingRoom;
  const maxSlots = getMaxTrainingSlots(tr);
  const inRoom = new Set(tr.pokemon);
  const teamIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => teamIds.add(id));

  // ── Buy extra slot button ──
  const nextExtraCost = TRAINING_EXTRA_SLOT_COSTS[tr.extraSlots || 0];
  const buySlotBtn = (maxSlots < 12 && nextExtraCost !== undefined)
    ? `<button id="btnBuyTrainingSlot" style="font-family:var(--font-pixel);font-size:8px;padding:4px 10px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">+ Slot (${nextExtraCost.toLocaleString()}₽)</button>`
    : '';

  let slotsHtml = '';
  for (let i = 0; i < maxSlots; i++) {
    const pkId = tr.pokemon[i];
    const p = pkId ? state.pokemons.find(pk => pk.id === pkId) : null;
    if (p) {
      slotsHtml += `<div class="training-slot filled" data-tr-remove="${p.id}">
        <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:52px;height:52px;${p.shiny?'filter:drop-shadow(0 0 4px var(--gold))':''}">
        <div style="font-size:8px;margin-top:2px">${speciesName(p.species_en)}</div>
        <div style="font-size:8px;color:var(--text-dim)">Lv.${p.level} ${'*'.repeat(p.potential)}</div>
        <button class="tr-remove-btn" data-tr-remove="${p.id}" style="margin-top:4px;font-size:8px;padding:2px 6px;background:var(--bg);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--red);cursor:pointer">Retirer</button>
      </div>`;
    } else {
      slotsHtml += `<div class="training-slot empty"><span style="color:var(--text-dim);font-size:8px">Slot libre</span></div>`;
    }
  }

  const recentLog = (tr.log || []).slice(-8).reverse().map(e => {
    let color = 'var(--text-dim)';
    if (e.includes('[W]')) color = 'var(--gold)';
    else if (e.includes('[L]')) color = 'var(--red-dim, var(--red))';
    return `<div style="font-size:9px;color:${color};padding:2px 0">${e}</div>`;
  }).join('') || '<div style="font-size:9px;color:var(--text-dim)">Aucun evenement</div>';

  // Last fight display
  let lastFightHtml = '';
  if (tr.lastFight) {
    const { winner, loser } = tr.lastFight;
    lastFightHtml = `
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:6px">DERNIER COMBAT</div>
      <div style="display:flex;align-items:center;gap:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px;margin-bottom:12px">
        <div style="text-align:center">
          <img src="${pokeSprite(winner.species_en)}" style="width:48px;height:48px">
          <div style="font-size:8px;color:var(--gold)">${speciesName(winner.species_en)}</div>
          <div style="font-size:7px;color:var(--text-dim)">Lv.${winner.level} [W]</div>
        </div>
        <div style="font-family:var(--font-pixel);font-size:10px;color:var(--text-dim)">VS</div>
        <div style="text-align:center;transform:scaleX(-1)">
          <img src="${pokeSprite(loser.species_en)}" style="width:48px;height:48px">
          <div style="font-size:8px;color:var(--red);transform:scaleX(-1)">${speciesName(loser.species_en)}</div>
          <div style="font-size:7px;color:var(--text-dim);transform:scaleX(-1)">Lv.${loser.level} [L]</div>
        </div>
      </div>`;
  }

  const roomLevel = tr.level || 1;
  const upgradeCost = Math.round(5000 * Math.pow(2, roomLevel - 1));
  const mult = Math.round((1 + 0.25 * (roomLevel - 1)) * 100);
  const winXPPreview = Math.round(25 * (mult / 100) * 1.25);

  tab.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 300px;gap:16px;padding:12px">
      <div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">SALLE D\'ENTRAINEMENT</div>
          <div style="font-size:9px;color:var(--text-dim)">Niv.${roomLevel} — XP x${mult}% — ${tr.pokemon.length}/${maxSlots} slots</div>
          ${buySlotBtn}
          ${tr.pokemon.length > 0 ? `<button id="btnTrClearAll" style="margin-left:auto;font-family:var(--font-pixel);font-size:8px;padding:4px 8px;background:var(--bg);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--red);cursor:pointer">Tout retirer</button>` : ''}
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px">
          <div style="flex:1;font-size:9px;color:var(--text-dim)">
            <b style="color:var(--text)">Melee generale</b> — Mode actif : gagnant +${winXPPreview} XP (x1.25), perdant +${Math.round(10*(mult/100))} XP
          </div>
          <button id="btnTrainingUpgrade" style="font-family:var(--font-pixel);font-size:8px;padding:6px 10px;background:var(--bg);border:2px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">
            AMELIORER<br>${upgradeCost.toLocaleString()}P
          </button>
        </div>
        <div style="font-size:10px;color:var(--text-dim);margin-bottom:12px">
          Min. 2 Pokemon pour s\'entrainer. Combat toutes les 60s.
        </div>
        ${lastFightHtml}
        <div class="training-slots" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">${slotsHtml}</div>
        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:8px">JOURNAL</div>
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px;max-height:120px;overflow-y:auto">${recentLog}</div>
      </div>
      <div>
        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:8px">AJOUTER UN POKEMON</div>
        <input id="trSearchInput" type="text" placeholder="Rechercher…" value="${_trSearch}"
          style="width:100%;padding:6px 8px;margin-bottom:6px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:10px;box-sizing:border-box;outline:none">
        <div id="trPickerArea"></div>
      </div>
    </div>`;

  // ── Render picker area (sans recréer l'input — préserve le focus) ──
  _refreshTrPicker(tab);

  // Clear all training slots
  document.getElementById('btnTrClearAll')?.addEventListener('click', () => {
    const state = globalThis.state;
    state.trainingRoom.pokemon = [];
    saveState();
    notify('Salle d\'entrainement vidée.', 'success');
    renderTrainingTab();
  });

  // Buy extra slot button
  document.getElementById('btnBuyTrainingSlot')?.addEventListener('click', () => {
    const state = globalThis.state;
    const tr = state.trainingRoom;
    const extra = tr.extraSlots || 0;
    const cost = TRAINING_EXTRA_SLOT_COSTS[extra];
    if (cost === undefined) return;
    if (state.gang.money < cost) { notify('Fonds insuffisants.'); return; }
    state.gang.money -= cost;
    state.stats.totalMoneySpent = (state.stats.totalMoneySpent || 0) + cost;
    tr.extraSlots = extra + 1;
    saveState();
    updateTopBar();
    notify(`Slot ${6 + tr.extraSlots} débloqué !`, 'gold');
    renderTrainingTab();
  });

  // Upgrade button
  document.getElementById('btnTrainingUpgrade')?.addEventListener('click', () => {
    const state = globalThis.state;
    const lvl = state.trainingRoom.level || 1;
    const cost = Math.round(5000 * Math.pow(2, lvl - 1));
    if (state.gang.money < cost) { notify('Fonds insuffisants.'); return; }
    state.gang.money -= cost;
    state.stats.totalMoneySpent = (state.stats.totalMoneySpent || 0) + cost;
    state.trainingRoom.level = lvl + 1;
    saveState();
    updateTopBar();
    notify(`Salle d'entrainement Niv.${state.trainingRoom.level} !`, 'gold');
    renderTrainingTab();
  });

  tab.querySelectorAll('.tr-remove-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const state = globalThis.state;
      e.stopPropagation();
      const id = btn.dataset.trRemove;
      state.trainingRoom.pokemon = state.trainingRoom.pokemon.filter(x => x !== id);
      saveState();
      renderTrainingTab();
    });
  });

  // Recherche — met à jour uniquement la liste, sans recréer l'input
  tab.querySelector('#trSearchInput')?.addEventListener('input', e => {
    _trSearch = e.target.value;
    _refreshTrPicker(tab);
  });
}

// Met à jour uniquement la zone picker (liste + bouton "ajouter sélectionnés")
// sans toucher à l'input de recherche → préserve le focus et le curseur
function _refreshTrPicker(tab) {
  const state = globalThis.state;
  const pickerArea = tab?.querySelector('#trPickerArea');
  if (!pickerArea) return;

  const tr = state.trainingRoom;
  const maxSlotsForPicker = getMaxTrainingSlots(tr);
  const inRoom = new Set(tr.pokemon);
  const teamIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => teamIds.add(id));
  const pensionIds = globalThis.getPensionSlotIds();
  const freeSlots = maxSlotsForPicker - tr.pokemon.length;

  const q = _trSearch.toLowerCase();
  const allCandidates = state.pokemons
    .filter(p => !inRoom.has(p.id) && !teamIds.has(p.id) && !pensionIds.has(p.id) && p.level < 100)
    .sort((a, b) => getPokemonPower(b) - getPokemonPower(a));
  const candidates = q
    ? allCandidates.filter(p => speciesName(p.species_en).toLowerCase().includes(q) || p.species_en.includes(q))
    : allCandidates;

  // Nettoyer la sélection si les IDs ne sont plus valides
  _trSelected = new Set([..._trSelected].filter(id => candidates.find(p => p.id === id)));

  const addableCount = Math.min(_trSelected.size, freeSlots);
  const candidatesHtml = candidates.map(p => {
    const checked = _trSelected.has(p.id);
    return `<label class="tr-candidate" data-tr-add="${p.id}" style="display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid var(--border);cursor:pointer;background:${checked ? 'rgba(68,136,204,.12)' : ''}">
      <input type="checkbox" class="tr-check" data-id="${p.id}" ${checked ? 'checked' : ''} style="width:14px;height:14px;cursor:pointer;accent-color:var(--blue)">
      <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:32px;height:32px">
      <div style="flex:1">
        <div style="font-size:10px">${speciesName(p.species_en)} ${'*'.repeat(p.potential)}${p.shiny ? ' ✨' : ''}</div>
        <div style="font-size:9px;color:var(--text-dim)">Lv.${p.level}</div>
      </div>
    </label>`;
  }).join('') || `<div style="color:var(--text-dim);font-size:10px;padding:12px">Aucun Pokemon disponible</div>`;

  pickerArea.innerHTML = `
    ${_trSelected.size > 0 ? `
    <button id="btnTrAddSelected" style="width:100%;margin-bottom:6px;padding:6px;background:var(--bg);border:1px solid var(--blue);border-radius:var(--radius-sm);color:var(--blue);font-family:var(--font-pixel);font-size:8px;cursor:pointer">
      + Ajouter ${addableCount} sélectionné${addableCount > 1 ? 's' : ''} (${freeSlots} slot${freeSlots > 1 ? 's' : ''} libre${freeSlots > 1 ? 's' : ''})
    </button>` : ''}
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:400px;overflow-y:auto">${candidatesHtml}</div>`;

  // Checkboxes — toggle sélection
  pickerArea.querySelectorAll('.tr-check').forEach(cb => {
    cb.addEventListener('change', e => {
      e.stopPropagation();
      const id = cb.dataset.id;
      if (cb.checked) _trSelected.add(id);
      else _trSelected.delete(id);
      _refreshTrPicker(tab);
    });
  });

  // Clic sur une ligne = toggle checkbox
  pickerArea.querySelectorAll('.tr-candidate').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.type === 'checkbox') return;
      const cb = el.querySelector('.tr-check');
      if (!cb) return;
      cb.checked = !cb.checked;
      const id = el.dataset.trAdd;
      if (cb.checked) _trSelected.add(id);
      else _trSelected.delete(id);
      _refreshTrPicker(tab);
    });
  });

  // Bouton "Ajouter X sélectionnés"
  pickerArea.querySelector('#btnTrAddSelected')?.addEventListener('click', () => {
    const state = globalThis.state;
    const availSlots = 6 - state.trainingRoom.pokemon.length;
    let added = 0;
    for (const id of _trSelected) {
      if (added >= availSlots) break;
      if (!state.trainingRoom.pokemon.includes(id)) {
        removePokemonFromAllAssignments(id);
        state.trainingRoom.pokemon.push(id);
        added++;
      }
    }
    _trSelected.clear();
    saveState();
    notify(`${added} Pokémon ajouté${added > 1 ? 's' : ''} à la salle`, 'success');
    renderTrainingTab();
  });
}

function trainingRoomTick() {
  const state = globalThis.state;
  const room = state.trainingRoom;
  if (!room || room.pokemon.length < 2) return;

  // Collect valid Pokémon objects
  const fighters = room.pokemon
    .map(id => state.pokemons.find(p => p.id === id))
    .filter(Boolean);
  if (fighters.length < 2) return;

  // Room level multiplier: each upgrade adds 25% efficiency
  const roomLevel = room.level || 1;
  const mult = 1 + 0.25 * (roomLevel - 1);

  // Pick 2 random fighters
  const shuffled = [...fighters].sort(() => Math.random() - 0.5);
  const pA = shuffled[0];
  const pB = shuffled[1];

  // Simulate fight (±25% randomness)
  const powA = getPokemonPower(pA) * (0.75 + Math.random() * 0.5);
  const powB = getPokemonPower(pB) * (0.75 + Math.random() * 0.5);
  const winner = powA >= powB ? pA : pB;
  const loser  = powA >= powB ? pB : pA;

  // XP: winner gets 1.25x bonus (mêlée générale), loser still learns
  const winXP  = Math.round(25 * mult * 1.25);
  const loseXP = Math.round(10 * mult);
  const prevWinnerName = speciesName(winner.species_en);
  const prevLoserName  = speciesName(loser.species_en);
  levelUpPokemon(winner, winXP);
  levelUpPokemon(loser, loseXP);

  const msg = `${prevWinnerName} [W] bat ${prevLoserName} [L] (+${winXP} / +${loseXP} XP)`;
  room.log.push(msg);

  // Store last fight for visual display
  room.lastFight = {
    winner: { species_en: winner.species_en, level: winner.level },
    loser:  { species_en: loser.species_en,  level: loser.level  },
  };

  // Everyone else gets passive XP
  const passiveXP = Math.round(6 * mult);
  for (const p of fighters) {
    if (p.id !== pA.id && p.id !== pB.id) levelUpPokemon(p, passiveXP);
  }

  // Check for evolutions in training room
  for (const p of fighters) {
    const nameBefore = speciesName(p.species_en);
    const evolved = tryAutoEvolution(p);
    if (evolved) {
      const m = `${nameBefore} evolue en ${speciesName(p.species_en)} dans la salle !`;
      room.log.push(m);
      notify(m, 'gold');
    }
  }

  // Random events: potential gain
  for (const p of fighters) {
    if (Math.random() < 0.002 && p.potential < 5) {
      p.potential++;
      const m = `${speciesName(p.species_en)} a gagne du potentiel en s'entrainant ! (${p.potential}*)`;
      room.log.push(m);
      notify(m, 'gold');
    }
  }

  if (room.log.length > 50) room.log = room.log.slice(-50);

  saveState();
  if (activeTab === 'tabTraining' || (activeTab === 'tabPC' && pcView === 'training')) renderTrainingTab();
}

Object.assign(globalThis, { renderTrainingTab, trainingRoomTick });
export {};
