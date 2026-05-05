'use strict';

// ════════════════════════════════════════════════════════════════
//  GANG COMPETITION TAB  —  UI du mode PvP en ligne
//  Dépendances globalThis :
//    state, notify, saveState, pokeSprite, switchTab, ZONES
//  Dépendances via import :
//    gangCompetition module
// ════════════════════════════════════════════════════════════════

import {
  publishDefense,
  loadGangList,
  executeRaid,
  loadPendingRaids,
  acknowledgeRaids,
  getRaidCooldownMs,
  RAID_PENALTY,
  REP_STEAL_RATIO,
} from '../systems/gangCompetition.js';

// ── Helpers locaux ────────────────────────────────────────────────
function state()     { return globalThis.state; }
function notify(...a){ return globalThis.notify?.(...a); }
function saveState() { return globalThis.saveState?.(); }
function pokeSprite(en, shiny) { return globalThis.pokeSprite?.(en, shiny) ?? ''; }

function _fmtMs(ms) {
  const m = Math.ceil(ms / 60_000);
  return m >= 60 ? `${Math.ceil(m / 60)}h` : `${m}min`;
}

function _fmtNum(n) { return (n ?? 0).toLocaleString('fr-FR'); }

// ── Entrée principale ─────────────────────────────────────────────
export async function renderGangCompetitionTab() {
  const tab = document.getElementById('tabCompetition');
  if (!tab) return;

  const s    = state();
  const comp = s.gang?.competition;
  const pendingCount = comp?.pendingRaids?.length ?? 0;

  tab.innerHTML = `
    <div style="padding:16px;max-width:900px">
      <div style="font-family:var(--font-pixel);font-size:12px;color:var(--red);margin-bottom:16px">
        ⚔️ COMPÉTITION DE GANGS
        ${pendingCount > 0 ? `<span style="margin-left:12px;background:var(--red);color:#fff;font-size:8px;padding:2px 7px;border-radius:99px;vertical-align:middle">${pendingCount} raid${pendingCount > 1 ? 's' : ''} à voir</span>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div id="comp-defense-panel"></div>
        <div id="comp-stats-panel"></div>
      </div>
      <div id="comp-raids-panel" style="margin-top:16px"></div>
      <div id="comp-gangs-panel" style="margin-top:16px"></div>
    </div>`;

  _renderDefensePanel(tab.querySelector('#comp-defense-panel'));
  _renderStatsPanel(tab.querySelector('#comp-stats-panel'));
  await _renderPendingRaidsPanel(tab.querySelector('#comp-raids-panel'));
  await _renderGangListPanel(tab.querySelector('#comp-gangs-panel'));
}

// ── Panneau setup défense ─────────────────────────────────────────
function _renderDefensePanel(el) {
  if (!el) return;
  const s    = state();
  const comp = s.gang.competition;

  const teamSlots = comp.defenseTeam.map((id, i) => {
    const p = id ? s.pokemons.find(pk => pk.id === id) : null;
    if (p) {
      return `<div class="comp-def-slot" data-slot="${i}" style="
        position:relative;width:52px;height:52px;background:var(--bg);border:2px solid var(--border);
        border-radius:var(--radius-sm);cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center
      " title="${p.species_en} Lv.${p.level}">
        <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:44px;height:44px;image-rendering:pixelated">
        <div style="position:absolute;bottom:0;left:0;right:0;font-size:7px;text-align:center;background:rgba(0,0,0,.55);color:#fff;padding:1px 0">${p.species_en.slice(0,6)}</div>
        <button class="comp-def-remove" data-slot="${i}" style="position:absolute;top:0;right:0;background:var(--red);border:none;color:#fff;font-size:8px;line-height:1;padding:1px 3px;cursor:pointer">✕</button>
      </div>`;
    }
    return `<button class="comp-def-add" data-slot="${i}" style="
      width:52px;height:52px;background:var(--bg);border:2px dashed var(--border);
      border-radius:var(--radius-sm);cursor:pointer;color:var(--text-dim);font-size:18px
    ">+</button>`;
  }).join('');

  const agent = comp.defenseAgent ? s.agents.find(a => a.id === comp.defenseAgent) : null;
  const agentHtml = agent
    ? `<div style="display:flex;align-items:center;gap:8px;padding:6px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm)">
        <img src="https://play.pokemonshowdown.com/sprites/gen5/${agent.spriteKey ?? ''}.png" style="width:32px;height:32px;image-rendering:pixelated" onerror="this.style.display='none'">
        <div style="flex:1;min-width:0">
          <div style="font-size:9px">${agent.name}</div>
          <div style="font-size:8px;color:var(--text-dim)">Lv.${agent.level} · ${agent.title}</div>
        </div>
        <button id="comp-clear-agent" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:13px">✕</button>
      </div>`
    : `<button id="comp-pick-agent" style="width:100%;padding:7px;background:var(--bg);border:2px dashed var(--border);border-radius:var(--radius-sm);cursor:pointer;color:var(--text-dim);font-size:10px">+ Agent défenseur</button>`;

  const zones = globalThis.ZONES ?? [];
  const unlockedZones = zones.filter(z => {
    const zState = state().zones?.[z.id];
    return zState?.unlocked;
  });
  const zoneOptions = unlockedZones.map(z =>
    `<option value="${z.id}" ${comp.defenseZone === z.id ? 'selected' : ''}>${z.name ?? z.id}</option>`
  ).join('');

  el.innerHTML = `
    <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:14px">
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:10px">🛡 MA DÉFENSE</div>

      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">Équipe (6 Pokémon)</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${teamSlots}</div>

      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">Agent défenseur</div>
      <div style="margin-bottom:12px">${agentHtml}</div>

      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">Zone d'arène</div>
      <select id="comp-zone-select" style="width:100%;padding:6px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:9px;margin-bottom:12px">
        <option value="">— Choisir une zone —</option>
        ${zoneOptions}
      </select>

      <button id="comp-publish-btn" style="
        width:100%;padding:9px;background:var(--red);border:none;border-radius:var(--radius-sm);
        color:#fff;font-family:var(--font-pixel);font-size:8px;cursor:pointer;letter-spacing:.04em
      ">${comp.defensePublished ? '🔄 Mettre à jour la défense' : '📡 Publier la défense'}</button>
      ${comp.defensePublished ? `<div style="font-size:8px;color:var(--green);text-align:center;margin-top:5px">✓ Défense en ligne</div>` : ''}
    </div>`;

  // Événements slots
  el.querySelectorAll('.comp-def-add').forEach(btn => {
    btn.addEventListener('click', () => _openPokePicker(parseInt(btn.dataset.slot)));
  });
  el.querySelectorAll('.comp-def-slot').forEach(div => {
    div.addEventListener('click', e => {
      if (!e.target.classList.contains('comp-def-remove'))
        _openPokePicker(parseInt(div.dataset.slot));
    });
  });
  el.querySelectorAll('.comp-def-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      state().gang.competition.defenseTeam[parseInt(btn.dataset.slot)] = null;
      state().gang.competition.defensePublished = false;
      saveState();
      _renderDefensePanel(el);
    });
  });

  el.querySelector('#comp-pick-agent')?.addEventListener('click', () => _openAgentPicker(el));
  el.querySelector('#comp-clear-agent')?.addEventListener('click', () => {
    state().gang.competition.defenseAgent = null;
    state().gang.competition.defensePublished = false;
    saveState();
    _renderDefensePanel(el);
  });

  el.querySelector('#comp-zone-select')?.addEventListener('change', e => {
    state().gang.competition.defenseZone = e.target.value || null;
    state().gang.competition.defensePublished = false;
    saveState();
  });

  el.querySelector('#comp-publish-btn')?.addEventListener('click', async () => {
    const btn = el.querySelector('#comp-publish-btn');
    btn.disabled = true;
    btn.textContent = '…';
    const ok = await publishDefense();
    if (ok) _renderDefensePanel(el);
    else { btn.disabled = false; btn.textContent = '📡 Publier la défense'; }
  });
}

// ── Panneau statistiques ──────────────────────────────────────────
function _renderStatsPanel(el) {
  if (!el) return;
  const s    = state();
  const comp = s.gang.competition;

  const pct  = Math.round(REP_STEAL_RATIO * 100);

  el.innerHTML = `
    <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:14px">
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:10px">📊 STATISTIQUES</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:8px;text-align:center">
          <div style="font-family:var(--font-pixel);font-size:14px;color:var(--green)">${comp.wins?.attack ?? 0}</div>
          <div style="font-size:8px;color:var(--text-dim)">Raids gagnés</div>
        </div>
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:8px;text-align:center">
          <div style="font-family:var(--font-pixel);font-size:14px;color:var(--red)">${comp.losses?.attack ?? 0}</div>
          <div style="font-size:8px;color:var(--text-dim)">Raids perdus</div>
        </div>
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:8px;text-align:center">
          <div style="font-family:var(--font-pixel);font-size:14px;color:var(--blue)">${comp.wins?.defense ?? 0}</div>
          <div style="font-size:8px;color:var(--text-dim)">Défenses tenues</div>
        </div>
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:8px;text-align:center">
          <div style="font-family:var(--font-pixel);font-size:14px;color:var(--gold-dim)">${comp.losses?.defense ?? 0}</div>
          <div style="font-size:8px;color:var(--text-dim)">Défenses perdues</div>
        </div>
      </div>
      <div style="font-size:8px;color:var(--text-dim);line-height:1.8;border-top:1px solid var(--border);padding-top:10px">
        <div>⚔️ <b>1 raid / heure</b> par gang ciblé</div>
        <div>✅ Victoire raid : <b>+${pct}% rép.</b> adversaire + or</div>
        <div>❌ Défaite raid : <b>-${_fmtNum(RAID_PENALTY)} ₽</b></div>
        <div>🛡 Défense réussie : <b>+${_fmtNum(RAID_PENALTY)} ₽</b></div>
        <div>📋 Les malus de rép. s'appliquent à la révision</div>
      </div>
    </div>`;
}

// ── Panneau raids subis ───────────────────────────────────────────
async function _renderPendingRaidsPanel(el) {
  if (!el) return;
  const s    = state();
  const comp = s.gang.competition;

  el.innerHTML = `
    <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:14px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-family:var(--font-pixel);font-size:9px;color:var(--red)">📬 RAIDS SUBIS</span>
        <button id="comp-load-raids" style="margin-left:auto;font-family:var(--font-pixel);font-size:7px;padding:4px 9px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">⟳ Vérifier</button>
      </div>
      <div id="comp-raids-list"></div>
      <button id="comp-ack-raids" style="
        display:none;margin-top:10px;width:100%;padding:8px;background:var(--red);border:none;
        border-radius:var(--radius-sm);color:#fff;font-family:var(--font-pixel);font-size:8px;cursor:pointer
      ">✓ Confirmer et appliquer les résultats</button>
    </div>`;

  const listEl = el.querySelector('#comp-raids-list');
  const ackBtn = el.querySelector('#comp-ack-raids');

  function _renderRaidList(raids) {
    if (!raids.length) {
      listEl.innerHTML = `<div style="color:var(--text-dim);font-size:9px;font-style:italic">Aucun raid en attente.</div>`;
      if (ackBtn) ackBtn.style.display = 'none';
      return;
    }
    listEl.innerHTML = raids.map(r => {
      const won  = r.result === 'defender_win';
      const ts   = new Date(r.executed_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const delta = won
        ? `<span style="color:var(--green)">+${_fmtNum(r.money_penalty)} ₽</span>`
        : `<span style="color:var(--red)">-${r.rep_delta} rép.</span>`;
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:16px">${won ? '🛡' : '💀'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:9px">${won ? 'Défense réussie' : 'Défense échouée'} vs <b>${r.attacker_gang ?? '?'}</b></div>
          <div style="font-size:8px;color:var(--text-dim)">${ts}</div>
        </div>
        <div style="text-align:right;font-family:var(--font-pixel);font-size:9px">${delta}</div>
      </div>`;
    }).join('');
    if (ackBtn) ackBtn.style.display = 'block';
  }

  // Afficher les raids déjà en mémoire locale
  _renderRaidList(comp.pendingRaids ?? []);

  el.querySelector('#comp-load-raids')?.addEventListener('click', async () => {
    const btn = el.querySelector('#comp-load-raids');
    btn.disabled = true;
    btn.textContent = '…';
    const raids = await loadPendingRaids();
    _renderRaidList(raids);
    btn.disabled = false;
    btn.textContent = '⟳ Vérifier';
  });

  ackBtn?.addEventListener('click', async () => {
    ackBtn.disabled = true;
    ackBtn.textContent = '…';
    await acknowledgeRaids();
    _renderRaidList([]);
    ackBtn.style.display = 'none';
    globalThis.updateTopBar?.();
  });
}

// ── Panneau liste des gangs ───────────────────────────────────────
async function _renderGangListPanel(el) {
  if (!el) return;
  el.innerHTML = `
    <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:14px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">⚔️ GANGS ADVERSES</span>
        <button id="comp-refresh-gangs" style="margin-left:auto;font-family:var(--font-pixel);font-size:7px;padding:4px 9px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">⟳</button>
      </div>
      <div id="comp-gang-list"><div style="color:var(--text-dim);font-size:9px">Chargement…</div></div>
    </div>`;

  el.querySelector('#comp-refresh-gangs')?.addEventListener('click', () => _loadAndRenderGangs(el));
  await _loadAndRenderGangs(el);
}

async function _loadAndRenderGangs(panelEl) {
  const listEl = panelEl?.querySelector('#comp-gang-list');
  if (!listEl) return;

  listEl.innerHTML = `<div style="color:var(--text-dim);font-size:9px">Chargement…</div>`;
  const gangs = await loadGangList();

  if (!gangs.length) {
    listEl.innerHTML = `<div style="color:var(--text-dim);font-size:9px;font-style:italic">Aucun gang publié pour l'instant.</div>`;
    return;
  }

  const s = state();
  const comp = s.gang.competition;

  listEl.innerHTML = gangs.map(g => {
    const cooldownMs  = getRaidCooldownMs(g.user_id);
    const onCooldown  = cooldownMs > 0;
    const hasPending  = (comp.pendingRaids?.length ?? 0) > 0;
    const canAttack   = !onCooldown && !hasPending;

    const miniPokemons = (g.defense_pokemon ?? []).filter(Boolean).slice(0, 6).map(p =>
      `<img src="${pokeSprite(p.species_en, p.shiny)}" style="width:24px;height:24px;image-rendering:pixelated" title="${p.species_en} Lv.${p.level}">`
    ).join('');

    const agentInfo = g.defense_agent
      ? `<span style="font-size:8px;color:var(--text-dim)">🧑‍✈️ ${g.defense_agent.name} Lv.${g.defense_agent.level}</span>`
      : '';

    const zoneInfo = g.defense_zone
      ? `<span style="font-size:8px;color:var(--text-dim)">🗺 ${g.defense_zone}</span>`
      : '';

    let btnHtml;
    if (hasPending) {
      btnHtml = `<button disabled style="padding:6px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);font-size:8px;cursor:not-allowed">Raids en attente</button>`;
    } else if (onCooldown) {
      btnHtml = `<button disabled style="padding:6px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);font-size:8px;cursor:not-allowed">⏱ ${_fmtMs(cooldownMs)}</button>`;
    } else {
      btnHtml = `<button class="comp-raid-btn" data-uid="${g.user_id}" style="padding:6px 12px;background:var(--red);border:none;border-radius:var(--radius-sm);color:#fff;font-family:var(--font-pixel);font-size:8px;cursor:pointer">⚔️ Raider</button>`;
    }

    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
      ${g.boss_sprite
        ? `<img src="https://play.pokemonshowdown.com/sprites/gen5/${g.boss_sprite}.png" style="width:40px;height:40px;image-rendering:pixelated;flex-shrink:0" onerror="this.style.display='none'">`
        : `<div style="width:40px;height:40px;background:var(--bg);border-radius:4px;flex-shrink:0"></div>`}
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--font-pixel);font-size:9px;margin-bottom:2px">${g.gang_name}</div>
        <div style="font-size:8px;color:var(--text-dim);margin-bottom:4px">${g.boss_name} · ⭐ ${_fmtNum(g.reputation_snapshot)} rép.</div>
        <div style="display:flex;gap:2px;flex-wrap:wrap;align-items:center;margin-bottom:3px">${miniPokemons}</div>
        <div style="display:flex;gap:8px;">${agentInfo}${zoneInfo}</div>
      </div>
      <div style="flex-shrink:0">${btnHtml}</div>
    </div>`;
  }).join('');

  listEl.querySelectorAll('.comp-raid-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetUid = btn.dataset.uid;
      const defData   = gangs.find(g => g.user_id === targetUid);
      if (!defData) return;
      btn.disabled    = true;
      btn.textContent = '…';
      const result = await executeRaid(defData);
      if (result) {
        globalThis.updateTopBar?.();
        await _loadAndRenderGangs(panelEl);
      } else {
        btn.disabled    = false;
        btn.textContent = '⚔️ Raider';
      }
    });
  });
}

// ── Picker Pokémon pour slot défense ─────────────────────────────
function _openPokePicker(slotIndex) {
  const existing = document.getElementById('comp-poke-picker-modal');
  if (existing) existing.remove();

  const s = state();
  const used = new Set(s.gang.competition.defenseTeam.filter(Boolean));

  const sorted = [...s.pokemons]
    .sort((a, b) => {
      const pa = (a.stats?.atk ?? 0) + (a.stats?.def ?? 0) + (a.stats?.spd ?? 0);
      const pb = (b.stats?.atk ?? 0) + (b.stats?.def ?? 0) + (b.stats?.spd ?? 0);
      return pb - pa;
    });

  const rows = sorted.map(p => {
    const power = (p.stats?.atk ?? 0) + (p.stats?.def ?? 0) + (p.stats?.spd ?? 0);
    const isUsed = used.has(p.id);
    return `<div class="comp-pp-row" data-id="${p.id}" style="
      display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;
      background:${isUsed ? 'rgba(255,0,0,.08)' : ''};
      border-bottom:1px solid var(--border);
      opacity:${isUsed ? '.5' : '1'};
    ">
      <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:32px;height:32px;image-rendering:pixelated">
      <div style="flex:1;min-width:0">
        <div style="font-size:9px">${p.species_en}${p.shiny ? ' ✨' : ''}</div>
        <div style="font-size:8px;color:var(--text-dim)">Lv.${p.level} · ${p.potential ?? 1}⭐ · ⚡${power}</div>
      </div>
      ${isUsed ? '<span style="font-size:8px;color:var(--red)">Déjà assigné</span>' : ''}
    </div>`;
  }).join('');

  const modal = document.createElement('div');
  modal.id = 'comp-poke-picker-modal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:5000;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,.6)`;
  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);width:360px;max-height:70vh;display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;padding:12px 14px;border-bottom:1px solid var(--border)">
        <span style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">Slot ${slotIndex + 1} — Choisir un Pokémon</span>
        <button id="comp-pp-close" style="margin-left:auto;background:none;border:none;color:var(--text-dim);font-size:16px;cursor:pointer">✕</button>
      </div>
      <div style="overflow-y:auto;flex:1">${rows}</div>
    </div>`;

  document.body.appendChild(modal);

  modal.querySelector('#comp-pp-close')?.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelectorAll('.comp-pp-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.dataset.id;
      state().gang.competition.defenseTeam[slotIndex] = id;
      state().gang.competition.defensePublished = false;
      saveState();
      modal.remove();
      const defPanel = document.querySelector('#comp-defense-panel');
      if (defPanel) _renderDefensePanel(defPanel);
    });
  });
}

// ── Picker Agent pour défense ─────────────────────────────────────
function _openAgentPicker(defPanelEl) {
  const existing = document.getElementById('comp-agent-picker-modal');
  if (existing) existing.remove();

  const s      = state();
  const agents = s.agents ?? [];

  if (!agents.length) { notify('Aucun agent recruté.', 'error'); return; }

  const rows = agents.map(a => {
    return `<div class="comp-ap-row" data-id="${a.id}" style="
      display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--border)
    ">
      <img src="https://play.pokemonshowdown.com/sprites/gen5/${a.spriteKey ?? ''}.png" style="width:32px;height:32px;image-rendering:pixelated" onerror="this.style.display='none'">
      <div style="flex:1;min-width:0">
        <div style="font-size:9px">${a.name}</div>
        <div style="font-size:8px;color:var(--text-dim)">Lv.${a.level} · ${a.title} · Combat ${a.stats?.combat ?? 0}</div>
      </div>
    </div>`;
  }).join('');

  const modal = document.createElement('div');
  modal.id = 'comp-agent-picker-modal';
  modal.style.cssText = `position:fixed;inset:0;z-index:5000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6)`;
  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);width:320px;max-height:60vh;display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;padding:12px 14px;border-bottom:1px solid var(--border)">
        <span style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">Choisir un agent défenseur</span>
        <button id="comp-ap-close" style="margin-left:auto;background:none;border:none;color:var(--text-dim);font-size:16px;cursor:pointer">✕</button>
      </div>
      <div style="overflow-y:auto;flex:1">${rows}</div>
    </div>`;

  document.body.appendChild(modal);

  modal.querySelector('#comp-ap-close')?.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelectorAll('.comp-ap-row').forEach(row => {
    row.addEventListener('click', () => {
      state().gang.competition.defenseAgent = row.dataset.id;
      state().gang.competition.defensePublished = false;
      saveState();
      modal.remove();
      if (defPanelEl) _renderDefensePanel(defPanelEl);
    });
  });
}
