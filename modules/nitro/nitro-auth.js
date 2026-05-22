// ════════════════════════════════════════════════════════════════
//  NITRO AUTH
//  Fonctions d'authentification Nitro côté PokéGang.
//
//  IMPORTANT : PokéGang est sur pokegang.sterenna.fr et Nitro sur
//  nitro.sterenna.fr. La session Supabase stockée dans localStorage
//  ne se partage PAS automatiquement entre ces deux sous-domaines.
//  getSession() peut donc renvoyer null même si l'utilisateur est
//  connecté à Nitro dans un autre onglet.
// ════════════════════════════════════════════════════════════════

import { getNitroSupabase } from './nitro-supabase.js';

const NITRO_LOGIN_URL = 'https://nitro.sterenna.fr/login.html';

/**
 * Retourne la session Nitro active, ou null si non connecté / indisponible.
 * @returns {Promise<object|null>}
 */
export async function getNitroSession() {
  const { supabase, available } = await getNitroSupabase();
  if (!available || !supabase) return null;

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('[PokéGang Nitro] Session error:', error.message);
      return null;
    }
    return data?.session ?? null;
  } catch (e) {
    console.warn('[PokéGang Nitro] Could not retrieve session:', e.message);
    return null;
  }
}

/**
 * Retourne l'utilisateur Nitro connecté, ou null.
 * @returns {Promise<object|null>}
 */
export async function getNitroUser() {
  const session = await getNitroSession();
  return session?.user ?? null;
}

/**
 * Indique si un utilisateur Nitro est détecté sur ce domaine.
 * @returns {Promise<boolean>}
 */
export async function isNitroConnected() {
  const user = await getNitroUser();
  return !!user;
}

/**
 * Redirige l'utilisateur vers la page de connexion Nitro.
 * Après connexion, Nitro redirige vers `nextUrl` (par défaut la page actuelle).
 * @param {string} [nextUrl]
 */
export function redirectToNitroLogin(nextUrl = window.location.href) {
  const target = `${NITRO_LOGIN_URL}?next=${encodeURIComponent(nextUrl)}`;
  console.info('[PokéGang Nitro] Redirecting to Nitro login:', target);
  window.location.href = target;
}
