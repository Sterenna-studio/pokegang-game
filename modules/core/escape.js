// ════════════════════════════════════════════════════════════════
//  HTML ESCAPE HELPER
//  Sécurise les valeurs user-input (bossName, gangName, agent names…)
//  avant injection dans innerHTML. Évite les attaques XSS stockées :
//  un nom de boss type <img src=x onerror="..."> pourrait sinon être
//  exécuté chez d'autres joueurs via le cloud (gangCompetition).
// ════════════════════════════════════════════════════════════════

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => (
    ch === '&' ? '&amp;' :
    ch === '<' ? '&lt;'  :
    ch === '>' ? '&gt;'  :
    ch === '"' ? '&quot;':
                 '&#39;'
  ));
}

// Alias court pour usage en template strings : ${esc(s)}
export const esc = escapeHtml;
