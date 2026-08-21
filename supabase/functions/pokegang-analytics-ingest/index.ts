import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const GA4_PROPERTY_ID = "547494860";
const GA4_ADMIN_PROPERTY_URL = `https://analyticsadmin.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}`;

const REPORTS = {
  traffic: {
    table: "pokegang_analytics_traffic_daily",
    conflict: "date,host_name,city,country,device_category",
    columns: [
      "date", "host_name", "city", "country", "device_category",
      "active_users", "new_users", "sessions", "engaged_sessions",
      "engagement_seconds", "page_views",
    ],
  },
  acquisition: {
    table: "pokegang_analytics_acquisition_daily",
    conflict: "date,source,medium,campaign",
    columns: [
      "date", "source", "medium", "campaign", "active_users",
      "new_users", "sessions", "engaged_sessions",
    ],
  },
  events: {
    table: "pokegang_analytics_events_daily",
    conflict: [
      "date", "event_name", "platform", "game_version", "save_state",
      "audience", "capture_source", "slot", "zone", "trainer", "mode",
      "initiated_by", "source", "tab", "team", "team_slot", "flag",
      "flag_value", "elite", "has_agent", "unassigned", "fatal", "reason",
      "segment_index", "extra_dimensions",
    ].join(","),
    columns: [
      "date", "event_name", "platform", "game_version", "save_state",
      "audience", "capture_source", "users", "event_count", "slot", "zone",
      "trainer", "mode", "initiated_by", "source", "tab", "team",
      "team_slot", "flag", "flag_value", "elite", "has_agent", "unassigned",
      "fatal", "reason", "segment_index", "extra_dimensions", "extra_metrics",
    ],
  },
  onboarding: {
    table: "pokegang_analytics_onboarding_daily",
    conflict: [
      "date", "event_name", "step", "next_step", "platform", "game_version",
      "onboarding_version", "audience", "slot", "zone", "outcome",
      "extra_dimensions",
    ].join(","),
    columns: [
      "date", "event_name", "step", "next_step", "platform", "game_version",
      "onboarding_version", "audience", "users", "event_count",
      "avg_seconds_since_new_game", "slot", "zone", "outcome",
      "extra_dimensions", "extra_metrics",
    ],
  },
  segments: {
    table: "pokegang_analytics_segments_daily",
    conflict: "date,platform,game_version,audience,slot,segment_index",
    columns: [
      "date", "platform", "game_version", "audience", "slot", "segment_index",
      "users", "event_count", "avg_duration_s", "avg_money_delta",
      "avg_rep_delta", "avg_captured", "avg_shinies", "avg_battles_won",
      "extra_metrics",
    ],
  },
  retention: {
    table: "pokegang_analytics_retention",
    conflict: "cohort_date,platform,game_version,audience",
    columns: [
      "cohort_date", "platform", "game_version", "audience", "cohort_size",
      "returned_d1", "returned_d3", "returned_d7", "returned_d14",
    ],
  },
} as const;

type ReportName = keyof typeof REPORTS;
type SyncDataset = { report: ReportName; rows: Record<string, unknown>[] };

type SyncPayload = {
  action?: "ping" | "sync";
  start_date?: string;
  end_date?: string;
  reports_requested?: number;
  datasets?: SyncDataset[];
  client_errors?: string[];
  metadata?: Record<string, unknown>;
};

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function bearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

async function verifyGoogleAnalyticsAccess(token: string) {
  const response = await fetch(GA4_ADMIN_PROPERTY_URL, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const text = await response.text();
    console.warn("[analytics-ingest] GA4 token verification failed", response.status, text.slice(0, 500));
    return false;
  }
  const property = await response.json();
  return property?.name === `properties/${GA4_PROPERTY_ID}`;
}

function validDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function sanitizeRow(report: ReportName, input: Record<string, unknown>) {
  const spec = REPORTS[report];
  const out: Record<string, unknown> = {};
  for (const column of spec.columns) {
    if (Object.prototype.hasOwnProperty.call(input, column)) out[column] = input[column];
  }
  out.synced_at = new Date().toISOString();
  return out;
}

async function upsertDataset(
  supabase: ReturnType<typeof createClient>,
  dataset: SyncDataset,
) {
  const spec = REPORTS[dataset.report];
  if (!spec) throw new Error(`Unsupported report: ${dataset.report}`);
  if (!Array.isArray(dataset.rows)) throw new Error(`Rows for ${dataset.report} must be an array`);
  if (dataset.rows.length > 10_000) throw new Error(`Too many rows for ${dataset.report}: ${dataset.rows.length}`);

  let written = 0;
  for (let offset = 0; offset < dataset.rows.length; offset += 500) {
    const chunk = dataset.rows.slice(offset, offset + 500).map(row => sanitizeRow(dataset.report, row));
    if (!chunk.length) continue;
    const { error } = await supabase
      .from(spec.table)
      .upsert(chunk, { onConflict: spec.conflict, ignoreDuplicates: false });
    if (error) throw new Error(`${dataset.report} upsert failed: ${error.message}`);
    written += chunk.length;
  }
  return written;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const token = bearerToken(req);
  if (!token) return json(401, { error: "missing_google_bearer_token" });
  if (!(await verifyGoogleAnalyticsAccess(token))) {
    return json(403, { error: "google_token_cannot_access_pokegang_ga4_property" });
  }

  let payload: SyncPayload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  if ((payload.action || "sync") === "ping") {
    return json(200, { ok: true, property_id: GA4_PROPERTY_ID });
  }

  if (!validDate(payload.start_date) || !validDate(payload.end_date)) {
    return json(400, { error: "start_date_and_end_date_required" });
  }
  if (!Array.isArray(payload.datasets)) return json(400, { error: "datasets_required" });
  if (payload.datasets.length > 20) return json(400, { error: "too_many_datasets" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "supabase_runtime_secrets_missing" });

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const clientErrors = (payload.client_errors || []).map(String).slice(0, 50);
  const reportsRequested = Number.isFinite(payload.reports_requested)
    ? Math.max(0, Number(payload.reports_requested))
    : payload.datasets.length;

  const { data: run, error: runError } = await supabase
    .from("pokegang_analytics_sync_runs")
    .insert({
      status: "running",
      start_date: payload.start_date,
      end_date: payload.end_date,
      reports_requested: reportsRequested,
      rows_written: 0,
      metadata: {
        source: "google_apps_script",
        property_id: GA4_PROPERTY_ID,
        ...(payload.metadata || {}),
        client_errors: clientErrors,
      },
    })
    .select("id")
    .single();

  if (runError || !run?.id) {
    return json(500, { error: "cannot_create_sync_run", detail: runError?.message || null });
  }

  let rowsWritten = 0;
  const serverErrors: string[] = [];
  const perReport: Record<string, number> = {};

  for (const dataset of payload.datasets) {
    try {
      if (!REPORTS[dataset.report]) throw new Error(`Unsupported report: ${dataset.report}`);
      const count = await upsertDataset(supabase, dataset);
      rowsWritten += count;
      perReport[dataset.report] = (perReport[dataset.report] || 0) + count;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      serverErrors.push(message.slice(0, 1000));
      console.error("[analytics-ingest]", message);
    }
  }

  const allErrors = [...clientErrors, ...serverErrors];
  const successfulDatasets = Object.keys(perReport).length;
  const status = allErrors.length === 0
    ? "success"
    : successfulDatasets > 0
      ? "partial"
      : "failed";

  const { error: finishError } = await supabase
    .from("pokegang_analytics_sync_runs")
    .update({
      completed_at: new Date().toISOString(),
      status,
      rows_written: rowsWritten,
      error_message: allErrors.length ? allErrors.join(" | ").slice(0, 8000) : null,
      metadata: {
        source: "google_apps_script",
        property_id: GA4_PROPERTY_ID,
        ...(payload.metadata || {}),
        client_errors: clientErrors,
        server_errors: serverErrors,
        per_report: perReport,
      },
    })
    .eq("id", run.id);

  if (finishError) {
    return json(500, {
      error: "sync_completed_but_run_log_update_failed",
      run_id: run.id,
      status,
      rows_written: rowsWritten,
      detail: finishError.message,
    });
  }

  return json(status === "failed" ? 500 : 200, {
    ok: status !== "failed",
    run_id: run.id,
    status,
    rows_written: rowsWritten,
    per_report: perReport,
    errors: allErrors,
  });
});
