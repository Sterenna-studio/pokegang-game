const isObject = value => value !== null && typeof value === 'object';
const progressKeys = key => ['zones', 'missions', 'purchases', 'stats', 'onboarding', 'dropPity'].includes(key) || key.endsWith('Mission');
const ignored = new Set(['_savedAt', 'lastSave', 'lastTick', 'lastActive']);
const sensitive = path => /(?:token|secret|password|api.?key|credential)/i.test(path);

export function validateSave(save) {
  if (!isObject(save) || Array.isArray(save) || !(save.gang || save.pokemons || save.zones || save.missions)) throw Error('Fichier non reconnu comme sauvegarde PokéGang.');
  return save;
}

export function summarizeSave(save) {
  const missions = save.missions || {};
  return {
    'Pokémon': save.pokemons?.length || 0, 'Agents': save.agents?.length || 0,
    'Arènes vaincues': Object.values(save.zones || {}).filter(z => z?.gymDefeated === true).length,
    'Missions uniques réclamées': missions.completed?.length || 0,
    'Récompenses quotidiennes': missions.daily?.claimed?.length || 0,
    'Récompenses hebdomadaires': missions.weekly?.claimed?.length || 0,
    'Récompenses horaires': missions.hourly?.claimed?.length || 0,
    'Quêtes légendaires actives': Object.entries(save).filter(([key, value]) => key.endsWith('Mission') && (value?.active || Object.values(value || {}).some(v => v?.active))).length,
  };
}

export function compareSaves(before, after, { all = false, limit = 300 } = {}) {
  validateSave(before); validateSave(after);
  const rows = []; let count = 0;
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(k => !ignored.has(k) && (all || progressKeys(k))).sort();
  const stack = keys.reverse().map(key => ({ path: key, a: before[key], b: after[key] }));
  while (stack.length) {
    const { path, a, b } = stack.pop();
    if (Object.is(a, b)) continue;
    if (!sensitive(path) && isObject(a) && isObject(b) && Array.isArray(a) === Array.isArray(b)) {
      const childKeys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().reverse();
      for (const key of childKeys) stack.push({ path: `${path}.${key}`, a: a[key], b: b[key] });
      continue;
    }
    // Nested sensitive values are never serialized into the displayed result.
    const value = (v, p) => {
      if (sensitive(p)) return '[masqué]';
      if (v === undefined) return '[absent]';
      if (isObject(v)) return Array.isArray(v) ? `[tableau : ${v.length}]` : '[objet]';
      return JSON.stringify(v).slice(0, 160);
    };
    count++;
    if (rows.length < limit) rows.push({ path, before: value(a, path), after: value(b, path) });
  }
  return { rows, count };
}
