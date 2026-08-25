import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function importSource(relativePath) {
  const source = await readFile(path.join(process.cwd(), relativePath), 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

const {
  aggregateOfflineReport,
  buildOfflineHighlights,
  createOfflineReport,
  getOfflineReportCopy,
  recordOfflineCapture,
  recordOfflineCombat,
  recordOfflineMoney,
  shouldShowOfflineReport,
} = await importSource('modules/systems/offlineReportModel.js');

const report = createOfflineReport({ absentSince: 1_000, startedAt: 2_000 });
recordOfflineCapture(report, {
  species_en: 'zubat', rarity: 'common', potential: 2, byAgent: 'Jessie', sold: false,
});
recordOfflineCapture(report, {
  species_en: 'zubat', rarity: 'common', potential: 4, byAgent: 'James', sold: true, salePrice: 400,
});
recordOfflineCapture(report, {
  species_en: 'zubat', rarity: 'common', potential: 5, byAgent: 'Jessie', sold: true, salePrice: 600,
});
recordOfflineCapture(report, {
  species_en: 'gastly', rarity: 'very_rare', potential: 5, shiny: true, byAgent: 'Jessie', sold: false,
});
recordOfflineCapture(report, {
  species_en: 'mewtwo', rarity: 'legendary', potential: 4, byAgent: 'James', sold: false,
});
recordOfflineCombat(report, true, 1_200);
recordOfflineCombat(report, true, 800);
recordOfflineCombat(report, false, 0);
recordOfflineMoney(report, 250, 'chest');

const aggregate = aggregateOfflineReport(report);
const zubat = aggregate.captureGroups.find(group => group.species_en === 'zubat');
assert.ok(zubat);
assert.equal(zubat.count, 3);
assert.equal(zubat.keptCount, 1);
assert.equal(zubat.soldCount, 2);
assert.equal(zubat.salesRevenue, 1_000);
assert.equal(zubat.maxPotential, 5);
assert.equal(zubat.shinyCount, 0);
assert.deepEqual(zubat.byAgents, ['James', 'Jessie']);

const gastly = aggregate.captureGroups.find(group => group.species_en === 'gastly');
assert.equal(gastly.shinyCount, 1);
assert.equal(gastly.keptCount, 1);
assert.equal(report.sales.count, 2);
assert.equal(report.sales.revenue, 1_000);
assert.equal(aggregate.combats.total, 3);
assert.equal(aggregate.combats.won, 2);
assert.equal(aggregate.combats.lost, 1);
assert.equal(aggregate.totalEarned, 3_250, 'sales + combat + chest are counted exactly once');

const highlights = buildOfflineHighlights(report, { limit: 4 });
assert.equal(highlights[0].kind, 'shiny');
assert.equal(highlights[0].species_en, 'gastly');
assert.ok(highlights.some(item => item.kind === 'legendary' && item.species_en === 'mewtwo'));
assert.ok(highlights.some(item => item.potential === 5));
assert.ok(highlights.length <= 4);

assert.equal(shouldShowOfflineReport(report, { thresholdSeconds: 60, now: 62_000 }), true);
assert.equal(shouldShowOfflineReport(report, { thresholdSeconds: 300, now: 62_000 }), false);
assert.equal(shouldShowOfflineReport(report, { thresholdSeconds: 0, now: 62_000 }), false);
assert.equal(shouldShowOfflineReport(createOfflineReport({ absentSince: 1_000 }), {
  thresholdSeconds: 60,
  now: 62_000,
}), false, 'empty reports stay hidden');

const fr = getOfflineReportCopy('fr');
const en = getOfflineReportCopy('en');
assert.equal(fr.syncing, 'Synchronisation de ton gang…');
assert.equal(en.syncing, 'Syncing your gang…');
assert.match(fr.workedWhileAway, /Ton gang a travaillé pendant/);
assert.match(en.workedWhileAway, /Your gang worked while you were away/);
assert.equal(fr.highlights, 'À retenir');
assert.equal(en.highlights, 'Highlights');
assert.equal(fr.viewDetails, 'Voir le détail des captures');
assert.equal(en.viewDetails, 'View capture details');

const reportSource = await readFile(path.join(process.cwd(), 'modules', 'systems', 'offlineReport.js'), 'utf8');
assert.doesNotMatch(reportSource, /style\.cssText|style\s*=/, 'offline report JS contains no inline styles');
assert.match(reportSource, /<details class="offline-report__details"/);
assert.match(reportSource, /offline-report__kpi/);
assert.match(reportSource, /offline-report__highlights/);

const agentSource = await readFile(path.join(process.cwd(), 'modules', 'systems', 'agent.js'), 'utf8');
assert.doesNotMatch(agentSource, /_hiddenAgentTicks/);
assert.match(agentSource, /sold:\s*sale\.sold/);
assert.match(agentSource, /salePrice:\s*sale\.salePrice/);

const batchConsumers = await Promise.all([
  'modules/systems/analytics.js',
  'modules/systems/deoxysMission.js',
  'modules/systems/johtoMissions.js',
  'modules/systems/kantoMissions.js',
  'modules/systems/legendaryMissions.js',
  'modules/systems/sinnohMissions.js',
  'modules/systems/tabUnlocks.js',
  'modules/ui/advisor.js',
  'modules/ui/agentsTab.js',
  'modules/ui/gangTab.js',
  'modules/ui/zoneSelector.js',
].map(file => readFile(path.join(process.cwd(), file), 'utf8')));
assert.ok(
  batchConsumers.every(source => !source.includes('OfflineReport?.isBatching')),
  'batch consumers depend on SimulationContext rather than the report global',
);

console.log('offline report tests passed');
