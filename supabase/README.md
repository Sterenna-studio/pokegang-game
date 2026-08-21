# PokéGang Supabase backend

Production backend for PokéGang:

- Project: `pokegang`
- Project ref: `ojklmobvafovftqvevzh`
- Region: `eu-west-1`
- PostgreSQL: 17

The `supabase/` directory is the source of truth for backend migrations and Edge Functions used by both `pokegang.sterenna.fr` and the itch.io build.

## Local link

```bash
supabase login
supabase link --project-ref ojklmobvafovftqvevzh
```

Do not commit the database password, Supabase secret/service-role keys, Google service-account keys, or other backend credentials.

## Database migrations

New database changes belong in `supabase/migrations/` and should be applied with:

```bash
supabase db push
```

The first versioned migration records the dedicated backend hardening and the GA4 aggregate storage tables.

## Edge Functions

```bash
supabase functions deploy pokegang-api
supabase functions deploy pokegang-leaderboard-submit
```

Future backend-only analytics jobs (for example GA4 -> Supabase) should also live under `supabase/functions/` and use server-side secrets.

## Browser / itch configuration

The browser may contain only the project URL and a browser-safe Supabase publishable key. RLS remains the authorization boundary once the player signs in.

Never expose a Supabase secret key/service-role key in `config.js`, the itch ZIP, GitHub source, or client-side JavaScript.

The itch build remains playable without an account. Cloud login/save should be an optional upgrade to the local save rather than a gate before gameplay.
