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
  ['spearow','fearow',20],['doduo','dodrio',31],
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
  ['eevee','vaporeon','item'],
  ['eevee','jolteon','item'],
  ['eevee','flareon','item'],
  ['zubat','golbat',22],

  // ── Gen 2 : Starters Johto ──────────────────────────────────────
  ['chikorita','bayleef',16],['bayleef','meganium',32],
  ['cyndaquil','quilava',14],['quilava','typhlosion',36],
  ['totodile','croconaw',18],['croconaw','feraligatr',30],

  // ── Gen 2 : Nouvelles lignes d'évolution ────────────────────────
  ['sentret','furret',15],
  ['hoothoot','noctowl',20],
  ['ledyba','ledian',18],
  ['spinarak','ariados',22],
  ['chinchou','lanturn',27],
  ['togepi','togetic','item'],
  ['natu','xatu',25],
  ['mareep','flaaffy',15],['flaaffy','ampharos',30],
  ['marill','azumarill',18],
  ['hoppip','skiploom',18],['skiploom','jumpluff',27],
  ['sunkern','sunflora','item'],
  ['wooper','quagsire',20],
  ['pineco','forretress',31],
  ['snubbull','granbull',23],
  ['teddiursa','ursaring',30],
  ['slugma','magcargo',38],
  ['swinub','piloswine',33],
  ['remoraid','octillery',25],
  ['houndour','houndoom',24],
  ['phanpy','donphan',25],
  ['larvitar','pupitar',30],['pupitar','tyranitar',55],
  ['porygon','porygon2','item'],

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

  // ── Gen 3 : Starters Hoenn ──────────────────────────────────────
  ['treecko','grovyle',16],['grovyle','sceptile',36],
  ['torchic','combusken',16],['combusken','blaziken',36],
  ['mudkip','marshtomp',16],['marshtomp','swampert',36],

  // ── Gen 3 : Lignes communes ─────────────────────────────────────
  ['poochyena','mightyena',18],
  ['zigzagoon','linoone',20],
  ['wurmple','silcoon',7],        // split avec cascoon
  ['wurmple','cascoon',7],
  ['silcoon','beautifly',10],
  ['cascoon','dustox',10],
  ['lotad','lombre',14],['lombre','ludicolo','item'],
  ['seedot','nuzleaf',14],['nuzleaf','shiftry','item'],
  ['taillow','swellow',22],
  ['wingull','pelipper',25],
  ['ralts','kirlia',20],['kirlia','gardevoir',30],
  ['surskit','masquerain',22],
  ['shroomish','breloom',23],
  ['slakoth','vigoroth',18],['vigoroth','slaking',36],
  ['nincada','ninjask',20],
  ['whismur','loudred',20],['loudred','exploud',40],
  ['makuhita','hariyama',24],
  ['azurill','marill',15],        // bébé → Gen 2 (amitié → lv15 dans ce jeu)
  ['skitty','delcatty','item'],
  ['aron','lairon',32],['lairon','aggron',42],
  ['meditite','medicham',37],
  ['electrike','manectric',26],
  ['gulpin','swalot',26],
  ['carvanha','sharpedo',30],
  ['wailmer','wailord',40],
  ['numel','camerupt',33],
  ['spoink','grumpig',32],
  ['trapinch','vibrava',35],['vibrava','flygon',45],
  ['cacnea','cacturne',32],
  ['swablu','altaria',35],
  ['barboach','whiscash',30],
  ['corphish','crawdaunt',30],
  ['baltoy','claydol',36],
  ['lileep','cradily',40],
  ['anorith','armaldo',40],
  ['feebas','milotic','item'],    // beauté → Pierre dans ce jeu
  ['shuppet','banette',37],
  ['duskull','dusclops',37],
  ['wynaut','wobbuffet',15],      // bébé
  ['snorunt','glalie',42],
  ['spheal','sealeo',32],['sealeo','walrein',44],
  ['clamperl','huntail','item'],  // split avec gorebyss
  ['clamperl','gorebyss','item'],
  ['bagon','shelgon',30],['shelgon','salamence',50],
  ['beldum','metang',20],['metang','metagross',45],
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
