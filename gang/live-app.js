'use strict';

// ════════════════════════════════════════════════════════════════
//  live-app.js — 3e point d'entrée statique (pokegang.sterenna.fr/gang/live.html)
//
//  Source navigateur OBS : aucune sauvegarde locale, aucun localStorage,
//  aucune écriture — un browser source OBS tourne sur un profil Chromium
//  (CEF) isolé qui ne partage jamais localStorage['pokeforge.v6'] avec le
//  navigateur du joueur, donc le patron habituel de /gang/ (lecture directe
//  du localStorage) est structurellement impossible ici. Cette page lit à la
//  place un snapshot du vivarium depuis l'API publique Supabase
//  (supabase/functions/pokegang-api, route /vivarium), identifié par un
//  ?token= — le même profile_token que le profil public/API existant
//  (onglet Compte du jeu principal, section "Profil public / API").
// ════════════════════════════════════════════════════════════════

import { renderEnvironmentZoneFromSnapshot, updateEnvironmentSnapshot } from './environment.js';
import { getNitroSupabaseConfig } from '../modules/nitro/nitro-supabase.js';

const POLL_MS = 35_000;
const _lang = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'fr';
const _t = (fr, en) => (_lang === 'en' ? en : fr);

function showMessage(text) {
  const root = document.getElementById('gangLiveRoot');
  if (root) root.innerHTML = `<div class="gang-empty-state">${text}</div>`;
}

// Même ordre de résolution que app.js (Nitro shared en premier, config.js
// local en repli) — pas de nouveau mécanisme de credentials à maintenir.
async function resolveSupabaseConfig() {
  try {
    const nitroCfg = await getNitroSupabaseConfig();
    if (nitroCfg?.url && nitroCfg?.anonKey) return nitroCfg;
  } catch { /* silencieux — on tente le repli local */ }
  try {
    const cfg = await import('../config.js');
    const url     = cfg.SUPABASE_URL ?? cfg.default?.SUPABASE_URL ?? '';
    const anonKey = cfg.SUPABASE_ANON_KEY ?? cfg.default?.SUPABASE_ANON_KEY ?? '';
    if (url && anonKey) return { url, anonKey };
  } catch { /* pas de config.js local non plus */ }
  return null;
}

async function fetchSnapshot(config, token) {
  const res = await fetch(`${config.url}/functions/v1/pokegang-api/vivarium?token=${encodeURIComponent(token)}`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body.data;
}

async function boot() {
  const token = new URLSearchParams(location.search).get('token');
  if (!token) {
    showMessage(_t(
      "Paramètre <code>?token=</code> manquant — récupère ton lien depuis l'onglet Compte du jeu principal (section Profil public / API).",
      'Missing <code>?token=</code> parameter — get your link from the Account tab in the main game (Public profile / API section).',
    ));
    return;
  }

  const config = await resolveSupabaseConfig();
  if (!config) {
    showMessage(_t('Configuration Supabase indisponible.', 'Supabase configuration unavailable.'));
    return;
  }

  const root = document.getElementById('gangLiveRoot');
  root.innerHTML = '<div class="gang-environment-zone" id="gangEnvironmentZone"></div>';

  let firstLoad = true;
  async function poll() {
    try {
      const blob = await fetchSnapshot(config, token);
      if (firstLoad) {
        renderEnvironmentZoneFromSnapshot(root, blob);
        firstLoad = false;
      } else {
        updateEnvironmentSnapshot(blob);
      }
    } catch (e) {
      // Panne réseau transitoire après un premier chargement réussi : on garde
      // le dernier rendu affiché plutôt que de vider l'overlay en plein stream.
      if (firstLoad) showMessage(_t('Gang introuvable ou profil non public.', 'Gang not found or profile is not public.'));
      console.warn('[PokéGang live] échec du fetch vivarium :', e.message);
    }
  }

  await poll();
  setInterval(poll, POLL_MS);
}

boot();
