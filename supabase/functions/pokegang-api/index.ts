// PokéGang Public API — Supabase Edge Function
// Deploy: supabase functions deploy pokegang-api
//
// Routes:
//   GET /pokegang-api/gang?name={gang_name}    → fiche par nom de gang
//   GET /pokegang-api/gang?token={token}        → fiche par token public
//   GET /pokegang-api/leaderboard?limit=50&sort=reputation
//   GET /pokegang-api/status                    → health check

import { serve }         from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient }  from 'https://esm.sh/@supabase/supabase-js@2';

// ── CORS headers — allow any origin for public API ───────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  'Content-Type': 'application/json; charset=utf-8',
};

const VERSION = '1.0.0';
const NATIONAL_DEX_TOTAL = 493;
const KANTO_DEX_TOTAL    = 151;

// ── Helper ────────────────────────────────────────────────────────────────────
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: CORS });
}
function err(message: string, status = 400) {
  return json({ ok: false, error: message }, status);
}

// ── Build standardised gang profile from a DB row ────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildProfile(row: Record<string, any>) {
  const showcase  = Array.isArray(row.showcase_data)  ? row.showcase_data  : [];
  const bossTeam  = Array.isArray(row.boss_team_data) ? row.boss_team_data : [];
  const badges    = Array.isArray(row.badges_data)    ? row.badges_data    : [];
  const regions   = Array.isArray(row.regions_data)   ? row.regions_data   : ['kanto'];

  return {
    ok: true,
    data: {
      profile: {
        token:       row.profile_token  ?? null,
        gang_name:   row.gang_name      ?? 'Team ???',
        boss_name:   row.boss_name      ?? 'Boss',
        boss_sprite: row.boss_sprite    ?? null,
        title:       row.title_full     ?? null,
        reputation:  row.reputation     ?? 0,
        regions,
        updated_at:  row.updated_at     ?? null,
      },
      stats: {
        total_caught:       row.total_caught       ?? 0,
        total_fights_won:   row.total_fights_won   ?? 0,
        shiny_caught:       row.shiny_count        ?? 0,
        shiny_species:      row.shiny_species_count ?? 0,
        chests_opened:      row.chests_opened      ?? 0,
        pokemon_count:      row.pokemon_count      ?? 0,
        agents_count:       row.agents_count       ?? 0,
        money:              row.money              ?? 0,
        total_money_earned: row.total_money_earned ?? 0,
        dex: {
          kanto:    { caught: row.dex_kanto_count    ?? 0, total: KANTO_DEX_TOTAL    },
          national: { caught: row.dex_national_count ?? 0, total: NATIONAL_DEX_TOTAL },
        },
      },
      showcase:  showcase.slice(0, 6),
      boss_team: bossTeam.slice(0, 6),
      badges,
    },
    _api_version: VERSION,
  };
}

// ── Route handlers ────────────────────────────────────────────────────────────
async function handleGang(url: URL, supabase: ReturnType<typeof createClient>) {
  const name  = url.searchParams.get('name')?.trim();
  const token = url.searchParams.get('token')?.trim();

  if (!name && !token) {
    return err('Paramètre requis : ?name={gang_name} ou ?token={token}');
  }

  let query = supabase
    .from('pokegang_players')
    .select([
      'gang_name', 'boss_name', 'boss_sprite', 'title_full',
      'reputation', 'total_caught', 'total_fights_won',
      'shiny_count', 'shiny_species_count',
      'chests_opened', 'pokemon_count',
      'agents_count', 'money', 'total_money_earned',
      'dex_kanto_count', 'dex_national_count',
      'showcase_data', 'boss_team_data', 'badges_data', 'regions_data',
      'profile_token', 'updated_at',
    ].join(', '))
    .eq('public_profile', true)
    .limit(1);

  if (token) {
    query = query.eq('profile_token', token);
  } else if (name) {
    query = query.ilike('gang_name', name);
  }

  const { data, error } = await query.maybeSingle();

  if (error) return err('Erreur base de données : ' + error.message, 500);
  if (!data)  return err('Gang introuvable ou profil non public.', 404);

  return json(buildProfile(data));
}

async function handleLeaderboard(url: URL, supabase: ReturnType<typeof createClient>) {
  const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100);
  const sort   = url.searchParams.get('sort') ?? 'reputation';
  const VALID_SORTS: Record<string, string> = {
    reputation:    'reputation',
    caught:        'total_caught',
    shiny:         'shiny_count',
    shiny_species: 'shiny_species_count',
    fights:        'total_fights_won',
    dex_national:  'dex_national_count',
  };
  const col = VALID_SORTS[sort] ?? 'reputation';

  const { data, error } = await supabase
    .from('pokegang_players')
    .select('gang_name, boss_name, reputation, total_caught, shiny_count, dex_kanto_count, dex_national_count, profile_token, updated_at')
    .eq('public_profile', true)
    .order(col, { ascending: false })
    .limit(limit);

  if (error) return err('Erreur base de données : ' + error.message, 500);

  return json({
    ok: true,
    data: {
      sort,
      limit,
      count: data?.length ?? 0,
      entries: (data ?? []).map((row, i) => ({
        rank:       i + 1,
        gang_name:  row.gang_name,
        boss_name:  row.boss_name,
        token:      row.profile_token,
        reputation: row.reputation,
        total_caught: row.total_caught,
        shiny_count:  row.shiny_count,
        dex_kanto:    row.dex_kanto_count,
        dex_national: row.dex_national_count,
        updated_at:   row.updated_at,
      })),
    },
    _api_version: VERSION,
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'GET')     return err('Méthode non autorisée. Utilisez GET.', 405);

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');

  // Supabase injecte la clé de service dans les Edge Functions
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  if (path.endsWith('/status')) {
    return json({ ok: true, version: VERSION, timestamp: new Date().toISOString() });
  }

  if (path.endsWith('/gang')) {
    return await handleGang(url, supabase);
  }

  if (path.endsWith('/leaderboard')) {
    return await handleLeaderboard(url, supabase);
  }

  return err('Route inconnue. Consultez la documentation : https://pokegang.sterenna.fr/docs/api.html', 404);
});
