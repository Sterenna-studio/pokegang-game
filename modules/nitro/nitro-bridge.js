// ════════════════════════════════════════════════════════════════
//  NITRO BRIDGE
//  Point d'entrée centralisé pour l'intégration Nitro dans PokéGang.
//
//  Expose :
//    initNitroBridge()        — initialise et résout l'état complet
//    getNitroBridgeState()    — retourne l'état courant (synchrone)
//    redirectToNitroLogin()   — redirige vers le login Nitro
//    linkCurrentSaveToNitro() — lie le slot de save actuel à un user Nitro
//    getLinkedNitroUser()     — lit le lien stocké localement
//    unlinkNitroAccount()     — supprime le lien local
// ════════════════════════════════════════════════════════════════

import { getNitroSupabase } from './nitro-supabase.js';
import { getNitroUser } from './nitro-auth.js';
import { getNitroProfile } from './nitro-profile.js';

export { redirectToNitroLogin } from './nitro-auth.js';

const LINK_STORAGE_KEY = 'pg.nitroLink';

/** @type {{ available: boolean, connected: boolean, user: object|null, profile: object|null, displayName: string|null, error: Error|null, _initialized: boolean }} */
let _state = {
  available: false,
  connected: false,
  user: null,
  profile: null,
  displayName: null,
  error: null,
  _initialized: false,
};

/**
 * Initialise le bridge Nitro. Idempotent : n'effectue le travail qu'une seule fois.
 * @returns {Promise<typeof _state>}
 */
export async function initNitroBridge() {
  if (_state._initialized) return getNitroBridgeState();
  _state._initialized = true;

  const { available, error } = await getNitroSupabase();
  _state.available = available;

  if (!available) {
    _state.error = error ?? null;
    console.warn('[PokéGang Nitro] Nitro bridge not available — game continues normally');
    return getNitroBridgeState();
  }

  try {
    const user = await getNitroUser();
    _state.connected = !!user;
    _state.user = user ?? null;

    if (user) {
      const profile = await getNitroProfile();
      _state.profile = profile;
      _state.displayName = profile?.displayName ?? null;
      console.info('[PokéGang Nitro] Nitro session detected for:', _state.displayName ?? user.email);
    } else {
      console.info('[PokéGang Nitro] No active Nitro session on this domain');
    }
  } catch (e) {
    _state.error = e;
    console.warn('[PokéGang Nitro] Bridge init error:', e.message);
  }

  return getNitroBridgeState();
}

/**
 * Retourne une copie de l'état Nitro courant (synchrone).
 * @returns {{ available: boolean, connected: boolean, user: object|null, profile: object|null, displayName: string|null, error: Error|null }}
 */
export function getNitroBridgeState() {
  const { _initialized, ...pub } = _state; // eslint-disable-line no-unused-vars
  return pub;
}

// ── Gestion du lien compte ───────────────────────────────────────

/**
 * Lie le slot de sauvegarde actuel à un identifiant Nitro.
 * Stocké localement dans localStorage — ne nécessite pas de table Supabase.
 * Pour une vraie liaison DB, voir docs/nitro-integration.md.
 *
 * @param {string} nitroUserId   - UUID Supabase de l'utilisateur Nitro
 * @param {string} [saveSlot]    - Suffixe du slot (ex: "v6", "v6.s2", "v6.s3")
 * @returns {boolean}
 */
export function linkCurrentSaveToNitro(nitroUserId, saveSlot = 'v6') {
  if (!nitroUserId) {
    console.warn('[PokéGang Nitro] linkCurrentSaveToNitro: nitroUserId is required');
    return false;
  }
  try {
    const link = {
      nitro_user_id: nitroUserId,
      pokegang_save_slot: saveSlot,
      linked_at: new Date().toISOString(),
    };
    localStorage.setItem(LINK_STORAGE_KEY, JSON.stringify(link));
    console.info('[PokéGang Nitro] Save slot linked to Nitro user:', nitroUserId);
    return true;
  } catch (e) {
    console.warn('[PokéGang Nitro] linkCurrentSaveToNitro failed:', e.message);
    return false;
  }
}

/**
 * Retourne le lien Nitro stocké localement, ou null s'il n'y en a pas.
 * @returns {{ nitro_user_id: string, pokegang_save_slot: string, linked_at: string }|null}
 */
export function getLinkedNitroUser() {
  try {
    const raw = localStorage.getItem(LINK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('[PokéGang Nitro] getLinkedNitroUser parse error:', e.message);
    return null;
  }
}

/**
 * Supprime le lien Nitro stocké localement.
 * @returns {boolean}
 */
export function unlinkNitroAccount() {
  try {
    localStorage.removeItem(LINK_STORAGE_KEY);
    console.info('[PokéGang Nitro] Nitro account unlinked');
    return true;
  } catch (e) {
    console.warn('[PokéGang Nitro] unlinkNitroAccount failed:', e.message);
    return false;
  }
}
