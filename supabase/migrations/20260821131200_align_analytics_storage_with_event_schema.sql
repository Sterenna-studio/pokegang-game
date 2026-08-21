-- Align PokéGang analytics storage with docs/analytics-events.md

alter table public.pokegang_analytics_events_daily
  drop constraint if exists pokegang_analytics_events_daily_unique;

alter table public.pokegang_analytics_events_daily
  add column if not exists slot smallint not null default -1,
  add column if not exists zone text not null default 'unknown',
  add column if not exists trainer text not null default 'unknown',
  add column if not exists mode text not null default 'unknown',
  add column if not exists initiated_by text not null default 'unknown',
  add column if not exists source text not null default 'unknown',
  add column if not exists tab text not null default 'unknown',
  add column if not exists team text not null default 'unknown',
  add column if not exists team_slot smallint not null default -1,
  add column if not exists flag text not null default 'unknown',
  add column if not exists flag_value text not null default 'unknown',
  add column if not exists elite text not null default 'unknown',
  add column if not exists has_agent text not null default 'unknown',
  add column if not exists unassigned text not null default 'unknown',
  add column if not exists fatal text not null default 'unknown',
  add column if not exists reason text not null default 'unknown',
  add column if not exists segment_index integer not null default -1,
  add column if not exists extra_dimensions jsonb not null default '{}'::jsonb,
  add column if not exists extra_metrics jsonb not null default '{}'::jsonb;

alter table public.pokegang_analytics_events_daily
  add constraint pokegang_analytics_events_daily_slot_check
    check (slot between -1 and 2),
  add constraint pokegang_analytics_events_daily_team_slot_check
    check (team_slot between -1 and 5),
  add constraint pokegang_analytics_events_daily_flag_value_check
    check (flag_value in ('true','false','unknown')),
  add constraint pokegang_analytics_events_daily_elite_check
    check (elite in ('true','false','unknown')),
  add constraint pokegang_analytics_events_daily_has_agent_check
    check (has_agent in ('true','false','unknown')),
  add constraint pokegang_analytics_events_daily_unassigned_check
    check (unassigned in ('true','false','unknown')),
  add constraint pokegang_analytics_events_daily_fatal_check
    check (fatal in ('true','false','unknown'));

alter table public.pokegang_analytics_events_daily
  add constraint pokegang_analytics_events_daily_unique
  unique (
    date,
    event_name,
    platform,
    game_version,
    save_state,
    audience,
    capture_source,
    slot,
    zone,
    trainer,
    mode,
    initiated_by,
    source,
    tab,
    team,
    team_slot,
    flag,
    flag_value,
    elite,
    has_agent,
    unassigned,
    fatal,
    reason,
    segment_index,
    extra_dimensions
  );

create index if not exists pokegang_analytics_events_zone_date_idx
  on public.pokegang_analytics_events_daily(zone, date desc)
  where zone <> 'unknown';

create index if not exists pokegang_analytics_events_tab_date_idx
  on public.pokegang_analytics_events_daily(tab, date desc)
  where tab <> 'unknown';

create index if not exists pokegang_analytics_events_source_date_idx
  on public.pokegang_analytics_events_daily(source, date desc)
  where source <> 'unknown';

create index if not exists pokegang_analytics_events_audience_date_idx
  on public.pokegang_analytics_events_daily(audience, date desc);

alter table public.pokegang_analytics_onboarding_daily
  drop constraint if exists pokegang_analytics_onboarding_daily_unique;

alter table public.pokegang_analytics_onboarding_daily
  add column if not exists slot smallint not null default -1,
  add column if not exists zone text not null default 'unknown',
  add column if not exists outcome text not null default 'unknown',
  add column if not exists extra_dimensions jsonb not null default '{}'::jsonb,
  add column if not exists extra_metrics jsonb not null default '{}'::jsonb;

alter table public.pokegang_analytics_onboarding_daily
  add constraint pokegang_analytics_onboarding_daily_slot_check
    check (slot between -1 and 2);

alter table public.pokegang_analytics_onboarding_daily
  add constraint pokegang_analytics_onboarding_daily_unique
  unique (
    date,
    event_name,
    step,
    next_step,
    platform,
    game_version,
    onboarding_version,
    audience,
    slot,
    zone,
    outcome,
    extra_dimensions
  );

create index if not exists pokegang_analytics_onboarding_audience_date_idx
  on public.pokegang_analytics_onboarding_daily(audience, date desc);

create table if not exists public.pokegang_analytics_segments_daily (
  date date not null,
  platform text not null default 'unknown',
  game_version text not null default 'unknown',
  audience text not null default 'unknown'
    check (audience in ('internal','external','unknown')),
  slot smallint not null default -1
    check (slot between -1 and 2),
  segment_index integer not null default -1,
  users bigint not null default 0 check (users >= 0),
  event_count bigint not null default 0 check (event_count >= 0),
  avg_duration_s numeric(14,2),
  avg_money_delta numeric(18,2),
  avg_rep_delta numeric(18,2),
  avg_captured numeric(14,2),
  avg_shinies numeric(14,2),
  avg_battles_won numeric(14,2),
  extra_metrics jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  constraint pokegang_analytics_segments_daily_unique
    unique (date, platform, game_version, audience, slot, segment_index)
);

alter table public.pokegang_analytics_segments_daily enable row level security;
revoke all on table public.pokegang_analytics_segments_daily from anon, authenticated;
grant select, insert, update, delete on table public.pokegang_analytics_segments_daily to service_role;

create index if not exists pokegang_analytics_segments_date_idx
  on public.pokegang_analytics_segments_daily(date desc);

comment on table public.pokegang_analytics_segments_daily is
'Aggregated GA4 game_segment_completed telemetry. Not a session counter; use GA4 session_start for sessions.';

comment on column public.pokegang_analytics_events_daily.extra_dimensions is
'Future-proof container for GA4 dimensions not promoted to dedicated columns.';

comment on column public.pokegang_analytics_events_daily.extra_metrics is
'Future-proof container for aggregated GA4 custom metrics not promoted to dedicated columns.';

comment on column public.pokegang_analytics_events_daily.slot is
'Active save slot from the global GA4 event context. -1 means legacy/unknown.';

comment on column public.pokegang_analytics_onboarding_daily.slot is
'Active save slot from the global GA4 event context. -1 means legacy/unknown.';

comment on column public.pokegang_analytics_events_daily.audience is
'Normalized from internal_tester: true=internal, false=external, absent legacy data=unknown.';
