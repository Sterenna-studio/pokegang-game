# GA4 filtered dimension accounting

The GA4 Data API counts a dimension referenced by `dimensionFilter` toward the maximum of 9 nested dimensions, even when that field is not part of the explicit `dimensions` array.

`Sync.gs` therefore treats `eventName` as one additional nested dimension. Detailed reports that need 9 explicit dimensions are executed one complete day at a time without the explicit `date` dimension, and that known date is restored on each returned row before the Supabase payload is built.

This preserves detailed analytics fields while remaining within the API limit.
