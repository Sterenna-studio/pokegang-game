// ════════════════════════════════════════════════════════════════
// PokéForge — Evolutions Data
// Chargé avant app.js comme <script> ordinaire (globals partagés)
// ════════════════════════════════════════════════════════════════

// ── Evolution Data ────────────────────────────────────────────
// level evolutions: [from, to, level]
// item evolutions: [from, to, 'item'] (needs Evolution Stone from shop)
const EVOLUTIONS = [
  // Starters
  ['bulbasaur','ivysaur',16],['ivysaur','venusaur',32],
  ['charmander','charmeleon',16],['charmeleon','charizard',36],
  ['squirtle','wartortle',16],['wartortle','blastoise',36],
  // Bugs
  ['caterpie','metapod',7],['metapod','butterfree',10],
  ['weedle','kakuna',7],['kakuna','beedrill',10],
  // Birds
  ['pidgey','pidgeotto',18],['pidgeotto','pidgeot',36],
  ['spearow','fearow',20],
  // Poison
  ['ekans','arbok',22],
  ['nidoran-f','nidorina',16],['nidorina','nidoqueen','item'],
  ['nidoran-m','nidorino',16],['nidorino','nidoking','item'],
  // Electric
  ['pikachu','raichu','item'],['voltorb','electrode',30],['magnemite','magneton',30],
  // Ground
  ['sandshrew','sandslash',22],['diglett','dugtrio',26],
  // Fairy
  ['clefairy','clefable','item'],['jigglypuff','wigglytuff','item'],
  // Fire
  ['vulpix','ninetales','item'],['growlithe','arcanine','item'],
  // Water
  ['poliwag','poliwhirl',25],['poliwhirl','poliwrath','item'],
  ['psyduck','golduck',33],['tentacool','tentacruel',30],
  ['seel','dewgong',34],['shellder','cloyster','item'],
  ['horsea','seadra',32],['goldeen','seaking',33],
  ['staryu','starmie','item'],['magikarp','gyarados',20],
  // Fighting
  ['mankey','primeape',28],['machop','machoke',28],['machoke','machamp','item'],
  // Psychic
  ['abra','kadabra',16],['kadabra','alakazam','item'],
  ['slowpoke','slowbro',37],['drowzee','hypno',26],
  // Grass/Poison
  ['oddish','gloom',21],['gloom','vileplume','item'],
  ['bellsprout','weepinbell',21],['weepinbell','victreebel','item'],
  ['paras','parasect',24],['venonat','venomoth',31],
  // Normal
  ['meowth','persian',28],['rattata','raticate',20],
  // Rock
  ['geodude','graveler',25],['graveler','golem','item'],
  // Ghost
  ['gastly','haunter',25],['haunter','gengar','item'],
  // Misc
  ['ponyta','rapidash',40],['krabby','kingler',28],
  ['exeggcute','exeggutor','item'],
  ['cubone','marowak',28],['rhyhorn','rhydon',42],
  ['grimer','muk',38],['koffing','weezing',35],
  ['omanyte','omastar',40],['kabuto','kabutops',40],
  ['dratini','dragonair',30],['dragonair','dragonite',55],
  ['eevee','vaporeon','item'], // will use the single item for all trade evos
  ['zubat','golbat',22],

  // ── Gen 2 : bébés → Gen 1 ───────────────────────────────────────
  ['pichu','pikachu',10],
  ['cleffa','clefairy',5],
  ['igglybuff','jigglypuff',5],
  ['smoochum','jynx',30],
  ['elekid','electabuzz',30],
  ['magby','magmar',30],
  ['tyrogue','hitmonlee',20],
  ['tyrogue','hitmonchan',20],
  ['tyrogue','hitmontop',20],

  // ── Gen 2 : évolutions supplémentaires de Gen 1 ─────────────────
  ['golbat','crobat',35],
  ['gloom','bellossom','item'],       // split avec vileplume
  ['poliwhirl','politoed','item'],    // split avec poliwrath
  ['slowpoke','slowking','item'],     // split avec slowbro
  ['onix','steelix','item'],
  ['scyther','scizor','item'],
  ['eevee','espeon','item'],
  ['eevee','umbreon','item'],
  ['seadra','kingdra','item'],
  ['chansey','blissey',30],
];

const EVO_BY_SPECIES = {};
EVOLUTIONS.forEach(([from, to, req]) => {
  if (!EVO_BY_SPECIES[from]) EVO_BY_SPECIES[from] = [];
  EVO_BY_SPECIES[from].push({ to, req });
});

// Reverse evo map: species → direct predecessor
const EVO_PREV = {};
EVOLUTIONS.forEach(([from, to]) => { EVO_PREV[to] = from; });

// Get the base (stage 1) of any species
function getBaseSpecies(en) {
  let sp = en;
  while (EVO_PREV[sp]) sp = EVO_PREV[sp];
  return sp;
}
