'use strict';

// ════════════════════════════════════════════════════════════════
// 15b. UI — COSMETICS TAB (panel dédié, débloquable 50 000₽)
// ════════════════════════════════════════════════════════════════

const COSMETICS_UNLOCK_COST = 50000;

function renderCosmeticsTab() {
  const tab = document.getElementById('tabCosmetics');
  if (!tab) return;

  // L'atelier cosmétique est maintenant intégré dans l'onglet Gang
  tab.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;gap:16px;text-align:center">
      <div style="font-size:36px">👑</div>
      <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold)">ATELIER COSMÉTIQUES</div>
      <div style="font-size:11px;color:var(--text-dim);max-width:260px">L'atelier est maintenant intégré dans l'onglet Gang.</div>
      <button id="btnGoGangTab" style="font-family:var(--font-pixel);font-size:9px;padding:8px 18px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">
        → Aller à l'onglet Gang
      </button>
    </div>`;

  tab.querySelector('#btnGoGangTab')?.addEventListener('click', () => switchTab('tabGang'));
}

Object.assign(globalThis, { renderCosmeticsTab });
export { renderCosmeticsTab };
