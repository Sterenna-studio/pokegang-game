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

// ── Helpers locaux ────────────────────────────────────────────────
function state()     { return globalThis.state; }
function notify(...a){ return globalThis.notify?.(...a); }
function saveState() { return globalThis.saveState?.(); }
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

function _fmtNum(n) { return (n ?? 0).toLocaleString('fr-FR'); }

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
          ⚔️ COMPÉTITION DE GANGS
          ${pendingCount > 0 ? `<span style="margin-left:12px;background:var(--red);color:#fff;font-size:8px;padding:2px 7px;border-radius:99px;vertical-align:middle">${pendingCount} raid${pendingCount > 1 ? 's' : ''} à voir</span>` : ''}
        </div>
        <button id="comp-purge-legacy-defense" title="Purger l'ancienne défense publiée et recharger le module" style="
          font-family:var(--font-pixel);font-size:7px;padding:6px 9px;background:var(--bg);
          border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--red);
          cursor:pointer;letter-spacing:.02em
        ">⟳ Rafraîchir / purger défense</button>
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
      `Purger l'ancienne défense de gang ?<br><span style="color:var(--text-dim);font-size:10px">La défense locale sera vidée et la défense publiée en ligne sera supprimée si le compte Supabase est connecté. Les stats de raids restent intactes.</span>`,
      () => {
        void (async () => {
          btn.disabled = true;
          btn.textContent = '…';
          await purgeLegacyDefenseData();
          await renderGangCompetitionTab();
          globalThis.updateTopBar?.();
        })();
      },
      { danger: true, confirmLabel: 'Purger', cancelLabel: 'Annuler' },
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
    " title="Slot Boss vide">+</div>`;
  }).join('');

  const manualAgentIds = _getManualDefenseAgentIds(comp);
  const displayedAgentIds = _getDisplayedDefenseAgentIds(s);
  const hasManualAgents = manualAgentIds.some(Boolean);
  const agentHtml = displayedAgentIds.map((id, i) => {
    const agent = id ? s.agents.find(a => a.id === id) : null;
    const agentDefaulted = !!agent && manualAgentIds[i] !== id;
    if (!agent) {
      return `<button class="comp-pick-agent" data-slot="${i}" style="width:100%;padding:7px;background:var(--bg);border:2px dashed var(--border);border-radius:var(--radius-sm);cursor:pointer;color:var(--text-dim);font-size:10px">+ Agent DEF ${i + 1}</button>`;
    }
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px;background:var(--bg);border:1px solid ${agentDefaulted ? 'var(--gold-dim)' : 'var(--border)'};border-radius:var(--radius-sm)">
      <img src="https://play.pokemonshowdown.com/sprites/gen5/${agent.spriteKey ?? ''}.png" style="width:32px;height:32px;image-rendering:pixelated" onerror="this.style.display='none'">
      <div style="flex:1;min-width:0">
        <div style="font-size:9px">${i + 1}. ${agent.name}</div>
        <div style="font-size:8px;color:var(--text-dim)">Lv.${agent.level} · ${agent.title} · ⚡${_fmtNum(_agentPower(agent, s))}${agentDefaulted ? ' · AUTO' : ''}</div>
      </div>
      <button class="comp-pick-agent" data-slot="${i}" style="background:none;border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer;font-size:8px;padding:3px 6px">Changer</button>
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
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:10px">🛡 MA DÉFENSE</div>
      ${!hasManualAgents ? `<div style="font-size:8px;color:var(--gold-dim);margin-bottom:10px">AUTO · Les agents DEF les plus forts remplacent les slots vides.</div>` : ''}

      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">Équipe Boss (${PVP_BOSS_TEAM_SLOTS} Pokémon)</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${teamSlots}</div>
      ${!hasBossTeam ? `<div style="font-size:8px;color:var(--red);margin-top:-6px;margin-bottom:12px">Aucun Pokémon dans l'équipe Boss.</div>` : ''}

      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">Agents défenseurs (${PVP_AGENT_SLOTS} slots + Boss)</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">${agentHtml}</div>

      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">Zone d'arène</div>
      <select id="comp-zone-select" style="width:100%;padding:6px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:9px;margin-bottom:12px">
        <option value="">— Choisir une zone —</option>
        ${zoneOptions}
      </select>

      <button id="comp-publish-btn" style="
        width:100%;padding:9px;background:var(--red);border:none;border-radius:var(--radius-sm);
        color:#fff;font-family:var(--font-pixel);font-size:8px;cursor:pointer;letter-spacing:.04em
      ">${comp.defensePublished ? '🔄 Mettre à jour la défense' : (hasManualAgents ? '📡 Publier la défense' : '📡 Publier la base')}</button>
      ${comp.defensePublished ? `<div style="font-size:8px;color:var(--green);text-align:center;margin-top:5px">✓ Défense en ligne</div>` : ''}
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
      btn.textContent = hasManualAgents ? '📡 Publier la défense' : '📡 Publier la base';
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
        <div>✅ Victoire raid : <b>or uniquement</b>, aucune réputation volée</div>
        <div>💰 Butin : base <b>${pct}% rép. adverse × ${_fmtNum(RAID_GOLD_PER_REP)} ₽</b>, max ${_fmtNum(RAID_GOLD_MAX)} ₽</div>
        <div>❌ Défaite raid : <b>-${_fmtNum(RAID_PENALTY)} ₽</b> ${RAID_NO_DEFENSE_PENALTY_MULT > 1 ? '(×2 auto/vide)' : ''}</div>
        <div>⚠️ Défense auto/vide : <b>malus ×${RAID_NO_DEFENSE_PENALTY_MULT}</b> pour le perdant</div>
        <div>🛡 Défense réussie : <b>+${_fmtNum(RAID_PENALTY)} ₽</b> ${RAID_NO_DEFENSE_PENALTY_MULT > 1 ? '(×2 auto/vide)' : ''}</div>
        <div>⭐ Réputation PvP : <b>inchangée</b> côté attaquant et défenseur</div>
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
        : `<span style="color:var(--gold-dim)">Rép. intacte</span>`;
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

    const defensePokemons = (g.defense_pokemon ?? []).filter(Boolean);
    const defenseAgents = _defenseAgentsFromData(g);
    const noDefense = defensePokemons.length === 0 && defenseAgents.length === 0;
    const defaultDefense = noDefense || defenseAgents.some(a => a.defaulted);
    const preview = getRaidPreview(g);
    const miniPokemons = defensePokemons.length
      ? defensePokemons.slice(0, PVP_BOSS_TEAM_SLOTS).map(p =>
      `<img src="${pokeSprite(p.species_en, p.shiny)}" style="width:24px;height:24px;image-rendering:pixelated" title="${p.species_en} Lv.${p.level}">`
      ).join('')
      : `<span style="font-size:8px;color:${noDefense ? 'var(--red)' : 'var(--text-dim)'}">${noDefense ? 'Sans défense' : 'Aucune équipe'}</span>`;

    const powerInfo = `<span style="font-size:8px;color:var(--gold-dim)">🛡 ${_fmtNum(preview.defenderPower)}</span>`;

    const agentInfo = defenseAgents.length
      ? `<span style="font-size:8px;color:var(--text-dim)">🧑‍✈️ ${defenseAgents.map(a => `${a.name} Lv.${a.level}${a.defaulted ? ' AUTO' : ''}`).join(' · ')}</span>`
      : '';

    const zoneInfo = g.defense_zone
      ? `<span style="font-size:8px;color:var(--text-dim)">🗺 ${g.defense_zone}</span>`
      : '';

    const noDefenseInfo = defaultDefense
      ? `<span style="font-size:8px;color:var(--red)">⚠ malus ×${RAID_NO_DEFENSE_PENALTY_MULT} si vaincu</span>`
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
  if (rep >= 500_000) return 'Seigneur des Ombres';
  if (rep >= 100_000) return 'Grand Parrain';
  if (rep >= 50_000)  return 'Caïd de la Région';
  if (rep >= 20_000)  return 'Chef Redouté';
  if (rep >= 5_000)   return 'Chef de Quartier';
  if (rep >= 1_000)   return 'Aspirant Chef';
  return 'Recrue';
}

function _hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const _BOSS_TAUNTS = [
  'Vous osez défier notre gang ?!',
  'Personne ne nous a jamais résisté.',
  'Vous regretterez d\'être venus ici.',
  'Notre territoire ne se négocie pas.',
  'Préparez-vous à être anéantis !',
  'Vous n\'avez aucune chance contre nous.',
  'On a vu des plus forts que vous tomber.',
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
    const matchupLabel = preview.defenderPower <= 0 ? 'Base vulnérable' : ratio >= 1.15 ? 'Avantage' : ratio >= 0.85 ? 'Équilibré' : 'Risque';
    const matchupColor = preview.defenderPower <= 0 || ratio >= 1.15 ? 'var(--green)' : ratio >= 0.85 ? 'var(--gold)' : 'var(--red)';
    const goldCap = preview.goldOnWin >= RAID_GOLD_MAX ? ' · plafond' : '';
    const defBossEl = defData.boss_sprite
      ? `<img src="https://play.pokemonshowdown.com/sprites/gen5/${defData.boss_sprite}.png" style="width:40px;height:40px;image-rendering:pixelated" onerror="this.style.display='none'">`
      : `<div style="width:40px;height:40px;background:var(--bg);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:20px">👤</div>`;

    const agentRows = agents.map(a => {
      const sel      = selectedIds.has(a.id);
      const disabled = !sel && selectedIds.size >= PVP_AGENT_SLOTS;
      const ap       = _agentPower(a, s);
      return `<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;cursor:${disabled ? 'not-allowed' : 'pointer'};border-bottom:1px solid var(--border);opacity:${disabled ? '.4' : '1'}">
        <input type="checkbox" data-agent-id="${a.id}" ${sel ? 'checked' : ''} ${disabled ? 'disabled' : ''} style="accent-color:var(--red);flex-shrink:0">
        <img src="https://play.pokemonshowdown.com/sprites/gen5/${a.spriteKey ?? ''}.png" style="width:28px;height:28px;image-rendering:pixelated" onerror="this.style.display='none'">
        <div style="flex:1;min-width:0">
          <div style="font-size:9px">${a.name}</div>
          <div style="font-size:8px;color:var(--text-dim)">Lv.${a.level} · ${a.title} · ⚡${_fmtNum(ap)}</div>
        </div>
        ${sel ? '<span style="font-size:16px">✓</span>' : ''}
      </label>`;
    }).join('');

    return `<div style="background:var(--bg-panel);border:2px solid var(--red);border-radius:var(--radius);padding:20px;max-width:400px;width:94%;display:flex;flex-direction:column;gap:14px;font-family:var(--font-pixel);max-height:88vh;overflow-y:auto">
      <div style="font-size:11px;color:var(--red)">⚔️ PRÉPARER LE RAID</div>

      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg);border-radius:var(--radius-sm);border:1px solid var(--border)">
        ${defBossEl}
        <div>
          <div style="font-size:9px;color:var(--gold)">${defData.gang_name}</div>
          <div style="font-size:8px;color:var(--text-dim)">${defData.boss_name} · ⭐ ${_fmtNum(defData.reputation_snapshot)} rép.</div>
        </div>
      </div>

      <div>
        <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">AGENTS D'ATTAQUE &nbsp;<span style="color:${selectedIds.size === PVP_AGENT_SLOTS ? 'var(--gold)' : 'var(--text-dim)'}">${selectedIds.size}/${PVP_AGENT_SLOTS} sélectionnés</span></div>
        <div style="border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;max-height:200px;overflow-y:auto">
          ${agents.length
            ? agentRows
            : '<div style="padding:12px;font-size:9px;color:var(--text-dim)">Aucun agent recruté. Les agents DEF adverses bloqueront le raid.</div>'}
        </div>
        ${fallbackAgent ? `<div style="font-size:8px;color:var(--gold-dim);margin-top:6px">AUTO · ${fallbackAgent.name} entre en jeu si aucun agent n'est sélectionné.</div>` : ''}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center;padding:8px 10px;background:var(--bg);border-radius:var(--radius-sm)">
        <div>
          <div style="font-size:8px;color:var(--text-dim)">Attaque</div>
          <div style="font-size:10px;color:var(--gold)">⚡ ${_fmtNum(power)}</div>
        </div>
        <div>
          <div style="font-size:8px;color:var(--text-dim)">Défense</div>
          <div style="font-size:10px;color:var(--gold-dim)">🛡 ${_fmtNum(preview.defenderPower)}</div>
        </div>
        <div style="font-size:9px;color:${matchupColor};text-align:right">${matchupLabel}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:8px;color:var(--text-dim)">
        <div style="background:rgba(76,175,80,.08);border:1px solid rgba(76,175,80,.25);border-radius:var(--radius-sm);padding:8px">
          <div style="color:var(--green);margin-bottom:3px">Victoire</div>
          <div>+${_fmtNum(preview.goldOnWin)} ₽${goldCap}</div>
          <div>Réputation inchangée</div>
        </div>
        <div style="background:rgba(244,67,54,.08);border:1px solid rgba(244,67,54,.25);border-radius:var(--radius-sm);padding:8px">
          <div style="color:var(--red);margin-bottom:3px">Défaite</div>
          <div>-${_fmtNum(preview.moneyPenaltyOnLoss)} ₽</div>
          <div>${preview.defaultDefense ? `malus ×${RAID_NO_DEFENSE_PENALTY_MULT}` : 'défense manuelle'}</div>
        </div>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="raidPrepCancel" style="font-size:9px;padding:8px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
        <button id="raidPrepLaunch" style="font-size:9px;padding:8px 18px;background:var(--red);border:none;border-radius:var(--radius-sm);color:#fff;cursor:pointer">⚔️ Lancer le raid</button>
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
          globalThis.updateTopBar?.();
          _loadAndRenderGangs(panelEl);
        });
      } else {
        globalThis.updateTopBar?.();
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
  const myGangName      = s.gang.name       ?? 'Notre Gang';
  const defBossSprite   = defData.boss_sprite ?? '';
  const defBossName     = defData.boss_name   ?? 'Boss';
  const defGangName     = defData.gang_name   ?? 'Gang Adverse';
  const defBossTitle    = defData.boss_title  ?? _repTitle(defData.reputation_snapshot ?? 0);
  const defPokemons     = (defData.defense_pokemon ?? []).filter(Boolean);
  const defAgents       = _defenseAgentsFromData(defData);
  const effectiveAgentIds = _effectiveAttackAgentIds(agentIds, s);
  const selectedAgents  = effectiveAgentIds.map(id => s.agents?.find(a => a.id === id)).filter(Boolean);

  const taunt = _BOSS_TAUNTS[_hashStr(defBossName) % _BOSS_TAUNTS.length];

  // Taglines narratives
  const taglines = [];
  if (selectedAgents.length > 0) {
    taglines.push(`${selectedAgents.map(a => a.name).join(', ')} se positionnent...`);
  } else {
    taglines.push('La gang avance vers la base ennemie...');
  }
  taglines.push(`La gang ${defGangName} active sa défense !`);
  if (defAgents.length > 0) {
    taglines.push(`${defAgents.length} agent${defAgents.length > 1 ? 's' : ''} DEF barrent la route.`);
  }
  if (result.noDefense) {
    taglines.push('⚠ La base adverse est sans défense !');
  } else if (result.defaultDefense) {
    taglines.push('La défense automatique se déclenche...');
  }
  taglines.push(`Puissance attaque : ⚡ ${_fmtNum(result.attackerPower)}`);
  taglines.push(`Puissance défense : 🛡 ${_fmtNum(result.defenderPower)}`);
  for (const duel of (result.duels || [])) {
    taglines.push(`${duel.attacker.name} affronte ${duel.defender.name} (${_fmtNum(duel.attackerPower)} vs ${_fmtNum(duel.defenderPower)})`);
    taglines.push(duel.attackerWin ? `${duel.defender.name} tombe.` : `${duel.attacker.name} est hors combat.`);
  }
  if (result.finalBattle?.skipped) {
    taglines.push('Tous les agents du raid sont neutralisés avant le Boss.');
  } else if (result.finalBattle) {
    if (defPokemons.length > 0) {
      const pk     = defPokemons[0];
      const pkName = globalThis.speciesName?.(pk.species_en) ?? pk.species_en;
      taglines.push(`${defBossName} engage son équipe Boss avec ${pkName}.`);
    }
    taglines.push(`Combat final Boss : ⚡ ${_fmtNum(result.finalBattle.attackerPower)} vs 🛡 ${_fmtNum(result.finalBattle.defenderPower)}`);
  }
  if (result.attackerWin) {
    taglines.push('— VICTOIRE ! —');
    if (result.defaultDefense && RAID_NO_DEFENSE_PENALTY_MULT > 1) taglines.push(`Bonus ×${RAID_NO_DEFENSE_PENALTY_MULT} (défense auto)`);
    taglines.push(`+${_fmtNum(result.goldWon)} ₽`);
    taglines.push('Réputation inchangée.');
  } else {
    taglines.push('— DÉFAITE... —');
    taglines.push(`-${_fmtNum(result.moneyPenalty)} ₽`);
    taglines.push('Réputation inchangée.');
  }

  const overlay = document.createElement('div');
  overlay.id = 'raid-cinematic';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:7000;background:#08080f;display:flex;flex-direction:column;align-items:center;overflow-y:auto';

  overlay.innerHTML = `
    <div style="width:100%;max-width:580px;padding:28px 20px;display:flex;flex-direction:column;gap:20px">

      <!-- Header -->
      <div style="font-family:var(--font-pixel);font-size:8px;color:var(--red);text-align:center;letter-spacing:.18em">⚔ RAID EN COURS ⚔</div>

      <!-- Boss intro -->
      <div style="display:flex;gap:14px;align-items:flex-start">
        <div style="flex-shrink:0;text-align:center">
          ${defBossSprite
            ? `<img src="https://play.pokemonshowdown.com/sprites/gen5/${defBossSprite}.png" style="width:72px;height:72px;image-rendering:pixelated" onerror="this.style.display='none'">`
            : `<div style="width:72px;height:72px;background:var(--bg-panel);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:26px">👤</div>`}
          <div style="font-size:7px;color:var(--text-dim);margin-top:3px;font-family:var(--font-pixel)">${defBossName}</div>
        </div>
        <div style="flex:1;background:#0d1119;border:2px solid var(--red);border-radius:8px;border-top-left-radius:2px;padding:12px;position:relative">
          <div style="position:absolute;left:-10px;top:16px;width:0;height:0;border-top:7px solid transparent;border-bottom:7px solid transparent;border-right:10px solid var(--red)"></div>
          <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:3px">${defBossName}</div>
          <div style="font-size:8px;color:var(--text-dim);margin-bottom:8px">${defBossTitle} · Chef de ${defGangName}</div>
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
          <div style="font-size:7px;color:var(--text-dim);font-family:var(--font-pixel);letter-spacing:.06em">VOTRE GANG</div>
          <div style="display:flex;gap:3px;flex-wrap:wrap;justify-content:center;max-width:150px">
            ${myBossSprite
              ? `<img src="https://play.pokemonshowdown.com/sprites/gen5/${myBossSprite}.png" style="width:38px;height:38px;image-rendering:pixelated" onerror="this.style.display='none'" title="${myBossName}">`
              : `<div style="width:38px;height:38px;background:var(--bg-panel);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:16px">👤</div>`}
            ${selectedAgents.map(a =>
              `<img src="https://play.pokemonshowdown.com/sprites/gen5/${a.spriteKey ?? ''}.png" style="width:30px;height:30px;image-rendering:pixelated" onerror="this.style.display='none'" title="${a.name}">`
            ).join('')}
          </div>
          <div style="font-size:7px;color:var(--text-dim)">${myGangName}</div>
        </div>

        <div style="font-family:var(--font-pixel);font-size:12px;color:rgba(255,255,255,.2);align-self:center">⚔</div>

        <!-- Defender side -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;min-width:120px">
          <div style="font-size:7px;color:var(--text-dim);font-family:var(--font-pixel);letter-spacing:.06em">DÉFENSE ADVERSE</div>
          <div style="display:flex;gap:3px;flex-wrap:wrap;justify-content:center;max-width:150px">
            ${defPokemons.length > 0
              ? defPokemons.slice(0, PVP_BOSS_TEAM_SLOTS).map(p =>
                  `<img src="${pokeSprite(p.species_en, p.shiny)}" style="width:30px;height:30px;image-rendering:pixelated" title="${p.species_en}">`
                ).join('')
              : `<span style="font-size:8px;color:var(--red)">${defAgents.length ? 'Boss sans équipe' : 'Base vide'}</span>`}
            ${defAgents.map(a =>
              `<img src="https://play.pokemonshowdown.com/sprites/gen5/${a.sprite ?? ''}.png" style="width:30px;height:30px;image-rendering:pixelated" onerror="this.style.display='none'" title="${a.name}">`
            ).join('')}
          </div>
          <div style="font-size:7px;color:var(--text-dim)">${defGangName}</div>
        </div>
      </div>

      <!-- Combat log -->
      <div id="cine-log" style="background:#050508;border:1px solid rgba(255,255,255,.08);border-radius:var(--radius-sm);padding:10px 12px;min-height:72px;display:flex;flex-direction:column;gap:3px;font-family:var(--font-pixel);font-size:9px"></div>

      <!-- Result (hidden until log ends) -->
      <div id="cine-result" style="display:none;text-align:center;padding:18px;background:${result.attackerWin ? 'rgba(76,175,80,.1)' : 'rgba(244,67,54,.1)'};border:2px solid ${result.attackerWin ? 'var(--green)' : 'var(--red)'};border-radius:var(--radius)">
        <div style="font-family:var(--font-pixel);font-size:18px;color:${result.attackerWin ? 'var(--green)' : 'var(--red)'}">
          ${result.attackerWin ? '✅ VICTOIRE !' : '❌ DÉFAITE'}
        </div>
        <div style="font-size:10px;color:var(--text-dim);margin-top:6px">
          ${result.attackerWin
            ? `+${_fmtNum(result.goldWon)} ₽ · réputation inchangée`
            : `-${_fmtNum(result.moneyPenalty)} ₽ · réputation inchangée`}
        </div>
        <button id="cine-continue" style="margin-top:14px;padding:10px 30px;background:${result.attackerWin ? 'var(--green)' : 'var(--red)'};border:none;border-radius:var(--radius-sm);color:#fff;font-family:var(--font-pixel);font-size:9px;cursor:pointer">Continuer →</button>
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

  if (!agents.length) { notify('Aucun agent recruté.', 'error'); return; }

  const rows = agents.map(a => {
    const disabled = usedElsewhere.has(a.id);
    return `<div class="comp-ap-row" data-id="${a.id}" style="
      display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:${disabled ? 'not-allowed' : 'pointer'};border-bottom:1px solid var(--border);opacity:${disabled ? '.45' : '1'}
    ">
      <img src="https://play.pokemonshowdown.com/sprites/gen5/${a.spriteKey ?? ''}.png" style="width:32px;height:32px;image-rendering:pixelated" onerror="this.style.display='none'">
      <div style="flex:1;min-width:0">
        <div style="font-size:9px">${a.name}</div>
        <div style="font-size:8px;color:var(--text-dim)">Lv.${a.level} · ${a.title} · Combat ${a.stats?.combat ?? 0}</div>
      </div>
      ${disabled ? '<span style="font-size:8px;color:var(--red)">Déjà en DEF</span>' : ''}
    </div>`;
  }).join('');

  const modal = document.createElement('div');
  modal.id = 'comp-agent-picker-modal';
  modal.style.cssText = `position:fixed;inset:0;z-index:5000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6)`;
  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);width:320px;max-height:60vh;display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;padding:12px 14px;border-bottom:1px solid var(--border)">
        <span style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">Slot DEF ${slotIndex + 1} — Choisir un agent</span>
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
