/* Economy and shop data extracted from app.js */

// BALLS : données purement cosmétiques — plus aucun effet mécanique sur le potentiel.
// Le skin actif est affiché lors des captures (animation boss / agent).
const BALLS = {
  pokeball:   { fr:'Poké Ball',   en:'Poké Ball',   color:'#e03030', icon:'PB' },
  greatball:  { fr:'Super Ball',  en:'Great Ball',  color:'#2255ee', icon:'GB' },
  ultraball:  { fr:'Hyper Ball',  en:'Ultra Ball',  color:'#ddbb00', icon:'UB' },
  duskball:   { fr:'Sombre Ball', en:'Dusk Ball',   color:'#445566', icon:'DB' },
  masterball: { fr:'Master Ball', en:'Master Ball', color:'#9922cc', icon:'MB' },
};

const SHOP_ITEMS = [
  // ── Poké Balls (ressource unique de capture) ──
  { id:'pokeball',  qty:10, cost:200,  icon:'PB'  },
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
  // ── Skins de Ball (cosmétique — appliquer au boss ou aux agents) ──
  // Achat par troc : X pokeballs → skin débloqué dans state.purchases
  { id:'skin_greatball',  qty:1, cost:0, ballSkin:'greatball',  icon:'GB',
    fr:'Skin Super Ball',  en:'Great Ball Skin',
    barter:{ item:'pokeball', qty:200 },
    desc_fr:'200 Poké Balls → skin Super Ball (boss + agents)',
    desc_en:'200 Poké Balls → Great Ball skin (boss + agents)' },
  { id:'skin_duskball',   qty:1, cost:0, ballSkin:'duskball',   icon:'DB',
    fr:'Skin Sombre Ball', en:'Dusk Ball Skin',
    barter:{ item:'pokeball', qty:350 },
    desc_fr:'350 Poké Balls → skin Sombre Ball (boss + agents)',
    desc_en:'350 Poké Balls → Dusk Ball skin (boss + agents)' },
  { id:'skin_ultraball',  qty:1, cost:0, ballSkin:'ultraball',  icon:'UB',
    fr:'Skin Hyper Ball',  en:'Ultra Ball Skin',
    barter:{ item:'pokeball', qty:600 },
    desc_fr:'600 Poké Balls → skin Hyper Ball (boss + agents)',
    desc_en:'600 Poké Balls → Ultra Ball skin (boss + agents)' },
  { id:'skin_masterball', qty:1, cost:1500000, ballSkin:'masterball', icon:'MB',
    fr:'Skin Master Ball', en:'Master Ball Skin',
    desc_fr:'1 500 000₽ → skin Master Ball légendaire (boss + agents)',
    desc_en:'1,500,000₽ → Legendary Master Ball skin (boss + agents)' },
  // ── Zone unlock items ──
  { id:'map_pallet',    qty:1, cost:5000,  icon:'🗺', fr:'Carte de Pallet',  en:'Pallet Map',      desc_fr:'Débloque le Jardin de Pallet',          desc_en:'Unlocks Pallet Garden' },
  { id:'casino_ticket', qty:1, cost:20000, icon:'🎰', fr:'Ticket Casino',    en:'Casino Ticket',   desc_fr:'Accès au Casino de Céladopole',         desc_en:'Access to Celadon Casino' },
  { id:'silph_keycard', qty:1, cost:50000, icon:'🔑', fr:'Badge Sylphe',     en:'Silph Keycard',   desc_fr:'Accès à Sylphe SARL',                   desc_en:'Access to Silph Co.' },
  { id:'boat_ticket',   qty:1, cost:15000, icon:'⚓', fr:'Ticket Bateau',    en:'Boat Ticket',     desc_fr:'Monte à bord du Bateau St. Anne',        desc_en:'Board the S.S. Anne' },
  // ── Zones légendaires Gen 2 (débloquables avec ailes) ──
  { id:'tourbillon_permit', qty:1, cost:0, wingCost:{ item:'silver_wing', qty:50 }, icon:'🌊',
    fr:'Permis Tourbillon', en:'Whirlpool Permit',
    desc_fr:'50× Argent\'Aile requis → Îles Tourbillon (Lugia)',
    desc_en:'50× Silver Wing required → Whirl Islands (Lugia)' },
  { id:'carillon_permit',   qty:1, cost:0, wingCost:{ item:'rainbow_wing', qty:50 }, icon:'🔔',
    fr:'Permis Carillon',   en:'Bell Tower Permit',
    desc_fr:'50× Arcenci\'Aile requis → Tour Carillon (Ho-Oh)',
    desc_en:'50× Rainbow Wing required → Bell Tower (Ho-Oh)' },
  // ── Zones Johto spéciales ──
  // rocket_hq_keycard : pas dans le shop — obtenu automatiquement à 50 Rockets Johto vaincus
  { id:'rocket_hq_keycard', qty:1, cost:0, hidden:true, icon:'🔑',
    fr:'Badge QG Rocket',   en:'Rocket HQ Keycard',
    achievement:{ stat:'rocketDefeatedJohto', target:50 },
    desc_fr:'50 agents Rocket (Johto) vaincus → Accès au QG de la Team Rocket à Acajou',
    desc_en:'50 Johto Rocket agents defeated → Access to Team Rocket HQ in Mahogany Town' },
  // rocket_uniform : pas dans le shop — obtenu automatiquement à 100 Rockets Johto vaincus
  { id:'rocket_uniform',    qty:1, cost:0, hidden:true, icon:'👔',
    fr:'Uniforme Rocket',   en:'Rocket Uniform',
    achievement:{ stat:'rocketDefeatedJohto', target:100 },
    desc_fr:'100 agents Rocket (Johto) vaincus → Déguisement pour infiltrer la Tour Radio de Doublonville',
    desc_en:'100 Johto Rocket agents defeated → Disguise to infiltrate Goldenrod Radio Tower' },
  { id:'silver_permit',     qty:1, cost:1000000, icon:'🗻',
    fr:'Permis Mont Argenté',en:'Mt. Silver Permit',
    prereqs:{ gymsKanto: true, gymsJohto: true },
    desc_fr:'Toutes les arènes Kanto + Johto vaincues requis — Accès au sommet du Mont Argenté — Red vous attend',
    desc_en:'All Kanto + Johto gyms required — Access to Mt. Silver Summit — Red awaits' },
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
  // Bébés Pokémon (w:2 — obtenables uniquement par œuf)
  {en:'pichu',w:2},{en:'cleffa',w:2},{en:'igglybuff',w:2},
  {en:'togepi',w:2},{en:'tyrogue',w:2},
  {en:'smoochum',w:1},{en:'elekid',w:1},{en:'magby',w:1},
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
