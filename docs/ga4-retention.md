# GA4 cohort retention → Supabase

PokéGang stores GA4 first-session cohort retention at D1, D3, D7 and D14 in `public.pokegang_analytics_retention`.

## Why this is a separate Apps Script job

The core GA4 → Supabase sync runs every ~12 hours and re-fetches the last 3 complete days. Retention evolves more slowly and needs cohort windows up to 14 days, so it uses a separate daily job in `analytics/apps-script/Retention.gs`.

The report uses GA4 Data API cohort reports with:

- cohort dimension: `firstSessionDate`;
- response dimensions: `cohort`, `cohortNthDay`;
- metrics: `cohortActiveUsers`, `cohortTotalUsers`;
- checkpoints: D1, D3, D7 and D14;
- 45-day rolling cohort lookback.

Cohorts are grouped by maturity before querying, so a one-day-old cohort is only queried through D1 while an older cohort can be queried through D14. This avoids future-date requests and keeps API usage low.

## Important semantics

The first version is deliberately **overall property retention**:

```text
platform = all
game_version = all
audience = unknown
```

PokéGang currently sends `platform`, `game_version` and `internal_tester` as **event-scoped** custom dimensions. Filtering a `firstSessionDate` cohort by them would describe return-event activity rather than reliably freeze those values at acquisition time. We therefore keep the initial retention metric honest and overall rather than pretending to have acquisition-scoped segmentation.

A future version can add web/itch/internal/external cohort segmentation after introducing acquisition-safe or user-scoped attribution.

`returned_d1`, `returned_d3`, `returned_d7` and `returned_d14` are nullable. `NULL` means the cohort is not old enough yet. `0` means the checkpoint is mature and GA4 reported no returning active users.

## Apps Script setup

The existing `PokéGang Analytics` Apps Script project already has the Analytics Data advanced service and the required OAuth scopes.

Copy these repository files into the same Apps Script project:

```text
analytics/apps-script/Retention.gs
analytics/apps-script/RetentionTest.gs
```

Then run, in order:

```text
pgTestGa4RetentionAccess()
pgSyncGa4RetentionToSupabase()
pgInstallGa4RetentionTrigger()
```

The first function is read-only. The second writes/upserts the retention rows through the existing authenticated Supabase Edge Function. The third installs one approximate daily trigger.

To remove the retention schedule:

```text
pgRemoveGa4RetentionTriggers()
```

## Database migration

Remote migration `20260822233344_retention_allow_immature_null_checkpoints` makes the four retention checkpoints nullable so immature cohorts are not falsely recorded as zero-retention cohorts.
