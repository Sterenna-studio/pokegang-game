/* Zone config constants extracted from app.js */

const ZONE_BG_URL = (name) => `https://play.pokemonshowdown.com/sprites/gen5-back/${name}.png`;
// Zone backgrounds — Showdown image URL (confirmed working) + gradient fallback
// Background-image uses multi-layer: image on top, gradient underneath as fallback
const SD_BG = 'https://play.pokemonshowdown.com/fx/bg-';
const ZONE_BGS = {
  // ── Routes & nature ──────────────────────────────────────────
  route1:           { url:`${SD_BG}meadow.png`,         fb:'#1a3a0a,#0d2008' },
  viridian_forest:  { url:`${SD_BG}forest.png`,         fb:'#0a2a08,#041504' },
  route22:          { url:`${SD_BG}meadow.png`,          fb:'#1a2808,#101a04' },
  pallet_garden:    { url:`${SD_BG}meadow.png`,          fb:'#0a2a04,#061802' },
  // ── Cavernes ─────────────────────────────────────────────────
  mt_moon:          { url:`${SD_BG}mountain.png`,       fb:'#12123a,#07073a' },
  diglett_cave:     { url:`${SD_BG}mountain.png`,        fb:'#2a1204,#180a02' },
  rock_tunnel:      { url:`${SD_BG}mountain.png`,        fb:'#1a1410,#0a0a08' },
  victory_road:     { url:`${SD_BG}mountain.png`,       fb:'#2a1208,#180a06' },
  unknown_cave:     { url:`${SD_BG}mountain.png`,        fb:'#100820,#080012' },
  // ── Zones urbaines ───────────────────────────────────────────
  power_plant:      { url:`${SD_BG}city.png`,           fb:'#2a2008,#1a1400' },
  silph_co:         { url:`${SD_BG}city.png`,             fb:'#08101a,#040810' },
  // ── Zones spectrales / sombres ────────────────────────────────
  pokemon_tower:    { url:`${SD_BG}city.png`,            fb:'#0d0020,#06000f' },
  lavender_town:    { url:`${SD_BG}city.png`,            fb:'#160030,#0a0020' },
  pokemon_mansion:  { url:`${SD_BG}city.png`,            fb:'#200408,#140204' },
  // ── Mer / côte ────────────────────────────────────────────────
  seafoam_islands:  { url:`${SD_BG}deepsea.png`,        fb:'#082a3a,#041a2a' },
  ss_anne:          { url:`${SD_BG}beach.png`,           fb:'#082038,#041428' },
  // ── Montagne alta ────────────────────────────────────────────
  mt_silver:        { url:`${SD_BG}mountain.png`,        fb:'#0a0a20,#040414' },
  // ── Arènes ───────────────────────────────────────────────────
  pewter_gym:       { url:`${SD_BG}mountain.png`,        fb:'#2a1a08,#1a0e04' },
  cerulean_gym:     { url:`${SD_BG}beach.png`,           fb:'#081a3a,#041228' },
  celadon_gym:      { url:`${SD_BG}forest.png`,          fb:'#0a2a08,#042008' },
  fuchsia_gym:      { url:`${SD_BG}river.png`,           fb:'#280828,#180418' },
  saffron_gym:      { url:`${SD_BG}city.png`,            fb:'#181830,#0c0c22' },
  cinnabar_gym:     { url:`${SD_BG}desert.png`,          fb:'#3a0808,#280404' },
  indigo_plateau:   { url:`${SD_BG}mountain.png`,        fb:'#1a1a2a,#0c0c1c' },
  // ── Lieux spéciaux Kanto ─────────────────────────────────────
  safari_zone:      { url:`${SD_BG}meadow.png`,          fb:'#082008,#041204' },
  celadon_casino:   { url:`${SD_BG}city.png`,            fb:'#1a0030,#100020' },

  // ── Hoenn — Routes & nature ───────────────────────────────────
  route101:         { url:`${SD_BG}meadow.png`,          fb:'#0a2204,#061402' },
  petalburg_woods:  { url:`${SD_BG}forest.png`,          fb:'#062208,#031404' },
  route102_103:     { url:`${SD_BG}meadow.png`,          fb:'#0c2608,#081808' },
  route104_106:     { url:`${SD_BG}beach.png`,           fb:'#062038,#041428' },
  route110:         { url:`${SD_BG}meadow.png`,          fb:'#0a1e08,#061208' },
  route111_desert:  { url:`${SD_BG}desert.png`,          fb:'#2a1e04,#1a1402' },
  route114_115:     { url:`${SD_BG}river.png`,           fb:'#082820,#041a14' },
  route119:         { url:`${SD_BG}river.png`,           fb:'#062a10,#041a08' },
  route120_121:     { url:`${SD_BG}forest.png`,          fb:'#082208,#041404' },
  safari_hoenn:     { url:`${SD_BG}meadow.png`,          fb:'#0a2008,#061204' },
  // ── Hoenn — Grottes & montagnes ───────────────────────────────
  granite_cave:     { url:`${SD_BG}mountain.png`,        fb:'#18180a,#0e0e06' },
  mt_chimney:       { url:`${SD_BG}desert.png`,          fb:'#2e0a04,#1e0402' },
  jagged_pass:      { url:`${SD_BG}mountain.png`,        fb:'#2a0e04,#1a0802' },
  victory_road_hoenn:{ url:`${SD_BG}mountain.png`,       fb:'#1a1420,#0c0e18' },
  sky_pillar:       { url:`${SD_BG}mountain.png`,        fb:'#100830,#08041e' },
  cave_of_origin:   { url:`${SD_BG}mountain.png`,        fb:'#04102a,#020c1e' },
  scorched_slab:    { url:`${SD_BG}desert.png`,          fb:'#2e1804,#1e0e02' },
  island_cave_ruins:{ url:`${SD_BG}mountain.png`,        fb:'#0c1428,#060e1c' },
  // ── Hoenn — Bases ennemies ────────────────────────────────────
  team_magma_hideout:{ url:`${SD_BG}mountain.png`,       fb:'#300808,#200404' },
  team_aqua_hideout:{ url:`${SD_BG}deepsea.png`,         fb:'#041428,#02091c' },
  laboratoire_spatial:{ url:`${SD_BG}city.png`,          fb:'#080c1a,#040810' },
  // ── Hoenn — Arènes ───────────────────────────────────────────
  rustboro_gym:     { url:`${SD_BG}mountain.png`,        fb:'#1a1408,#0e0c04' },
  dewford_gym:      { url:`${SD_BG}beach.png`,           fb:'#0a1828,#06101c' },
  mauville_gym:     { url:`${SD_BG}city.png`,            fb:'#1a1a08,#101004' },
  lavaridge_gym:    { url:`${SD_BG}desert.png`,          fb:'#2a0c04,#1c0802' },
  petalburg_gym:    { url:`${SD_BG}forest.png`,          fb:'#0a1a08,#061204' },
  fortree_gym:      { url:`${SD_BG}forest.png`,          fb:'#061c06,#041004' },
  mossdeep_gym:     { url:`${SD_BG}deepsea.png`,         fb:'#060c28,#04081c' },
  sootopolis_gym:   { url:`${SD_BG}mountain.png`,        fb:'#081828,#04101c' },
  ever_grande_hoenn:{ url:`${SD_BG}mountain.png`,        fb:'#14102a,#0c0820' },
};

// Cosmetic backgrounds purchasable for the game screen
const COSMETIC_BGS = {
  // ── Fonds d'écran photo (CDN Showdown) ───────────────────────
  meadow:        { fr:'Prairie',       cost:5000,  url:`${SD_BG}meadow.png`,   type:'image' },
  forest:        { fr:'Forêt',         cost:8000,  url:`${SD_BG}forest.png`,   type:'image' },
  mountain:      { fr:'Montagne',      cost:10000, url:`${SD_BG}mountain.png`, type:'image' },
  beach:         { fr:'Plage',         cost:8000,  url:`${SD_BG}beach.png`,    type:'image' },
  river:         { fr:'Rivière',       cost:6000,  url:`${SD_BG}river.png`,    type:'image' },
  city:          { fr:'Ville',         cost:12000, url:`${SD_BG}city.png`,     type:'image' },
  desert:        { fr:'Désert',        cost:10000, url:`${SD_BG}desert.png`,   type:'image' },
  deepsea:       { fr:'Fond Marin',    cost:20000, url:`${SD_BG}deepsea.png`,  type:'image' },
  // ── Thèmes couleur (dégradés CSS) ────────────────────────────
  theme_red:     { fr:'Rouge Sang',    cost:2000,  gradient:'linear-gradient(145deg,#160000 0%,#2e0808 50%,#0a0000 100%)', type:'gradient' },
  theme_blue:    { fr:'Bleu Glacé',    cost:2000,  gradient:'linear-gradient(145deg,#000c1a 0%,#081a30 50%,#000810 100%)', type:'gradient' },
  theme_purple:  { fr:'Nuit Violette', cost:2000,  gradient:'linear-gradient(145deg,#0c0018 0%,#1a0830 50%,#060010 100%)', type:'gradient' },
  theme_green:   { fr:'Vert Toxik',    cost:2000,  gradient:'linear-gradient(145deg,#001400 0%,#0a2010 50%,#000a00 100%)', type:'gradient' },
  theme_gold:    { fr:'Doré',          cost:4000,  gradient:'linear-gradient(145deg,#1a1000 0%,#2e2000 50%,#0a0800 100%)', type:'gradient' },
  theme_sunset:  { fr:'Coucher Soleil',cost:4000,  gradient:'linear-gradient(145deg,#1a0800 0%,#2e1000 40%,#180016 100%)', type:'gradient' },
  theme_midnight:{ fr:'Minuit',        cost:3000,  gradient:'linear-gradient(145deg,#020204 0%,#060610 50%,#000004 100%)', type:'gradient' },
};

// Sequential gym unlock order — Kanto
const GYM_ORDER = ['pewter_gym','cerulean_gym','celadon_gym','fuchsia_gym','saffron_gym','cinnabar_gym','indigo_plateau'];

// Sequential gym unlock order — Johto
const JOHTO_GYM_ORDER = ['violet_gym','azalea_gym','goldenrod_gym','ecruteak_gym','cianwood_gym','olivine_gym','mahogany_gym','blackthorn_gym','indigo_johto'];

// Sequential gym unlock order — Hoenn
const HOENN_GYM_ORDER = ['rustboro_gym','dewford_gym','mauville_gym','lavaridge_gym','petalburg_gym','fortree_gym','mossdeep_gym','sootopolis_gym','ever_grande_hoenn'];

// Sequential gym unlock order — Sinnoh
const SINNOH_GYM_ORDER = ['oreburgh_gym','eterna_gym','veilstone_gym','pastoria_gym','hearthome_gym','canalave_gym','snowpoint_gym','sunyshore_gym','pokemon_league_sinnoh'];

export { ZONE_BG_URL, GYM_ORDER, JOHTO_GYM_ORDER, HOENN_GYM_ORDER, SINNOH_GYM_ORDER };
