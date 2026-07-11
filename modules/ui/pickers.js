'use strict';

import { BOSS_TEAM_SLOTS, SHOWCASE_SLOTS, MAX_BOSS_NAME_LENGTH, MAX_GANG_NAME_LENGTH } from '../../data/game-config-data.js';

import { EventBus, EVENTS } from '../core/eventBus.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY,        { msg, type });
const _dirty  = ()               => EventBus.emit(EVENTS.STATE_DIRTY);
const _topBar = ()               => EventBus.emit(EVENTS.UI_TOPBAR_UPDATE);
const _save   = ()               => globalThis.saveState?.();


// ── Picker modals ────────────────────────────────────────────────────────────
// openTeamPicker      — choisir un Pokémon pour une équipe (boss ou agent)
// openAssignToPicker  — choisir une destination depuis le PC
// openShowcasePicker  — choisir un Pokémon pour un slot de vitrine
// showEvoPreviewModal — aperçu de la prochaine évolution
// openTeamPickerModal — raccourci vers openTeamPicker('boss', ...)
// openBossEditModal   — éditer nom du boss/gang + sprite
//
// Dépendances globalThis :
//   state, notify, saveState, pokeSprite, speciesName, getPokemonPower,
//   trainerSprite, renderPCTab, calculateStats, tryAutoEvolution,
//   updateTopBar, activeTab, removePokemonFromAllAssignments,
//   pokemonDisplayName, renderGangTab, openSpritePicker
//
// Classic-script globals accédés par nom brut :
//   EVO_BY_SPECIES, SPECIES_BY_EN

// ── Sélecteur de Pokémon pour une équipe ────────────────────────────────────
function openTeamPicker(type, targetId, onDone) {
  const state = globalThis.state;
  const assignedIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => assignedIds.add(id));
  const available = state.pokemons
    .filter(p => !assignedIds.has(p.id))
    .sort((a, b) => globalThis.getPokemonPower(b) - globalThis.getPokemonPower(a));

  if (available.length === 0) {
    _notify(state.lang === 'fr' ? 'Aucun Pokémon disponible' : 'No Pokémon available');
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
      if (state.gang.bossTeam.length < BOSS_TEAM_SLOTS) {
        globalThis.removePokemonFromAllAssignments(pkId);
        state.gang.bossTeam.push(pkId);
        if (state.gang.bossTeamSlots) state.gang.bossTeamSlots[state.gang.activeBossTeamSlot || 0] = [...state.gang.bossTeam];
      }
    } else {
      const agent = state.agents.find(a => a.id === targetId);
      const agentSlots = globalThis.getAgentTeamSlots?.(agent) ?? 3;
      if (agent && agent.team.length < agentSlots) agent.team.push(pkId);
    }
    _save();
    overlay.remove();
    _notify(`${globalThis.speciesName(pk.species_en)} → ${targetLabel}`, 'success');
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
    _notify(state.lang === 'fr' ? 'Déjà dans une équipe !' : 'Already in a team!');
    return;
  }

  const destinations = [];
  if (state.gang.bossTeam.length < BOSS_TEAM_SLOTS) {
    destinations.push({
      type: 'boss', id: null,
      label: state.gang.bossName + ' (Boss)',
      sprite: state.gang.bossSprite ? globalThis.trainerSprite(state.gang.bossSprite) : null,
    });
  }
  for (const a of state.agents) {
    const agentSlots = globalThis.getAgentTeamSlots?.(a) ?? 3;
    if (a.team.length < agentSlots) destinations.push({ type: 'agent', id: a.id, label: a.name, sprite: a.sprite });
  }

  if (destinations.length === 0) {
    _notify(state.lang === 'fr' ? 'Toutes les équipes sont pleines !' : 'All teams are full!');
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
              ? `${state.gang.bossTeam.length}/${BOSS_TEAM_SLOTS}`
              : (() => { const _a = state.agents.find(a => a.id === d.id); return `${_a?.team.length || 0}/${globalThis.getAgentTeamSlots?.(_a) ?? 3}`; })()}
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
        if (state.gang.bossTeam.length < BOSS_TEAM_SLOTS) {
          globalThis.removePokemonFromAllAssignments(pokemonId);
          state.gang.bossTeam.push(pokemonId);
        }
      } else {
        const agent = state.agents.find(a => a.id === destId);
        const agentSlots = globalThis.getAgentTeamSlots?.(agent) ?? 3;
        if (agent && agent.team.length < agentSlots) agent.team.push(pokemonId);
      }
      _save();
      overlay.remove();
      const destLabel = destType === 'boss'
        ? state.gang.bossName
        : (state.agents.find(a => a.id === destId)?.name || 'Agent');
      _notify(`${globalThis.speciesName(pk.species_en)} → ${destLabel}`, 'success');
      globalThis.renderPCTab?.();
    });
  });
}

// openRareCandyPicker supprimé — le Super Bonbon consommable a été remplacé par
// l'achat direct de niveaux (Scientifique) dans la fiche Pokémon (pcPokedex.js).

// ── Vitrine du gang — choisir un Pokémon pour un slot showcase ───────────────
function openShowcasePicker(slotIdx) {
  const state = globalThis.state;
  const usedIds = new Set((state.gang.showcase || []).filter(Boolean));
  const teamIds = new Set(state.gang.bossTeam);
  const candidates = state.pokemons.filter(p => !teamIds.has(p.id));

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center';

  const _renderItems = (filtered) => filtered.map(p => `
    <div class="showcase-pick-item" data-pk-id="${p.id}" style="display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid var(--border);cursor:pointer">
      <img src="${globalThis.pokeSprite(p.species_en, p.shiny)}" style="width:36px;height:36px;image-rendering:pixelated">
      <div style="flex:1">
        <div style="font-size:10px">${globalThis.pokemonDisplayName(p)}${p.shiny ? ' ✨' : ''} ${'★'.repeat(p.potential)}</div>
        <div style="font-size:9px;color:var(--text-dim)">Lv.${p.level}</div>
      </div>
    </div>`).join('') || `<div style="padding:16px;text-align:center;color:var(--text-dim);font-size:10px">Aucun Pokémon disponible</div>`;

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:360px;width:90%;display:flex;flex-direction:column;gap:12px;max-height:80vh">
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">VITRINE — SLOT ${slotIdx + 1}</div>
      <input type="text" id="showcasePickSearch" placeholder="Rechercher un Pokémon…" style="font-family:var(--font-body);font-size:11px;padding:7px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
      <div id="showcasePickList" style="overflow-y:auto;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:360px">${_renderItems(candidates)}</div>
      <button id="showcasePickCancel" style="font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
    </div>`;
  document.body.appendChild(modal);

  const listEl = modal.querySelector('#showcasePickList');
  function _wireItems() {
    listEl.querySelectorAll('.showcase-pick-item').forEach(el => {
      el.addEventListener('click', () => {
        if (!state.gang.showcase) state.gang.showcase = [];
        while (state.gang.showcase.length < SHOWCASE_SLOTS) state.gang.showcase.push(null);
        state.gang.showcase[slotIdx] = el.dataset.pkId;
        _save();
        modal.remove();
        globalThis.renderGangTab?.();
      });
    });
  }
  _wireItems();

  modal.querySelector('#showcasePickSearch').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = q
      ? candidates.filter(p => globalThis.pokemonDisplayName(p).toLowerCase().includes(q) || p.species_en.toLowerCase().includes(q))
      : candidates;
    listEl.innerHTML = _renderItems(filtered);
    _wireItems();
  });

  modal.querySelector('#showcasePickCancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ── Aperçu d'évolution ────────────────────────────────────────────────────────
function showEvoPreviewModal(p) {
  const evos = EVO_BY_SPECIES[p.species_en] || [];
  if (!evos.length) return;

  // Stat la plus haute → détermine quelle evo suggérer si plusieurs
  const stats = p.stats || globalThis.calculateStats(p);
  const statKeys = Object.keys(stats);
  let bestEvo = evos[0];
  if (evos.length > 1) {
    // Choisir selon la stat dominante (ATK → dernier, DEF → avant-dernier, SPD → premier)
    const maxStatKey = statKeys.reduce((a, b) => (stats[a] || 0) >= (stats[b] || 0) ? a : b, statKeys[0]);
    // Heuristique simple : si SPD dominant → première evo, si DEF → dernière, sinon première
    bestEvo = evos[0];
  }

  const sp = SPECIES_BY_EN[bestEvo.to];
  const reqText = bestEvo.req === 'item' ? 'Pierre d\'évolution' : `Niveau ${bestEvo.req}`;
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:300px;width:90%;display:flex;flex-direction:column;align-items:center;gap:12px">
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">ÉVOLUTION</div>
      <div style="display:flex;align-items:center;gap:16px">
        <div style="text-align:center">
          <img src="${globalThis.pokeSprite(p.species_en, p.shiny)}" style="width:64px;height:64px;image-rendering:pixelated">
          <div style="font-size:9px;margin-top:4px">${globalThis.pokemonDisplayName(p)}</div>
          <div style="font-size:8px;color:var(--text-dim)">Lv.${p.level}</div>
        </div>
        <div style="font-size:18px;color:var(--gold)">→</div>
        <div style="text-align:center">
          <img src="${globalThis.pokeSprite(bestEvo.to)}" style="width:64px;height:64px;image-rendering:pixelated;filter:brightness(.6)">
          <div style="font-size:9px;margin-top:4px;color:var(--gold)">${globalThis.speciesName(bestEvo.to)}</div>
          <div style="font-size:8px;color:var(--text-dim)">${reqText}</div>
        </div>
      </div>
      ${evos.length > 1 ? `<div style="font-size:8px;color:var(--text-dim);text-align:center">Autres formes : ${evos.slice(1).map(e => globalThis.speciesName(e.to)).join(', ')}</div>` : ''}
      <button style="font-family:var(--font-pixel);font-size:8px;padding:8px 16px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer" id="evoModalClose">Fermer</button>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#evoModalClose').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ── Team picker du boss (raccourci) ──────────────────────────────────────────
function openTeamPickerModal(slotIdx, onDone) {
  openTeamPicker('boss', null, onDone);
}

// ── Éditer le nom/sprite du boss et du gang ──────────────────────────────────
function openBossEditModal(onDone) {
  const state = globalThis.state;
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:340px;width:90%;display:flex;flex-direction:column;gap:12px">
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">MODIFIER LE BOSS</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <label style="font-size:9px;color:var(--text-dim)">Nom du Boss</label>
        <input id="bossEditName" type="text" maxlength="${MAX_BOSS_NAME_LENGTH}" value="${state.gang.bossName}"
          style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:8px 10px;font-size:12px;outline:none;width:100%;box-sizing:border-box">
        <label style="font-size:9px;color:var(--text-dim)">Nom du Gang</label>
        <input id="bossEditGangName" type="text" maxlength="${MAX_GANG_NAME_LENGTH}" value="${state.gang.name}"
          style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:8px 10px;font-size:12px;outline:none;width:100%;box-sizing:border-box">
      </div>
      <button id="bossEditSprite" style="font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">🎨 Changer le sprite</button>
      <div style="display:flex;gap:8px">
        <button id="bossEditCancel" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
        <button id="bossEditConfirm" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Confirmer</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#bossEditConfirm').addEventListener('click', () => {
    const newBossName = modal.querySelector('#bossEditName').value.trim();
    const newGangName = modal.querySelector('#bossEditGangName').value.trim();
    if (newBossName) state.gang.bossName = newBossName.slice(0, MAX_BOSS_NAME_LENGTH);
    if (newGangName) state.gang.name = newGangName.slice(0, MAX_GANG_NAME_LENGTH);
    _save();
    globalThis.updateTopBar?.();
    _notify('Gang mis à jour', 'success');
    modal.remove();
    if (onDone) onDone();
  });
  modal.querySelector('#bossEditSprite').addEventListener('click', () => {
    globalThis.openSpritePicker?.(state.gang.bossSprite, (newSprite) => {
      state.gang.bossSprite = newSprite;
      _save();
      globalThis.updateTopBar?.();
      modal.remove();
      if (onDone) onDone();
    });
  });
  modal.querySelector('#bossEditCancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

Object.assign(globalThis, {
  openTeamPicker,
  openAssignToPicker,
  openShowcasePicker,
  showEvoPreviewModal,
  openTeamPickerModal,
  openBossEditModal,
});

export {};
