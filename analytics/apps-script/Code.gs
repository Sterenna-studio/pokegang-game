const PG_GA4_PROPERTY_ID = '547494860';
const PG_GA4_ADMIN_BASE = 'https://analyticsadmin.googleapis.com/v1beta';
const PG_GA4_MANIFEST_URL = 'https://raw.githubusercontent.com/Sterenna-studio/pokegang-game/main/analytics/ga4-definitions.json';

/**
 * Read-only comparison between GA4 and analytics/ga4-definitions.json.
 * Run this first after authorizing the Apps Script project.
 */
function pgCheckGa4Definitions() {
  return pgSyncGa4Definitions_(false);
}

/**
 * Creates missing managed definitions and updates safe mutable fields.
 * Never archives or deletes definitions that are not in the manifest.
 */
function pgApplyGa4Definitions() {
  return pgSyncGa4Definitions_(true);
}

/** Basic smoke-test for the future GA4 -> Supabase reporting pipeline. */
function pgTestGa4DataAccess() {
  const metric = AnalyticsData.newMetric();
  metric.name = 'activeUsers';

  const dateRange = AnalyticsData.newDateRange();
  dateRange.startDate = 'yesterday';
  dateRange.endDate = 'yesterday';

  const request = AnalyticsData.newRunReportRequest();
  request.metrics = [metric];
  request.dateRanges = [dateRange];

  const report = AnalyticsData.Properties.runReport(
    request,
    `properties/${PG_GA4_PROPERTY_ID}`,
  );
  const value = report.rows?.[0]?.metricValues?.[0]?.value ?? '0';
  console.log(`GA4 Data API OK — activeUsers yesterday: ${value}`);
  return value;
}

function pgSyncGa4Definitions_(apply) {
  const schema = pgLoadManifest_();
  if (String(schema.propertyId) !== PG_GA4_PROPERTY_ID) {
    throw new Error(`Manifest property ${schema.propertyId} does not match ${PG_GA4_PROPERTY_ID}`);
  }

  const dimensions = pgListAll_('customDimensions', 'customDimensions');
  const metrics = pgListAll_('customMetrics', 'customMetrics');

  const dimensionDrift = pgSyncCollection_(
    schema.customDimensions || [], dimensions, 'customDimensions', 'dimension', apply,
  );
  const metricDrift = pgSyncCollection_(
    schema.customMetrics || [], metrics, 'customMetrics', 'metric', apply,
  );

  const result = {
    apply,
    dimensions: schema.customDimensions?.length || 0,
    metrics: schema.customMetrics?.length || 0,
    drift: dimensionDrift + metricDrift,
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function pgLoadManifest_() {
  const response = UrlFetchApp.fetch(PG_GA4_MANIFEST_URL, {
    muteHttpExceptions: true,
    headers: { 'User-Agent': 'Pokegang-GA4-Apps-Script' },
  });
  if (response.getResponseCode() !== 200) {
    throw new Error(`Cannot load GA4 manifest from GitHub: HTTP ${response.getResponseCode()}`);
  }
  return JSON.parse(response.getContentText());
}

function pgListAll_(resource, fieldName) {
  const rows = [];
  let pageToken = '';
  do {
    const query = [`pageSize=200`];
    if (pageToken) query.push(`pageToken=${encodeURIComponent(pageToken)}`);
    const body = pgGaAdminRequest_(
      `properties/${PG_GA4_PROPERTY_ID}/${resource}?${query.join('&')}`,
      'get',
    );
    rows.push(...(body[fieldName] || []));
    pageToken = body.nextPageToken || '';
  } while (pageToken);
  return rows;
}

function pgSyncCollection_(desired, existing, resource, kind, apply) {
  const byParameter = new Map(existing.map(item => [item.parameterName, item]));
  let drift = 0;

  desired.forEach(item => {
    const found = byParameter.get(item.parameterName);
    if (!found) {
      drift++;
      console.log(`MISSING ${kind}: ${item.parameterName}`);
      if (apply) {
        pgGaAdminRequest_(
          `properties/${PG_GA4_PROPERTY_ID}/${resource}`,
          'post',
          item,
        );
        console.log(`CREATED ${kind}: ${item.parameterName}`);
      }
      return;
    }

    if (found.scope !== item.scope) {
      throw new Error(`${kind} ${item.parameterName}: scope mismatch (${found.scope} vs ${item.scope})`);
    }
    if (kind === 'metric' && found.measurementUnit !== item.measurementUnit) {
      throw new Error(`${kind} ${item.parameterName}: measurementUnit mismatch (${found.measurementUnit} vs ${item.measurementUnit})`);
    }

    const changes = [];
    if (found.displayName !== item.displayName) changes.push('displayName');
    if ((found.description || '') !== (item.description || '')) changes.push('description');

    if (!changes.length) {
      console.log(`OK ${kind}: ${item.parameterName}`);
      return;
    }

    drift++;
    console.log(`DRIFT ${kind}: ${item.parameterName} (${changes.join(', ')})`);
    if (apply) {
      const patch = {};
      changes.forEach(field => patch[field] = item[field] || '');
      pgGaAdminRequest_(
        `${found.name}?updateMask=${encodeURIComponent(changes.join(','))}`,
        'patch',
        patch,
      );
      console.log(`UPDATED ${kind}: ${item.parameterName}`);
    }
  });

  const managedNames = new Set(desired.map(item => item.parameterName));
  existing
    .filter(item => !managedNames.has(item.parameterName))
    .forEach(item => console.log(`UNMANAGED ${kind}: ${item.parameterName} — left untouched`));

  return drift;
}

function pgGaAdminRequest_(path, method, payload) {
  const options = {
    method,
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
    },
  };
  if (payload !== undefined) options.payload = JSON.stringify(payload);

  const response = UrlFetchApp.fetch(`${PG_GA4_ADMIN_BASE}/${path}`, options);
  const text = response.getContentText();
  const body = text ? JSON.parse(text) : {};
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error(`GA Admin API ${method.toUpperCase()} ${path} failed (${code}): ${text}`);
  }
  return body;
}
