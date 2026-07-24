'use strict';

import { BALL_SPRITES, FALLBACK_TRAINER_SVG } from '../../data/assets-data.js';
import { EventBus, EVENTS } from '../core/eventBus.js';

// HTML escape — sécurise les strings user-input avant injection via innerHTML
const _esc = s => String(s ?? '').replace(/[&<>"']/g, ch => (
  ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;'));

// 18b. UI — AGENTS TAB
// ════════════════════════════════════════════════════════════════

// Skins de ball disponibles pour les agents — pokeball toujours disponible, les autres selon purchases
const ALL_BALL_SKINS = ['pokeball','greatball','duskball','ultraball','masterball'];
const AGENT_BALL_LABELS = { pokeball:'Poké Ball', greatball:'Super Ball', ultraball:'Hyper Ball', duskball:'Sombre Ball', masterball:'Master Ball' };
function getUnlockedBallSkins() {
  const s = globalThis.state;
  return ALL_BALL_SKINS.filter(b => b === 'pokeball' || !!(s?.purchases?.[`skin_${b}`]));
}
// Behavior flag config (used for global "tout" buttons)
const BEHAVIOR_FLAGS = [
  { key:'autoCombat',  icon:'⚔️',  label:'Combat'  },
  { key:'autoRaid',    icon:'💣',  label:'Raid'    },
  { key:'autoCapture', icon:'🎯', label:'Capture' },
];

// ── Render guard — même pattern que gangTab.js ────────────────────
// Debounce 80 ms pour regrouper les appels rapides successifs, et report du
// rebuild si l'utilisateur est en train d'interagir avec un champ du tab
// (le <select> d'assignation de zone serait reset en pleine ouverture sinon).
// Les checkboxes sont exclues de la garde : pas d'état "en cours de saisie".
let _agentsTabTimer         = null;
let _agentsTabPendingRender = false;
let _agentsFocusOutWired    = false;

function _ensureAgentsFocusOutHandler(grid) {
  if (_agentsFocusOutWired) return;
  _agentsFocusOutWired = true;
  grid.addEventListener('focusout', function onFocusOut(e) {
    if (grid.contains(e.relatedTarget)) return;
    _agentsFocusOutWired = false;
    grid.removeEventListener('focusout', onFocusOut);
    if (_agentsTabPendingRender) { _agentsTabPendingRender = false; renderAgentsTab(); }
  });
}

function renderAgentsTab() {
  if (_agentsTabTimer) { clearTimeout(_agentsTabTimer); _agentsTabTimer = null; }
  _agentsTabTimer = setTimeout(() => {
    _agentsTabTimer = null;
    const grid = document.getElementById('agentsGrid');
    if (!grid) return;
    const focused = document.activeElement;
    const isBlockingField = focused && grid.contains(focused)
      && ['INPUT', 'SELECT', 'TEXTAREA'].includes(focused.tagName)
      && focused.type !== 'checkbox';
    if (isBlockingField) {
      _agentsTabPendingRender = true;
      _ensureAgentsFocusOutHandler(grid);
      return;
    }
    _doRenderAgentsTab();
  }, 80);
}

// ── Fragment énergie/repos d'une carte agent ──────────────────────
// Partagé entre le rebuild complet et le patch ciblé (_patchAgentsTabDynamic).
function _agentEnergyRowHtml(a, agentTeamSlots) {
  if (a.resting) {
    const cost = globalThis.getAgentBailCost?.(a) ?? 0;
    return `<span style="font-family:var(--font-pixel);font-size:7px;color:var(--red)">🔒 PRISON ${Math.max(0, Math.round(((a.restUntil || 0) - Date.now()) / 60000))}min</span>
      <button data-bail-agent="${a.id}" style="font-size:7px;padding:2px 6px;background:var(--bg-card);border:1px solid var(--gold-dim,#665522);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer;margin-left:4px">🔓 Payer ${cost.toLocaleString()}₽</button>`;
  }
  return `<div style="flex:1;height:3px;background:var(--border);border-radius:2px;overflow:hidden">
         <div style="width:${Math.round((a.energy ?? 10) / (a.maxEnergy || 10) * 100)}%;height:100%;background:${(a.energy ?? 10) <= 3 ? 'var(--red)' : 'var(--green)'};border-radius:2px"></div>
       </div>
       <span style="font-size:8px;color:var(--text-dim)">${a.energy ?? 10}⚡</span>
       <span style="font-size:8px;color:var(--text-dim);margin-left:4px">${agentTeamSlots} slot${agentTeamSlots > 1 ? 's' : ''}</span>`;
}

function _doRenderAgentsTab() {
  const grid = document.getElementById('agentsGrid');
  if (!grid) return;

  const unlockedZones = ZONES.filter(z => isZoneUnlocked(z.id));
  const RECRUIT_COST  = getAgentRecruitCost();

  // ── Boss card ────────────────────────────────────────────────────
  const bossRep   = state.gang.reputation || 0;
  const bossTitle = typeof getBossFullTitle === 'function' ? getBossFullTitle() : '';

  let html = `
    <div class="agent-card-full" style="border-color:var(--gold)" id="playerStatCard">
      <div class="agent-header">
        ${state.gang.bossSprite ? `<img src="${trainerSprite(state.gang.bossSprite)}" alt="Boss" style="width:44px;height:44px;image-rendering:pixelated">` : '<div style="width:44px;height:44px;background:var(--bg-card);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:20px">👤</div>'}
        <div class="agent-meta">
          <div class="agent-name" style="color:var(--gold)">${_esc(state.gang.bossName || 'Boss')}</div>
          <div class="agent-title" style="color:var(--gold)">${bossTitle || 'Chef de gang'}</div>
          <div id="agentBossCounters" style="font-size:8px;color:var(--text-dim)">
            ${state.pokemons.length} Pokémon · ${state.agents.filter(a => !a.legacyLocked).length} agents actifs · REP ${bossRep}
          </div>
        </div>
      </div>
    </div>`;

  // ── Global ball setters ─────────────────────────────────────────
  const availBalls = getUnlockedBallSkins();
  html += `<div id="agentGlobalControls" style="grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);margin-bottom:4px">
    <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">TOUT :</span>
    ${availBalls.map(b => `<button data-setallball="${b}" title="Définir ${AGENT_BALL_LABELS[b]} pour tous" style="display:flex;align-items:center;gap:3px;padding:3px 7px;font-size:8px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;color:var(--text)">
      <img src="${BALL_SPRITES[b] || ''}" style="width:14px;height:14px;image-rendering:pixelated"> ${AGENT_BALL_LABELS[b]}
    </button>`).join('')}
    <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);margin-left:8px">AUTO :</span>
    ${BEHAVIOR_FLAGS.map(f => `<button data-setallflag="${f.key}" data-val="true" title="${f.label} ON pour tous" style="padding:3px 7px;font-size:8px;background:var(--bg-card);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);cursor:pointer;color:var(--gold)">${f.icon} ${f.label} ON</button><button data-setallflag="${f.key}" data-val="false" title="${f.label} OFF pour tous" style="padding:3px 7px;font-size:8px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;color:var(--text-dim)">${f.icon} OFF</button>`).join('')}
  </div>`;

  // ── Agent cards ─────────────────────────────────────────────────
  for (let agIdx = 0; agIdx < state.agents.length; agIdx++) {
    const a = state.agents[agIdx];
    const xpNeeded = a.level * 30;
    const xpPct    = Math.min(100, (a.xp / xpNeeded) * 100);
    const zoneOptions = unlockedZones.map(z =>
      `<option value="${z.id}" ${a.assignedZone === z.id ? 'selected' : ''}>${state.lang === 'fr' ? z.fr : z.en}</option>`
    ).join('');

    const agentTeamSlots = getAgentTeamSlots(a); // rank-based slots: grunt=1, sergent=2, lieutenant+=3
    const teamSlots = Array.from({length: agentTeamSlots}, (_, i) => {
      const pkId = a.team[i];
      const pk   = pkId ? state.pokemons.find(p => p.id === pkId) : null;
      if (pk) return `<div class="agent-team-slot filled" data-agent-team="${a.id}" data-slot="${i}" title="${speciesName(pk.species_en)} Lv.${pk.level}"><img src="${pokeIcon(pk.species_en)}" style="${pk.shiny ? 'filter:drop-shadow(0 0 2px var(--gold))' : ''}" onerror="this.src='${pokeSprite(pk.species_en, pk.shiny)}'"></div>`;
      return `<div class="agent-team-slot" data-agent-team="${a.id}" data-slot="${i}">+</div>`;
    }).join('');

    // Ball skin selector (cosmétique uniquement — pokeball = ressource unique de capture)
    const curBall   = a.ball || 'pokeball';
    const curBallSp = BALL_SPRITES[curBall] || '';
    const unlockedSkins = getUnlockedBallSkins();
    const ballBtns  = unlockedSkins.map(b => {
      const active = b === curBall;
      return `<button data-agent-ball="${a.id}" data-ball="${b}" title="${AGENT_BALL_LABELS[b]}" style="padding:2px 4px;border:1px solid ${active ? 'var(--gold)' : 'var(--border)'};background:${active ? 'rgba(255,204,90,.15)' : 'var(--bg)'};border-radius:3px;cursor:pointer">
        <img src="${BALL_SPRITES[b] || ''}" style="width:16px;height:16px;image-rendering:pixelated">
      </button>`;
    }).join('');

    // Behavior toggles (3 independent flags)
    const _bhBtn = (flag, icon, label) => {
      const on = a[flag] !== false;
      const activeStyle = on ? 'border:1px solid var(--gold);background:rgba(255,204,90,.15);color:var(--gold)' : 'border:1px solid var(--border);background:var(--bg);color:var(--text-dim)';
      return `<button data-ag-flag="${a.id}" data-flag="${flag}" style="padding:2px 7px;font-size:8px;border-radius:3px;cursor:pointer;${activeStyle}">${icon} ${label}${on ? '' : ' ✗'}</button>`;
    };
    const bhBtns = _bhBtn('autoCombat','⚔️','Combat') + _bhBtn('autoRaid','💣','Raid') + _bhBtn('autoCapture','🎯','Capture');

    // ── Carte verrouillée (agents au-delà du 10e slot) ──────────────
    if (a.legacyLocked) {
      const unlockCost = globalThis.getAgentUnlockCost?.(agIdx) ?? 0;
      html += `<div class="agent-card-full" data-agent-id="${a.id}"
        style="opacity:.55;position:relative;border-color:var(--border);overflow:hidden">
        <div style="position:absolute;inset:0;background:rgba(0,0,0,.45);z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:12px">
          <div style="font-size:28px">🔒</div>
          <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);text-align:center">
            De nos jours, le management coûte cher…
          </div>
          <button class="agent-unlock-btn" data-agent-id="${a.id}"
            style="font-family:var(--font-pixel);font-size:8px;padding:7px 14px;
                   background:rgba(255,204,90,.1);border:1px solid var(--gold-dim);
                   border-radius:var(--radius-sm);color:var(--gold);cursor:pointer;z-index:2">
            Débloquer — ${unlockCost.toLocaleString()}₽
          </button>
        </div>
        <div class="agent-header" style="filter:blur(2px)">
          <img src="${a.sprite}" alt="${a.name}" onerror="this.src='${FALLBACK_TRAINER_SVG}';this.onerror=null">
          <div class="agent-meta">
            <div style="font-family:var(--font-pixel);font-size:9px">${a.name}</div>
            <div style="font-size:8px;color:var(--text-dim)">Lv.${a.level} · ${getAgentRankLabel(a)}</div>
          </div>
        </div>
      </div>`;
      continue;
    }

    const cosmUnlockedAgent = state.purchases?.cosmeticsPanel;
    html += `<div class="agent-card-full" data-agent-id="${a.id}" data-rank="${a.title || 'grunt'}">
      <div class="agent-header">
        <img src="${a.sprite}" alt="${a.name}" onerror="this.src='${FALLBACK_TRAINER_SVG}';this.onerror=null"
          style="cursor:pointer" class="agent-sprite-open-sheet" data-agent-id="${a.id}" title="Voir la fiche">
        <div class="agent-meta">
          <div class="agent-title agent-rank-${a.title}" style="display:flex;align-items:baseline;gap:5px;flex-wrap:nowrap;overflow:hidden">
            <span style="font-size:7px;opacity:.75;flex-shrink:0">[${getAgentRankLabel(a)}]</span>
            <span style="font-family:var(--font-pixel);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.name}</span>
            <span class="agent-lv" style="font-size:8px;opacity:.7;flex-shrink:0">Lv.${a.level}</span>
          </div>
          <div class="agent-xp-bar"><div class="agent-xp-fill" style="width:${xpPct}%"></div></div>
          <div class="agent-energy-row" style="display:flex;align-items:center;gap:4px;margin-top:2px">
            ${_agentEnergyRowHtml(a, agentTeamSlots)}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;margin-left:auto;padding-left:6px">
          <button class="agent-open-sheet" data-agent-id="${a.id}" title="Fiche détaillée"
            style="font-size:10px;padding:2px 6px;background:var(--bg);border:1px solid var(--red);border-radius:3px;cursor:pointer;color:var(--red)">📋</button>
          ${cosmUnlockedAgent ? `
          <button class="agent-card-rename" data-agent-id="${a.id}" title="Renommer (2 000₽)" style="font-size:10px;padding:2px 5px;background:var(--bg);border:1px solid var(--border);border-radius:3px;cursor:pointer;color:var(--text-dim)">✏</button>
          <button class="agent-card-sprite" data-agent-id="${a.id}" title="Changer sprite (5 000₽)" style="font-size:10px;padding:2px 5px;background:var(--bg);border:1px solid var(--border);border-radius:3px;cursor:pointer;color:var(--text-dim)">🎨</button>` : ''}
        </div>
      </div>

      <!-- Ball selector -->
      <div style="display:flex;align-items:center;gap:4px;margin:4px 0;flex-wrap:wrap">
        <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">BALL :</span>
        ${ballBtns}
      </div>

      <!-- Comportements auto -->
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:6px;flex-wrap:wrap">
        <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">AUTO :</span>
        ${bhBtns}
      </div>

      <div style="font-size:9px">
        <select class="agents-zone-select" data-agent-id="${a.id}" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:4px;font-size:9px;padding:2px 4px;width:100%">
          <option value="">— Aucune zone —</option>
          ${zoneOptions}
        </select>
      </div>
      <div class="agent-team-slots">${teamSlots}</div>
      <div class="agent-personality">${a.personality.join(', ')}</div>

      <label class="agent-notify-toggle">
        <input type="checkbox" class="agent-notify-cb" data-agent-id="${a.id}" ${a.notifyCaptures !== false ? 'checked' : ''}>
        ${a.notifyCaptures !== false ? '🔔' : '🔕'} Notifications
      </label>
    </div>`;
  }

  // Recruit button
  html += `<div class="agent-card-full" id="btnRecruitAgentFull"
    style="display:flex;align-items:center;justify-content:center;cursor:pointer;min-height:120px;
           border:2px dashed var(--border)">
    <div style="text-align:center">
      <div style="font-size:22px;margin-bottom:6px">+</div>
      <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim)">
        RECRUTER UN AGENT
      </div>
      <div style="font-size:9px;color:var(--gold);margin-top:3px">
        Agent ${state.agents.length + 1} — ${RECRUIT_COST.toLocaleString()}₽
      </div>
    </div>
  </div>`;

  grid.innerHTML = html;

  // Agent tree toggle (once, guarded — le bouton vit hors du grid, il survit aux rebuilds :
  // sans garde, chaque render empilait un listener de plus et un clic togglait N fois)
  const treeBtn = document.getElementById('btnToggleAgentTree');
  const treeCon = document.getElementById('agentTreeContainer');
  if (treeBtn && treeCon && !treeBtn.dataset.wired) {
    treeBtn.dataset.wired = '1';
    treeBtn.addEventListener('click', () => {
      const open = treeCon.style.display === 'none';
      treeCon.style.display = open ? 'block' : 'none';
      treeBtn.textContent  = open ? '🌳 Masquer l\'arbre' : '🌳 Afficher l\'arbre';
      if (open) renderAgentTree(treeCon);
    });
  }

  // Wire unequip-all button (once, guarded)
  const unequipBtn = document.getElementById('btnUnequipAll');
  if (unequipBtn && !unequipBtn.dataset.wired) {
    unequipBtn.dataset.wired = '1';
    unequipBtn.addEventListener('click', () => {
      for (const a of state.agents) a.team = [];
      saveState();
      renderAgentsTab();
      notify(state.lang === 'fr' ? 'Toutes les équipes vidées' : 'All teams cleared', 'success');
    });
  }

  // Bind events
  // Recruit
  document.getElementById('btnRecruitAgentFull')?.addEventListener('click', () => {
    openAgentRecruitModal(() => renderAgentsTab());
  });

  // Agent sheet (📋 button + sprite click)
  grid.querySelectorAll('.agent-open-sheet, .agent-sprite-open-sheet').forEach(btn => {
    btn.addEventListener('click', () => {
      openAgentSheet(btn.dataset.agentId, () => renderAgentsTab());
    });
  });

  // Zone assignment
  grid.querySelectorAll('.agents-zone-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      assignAgentToZone(e.target.dataset.agentId, e.target.value || null);
      if (activeTab === 'tabZones') renderZoneWindows();
    });
  });

  // Team slot clicks
  grid.querySelectorAll('[data-agent-team]').forEach(slot => {
    slot.addEventListener('click', () => {
      const agentId = slot.dataset.agentTeam;
      const slotIdx = parseInt(slot.dataset.slot);
      const agent = state.agents.find(a => a.id === agentId);
      if (!agent) return;
      const pkId = agent.team[slotIdx];
      if (pkId) {
        // Remove from team
        agent.team.splice(slotIdx, 1);
        saveState();
        renderAgentsTab();
      } else {
        // Show picker
        openTeamPicker('agent', agentId, () => renderAgentsTab());
      }
    });
  });

  // Notification toggle
  grid.querySelectorAll('.agent-notify-cb').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const agent = state.agents.find(a => a.id === e.target.dataset.agentId);
      if (agent) {
        agent.notifyCaptures = e.target.checked;
        saveState();
        renderAgentsTab();
      }
    });
  });

  // Ball selector per agent
  grid.querySelectorAll('[data-agent-ball]').forEach(btn => {
    btn.addEventListener('click', () => {
      const agent = state.agents.find(a => a.id === btn.dataset.agentBall);
      if (!agent) return;
      agent.ball = btn.dataset.ball;
      saveState();
      renderAgentsTab();
    });
  });

  // Behavior flag toggles per agent
  grid.querySelectorAll('[data-ag-flag]').forEach(btn => {
    btn.addEventListener('click', () => {
      const agent = state.agents.find(a => a.id === btn.dataset.agFlag);
      if (!agent) return;
      const flag = btn.dataset.flag;
      agent[flag] = agent[flag] === false ? true : false; // toggle
      saveState();
      renderAgentsTab();
    });
  });

  // Global ball setters
  grid.querySelectorAll('[data-setallball]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ball = btn.dataset.setallball;
      state.agents.forEach(a => { a.ball = ball; });
      saveState();
      renderAgentsTab();
      notify(`Tous les agents → ${AGENT_BALL_LABELS[ball]}`, 'success');
    });
  });

  // Global behavior flag setters
  grid.querySelectorAll('[data-setallflag]').forEach(btn => {
    btn.addEventListener('click', () => {
      const flag = btn.dataset.setallflag;
      const val  = btn.dataset.val === 'true';
      state.agents.forEach(a => { a[flag] = val; });
      saveState();
      renderAgentsTab();
      const cfg = BEHAVIOR_FLAGS.find(f => f.key === flag);
      notify(`Tous les agents → ${cfg?.label || flag} ${val ? 'ON' : 'OFF'}`, val ? 'success' : '');
    });
  });

  // Unlock button for legacy-locked agents
  grid.querySelectorAll('.agent-unlock-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      globalThis.unlockAgent?.(btn.dataset.agentId);
    });
  });

  // Right-click context menu on agent cards
  grid.querySelectorAll('.agent-card-full[data-agent-id]').forEach(card => {
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const aId = card.dataset.agentId;
      const agent = state.agents.find(a => a.id === aId);
      if (!agent) return;
      const unlockedZones = ZONES.filter(z => isZoneUnlocked(z.id));
      const zoneItems = unlockedZones.slice(0, 8).map(z => ({
        action: 'zone_' + z.id,
        label: (state.lang === 'fr' ? z.fr : z.en),
        fn: () => {
          if (!assignAgentToZone(agent.id, z.id)) return;
          renderAgentsTab();
          notify(agent.name + ' -> ' + (state.lang === 'fr' ? z.fr : z.en), 'success');
        }
      }));
      showContextMenu(e.clientX, e.clientY, [
        { action:'clearteam', label:'Vider l\'equipe', fn: () => { agent.team = []; saveState(); renderAgentsTab(); } },
        { action:'autoteam', label:`Auto-equipe (top ${getAgentTeamSlots(agent)})`, fn: () => {
          const usedIds = new Set();
          state.agents.forEach(a => { if (a.id !== agent.id) a.team.forEach(id => usedIds.add(id)); });
          state.gang.bossTeam.forEach(id => usedIds.add(id));
          const avail = state.pokemons.filter(p => !usedIds.has(p.id)).sort((a,b) => getPokemonPower(b) - getPokemonPower(a));
          agent.team = avail.slice(0, getAgentTeamSlots(agent)).map(p => p.id);
          saveState(); renderAgentsTab(); notify('Equipe auto assignee', 'success');
        }},
        ...zoneItems.length ? [{ action:'envoyer', label:'Envoyer en zone', fn: () => {} }, ...zoneItems] : [],
        { action:'unassign', label:'Retirer de la zone', fn: () => { assignAgentToZone(agent.id, null); renderAgentsTab(); } },
      ]);
    });
  });

  // Rename / sprite buttons (cosmétiques dans agents tab)
  grid.querySelectorAll('.agent-card-rename').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.gang.money < 2000) { notify('Fonds insuffisants (2 000₽)', 'error'); return; }
      const agent = state.agents.find(a => a.id === btn.dataset.agentId);
      if (!agent) return;
      openNameModal({ title: `Renommer ${agent.name}`, current: agent.name, cost: 2000, onConfirm: (val) => {
        state.gang.money -= 2000;
        EventBus.emit(EVENTS.MONEY_CHANGED, { delta: -2000, newTotal: state.gang.money });
        agent.name = val;
        saveState(); renderAgentsTab();
        notify(`Agent renommé : ${val}`, 'gold');
      }});
    });
  });
  grid.querySelectorAll('.agent-card-sprite').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.gang.money < 5000) { notify('Fonds insuffisants (5 000₽)', 'error'); return; }
      const agent = state.agents.find(a => a.id === btn.dataset.agentId);
      if (!agent) return;
      openSpritePicker(null, (newSprite) => {
        state.gang.money -= 5000;
        EventBus.emit(EVENTS.MONEY_CHANGED, { delta: -5000, newTotal: state.gang.money });
        agent.sprite = trainerSprite(newSprite);
        saveState(); renderAgentsTab();
        notify(`Sprite de ${agent.name} mis à jour !`, 'gold');
      });
    });
  });

}

// ── Agent org-chart (proto — visual only, no mechanical assignment yet) ──
// Ranks: grunt → sergent → lieutenant → commandant → elite/général
// Capacity per rank (how many direct reports they can have):
const RANK_CAPACITY = { grunt: 0, sergent: 2, lieutenant: 3, commandant: 4, elite: 5, general: 6 };
// Rank level (higher = more senior)
const RANK_LEVEL = { grunt: 0, sergent: 1, lieutenant: 2, commandant: 3, elite: 4, general: 5 };

function renderAgentTree(container) {
  // Alignées sur .agent-rank-* (css/game-ui.css) pour que l'arbre et les
  // cartes agent normales n'aient jamais de couleurs divergentes.
  const RANK_COLOR = {
    grunt:      'var(--text-dim)',
    sergent:    '#7eb8f7',
    lieutenant: '#6ecf8a',
    commandant: '#f0a842',
    elite:      'var(--gold)',
    general:    '#e05c5c',
  };

  // Sort agents by rank level desc
  const sorted = [...state.agents].sort((a, b) => (RANK_LEVEL[b.title] ?? 0) - (RANK_LEVEL[a.title] ?? 0));

  // Group by rank
  const byRank = {};
  for (const a of sorted) {
    (byRank[a.title] = byRank[a.title] || []).push(a);
  }

  // Build rank tiers, du plus haut au plus bas
  const rankOrder = ['general','elite','commandant','lieutenant','sergent','grunt'];
  const usedRanks = rankOrder.filter(r => byRank[r]?.length);

  const prisonBadge = (a) => a.resting
    ? `<div style="font-size:7px;color:var(--red);margin-top:2px;font-family:var(--font-pixel)">🔒 ${Math.max(0, Math.round(((a.restUntil || 0) - Date.now()) / 60000))}min</div>`
    : '';

  const agentNode = (a) => {
    const cap  = RANK_CAPACITY[a.title] || 0;
    const col  = RANK_COLOR[a.title]   || 'var(--text-dim)';
    const zone = a.assignedZone ? (ZONE_BY_ID[a.assignedZone]?.fr || a.assignedZone) : '—';
    return `<div class="agent-tree-node" style="border-color:${col};background:var(--bg-panel)">
      <img src="${a.sprite}" style="width:32px;height:32px;image-rendering:pixelated" onerror="this.style.display='none'">
      <div>
        <div style="font-family:var(--font-pixel);font-size:7px;color:${col}">${_esc(getAgentRankLabel(a))}</div>
        <div style="font-size:9px;margin-top:1px">${_esc(a.name)}</div>
        <div style="font-size:8px;color:var(--text-dim);margin-top:1px">Lv.${a.level} · ${_esc(zone)}</div>
        ${cap > 0 ? `<div style="font-size:7px;color:var(--text-dim);margin-top:2px;font-family:var(--font-pixel)">⬇ ${cap} max</div>` : ''}
        ${prisonBadge(a)}
      </div>
    </div>`;
  };

  const bossNode = `<div class="agent-tree-node" style="border-color:var(--gold);background:rgba(255,204,90,.06)">
    ${state.gang.bossSprite ? `<img src="${trainerSprite(state.gang.bossSprite)}" style="width:36px;height:36px;image-rendering:pixelated">` : '<span style="font-size:26px">👤</span>'}
    <div>
      <div style="font-family:var(--font-pixel);font-size:7px;color:var(--gold)">BOSS</div>
      <div style="font-size:9px;margin-top:1px">${_esc(state.gang.bossName || 'Boss')}</div>
      <div style="font-size:8px;color:var(--text-dim);margin-top:1px">${getBossFullTitle()}</div>
    </div>
  </div>`;

  const tiers = [
    { label: 'Boss', color: 'var(--gold)', nodes: [bossNode] },
    ...usedRanks.map(r => ({
      label: getAgentRankLabel({ title: r }) + (byRank[r].length > 1 ? ` ×${byRank[r].length}` : ''),
      color: RANK_COLOR[r],
      nodes: byRank[r].map(agentNode),
    })),
  ];

  if (!state.agents.length) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-dim);font-size:10px;font-family:var(--font-pixel)">Recrutez des agents pour construire votre organisation.</div>`;
    return;
  }

  // Empilement vertical par palier (du plus haut grade au plus bas), façon
  // organigramme — se lit de haut en bas sans défilement latéral, contrairement
  // à l'ancienne disposition en colonnes.
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:100%">
      ${tiers.map((tier, ti) => `
        ${ti > 0 ? '<div class="agent-tree-divider">▾</div>' : ''}
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:100%">
          <div style="font-family:var(--font-pixel);font-size:7px;color:${tier.color};padding:2px 10px;border:1px solid ${tier.color};border-radius:99px;white-space:nowrap">${tier.label}</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;width:100%">
            ${tier.nodes.join('')}
          </div>
        </div>
      `).join('')}
    </div>
    <div style="margin-top:12px;font-size:8px;color:var(--text-dim);font-family:var(--font-pixel);opacity:.6;text-align:center">
      Vue organisationnelle — l'assignation hiérarchique n'est pas encore mécanique.
    </div>`;
}

// ── Patch ciblé des valeurs dynamiques ────────────────────────────
// Pendant l'activité background (agents qui combattent/capturent), seuls
// niveau, XP, énergie et compteurs bougent — on met à jour ces nœuds en place
// au lieu de reconstruire toute la grille (cartes complexes × nombre d'agents,
// le coût exact qui explose en late-game). Le rebuild complet reste réservé
// aux changements structurels : promotion (le rang change les slots d'équipe),
// recrutement/déblocage (le nombre de cartes change).
function _patchAgentsTabDynamic() {
  if (globalThis.activeTab !== 'tabAgents') return;
  const grid = document.getElementById('agentsGrid');
  if (!grid) return;
  const state = globalThis.state;

  const counters = grid.querySelector('#agentBossCounters');
  if (counters) {
    counters.textContent =
      `${state.pokemons.length} Pokémon · ${state.agents.filter(a => !a.legacyLocked).length} agents actifs · REP ${state.gang.reputation || 0}`;
  }

  for (const a of state.agents) {
    if (a.legacyLocked) continue;
    const card = grid.querySelector(`.agent-card-full[data-agent-id="${a.id}"]`);
    // Carte absente (recrutement) ou rang changé (slots d'équipe différents) :
    // structurel → rebuild complet et on s'arrête là.
    if (!card || card.dataset.rank !== (a.title || 'grunt')) { renderAgentsTab(); return; }

    const lvEl = card.querySelector('.agent-lv');
    if (lvEl) lvEl.textContent = `Lv.${a.level}`;
    const xpFill = card.querySelector('.agent-xp-fill');
    if (xpFill) xpFill.style.width = `${Math.min(100, (a.xp / (a.level * 30)) * 100)}%`;
    const energyRow = card.querySelector('.agent-energy-row');
    if (energyRow) energyRow.innerHTML = _agentEnergyRowHtml(a, getAgentTeamSlots(a));
  }
}

// ── Refresh automatique via EventBus (patch ciblé, jamais de rebuild) ─────────
// Ces events sont émis en rafale par les agents en arrière-plan ; le debounce
// regroupe la rafale, et le handler ne touche que les nœuds dynamiques.
const AGENTS_TAB_EVENT_DEBOUNCE_MS = 400;
let _agentsPatchTimer = null;

let _agentsTabEventsRegistered = false;
function _registerAgentsTabEvents() {
  if (_agentsTabEventsRegistered) return;
  _agentsTabEventsRegistered = true;

  // Délégué sur le conteneur persistant : le bouton de rachat vit dans
  // .agent-energy-row, régénérée aussi bien par le rebuild complet que par
  // _patchAgentsTabDynamic (innerHTML ciblé) — un listener posé sur chaque
  // bouton individuel serait perdu après un patch ciblé.
  document.getElementById('agentsGrid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-bail-agent]');
    if (!btn) return;
    globalThis.bailOutAgent?.(btn.dataset.bailAgent);
    renderAgentsTab();
  });

  const _patchIfActive = () => {
    if (globalThis.activeTab !== 'tabAgents') return;
    clearTimeout(_agentsPatchTimer);
    _agentsPatchTimer = setTimeout(_patchAgentsTabDynamic, AGENTS_TAB_EVENT_DEBOUNCE_MS);
  };
  EventBus.on(EVENTS.COMBAT_WON,       _patchIfActive); // XP/level agents
  EventBus.on(EVENTS.COMBAT_LOST,      _patchIfActive); // énergie (baisse sur défaite)
  EventBus.on(EVENTS.POKEMON_CAPTURED, _patchIfActive); // XP agents + compteur Pokémon
  EventBus.on(EVENTS.POKEMON_SOLD,     _patchIfActive); // compteur Pokémon (auto-vente)
}
_registerAgentsTabEvents();

Object.assign(globalThis, { renderAgentsTab, renderAgentTree });
export { renderAgentsTab, renderAgentTree };
