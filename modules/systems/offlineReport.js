// ════════════════════════════════════════════════════════════════
//  OFFLINE REPORT
//  Collecte ce qui se passe pendant l'absence (tab hidden) et
//  affiche un "Rapport de Mission" au retour.
//
//  Principe :
//    1. Au retour de tab → startCollecting()
//    2. Les systèmes catchup poussent les événements via push*()
//    3. Au bout du catchup → stopCollecting() retourne le rapport
//    4. Si la durée d'absence ≥ seuil utilisateur → showOfflineReportModal()
//
//  Seuils configurables : state.settings.offlineReportThreshold (s)
//    0    = jamais
//    60   = 1 min
//    300  = 5 min (défaut)
//    900  = 15 min
//    1800 = 30 min
//    3600 = 1 h
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY, { msg, type });

// ── Catégorisation d'importance pour le tri ──────────────────────
const _RARITY_ORDER = {
  shiny:      0, // chaque shiny = ligne individuelle (clé virtuelle)
  legendary:  1,
  very_rare:  2,
  rare:       3,
  uncommon:   4,
  common:     5,
};

// ── Collecteur (singleton) ───────────────────────────────────────
let _collector = null;

function _newCollector() {
  return {
    startedAt:    Date.now(),
    absentSince:  null,        // timestamp de départ d'absence (fourni par caller)
    captures:     [],          // { species_en, shiny, potential, rarity, byAgent }
    combats:      { won: 0, lost: 0, totalReward: 0 },
    chests:       0,
    moneyDelta:   0,           // gain net argent (captures + chests + combats)
    itemsDelta:   {},          // { pokeball: +N, greatball: +N, ... }
    eggsReady:    0,           // œufs incubés prêts à éclore
    trainingTicks:0,           // ticks de salle d'entraînement appliqués
    xpTicks:      0,           // ticks de XP passive appliqués
    levelUps:     [],          // [{ name, species_en, fromLvl, toLvl }]
  };
}

export function startCollecting(absentSince = null) {
  _collector = _newCollector();
  if (absentSince) _collector.absentSince = absentSince;
}

export function stopCollecting() {
  const report = _collector;
  _collector = null;
  return report;
}

export function isCollecting() {
  return _collector !== null;
}

// ── Helpers de push (no-op si pas de collector actif) ────────────

export function pushCapture(data) {
  if (!_collector) return;
  _collector.captures.push({
    species_en: data.species_en,
    shiny:      !!data.shiny,
    potential:  data.potential ?? 1,
    rarity:     data.rarity ?? 'common',
    byAgent:    data.byAgent ?? '',
  });
}

export function pushCombat(won, reward = 0) {
  if (!_collector) return;
  if (won) _collector.combats.won++;
  else     _collector.combats.lost++;
  if (reward) _collector.combats.totalReward += reward;
}

export function pushChest() {
  if (!_collector) return;
  _collector.chests++;
}

export function pushMoney(delta) {
  if (!_collector || !delta) return;
  _collector.moneyDelta += delta;
}

export function pushItems(itemsObj) {
  if (!_collector || !itemsObj) return;
  for (const [k, v] of Object.entries(itemsObj)) {
    if (!v) continue;
    _collector.itemsDelta[k] = (_collector.itemsDelta[k] || 0) + v;
  }
}

export function pushPensionResult({ eggsReady = 0 } = {}) {
  if (!_collector) return;
  _collector.eggsReady += eggsReady;
}

export function pushTrainingTicks(n) {
  if (!_collector || !n) return;
  _collector.trainingTicks += n;
}

export function pushXPTicks(n) {
  if (!_collector || !n) return;
  _collector.xpTicks += n;
}

export function pushLevelUp(data) {
  if (!_collector) return;
  _collector.levelUps.push(data);
}

// ── Utilitaires de mise en forme ─────────────────────────────────

function _formatDuration(ms) {
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 1)  return 'moins d\'1 min';
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

/**
 * Groupe les captures par espèce SAUF les shinies (chaque shiny reste seul).
 * Retourne un tableau trié par importance.
 */
function _groupCaptures(captures) {
  const groups = [];
  const grouped = new Map(); // species_en → { ...fields, count, maxPotential }

  for (const cap of captures) {
    if (cap.shiny) {
      // Chaque shiny = entrée individuelle
      groups.push({ ...cap, count: 1, _sortKey: _RARITY_ORDER.shiny });
      continue;
    }
    const existing = grouped.get(cap.species_en);
    if (existing) {
      existing.count++;
      existing.maxPotential = Math.max(existing.maxPotential, cap.potential);
    } else {
      const g = {
        species_en:   cap.species_en,
        shiny:        false,
        rarity:       cap.rarity,
        count:        1,
        maxPotential: cap.potential,
        _sortKey:     _RARITY_ORDER[cap.rarity] ?? _RARITY_ORDER.common,
      };
      grouped.set(cap.species_en, g);
      groups.push(g);
    }
  }

  // Tri par importance, puis par count décroissant pour les communs
  groups.sort((a, b) => {
    if (a._sortKey !== b._sortKey) return a._sortKey - b._sortKey;
    return (b.count || 1) - (a.count || 1);
  });

  return groups;
}

// ── Seuil utilisateur ────────────────────────────────────────────

const _THRESHOLD_DEFAULT = 300; // 5 min

/** Retourne le seuil (en secondes) en dessous duquel on n'affiche pas le rapport. */
export function getReportThreshold() {
  const state = globalThis.state;
  const v = state?.settings?.offlineReportThreshold;
  if (typeof v !== 'number') return _THRESHOLD_DEFAULT;
  return Math.max(0, v);
}

/** Indique si le rapport doit être affiché compte tenu du seuil et du contenu. */
export function shouldShowReport(report) {
  if (!report) return false;
  const threshold = getReportThreshold();
  if (threshold === 0) return false; // utilisateur a désactivé

  const absent = report.absentSince ? Date.now() - report.absentSince : 0;
  if (absent < threshold * 1000) return false;

  // Pas de contenu pertinent → skip
  const hasContent =
    report.captures.length > 0 ||
    report.combats.won + report.combats.lost > 0 ||
    report.chests > 0 ||
    report.eggsReady > 0 ||
    report.trainingTicks > 0 ||
    Math.abs(report.moneyDelta) > 0 ||
    Object.keys(report.itemsDelta).length > 0;

  return hasContent;
}

// ── Rendu du modal ───────────────────────────────────────────────

const _MODAL_ID = 'offlineReportModal';

export function showOfflineReportModal(report) {
  // Évite double affichage
  document.getElementById(_MODAL_ID)?.remove();

  const overlay = document.createElement('div');
  overlay.id = _MODAL_ID;
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9998;
    background:rgba(0,0,0,.86);
    display:flex;align-items:center;justify-content:center;
    backdrop-filter:blur(2px);
  `;

  overlay.innerHTML = _buildReportHTML(report);

  document.body.appendChild(overlay);

  // Close handlers
  overlay.querySelector('#orClose')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function _buildReportHTML(report) {
  const absentMs = report.absentSince ? Date.now() - report.absentSince : 0;
  const durationStr = _formatDuration(absentMs);

  return `
    <div style="background:var(--bg-panel);border:2px solid var(--red);border-radius:var(--radius);
                max-width:580px;width:94%;max-height:88vh;overflow-y:auto;
                box-shadow:0 0 32px rgba(204,17,17,.35);display:flex;flex-direction:column">
      ${_headerHTML(durationStr)}
      <div style="padding:16px 20px;display:flex;flex-direction:column;gap:14px">
        ${_captureSectionHTML(report.captures)}
        ${_combatSectionHTML(report.combats)}
        ${_economySectionHTML(report)}
        ${_pensionTrainingSectionHTML(report)}
      </div>
      ${_footerHTML()}
    </div>
  `;
}

function _headerHTML(durationStr) {
  return `
    <div style="padding:18px 20px;border-bottom:1px solid var(--border);text-align:center">
      <div style="font-family:var(--font-pixel);font-size:11px;color:var(--red);letter-spacing:2px;margin-bottom:6px">
        ▶ RAPPORT DE MISSION ◀
      </div>
      <div style="font-size:10px;color:var(--text-dim)">
        Absent · <span style="color:var(--gold);font-family:var(--font-pixel)">${durationStr}</span>
      </div>
    </div>
  `;
}

function _captureSectionHTML(captures) {
  if (!captures.length) return '';
  const groups = _groupCaptures(captures);
  const shinies   = groups.filter(g => g.shiny).length;
  const totalCaps = captures.length;

  const lines = groups.slice(0, 30).map(g => {
    const name   = globalThis.speciesName?.(g.species_en) ?? g.species_en;
    const sprite = globalThis.pokeSprite?.(g.species_en, g.shiny);
    const stars  = '★'.repeat(g.maxPotential || g.potential || 1);
    const tag    = g.shiny
      ? '<span style="color:var(--gold);font-family:var(--font-pixel);font-size:7px">✨ SHINY</span>'
      : g.rarity === 'legendary' ? '<span style="color:var(--gold);font-family:var(--font-pixel);font-size:7px">🏆 LÉGEND.</span>'
      : g.rarity === 'very_rare' ? '<span style="color:#a4d8ff;font-family:var(--font-pixel);font-size:7px">⭐ T.RARE</span>'
      : '';
    const countBadge = g.count > 1
      ? `<span style="color:var(--text);font-family:var(--font-pixel);font-size:9px;margin-left:auto">×${g.count}</span>`
      : '';

    return `
      <div style="display:flex;align-items:center;gap:10px;padding:5px 8px;background:rgba(0,0,0,.25);border-radius:var(--radius-sm)">
        ${sprite ? `<img src="${sprite}" style="width:32px;height:32px;image-rendering:pixelated">` : '<div style="width:32px;height:32px"></div>'}
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${name} <span style="color:var(--gold);font-size:8px">${stars}</span>
          </div>
          ${tag}
        </div>
        ${countBadge}
      </div>
    `;
  }).join('');

  const more = groups.length > 30
    ? `<div style="text-align:center;font-size:8px;color:var(--text-dim);padding:4px">… +${groups.length - 30} entrées</div>`
    : '';

  return `
    <div>
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px">
        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--red);letter-spacing:1px">CAPTURES</div>
        <div style="font-size:9px;color:var(--text-dim)">${totalCaps} pokémon${totalCaps > 1 ? 's' : ''}${shinies > 0 ? ` · <span style="color:var(--gold)">${shinies} ✨</span>` : ''}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px">${lines}${more}</div>
    </div>
  `;
}

function _combatSectionHTML(combats) {
  const total = combats.won + combats.lost;
  if (total === 0) return '';
  return `
    <div>
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--red);letter-spacing:1px;margin-bottom:6px">COMBATS</div>
      <div style="display:flex;gap:14px;font-size:10px;color:var(--text);background:rgba(0,0,0,.25);padding:8px 10px;border-radius:var(--radius-sm)">
        <span>✅ <b style="color:#7ec87e">${combats.won}</b> victoires</span>
        <span>❌ <b style="color:#cc6666">${combats.lost}</b> défaites</span>
        ${combats.totalReward > 0 ? `<span style="margin-left:auto;color:var(--gold)">+${combats.totalReward.toLocaleString()}₽</span>` : ''}
      </div>
    </div>
  `;
}

function _economySectionHTML(report) {
  const lines = [];
  if (report.moneyDelta) {
    const color = report.moneyDelta > 0 ? 'var(--gold)' : '#cc6666';
    lines.push(`<span style="color:${color}">${report.moneyDelta > 0 ? '+' : ''}${report.moneyDelta.toLocaleString()}₽</span>`);
  }
  if (report.chests > 0) lines.push(`<span>📦 ${report.chests} coffre${report.chests > 1 ? 's' : ''}</span>`);

  const itemKeys = Object.keys(report.itemsDelta);
  if (itemKeys.length > 0) {
    for (const k of itemKeys) {
      const v = report.itemsDelta[k];
      if (!v) continue;
      const label = globalThis.BALLS?.[k]?.fr ?? k;
      lines.push(`<span>${v > 0 ? '+' : ''}${v} ${label}</span>`);
    }
  }

  if (lines.length === 0) return '';

  return `
    <div>
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--red);letter-spacing:1px;margin-bottom:6px">ÉCONOMIE</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:10px;color:var(--text);background:rgba(0,0,0,.25);padding:8px 10px;border-radius:var(--radius-sm)">
        ${lines.join('')}
      </div>
    </div>
  `;
}

function _pensionTrainingSectionHTML(report) {
  const parts = [];
  if (report.eggsReady > 0)     parts.push(`🥚 <b>${report.eggsReady}</b> œuf${report.eggsReady > 1 ? 's' : ''} prêt${report.eggsReady > 1 ? 's' : ''}`);
  if (report.trainingTicks > 0) parts.push(`🎯 <b>${report.trainingTicks}</b> entraînement${report.trainingTicks > 1 ? 's' : ''}`);
  if (report.xpTicks > 0)       parts.push(`📈 <b>${report.xpTicks}</b> ticks XP`);
  if (report.levelUps?.length > 0) parts.push(`⬆ <b>${report.levelUps.length}</b> level-up${report.levelUps.length > 1 ? 's' : ''}`);

  if (parts.length === 0) return '';
  return `
    <div>
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--red);letter-spacing:1px;margin-bottom:6px">PENSION & FORMATION</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:10px;color:var(--text);background:rgba(0,0,0,.25);padding:8px 10px;border-radius:var(--radius-sm)">
        ${parts.join('<span style="color:var(--text-dim)"> · </span>')}
      </div>
    </div>
  `;
}

function _footerHTML() {
  return `
    <div style="padding:14px 20px;border-top:1px solid var(--border);display:flex;justify-content:center">
      <button id="orClose" style="
        font-family:var(--font-pixel);font-size:9px;letter-spacing:1px;
        padding:8px 20px;background:var(--bg);color:var(--red);
        border:1px solid var(--red);border-radius:var(--radius-sm);
        cursor:pointer">
        FERMER
      </button>
    </div>
  `;
}

// ── Orchestrateur visibilitychange ───────────────────────────────
// Centralise le rattrapage offline : pension + training + XP passif + zones.
// Capture tout via le collector, puis affiche un seul rapport au lieu de N notifs.

let _hiddenSince = null;

function _onVisibilityChange() {
  if (document.hidden) {
    _hiddenSince = Date.now();
    // Stopper immédiatement tous les setInterval de zone → zéro CPU en background.
    // _pauseAllZoneTimers enregistre hiddenSince par zone pour le catchup au retour.
    globalThis._pauseAllZoneTimers?.();
    return;
  }
  // Tab redevient visible
  const absentSince = _hiddenSince ?? null;
  _hiddenSince = null;

  // Relancer les timers de zone avant le catchup (syncActiveZones repart proprement)
  globalThis._resumeAllZoneTimers?.();

  // Si on n'a jamais vu le tab partir hidden (1er focus du jour), inutile de catchup
  if (!absentSince) return;

  // Petit délai pour laisser le state être prêt
  setTimeout(() => _runCatchupAndReport(absentSince), 200);
}

function _runCatchupAndReport(absentSince) {
  try {
    startCollecting(absentSince);

    // 1. Pension / training / XP passif (state-based, lit _savedAt)
    globalThis.applyOfflineCatchup?.({ silent: true });

    // 2. Captures de zone batch (lit _zoneHiddenSince par zone)
    globalThis._catchupHiddenZones?.();

    const report = stopCollecting();

    if (shouldShowReport(report)) {
      showOfflineReportModal(report);
    }
  } catch (e) {
    console.warn('[OfflineReport] catchup orchestration failed:', e);
    // S'assurer que le collector ne reste pas actif si exception
    stopCollecting();
  }
}

document.addEventListener('visibilitychange', _onVisibilityChange);

// ── Exposition pour les autres modules ───────────────────────────
globalThis.OfflineReport = {
  startCollecting,
  stopCollecting,
  isCollecting,
  pushCapture,
  pushCombat,
  pushChest,
  pushMoney,
  pushItems,
  pushPensionResult,
  pushTrainingTicks,
  pushXPTicks,
  pushLevelUp,
  getReportThreshold,
  shouldShowReport,
  showOfflineReportModal,
};
