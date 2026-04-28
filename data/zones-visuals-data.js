/* Zone visual data extracted from app.js */

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
  tourbillon:       { url:`${SD_BG}deepsea.png`,         fb:'#040c1a,#020610' },
  // ── Montagne alta ────────────────────────────────────────────
  mt_silver:        { url:`${SD_BG}mountain.png`,        fb:'#0a0a20,#040414' },
  // ── Lieux légendaires ─────────────────────────────────────────
  tour_carillon:    { url:`${SD_BG}city.png`,            fb:'#1a1000,#301800' },
  // ── Arènes ───────────────────────────────────────────────────
  pewter_gym:       { url:`${SD_BG}mountain.png`,        fb:'#2a1a08,#1a0e04' },
  cerulean_gym:     { url:`${SD_BG}beach.png`,           fb:'#081a3a,#041228' },
  celadon_gym:      { url:`${SD_BG}forest.png`,          fb:'#0a2a08,#042008' },
  fuchsia_gym:      { url:`${SD_BG}river.png`,           fb:'#280828,#180418' },
  saffron_gym:      { url:`${SD_BG}city.png`,            fb:'#181830,#0c0c22' },
  cinnabar_gym:     { url:`${SD_BG}desert.png`,          fb:'#3a0808,#280404' },
  indigo_plateau:   { url:`${SD_BG}mountain.png`,        fb:'#1a1a2a,#0c0c1c' },
  // ── Lieux spéciaux ───────────────────────────────────────────
  safari_zone:      { url:`${SD_BG}meadow.png`,          fb:'#082008,#041204' },
  celadon_casino:   { url:`${SD_BG}city.png`,            fb:'#1a0030,#100020' },
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

export { ZONE_BGS, COSMETIC_BGS };
