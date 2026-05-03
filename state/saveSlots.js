'use strict';

let saveSlotContext = {};

export function configureSaveSlots(ctx = {}) {
  saveSlotContext = { ...saveSlotContext, ...ctx };
}

function requireContext(name) {
  const value = saveSlotContext[name];
  if (value === undefined) {
    throw new Error(`[saveSlots] Missing context dependency: ${name}`);
  }
  return value;
}

function getState() {
  return requireContext('getState')();
}

function setState(nextState) {
  return requireContext('setState')(nextState);
}

function getSaveKeys() {
  return requireContext('getSaveKeys')();
}

function getActiveSaveSlot() {
  return requireContext('getActiveSaveSlot')();
}

function setActiveSaveSlot(slotIdx) {
  return requireContext('setActiveSaveSlot')(slotIdx);
}

function getStorage() {
  return requireContext('localStorage');
}

function getDocument() {
  return requireContext('document');
}

function formatPlaytime(seconds) {
  return requireContext('formatPlaytime')(seconds);
}

function notify(...args) {
  return requireContext('notify')(...args);
}

function showConfirm(...args) {
  return requireContext('showConfirm')(...args);
}

function saveState() {
  return requireContext('saveState')();
}

function migrate(saved) {
  return requireContext('migrate')(saved);
}

function renderAll() {
  return requireContext('renderAll')();
}

export function getSlotPreview(slotIdx) {
  const keys = getSaveKeys();
  const raw = getStorage()?.getItem(keys[slotIdx]);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    const teamIds = s.gang?.bossTeam || [];
    const teamSprites = teamIds.slice(0, 3).map(id => {
      const pk = (s.pokemons || []).find(p => p.id === id);
      return pk ? pk.species_en : null;
    }).filter(Boolean);
    const agentSprites = (s.agents || []).slice(0, 3).map(a => a.sprite);
    return {
      name: s.gang?.name || '???',
      money: s.gang?.money || 0,
      pokemon: (s.pokemons || []).length,
      rep: s.gang?.reputation || 0,
      ts: s._savedAt || 0,
      playtime: s.playtime || 0,
      bossName: s.gang?.bossName || 'Boss',
      bossSprite: s.gang?.bossSprite || '',
      teamSprites,
      agentCount: (s.agents || []).length,
      agentSprites,
    };
  } catch {
    return null;
  }
}

export function openSaveSlotModal() {
  const document = getDocument();
  const storage = getStorage();
  if (!document || !storage) return;

  const overlay = document.createElement('div');
  overlay.id = 'saveSlotModal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center';

  const slots = [0, 1, 2].map(i => {
    const prev = getSlotPreview(i);
    const isActive = i === getActiveSaveSlot();
    const label = prev
      ? `<div style="font-family:var(--font-pixel);font-size:9px;color:${isActive ? 'var(--gold)' : 'var(--text)'};margin-bottom:4px">${prev.name}</div>
         <div style="font-size:10px;color:var(--text-dim)">${prev.pokemon} Pokemon  |  ${prev.money.toLocaleString()}P  |  Rep ${prev.rep}</div>
         <div style="font-size:9px;color:var(--text-dim);margin-top:2px">${prev.ts ? new Date(prev.ts).toLocaleString() : ''}${prev.playtime ? ' — ' + formatPlaytime(prev.playtime) : ''}</div>`
      : `<div style="font-size:10px;color:var(--text-dim);font-style:italic">Slot vide</div>`;
    return `<div style="border:2px solid ${isActive ? 'var(--gold)' : 'var(--border)'};border-radius:var(--radius);padding:12px;margin-bottom:10px;background:var(--bg-panel)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim)">SLOT ${i + 1}</span>
        ${isActive ? '<span style="font-size:9px;color:var(--gold);margin-left:auto">[ACTIF]</span>' : ''}
      </div>
      ${label}
      <div style="display:flex;gap:6px;margin-top:10px">
        ${prev ? `<button class="slot-load" data-slot="${i}" style="flex:1;font-size:9px;padding:5px;background:var(--bg);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--green);cursor:pointer">Charger</button>` : ''}
        <button class="slot-save" data-slot="${i}" style="flex:1;font-size:9px;padding:5px;background:var(--bg);border:1px solid var(--blue);border-radius:var(--radius-sm);color:var(--blue);cursor:pointer">Sauvegarder</button>
        ${prev && !isActive ? `<button class="slot-del" data-slot="${i}" style="flex:1;font-size:9px;padding:5px;background:var(--bg);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--red);cursor:pointer">Supprimer</button>` : ''}
      </div>
    </div>`;
  }).join('');

  overlay.innerHTML = `<div style="background:var(--bg-panel);border:2px solid var(--gold);border-radius:var(--radius);width:90%;max-width:420px;padding:20px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <span style="font-family:var(--font-pixel);font-size:11px;color:var(--gold)">SAUVEGARDES</span>
      <button id="closeSlotModal" style="background:none;border:none;color:var(--text-dim);font-size:20px;cursor:pointer">&times;</button>
    </div>
    ${slots}
  </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#closeSlotModal').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelectorAll('.slot-load').forEach(btn => {
    btn.addEventListener('click', () => { loadSlot(parseInt(btn.dataset.slot)); overlay.remove(); });
  });
  overlay.querySelectorAll('.slot-save').forEach(btn => {
    btn.addEventListener('click', () => { saveToSlot(parseInt(btn.dataset.slot)); overlay.remove(); });
  });
  overlay.querySelectorAll('.slot-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const slotIdx = parseInt(btn.dataset.slot);
      showConfirm(`Supprimer le slot ${slotIdx + 1} ?`, () => {
        storage.removeItem(getSaveKeys()[slotIdx]);
        overlay.remove();
        notify('Slot supprime.', 'success');
      }, null, { danger: true, confirmLabel: 'Supprimer', cancelLabel: 'Annuler' });
    });
  });
}

export function saveToSlot(slotIdx) {
  const state = getState();
  const storage = getStorage();
  const keys = getSaveKeys();
  if (!state || !storage) return;

  const prev = getActiveSaveSlot();
  state._savedAt = Date.now();
  storage.setItem(keys[prev], JSON.stringify(state));
  setActiveSaveSlot(slotIdx);
  saveState();
  notify(`Sauvegarde Slot ${slotIdx + 1}`, 'success');
}

export function loadSlot(slotIdx) {
  const storage = getStorage();
  const keys = getSaveKeys();
  const raw = storage?.getItem(keys[slotIdx]);
  if (!raw) { notify('Slot vide.'); return; }
  try {
    setState(migrate(JSON.parse(raw)));
    setActiveSaveSlot(slotIdx);
    renderAll();
    notify(`Slot ${slotIdx + 1} charge !`, 'success');
  } catch {
    notify('Erreur de chargement.');
  }
}
