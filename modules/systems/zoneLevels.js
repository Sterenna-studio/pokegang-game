// ════════════════════════════════════════════════════════════════
//  ZONE LEVELS MODULE (v2 alpha)
//  Gestion des niveaux de zone, XP et événements de zone.
//  Dual version : fonctionne en superposition de zones-data.js.
// ════════════════════════════════════════════════════════════════
//
//  Globals lus via globalThis :
//    state, initZone, notify, saveState, SFX, activeTab
//    renderZonesTab, addBattleLogEntry
//
//  Classic-script globals (bare name) :
//    ZONES, ZONES_JOHTO, ZONE_BY_ID, ZONE_JOHTO_BY_ID

'use strict';

import {
  ZONE_LEVEL_XP_THRESHOLDS,
  ZONE_MAX_LEVEL,
  ZONE_XP_SOURCES,
  ZONE_LEVEL_BONUSES,
  ZONE_EVENT_INTERVAL_MS,
  ZONE_EVENT_DURATION_MS,
  ZONE_EVENT_POOLS,
  ZONE_EVENT_DEFINITIONS,
} from '../../data/zones-v2-config.js';

// ── Helpers internes ──────────────────────────────────────────

function _state()   { return globalThis.state; }
function _initZone(id) { return globalThis.initZone?.(id); }

/** Calcule le niveau correspondant à un XP cumulé. */
function _xpToLevel(totalXp) {
  for (let i = ZONE_LEVEL_XP_THRESHOLDS.length - 1; i >= 1; i--) {
    if (totalXp >= ZONE_LEVEL_XP_THRESHOLDS[i]) return Math.min(i + 1, ZONE_MAX_LEVEL);
  }
  return 1;
}

/** Progression 0–1 vers le prochain niveau. */
function _xpProgress(totalXp) {
  const level = _xpToLevel(totalXp);
  if (level >= ZONE_MAX_LEVEL) return 1;
  const prev = ZONE_LEVEL_XP_THRESHOLDS[level - 1] || 0;
  const next  = ZONE_LEVEL_XP_THRESHOLDS[level];
  return Math.min(1, (totalXp - prev) / (next - prev));
}

/** XP manquant pour le prochain niveau. */
function _xpToNext(totalXp) {
  const level = _xpToLevel(totalXp);
  if (level >= ZONE_MAX_LEVEL) return 0;
  return ZONE_LEVEL_XP_THRESHOLDS[level] - totalXp;
}

/** Nom de zone localisé (fr/en). */
function _zoneName(zoneId) {
  const lang = _state()?.lang || 'fr';
  const z = (typeof ZONE_BY_ID !== 'undefined' ? ZONE_BY_ID[zoneId] : null)
         ?? (typeof ZONE_JOHTO_BY_ID !== 'undefined' ? ZONE_JOHTO_BY_ID[zoneId] : null);
  return z ? (lang === 'fr' ? z.fr : z.en) : zoneId;
}

/** Définition statique d'une zone (depuis les globals classic-script). */
function _zonedef(zoneId) {
  return (typeof ZONE_BY_ID !== 'undefined' ? ZONE_BY_ID[zoneId] : null)
      ?? (typeof ZONE_JOHTO_BY_ID !== 'undefined' ? ZONE_JOHTO_BY_ID[zoneId] : null);
}

// ── API publique — niveaux ────────────────────────────────────

/** Niveau actuel d'une zone (1–10). */
function getZoneLevel(zoneId) {
  return _xpToLevel(_state()?.zones?.[zoneId]?.zoneXp || 0);
}

/** XP brut actuel d'une zone. */
function getZoneXP(zoneId) {
  return _state()?.zones?.[zoneId]?.zoneXp || 0;
}

/** Objet complet de progression XP d'une zone. */
function getZoneXPProgress(zoneId) {
  const xp = getZoneXP(zoneId);
  return {
    xp,
    level:    _xpToLevel(xp),
    progress: _xpProgress(xp),
    toNext:   _xpToNext(xp),
    maxLevel: ZONE_MAX_LEVEL,
  };
}

/** Bonus actifs pour le niveau de la zone. */
function getZoneLevelBonuses(zoneId) {
  return ZONE_LEVEL_BONUSES[getZoneLevel(zoneId)] || {};
}

/**
 * Ajoute de l'XP à une zone et gère les montées de niveau.
 * @param {string} zoneId
 * @param {string} source  — clé de ZONE_XP_SOURCES ('capture_common', 'combat_win', etc.)
 * @returns {boolean} true si montée de niveau
 */
function addZoneXP(zoneId, source) {
  if (!zoneId || zoneId === 'gang_park') return false;
  const amount = ZONE_XP_SOURCES[source] ?? 1;
  const z = _initZone(zoneId);
  if (!z) return false;

  const prevLevel = _xpToLevel(z.zoneXp || 0);
  z.zoneXp = (z.zoneXp || 0) + amount;
  const newLevel  = _xpToLevel(z.zoneXp);

  if (newLevel > prevLevel) {
    globalThis.notify?.(`📍 ${_zoneName(zoneId)} → Niveau ${newLevel} !`, 'gold');
    globalThis.SFX?.play('unlock');
    globalThis.addBattleLogEntry?.(`📍 Zone ${_zoneName(zoneId)} montée au niveau ${newLevel} !`);
    return true;
  }
  return false;
}

// ── API publique — événements ─────────────────────────────────

/**
 * Planifie le prochain événement pour une zone.
 * Délai aléatoire (min–max) réduit par le niveau de zone.
 */
function scheduleNextZoneEvent(zoneId) {
  const z = _initZone(zoneId);
  if (!z) return;
  const level     = getZoneLevel(zoneId);
  const reduction = Math.min(
    (level - 1) * ZONE_EVENT_INTERVAL_MS.levelReduction,
    ZONE_EVENT_INTERVAL_MS.max - ZONE_EVENT_INTERVAL_MS.min
  );
  const maxMs   = ZONE_EVENT_INTERVAL_MS.max - reduction;
  const minMs   = ZONE_EVENT_INTERVAL_MS.min;
  z.nextEventAt = Date.now() + minMs + Math.random() * (maxMs - minMs);
}

/** Tire un type d'événement aléatoire selon le type et le niveau de la zone. */
function rollZoneEvent(zoneId) {
  const zDef = _zonedef(zoneId);
  if (!zDef) return null;
  const pool    = ZONE_EVENT_POOLS[zDef.type] || ZONE_EVENT_POOLS.route;
  const level   = getZoneLevel(zoneId);
  const eligible = pool.filter(e => level >= e.minLevel);
  if (!eligible.length) return null;

  const total = eligible.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const entry of eligible) {
    r -= entry.weight;
    if (r <= 0) return entry.type;
  }
  return eligible[eligible.length - 1].type;
}

/**
 * Déclenche un événement de zone (appelé par tickZoneEvents).
 */
function triggerZoneEvent(zoneId) {
  const state = _state();
  const z = _initZone(zoneId);
  if (!z) return;

  // Vérifier qu'il y a au moins un agent sur la zone
  const hasAgent = state.agents?.some(a => a.assignedZone === zoneId);
  if (!hasAgent) { scheduleNextZoneEvent(zoneId); return; }

  const eventType = rollZoneEvent(zoneId);
  if (!eventType) { scheduleNextZoneEvent(zoneId); return; }

  const def = ZONE_EVENT_DEFINITIONS[eventType];
  if (!def) { scheduleNextZoneEvent(zoneId); return; }

  const durationMs = ZONE_EVENT_DURATION_MS[eventType];
  z.activeEvent = {
    type:      eventType,
    startedAt: Date.now(),
    endsAt:    durationMs ? Date.now() + durationMs : null,
    progress:  0,   // pour bounty_hunt : captures comptées
    resolved:  false,
  };

  scheduleNextZoneEvent(zoneId);

  const lang = state.lang === 'fr' ? 'fr' : 'en';
  globalThis.notify?.(`📍 ${_zoneName(zoneId)} — ${def[lang]} !`, 'gold');
  globalThis.SFX?.play('notify');
  globalThis.saveState?.();

  if (globalThis.activeTab === 'tabZones') globalThis.renderZonesTab?.();
}

/**
 * Résout l'événement actif d'une zone (appelé par le joueur ou les agents).
 * @returns {{ success: boolean, moneyGain: number, repGain: number, xpGain: number }}
 */
function resolveZoneEvent(zoneId) {
  const state = _state();
  const z = _initZone(zoneId);
  const event = z?.activeEvent;
  if (!event || event.resolved) return { success: false, moneyGain: 0, repGain: 0, xpGain: 0 };

  const def = ZONE_EVENT_DEFINITIONS[event.type];
  if (!def) return { success: false, moneyGain: 0, repGain: 0, xpGain: 0 };

  event.resolved = true;
  z.activeEvent  = null;

  const [monMin, monMax] = def.moneyReward || [0, 0];
  const moneyGain = monMin + Math.floor(Math.random() * Math.max(0, monMax - monMin));
  const repGain   = def.repReward  || 0;
  const xpGain    = def.xpReward   || 0;

  if (moneyGain) state.gang.money      += moneyGain;
  if (repGain)   state.gang.reputation += repGain;
  if (xpGain)    addZoneXP(zoneId, 'event_complete');
  state.stats.eventsCompleted = (state.stats.eventsCompleted || 0) + 1;

  globalThis.saveState?.();
  if (globalThis.activeTab === 'tabZones') globalThis.renderZonesTab?.();

  return { success: true, moneyGain, repGain, xpGain };
}

/**
 * Appelé chaque minute par le game loop pour une zone donnée.
 * Déclenche les événements dont le timer a expiré, expire les événements finis.
 */
function tickZoneEvents(zoneId) {
  const z = _state()?.zones?.[zoneId];
  if (!z) return;
  const now = Date.now();

  // Déclencher si timer expiré et pas d'événement actif
  if (!z.activeEvent && z.nextEventAt && now >= z.nextEventAt) {
    triggerZoneEvent(zoneId);
    return;
  }

  // Expirer les événements à durée finie non résolus
  if (z.activeEvent && !z.activeEvent.resolved && z.activeEvent.endsAt && now >= z.activeEvent.endsAt) {
    z.activeEvent = null;
    globalThis.saveState?.();
    if (globalThis.activeTab === 'tabZones') globalThis.renderZonesTab?.();
  }
}

/**
 * Ticks tous les événements de toutes les zones avec agents.
 * À appeler depuis startGameLoop (setInterval ~60s).
 */
function tickAllZoneEvents() {
  const state = _state();
  if (!state) return;
  // Uniquement les zones avec des agents assignés
  const activeZoneIds = new Set(
    (state.agents || []).filter(a => a.assignedZone).map(a => a.assignedZone)
  );
  for (const zoneId of activeZoneIds) {
    tickZoneEvents(zoneId);
  }
}

// ── Boot ──────────────────────────────────────────────────────

/**
 * Initialise les champs v2 d'une zone si absents.
 */
function ensureZoneV2Fields(zoneId) {
  if (!zoneId || zoneId === 'gang_park') return;
  const z = _initZone(zoneId);
  if (!z) return;
  if (z.zoneXp      === undefined) z.zoneXp      = 0;
  if (z.nextEventAt === undefined) z.nextEventAt  = 0;
  if (z.activeEvent === undefined) z.activeEvent  = null;
}

/**
 * Boot — initialise les champs v2 pour toutes les zones connues
 * et planifie le premier événement si besoin.
 */
function initZoneLevels() {
  const allZones = [
    ...(typeof ZONES !== 'undefined' ? ZONES : []),
    ...(typeof ZONES_JOHTO !== 'undefined' ? ZONES_JOHTO : []),
  ];
  for (const zone of allZones) {
    ensureZoneV2Fields(zone.id);
    const z = _state()?.zones?.[zone.id];
    if (z && !z.nextEventAt) scheduleNextZoneEvent(zone.id);
  }
}

// ── Exports globalThis ────────────────────────────────────────
Object.assign(globalThis, {
  // Niveaux
  getZoneLevel,
  getZoneXP,
  getZoneXPProgress,
  getZoneLevelBonuses,
  addZoneXP,
  // Événements
  tickZoneEvents,
  tickAllZoneEvents,
  resolveZoneEvent,
  scheduleNextZoneEvent,
  // Boot
  initZoneLevels,
  ensureZoneV2Fields,
  // Config (pour UI)
  ZONE_EVENT_DEFINITIONS,
  ZONE_LEVEL_BONUSES,
  ZONE_MAX_LEVEL,
  ZONE_XP_SOURCES,
  ZONE_LEVEL_XP_THRESHOLDS,
});
