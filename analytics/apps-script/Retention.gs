const PG_RETENTION_LOOKBACK_DAYS = 45;
const PG_RETENTION_COHORT_BATCH_SIZE = 10;
const PG_RETENTION_CHECKPOINTS = [1, 3, 7, 14];

/**
 * Syncs overall GA4 first-session cohorts into Supabase.
 *
 * Retention is deliberately stored as an overall property-level cohort first.
 * We use platform='all', game_version='all', audience='unknown' because the
 * current PokéGang platform/version/internal-tester dimensions are event-scoped.
 * Applying those dimensions to a firstSessionDate cohort would classify return
 * activity, not reliably freeze the acquisition-time attributes of each user.
 *
 * NULL checkpoint values mean the cohort is not old enough yet. A real zero
 * means the checkpoint is mature and GA4 reported no returning active users.
 */
function pgSyncGa4RetentionToSupabase() {
  const completeEndDate = pgCompleteDateRange_(1).endDate;
  const cohortDates = pgRetentionCohortDates_(completeEndDate, PG_RETENTION_LOOKBACK_DAYS);
  const rows = pgBuildRetentionRows_(cohortDates, completeEndDate);

  const result = pgSupabaseAnalyticsRequest_({
    action: 'sync',
    start_date: cohortDates[0] || completeEndDate,
    end_date: completeEndDate,
    reports_requested: pgRetentionLastReportCount_ || 0,
    datasets: rows.length ? [{ report: 'retention', rows }] : [],
    client_errors: [],
    metadata: {
      apps_script_version: 2,
      retention_status: 'active',
      retention_scope: 'overall_property',
      retention_lookback_days: PG_RETENTION_LOOKBACK_DAYS,
      retention_checkpoints: PG_RETENTION_CHECKPOINTS,
      retention_note: 'platform=all, game_version=all, audience=unknown until acquisition-scoped dimensions exist',
    },
  });

  console.log(JSON.stringify(result, null, 2));
  return result;
}

/** Installs one approximate daily trigger for retention. */
function pgInstallGa4RetentionTrigger() {
  pgRemoveGa4RetentionTriggers();
  const trigger = ScriptApp.newTrigger('pgSyncGa4RetentionToSupabase')
    .timeBased()
    .everyDays(1)
    .create();
  console.log(`Installed GA4 retention trigger: ${trigger.getUniqueId()}`);
  return trigger.getUniqueId();
}

/** Removes only retention triggers owned by this Apps Script project. */
function pgRemoveGa4RetentionTriggers() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'pgSyncGa4RetentionToSupabase') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });
  console.log(`Removed ${removed} GA4 retention trigger(s)`);
  return removed;
}

let pgRetentionLastReportCount_ = 0;

function pgBuildRetentionRows_(cohortDates, completeEndDate) {
  pgRetentionLastReportCount_ = 0;
  if (!cohortDates.length) return [];

  const completeEnd = pgRetentionParseDate_(completeEndDate);

  // GA4 requires cohortsRange.endOffset and does not accept a useful day-zero
  // retention report here. The newest cohort has no D1 checkpoint yet anyway,
  // so wait until it is at least one complete day old before persisting it.
  const matureCohortDates = cohortDates.filter(date =>
    pgRetentionDaysBetween_(pgRetentionParseDate_(date), completeEnd) >= 1
  );
  if (!matureCohortDates.length) return [];

  const byDate = new Map();

  matureCohortDates.forEach(date => {
    byDate.set(date, {
      cohort_date: date,
      platform: 'all',
      game_version: 'all',
      audience: PG_UNKNOWN,
      cohort_size: 0,
      returned_d1: null,
      returned_d3: null,
      returned_d7: null,
      returned_d14: null,
    });
  });

  // Query each cohort only to the highest checkpoint that is fully mature.
  // All cohorts here are at least D1 mature, so endOffset is always >= 1.
  const maturityGroups = new Map();
  matureCohortDates.forEach(date => {
    const ageDays = pgRetentionDaysBetween_(pgRetentionParseDate_(date), completeEnd);
    let maxOffset = 1;
    for (const checkpoint of PG_RETENTION_CHECKPOINTS) {
      if (ageDays >= checkpoint) maxOffset = checkpoint;
    }
    if (!maturityGroups.has(maxOffset)) maturityGroups.set(maxOffset, []);
    maturityGroups.get(maxOffset).push(date);
  });

  [...maturityGroups.entries()].forEach(([maxOffset, dates]) => {
    for (let i = 0; i < dates.length; i += PG_RETENTION_COHORT_BATCH_SIZE) {
      const batch = dates.slice(i, i + PG_RETENTION_COHORT_BATCH_SIZE);
      const reportRows = pgRunRetentionCohortReport_(batch, maxOffset);
      pgRetentionLastReportCount_++;

      reportRows.forEach(row => {
        const cohortDate = pgRetentionDateFromCohortName_(row.d.cohort);
        const target = byDate.get(cohortDate);
        if (!target) return;

        const nthDay = pgInt_(row.d.cohortNthDay, -1);
        const active = pgInt_(row.m.cohortActiveUsers, 0);
        const total = pgInt_(row.m.cohortTotalUsers, 0);

        if (total > target.cohort_size) target.cohort_size = total;
        if (nthDay === 0 && target.cohort_size === 0) target.cohort_size = active;
        if (nthDay === 1) target.returned_d1 = active;
        if (nthDay === 3) target.returned_d3 = active;
        if (nthDay === 7) target.returned_d7 = active;
        if (nthDay === 14) target.returned_d14 = active;
      });
    }
  });

  // A mature checkpoint missing from the response means zero activity because
  // runReport omits all-zero rows by default. Immature checkpoints stay NULL.
  byDate.forEach((row, date) => {
    const ageDays = pgRetentionDaysBetween_(pgRetentionParseDate_(date), completeEnd);
    if (ageDays >= 1 && row.returned_d1 === null) row.returned_d1 = 0;
    if (ageDays >= 3 && row.returned_d3 === null) row.returned_d3 = 0;
    if (ageDays >= 7 && row.returned_d7 === null) row.returned_d7 = 0;
    if (ageDays >= 14 && row.returned_d14 === null) row.returned_d14 = 0;
  });

  return [...byDate.values()];
}

function pgRunRetentionCohortReport_(cohortDates, endOffset) {
  const request = AnalyticsData.newRunReportRequest();

  request.dimensions = ['cohort', 'cohortNthDay'].map(name => {
    const dimension = AnalyticsData.newDimension();
    dimension.name = name;
    return dimension;
  });

  request.metrics = ['cohortActiveUsers', 'cohortTotalUsers'].map(name => {
    const metric = AnalyticsData.newMetric();
    metric.name = name;
    return metric;
  });

  request.cohortSpec = {
    cohorts: cohortDates.map(date => ({
      name: pgRetentionCohortName_(date),
      dimension: 'firstSessionDate',
      dateRange: { startDate: date, endDate: date },
    })),
    cohortsRange: {
      startOffset: 0,
      endOffset: Math.max(1, endOffset),
      granularity: 'DAILY',
    },
  };
  request.limit = 100000;

  const report = AnalyticsData.Properties.runReport(
    request,
    `properties/${PG_GA4_PROPERTY_ID}`,
  );

  const dimensionHeaders = (report.dimensionHeaders || []).map(header => header.name);
  const metricHeaders = (report.metricHeaders || []).map(header => header.name);

  return (report.rows || []).map(raw => {
    const d = {};
    const m = {};
    dimensionHeaders.forEach((name, index) => d[name] = raw.dimensionValues?.[index]?.value ?? '');
    metricHeaders.forEach((name, index) => m[name] = raw.metricValues?.[index]?.value ?? '0');
    return { d, m };
  });
}

function pgRetentionCohortDates_(completeEndDate, lookbackDays) {
  const end = pgRetentionParseDate_(completeEndDate);
  const count = Math.max(1, Number(lookbackDays) || 1);
  const dates = [];
  for (let delta = count - 1; delta >= 0; delta--) {
    const date = new Date(end.getTime());
    date.setUTCDate(date.getUTCDate() - delta);
    dates.push(Utilities.formatDate(date, 'UTC', 'yyyy-MM-dd'));
  }
  return dates;
}

function pgRetentionCohortName_(date) {
  return `pg_${String(date).replace(/-/g, '')}`;
}

function pgRetentionDateFromCohortName_(name) {
  const match = String(name || '').match(/^pg_(\d{4})(\d{2})(\d{2})$/);
  if (!match) throw new Error(`Unexpected retention cohort name: ${name}`);
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function pgRetentionParseDate_(date) {
  const match = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`Unexpected retention date: ${date}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function pgRetentionDaysBetween_(start, end) {
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}
