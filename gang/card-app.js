'use strict';

// ════════════════════════════════════════════════════════════════
//  card-app.js — 4e point d'entrée statique (pokegang.sterenna.fr/gang/card.html)
//
//  Source navigateur OBS, même contrainte que live-app.js : profil Chromium
//  (CEF) isolé, donc aucun accès au localStorage du joueur. Tout vient de
//  l'API publique Supabase (supabase/functions/pokegang-api), ici la route
//  /gang plutôt que /vivarium — elle expose déjà profil, stats, équipe,
//  vitrine et badges, aucun travail backend n'a été nécessaire pour cette page.
//
//  Format visé : carte d'identité du gang (écran de pause / démarrage de
//  stream), état pur rafraîchi périodiquement — pas d'alerte événementielle,
//  qui demanderait un canal temps réel (cf. docs/obs-setup.md).
// ════════════════════════════════════════════════════════════════

import { getNitroSupabaseConfig } from '../modules/nitro/nitro-supabase.js';

const POLL_MS = 35_000;
const _lang = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'fr';
const _t = (fr, en) => (_lang === 'en' ? en : fr);
const _locale = () => (_lang === 'en' ? 'en-US' : 'fr-FR');
const _num = (n) => Number(n || 0).toLocaleString(_locale());

// Toutes les régions du jeu, dans l'ordre de progression — l'API ne renvoie
// que celles débloquées, on affiche les autres en grisé pour donner l'échelle.
const ALL_REGIONS = [
  { id: 'kanto',  label: 'Kanto'  },
  { id: 'johto',  label: 'Johto'  },
  { id: 'hoenn',  label: 'Hoenn'  },
  { id: 'sinnoh', label: 'Sinnoh' },
];

function _esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function showMessage(text) {
  const root = document.getElementById('cardRoot');
  if (root) root.innerHTML = `<div class="gc-message">${text}</div>`;
}

// Même ordre de résolution que app.js/live-app.js (Nitro shared en premier,
// config.js local en repli) — pas de nouveau mécanisme de credentials.
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

async function fetchGang(config, token) {
  const res = await fetch(`${config.url}/functions/v1/pokegang-api/gang?token=${encodeURIComponent(token)}`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body.data;
}

function renderCard(root, data) {
  const p = data.profile ?? {};
  const s = data.stats   ?? {};
  const unlocked = new Set(p.regions || []);

  const regionsHtml = ALL_REGIONS.map(r => `
    <span class="gc-region${unlocked.has(r.id) ? ' on' : ''}">${r.label}</span>
  `).join('');

  const badgesHtml = (data.badges || []).map(b => {
    const label = _lang === 'en' ? (b.label_en || b.label) : (b.label_fr || b.label);
    return `<span class="gc-badge" style="border-color:${_esc(b.color || 'var(--gold-dim)')};color:${_esc(b.color || 'var(--gold)')}">
      ${_esc(b.icon || '')} ${_esc(label)}
    </span>`;
  }).join('');

  const dexKanto = s.dex?.kanto ?? { caught: 0, total: 151 };
  const dexNat   = s.dex?.national ?? { caught: 0, total: 493 };

  root.innerHTML = `
    <div class="gc-card">
      <div class="gc-head">
        <img class="gc-boss" src="https://play.pokemonshowdown.com/sprites/trainers/${_esc(p.boss_sprite || 'red')}.png"
             alt="" onerror="this.style.visibility='hidden'">
        <div class="gc-ident">
          <div class="gc-gang">${_esc(p.gang_name || 'Team ???')}</div>
          <div class="gc-boss-name">${_esc(p.boss_name || 'Boss')}</div>
          ${p.title ? `<div class="gc-title">« ${_esc(p.title)} »</div>` : ''}
        </div>
      </div>

      <div class="gc-rep">
        <span class="gc-rep-star">★</span>
        <span class="gc-rep-val">${_num(p.reputation)}</span>
        <span class="gc-rep-lbl">${_t('RÉPUTATION', 'REPUTATION')}</span>
      </div>

      <div class="gc-stats">
        <div class="gc-stat"><b>${_num(s.total_caught)}</b><span>${_t('captures', 'caught')}</span></div>
        <div class="gc-stat"><b>${_num(s.shiny_caught)}</b><span>${_t('chromatiques', 'shinies')}</span></div>
        <div class="gc-stat"><b>${_num(s.total_fights_won)}</b><span>${_t('victoires', 'wins')}</span></div>
        <div class="gc-stat"><b>${_num(s.agents_count)}</b><span>${_t('agents', 'agents')}</span></div>
      </div>

      <div class="gc-dex">
        <span class="gc-dex-lbl">${_t('Pokédex', 'Pokédex')}</span>
        <span class="gc-dex-val">Kanto <b>${_num(dexKanto.caught)}/${_num(dexKanto.total)}</b></span>
        <span class="gc-dex-sep">·</span>
        <span class="gc-dex-val">${_t('National', 'National')} <b>${_num(dexNat.caught)}/${_num(dexNat.total)}</b></span>
      </div>

      ${badgesHtml ? `<div class="gc-badges">${badgesHtml}</div>` : ''}

      <div class="gc-regions">${regionsHtml}</div>
    </div>`;
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

  const root = document.getElementById('cardRoot');
  let firstLoad = true;

  async function poll() {
    try {
      const data = await fetchGang(config, token);
      renderCard(root, data);
      firstLoad = false;
    } catch (e) {
      // Panne réseau transitoire après un premier rendu réussi : on garde la
      // carte affichée plutôt que de la vider en plein stream (même politique
      // que live-app.js).
      if (firstLoad) showMessage(_t('Gang introuvable ou profil non public.', 'Gang not found or profile is not public.'));
      console.warn('[PokéGang card] échec du fetch gang :', e.message);
    }
  }

  await poll();
  setInterval(poll, POLL_MS);
}

boot();
