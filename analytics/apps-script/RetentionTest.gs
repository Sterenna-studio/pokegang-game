/**
 * Read-only smoke test for the GA4 cohort report.
 * It does not write to Supabase and does not create a trigger.
 */
function pgTestGa4RetentionAccess() {
  const completeEndDate = pgCompleteDateRange_(1).endDate;
  const cohortDates = pgRetentionCohortDates_(completeEndDate, 15);
  const rows = pgBuildRetentionRows_(cohortDates, completeEndDate);
  const sample = rows.slice(-5);
  console.log(JSON.stringify({
    ok: true,
    reports_requested: pgRetentionLastReportCount_,
    rows: rows.length,
    complete_end_date: completeEndDate,
    sample,
  }, null, 2));
  return sample;
}
