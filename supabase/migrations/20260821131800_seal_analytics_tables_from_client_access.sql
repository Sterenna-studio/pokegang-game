-- Explicit deny policies for backend-only analytics tables.
-- Table privileges are already revoked from anon/authenticated; these policies
-- document the intent and keep the Supabase advisor from reporting RLS-without-policy.

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'pokegang_analytics_traffic_daily',
    'pokegang_analytics_acquisition_daily',
    'pokegang_analytics_events_daily',
    'pokegang_analytics_onboarding_daily',
    'pokegang_analytics_segments_daily',
    'pokegang_analytics_retention',
    'pokegang_analytics_sync_runs'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', 'analytics_backend_only', tbl);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (false) with check (false)',
      'analytics_backend_only',
      tbl
    );
  end loop;
end
$$;
