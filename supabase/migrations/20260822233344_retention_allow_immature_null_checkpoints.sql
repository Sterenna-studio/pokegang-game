alter table public.pokegang_analytics_retention
  alter column returned_d1 drop not null,
  alter column returned_d1 drop default,
  alter column returned_d3 drop not null,
  alter column returned_d3 drop default,
  alter column returned_d7 drop not null,
  alter column returned_d7 drop default,
  alter column returned_d14 drop not null,
  alter column returned_d14 drop default;

comment on column public.pokegang_analytics_retention.returned_d1 is
  'Users active on cohort day 1; NULL until the cohort is old enough for D1 to be complete.';
comment on column public.pokegang_analytics_retention.returned_d3 is
  'Users active on cohort day 3; NULL until the cohort is old enough for D3 to be complete.';
comment on column public.pokegang_analytics_retention.returned_d7 is
  'Users active on cohort day 7; NULL until the cohort is old enough for D7 to be complete.';
comment on column public.pokegang_analytics_retention.returned_d14 is
  'Users active on cohort day 14; NULL until the cohort is old enough for D14 to be complete.';
