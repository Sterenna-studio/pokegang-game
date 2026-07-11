'use strict';

// ── RNG & utilitaires génériques ─────────────────────────────────────────────
// Aucune dépendance externe (pas de state, pas de classic-script globals).
// Utilisées PARTOUT dans app.js et les modules via globalThis.pick,
// globalThis.randInt, etc.

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function weightedPick(arr) {
  // arr: [{en, w}, ...] — returns en string
  const total = arr.reduce((s, e) => s + e.w, 0);
  let r = Math.random() * total;
  for (const e of arr) { r -= e.w; if (r <= 0) return e.en; }
  return arr[arr.length - 1].en;
}

function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── HTML escape — pour sécuriser toutes les valeurs user-input injectées
//    via innerHTML (bossName, gang.name, agent names, etc.). Préviens les
//    injections type <img onerror=...> stockées dans le state puis exposées
//    via le cloud Supabase aux autres joueurs (gangCompetition).
function escapeHtml(str) {
  if (str == null) return '';
  const s = String(str);
  return s.replace(/[&<>"']/g, ch => (
    ch === '&' ? '&amp;' :
    ch === '<' ? '&lt;'  :
    ch === '>' ? '&gt;'  :
    ch === '"' ? '&quot;':
                 '&#39;'
  ));
}

Object.assign(globalThis, {
  pick, weightedPick, randInt, uid, clamp, escapeHtml,
});

export {};
