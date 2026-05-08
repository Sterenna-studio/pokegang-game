# Supabase setup

This project can run without Supabase. Supabase enables:

- account login/signup
- cloud save per save slot
- rolling restore snapshots
- public leaderboard
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

- `player_saves`: current cloud save per authenticated user and save slot
- `save_snapshots`: recent restore points
- `players`: authenticated account stats row
- `leaderboard`: public all-time/monthly leaderboard
- `gang_defenses`: published PvP defenses, including the Boss team and up to three defender agents in `defense_agent`
- `gang_raids`: PvP raid records and defender acknowledgements

The SQL is written to be rerunnable for normal updates: it uses `create table if not exists`, adds missing columns, enables RLS, drops/recreates the expected policies, and creates useful indexes.

## 3. RLS model

Supabase recommends enabling Row Level Security on tables exposed through the Data API. The SQL does that for every table in `public`.

Access model:

- `player_saves`, `save_snapshots`, `players`: authenticated users can only read/write their own rows.
- `leaderboard`: public read and public write are enabled because the current game supports anonymous leaderboard rows using a local browser token.
- `gang_defenses`: public read, authenticated players write only their own published defense.
- `gang_raids`: authenticated attackers can insert raids; attackers and defenders can read their raids; defenders can only update `seen_by_defender` to acknowledge raids.

Important tradeoff: the current anonymous leaderboard is not anti-cheat. A browser client can write leaderboard rows. If this needs to be hardened, move leaderboard writes to a Supabase Edge Function or server endpoint and keep only reads public.

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
5. Open `Raids`, publish the base directly or choose a manual defense team first.
6. In Supabase Table Editor, verify rows appear in `player_saves`, `leaderboard`, and `gang_defenses`.

The PvP list only shows real opponents if at least two different authenticated users have published bases.

## Reference

- Supabase RLS documentation: https://supabase.com/docs/guides/database/postgres/row-level-security
