// ════════════════════════════════════════════════════════════════
//  AGENT SHEET — Fiche détaillée d'un agent (alpha)
//  Modal complet : stats, équipe, zone, historique, actions.
// ════════════════════════════════════════════════════════════════
//
//  Globals lus via globalThis :
//    state, notify, saveState, SFX,
//    pokeSprite, pokeIcon, trainerSprite, speciesName,
//    getAgentRankLabel, getAgentCombatPower, getTeamPower,
//    getZoneLevel, getZoneXPProgress, getZoneLevelBonuses,
//    ZONE_EVENT_DEFINITIONS,
//    assignAgentToZone, openTeamPicker,
//    renderAgentsTab, renderZonesTab
//
//  Classic-script globals : ZONES, ZONES_JOHTO, ZONE_BY_ID, ZONE_JOHTO_BY_ID

'use strict';

import { FALLBACK_TRAINER_SVG } from '../../data/assets-data.js';

// ── Helpers ───────────────────────────────────────────────────

function _state() { return globalThis.state; }
function _lang()  { return _state()?.lang || 'fr'; }

function _zoneName(zoneId) {
  if (!zoneId) return _lang() === 'fr' ? 'Aucune zone' : 'No zone';
  const z = (typeof ZONE_BY_ID !== 'undefined' ? ZONE_BY_ID[zoneId] : null)
         ?? (typeof ZONE_JOHTO_BY_ID !== 'undefined' ? ZONE_JOHTO_BY_ID[zoneId] : null);
  return z ? (_lang() === 'fr' ? z.fr : z.en) : zoneId;
}

function _rankColor(title) {
  return {
    grunt: '#888', sergent: '#4da6ff', lieutenant: '#66cc66',
    commandant: '#ff9900', elite: '#e63535', general: '#ffcc5a',
  }[title] || '#888';
}

function _rankLabel(agent) {
  return globalThis.getAgentRankLabel?.(agent) || agent.title || 'Agent';
}

function _xpNeeded(level) { return level * 30; }

function _agentCombatPower(agent) {
  const teamIds = (agent.team || []).filter(Boolean);
  return Math.round(globalThis.getTeamPower?.(teamIds, _state()) || 0);
}

// ── Zone event badge ─────────────────────────────────────────
function _eventBadgeHtml(zoneId) {
  if (!zoneId) return '';
  const zState = _state()?.zones?.[zoneId];
  const event  = zState?.activeEvent;
  if (!event || event.resolved) return '';
  const def  = globalThis.ZONE_EVENT_DEFINITIONS?.[event.type];
  if (!def) return '';
  const label = def[_lang()] || def.fr;
  const remaining = event.endsAt
    ? Math.max(0, Math.ceil((event.endsAt - Date.now()) / 60000)) + ' min'
    : '';
  return `<div style="margin-top:6px;padding:5px 8px;background:rgba(230,53,53,.15);border:1px solid var(--red);border-radius:var(--radius-sm);font-size:8px;color:var(--red);font-family:var(--font-pixel)">
    ${label}${remaining ? ` <span style="color:var(--text-dim)">${remaining}</span>` : ''}
  </div>`;
}

// ── Zone level bar ────────────────────────────────────────────
function _zoneLevelHtml(zoneId) {
  if (!zoneId || !globalThis.getZoneXPProgress) return '';
  const prog    = globalThis.getZoneXPProgress(zoneId);
  const bonuses = globalThis.getZoneLevelBonuses?.(zoneId) || {};
  const bonusLines = Object.entries(bonuses)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => {
      const labels = {
        spawnRate: `+${Math.round(v * 100)}% spawn`,
        moneyMult: `+${Math.round(v * 100)}% argent`,
        rareChance:`+${Math.round(v * 100)}% rare`,
        shinyBonus:`+${Math.round(v * 100)}% shiny`,
        agentXpBonus:`+${Math.round(v * 100)}% XP agent`,
      };
      return `<span style="color:var(--gold);font-size:8px">${labels[k] || k}</span>`;
    }).join(' · ');

  return `<div style="margin-top:8px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
      <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">ZONE NV.${prog.level}${prog.level >= globalThis.ZONE_MAX_LEVEL ? ' MAX' : ''}</span>
      <span style="font-size:8px;color:var(--text-dim)">${prog.xp} XP${prog.level < globalThis.ZONE_MAX_LEVEL ? ` · ${prog.toNext} → nv.${prog.level + 1}` : ''}</span>
    </div>
    <div style="height:4px;background:var(--bg);border-radius:2px;overflow:hidden">
      <div style="height:100%;width:${Math.round(prog.progress * 100)}%;background:var(--gold);transition:width .3s"></div>
    </div>
    ${bonusLines ? `<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px">${bonusLines}</div>` : ''}
    ${_eventBadgeHtml(zoneId)}
  </div>`;
}

// ── Team slots ────────────────────────────────────────────────
function _teamHtml(agent) {
  const state   = _state();
  const maxSlots = { grunt:1, sergent:2, lieutenant:3, commandant:4, elite:5, general:6 }[agent.title] ?? 1;

  return Array.from({ length: maxSlots }, (_, i) => {
    const pkId = agent.team[i];
    const pk   = pkId ? state.pokemons.find(p => p.id === pkId) : null;
    if (!pk) return `<div style="width:48px;height:48px;background:var(--bg);border:1px dashed var(--border);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer" data-sheet-team-slot="${i}">+</div>`;
    const stars = '★'.repeat(pk.potential);
    return `<div style="width:48px;position:relative;cursor:pointer" data-sheet-team-slot="${i}" title="${globalThis.speciesName?.(pk.species_en) || pk.species_en} Lv.${pk.level} ${stars}">
      <img src="${globalThis.pokeIcon?.(pk.species_en) || ''}" style="width:48px;height:48px;image-rendering:pixelated;${pk.shiny ? 'filter:drop-shadow(0 0 3px var(--gold))' : ''}">
      <div style="position:absolute;bottom:0;left:0;right:0;text-align:center;font-size:7px;color:var(--text-dim);background:rgba(0,0,0,.6)">Lv.${pk.level}</div>
    </div>`;
  }).join('');
}

// ── Stat row ─────────────────────────────────────────────────
function _stat(label, value, color = 'var(--text)') {
  return `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border)">
    <span style="font-size:9px;color:var(--text-dim)">${label}</span>
    <span style="font-size:9px;font-weight:600;color:${color}">${value}</span>
  </div>`;
}

// ── Main render ───────────────────────────────────────────────
function _buildSheetHtml(agent) {
  const state   = _state();
  const lang    = _lang();
  const xpPct   = Math.min(100, (agent.xp / _xpNeeded(agent.level)) * 100);
  const power   = _agentCombatPower(agent);
  const zone    = agent.assignedZone;
  const rankCol = _rankColor(agent.title);
  const unlockedZones = [
    ...(typeof ZONES !== 'undefined' ? ZONES : []),
    ...(typeof ZONES_JOHTO !== 'undefined' ? ZONES_JOHTO : []),
  ].filter(z => globalThis.isZoneUnlocked?.(z.id) && z.id !== 'gang_park');

  // Statut auto-comportements
  const bhIcons = [
    agent.autoCombat  !== false ? '⚔️' : '',
    agent.autoRaid    !== false ? '💣' : '',
    agent.autoCapture !== false ? '🎯' : '',
  ].filter(Boolean).join(' ');

  const zoneOptions = unlockedZones.map(z =>
    `<option value="${z.id}" ${zone === z.id ? 'selected' : ''}>${lang === 'fr' ? z.fr : z.en}</option>`
  ).join('');

  return `
  <!-- HEADER -->
  <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:14px">
    <div style="position:relative;flex-shrink:0">
      <img src="${agent.sprite}" alt="${agent.name}"
        style="width:72px;height:72px;image-rendering:pixelated;border:2px solid ${rankCol};border-radius:4px"
        onerror="this.src='${FALLBACK_TRAINER_SVG}';this.onerror=null">
      <div style="position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);
        background:${rankCol};color:#000;font-family:var(--font-pixel);font-size:6px;
        padding:2px 5px;border-radius:2px;white-space:nowrap">
        ${_rankLabel(agent).toUpperCase()}
      </div>
    </div>
    <div style="flex:1;min-width:0">
      <div style="font-family:var(--font-pixel);font-size:13px;color:var(--text);margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        ${agent.name}
      </div>
      <div style="font-size:9px;color:var(--text-dim);margin-bottom:6px">
        Niveau ${agent.level} · ${agent.xp}/${_xpNeeded(agent.level)} XP
      </div>
      <!-- Barre XP -->
      <div style="height:5px;background:var(--bg);border-radius:3px;overflow:hidden;margin-bottom:6px">
        <div style="height:100%;width:${xpPct.toFixed(1)}%;background:${rankCol};transition:width .3s"></div>
      </div>
      <div style="font-size:8px;color:var(--text-dim)">${agent.personality.join(' · ')}</div>
    </div>
  </div>

  <!-- STATS -->
  <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 10px;margin-bottom:12px">
    <div style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);margin-bottom:6px">STATISTIQUES</div>
    ${_stat('Puissance équipe', power.toLocaleString(), 'var(--red)')}
    ${_stat('Combats gagnés', (agent.combatsWon || 0).toLocaleString(), 'var(--gold)')}
    ${_stat('Captures totales', (agent.captureCount || 0).toLocaleString(), 'var(--gold)')}
    ${_stat('Comportements auto', bhIcons || '—')}
    ${_stat('Skin de ball', agent.ball || 'pokeball')}
  </div>

  <!-- ZONE ASSIGNÉE -->
  <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 10px;margin-bottom:12px">
    <div style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);margin-bottom:6px">ZONE ASSIGNÉE</div>
    <select id="agentSheetZoneSelect" style="width:100%;background:var(--bg-panel);color:var(--text);border:1px solid var(--border);border-radius:var(--radius-sm);font-size:9px;padding:4px 6px;margin-bottom:4px">
      <option value="">— Aucune zone —</option>
      ${zoneOptions}
    </select>
    ${zone ? _zoneLevelHtml(zone) : ''}
  </div>

  <!-- ÉQUIPE -->
  <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 10px;margin-bottom:12px">
    <div style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);margin-bottom:8px">
      ÉQUIPE (${(agent.team || []).filter(Boolean).length}/${({ grunt:1, sergent:2, lieutenant:3, commandant:4, elite:5, general:6 }[agent.title] ?? 1)} slots)
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px" id="agentSheetTeam">
      ${_teamHtml(agent)}
    </div>
  </div>

  <!-- ACTIONS -->
  <div style="display:flex;flex-direction:column;gap:6px">
    ${globalThis.state?.purchases?.cosmeticsPanel ? `
    <div style="display:flex;gap:6px">
      <button id="agentSheetRename" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">✏ Renommer <span style="color:var(--gold)">(2 000₽)</span></button>
      <button id="agentSheetSprite" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">🎨 Sprite <span style="color:var(--gold)">(5 000₽)</span></button>
    </div>` : ''}
    <button id="agentSheetClose" style="font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg-panel);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--red);cursor:pointer">✕ Fermer</button>
  </div>`;
}

// ── Ouverture du modal ────────────────────────────────────────

/**
 * Ouvre la fiche détaillée d'un agent.
 * @param {string} agentId
 * @param {Function} [onClose] — callback appelé à la fermeture
 */
function openAgentSheet(agentId, onClose) {
  const agent = _state().agents?.find(a => a.id === agentId);
  if (!agent) return;

  document.getElementById('agentSheetModal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'agentSheetModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9200;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;padding:16px';

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--border-light);border-radius:var(--radius);
      padding:18px 16px;max-width:380px;width:100%;max-height:90vh;overflow-y:auto;position:relative">
      <div style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);letter-spacing:2px;margin-bottom:12px">
        FICHE AGENT
      </div>
      ${_buildSheetHtml(agent)}
    </div>`;

  document.body.appendChild(modal);

  // Close
  const close = () => {
    modal.remove();
    onClose?.();
    globalThis.renderAgentsTab?.();
  };

  modal.querySelector('#agentSheetClose')?.addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  // Zone selector
  modal.querySelector('#agentSheetZoneSelect')?.addEventListener('change', e => {
    globalThis.assignAgentToZone?.(agentId, e.target.value || null);
    // Rafraîchir la section zone sans fermer
    _refreshZoneSection(modal, agent);
    globalThis.saveState?.();
  });

  // Team slots
  modal.querySelector('#agentSheetTeam')?.addEventListener('click', e => {
    const slot = e.target.closest('[data-sheet-team-slot]');
    if (!slot) return;
    const slotIdx = parseInt(slot.dataset.sheetTeamSlot);
    const pkId = agent.team[slotIdx];
    if (pkId) {
      agent.team.splice(slotIdx, 1);
      globalThis.saveState?.();
      _refreshTeamSection(modal, agent);
    } else {
      globalThis.openTeamPicker?.('agent', agentId, () => _refreshTeamSection(modal, agent));
    }
  });

  // Rename
  modal.querySelector('#agentSheetRename')?.addEventListener('click', () => {
    _handleRename(agent, () => {
      modal.remove();
      openAgentSheet(agentId, onClose);
    });
  });

  // Sprite
  modal.querySelector('#agentSheetSprite')?.addEventListener('click', () => {
    _handleSpriteChange(agent, () => {
      modal.remove();
      openAgentSheet(agentId, onClose);
    });
  });
}

// ── Refresh partiel ───────────────────────────────────────────

function _refreshTeamSection(modal, agent) {
  const container = modal.querySelector('#agentSheetTeam');
  if (container) container.innerHTML = _teamHtml(agent);
}

function _refreshZoneSection(modal, agent) {
  // Trouver et remplacer le bloc zone
  const sel = modal.querySelector('#agentSheetZoneSelect');
  if (!sel) return;
  const parent = sel.closest('div[style*="ZONE ASSIGNÉE"]') ?? sel.parentElement;
  if (!parent) return;
  // Recréer les infos de zone sous le select
  const existing = parent.querySelector('#agentSheetZoneInfo');
  if (existing) existing.remove();
  if (agent.assignedZone) {
    const div = document.createElement('div');
    div.id = 'agentSheetZoneInfo';
    div.innerHTML = _zoneLevelHtml(agent.assignedZone);
    parent.appendChild(div);
  }
}

// ── Actions agent ─────────────────────────────────────────────

function _handleRename(agent, onDone) {
  const state = _state();
  if (state.gang.money < 2000) {
    globalThis.notify?.('Fonds insuffisants (2 000₽)', 'error'); return;
  }
  const newName = window.prompt('Nouveau nom de l\'agent :', agent.name);
  if (!newName || !newName.trim()) return;
  state.gang.money -= 2000;
  agent.name = newName.trim().slice(0, 20);
  globalThis.saveState?.();
  globalThis.notify?.(`Agent renommé → ${agent.name}`, 'success');
  onDone?.();
}

function _handleSpriteChange(agent, onDone) {
  const state = _state();
  if (state.gang.money < 5000) {
    globalThis.notify?.('Fonds insuffisants (5 000₽)', 'error'); return;
  }
  // Réutilise le sprite picker existant (openSpritePicker de pickers.js)
  globalThis.openSpritePicker?.(agent.spriteKey, (newSprite) => {
    state.gang.money -= 5000;
    agent.spriteKey = newSprite;
    agent.sprite    = globalThis.trainerSprite?.(newSprite) || agent.sprite;
    globalThis.saveState?.();
    globalThis.notify?.('Sprite de l\'agent mis à jour', 'success');
    onDone?.();
  });
}

// ── Export globalThis ─────────────────────────────────────────
Object.assign(globalThis, { openAgentSheet });
