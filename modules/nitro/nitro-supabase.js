// ════════════════════════════════════════════════════════════════
//  NITRO SUPABASE BRIDGE
//  Tente de charger le client Supabase partagé depuis Nitro.
//  Échoue proprement si indisponible (CORS, réseau, module absent).
// ════════════════════════════════════════════════════════════════

const NITRO_SHARED_BASE = 'https://nitro.sterenna.fr/shared';

let _nitroSupabase = null;
let _available = null; // null = non testé, true/false = résultat connu
let _lastError = null; // mémorise la dernière erreur pour debug (utile après cache)
let _configCache = null; // { url, anonKey } — credentials extraits de /shared/config.js

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

/**
 * Récupère les credentials Supabase publics depuis Nitro (/shared/config.js).
 * Permet à PokéGang d'instancier son propre client (avec ses options custom)
 * sans avoir besoin de déployer un config.js local.
 *
 * @returns {Promise<{ url: string, anonKey: string }|null>}
 */
export async function getNitroSupabaseConfig() {
  if (_configCache) return _configCache;
  try {
    const mod = await import(`${NITRO_SHARED_BASE}/config.js`);
    const url     = mod.SUPABASE_URL ?? mod.default?.SUPABASE_URL ?? '';
    const anonKey = mod.SUPABASE_ANON
                 ?? mod.SUPABASE_ANON_KEY
                 ?? mod.SUPABASE_PUBLISHABLE_KEY
                 ?? mod.default?.SUPABASE_ANON
                 ?? '';
    if (!url || !anonKey) {
      throw new Error('SUPABASE_URL ou SUPABASE_ANON manquant dans Nitro shared/config.js');
    }
    _configCache = { url, anonKey };
    console.info('[PokéGang Nitro] Shared Supabase config loaded from Nitro');
    return _configCache;
  } catch (error) {
    console.warn('[PokéGang Nitro] Shared Supabase config unavailable:', error.message);
    return null;
  }
}
