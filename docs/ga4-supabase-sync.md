# GA4 → Supabase analytics sync

PokéGang uses Google Apps Script as the bridge between GA4 and the dedicated
Supabase project `ojklmobvafovftqvevzh`.

## Flow

```text
GA4 Data API
  → analytics/apps-script/Sync.gs
  → pokegang-analytics-ingest Edge Function
  → pokegang_analytics_* tables
```

The Apps Script sends its current Google OAuth token to the Edge Function. The
function validates that token by checking access to GA4 property `547494860`
before using its server-side Supabase service role. No Supabase service-role key
or shared ingestion secret is stored in Apps Script.

## Manual validation

After copying `Sync.gs` into the `PokéGang Analytics` Apps Script project:

1. Run `pgTestSupabaseIngest()`.
2. Run `pgSyncGa4ToSupabase()`.
3. Inspect `pokegang_analytics_sync_runs` in Supabase.

The sync always re-fetches the last 3 complete days and UPSERTs rows, so repeat
runs are safe and late GA4 consolidation is absorbed.

Fresh custom dimensions/metrics can take time to become queryable in the GA4
Data API. Individual report failures are collected and the run is recorded as
`partial`; standard traffic/acquisition reports can still be ingested.

## Scheduling

Once the manual sync is clean, update the Apps Script manifest with the
`script.scriptapp` OAuth scope from `analytics/apps-script/appsscript.json`, then
run:

```text
pgInstallGa4SupabaseSyncTrigger()
```

This replaces any prior PokéGang analytics sync trigger with one approximate
12-hour trigger. To remove it:

```text
pgRemoveGa4SupabaseSyncTriggers()
```

## Current report coverage

- traffic / geography / device
- acquisition source / medium / campaign
- core gameplay events documented in `docs/analytics-events.md`
- onboarding funnel
- `game_segment_completed`

Retention is intentionally deferred until the core import has been validated.
