// ════════════════════════════════════════════════════════════════
//  NITRO SUPABASE BRIDGE
//  Tente de charger le client Supabase partagé depuis Nitro.
//  Échoue proprement si indisponible (CORS, réseau, module absent).
// ════════════════════════════════════════════════════════════════

const NITRO_SHARED_BASE = 'https://nitro.sterenna.fr/shared';

let _nitroSupabase = null;
let _available = null; // null = non testé, true/false = résultat connu
let _lastError = null; // mémorise la dernière erreur pour debug (utile après cache)

/**
 * Tente de charger le client Supabase Nitro depuis le module partagé distant.
 * @returns {{ supabase: object|null, available: boolean, error?: Error }}
 */
export async function getNitroSupabase() {
  if (_available !== null) {
    return { supabase: _nitroSupabase, available: _available, error: _lastError ?? undefined };
  }

  try {
    const mod = await import(`${NITRO_SHARED_BASE}/supabase-client.js`);
    // Le module peut exporter `supabase` ou `default`
    const client = mod.supabase ?? mod.default ?? null;
    if (!client) throw new Error('Aucun export supabase trouvé dans le module partagé');
    _nitroSupabase = client;
    _available = true;
    console.info('[PokéGang Nitro] Shared Supabase client loaded');
    return { supabase: _nitroSupabase, available: true };
  } catch (error) {
    _available = false;
    _lastError = error;
    console.warn('[PokéGang Nitro] Shared Supabase module unavailable:', error.message);
    return { supabase: null, available: false, error };
  }
}
