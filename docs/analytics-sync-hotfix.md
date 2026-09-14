# GA4 sync hotfix — nested dimension limit

The GA4 Data API counts the `eventName` field used by `dimensionFilter` toward its limit of 9 nested dimensions.

For detailed gameplay reports that need 9 explicit dimensions, `Sync.gs` now queries one complete day at a time without the explicit `date` dimension, then restores the known day on each row before mapping it to the Supabase payload. This keeps the full detail (`shiny`, trainer, previous zone, etc.) without crossing the GA4 request limit.

The sync metadata is bumped to `apps_script_version: 3` so production runs can be distinguished from the affected v2 sync.
