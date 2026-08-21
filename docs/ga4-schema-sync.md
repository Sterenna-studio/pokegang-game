# GA4 custom definitions as code — Apps Script

PokéGang keeps its GA4 custom-dimension/custom-metric contract in
[`analytics/ga4-definitions.json`](../analytics/ga4-definitions.json).

The live GA4 property is synchronized by a small Google Apps Script running as
the Analytics owner/editor account. This avoids a billable Google Cloud setup,
service-account JSON keys and GitHub secrets.

## Source of truth

- Event semantics: [`docs/analytics-events.md`](analytics-events.md)
- GA4 registered custom definitions: [`analytics/ga4-definitions.json`](../analytics/ga4-definitions.json)
- Apps Script source: [`analytics/apps-script/`](../analytics/apps-script/)
- CI validation: [`tools/validate-ga4-definitions.mjs`](../tools/validate-ga4-definitions.mjs)

`game_instance_id` and free-form error `reason` are intentionally not registered
as GA4 report dimensions because of high-cardinality risk.

## Safety model

The Apps Script:

- creates missing definitions present in the manifest;
- updates only mutable `displayName` / `description` drift;
- stops on immutable scope or metric-unit conflicts;
- never archives or deletes unmanaged GA4 definitions;
- reads the public manifest directly from the repository `main` branch.

## One-time setup — no service account

1. Open <https://script.google.com> with the Google account that has Editor or
   Administrator access to GA4 property `547494860`.
2. Create a project named **PokéGang Analytics**.
3. In Project Settings, enable **Show `appsscript.json` manifest file in editor**.
4. Replace `Code.gs` with [`analytics/apps-script/Code.gs`](../analytics/apps-script/Code.gs).
5. Replace `appsscript.json` with
   [`analytics/apps-script/appsscript.json`](../analytics/apps-script/appsscript.json).
6. Save.

The manifest enables the **Google Analytics Admin API** and **Google Analytics
Data API** advanced services for the Apps Script default Cloud project. No
service-account private key is used.

## First authorization / smoke test

Run these functions from the Apps Script editor, in this order:

1. `pgCheckGa4Definitions`
   - Google asks you to authorize Analytics access on first run.
   - The execution log reports `OK`, `MISSING`, `DRIFT` and `UNMANAGED` fields.
   - This function does not change GA4.
2. `pgApplyGa4Definitions`
   - Creates missing managed custom dimensions/metrics and updates safe metadata.
   - Run only after reviewing the check log.
3. `pgTestGa4DataAccess`
   - Reads yesterday's `activeUsers` through the Analytics Data API.
   - This is the smoke test for the future GA4 → Supabase import.

The manifest URL intentionally targets the repository `main` branch, so merge
the analytics schema change before the first real sync.

## Future changes

When gameplay starts emitting a new bounded-cardinality parameter that needs to
be reportable:

1. document it in `docs/analytics-events.md`;
2. add it to `analytics/ga4-definitions.json`;
3. let GitHub CI validate the manifest;
4. merge the change;
5. run `pgCheckGa4Definitions`, then `pgApplyGa4Definitions` in Apps Script.

No Google Cloud Console, billing account, service-account JSON or GitHub secret
is required for this schema-management path.

The next stage will reuse the same Apps Script project's Analytics Data access
to export aggregate reports into the dedicated PokéGang Supabase backend.
