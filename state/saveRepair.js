'use strict';

let saveRepairContext = {};

export function configureSaveRepair(ctx = {}) {
  saveRepairContext = { ...saveRepairContext, ...ctx };
}

function requireContext(name) {
  const value = saveRepairContext[name];
  if (value === undefined) {
    throw new Error(`[saveRepair] Missing context dependency: ${name}`);
  }
  return value;
}

function getState() {
  return requireContext('getState')();
}

function setState(nextState) {
  return requireContext('setState')(nextState);
}

function migrate(saved) {
  return requireContext('migrate')(saved);
}

function saveState() {
  return requireContext('saveState')();
}

function renderAll() {
  return requireContext('renderAll')();
}

function notify(...args) {
  return requireContext('notify')(...args);
}

function showConfirm(...args) {
  return requireContext('showConfirm')(...args);
}

function getDocument() {
  return requireContext('document');
}

function getTitles() {
  return requireContext('getTitles')();
}

function getZones() {
  return requireContext('getZones')();
}

function getMaxHistory() {
  return requireContext('MAX_HISTORY');
}

export function applyAutoMutation(pokemons) {
  if (!Array.isArray(pokemons)) return 0;

  const candidates = pokemons
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => (p.potential || 1) === 4);

  candidates.sort((a, b) => {
    const aS = a.p.shiny ? 1 : 0;
    const bS = b.p.shiny ? 1 : 0;
    if (bS !== aS) return bS - aS;
    const aL = a.p.level ?? 0;
    const bL = b.p.level ?? 0;
    if (bL !== aL) return bL - aL;
    return a.idx - b.idx;
  });

  for (const { p } of candidates) p.potential = 5;
  return candidates.length;
}

export function cleanObsoleteData(saveData) {
  const validIds = new Set(getZones().map(z => z.id));
  let removed = 0;
  if (saveData?.zones) {
    for (const zoneId of Object.keys(saveData.zones)) {
      if (!validIds.has(zoneId)) {
        delete saveData.zones[zoneId];
        removed++;
      }
    }
  }
  return removed;
}

export function repairSave() {
  showConfirm(
    'Réparer la save : reappliquer toutes les migrations et corriger les champs manquants ?\nTes données ne seront pas effacées.',
    () => {
      try {
        const state = getState();
        const before = {
          pokemons: state.pokemons.length,
          agents: state.agents.length,
          money: state.gang.money,
          rep: state.gang.reputation,
        };

        const raw = JSON.parse(JSON.stringify(state));
        setState(migrate(raw));
        const repairedState = getState();

        let histTrimmed = 0;
        const maxHistory = getMaxHistory();
        for (const p of repairedState.pokemons) {
          if (p.history && p.history.length > maxHistory) {
            histTrimmed += p.history.length - maxHistory;
            p.history = p.history.slice(-maxHistory);
          }
        }

        const allIds = new Set(repairedState.pokemons.map(p => p.id));
        const teamBefore = repairedState.gang.bossTeam.length;
        repairedState.gang.bossTeam = repairedState.gang.bossTeam.filter(id => allIds.has(id));
        if (repairedState.pension.slots) repairedState.pension.slots = repairedState.pension.slots.filter(id => allIds.has(id));
        const trainBefore = repairedState.trainingRoom.pokemon.length;
        repairedState.trainingRoom.pokemon = repairedState.trainingRoom.pokemon.filter(id => allIds.has(id));

        const validTitleIds = new Set(getTitles().map(t => t.id));
        for (const key of ['titleA', 'titleB', 'titleC', 'titleD']) {
          if (repairedState.gang[key] && !validTitleIds.has(repairedState.gang[key])) repairedState.gang[key] = null;
        }
        if (!repairedState.gang.titleA) repairedState.gang.titleA = 'recrue';

        saveState();

        const ghostTeam = teamBefore - repairedState.gang.bossTeam.length;
        const ghostTrain = trainBefore - repairedState.trainingRoom.pokemon.length;
        const after = { pokemons: repairedState.pokemons.length, agents: repairedState.agents.length };
        const lines = [
          '✅ Migrations reappliquées',
          histTrimmed ? `📋 ${histTrimmed} entrée(s) d'historique tronquées` : null,
          ghostTeam ? `👥 ${ghostTeam} ID fantôme(s) retiré(s) de l'équipe boss` : null,
          ghostTrain ? `🏋 ${ghostTrain} ID fantôme(s) retiré(s) de la salle d'entraînement` : null,
          before.pokemons !== after.pokemons ? `⚠ Nombre de Pokémon modifié (${before.pokemons} → ${after.pokemons})` : null,
          `💾 Save sauvegardée — ${after.pokemons} Pokémon, ${after.agents} agents`,
        ].filter(Boolean);

        const document = getDocument();
        const rpt = document.createElement('div');
        rpt.style.cssText = 'position:fixed;inset:0;z-index:10100;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:20px';
        rpt.innerHTML = `
          <div style="background:var(--bg-panel);border:2px solid #ffa000;border-radius:var(--radius);padding:20px;max-width:380px;width:100%;display:flex;flex-direction:column;gap:10px">
            <div style="font-family:var(--font-pixel);font-size:10px;color:#ffa000">🔧 Rapport de réparation</div>
            <div style="display:flex;flex-direction:column;gap:6px">${lines.map(l => `<div style="font-size:9px;color:var(--text)">${l}</div>`).join('')}</div>
            <button id="btnRptClose" style="font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid #ffa000;border-radius:var(--radius-sm);color:#ffa000;cursor:pointer;margin-top:4px">Fermer</button>
          </div>`;
        document.body.appendChild(rpt);
        rpt.querySelector('#btnRptClose').addEventListener('click', () => { rpt.remove(); renderAll(); });
      } catch (err) {
        console.error('[PokéForge] repairSave() error:', err);
        notify('Erreur lors de la réparation — save non-modifiée.', 'error');
      }
    },
    null,
    { confirmLabel: 'Réparer', cancelLabel: 'Annuler' }
  );
}
