'use strict';

// ════════════════════════════════════════════════════════════════
//  GANG COMPETITION TAB  —  UI du mode PvP en ligne
//  Dépendances globalThis :
//    state, notify, saveState, pokeSprite, switchTab, ZONES
//  Dépendances via import :
//    gangCompetition module
// ════════════════════════════════════════════════════════════════

import {
  POWER_W_ATK, POWER_W_DEF, POWER_W_SPD,
  POWER_SOFT_CAP, POWER_SOFT_RATE,
} from '../../data/power-config-data.js';

import {
  publishDefense,
  purgeLegacyDefenseData,
  loadGangList,
  executeRaid,
  loadPendingRaids,
  acknowledgeRaids,
  getRaidCooldownMs,
  getRaidPreview,
  RAID_PENALTY,
  RAID_NO_DEFENSE_PENALTY_MULT,
  REP_STEAL_RATIO,
  RAID_GOLD_PER_REP,
  RAID_GOLD_MAX,
  PVP_AGENT_SLOTS,
  PVP_BOSS_TEAM_SLOTS,
} from '../systems/gangCompetition.js';

import { EventBus, EVENTS } from '../core/eventBus.js';
import { esc as _esc } from '../core/escape.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY,        { msg, type });
const _dirty  = ()               => EventBus.emit(EVENTS.STATE_DIRTY);
const _topBar = ()               => EventBus.emit(EVENTS.UI_TOPBAR_UPDATE);
const _save   = ()               => globalThis.saveState?.();
const _t      = (...a)           => globalThis.t?.(...a) ?? a[0];


// ── Helpers locaux ────────────────────────────────────────────────
function state()     { return globalThis.state; }
function notify(...a){ return _notify(...a); }
function saveState() { return _save(); }
function pokeSprite(en, shiny) { return globalThis.pokeSprite?.(en, shiny) ?? ''; }
function showConfirm(message, onConfirm, opts = {}) {
  if (typeof globalThis.showConfirm === 'function') {
    return globalThis.showConfirm(message, onConfirm, null, opts);
  }
  const plain = String(message).replace(/<[^>]*>/g, ' ');
  if (typeof globalThis.confirm === 'function') {
    if (globalThis.confirm(plain)) return onConfirm?.();
    return undefined;
  }
  return onConfirm?.();
}

function _fmtMs(ms) {
  const m = Math.ceil(ms / 60_000);
  return m >= 60 ? `${Math.ceil(m / 60)}h` : `${m}min`;
}

function _fmtNum(n) { return (n ?? 0).toLocaleString(_t('competition_locale')); }

function _agentTeamPower(agent, s = state()) {
  let power = 0;
  for (const pkId of (agent?.team || [])) {
    const p = s.pokemons.find(pk => pk.id === pkId);
    if (p) {
      if (globalThis.getPokemonPower) {
        power += globalThis.getPokemonPower(p);
      } else {
        const s = p.stats ?? {};
        const raw = (s.atk ?? 0) * POWER_W_ATK + (s.def ?? 0) * POWER_W_DEF + (s.spd ?? 0) * POWER_W_SPD;
        power += raw <= POWER_SOFT_CAP ? raw : POWER_SOFT_CAP + (raw - POWER_SOFT_CAP) * POWER_SOFT_RATE;
      }
    }
  }
  return power;
}

function _agentPower(agent, s = state()) {
  if (!agent) return 0;
  if (globalThis.getAgentCombatPower) return globalThis.getAgentCombatPower(agent);
  const rankMult = (globalThis.TITLE_BONUSES ?? {})[agent.title] ?? 1.0;
  return Math.round(((agent.stats?.combat ?? 0) * 10 + _agentTeamPower(agent, s)) * rankMult);
}

function _pickDefaultAgent(s = state()) {
  return _pickDefaultAgents(1, s)[0] ?? null;
}

function _pickDefaultAgents(count = PVP_AGENT_SLOTS, s = state()) {
  return [...(s.agents || [])]
    .sort((a, b) => {
      const levelDiff = (b.level ?? 1) - (a.level ?? 1);
      if (levelDiff !== 0) return levelDiff;
      return _agentPower(b, s) - _agentPower(a, s);
    })
    .slice(0, count);
}

function _effectiveAttackAgentIds(agentIds = [], s = state()) {
  const ids = Array.isArray(agentIds) ? agentIds.filter(Boolean) : [];
  if (ids.length > 0) return ids;
  return _pickDefaultAgents(PVP_AGENT_SLOTS, s).map(a => a.id);
}

function _defenseAgentsFromData(defData) {
  const raw = defData?.defense_agent;
  if (Array.isArray(raw)) return raw.filter(Boolean).slice(0, PVP_AGENT_SLOTS);
  return raw ? [raw] : [];
}

function _getManualDefenseAgentIds(comp) {
  if (Array.isArray(comp?.defenseAgents)) {
    return Array.from({ length: PVP_AGENT_SLOTS }, (_, idx) => comp.defenseAgents[idx] ?? null);
  }
  const legacy = comp?.defenseAgent ?? null;
  return Array.from({ length: PVP_AGENT_SLOTS }, (_, idx) => idx === 0 ? legacy : null);
}

function _getDisplayedDefenseAgentIds(s = state()) {
  const manual = _getManualDefenseAgentIds(s.gang?.competition);
  const used = new Set(manual.filter(Boolean));
  const fallback = _pickDefaultAgents(PVP_AGENT_SLOTS, s)
    .map(a => a.id)
    .filter(id => !used.has(id));
  return manual.map(id => id || fallback.shift() || null);
}

// ── Entrée principale ─────────────────────────────────────────────
export async function renderGangCompetitionTab() {
  const tab = document.getElementById('tabCompetition');
  if (!tab) return;

  const s    = state();
  const comp = s.gang?.competition;
  const pendingCount = comp?.pendingRaids?.length ?? 0;

  tab.innerHTML = `
    <div style="padding:16px;max-width:900px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap">
        <div style="font-family:var(--font-pixel);font-size:12px;color:var(--red);margin-right:auto">
          ⚔️ ${_t('competition_title').toUpperCase()}
          ${pendingCount > 0 ? `<span style="margin-left:12px;background:var(--red);color:#fff;font-size:8px;padding:2px 7px;border-radius:99px;vertical-align:middle">${_t('competition_pending_count', { n: pendingCount })}</span>` : ''}
        </div>
        <button id="comp-purge-legacy-defense" title="${_t('competition_refresh_purge_title')}" style="
          font-family:var(--font-pixel);font-size:7px;padding:6px 9px;background:var(--bg);
          border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--red);
          cursor:pointer;letter-spacing:.02em
        ">⟳ ${_t('competition_refresh_purge')}</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div id="comp-defense-panel"></div>
        <div id="comp-stats-panel"></div>
      </div>
      <div id="comp-raids-panel" style="margin-top:16px"></div>
      <div id="comp-gangs-panel" style="margin-top:16px"></div>
    </div>`;

  _bindLegacyDefensePurge(tab);
  _renderDefensePanel(tab.querySelector('#comp-defense-panel'));
  _renderStatsPanel(tab.querySelector('#comp-stats-panel'));
  await _renderPendingRaidsPanel(tab.querySelector('#comp-raids-panel'));
  await _renderGangListPanel(tab.querySelector('#comp-gangs-panel'));
}

function _bindLegacyDefensePurge(tab) {
  const btn = tab.querySelector('#comp-purge-legacy-defense');
  if (!btn) return;

  btn.addEventListener('click', () => {
    showConfirm(
      _t('competition_purge_confirm'),
      () => {
        void (async () => {
          btn.disabled = true;
          btn.textContent = '…';
          await purgeLegacyDefenseData();
          await renderGangCompetitionTab();
          _topBar();
        })();
      },
      { danger: true, confirmLabel: _t('competition_purge'), cancelLabel: _t('competition_cancel') },
    );
  });
}

// ── Panneau setup défense ─────────────────────────────────────────
function _renderDefensePanel(el) {
  if (!el) return;
  const s    = state();
  const comp = s.gang.competition;
  const bossTeamIds = Array.from({ length: PVP_BOSS_TEAM_SLOTS }, (_, idx) => s.gang.bossTeam?.[idx] ?? null);
  const hasBossTeam = bossTeamIds.some(Boolean);

  const teamSlots = bossTeamIds.map((id, i) => {
    const p = id ? s.pokemons.find(pk => pk.id === id) : null;
    if (p) {
      return `<div class="comp-boss-slot" data-slot="${i}" style="
        position:relative;width:52px;height:52px;background:var(--bg);border:2px solid var(--gold-dim);
        border-radius:var(--radius-sm);overflow:hidden;display:flex;align-items:center;justify-content:center
      " title="${p.species_en} Lv.${p.level} · Boss">
        <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:44px;height:44px;image-rendering:pixelated">
        <div style="position:absolute;bottom:0;left:0;right:0;font-size:7px;text-align:center;background:rgba(0,0,0,.55);color:#fff;padding:1px 0">${p.species_en.slice(0,6)}</div>
        <span style="position:absolute;top:1px;right:2px;font-size:6px;color:var(--gold);background:rgba(0,0,0,.65);padding:1px 2px;border-radius:2px">BOSS</span>
      </div>`;
    }
    return `<div class="comp-boss-slot empty" data-slot="${i}" style="
      width:52px;height:52px;background:var(--bg);border:2px dashed var(--border);
      border-radius:var(--radius-sm);color:var(--text-dim);font-size:18px;display:flex;align-items:center;justify-content:center
    " title="${_t('competition_empty_boss_slot')}">+</div>`;
  }).join('');

  const manualAgentIds = _getManualDefenseAgentIds(comp);
  const displayedAgentIds = _getDisplayedDefenseAgentIds(s);
  const hasManualAgents = manualAgentIds.some(Boolean);
  const agentHtml = displayedAgentIds.map((id, i) => {
    const agent = id ? s.agents.find(a => a.id === id) : null;
    const agentDefaulted = !!agent && manualAgentIds[i] !== id;
    if (!agent) {
      return `<button class="comp-pick-agent" data-slot="${i}" style="width:100%;padding:7px;background:var(--bg);border:2px dashed var(--border);border-radius:var(--radius-sm);cursor:pointer;color:var(--text-dim);font-size:10px">${_t('competition_def_agent_slot', { n: i + 1 })}</button>`;
    }
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px;background:var(--bg);border:1px solid ${agentDefaulted ? 'var(--gold-dim)' : 'var(--border)'};border-radius:var(--radius-sm)">
      <img src="https://play.pokemonshowdown.com/sprites/gen5/${agent.spriteKey ?? ''}.png" style="width:32px;height:32px;image-rendering:pixelated" onerror="this.style.display='none'">
      <div style="flex:1;min-width:0">
        <div style="font-size:9px">${i + 1}. ${_esc(agent.name)}</div>
        <div style="font-size:8px;color:var(--text-dim)">Lv.${agent.level} · ${agent.title} · ⚡${_fmtNum(_agentPower(agent, s))}${agentDefaulted ? ' · AUTO' : ''}</div>
      </div>
      <button class="comp-pick-agent" data-slot="${i}" style="background:none;border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer;font-size:8px;padding:3px 6px">${_t('competition_change')}</button>
      ${agentDefaulted ? '' : `<button class="comp-clear-agent" data-slot="${i}" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:13px">✕</button>`}
    </div>`;
  }).join('');

  const zones = ZONES;
  const unlockedZones = zones.filter(z => {
    const zState = state().zones?.[z.id];
    return zState?.unlocked;
  });
  const zoneOptions = unlockedZones.map(z =>
    `<option value="${z.id}" ${comp.defenseZone === z.id ? 'selected' : ''}>${z.name ?? z.id}</option>`
  ).join('');

  el.innerHTML = `
    <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:14px">
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:10px">🛡 ${_t('competition_my_defense').toUpperCase()}</div>
      ${!hasManualAgents ? `<div style="font-size:8px;color:var(--gold-dim);margin-bottom:10px">${_t('competition_auto_defense_hint')}</div>` : ''}

      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">${_t('competition_boss_team_count', { n: PVP_BOSS_TEAM_SLOTS })}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${teamSlots}</div>
      ${!hasBossTeam ? `<div style="font-size:8px;color:var(--red);margin-top:-6px;margin-bottom:12px">${_t('competition_no_boss_pokemon')}</div>` : ''}

      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">${_t('competition_defenders_count', { n: PVP_AGENT_SLOTS })}</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">${agentHtml}</div>

      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">${_t('competition_arena_zone')}</div>
      <select id="comp-zone-select" style="width:100%;padding:6px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:9px;margin-bottom:12px">
        <option value="">${_t('competition_choose_zone')}</option>
        ${zoneOptions}
      </select>

      <button id="comp-publish-btn" style="
        width:100%;padding:9px;background:var(--red);border:none;border-radius:var(--radius-sm);
        color:#fff;font-family:var(--font-pixel);font-size:8px;cursor:pointer;letter-spacing:.04em
      ">${comp.defensePublished ? _t('competition_update_defense') : (hasManualAgents ? _t('competition_publish_defense') : _t('competition_publish_base'))}</button>
      ${comp.defensePublished ? `<div style="font-size:8px;color:var(--green);text-align:center;margin-top:5px">${_t('competition_defense_online')}</div>` : ''}
    </div>`;

  el.querySelectorAll('.comp-pick-agent').forEach(btn => {
    btn.addEventListener('click', () => _openAgentPicker(el, parseInt(btn.dataset.slot)));
  });
  el.querySelectorAll('.comp-clear-agent').forEach(btn => {
    btn.addEventListener('click', () => {
      const comp = state().gang.competition;
      if (!Array.isArray(comp.defenseAgents)) comp.defenseAgents = _getManualDefenseAgentIds(comp);
      comp.defenseAgents[parseInt(btn.dataset.slot)] = null;
      comp.defenseAgent = comp.defenseAgents.find(Boolean) ?? null;
      comp.defensePublished = false;
      saveState();
      _renderDefensePanel(el);
    });
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
    else {
      btn.disabled = false;
      btn.textContent = hasManualAgents ? _t('competition_publish_defense') : _t('competition_publish_base');
    }
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
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:10px">📊 ${_t('competition_statistics').toUpperCase()}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:8px;text-align:center">
          <div style="font-family:var(--font-pixel);font-size:14px;color:var(--green)">${comp.wins?.attack ?? 0}</div>
          <div style="font-size:8px;color:var(--text-dim)">${_t('competition_raids_won')}</div>
        </div>
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:8px;text-align:center">
          <div style="font-family:var(--font-pixel);font-size:14px;color:var(--red)">${comp.losses?.attack ?? 0}</div>
          <div style="font-size:8px;color:var(--text-dim)">${_t('competition_raids_lost')}</div>
        </div>
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:8px;text-align:center">
          <div style="font-family:var(--font-pixel);font-size:14px;color:var(--blue)">${comp.wins?.defense ?? 0}</div>
          <div style="font-size:8px;color:var(--text-dim)">${_t('competition_defenses_held')}</div>
        </div>
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:8px;text-align:center">
          <div style="font-family:var(--font-pixel);font-size:14px;color:var(--gold-dim)">${comp.losses?.defense ?? 0}</div>
          <div style="font-size:8px;color:var(--text-dim)">${_t('competition_defenses_lost')}</div>
        </div>
      </div>
      <div style="font-size:8px;color:var(--text-dim);line-height:1.8;border-top:1px solid var(--border);padding-top:10px">
        <div>${_t('competition_rule_cooldown')}</div>
        <div>${_t('competition_rule_victory')}</div>
        <div>${_t('competition_rule_loot', { percent: pct, perRep: _fmtNum(RAID_GOLD_PER_REP), max: _fmtNum(RAID_GOLD_MAX) })}</div>
        <div>${_t('competition_rule_defeat', { penalty: _fmtNum(RAID_PENALTY), suffix: RAID_NO_DEFENSE_PENALTY_MULT > 1 ? _t('competition_auto_empty_multiplier') : '' })}</div>
        <div>${_t('competition_rule_auto_defense', { mult: RAID_NO_DEFENSE_PENALTY_MULT })}</div>
        <div>${_t('competition_rule_defense_success', { reward: _fmtNum(RAID_PENALTY), suffix: RAID_NO_DEFENSE_PENALTY_MULT > 1 ? _t('competition_auto_empty_multiplier') : '' })}</div>
        <div>${_t('competition_rule_reputation')}</div>
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
        <span style="font-family:var(--font-pixel);font-size:9px;color:var(--red)">📬 ${_t('competition_incoming_raids').toUpperCase()}</span>
        <button id="comp-load-raids" style="margin-left:auto;font-family:var(--font-pixel);font-size:7px;padding:4px 9px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">⟳ ${_t('competition_check')}</button>
      </div>
      <div id="comp-raids-list"></div>
      <button id="comp-ack-raids" style="
        display:none;margin-top:10px;width:100%;padding:8px;background:var(--red);border:none;
        border-radius:var(--radius-sm);color:#fff;font-family:var(--font-pixel);font-size:8px;cursor:pointer
      ">✓ ${_t('competition_apply_results')}</button>
    </div>`;

  const listEl = el.querySelector('#comp-raids-list');
  const ackBtn = el.querySelector('#comp-ack-raids');

  function _renderRaidList(raids) {
    if (!raids.length) {
    listEl.innerHTML = `<div style="color:var(--text-dim);font-size:9px;font-style:italic">${_t('competition_no_pending_raid')}</div>`;
      if (ackBtn) ackBtn.style.display = 'none';
      return;
    }
    listEl.innerHTML = raids.map(r => {
      const won  = r.result === 'defender_win';
      const ts   = new Date(r.executed_at).toLocaleString(_t('competition_locale'), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const delta = won
        ? `<span style="color:var(--green)">+${_fmtNum(r.money_penalty)} ₽</span>`
        : `<span style="color:var(--gold-dim)">${_t('competition_rep_unchanged_short')}</span>`;
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:16px">${won ? '🛡' : '💀'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:9px">${won ? _t('competition_defense_success') : _t('competition_defense_failed')} vs <b>${_esc(r.attacker_gang ?? '?')}</b></div>
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
    btn.textContent = `⟳ ${_t('competition_check')}`;
  });

  ackBtn?.addEventListener('click', async () => {
    ackBtn.disabled = true;
    ackBtn.textContent = '…';
    await acknowledgeRaids();
    _renderRaidList([]);
    ackBtn.style.display = 'none';
    _topBar();
  });
}

// ── Panneau liste des gangs ───────────────────────────────────────
async function _renderGangListPanel(el) {
  if (!el) return;
  el.innerHTML = `
    <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:14px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">⚔️ ${_t('competition_opponent_gangs').toUpperCase()}</span>
        <button id="comp-refresh-gangs" style="margin-left:auto;font-family:var(--font-pixel);font-size:7px;padding:4px 9px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">⟳</button>
      </div>
      <div id="comp-gang-list"><div style="color:var(--text-dim);font-size:9px">${_t('competition_loading')}</div></div>
    </div>`;

  el.querySelector('#comp-refresh-gangs')?.addEventListener('click', () => _loadAndRenderGangs(el));
  await _loadAndRenderGangs(el);
}

async function _loadAndRenderGangs(panelEl) {
  const listEl = panelEl?.querySelector('#comp-gang-list');
  if (!listEl) return;

  listEl.innerHTML = `<div style="color:var(--text-dim);font-size:9px">${_t('competition_loading')}</div>`;
  const gangs = await loadGangList();

  if (!gangs.length) {
    listEl.innerHTML = `<div style="color:var(--text-dim);font-size:9px;font-style:italic">${_t('competition_no_published_gang')}</div>`;
    return;
  }

  const s = state();
  const comp = s.gang.competition;

  listEl.innerHTML = gangs.map(g => {
    const cooldownMs  = getRaidCooldownMs(g.user_id);
    const onCooldown  = cooldownMs > 0;
    const hasPending  = (comp.pendingRaids?.length ?? 0) > 0;
    const canAttack   = !onCooldown && !hasPending;

    const defensePokemons = (g.defense_pokemon ?? []).filter(Boolean);
    const defenseAgents = _defenseAgentsFromData(g);
    const noDefense = defensePokemons.length === 0 && defenseAgents.length === 0;
    const defaultDefense = noDefense || defenseAgents.some(a => a.defaulted);
    const preview = getRaidPreview(g);
    const miniPokemons = defensePokemons.length
      ? defensePokemons.slice(0, PVP_BOSS_TEAM_SLOTS).map(p =>
      `<img src="${_esc(pokeSprite(p.species_en, p.shiny))}" style="width:24px;height:24px;image-rendering:pixelated" title="${_esc(p.species_en)} Lv.${_esc(p.level)}">`
      ).join('')
      : `<span style="font-size:8px;color:${noDefense ? 'var(--red)' : 'var(--text-dim)'}">${noDefense ? _t('competition_no_defense') : _t('competition_no_team')}</span>`;

    const powerInfo = `<span style="font-size:8px;color:var(--gold-dim)">🛡 ${_fmtNum(preview.defenderPower)}</span>`;

    const agentInfo = defenseAgents.length
      ? `<span style="font-size:8px;color:var(--text-dim)">🧑‍✈️ ${defenseAgents.map(a => `${_esc(a.name)} Lv.${a.level}${a.defaulted ? ' AUTO' : ''}`).join(' · ')}</span>`
      : '';

    const zoneInfo = g.defense_zone
      ? `<span style="font-size:8px;color:var(--text-dim)">🗺 ${_esc(g.defense_zone)}</span>`
      : '';

    const noDefenseInfo = defaultDefense
      ? `<span style="font-size:8px;color:var(--red)">${_t('competition_defeat_malus', { mult: RAID_NO_DEFENSE_PENALTY_MULT })}</span>`
      : '';

    let btnHtml;
    if (hasPending) {
      btnHtml = `<button disabled style="padding:6px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);font-size:8px;cursor:not-allowed">${_t('competition_raids_pending')}</button>`;
    } else if (onCooldown) {
      btnHtml = `<button disabled style="padding:6px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);font-size:8px;cursor:not-allowed">⏱ ${_fmtMs(cooldownMs)}</button>`;
    } else {
      btnHtml = `<button class="comp-raid-btn" data-uid="${g.user_id}" style="padding:6px 12px;background:var(--red);border:none;border-radius:var(--radius-sm);color:#fff;font-family:var(--font-pixel);font-size:8px;cursor:pointer">⚔️ ${_t('competition_raid')}</button>`;
    }

    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
      ${g.boss_sprite
        ? `<img src="https://play.pokemonshowdown.com/sprites/gen5/${_esc(g.boss_sprite)}.png" style="width:40px;height:40px;image-rendering:pixelated;flex-shrink:0" onerror="this.style.display='none'">`
        : `<div style="width:40px;height:40px;background:var(--bg);border-radius:4px;flex-shrink:0"></div>`}
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--font-pixel);font-size:9px;margin-bottom:2px">${_esc(g.gang_name)}</div>
        <div style="font-size:8px;color:var(--text-dim);margin-bottom:4px">${_esc(g.boss_name)} · ⭐ ${_t('competition_reputation_short', { value: _fmtNum(g.reputation_snapshot) })}</div>
        <div style="display:flex;gap:2px;flex-wrap:wrap;align-items:center;margin-bottom:3px">${miniPokemons}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${powerInfo}${agentInfo}${zoneInfo}${noDefenseInfo}</div>
      </div>
      <div style="flex-shrink:0">${btnHtml}</div>
    </div>`;
  }).join('');

  listEl.querySelectorAll('.comp-raid-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const defData = gangs.find(g => g.user_id === btn.dataset.uid);
      if (!defData) return;
      _openAttackPrepModal(defData, panelEl);
    });
  });
}

// ── Helpers cinématique ───────────────────────────────────────────
function _repTitle(rep) {
  if (rep >= 500_000) return _t('competition_rank_shadow_lord');
  if (rep >= 100_000) return _t('competition_rank_godfather');
  if (rep >= 50_000)  return _t('competition_rank_region_boss');
  if (rep >= 20_000)  return _t('competition_rank_feared_leader');
  if (rep >= 5_000)   return _t('competition_rank_district_boss');
  if (rep >= 1_000)   return _t('competition_rank_aspiring_boss');
  return _t('competition_rank_recruit');
}

function _hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const _BOSS_TAUNTS = [
  'competition_taunt_1',
  'competition_taunt_2',
  'competition_taunt_3',
  'competition_taunt_4',
  'competition_taunt_5',
  'competition_taunt_6',
  'competition_taunt_7',
];

// ── Modal sélection équipe d'attaque ──────────────────────────────
function _openAttackPrepModal(defData, panelEl) {
  const existing = document.getElementById('raid-prep-modal');
  if (existing) existing.remove();

  const s = state();
  const agents = [...(s.agents ?? [])].sort((a, b) => _agentPower(b, s) - _agentPower(a, s));
  const selectedIds = new Set(agents.slice(0, PVP_AGENT_SLOTS).map(a => a.id));

  const modal = document.createElement('div');
  modal.id = 'raid-prep-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:6000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center';

  function buildHTML() {
    const selectedAgentIds = [...selectedIds];
    const effectiveAgentIds = _effectiveAttackAgentIds(selectedAgentIds, s);
    const fallbackAgent = selectedAgentIds.length === 0 && effectiveAgentIds.length > 0
      ? s.agents?.find(a => a.id === effectiveAgentIds[0])
      : null;
    const preview = getRaidPreview(defData, selectedAgentIds);
    const power = preview.attackerPower;
    const ratio = preview.defenderPower > 0 ? preview.attackerPower / preview.defenderPower : Infinity;
    const matchupLabel = preview.defenderPower <= 0 ? _t('competition_base_vulnerable') : ratio >= 1.15 ? _t('competition_advantage') : ratio >= 0.85 ? _t('competition_balanced') : _t('competition_risk');
    const matchupColor = preview.defenderPower <= 0 || ratio >= 1.15 ? 'var(--green)' : ratio >= 0.85 ? 'var(--gold)' : 'var(--red)';
    const goldCap = preview.goldOnWin >= RAID_GOLD_MAX ? _t('competition_cap_suffix') : '';
    const defBossEl = defData.boss_sprite
      ? `<img src="https://play.pokemonshowdown.com/sprites/gen5/${_esc(defData.boss_sprite)}.png" style="width:40px;height:40px;image-rendering:pixelated" onerror="this.style.display='none'">`
      : `<div style="width:40px;height:40px;background:var(--bg);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:20px">👤</div>`;

    const agentRows = agents.map(a => {
      const sel      = selectedIds.has(a.id);
      const disabled = !sel && selectedIds.size >= PVP_AGENT_SLOTS;
      const ap       = _agentPower(a, s);
      return `<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;cursor:${disabled ? 'not-allowed' : 'pointer'};border-bottom:1px solid var(--border);opacity:${disabled ? '.4' : '1'}">
        <input type="checkbox" data-agent-id="${a.id}" ${sel ? 'checked' : ''} ${disabled ? 'disabled' : ''} style="accent-color:var(--red);flex-shrink:0">
        <img src="https://play.pokemonshowdown.com/sprites/gen5/${a.spriteKey ?? ''}.png" style="width:28px;height:28px;image-rendering:pixelated" onerror="this.style.display='none'">
        <div style="flex:1;min-width:0">
          <div style="font-size:9px">${_esc(a.name)}</div>
          <div style="font-size:8px;color:var(--text-dim)">Lv.${a.level} · ${_esc(a.title)} · ⚡${_fmtNum(ap)}</div>
        </div>
        ${sel ? '<span style="font-size:16px">✓</span>' : ''}
      </label>`;
    }).join('');

    return `<div style="background:var(--bg-panel);border:2px solid var(--red);border-radius:var(--radius);padding:20px;max-width:400px;width:94%;display:flex;flex-direction:column;gap:14px;font-family:var(--font-pixel);max-height:88vh;overflow-y:auto">
      <div style="font-size:11px;color:var(--red)">⚔️ ${_t('competition_prepare_raid').toUpperCase()}</div>

      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg);border-radius:var(--radius-sm);border:1px solid var(--border)">
        ${defBossEl}
        <div>
          <div style="font-size:9px;color:var(--gold)">${_esc(defData.gang_name)}</div>
          <div style="font-size:8px;color:var(--text-dim)">${_esc(defData.boss_name)} · ⭐ ${_t('competition_reputation_short', { value: _fmtNum(defData.reputation_snapshot) })}</div>
        </div>
      </div>

      <div>
        <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">${_t('competition_attack_agents').toUpperCase()} &nbsp;<span style="color:${selectedIds.size === PVP_AGENT_SLOTS ? 'var(--gold)' : 'var(--text-dim)'}">${_t('competition_selected_slots', { selected: selectedIds.size, total: PVP_AGENT_SLOTS })}</span></div>
        <div style="border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;max-height:200px;overflow-y:auto">
          ${agents.length
            ? agentRows
            : `<div style="padding:12px;font-size:9px;color:var(--text-dim)">${_t('competition_no_attack_agent')}</div>`}
        </div>
        ${fallbackAgent ? `<div style="font-size:8px;color:var(--gold-dim);margin-top:6px">${_t('competition_auto_agent_fallback', { agent: fallbackAgent.name })}</div>` : ''}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center;padding:8px 10px;background:var(--bg);border-radius:var(--radius-sm)">
        <div>
          <div style="font-size:8px;color:var(--text-dim)">${_t('competition_attack')}</div>
          <div style="font-size:10px;color:var(--gold)">⚡ ${_fmtNum(power)}</div>
        </div>
        <div>
          <div style="font-size:8px;color:var(--text-dim)">${_t('competition_defense')}</div>
          <div style="font-size:10px;color:var(--gold-dim)">🛡 ${_fmtNum(preview.defenderPower)}</div>
        </div>
        <div style="font-size:9px;color:${matchupColor};text-align:right">${matchupLabel}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:8px;color:var(--text-dim)">
        <div style="background:rgba(76,175,80,.08);border:1px solid rgba(76,175,80,.25);border-radius:var(--radius-sm);padding:8px">
          <div style="color:var(--green);margin-bottom:3px">${_t('competition_victory')}</div>
          <div>+${_fmtNum(preview.goldOnWin)} ₽${goldCap}</div>
          <div>${_t('competition_reputation_unchanged')}</div>
        </div>
        <div style="background:rgba(244,67,54,.08);border:1px solid rgba(244,67,54,.25);border-radius:var(--radius-sm);padding:8px">
          <div style="color:var(--red);margin-bottom:3px">${_t('competition_defeat')}</div>
          <div>-${_fmtNum(preview.moneyPenaltyOnLoss)} ₽</div>
          <div>${preview.defaultDefense ? _t('competition_malus_multiplier', { mult: RAID_NO_DEFENSE_PENALTY_MULT }) : _t('competition_manual_defense')}</div>
        </div>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="raidPrepCancel" style="font-size:9px;padding:8px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">${_t('competition_cancel')}</button>
        <button id="raidPrepLaunch" style="font-size:9px;padding:8px 18px;background:var(--red);border:none;border-radius:var(--radius-sm);color:#fff;cursor:pointer">⚔️ ${_t('competition_launch_raid')}</button>
      </div>
    </div>`;
  }

  function refresh() { modal.innerHTML = buildHTML(); bindEvents(); }

  function bindEvents() {
    modal.querySelectorAll('[data-agent-id]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) selectedIds.add(cb.dataset.agentId);
        else selectedIds.delete(cb.dataset.agentId);
        refresh();
      });
    });
    modal.querySelector('#raidPrepCancel')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#raidPrepLaunch')?.addEventListener('click', async () => {
      const btn = modal.querySelector('#raidPrepLaunch');
      if (btn) { btn.disabled = true; btn.textContent = '…'; }
      const agentIds = [...selectedIds];
      const result   = await executeRaid(defData, agentIds);
      modal.remove();
      if (result) {
        _openRaidCinematic(defData, agentIds, result, () => {
          _topBar();
          _loadAndRenderGangs(panelEl);
        });
      } else {
        _topBar();
        _loadAndRenderGangs(panelEl);
      }
    });
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  modal.innerHTML = buildHTML();
  document.body.appendChild(modal);
  bindEvents();
}

// ── Cinématique de raid ───────────────────────────────────────────
function _openRaidCinematic(defData, agentIds, result, onDone) {
  const existing = document.getElementById('raid-cinematic');
  if (existing) existing.remove();

  const s = state();
  const myBossSprite    = s.gang.bossSprite ?? '';
  const myBossName      = s.gang.bossName   ?? 'Boss';
  const myGangName      = s.gang.name       ?? _t('competition_our_gang');
  const defBossSprite   = defData.boss_sprite ?? '';
  const defBossName     = defData.boss_name   ?? 'Boss';
  const defGangName     = defData.gang_name   ?? _t('competition_opponent_gang');
  const defBossTitle    = defData.boss_title  ?? _repTitle(defData.reputation_snapshot ?? 0);
  const defPokemons     = (defData.defense_pokemon ?? []).filter(Boolean);
  const defAgents       = _defenseAgentsFromData(defData);
  const effectiveAgentIds = _effectiveAttackAgentIds(agentIds, s);
  const selectedAgents  = effectiveAgentIds.map(id => s.agents?.find(a => a.id === id)).filter(Boolean);

  const taunt = _t(_BOSS_TAUNTS[_hashStr(defBossName) % _BOSS_TAUNTS.length]);

  // Taglines narratives
  const taglines = [];
  if (selectedAgents.length > 0) {
    taglines.push(_t('competition_agents_take_position', { agents: selectedAgents.map(a => a.name).join(', ') }));
  } else {
    taglines.push(_t('competition_gang_advances'));
  }
  taglines.push(_t('competition_gang_activates_defense', { gang: defGangName }));
  if (defAgents.length > 0) {
    taglines.push(_t('competition_def_agents_block', { n: defAgents.length }));
  }
  if (result.noDefense) {
    taglines.push(_t('competition_enemy_base_undefended'));
  } else if (result.defaultDefense) {
    taglines.push(_t('competition_auto_defense_triggers'));
  }
  taglines.push(_t('competition_attack_power', { power: _fmtNum(result.attackerPower) }));
  taglines.push(_t('competition_defense_power', { power: _fmtNum(result.defenderPower) }));
  for (const duel of (result.duels || [])) {
    taglines.push(_t('competition_duel', {
      attacker: duel.attacker.name,
      defender: duel.defender.name,
      attack: _fmtNum(duel.attackerPower),
      defense: _fmtNum(duel.defenderPower),
    }));
    taglines.push(duel.attackerWin
      ? _t('competition_fighter_falls', { name: duel.defender.name })
      : _t('competition_fighter_knocked_out', { name: duel.attacker.name }));
  }
  if (result.finalBattle?.skipped) {
    taglines.push(_t('competition_boss_stopped_before', { boss: myBossName, defender: defBossName }));
  } else if (result.finalBattle) {
    if (result.finalBattle.bossFightsBefore > 0) {
      taglines.push(_t('competition_boss_arrives_tired', {
        boss: myBossName,
        percent: result.finalBattle.bossFightsBefore * 10,
      }));
    }
    if (defPokemons.length > 0) {
      const pk     = defPokemons[0];
      const pkName = globalThis.speciesName?.(pk.species_en) ?? pk.species_en;
      taglines.push(_t('competition_boss_engages_team', { boss: defBossName, pokemon: pkName }));
    }
    taglines.push(_t('competition_final_boss_fight', {
      attack: _fmtNum(result.finalBattle.attackerPower),
      defense: _fmtNum(result.finalBattle.defenderPower),
    }));
  }
  if (result.attackerWin) {
    taglines.push(_t('competition_victory_tagline'));
    if (result.defaultDefense && RAID_NO_DEFENSE_PENALTY_MULT > 1) taglines.push(_t('competition_auto_defense_bonus', { mult: RAID_NO_DEFENSE_PENALTY_MULT }));
    taglines.push(`+${_fmtNum(result.goldWon)} ₽`);
    taglines.push(_t('competition_reputation_unchanged_period'));
  } else {
    taglines.push(_t('competition_defeat_banner'));
    taglines.push(`-${_fmtNum(result.moneyPenalty)} ₽`);
    taglines.push(_t('competition_reputation_unchanged_period'));
  }

  const overlay = document.createElement('div');
  overlay.id = 'raid-cinematic';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:7000;background:#08080f;display:flex;flex-direction:column;align-items:center;overflow-y:auto';

  overlay.innerHTML = `
    <div style="width:100%;max-width:580px;padding:28px 20px;display:flex;flex-direction:column;gap:20px">

      <!-- Header -->
      <div style="font-family:var(--font-pixel);font-size:8px;color:var(--red);text-align:center;letter-spacing:.18em">⚔ ${_t('competition_raid_in_progress').toUpperCase()} ⚔</div>

      <!-- Boss intro -->
      <div style="display:flex;gap:14px;align-items:flex-start">
        <div style="flex-shrink:0;text-align:center">
          ${defBossSprite
            ? `<img src="https://play.pokemonshowdown.com/sprites/gen5/${_esc(defBossSprite)}.png" style="width:72px;height:72px;image-rendering:pixelated" onerror="this.style.display='none'">`
            : `<div style="width:72px;height:72px;background:var(--bg-panel);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:26px">👤</div>`}
          <div style="font-size:7px;color:var(--text-dim);margin-top:3px;font-family:var(--font-pixel)">${_esc(defBossName)}</div>
        </div>
        <div style="flex:1;background:#0d1119;border:2px solid var(--red);border-radius:8px;border-top-left-radius:2px;padding:12px;position:relative">
          <div style="position:absolute;left:-10px;top:16px;width:0;height:0;border-top:7px solid transparent;border-bottom:7px solid transparent;border-right:10px solid var(--red)"></div>
          <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:3px">${_esc(defBossName)}</div>
          <div style="font-size:8px;color:var(--text-dim);margin-bottom:8px">${_esc(defBossTitle)} · ${_t('competition_leader_of', { gang: _esc(defGangName) })}</div>
          <div style="font-size:9px;color:var(--text);font-style:italic">"${taunt}"</div>
        </div>
      </div>

      <!-- VS divider + sprites -->
      <div style="display:flex;align-items:center;gap:8px">
        <div style="flex:1;height:1px;background:rgba(255,255,255,.1)"></div>
        <div style="font-family:var(--font-pixel);font-size:10px;color:var(--red);letter-spacing:.1em">VS</div>
        <div style="flex:1;height:1px;background:rgba(255,255,255,.1)"></div>
      </div>

      <div style="display:flex;gap:8px;justify-content:space-around;align-items:flex-start">
        <!-- Attacker side -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;min-width:120px">
          <div style="font-size:7px;color:var(--text-dim);font-family:var(--font-pixel);letter-spacing:.06em">${_t('competition_your_gang').toUpperCase()}</div>
          <div style="display:flex;gap:3px;flex-wrap:wrap;justify-content:center;max-width:150px">
            ${myBossSprite
              ? `<img src="https://play.pokemonshowdown.com/sprites/gen5/${myBossSprite}.png" style="width:38px;height:38px;image-rendering:pixelated" onerror="this.style.display='none'" title="${_esc(myBossName)}">`
              : `<div style="width:38px;height:38px;background:var(--bg-panel);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:16px">👤</div>`}
            ${selectedAgents.map(a =>
              `<img src="https://play.pokemonshowdown.com/sprites/gen5/${a.spriteKey ?? ''}.png" style="width:30px;height:30px;image-rendering:pixelated" onerror="this.style.display='none'" title="${_esc(a.name)}">`
            ).join('')}
          </div>
          <div style="font-size:7px;color:var(--text-dim)">${_esc(myGangName)}</div>
        </div>

        <div style="font-family:var(--font-pixel);font-size:12px;color:rgba(255,255,255,.2);align-self:center">⚔</div>

        <!-- Defender side -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;min-width:120px">
          <div style="font-size:7px;color:var(--text-dim);font-family:var(--font-pixel);letter-spacing:.06em">${_t('competition_enemy_defense').toUpperCase()}</div>
          <div style="display:flex;gap:3px;flex-wrap:wrap;justify-content:center;max-width:150px">
            ${defPokemons.length > 0
              ? defPokemons.slice(0, PVP_BOSS_TEAM_SLOTS).map(p =>
                  `<img src="${_esc(pokeSprite(p.species_en, p.shiny))}" style="width:30px;height:30px;image-rendering:pixelated" title="${_esc(p.species_en)}">`
                ).join('')
              : `<span style="font-size:8px;color:var(--red)">${defAgents.length ? _t('competition_boss_without_team') : _t('competition_empty_base')}</span>`}
            ${defAgents.map(a =>
              `<img src="https://play.pokemonshowdown.com/sprites/gen5/${_esc(a.sprite ?? '')}.png" style="width:30px;height:30px;image-rendering:pixelated" onerror="this.style.display='none'" title="${_esc(a.name)}">`
            ).join('')}
          </div>
          <div style="font-size:7px;color:var(--text-dim)">${_esc(defGangName)}</div>
        </div>
      </div>

      <!-- Combat log -->
      <div id="cine-log" style="background:#050508;border:1px solid rgba(255,255,255,.08);border-radius:var(--radius-sm);padding:10px 12px;min-height:72px;display:flex;flex-direction:column;gap:3px;font-family:var(--font-pixel);font-size:9px"></div>

      <!-- Result (hidden until log ends) -->
      <div id="cine-result" style="display:none;text-align:center;padding:18px;background:${result.attackerWin ? 'rgba(76,175,80,.1)' : 'rgba(244,67,54,.1)'};border:2px solid ${result.attackerWin ? 'var(--green)' : 'var(--red)'};border-radius:var(--radius)">
        <div style="font-family:var(--font-pixel);font-size:18px;color:${result.attackerWin ? 'var(--green)' : 'var(--red)'}">
          ${result.attackerWin ? _t('competition_victory_banner') : _t('competition_defeat_result')}
        </div>
        <div style="font-size:10px;color:var(--text-dim);margin-top:6px">
          ${result.attackerWin
            ? _t('competition_win_result_line', { gold: _fmtNum(result.goldWon) })
            : _t('competition_loss_result_line', { penalty: _fmtNum(result.moneyPenalty) })}
        </div>
        <button id="cine-continue" style="margin-top:14px;padding:10px 30px;background:${result.attackerWin ? 'var(--green)' : 'var(--red)'};border:none;border-radius:var(--radius-sm);color:#fff;font-family:var(--font-pixel);font-size:9px;cursor:pointer">${_t('competition_continue')} →</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const logEl    = overlay.querySelector('#cine-log');
  const resultEl = overlay.querySelector('#cine-result');
  let i = 0;
  const DELAY = 700;

  const timer = setInterval(() => {
    if (i < taglines.length) {
      const line      = document.createElement('div');
      const isResult  = taglines[i].startsWith('— ');
      const isBonus   = taglines[i].startsWith('+') || taglines[i].startsWith('-');
      line.style.cssText = isResult
        ? `color:${result.attackerWin ? '#4caf50' : '#f44336'};font-size:11px;margin-top:2px`
        : isBonus ? 'color:var(--gold)' : 'color:var(--text-dim)';
      line.textContent = '> ' + taglines[i];
      logEl?.appendChild(line);
      logEl?.scrollTo({ top: logEl.scrollHeight, behavior: 'smooth' });
      i++;
    } else {
      clearInterval(timer);
      if (resultEl) resultEl.style.display = 'block';
      resultEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, DELAY);

  overlay.querySelector('#cine-continue')?.addEventListener('click', () => {
    clearInterval(timer);
    overlay.remove();
    onDone?.();
  });
}

// ── Picker Agent pour défense ─────────────────────────────────────
function _openAgentPicker(defPanelEl, slotIndex = 0) {
  const existing = document.getElementById('comp-agent-picker-modal');
  if (existing) existing.remove();

  const s      = state();
  const agents = s.agents ?? [];
  const manual = _getManualDefenseAgentIds(s.gang.competition);
  const usedElsewhere = new Set(manual.filter((id, idx) => id && idx !== slotIndex));

  if (!agents.length) { notify(_t('competition_no_recruited_agent'), 'error'); return; }

  const rows = agents.map(a => {
    const disabled = usedElsewhere.has(a.id);
    return `<div class="comp-ap-row" data-id="${a.id}" style="
      display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:${disabled ? 'not-allowed' : 'pointer'};border-bottom:1px solid var(--border);opacity:${disabled ? '.45' : '1'}
    ">
      <img src="https://play.pokemonshowdown.com/sprites/gen5/${a.spriteKey ?? ''}.png" style="width:32px;height:32px;image-rendering:pixelated" onerror="this.style.display='none'">
      <div style="flex:1;min-width:0">
        <div style="font-size:9px">${_esc(a.name)}</div>
        <div style="font-size:8px;color:var(--text-dim)">Lv.${a.level} · ${_esc(a.title)} · ${_t('competition_combat')} ${a.stats?.combat ?? 0}</div>
      </div>
      ${disabled ? `<span style="font-size:8px;color:var(--red)">${_t('competition_already_defending')}</span>` : ''}
    </div>`;
  }).join('');

  const modal = document.createElement('div');
  modal.id = 'comp-agent-picker-modal';
  modal.style.cssText = `position:fixed;inset:0;z-index:5000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6)`;
  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);width:320px;max-height:60vh;display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;padding:12px 14px;border-bottom:1px solid var(--border)">
        <span style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">${_t('competition_choose_def_agent', { n: slotIndex + 1 })}</span>
        <button id="comp-ap-close" style="margin-left:auto;background:none;border:none;color:var(--text-dim);font-size:16px;cursor:pointer">✕</button>
      </div>
      <div style="overflow-y:auto;flex:1">${rows}</div>
    </div>`;

  document.body.appendChild(modal);

  modal.querySelector('#comp-ap-close')?.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelectorAll('.comp-ap-row').forEach(row => {
    row.addEventListener('click', () => {
      if (usedElsewhere.has(row.dataset.id)) return;
      const comp = state().gang.competition;
      if (!Array.isArray(comp.defenseAgents)) comp.defenseAgents = _getManualDefenseAgentIds(comp);
      comp.defenseAgents[slotIndex] = row.dataset.id;
      comp.defenseAgent = comp.defenseAgents.find(Boolean) ?? null;
      comp.defensePublished = false;
      saveState();
      modal.remove();
      if (defPanelEl) _renderDefensePanel(defPanelEl);
    });
  });
}
