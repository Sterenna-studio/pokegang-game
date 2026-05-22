// ════════════════════════════════════════════════════════════════
//  NITRO PROFILE
//  Récupère le profil de l'utilisateur Nitro connecté.
//  Tente d'abord le module shared distant, puis replie sur les
//  métadonnées Supabase embarquées dans le token.
// ════════════════════════════════════════════════════════════════

import { getNitroUser } from './nitro-auth.js';

const NITRO_SHARED_BASE = 'https://nitro.sterenna.fr/shared';

/**
 * Retourne le profil Nitro de l'utilisateur connecté, ou null.
 *
 * Priorité :
 *  1. Module shared `profile.js` de Nitro (si disponible et CORS OK)
 *  2. Métadonnées du token Supabase (`user_metadata`)
 *  3. Email comme fallback
 *
 * @returns {Promise<{ id: string, email: string, displayName: string, raw?: object }|null>}
 */
export async function getNitroProfile() {
  const user = await getNitroUser();
  if (!user) return null;

  // Tentative via module shared distant
  try {
    const mod = await import(`${NITRO_SHARED_BASE}/profile.js`);
    const getProfile = mod.getProfile ?? mod.getUserProfile ?? mod.default;
    if (typeof getProfile === 'function') {
      const profile = await getProfile(user.id);
      if (profile) {
        console.info('[PokéGang Nitro] Profile loaded via shared module');
        return {
          id: user.id,
          email: user.email ?? '',
          displayName: profile.display_name ?? profile.username ?? profile.displayName ?? _fallbackName(user),
          raw: profile,
        };
      }
    }
  } catch (e) {
    console.warn('[PokéGang Nitro] Shared profile module unavailable, using token metadata:', e.message);
  }

  // Repli sur les métadonnées du token
  return {
    id: user.id,
    email: user.email ?? '',
    displayName: _fallbackName(user),
    raw: null,
  };
}

function _fallbackName(user) {
  return user.user_metadata?.display_name
    ?? user.user_metadata?.username
    ?? user.user_metadata?.full_name
    ?? user.email?.split('@')[0]
    ?? 'Joueur Nitro';
}
