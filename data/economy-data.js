/* Economy and shop data extracted from app.js */

const BALLS = {
  pokeball:   { fr:'Poké Ball',  en:'Poké Ball',  cost:200,  potential:[40,30,20,8,2]  },
  greatball:  { fr:'Super Ball', en:'Great Ball',  cost:600,  potential:[15,30,30,18,7] },
  ultraball:  { fr:'Hyper Ball', en:'Ultra Ball',  cost:2000, potential:[5,15,30,30,20] },
  duskball:   { fr:'Sombre Ball',en:'Dusk Ball',   cost:1500, potential:[20,20,20,20,20]},
  masterball: { fr:'Master Ball',en:'Master Ball', cost:99999,potential:[0,0,0,10,90]  },
};

const SHOP_ITEMS = [
  { id:'pokeball',  qty:10, cost:2000,  icon:'PB'  },
  { id:'greatball', qty:10, cost:6000,  icon:'GB'  },
  { id:'ultraball', qty:5,  cost:10000, icon:'UB'  },
  { id:'duskball',  qty:5,  cost:7500,  icon:'DB'  },
  { id:'lure',      qty:1,  cost:500,   icon:'LR',  fr:'Leurre',       en:'Lure',            desc_fr:'x2 spawns 60s',         desc_en:'x2 spawns 60s' },
  { id:'superlure', qty:1,  cost:2000,  icon:'SL',  fr:'Super Leurre', en:'Super Lure',      desc_fr:'x3 spawns 60s',         desc_en:'x3 spawns 60s' },
  { id:'incense',   qty:1,  cost:1500,  icon:'IN',  fr:'Encens Chance',en:'Lucky Incense',   desc_fr:'*+1 potentiel 90s',     desc_en:'*+1 potential 90s' },
  { id:'rarescope', qty:1,  cost:3000,  icon:'SC',  fr:'Rarioscope',   en:'Rare Scope',      desc_fr:'Spawns rares x3 90s',   desc_en:'Rare spawns x3 90s' },
  { id:'aura',      qty:1,  cost:5000,  icon:'AU',  fr:'Aura Shiny',   en:'Shiny Aura',      desc_fr:'Shiny x5 90s',          desc_en:'Shiny x5 90s' },
  { id:'evostone',  qty:1,  cost:5000,  icon:'EV',  fr:'Pierre Evol.', en:'Evo Stone',       desc_fr:'Evoluer un Pokemon',    desc_en:'Evolve a Pokemon' },
  { id:'rarecandy', qty:1,  cost:3000,  icon:'RC',  fr:'Super Bonbon', en:'Rare Candy',      desc_fr:'+1 niveau',             desc_en:'+1 level' },
  { id:'translator',qty:1,  cost:1000000,icon:'TR', fr:'Traducteur Pokemon', en:'Pokemon Translator', desc_fr:'Comprend ce que disent les Pokemon en combat', desc_en:'Understand pokemon speech in combat' },
  { id:'mysteryegg', qty:1, cost:0, icon:'EG', fr:'Oeuf Mystère', en:'Mystery Egg', desc_fr:'Contient un Pokemon introuvable — Prix croissant', desc_en:'Contains an uncatchable Pokemon — Scaling price' },
  { id:'incubator',  qty:1, cost:15000, icon:'INC', fr:'Incubateur', en:'Incubator', desc_fr:'Eclot un oeuf (reutilisable) — 1 a la fois', desc_en:'Hatches an egg (reusable) — 1 at a time' },
  // ── Zone unlock items ──
  { id:'map_pallet',    qty:1, cost:5000,  icon:'🗺', fr:'Carte de Pallet',  en:'Pallet Map',      desc_fr:'Débloque le Jardin de Pallet',          desc_en:'Unlocks Pallet Garden' },
  { id:'casino_ticket', qty:1, cost:20000, icon:'🎰', fr:'Ticket Casino',    en:'Casino Ticket',   desc_fr:'Accès au Casino de Céladopole',         desc_en:'Access to Celadon Casino' },
  { id:'silph_keycard', qty:1, cost:50000, icon:'🔑', fr:'Badge Sylphe',     en:'Silph Keycard',   desc_fr:'Accès à Sylphe SARL',                   desc_en:'Access to Silph Co.' },
  { id:'boat_ticket',   qty:1, cost:15000, icon:'⚓', fr:'Ticket Bateau',    en:'Boat Ticket',     desc_fr:'Monte à bord du Bateau St. Anne',        desc_en:'Board the S.S. Anne' },
  { id:'egg_scanner', qty:1, cost:5000, icon:'🔬', fr:'Scanneur d\'Oeuf', en:'Egg Scanner', desc_fr:'89% révèle l\'espèce, 10% détruit l\'outil, 1% détruit l\'oeuf', desc_en:'89% reveals species, 10% destroys tool, 1% destroys egg' },
  // ── Zones légendaires Gen 2 (débloquables avec ailes) ──
  { id:'tourbillon_permit', qty:1, cost:0, wingCost:{ item:'silver_wing', qty:50 }, icon:'🌊',
    fr:'Permis Tourbillon', en:'Whirlpool Permit',
    desc_fr:'50× Argent\'Aile requis → Îles Tourbillon (Lugia)',
    desc_en:'50× Silver Wing required → Whirl Islands (Lugia)' },
  { id:'carillon_permit',   qty:1, cost:0, wingCost:{ item:'rainbow_wing', qty:50 }, icon:'🔔',
    fr:'Permis Carillon',   en:'Bell Tower Permit',
    desc_fr:'50× Arcenci\'Aile requis → Tour Carillon (Ho-Oh)',
    desc_en:'50× Rainbow Wing required → Bell Tower (Ho-Oh)' },
  // ── Gang special upgrades ──
  { id:'autoSellAgent', qty:1, cost:10_000_000, icon:'🤖',
    fr:'Vente Automatique', en:'Auto-Sell',
    desc_fr:'Les agents vendent automatiquement les captures selon le filtre configuré (Shinies toujours protégés)',
    desc_en:'Agents automatically sell captures based on your filter (Shinies always protected)' },
];
// Note: 'scientist' s'achète depuis l'onglet Gang ou Labo (carte avec sprite), pas au Marché.

// ── Mystery Egg ───────────────────────────────────────────────
const MYSTERY_EGG_BASE_COST = 50000;
// Weighted pool: {en, w} — higher w = more likely
const MYSTERY_EGG_POOL = [
  // Starters base (w:3)
  {en:'bulbasaur',w:3},{en:'charmander',w:3},{en:'squirtle',w:3},
  // Eevee + evolutions (w:3 / w:2)
  {en:'eevee',w:3},{en:'vaporeon',w:2},{en:'jolteon',w:2},
  // Fossils base forms (w:3)
  {en:'omanyte',w:3},{en:'kabuto',w:3},
  // Stage 2 starters (w:2)
  {en:'ivysaur',w:2},{en:'charmeleon',w:2},{en:'wartortle',w:2},
  // Rare singles (w:2)
  {en:'hitmonlee',w:2},{en:'hitmonchan',w:2},{en:'lickitung',w:2},{en:'farfetchd',w:2},
  // Fossil evolutions (w:2)
  {en:'omastar',w:2},{en:'kabutops',w:2},{en:'aerodactyl',w:2},
  // Final starters (w:1 — ultra rare)
  {en:'venusaur',w:1},{en:'charizard',w:1},{en:'blastoise',w:1},
];
const MYSTERY_EGG_HATCH_MS = 45 * 60 * 1000; // 45 min

// ── Potential multipliers (for market price) ─────────────────
const POTENTIAL_MULT = [0.5, 1, 2, 5, 15]; // index 0=★1 .. 4=★5

// ── Base prices by rarity ─────────────────────────────────────
const BASE_PRICE = { common:100, uncommon:250, rare:600, very_rare:1500, legendary:5000 };

function getMysteryEggCost(state) {
  const n = state?.purchases?.mysteryEggCount || 0;
  return MYSTERY_EGG_BASE_COST + n * 1000; // +1 000₽ par achat
}

export { BALLS, SHOP_ITEMS, MYSTERY_EGG_BASE_COST, MYSTERY_EGG_POOL, MYSTERY_EGG_HATCH_MS, POTENTIAL_MULT, BASE_PRICE, getMysteryEggCost };
