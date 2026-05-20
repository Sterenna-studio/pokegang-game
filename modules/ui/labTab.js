'use strict';

let labSelectedId = null;
let labShowAll = false;

// ════════════════════════════════════════════════════════════════
// LAB TAB
// ════════════════════════════════════════════════════════════════
function renderLabTabInEl(tab) {
  if (!tab) return;

  const teamIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => teamIds.add(id));
  const pensionSet = getPensionSlotIds();

  const allUpgradeable = state.pokemons
    .filter(p => p.potential < 5)
    .sort((a, b) => b.potential - a.potential || getPokemonPower(b) - getPokemonPower(a));

  const possible = allUpgradeable.filter(p => {
    const cost = POT_UPGRADE_COSTS[p.potential - 1] || 99;
    const donors = state.pokemons.filter(d =>
      d.species_en === p.species_en && d.id !== p.id &&
      !d.shiny && d.potential <= p.potential &&
      !teamIds.has(d.id) && !state.trainingRoom.pokemon?.includes(d.id) &&
      !pensionSet.has(d.id)
    );
    return donors.length >= cost;
  });

  const displayList = labShowAll ? allUpgradeable : possible;
  const selected = labSelectedId ? state.pokemons.find(p => p.id === labSelectedId) : null;

  // ── Panneau mutation ────────────────────────────────────────
  let mutationHtml = `
    <div style="color:var(--text-dim);font-size:9px;padding:16px;text-align:center;line-height:1.6">
      Sélectionne un Pokémon<br><br>
      <span style="font-size:8px">Par défaut, seules les mutations<br>réalisables sont affichées.</span>
    </div>`;
  if (selected) {
    const cost = POT_UPGRADE_COSTS[selected.potential - 1] || 99;
    const donors = state.pokemons.filter(d =>
      d.species_en === selected.species_en && d.id !== selected.id &&
      !d.shiny && d.potential <= selected.potential &&
      !teamIds.has(d.id) && !state.trainingRoom.pokemon?.includes(d.id) &&
      !pensionSet.has(d.id)
    );
    const canUpgrade = donors.length >= cost && selected.potential < 5;
    mutationHtml = `
      <div style="text-align:center;margin-bottom:12px">
        <img src="${pokeSprite(selected.species_en, selected.shiny)}" style="width:80px;height:80px">
        <div style="font-family:var(--font-pixel);font-size:10px;margin-top:4px">${speciesName(selected.species_en)}</div>
        <div style="font-size:10px;color:var(--gold)">${'*'.repeat(selected.potential)} → ${'*'.repeat(selected.potential + 1)}</div>
      </div>
      <div style="font-size:10px;margin-bottom:8px">
        <div>Potentiel : <b>${selected.potential}/5</b></div>
        <div>Spécimens : <b style="color:${donors.length >= cost ? 'var(--green)' : 'var(--red)'}">${donors.length}/${cost}</b></div>
      </div>
      <div style="font-size:8px;color:var(--text-dim);margin-bottom:10px">Équipe + Formation protégées.</div>
      <button id="btnLabUpgrade" style="width:100%;font-size:10px;padding:8px;background:var(--bg);
        border:2px solid ${canUpgrade ? 'var(--gold)' : 'var(--border)'};border-radius:var(--radius-sm);
        color:${canUpgrade ? 'var(--gold)' : 'var(--text-dim)'};cursor:${canUpgrade ? 'pointer' : 'default'}"
        ${canUpgrade ? '' : 'disabled'}>
        ${canUpgrade ? '⚗ MUTER LE POTENTIEL' : 'Spécimens insuffisants'}
      </button>
      <div style="margin-top:12px">
        <div style="font-size:8px;color:var(--text-dim);margin-bottom:4px">COÛTS</div>
        ${POT_UPGRADE_COSTS.map((c, i) =>
          `<div style="font-size:8px;${selected.potential - 1 === i ? 'color:var(--gold)' : 'color:var(--text-dim)'}">
            ${'★'.repeat(i+1)} → ${'★'.repeat(i+2)}: ${c} specimens
          </div>`
        ).join('')}
      </div>`;
  }

  // ── Panneau tracker ─────────────────────────────────────────
  const tracked = state.lab?.trackedSpecies || [];
  const ownedSpecies = [...new Set(state.pokemons.map(p => p.species_en))].sort((a, b) =>
    speciesName(a).localeCompare(speciesName(b))
  );
  const trackerHtml = `
    <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:8px">🔍 TRACKER</div>
    <div style="display:flex;gap:6px;margin-bottom:10px">
      <select id="labTrackerSel" style="flex:1;font-size:9px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:3px">
        <option value="">— Espèce —</option>
        ${ownedSpecies.map(en => `<option value="${en}">${speciesName(en)}</option>`).join('')}
      </select>
      <button id="btnLabTrack" style="font-size:10px;padding:3px 10px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:3px;color:var(--gold);cursor:pointer">+</button>
    </div>
    ${tracked.length === 0
      ? '<div style="font-size:9px;color:var(--text-dim)">Aucune espèce suivie.</div>'
      : tracked.map(species => {
          const owned = state.pokemons.filter(p => p.species_en === species);
          const byPot = [1,2,3,4,5].map(pot => owned.filter(p => p.potential === pot).length);
          const mutPossible = [1,2,3,4].some(pot => {
            const cost = POT_UPGRADE_COSTS[pot - 1] || 99;
            const donors = owned.filter(d => d.potential === pot &&
              !teamIds.has(d.id) && !state.trainingRoom.pokemon?.includes(d.id));
            const targets = owned.filter(d => d.potential === pot);
            return targets.length > 0 && donors.length >= cost + 1;
          });
          return `<div style="border:1px solid ${mutPossible ? 'var(--gold-dim)' : 'var(--border)'};border-radius:var(--radius-sm);padding:8px;background:var(--bg);margin-bottom:6px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
              <img src="${pokeSprite(species)}" style="width:26px;height:26px">
              <span style="font-size:9px;flex:1"><b>${speciesName(species)}</b> — <span style="color:var(--gold)">${owned.length}</span></span>
              <button class="lab-untrack" data-untrack="${species}" style="font-size:8px;padding:1px 5px;background:var(--bg);border:1px solid var(--red);border-radius:2px;color:var(--red);cursor:pointer">✕</button>
            </div>
            <div style="display:flex;gap:3px;flex-wrap:wrap">
              ${byPot.map((n, i) => `<div style="font-size:8px;padding:2px 5px;border-radius:2px;
                background:${n > 0 ? 'rgba(255,204,90,0.12)' : 'rgba(0,0,0,0)'};
                border:1px solid ${n > 0 ? 'var(--gold-dim)' : 'var(--border)'}">
                ${'★'.repeat(i+1)}: <b>${n}</b>
              </div>`).join('')}
            </div>
            ${mutPossible ? '<div style="font-size:8px;color:var(--green);margin-top:4px">⚡ Mutation possible !</div>' : ''}
          </div>`;
        }).join('')
    }`;

  // ── Liste candidates ────────────────────────────────────────
  const listHtml = displayList.map(p => {
    const cost = POT_UPGRADE_COSTS[p.potential - 1] || 99;
    const donors = state.pokemons.filter(d =>
      d.species_en === p.species_en && d.id !== p.id &&
      !d.shiny && d.potential <= p.potential &&
      !teamIds.has(d.id) && !state.trainingRoom.pokemon?.includes(d.id)
    );
    const ready = donors.length >= cost;
    return `<div class="lab-candidate" data-lab-id="${p.id}"
      style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--border);
      cursor:pointer;background:${labSelectedId === p.id ? 'var(--bg-hover)' : ''}">
      <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:36px;height:36px">
      <div style="flex:1">
        <div style="font-size:10px">${speciesName(p.species_en)} ${'★'.repeat(p.potential)}</div>
        <div style="font-size:9px;color:${ready ? 'var(--green)' : 'var(--text-dim)'}">
          ${ready ? `✓ Prêt (${donors.length}/${cost})` : `${donors.length}/${cost} spécimens`}
        </div>
      </div>
    </div>`;
  }).join('') || `<div style="color:var(--text-dim);font-size:9px;padding:14px;text-align:center">
    ${labShowAll ? 'Tous vos Pokémon sont au potentiel max' : 'Aucune mutation réalisable actuellement.<br>Activez « Tous » pour voir tous les candidats.'}
  </div>`;

  // ── Rendu principal ─────────────────────────────────────────
  tab.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 290px;gap:14px;padding:12px;min-height:400px">
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">LABORATOIRE</div>
          <button id="btnLabToggleAll" style="font-family:var(--font-pixel);font-size:8px;padding:3px 8px;
            background:${labShowAll ? 'var(--gold-dim)' : 'var(--bg)'};
            border:1px solid ${labShowAll ? 'var(--gold)' : 'var(--border)'};border-radius:3px;
            color:${labShowAll ? 'var(--bg)' : 'var(--text-dim)'};cursor:pointer">
            ${labShowAll ? '✓ TOUS' : 'PRÊTS seulement'}
          </button>
        </div>
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);flex:1;overflow-y:auto;max-height:520px">${listHtml}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;overflow-y:auto;max-height:600px">
        ${(() => {
          const owned   = !!state.purchases.scientist;
          const enabled = state.purchases.scientistEnabled !== false;
          const color   = owned ? (enabled ? 'var(--green)' : 'var(--border)') : 'var(--border)';
          return `<div style="background:var(--bg-panel);border:1px solid ${color};border-radius:var(--radius);padding:10px;display:flex;gap:10px;align-items:flex-start">
            <img src="${trainerSprite('scientist')}" style="width:36px;height:36px;image-rendering:pixelated;flex-shrink:0;${owned && !enabled ? 'opacity:.4;filter:grayscale(1)' : ''}" onerror="this.style.display='none'">
            <div style="flex:1">
              <div style="font-family:var(--font-pixel);font-size:8px;color:${owned ? (enabled ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:3px">Scientifique peu scrupuleux</div>
              <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">Mutation artificielle : sacrifice d'un ★★★★★ même espèce → potentiel max.</div>
              ${owned
                ? `<div style="display:flex;align-items:center;gap:8px">
                     <span style="font-family:var(--font-pixel);font-size:7px;color:${enabled ? 'var(--green)' : 'var(--text-dim)'}">${enabled ? '✓ EN POSTE' : '✗ RENVOYÉ'}</span>
                     <button id="btnLabToggleScientist" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid ${enabled ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${enabled ? 'var(--red)' : 'var(--green)'};cursor:pointer">${enabled ? 'Renvoyer' : 'Rappeler'}</button>
                   </div>`
                : `<button id="btnLabBuyScientist" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Engager — 5 000 000₽</button>`}
            </div>
          </div>`;
        })()}
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:12px">${mutationHtml}</div>
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:12px">${trackerHtml}</div>
      </div>
    </div>`;

  // ── Scientist card handlers (Lab) ──
  tab.querySelector('#btnLabBuyScientist')?.addEventListener('click', () => {
    if (state.gang.money < 5_000_000) { notify('Fonds insuffisants.', 'error'); return; }
    showConfirm('Engager le Scientifique peu scrupuleux pour <b>5 000 000₽</b> ?<br><span style="font-size:10px;color:var(--text-dim)">Permet la mutation artificielle depuis ce Labo et le menu contextuel du PC.</span>', () => {
      state.gang.money -= 5_000_000;
      state.purchases.scientist = true;
      state.purchases.scientistEnabled = true;
      saveState(); updateTopBar(); SFX.play('unlock');
      notify('🧬 Le scientifique est en poste !', 'gold');
      if (pcView === 'lab') renderPCTab(); else renderLabTab();
    }, null, { confirmLabel: 'Engager', cancelLabel: 'Annuler' });
  });
  tab.querySelector('#btnLabToggleScientist')?.addEventListener('click', () => {
    state.purchases.scientistEnabled = state.purchases.scientistEnabled === false;
    saveState();
    notify(state.purchases.scientistEnabled !== false ? '🧬 Scientifique rappelé !' : '🚫 Scientifique renvoyé.', 'success');
    if (pcView === 'lab') renderPCTab(); else renderLabTab();
  });

  tab.querySelectorAll('.lab-candidate').forEach(el => {
    el.addEventListener('click', () => {
      labSelectedId = el.dataset.labId;
      if (pcView === 'lab') renderPCTab(); else renderLabTab();
    });
  });

  tab.querySelector('#btnLabToggleAll')?.addEventListener('click', () => {
    labShowAll = !labShowAll;
    if (pcView === 'lab') renderPCTab(); else renderLabTab();
  });

  tab.querySelector('#btnLabUpgrade')?.addEventListener('click', () => {
    if (!selected) return;
    const cost = POT_UPGRADE_COSTS[selected.potential - 1];
    const donors = state.pokemons.filter(d =>
      d.species_en === selected.species_en && d.id !== selected.id &&
      !d.shiny && d.potential <= selected.potential &&
      !teamIds.has(d.id) && !state.trainingRoom.pokemon?.includes(d.id) &&
      !pensionSet.has(d.id)
    );
    if (donors.length < cost) return;
    const toSacrifice = donors.slice(0, cost).map(p => p.id);
    state.pokemons = state.pokemons.filter(p => !toSacrifice.includes(p.id)); globalThis.markDirty?.();
    selected.potential++;
    saveState();
    resetPcRenderCache();
    notify(`${speciesName(selected.species_en)} est maintenant ${'★'.repeat(selected.potential)} !`, 'gold');
    if (pcView === 'lab') renderPCTab(); else renderLabTab();
    updateTopBar();
  });

  tab.querySelector('#btnLabTrack')?.addEventListener('click', () => {
    const val = document.getElementById('labTrackerSel')?.value;
    if (!val) return;
    if (!state.lab.trackedSpecies.includes(val)) {
      state.lab.trackedSpecies.push(val);
      saveState();
      if (pcView === 'lab') renderPCTab(); else renderLabTab();
    }
  });

  tab.querySelectorAll('.lab-untrack').forEach(btn => {
    btn.addEventListener('click', () => {
      state.lab.trackedSpecies = state.lab.trackedSpecies.filter(s => s !== btn.dataset.untrack);
      saveState();
      if (pcView === 'lab') renderPCTab(); else renderLabTab();
    });
  });
}

function renderLabTab() {
  const tab = document.getElementById('tabLab');
  if (!tab) return;
  renderLabTabInEl(tab);
}

Object.assign(globalThis, { renderLabTab, renderLabTabInEl });
export { renderLabTab, renderLabTabInEl };
