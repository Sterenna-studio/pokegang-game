'use strict';

// ZONES grows only when a region is activated. Save validation must also know
// locked regions, notably at the hub before any game has started.
export function getKnownSaveZones() {
  return [
    typeof ZONES !== 'undefined' ? ZONES : [],
    typeof ZONES_JOHTO !== 'undefined' ? ZONES_JOHTO : [],
    typeof ZONES_HOENN !== 'undefined' ? ZONES_HOENN : [],
    typeof ZONES_SINNOH !== 'undefined' ? ZONES_SINNOH : [],
  ].flat();
}

export function getObsoleteSaveZoneIds(saveData, zones = getKnownSaveZones()) {
  const validIds = new Set(zones.map(z => z.id));
  return Object.keys(saveData?.zones || {}).filter(id => !validIds.has(id));
}
