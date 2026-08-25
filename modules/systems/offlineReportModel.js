// Pure data model for the offline report. No DOM or game globals here.

const RARITY_PRIORITY = {
  legendary: 1,
  very_rare: 2,
  rare: 5,
  uncommon: 6,
  common: 7,
};

const COPY = {
  fr: {
    syncing: 'Synchronisation de ton gang…',
    workedWhileAway: 'Ton gang a travaillé pendant',
    captures: 'Captures',
    sales: 'Ventes',
    sold: 'Vendu',
    kept: 'Gardé',
    combats: 'Combats',
    money: 'Argent',
    eggs: 'Œufs',
    training: 'Formation',
    winsShort: 'V',
    lossesShort: 'D',
    totalEarned: 'Gain total',
    highlights: 'À retenir',
    viewDetails: 'Voir le détail des captures',
    best: 'meilleur',
    close: 'Fermer',
    shiny: 'Shiny',
    legendary: 'Légendaire',
    veryRare: 'Très rare',
    eggReady: 'œuf prêt',
    eggsReady: 'œufs prêts',
    levelUp: 'progression remarquable',
    exhausted: 'agent épuisé',
    promotion: 'promotion',
    chestIncome: 'coffres',
    combatIncome: 'combats',
    salesIncome: 'ventes',
  },
  en: {
    syncing: 'Syncing your gang…',
    workedWhileAway: 'Your gang worked while you were away for',
    captures: 'Captures',
    sales: 'Sales',
    sold: 'Sold',
    kept: 'Kept',
    combats: 'Battles',
    money: 'Money',
    eggs: 'Eggs',
    training: 'Training',
    winsShort: 'W',
    lossesShort: 'L',
    totalEarned: 'Total earned',
    highlights: 'Highlights',
    viewDetails: 'View capture details',
    best: 'best',
    close: 'Close',
    shiny: 'Shiny',
    legendary: 'Legendary',
    veryRare: 'Very rare',
    eggReady: 'egg ready',
    eggsReady: 'eggs ready',
    levelUp: 'notable progress',
    exhausted: 'agent exhausted',
    promotion: 'promotion',
    chestIncome: 'chests',
    combatIncome: 'battles',
    salesIncome: 'sales',
  },
};

export function getOfflineReportCopy(lang = 'fr') {
  return COPY[lang === 'en' ? 'en' : 'fr'];
}

export function createOfflineReport({ absentSince = null, startedAt = Date.now() } = {}) {
  return {
    startedAt,
    absentSince,
    captures: [],
    sales: { count: 0, revenue: 0 },
    combats: { won: 0, lost: 0, totalReward: 0 },
    chests: 0,
    moneyDelta: 0,
    moneySources: { chest: 0, raid: 0, other: 0 },
    itemsDelta: {},
    eggsReady: 0,
    trainingTicks: 0,
    xpTicks: 0,
    levelUps: [],
    agentEvents: [],
  };
}

export function recordOfflineCapture(report, data = {}) {
  if (!report || !data.species_en) return null;
  const capture = {
    species_en: data.species_en,
    shiny: !!data.shiny,
    potential: Math.max(1, Number(data.potential) || 1),
    rarity: data.rarity || 'common',
    byAgent: data.byAgent || '',
    sold: !!data.sold,
    salePrice: data.sold ? Math.max(0, Number(data.salePrice) || 0) : 0,
  };
  report.captures.push(capture);
  if (capture.sold) {
    report.sales.count++;
    report.sales.revenue += capture.salePrice;
  }
  return capture;
}

export function recordOfflineCombat(report, won, reward = 0) {
  if (!report) return;
  if (won) report.combats.won++;
  else report.combats.lost++;
  if (reward > 0) report.combats.totalReward += reward;
}

export function recordOfflineMoney(report, delta, source = 'other') {
  if (!report || !Number.isFinite(delta) || delta === 0) return;
  report.moneyDelta += delta;
  const key = Object.hasOwn(report.moneySources, source) ? source : 'other';
  report.moneySources[key] += delta;
}

export function aggregateOfflineReport(report) {
  const groups = new Map();
  for (const capture of report?.captures || []) {
    let group = groups.get(capture.species_en);
    if (!group) {
      group = {
        species_en: capture.species_en,
        rarity: capture.rarity || 'common',
        count: 0,
        keptCount: 0,
        soldCount: 0,
        salesRevenue: 0,
        maxPotential: 1,
        shinyCount: 0,
        byAgents: new Set(),
      };
      groups.set(capture.species_en, group);
    }
    group.count++;
    if (capture.sold) {
      group.soldCount++;
      group.salesRevenue += capture.salePrice || 0;
    } else {
      group.keptCount++;
    }
    group.maxPotential = Math.max(group.maxPotential, capture.potential || 1);
    if (capture.shiny) group.shinyCount++;
    if (capture.byAgent) group.byAgents.add(capture.byAgent);
    if ((RARITY_PRIORITY[capture.rarity] ?? 99) < (RARITY_PRIORITY[group.rarity] ?? 99)) {
      group.rarity = capture.rarity;
    }
  }

  const captureGroups = [...groups.values()]
    .map(group => ({ ...group, byAgents: [...group.byAgents].sort() }))
    .sort((a, b) => {
      if (a.shinyCount !== b.shinyCount) return b.shinyCount - a.shinyCount;
      const rarityDelta = (RARITY_PRIORITY[a.rarity] ?? 99) - (RARITY_PRIORITY[b.rarity] ?? 99);
      if (rarityDelta) return rarityDelta;
      if (a.maxPotential !== b.maxPotential) return b.maxPotential - a.maxPotential;
      return b.count - a.count;
    });

  const combats = {
    ...report.combats,
    total: (report.combats?.won || 0) + (report.combats?.lost || 0),
  };
  const totalEarned = (report.sales?.revenue || 0)
    + (report.combats?.totalReward || 0)
    + (report.moneyDelta || 0);

  return {
    captureGroups,
    capturesTotal: report.captures?.length || 0,
    shinyTotal: report.captures?.filter(capture => capture.shiny).length || 0,
    combats,
    totalEarned,
  };
}

export function buildOfflineHighlights(report, { limit = 4 } = {}) {
  const candidates = [];
  for (const capture of report?.captures || []) {
    let kind = null;
    let priority = 99;
    if (capture.shiny) { kind = 'shiny'; priority = 0; }
    else if (capture.rarity === 'legendary') { kind = 'legendary'; priority = 1; }
    else if (capture.rarity === 'very_rare') { kind = 'very_rare'; priority = 2; }
    else if (capture.potential >= 5) { kind = 'potential'; priority = 3; }
    else if (capture.potential >= 4) { kind = 'potential'; priority = 4; }
    if (kind) candidates.push({ ...capture, kind, priority });
  }
  if ((report?.eggsReady || 0) > 0) {
    candidates.push({ kind: 'eggs', count: report.eggsReady, priority: 5 });
  }
  for (const levelUp of report?.levelUps || []) {
    candidates.push({ ...levelUp, kind: 'level_up', priority: 6 });
  }
  for (const event of report?.agentEvents || []) {
    candidates.push({ ...event, kind: event.kind || 'agent', priority: 7 });
  }

  candidates.sort((a, b) => a.priority - b.priority || (b.potential || 0) - (a.potential || 0));
  const seen = new Set();
  const highlights = [];
  for (const candidate of candidates) {
    const key = candidate.species_en
      ? `${candidate.kind}:${candidate.species_en}`
      : `${candidate.kind}:${candidate.name || candidate.count || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    highlights.push(candidate);
    if (highlights.length >= limit) break;
  }
  return highlights;
}

export function shouldShowOfflineReport(report, {
  thresholdSeconds = 300,
  now = Date.now(),
} = {}) {
  if (!report || thresholdSeconds <= 0) return false;
  const absentMs = report.absentSince ? now - report.absentSince : 0;
  if (absentMs < thresholdSeconds * 1000) return false;
  return (report.captures?.length || 0) > 0
    || (report.combats?.won || 0) + (report.combats?.lost || 0) > 0
    || (report.chests || 0) > 0
    || (report.eggsReady || 0) > 0
    || (report.trainingTicks || 0) > 0
    || Math.abs(report.moneyDelta || 0) > 0
    || Object.keys(report.itemsDelta || {}).length > 0;
}
