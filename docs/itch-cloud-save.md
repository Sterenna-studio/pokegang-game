# itch.io cloud save

Starting with PokéGang v0.5.2, the itch HTML build can use the dedicated PokéGang Supabase backend for accounts and cloud saves while remaining fully playable offline/local-first.

## Backend

The itch runtime targets the dedicated project:

```text
https://ojklmobvafovftqvevzh.supabase.co
```

Only the browser-safe Supabase **publishable key** is bundled. A `service_role` or `sb_secret_...` key must never be present in the repository runtime or itch archive.

The existing `modules/systems/cloudAccount.js` flow remains unchanged:

- local saves continue to live in browser `localStorage`;
- authenticated cloud saves are stored in `public.pokegang_saves` per user + slot;
- rolling restore points use `public.pokegang_save_snapshots`;
- RLS restricts save/snapshot access to the authenticated owner;
- cloud writes keep the existing anti-overwrite progression check.

The same Supabase account can therefore recover the same cloud slot from itch and from another PokéGang frontend that points to this project. Authentication sessions themselves remain origin-local, so the player signs in separately on each origin.

## Configuration routing

`modules/nitro/nitro-supabase.js` resolves public configuration as follows:

1. itch hosts (`*.itch.io`, `*.itch.zone`, `*.hwcdn.st`) use the bundled dedicated PokéGang public configuration immediately;
2. other hosts keep Nitro shared config as the primary source;
3. `app.js` still owns the local `config.js` fallback for development.

This avoids a runtime dependency on `nitro.sterenna.fr` inside the itch iframe while preserving the existing web deployment behavior.

## Release guardrail

`tools/test-itch-supabase-config.mjs` is part of the normal `tools/test-*.mjs` regression suite. It verifies that the itch branch resolves to the dedicated project, uses a modern `sb_publishable_...` key, and contains no `sb_secret_...` or service-role JWT.

`config.js` remains excluded from the itch archive.
