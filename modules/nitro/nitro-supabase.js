// ════════════════════════════════════════════════════════════════
//  NITRO SUPABASE BRIDGE
//  Tente de charger le client Supabase partagé depuis Nitro.
//  Échoue proprement si indisponible (CORS, réseau, module absent).
//
//  Exception itch.io : la build embarque directement la configuration
//  PUBLIQUE du projet Supabase PokéGang (URL + publishable key uniquement).
//  Cela permet auth + cloud save sur itch sans dépendre de Nitro. La sécurité
//  reste assurée par Supabase Auth + RLS ; aucune clé service_role/secret n'est
//  présente dans le runtime navigateur.
// ════════════════════════════════════════════════════════════════

const NITRO_SHARED_BASE = 'https://nitro.sterenna.fr/shared';

// Configuration navigateur-safe du backend PokéGang dédié.
// Une publishable key Supabase est faite pour être distribuée aux clients web.
const POKEGANG_SUPABASE_URL = 'https://ojklmobvafovftqvevzh.supabase.co';
const POKEGANG_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BupJx29LBTSfbbArMPbNvA_DRqPcmmc';

let _nitroSupabase = null;
let _available = null; // null = non testé, true/false = résultat connu
let _lastError = null; // mémorise la dernière erreur pour debug (utile après cache)
let _configCache = null; // { url, anonKey }

function _isItchRuntime() {
  const host = String(globalThis.location?.hostname || '').toLowerCase();
  return host.endsWith('.itch.io') || host.includes('itch.zone') || host.endsWith('.hwcdn.st');
}

function _itchSupabaseConfig() {
  return {
    url: POKEGANG_SUPABASE_URL,
    // cloudAccount appelle historiquement ce champ `anonKey`; le SDK accepte
    // aussi bien la modern publishable key dans ce paramètre.
    anonKey: POKEGANG_SUPABASE_PUBLISHABLE_KEY,
  };
}

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
 * Récupère les credentials Supabase publics.
 *
 * - Sur itch.io : utilise immédiatement la config navigateur-safe embarquée du
 *   projet `pokegang`, afin que les comptes et saves cloud fonctionnent même si
 *   le wrapper itch ne peut pas charger Nitro.
 * - Ailleurs : garde Nitro comme source principale, puis laisse app.js gérer
 *   son fallback local `config.js` en développement.
 *
 * @returns {Promise<{ url: string, anonKey: string }|null>}
 */
export async function getNitroSupabaseConfig() {
  if (_configCache) return _configCache;

  if (_isItchRuntime()) {
    _configCache = _itchSupabaseConfig();
    console.info('[PokéGang Supabase] Bundled public config loaded for itch');
    return _configCache;
  }

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
