const PG_SUPABASE_ANALYTICS_INGEST_URL =
  'https://ojklmobvafovftqvevzh.supabase.co/functions/v1/pokegang-analytics-ingest';

const PG_UNKNOWN = 'unknown';
const PG_NOT_SET_VALUES = new Set(['', '(not set)', '(not provided)', '(other)']);

/**
 * Verifies that the current Google authorization can reach the Supabase ingest
 * endpoint. The Edge Function validates the bearer token against GA4 property
 * 547494860 before accepting anything.
 */
function pgTestSupabaseIngest() {
  const response = pgSupabaseAnalyticsRequest_({ action: 'ping' });
  console.log(`Supabase analytics ingest OK — property ${response.property_id}`);
  return response;
}

/**
 * Pulls the last 3 complete GA4 days and UPSERTs aggregates into Supabase.
 * Running it repeatedly is safe: the database unique keys make the sync
 * idempotent and re-fetching 3 days absorbs late GA4 consolidation.
 */
function pgSyncGa4ToSupabase() {
  const range = pgCompleteDateRange_(3);
  const clientErrors = [];
  const reportCounter = { value: 0 };

  const traffic = pgSafeCollect_(
    'traffic', clientErrors, reportCounter,
    () => pgBuildTrafficRows_(range.startDate, range.endDate),
  );
  const acquisition = pgSafeCollect_(
    'acquisition', clientErrors, reportCounter,
    () => pgBuildAcquisitionRows_(range.startDate, range.endDate),
  );
  const events = pgSafeCollect_(
    'events', clientErrors, reportCounter,
    () => pgBuildEventRows_(range.startDate, range.endDate, clientErrors, reportCounter),
    false,
  );
  const onboarding = pgSafeCollect_(
    'onboarding', clientErrors, reportCounter,
    () => pgBuildOnboardingRows_(range.startDate, range.endDate),
  );
  const segments = pgSafeCollect_(
    'segments', clientErrors, reportCounter,
    () => pgBuildSegmentRows_(range.startDate, range.endDate),
  );

  const datasets = [
    { report: 'traffic', rows: traffic },
    { report: 'acquisition', rows: acquisition },
    { report: 'events', rows: events },
    { report: 'onboarding', rows: onboarding },
    { report: 'segments', rows: segments },
  ].filter(dataset => dataset.rows.length > 0);

  const result = pgSupabaseAnalyticsRequest_({
    action: 'sync',
    start_date: range.startDate,
    end_date: range.endDate,
    reports_requested: reportCounter.value,
    datasets,
    client_errors: clientErrors,
    metadata: {
      apps_script_version: 1,
      lookback_complete_days: 3,
      retention_status: 'deferred_until_core_pipeline_validated',
    },
  });

  console.log(JSON.stringify(result, null, 2));
  return result;
}

/** Installs one approximate 12-hour Apps Script trigger for the GA4 sync. */
function pgInstallGa4SupabaseSyncTrigger() {
  pgRemoveGa4SupabaseSyncTriggers();
  const trigger = ScriptApp.newTrigger('pgSyncGa4ToSupabase')
    .timeBased()
    .everyHours(12)
    .create();
  console.log(`Installed GA4 -> Supabase trigger: ${trigger.getUniqueId()}`);
  return trigger.getUniqueId();
}

/** Removes only triggers owned by pgSyncGa4ToSupabase. */
function pgRemoveGa4SupabaseSyncTriggers() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'pgSyncGa4ToSupabase') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });
  console.log(`Removed ${removed} GA4 -> Supabase trigger(s)`);
  return removed;
}

function pgSafeCollect_(label, errors, counter, fn, increment = true) {
  if (increment) counter.value++;
  try {
    const rows = fn() || [];
    console.log(`${label}: ${rows.length} row(s)`);
    return rows;
  } catch (error) {
    const message = `${label}: ${error && error.message ? error.message : error}`;
    errors.push(message);
    console.error(message);
    return [];
  }
}

function pgCompleteDateRange_(days) {
  const tz = 'Europe/Paris';
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - (Math.max(1, days) - 1));
  return {
    startDate: Utilities.formatDate(start, tz, 'yyyy-MM-dd'),
    endDate: Utilities.formatDate(end, tz, 'yyyy-MM-dd'),
  };
}

function pgBuildTrafficRows_(startDate, endDate) {
  const dimensions = ['date', 'hostName', 'city', 'country', 'deviceCategory'];
  const metrics = [
    'activeUsers', 'newUsers', 'sessions', 'engagedSessions',
    'userEngagementDuration', 'screenPageViews',
  ];
  return pgRunReport_(dimensions, metrics, startDate, endDate).map(row => ({
    date: pgGaDate_(row.d.date),
    host_name: pgText_(row.d.hostName),
    city: pgText_(row.d.city),
    country: pgText_(row.d.country),
    device_category: pgText_(row.d.deviceCategory),
    active_users: pgInt_(row.m.activeUsers, 0),
    new_users: pgInt_(row.m.newUsers, 0),
    sessions: pgInt_(row.m.sessions, 0),
    engaged_sessions: pgInt_(row.m.engagedSessions, 0),
    engagement_seconds: pgNum_(row.m.userEngagementDuration, 0),
    page_views: pgInt_(row.m.screenPageViews, 0),
  }));
}

function pgBuildAcquisitionRows_(startDate, endDate) {
  const dimensions = ['date', 'sessionSource', 'sessionMedium', 'sessionCampaignName'];
  const metrics = ['activeUsers', 'newUsers', 'sessions', 'engagedSessions'];
  return pgRunReport_(dimensions, metrics, startDate, endDate).map(row => ({
    date: pgGaDate_(row.d.date),
    source: pgText_(row.d.sessionSource),
    medium: pgText_(row.d.sessionMedium),
    campaign: pgText_(row.d.sessionCampaignName),
    active_users: pgInt_(row.m.activeUsers, 0),
    new_users: pgInt_(row.m.newUsers, 0),
    sessions: pgInt_(row.m.sessions, 0),
    engaged_sessions: pgInt_(row.m.engagedSessions, 0),
  }));
}

function pgBuildEventRows_(startDate, endDate, errors, counter) {
  const rows = [];
  const common = ['date', 'eventName', 'customEvent:platform', 'customEvent:game_version', 'customEvent:internal_tester'];
  const baseMetrics = ['activeUsers', 'eventCount'];

  const collect = (label, eventNames, dimensions, metrics, map) => {
    counter.value++;
    try {
      const report = pgRunReport_(dimensions, metrics, startDate, endDate)
        .filter(row => eventNames.includes(row.d.eventName));
      report.forEach(row => rows.push(map(row)));
      console.log(`events/${label}: ${report.length} row(s)`);
    } catch (error) {
      const message = `events/${label}: ${error && error.message ? error.message : error}`;
      errors.push(message);
      console.error(message);
    }
  };

  collect(
    'game_loaded', ['game_loaded'],
    [...common, 'customEvent:slot', 'customEvent:save_state'], baseMetrics,
    row => pgBaseEventRow_(row, {
      slot: pgInt_(row.d['customEvent:slot'], -1),
      save_state: pgText_(row.d['customEvent:save_state']),
    }),
  );

  collect(
    'captures', ['pokemon_captured', 'first_capture'],
    [...common, 'customEvent:capture_source', 'customEvent:zone', 'customEvent:species', 'customEvent:shiny'],
    baseMetrics,
    row => pgBaseEventRow_(row, {
      capture_source: pgText_(row.d['customEvent:capture_source']),
      zone: pgText_(row.d['customEvent:zone']),
      extra_dimensions: {
        species: pgText_(row.d['customEvent:species']),
        shiny: pgText_(row.d['customEvent:shiny']),
      },
    }),
  );

  collect(
    'sales', ['pokemon_sold'],
    [...common, 'customEvent:slot'],
    [...baseMetrics, 'customEvent:count', 'customEvent:total_price'],
    row => pgBaseEventRow_(row, {
      slot: pgInt_(row.d['customEvent:slot'], -1),
      extra_metrics: {
        count: pgNum_(row.m['customEvent:count'], 0),
        total_price: pgNum_(row.m['customEvent:total_price'], 0),
      },
    }),
  );

  collect(
    'battle_started', ['battle_started'],
    [...common, 'customEvent:slot', 'customEvent:zone', 'customEvent:trainer', 'customEvent:mode'],
    baseMetrics,
    row => pgBaseEventRow_(row, {
      slot: pgInt_(row.d['customEvent:slot'], -1),
      zone: pgText_(row.d['customEvent:zone']),
      trainer: pgText_(row.d['customEvent:trainer']),
      mode: pgText_(row.d['customEvent:mode']),
    }),
  );

  collect(
    'battle_won', ['battle_won'],
    [...common, 'customEvent:zone', 'customEvent:mode', 'customEvent:initiated_by', 'customEvent:elite'],
    baseMetrics,
    row => pgBaseEventRow_(row, {
      zone: pgText_(row.d['customEvent:zone']),
      mode: pgText_(row.d['customEvent:mode']),
      initiated_by: pgText_(row.d['customEvent:initiated_by']),
      elite: pgText_(row.d['customEvent:elite']),
    }),
  );

  collect(
    'battle_lost', ['battle_lost'],
    [...common, 'customEvent:zone', 'customEvent:trainer', 'customEvent:mode', 'customEvent:initiated_by'],
    baseMetrics,
    row => pgBaseEventRow_(row, {
      zone: pgText_(row.d['customEvent:zone']),
      trainer: pgText_(row.d['customEvent:trainer']),
      mode: pgText_(row.d['customEvent:mode']),
      initiated_by: pgText_(row.d['customEvent:initiated_by']),
    }),
  );

  collect(
    'agent_recruited', ['agent_recruited'],
    [...common, 'customEvent:slot', 'customEvent:source'],
    [...baseMetrics, 'customEvent:cost', 'customEvent:total_agents'],
    row => pgBaseEventRow_(row, {
      slot: pgInt_(row.d['customEvent:slot'], -1),
      source: pgText_(row.d['customEvent:source']),
      extra_metrics: {
        cost: pgNum_(row.m['customEvent:cost'], 0),
        total_agents: pgNum_(row.m['customEvent:total_agents'], 0),
      },
    }),
  );

  collect(
    'team_member_set', ['team_member_set'],
    [...common, 'customEvent:team', 'customEvent:team_slot', 'customEvent:source', 'customEvent:has_agent'],
    baseMetrics,
    row => pgBaseEventRow_(row, {
      team: pgText_(row.d['customEvent:team']),
      team_slot: pgInt_(row.d['customEvent:team_slot'], -1),
      source: pgText_(row.d['customEvent:source']),
      has_agent: pgText_(row.d['customEvent:has_agent']),
    }),
  );

  collect(
    'agent_assigned', ['agent_assigned'],
    [...common, 'customEvent:slot', 'customEvent:zone', 'customEvent:source', 'customEvent:unassigned'],
    baseMetrics,
    row => pgBaseEventRow_(row, {
      slot: pgInt_(row.d['customEvent:slot'], -1),
      zone: pgText_(row.d['customEvent:zone']),
      source: pgText_(row.d['customEvent:source']),
      unassigned: pgText_(row.d['customEvent:unassigned']),
    }),
  );

  collect(
    'agent_flag_changed', ['agent_flag_changed'],
    [...common, 'customEvent:slot', 'customEvent:flag', 'customEvent:value', 'customEvent:source'],
    baseMetrics,
    row => pgBaseEventRow_(row, {
      slot: pgInt_(row.d['customEvent:slot'], -1),
      flag: pgText_(row.d['customEvent:flag']),
      flag_value: pgText_(row.d['customEvent:value']),
      source: pgText_(row.d['customEvent:source']),
    }),
  );

  collect(
    'navigation', ['tab_first_view', 'tab_unlocked'],
    [...common, 'customEvent:slot', 'customEvent:tab'], baseMetrics,
    row => pgBaseEventRow_(row, {
      slot: pgInt_(row.d['customEvent:slot'], -1),
      tab: pgText_(row.d['customEvent:tab']),
    }),
  );

  collect(
    'zone_entered', ['zone_entered'],
    [...common, 'customEvent:slot', 'customEvent:zone'], baseMetrics,
    row => pgBaseEventRow_(row, {
      slot: pgInt_(row.d['customEvent:slot'], -1),
      zone: pgText_(row.d['customEvent:zone']),
    }),
  );

  collect(
    'errors', ['save_failed', 'load_failed'],
    [...common, 'customEvent:slot', 'customEvent:fatal'], baseMetrics,
    row => pgBaseEventRow_(row, {
      slot: pgInt_(row.d['customEvent:slot'], -1),
      fatal: pgText_(row.d['customEvent:fatal']),
    }),
  );

  return rows;
}

function pgBuildOnboardingRows_(startDate, endDate) {
  const eventNames = [
    'onboarding_started', 'onboarding_step_completed', 'onboarding_resumed',
    'onboarding_completed', 'onboarding_failed',
  ];
  const dimensions = [
    'date', 'eventName', 'customEvent:platform', 'customEvent:game_version',
    'customEvent:internal_tester', 'customEvent:onboarding_version',
    'customEvent:step', 'customEvent:next_step', 'customEvent:slot',
  ];
  const metrics = ['activeUsers', 'eventCount', 'customEvent:seconds_since_new_game'];
  return pgRunReport_(dimensions, metrics, startDate, endDate)
    .filter(row => eventNames.includes(row.d.eventName))
    .map(row => {
      const eventCount = pgInt_(row.m.eventCount, 0);
      const seconds = pgNum_(row.m['customEvent:seconds_since_new_game'], 0);
      return {
        date: pgGaDate_(row.d.date),
        event_name: row.d.eventName,
        step: pgText_(row.d['customEvent:step']),
        next_step: pgText_(row.d['customEvent:next_step']),
        platform: pgText_(row.d['customEvent:platform']),
        game_version: pgText_(row.d['customEvent:game_version']),
        onboarding_version: pgText_(row.d['customEvent:onboarding_version']),
        audience: pgAudience_(row.d['customEvent:internal_tester']),
        users: pgInt_(row.m.activeUsers, 0),
        event_count: eventCount,
        avg_seconds_since_new_game: eventCount > 0 ? seconds / eventCount : null,
        slot: pgInt_(row.d['customEvent:slot'], -1),
        zone: PG_UNKNOWN,
        outcome: PG_UNKNOWN,
        extra_dimensions: {},
        extra_metrics: {},
      };
    });
}

function pgBuildSegmentRows_(startDate, endDate) {
  const dimensions = [
    'date', 'eventName', 'customEvent:platform', 'customEvent:game_version',
    'customEvent:internal_tester', 'customEvent:slot', 'customEvent:segment_index',
  ];
  const metrics = [
    'activeUsers', 'eventCount', 'customEvent:duration_s', 'customEvent:money_delta',
    'customEvent:rep_delta', 'customEvent:captured', 'customEvent:shinies',
    'customEvent:battles_won',
  ];
  return pgRunReport_(dimensions, metrics, startDate, endDate)
    .filter(row => row.d.eventName === 'game_segment_completed')
    .map(row => {
      const count = pgInt_(row.m.eventCount, 0);
      const avg = name => count > 0 ? pgNum_(row.m[name], 0) / count : null;
      return {
        date: pgGaDate_(row.d.date),
        platform: pgText_(row.d['customEvent:platform']),
        game_version: pgText_(row.d['customEvent:game_version']),
        audience: pgAudience_(row.d['customEvent:internal_tester']),
        slot: pgInt_(row.d['customEvent:slot'], -1),
        segment_index: pgInt_(row.d['customEvent:segment_index'], -1),
        users: pgInt_(row.m.activeUsers, 0),
        event_count: count,
        avg_duration_s: avg('customEvent:duration_s'),
        avg_money_delta: avg('customEvent:money_delta'),
        avg_rep_delta: avg('customEvent:rep_delta'),
        avg_captured: avg('customEvent:captured'),
        avg_shinies: avg('customEvent:shinies'),
        avg_battles_won: avg('customEvent:battles_won'),
        extra_metrics: {},
      };
    });
}

function pgBaseEventRow_(row, overrides) {
  return Object.assign({
    date: pgGaDate_(row.d.date),
    event_name: row.d.eventName,
    platform: pgText_(row.d['customEvent:platform']),
    game_version: pgText_(row.d['customEvent:game_version']),
    save_state: PG_UNKNOWN,
    audience: pgAudience_(row.d['customEvent:internal_tester']),
    capture_source: PG_UNKNOWN,
    users: pgInt_(row.m.activeUsers, 0),
    event_count: pgInt_(row.m.eventCount, 0),
    slot: -1,
    zone: PG_UNKNOWN,
    trainer: PG_UNKNOWN,
    mode: PG_UNKNOWN,
    initiated_by: PG_UNKNOWN,
    source: PG_UNKNOWN,
    tab: PG_UNKNOWN,
    team: PG_UNKNOWN,
    team_slot: -1,
    flag: PG_UNKNOWN,
    flag_value: PG_UNKNOWN,
    elite: PG_UNKNOWN,
    has_agent: PG_UNKNOWN,
    unassigned: PG_UNKNOWN,
    fatal: PG_UNKNOWN,
    reason: PG_UNKNOWN,
    segment_index: -1,
    extra_dimensions: {},
    extra_metrics: {},
  }, overrides || {});
}

function pgRunReport_(dimensionNames, metricNames, startDate, endDate) {
  const request = AnalyticsData.newRunReportRequest();
  request.dimensions = dimensionNames.map(name => {
    const dimension = AnalyticsData.newDimension();
    dimension.name = name;
    return dimension;
  });
  request.metrics = metricNames.map(name => {
    const metric = AnalyticsData.newMetric();
    metric.name = name;
    return metric;
  });
  const dateRange = AnalyticsData.newDateRange();
  dateRange.startDate = startDate;
  dateRange.endDate = endDate;
  request.dateRanges = [dateRange];
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

function pgSupabaseAnalyticsRequest_(payload) {
  const response = UrlFetchApp.fetch(PG_SUPABASE_ANALYTICS_INGEST_URL, {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
    },
    payload: JSON.stringify(payload),
  });
  const text = response.getContentText();
  const code = response.getResponseCode();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch (_) { body = { raw: text }; }
  if (code < 200 || code >= 300) {
    throw new Error(`Supabase analytics ingest failed (${code}): ${text}`);
  }
  return body;
}

function pgGaDate_(value) {
  const text = String(value || '');
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  throw new Error(`Unexpected GA4 date: ${text}`);
}

function pgText_(value) {
  const text = String(value == null ? '' : value).trim();
  return PG_NOT_SET_VALUES.has(text) ? PG_UNKNOWN : text;
}

function pgAudience_(value) {
  const text = String(value == null ? '' : value).trim().toLowerCase();
  if (text === 'true' || text === '1') return 'internal';
  if (text === 'false' || text === '0') return 'external';
  return 'unknown';
}

function pgInt_(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pgNum_(value, fallback) {
  const parsed = Number(String(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}
