-- PokéGang dedicated backend baseline + analytics foundation
-- Remote project: ojklmobvafovftqvevzh (pokegang)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Baseline hardening / storage guardrails
-- ---------------------------------------------------------------------------

drop index if exists public.player_saves_user_slot_idx;

alter function public.pg_generate_profile_token()
  set search_path = public, extensions, pg_catalog;

revoke all on function public.rls_auto_enable() from public, anon, authenticated;
revoke all on function public.pokegang_stats_region_funnel() from public, anon, authenticated;

create or replace function public.pokegang_prune_save_snapshots()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  delete from public.pokegang_save_snapshots
  where id in (
    select id
    from public.pokegang_save_snapshots
    where user_id = new.user_id
      and slot = new.slot
    order by saved_at desc, id desc
    offset 2
  );
  return new;
end;
$$;

drop trigger if exists trg_pokegang_prune_save_snapshots
  on public.pokegang_save_snapshots;

create trigger trg_pokegang_prune_save_snapshots
after insert on public.pokegang_save_snapshots
for each row
execute function public.pokegang_prune_save_snapshots();

revoke all on function public.pokegang_prune_save_snapshots() from public, anon, authenticated;
grant execute on function public.pokegang_prune_save_snapshots() to postgres, service_role;

create index if not exists pokegang_leaderboard_user_id_idx
  on public.pokegang_leaderboard(user_id)
  where user_id is not null;

-- ---------------------------------------------------------------------------
-- GA4 aggregate storage
-- ---------------------------------------------------------------------------

create table if not exists public.pokegang_analytics_traffic_daily (
  date date not null,
  host_name text not null default 'unknown',
  city text not null default 'unknown',
  country text not null default 'unknown',
  device_category text not null default 'unknown',
  active_users bigint not null default 0 check (active_users >= 0),
  new_users bigint not null default 0 check (new_users >= 0),
  sessions bigint not null default 0 check (sessions >= 0),
  engaged_sessions bigint not null default 0 check (engaged_sessions >= 0),
  engagement_seconds numeric(14,2) not null default 0 check (engagement_seconds >= 0),
  page_views bigint not null default 0 check (page_views >= 0),
  synced_at timestamptz not null default now(),
  constraint pokegang_analytics_traffic_daily_unique
    unique (date, host_name, city, country, device_category)
);

create table if not exists public.pokegang_analytics_acquisition_daily (
  date date not null,
  source text not null default 'unknown',
  medium text not null default 'unknown',
  campaign text not null default 'unknown',
  active_users bigint not null default 0 check (active_users >= 0),
  new_users bigint not null default 0 check (new_users >= 0),
  sessions bigint not null default 0 check (sessions >= 0),
  engaged_sessions bigint not null default 0 check (engaged_sessions >= 0),
  synced_at timestamptz not null default now(),
  constraint pokegang_analytics_acquisition_daily_unique
    unique (date, source, medium, campaign)
);

create table if not exists public.pokegang_analytics_events_daily (
  date date not null,
  event_name text not null,
  platform text not null default 'unknown',
  game_version text not null default 'unknown',
  save_state text not null default 'unknown',
  audience text not null default 'unknown'
    check (audience in ('internal', 'external', 'unknown')),
  capture_source text not null default 'unknown',
  users bigint not null default 0 check (users >= 0),
  event_count bigint not null default 0 check (event_count >= 0),
  synced_at timestamptz not null default now(),
  constraint pokegang_analytics_events_daily_unique
    unique (date, event_name, platform, game_version, save_state, audience, capture_source)
);

create table if not exists public.pokegang_analytics_onboarding_daily (
  date date not null,
  event_name text not null,
  step text not null default 'unknown',
  next_step text not null default 'unknown',
  platform text not null default 'unknown',
  game_version text not null default 'unknown',
  onboarding_version text not null default 'unknown',
  audience text not null default 'unknown'
    check (audience in ('internal', 'external', 'unknown')),
  users bigint not null default 0 check (users >= 0),
  event_count bigint not null default 0 check (event_count >= 0),
  avg_seconds_since_new_game numeric(12,2),
  synced_at timestamptz not null default now(),
  constraint pokegang_analytics_onboarding_daily_unique
    unique (date, event_name, step, next_step, platform, game_version, onboarding_version, audience)
);

create table if not exists public.pokegang_analytics_retention (
  cohort_date date not null,
  platform text not null default 'unknown',
  game_version text not null default 'unknown',
  audience text not null default 'unknown'
    check (audience in ('internal', 'external', 'unknown')),
  cohort_size bigint not null default 0 check (cohort_size >= 0),
  returned_d1 bigint not null default 0 check (returned_d1 >= 0),
  returned_d3 bigint not null default 0 check (returned_d3 >= 0),
  returned_d7 bigint not null default 0 check (returned_d7 >= 0),
  returned_d14 bigint not null default 0 check (returned_d14 >= 0),
  synced_at timestamptz not null default now(),
  constraint pokegang_analytics_retention_unique
    unique (cohort_date, platform, game_version, audience)
);

create table if not exists public.pokegang_analytics_sync_runs (
  id bigint generated by default as identity primary key,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'success', 'partial', 'failed')),
  start_date date,
  end_date date,
  reports_requested integer not null default 0 check (reports_requested >= 0),
  rows_written integer not null default 0 check (rows_written >= 0),
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists pokegang_analytics_traffic_date_idx
  on public.pokegang_analytics_traffic_daily(date desc);
create index if not exists pokegang_analytics_traffic_city_date_idx
  on public.pokegang_analytics_traffic_daily(city, date desc);
create index if not exists pokegang_analytics_acquisition_date_idx
  on public.pokegang_analytics_acquisition_daily(date desc);
create index if not exists pokegang_analytics_events_name_date_idx
  on public.pokegang_analytics_events_daily(event_name, date desc);
create index if not exists pokegang_analytics_events_version_date_idx
  on public.pokegang_analytics_events_daily(game_version, date desc);
create index if not exists pokegang_analytics_events_platform_date_idx
  on public.pokegang_analytics_events_daily(platform, date desc);
create index if not exists pokegang_analytics_onboarding_step_date_idx
  on public.pokegang_analytics_onboarding_daily(step, date desc);
create index if not exists pokegang_analytics_onboarding_version_date_idx
  on public.pokegang_analytics_onboarding_daily(onboarding_version, date desc);
create index if not exists pokegang_analytics_retention_cohort_idx
  on public.pokegang_analytics_retention(cohort_date desc);
create index if not exists pokegang_analytics_sync_started_idx
  on public.pokegang_analytics_sync_runs(started_at desc);

alter table public.pokegang_analytics_traffic_daily enable row level security;
alter table public.pokegang_analytics_acquisition_daily enable row level security;
alter table public.pokegang_analytics_events_daily enable row level security;
alter table public.pokegang_analytics_onboarding_daily enable row level security;
alter table public.pokegang_analytics_retention enable row level security;
alter table public.pokegang_analytics_sync_runs enable row level security;

revoke all on table
  public.pokegang_analytics_traffic_daily,
  public.pokegang_analytics_acquisition_daily,
  public.pokegang_analytics_events_daily,
  public.pokegang_analytics_onboarding_daily,
  public.pokegang_analytics_retention,
  public.pokegang_analytics_sync_runs
from anon, authenticated;

grant select, insert, update, delete on table
  public.pokegang_analytics_traffic_daily,
  public.pokegang_analytics_acquisition_daily,
  public.pokegang_analytics_events_daily,
  public.pokegang_analytics_onboarding_daily,
  public.pokegang_analytics_retention,
  public.pokegang_analytics_sync_runs
to service_role;

grant usage, select on sequence public.pokegang_analytics_sync_runs_id_seq to service_role;

comment on table public.pokegang_analytics_traffic_daily is 'PokéGang GA4 aggregated daily traffic, geography and device data.';
comment on table public.pokegang_analytics_acquisition_daily is 'PokéGang GA4 aggregated acquisition source/medium/campaign data.';
comment on table public.pokegang_analytics_events_daily is 'PokéGang GA4 aggregated gameplay event telemetry.';
comment on table public.pokegang_analytics_onboarding_daily is 'PokéGang GA4 aggregated onboarding funnel telemetry.';
comment on table public.pokegang_analytics_retention is 'PokéGang aggregated GA4 retention cohorts.';
comment on table public.pokegang_analytics_sync_runs is 'Execution log for PokéGang GA4 to Supabase synchronization.';
