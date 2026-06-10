// PokéGang — Soumission leaderboard (Edge Function)
// Deploy: supabase functions deploy pokegang-leaderboard-submit
//
// Pourquoi cette fonction existe :
//   La table pokegang_leaderboard était écrite directement depuis le navigateur
//   avec des policies RLS ouvertes à `anon` (insert/update check(true)). N'importe
//   qui pouvait donc injecter du HTML dans gang_name/boss_name (XSS stocké chez
//   tous les joueurs) ou polluer le classement. Après le patch, l'écriture directe
//   est révoquée côté anon/authenticated : tout passe par cette fonction, qui
//   écrit via la clé de service role (bypass RLS) APRÈS validation + assainissement.
//
// Périmètre honnête : c'est un jeu idle 100% client. Cette fonction ne peut PAS
//   vérifier qu'un score a réellement été gagné (l'état vit dans le navigateur).
//   Elle neutralise le XSS, borne les valeurs aberrantes, et empêche l'usurpation
//   d'une ligne appartenant à un autre compte authentifié. La triche pure sur les
//   scores reste hors de portée sans réécriture serveur du jeu.
//
// Route: POST /pokegang-leaderboard-submit  (body = payload JSON du leaderboard)

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  'Content-Type': 'application/json; charset=utf-8',
};

const VERSION = '1.0.0';

// ── Bornes ──────────────────────────────────────────────────────────────────────
const NAME_MAX  = 24;        // longueur max gang_name / boss_name
const NUM_MAX   = 1e12;      // plafond anti-aberration sur les compteurs
const TOKEN_RE  = /^[a-z0-9_]{6,64}$/i;
const SPRITE_RE = /^[a-z0-9-]{1,40}$/i;
const MONTH_RE  = /^\d{4}-\d{2}$/;
// Caractères de contrôle (U+0000–U+001F) + chevrons < > qui permettent l'injection
// de balises. Construit via RegExp pour n'avoir aucun octet de contrôle dans la source.
const STRIP_RE  = new RegExp('[\\u0000-\\u001f<>]', 'g');

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}
function err(message: string, status = 400) {
  return json({ ok: false, error: message }, status);
}

// Texte libre → plaintext sûr : retire les caractères de contrôle et < > qui
// permettent l'injection de balises, puis tronque. Le rendu client ré-échappe de
// toute façon (quotes & co.) — ici on garantit qu'aucune balise ne peut transiter.
function cleanName(v: unknown, fallback: string): string {
  const s = String(v ?? '').replace(STRIP_RE, '').trim().slice(0, NAME_MAX);
  return s || fallback;
}

// Entier non négatif borné. Rejette NaN/Infinity/valeurs hostiles.
function clampInt(v: unknown, max = NUM_MAX): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

function cleanSprite(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return SPRITE_RE.test(s) ? s : null;
}

function cleanMonthKey(v: unknown): string {
  const s = String(v ?? '').trim();
  return MONTH_RE.test(s) ? s : '';
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST')    return err('Méthode non autorisée. Utilisez POST.', 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err('Corps JSON invalide.');
  }

  // ── Token (clé primaire de la ligne) ───────────────────────────────────────
  const token = String(body.token ?? '').trim();
  if (!TOKEN_RE.test(token)) return err('Token invalide.');

  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── Liaison compte authentifié (optionnelle) ───────────────────────────────
  // Si un access token utilisateur est fourni, on le vérifie et on lie user_id.
  // Sinon → joueur anonyme (toléré, mais assaini comme tout le monde).
  let userId: string | null = null;
  const authHeader = req.headers.get('Authorization') ?? '';
  const anonKey    = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const bearer     = authHeader.replace(/^Bearer\s+/i, '').trim();
  // Le bearer n'est un VRAI JWT utilisateur que s'il diffère de la clé anon.
  if (bearer && bearer !== anonKey) {
    const { data, error } = await serviceClient.auth.getUser(bearer);
    if (!error && data?.user) userId = data.user.id;
  }

  // ── Anti-usurpation : si la ligne existe déjà pour ce token et appartient à
  //    un AUTRE compte authentifié, on refuse. (Empêche d'écraser la ligne d'un
  //    joueur connu avec un token volé/deviné.) ───────────────────────────────
  const { data: existing } = await serviceClient
    .from('pokegang_leaderboard')
    .select('user_id')
    .eq('token', token)
    .maybeSingle();
  if (existing?.user_id && existing.user_id !== userId) {
    return err('Ce token appartient à un autre compte.', 403);
  }

  // ── Assainissement + bornage du payload ────────────────────────────────────
  const row = {
    token,
    user_id:               userId,
    gang_name:             cleanName(body.gang_name, 'Team ???'),
    boss_name:             cleanName(body.boss_name, 'Boss'),
    boss_sprite:           cleanSprite(body.boss_sprite),
    reputation:            clampInt(body.reputation),
    total_caught:          clampInt(body.total_caught),
    shiny_count:           clampInt(body.shiny_count),
    shiny_species_count:   clampInt(body.shiny_species_count),
    dex_kanto_count:       clampInt(body.dex_kanto_count, 151),
    dex_national_count:    clampInt(body.dex_national_count, 493),
    total_sold:            clampInt(body.total_sold),
    total_money_earned:    clampInt(body.total_money_earned),
    agents_count:          clampInt(body.agents_count, 10_000),
    is_anonymous:          !userId,
    updated_at:            new Date().toISOString(), // serveur fait foi
    month_key:             cleanMonthKey(body.month_key),
    rep_monthly:           clampInt(body.rep_monthly),
    caught_monthly:        clampInt(body.caught_monthly),
    shiny_monthly:         clampInt(body.shiny_monthly),
    shiny_species_monthly: clampInt(body.shiny_species_monthly),
  };

  const { error } = await serviceClient
    .from('pokegang_leaderboard')
    .upsert(row, { onConflict: 'token' });

  if (error) return err('Erreur écriture leaderboard : ' + error.message, 500);

  return json({ ok: true, _api_version: VERSION });
});
