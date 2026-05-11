'use strict';

// ── Picker modals ────────────────────────────────────────────────────────────
// openTeamPicker      — choisir un Pokémon pour une équipe (boss ou agent)
// openAssignToPicker  — choisir une destination depuis le PC
// openRareCandyPicker — donner un Super Bonbon à un Pokémon
//
// Dépendances globalThis :
//   state, notify, saveState, pokeSprite, speciesName, getPokemonPower,
//   trainerSprite, renderPCTab, renderBagTab, calculateStats, tryAutoEvolution,
//   updateTopBar, activeTab, removePokemonFromAllAssignments

// ── Sélecteur de Pokémon pour une équipe ────────────────────────────────────
function openTeamPicker(type, targetId, onDone) {
  const state = globalThis.state;
  const assignedIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => assignedIds.add(id));
  const available = state.pokemons
    .filter(p => !assignedIds.has(p.id))
    .sort((a, b) => globalThis.getPokemonPower(b) - globalThis.getPokemonPower(a));

  if (available.length === 0) {
    globalThis.notify(state.lang === 'fr' ? 'Aucun Pokémon disponible' : 'No Pokémon available');
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'teamPickerOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;animation:fadeIn .2s ease';

  const targetLabel = type === 'boss'
    ? (state.lang === 'fr' ? 'Équipe du Boss' : 'Boss Team')
    : (state.agents.find(a => a.id === targetId)?.name || 'Agent');

  const _renderRow = p => {
    const power = globalThis.getPokemonPower(p);
    return `<div class="picker-pokemon" data-pick-id="${p.id}" style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s">
      <img src="${globalThis.pokeSprite(p.species_en, p.shiny)}" style="width:40px;height:40px">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px">${globalThis.speciesName(p.species_en)} ${'★'.repeat(p.potential)}${p.shiny ? ' ✨' : ''}</div>
        <div style="font-size:10px;color:var(--text-dim)">Lv.${p.level} — PC: ${power}</div>
      </div>
    </div>`;
  };

  overlay.innerHTML = `<div style="background:var(--bg-panel);border:2px solid var(--border);border-radius:var(--radius);width:90%;max-width:400px;max-height:70vh;display:flex;flex-direction:column">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:2px solid var(--border)">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">${state.lang === 'fr' ? 'Choisir un Pokémon' : 'Choose a Pokémon'} → ${targetLabel}</div>
      <button id="btnClosePicker" style="background:none;border:none;color:var(--text-dim);font-size:20px;cursor:pointer;line-height:1">&times;</button>
    </div>
    <div style="padding:6px 10px;border-bottom:1px solid var(--border)">
      <input id="pickerSearch" type="text" placeholder="Filtrer..." style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:11px;padding:4px 8px;box-sizing:border-box">
    </div>
    <div id="pickerList" style="overflow-y:auto;flex:1">${available.slice(0, 30).map(_renderRow).join('')}</div>
  </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#btnClosePicker').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  const _pick = (pkId) => {
    const pk = state.pokemons.find(p => p.id === pkId);
    if (!pk) return;
    if (type === 'boss') {
      if (state.gang.bossTeam.length < 3) {
        globalThis.removePokemonFromAllAssignments(pkId);
        state.gang.bossTeam.push(pkId);
        if (state.gang.bossTeamSlots) state.gang.bossTeamSlots[state.gang.activeBossTeamSlot || 0] = [...state.gang.bossTeam];
      }
    } else {
      const agent = state.agents.find(a => a.id === targetId);
      if (agent && agent.team.length < 3) agent.team.push(pkId);
    }
    globalThis.saveState();
    overlay.remove();
    globalThis.notify(`${globalThis.speciesName(pk.species_en)} → ${targetLabel}`, 'success');
    onDone?.();
  };

  const _bindPicks = (container) => {
    container.querySelectorAll('[data-pick-id]').forEach(el => {
      el.addEventListener('click', () => _pick(el.dataset.pickId));
    });
  };
  _bindPicks(overlay.querySelector('#pickerList'));

  // Filtre de recherche
  const searchInput = overlay.querySelector('#pickerSearch');
  const pickerList  = overlay.querySelector('#pickerList');
  if (searchInput && pickerList) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase();
      const filtered = q
        ? available.filter(p => globalThis.speciesName(p.species_en).toLowerCase().includes(q))
        : available;
      pickerList.innerHTML = filtered.slice(0, 50).map(_renderRow).join('');
      _bindPicks(pickerList);
    });
  }
}

// ── Assigner un Pokémon depuis le PC (choisir la destination) ────────────────
function openAssignToPicker(pokemonId) {
  const state = globalThis.state;
  const pk = state.pokemons.find(p => p.id === pokemonId);
  if (!pk) return;

  const assignedIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => assignedIds.add(id));
  if (assignedIds.has(pokemonId)) {
    globalThis.notify(state.lang === 'fr' ? 'Déjà dans une équipe !' : 'Already in a team!');
    return;
  }

  const destinations = [];
  if (state.gang.bossTeam.length < 3) {
    destinations.push({
      type: 'boss', id: null,
      label: state.gang.bossName + ' (Boss)',
      sprite: state.gang.bossSprite ? globalThis.trainerSprite(state.gang.bossSprite) : null,
    });
  }
  for (const a of state.agents) {
    if (a.team.length < 3) destinations.push({ type: 'agent', id: a.id, label: a.name, sprite: a.sprite });
  }

  if (destinations.length === 0) {
    globalThis.notify(state.lang === 'fr' ? 'Toutes les équipes sont pleines !' : 'All teams are full!');
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'teamPickerOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;animation:fadeIn .2s ease';

  overlay.innerHTML = `<div style="background:var(--bg-panel);border:2px solid var(--border);border-radius:var(--radius);width:90%;max-width:360px;max-height:60vh;display:flex;flex-direction:column">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:2px solid var(--border)">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">${globalThis.speciesName(pk.species_en)} → ?</div>
      <button id="btnClosePicker" style="background:none;border:none;color:var(--text-dim);font-size:20px;cursor:pointer;line-height:1">&times;</button>
    </div>
    <div style="overflow-y:auto;flex:1">
      ${destinations.map(d => `
        <div class="picker-dest" data-dest-type="${d.type}" data-dest-id="${d.id || ''}"
          style="display:flex;align-items:center;gap:10px;padding:10px 16px;
                 border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s">
          ${d.sprite
            ? `<img src="${d.sprite}" style="width:40px;height:40px;image-rendering:pixelated">`
            : '<div style="width:40px;height:40px;background:var(--bg);border-radius:4px;display:flex;align-items:center;justify-content:center">👤</div>'}
          <div style="font-size:12px">${d.label}</div>
          <div style="font-size:10px;color:var(--text-dim);margin-left:auto">
            ${d.type === 'boss'
              ? state.gang.bossTeam.length
              : (state.agents.find(a => a.id === d.id)?.team.length || 0)}/3
          </div>
        </div>`).join('')}
    </div>
  </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#btnClosePicker').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelectorAll('.picker-dest').forEach(el => {
    el.addEventListener('mouseenter', () => { el.style.background = 'var(--bg-hover)'; });
    el.addEventListener('mouseleave', () => { el.style.background = ''; });
    el.addEventListener('click', () => {
      const destType = el.dataset.destType;
      const destId   = el.dataset.destId;
      if (destType === 'boss') {
        if (state.gang.bossTeam.length < 3) {
          globalThis.removePokemonFromAllAssignments(pokemonId);
          state.gang.bossTeam.push(pokemonId);
        }
      } else {
        const agent = state.agents.find(a => a.id === destId);
        if (agent && agent.team.length < 3) agent.team.push(pokemonId);
      }
      globalThis.saveState();
      overlay.remove();
      const destLabel = destType === 'boss'
        ? state.gang.bossName
        : (state.agents.find(a => a.id === destId)?.name || 'Agent');
      globalThis.notify(`${globalThis.speciesName(pk.species_en)} → ${destLabel}`, 'success');
      globalThis.renderPCTab?.();
    });
  });
}

// ── Super Bonbon — choisir un Pokémon cible ──────────────────────────────────
function openRareCandyPicker() {
  const state = globalThis.state;
  if ((state.inventory.rarecandy || 0) <= 0) return;

  const teamIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => teamIds.add(id));

  const candidates = state.pokemons
    .filter(p => p.level < 100)
    .sort((a, b) => {
      const aT = teamIds.has(a.id) ? 1 : 0;
      const bT = teamIds.has(b.id) ? 1 : 0;
      if (bT !== aT) return bT - aT;
      return globalThis.getPokemonPower(b) - globalThis.getPokemonPower(a);
    });

  if (candidates.length === 0) {
    globalThis.notify(state.lang === 'fr' ? 'Tous les Pokémon sont au max !' : 'All Pokémon are maxed!');
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'rareCandyOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;animation:fadeIn .2s ease';

  const listHtml = candidates.slice(0, 25).map(p => {
    const inTeam = teamIds.has(p.id);
    return `<div class="picker-pokemon" data-candy-id="${p.id}"
      style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--border);cursor:pointer">
      <img src="${globalThis.pokeSprite(p.species_en, p.shiny)}" style="width:40px;height:40px">
      <div style="flex:1">
        <div style="font-size:12px">${inTeam ? '[EQ] ' : ''}${globalThis.speciesName(p.species_en)} ${'*'.repeat(p.potential)}${p.shiny ? ' [S]' : ''}</div>
        <div style="font-size:10px;color:var(--text-dim)">Lv.${p.level} → Lv.~${Math.min(100, p.level + 5)}</div>
      </div>
      ${inTeam ? '<span style="font-size:9px;color:var(--green)">Équipe</span>' : ''}
    </div>`;
  }).join('');

  overlay.innerHTML = `<div style="background:var(--bg-panel);border:2px solid var(--gold);border-radius:var(--radius);width:90%;max-width:380px;max-height:70vh;display:flex;flex-direction:column">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:2px solid var(--border)">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">🍬 Super Bonbon — stock: ${state.inventory.rarecandy}</div>
      <button id="btnCloseCandy" style="background:none;border:none;color:var(--text-dim);font-size:20px;cursor:pointer">&times;</button>
    </div>
    <div style="overflow-y:auto;flex:1">${listHtml}</div>
  </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#btnCloseCandy').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelectorAll('[data-candy-id]').forEach(el => {
    el.addEventListener('mouseenter', () => { el.style.background = 'var(--bg-hover)'; });
    el.addEventListener('mouseleave', () => { el.style.background = ''; });
    el.addEventListener('click', () => {
      if ((state.inventory.rarecandy || 0) <= 0) { overlay.remove(); return; }
      const p = state.pokemons.find(pk => pk.id === el.dataset.candyId);
      if (!p) return;
      const oldLv = p.level;
      state.inventory.rarecandy--;
      if (p.level < 100) {
        p.level++;
        p.xp = 0;
        p.stats = globalThis.calculateStats(p);
        globalThis.tryAutoEvolution(p);
      }
      globalThis.saveState();
      globalThis.notify(`🍬 ${globalThis.speciesName(p.species_en)} Lv.${oldLv} → Lv.${p.level}`, 'gold');
      overlay.remove();
      globalThis.renderBagTab?.();
      if (globalThis.activeTab === 'tabPC') globalThis.renderPCTab?.();
      globalThis.updateTopBar?.();
    });
  });
}

Object.assign(globalThis, {
  openTeamPicker,
  openAssignToPicker,
  openRareCandyPicker,
});

export {};
