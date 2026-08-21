# GA4 custom definitions as code

PokéGang keeps the GA4 custom-dimension/custom-metric contract in
[`analytics/ga4-definitions.json`](../analytics/ga4-definitions.json).

This avoids manually recreating dozens of definitions in the GA4 UI after each
analytics change. The manifest is synchronized through the Google Analytics
Admin API by [`tools/sync-ga4-definitions.mjs`](../tools/sync-ga4-definitions.mjs).

## Safety model

- The sync only manages definitions explicitly present in the manifest.
- Missing managed definitions can be created.
- `displayName` and `description` can be updated.
- Immutable scope mismatches fail loudly.
- Metric-unit mismatches fail loudly for manual review.
- Existing GA4 definitions not present in the manifest are **never archived or deleted** automatically.
- `game_instance_id` and free-form error `reason` are intentionally not registered as report dimensions because of high-cardinality risk.

## One-time Google setup

1. In a Google Cloud project, enable **Google Analytics Admin API**.
2. Create a service account dedicated to GA4 administration, for example
   `pokegang-ga4-admin`.
3. In GA4 property `547494860`, add that service-account email as **Editor**
   (or Administrator). Viewer access is not enough to create/update custom
   definitions.
4. Create a JSON key for that service account.
5. Base64-encode the full JSON file and save it as the GitHub repository secret:

   `GA4_ADMIN_SERVICE_ACCOUNT_JSON_B64`

On Windows PowerShell:

```powershell
$file = '.\pokegang-ga4-admin.json'
[Convert]::ToBase64String([IO.File]::ReadAllBytes($file)) | Set-Clipboard
```

Never commit the JSON key itself.

## Using the workflow

GitHub → **Actions** → **GA4 custom schema** → **Run workflow**.

- `check`: compares the live GA4 property with the manifest and fails when a
  managed definition is missing or has drifted.
- `apply`: creates missing definitions and updates safe mutable fields.

Pull requests that edit the manifest or sync tool run local validation without
needing Google credentials.

## Adding analytics fields later

When gameplay starts emitting a new parameter that needs to be queryable by the
GA4 Data API:

1. Update `docs/analytics-events.md`.
2. Add the corresponding definition to `analytics/ga4-definitions.json` if it
   is useful for reporting and has bounded cardinality.
3. Open/merge the PR.
4. Run the **GA4 custom schema** workflow in `check` mode.
5. Review the drift, then run it in `apply` mode.

The Data API can reference an event-scoped custom dimension or metric after it
has been registered, using names such as `customEvent:capture_source` or
`customEvent:seconds_since_new_game`.
