# Supabase setup

This project can run without Supabase. Supabase enables:

- account login/signup
- cloud save per save slot
- rolling restore snapshots
- public pokegang_leaderboard
- online gang competition / raids

## 1. Create the local config

Create `config.js` at the repo root. Keep it local; it is ignored by Git.

```js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-or-publishable-key';
```

Only use the browser-safe anon/publishable key here. Never put a `service_role` key in this file.

## 2. Create the database schema

Open the Supabase Dashboard for the project, then go to SQL Editor and run:

[supabase-schema.sql](./supabase-schema.sql)

The schema creates every table currently used by the frontend:

- `pokegang_saves`: current cloud save per authenticated user and save slot
- `pokegang_save_snapshots`: recent restore points
- `pokegang_players`: authenticated account stats row
- `pokegang_leaderboard`: public all-time/monthly pokegang_leaderboard
- `pokegang_gang_defenses`: published PvP defenses, including the active 3-Pokémon Boss team and up to three defender agents in `defense_agent`
- `pokegang_gang_raids`: PvP raid records and defender acknowledgements

The SQL is written to be rerunnable for normal updates: it uses `create table if not exists`, adds missing columns, enables RLS, drops/recreates the expected policies, and creates useful indexes.

## 3. RLS model

Supabase recommends enabling Row Level Security on tables exposed through the Data API. The SQL does that for every table in `public`.

Access model:

- `pokegang_saves`, `pokegang_save_snapshots`, `pokegang_players`: authenticated users can only read/write their own rows.
- `pokegang_leaderboard`: public read only. Direct browser writes are revoked — all writes go through the `pokegang-leaderboard-submit` Edge Function (service role), which validates, sanitizes (anti-XSS) and clamps the payload. Anonymous players are still supported via a local browser token; the function links `user_id` only when a valid access token is supplied.
- `pokegang_gang_defenses`: public read, authenticated pokegang_players write only their own published defense. The `defense_agent` column stores a JSON array of up to 3 defender agents; legacy rows can still contain a single object and are handled by the app.
- `pokegang_gang_raids`: authenticated attackers can insert raids; attackers and defenders can read their raids; defenders can only update `seen_by_defender` to acknowledge raids. PvP raids do not transfer reputation anymore, only money rewards and penalties are recorded.

Scope note: the leaderboard write path now goes through an Edge Function that
sanitizes names (kills stored XSS) and clamps numeric fields, and revokes direct
browser writes. This stops injection and blatant garbage, and prevents overwriting
another authenticated player's row. It is NOT full score anti-cheat: the game is
100% client-side, so a determined client can still report inflated-but-well-formed
stats. True score verification would require moving game logic server-side.

Rollout order (important): deploy the Edge Function FIRST, then run the schema SQL
(which revokes direct writes). Reversing the order makes leaderboard writes fail
silently until the function is live.

  supabase functions deploy pokegang-leaderboard-submit
  # then re-run docs/supabase-schema.sql in the SQL editor

## 4. Auth settings

Enable the auth providers you want in Supabase Authentication. The current UI uses email/password:

- sign up: `auth.signUp({ email, password })`
- sign in: `auth.signInWithPassword({ email, password })`
- sign out: `auth.signOut()`

If email confirmations are enabled, new users may need to confirm their email before login works.

## 5. Smoke test

After running the SQL and creating `config.js`:

1. Open the game.
2. Go to `Compte`.
3. Create an account or sign in.
4. Trigger a save and confirm no Supabase error is shown.
5. Open `Raids`, set the active Boss team in `Gang` if needed, then publish the base. The defense uses the 3-Pokémon Boss team plus up to 3 defender agents.
6. In Supabase Table Editor, verify rows appear in `pokegang_saves`, `pokegang_leaderboard`, and `pokegang_gang_defenses`.
7. Confirm a raid record stores `rep_delta = 0` and only money is transferred on raid results.

The PvP list only shows real opponents if at least two different authenticated users have published bases.

## Reference

- Supabase RLS documentation: https://supabase.com/docs/guides/database/postgres/row-level-security
