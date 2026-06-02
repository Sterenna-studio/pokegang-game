// ════════════════════════════════════════════════════════════════
// PokéGang — Zones Hoenn Data (Gen 3)
// Chargé avant app.js comme <script> ordinaire (globals partagés)
// Doit être chargé APRÈS zones-data.js + zones-johto-data.js dans index.html.
//
// Format de pool identique à zones-johto-data.js :
//   poolCommon[]    — toujours présents
//   poolUncommon[]  — zone level 1+
//   poolRare[]      — zone level 2+ (w:3 dans rarePool)
//   poolVeryRare[]  — zone level 5+ (w:1 dans rarePool)
//   poolLegendary[] — zone level 8+ (w:1 dans rarePool)
//
// Dresseurs Hoenn disponibles (trainers-data.js) :
//   tuber, tuberf, kindler, parasollady, triathlete, triathletebikerf,
//   ruinmaniac, dragontamer, birdkeeperGen3, collectorGen3,
//   acetrainerGen3, acetrainerFGen3, hikerGen3, swimmerGen3, swimmerFGen3, fisherGen3,
//   magmagrunt, magmagruntf, tabitha, courtney, maxie,
//   aquagrunt, aquagruntf, matt, shelly, archie,
//   roxanne, brawly, wattson, flannery, normanHoenn, winona, tate, liza, juan,
//   sidney, phoebe, glacia, drake, steven,
//   brendan, may, pokemonranger, pokemonrangerf
// ════════════════════════════════════════════════════════════════

const ZONES_HOENN = [

  // ══ QUARTIER GÉNÉRAL HOENN ══════════════════════════════════════
  { id:'hoenn_gang_hq', fr:'Planque de Bourg Natal', en:'Littleroot Hideout', rep:0, spawnRate:0, type:'gang_park',
    zoneLevelBonus:0, pool:[], poolCommon:[], trainers:[], investCost:0,
    desc_fr:'Votre planque secrète à Bourg Natal. Le calme avant la tempête Hoenn.',
    desc_en:'Your secret hideout in Littleroot Town. The calm before the Hoenn storm.' },


  // ══════════════════════════════════════════════════════════════
  // ROUTES & NATURE
  // ══════════════════════════════════════════════════════════════

  // ── Début Hoenn (Rep 2000–2300) ───────────────────────────────

  { id:'route101', fr:'Route 101', en:'Route 101', rep:2000, spawnRate:0.07, type:'route',
    zoneLevelBonus:55, investCost:8000,
    poolCommon:   ['poochyena','zigzagoon','wurmple'],
    poolUncommon: ['lotad','seedot','taillow'],
    poolRare:     ['ralts','shroomish'],
    poolVeryRare: ['spinda'],
    poolLegendary:[],
    trainers:['youngster','lass','tuber','tuberf'],
    eliteTrainer:'brendan' },

  { id:'petalburg_woods', fr:'Bois de Bourg Épée', en:'Petalburg Woods', rep:2050, spawnRate:0.07, type:'route',
    zoneLevelBonus:56, investCost:2000,
    poolCommon:   ['wurmple','silcoon','cascoon','shroomish'],
    poolUncommon: ['slakoth','nincada','surskit'],
    poolRare:     ['beautifly','dustox','breloom'],
    poolVeryRare: ['heracross'],
    poolLegendary:[],
    trainers:['youngster','lass','bugcatcher'],
    eliteTrainer:'roxanne' },

  { id:'route102_103', fr:'Routes 102 & 103', en:'Routes 102 & 103', rep:2100, spawnRate:0.07, type:'route',
    zoneLevelBonus:57, investCost:2000,
    poolCommon:   ['poochyena','zigzagoon','wingull','surskit'],
    poolUncommon: ['lotad','seedot','marill','electrike'],
    poolRare:     ['ralts','plusle','minun'],
    poolVeryRare: ['mightyena'],
    poolLegendary:[],
    trainers:['youngster','lass','tuber','tuberf','fisherGen3'],
    eliteTrainer:'brendan' },

  { id:'granite_cave', fr:'Grotte Granite', en:'Granite Cave', rep:2180, spawnRate:0.05, type:'route',
    zoneLevelBonus:58, investCost:4000,
    poolCommon:   ['zubat','geodude','aron'],
    poolUncommon: ['makuhita','sableye','mawile'],
    poolRare:     ['lairon','graveler'],
    poolVeryRare: ['aggron'],
    poolLegendary:[],
    ghostZone: false,
    trainers:['hikerGen3','ruinmaniac','collectorGen3'],
    eliteTrainer:'brawly' },

  { id:'route104_106', fr:'Routes 104, 105 & 106', en:'Routes 104, 105 & 106', rep:2100, spawnRate:0.07, type:'route',
    zoneLevelBonus:57, investCost:3000,
    poolCommon:   ['wingull','tentacool','magikarp'],
    poolUncommon: ['pelipper','wailmer','surskit'],
    poolRare:     ['corsola','staryu','luvdisc'],
    poolVeryRare: ['wailord'],
    poolLegendary:[],
    trainers:['swimmerGen3','swimmerFGen3','fisherGen3','tuber','tuberf'],
    eliteTrainer:'roxanne' },

  // ── Hoenn milieu (Rep 2300–2800) ──────────────────────────────

  { id:'route110', fr:'Route 110', en:'Route 110', rep:2300, spawnRate:0.07, type:'route',
    zoneLevelBonus:60, investCost:5000,
    poolCommon:   ['electrike','plusle','minun','gulpin'],
    poolUncommon: ['manectric','voltorb','linoone'],
    poolRare:     ['roselia','marill'],
    poolVeryRare: ['ampharos'],
    poolLegendary:[],
    trainers:['youngster','lass','triathlete','triathletebikerf'],
    eliteTrainer:'wattson' },

  { id:'route111_desert', fr:'Route 111 & Désert de Maupos', en:'Route 111 & Mirage Desert', rep:2450, spawnRate:0.05, type:'route',
    zoneLevelBonus:62, investCost:8000,
    poolCommon:   ['trapinch','cacnea','sandshrew'],
    poolUncommon: ['vibrava','cacturne','baltoy'],
    poolRare:     ['flygon','claydol','lunatone','solrock'],
    poolVeryRare: ['absol'],
    poolLegendary:[],
    trainers:['hikerGen3','ruinmaniac','triathlete'],
    eliteTrainer:'flannery' },

  { id:'mt_chimney', fr:'Mont Cendreux', en:'Mt. Chimney', rep:2550, spawnRate:0.05, type:'route',
    zoneLevelBonus:63, investCost:10000,
    poolCommon:   ['numel','slugma','magby'],
    poolUncommon: ['camerupt','magcargo','torkoal'],
    poolRare:     ['magmar','growlithe'],
    poolVeryRare: ['arcanine'],
    poolLegendary:[],
    trainers:['kindler','hikerGen3','magmagrunt','magmagruntf'],
    eliteTrainer:'flannery' },

  { id:'jagged_pass', fr:'Sentier Escarpé', en:'Jagged Pass', rep:2700, spawnRate:0.06, type:'route',
    zoneLevelBonus:64, investCost:12000,
    poolCommon:   ['numel','machop','spoink'],
    poolUncommon: ['camerupt','machoke','grumpig'],
    poolRare:     ['medicham','hariyama'],
    poolVeryRare: ['breloom'],
    poolLegendary:[],
    trainers:['hikerGen3','kindler','triathlete'],
    eliteTrainer:'normanHoenn' },

  { id:'route114_115', fr:'Routes 114 & 115', en:'Routes 114 & 115', rep:2800, spawnRate:0.07, type:'route',
    zoneLevelBonus:65, investCost:14000,
    poolCommon:   ['swablu','zangoose','seviper','nuzleaf'],
    poolUncommon: ['altaria','shiftry','tropius','chimecho'],
    poolRare:     ['absol','sableye','mawile'],
    poolVeryRare: ['salamence'],
    poolLegendary:[],
    trainers:['hikerGen3','acetrainerGen3','acetrainerFGen3'],
    eliteTrainer:'winona' },

  // ── Hoenn avancé (Rep 2900–3700) ─────────────────────────────

  { id:'route119', fr:'Route 119', en:'Route 119', rep:2950, spawnRate:0.07, type:'route',
    zoneLevelBonus:67, investCost:18000,
    poolCommon:   ['tropius','kecleon','wurmple'],
    poolUncommon: ['linoone','volbeat','illumise','roselia'],
    poolRare:     ['feebas','castform'],
    poolVeryRare: ['milotic'],
    poolLegendary:[],
    trainers:['acetrainerGen3','acetrainerFGen3','parasollady'],
    eliteTrainer:'winona' },

  { id:'route120_121', fr:'Routes 120 & 121', en:'Routes 120 & 121', rep:3100, spawnRate:0.07, type:'route',
    zoneLevelBonus:68, investCost:22000,
    poolCommon:   ['kecleon','absol','poochyena'],
    poolUncommon: ['shuppet','sableye','zangoose','seviper'],
    poolRare:     ['banette','mightyena','shiftry'],
    poolVeryRare: ['absol'],
    poolLegendary:[],
    trainers:['acetrainerGen3','acetrainerFGen3','ruinmaniac','dragontamer','may'],
    eliteTrainer:'juan' },

  { id:'safari_hoenn', fr:'Zone Safari Hoenn', en:'Hoenn Safari Zone', rep:3000, spawnRate:0.08, type:'special',
    zoneLevelBonus:68, investCost:25000,
    poolCommon:   ['pikachu','vulpix','oddish','psyduck'],
    poolUncommon: ['wobbuffet','girafarig','natu','aipom'],
    poolRare:     ['heracross','pinsir','bagon','dratini'],
    poolVeryRare: ['treecko','torchic','mudkip','kangaskhan'],
    poolLegendary:['latias','latios'],
    trainers:['acetrainerGen3','acetrainerFGen3','pokemonranger','pokemonrangerf'],
    eliteTrainer:'steven' },

  { id:'victory_road_hoenn', fr:'Ligue Victoire Hoenn', en:'Victory Road Hoenn', rep:3600, spawnRate:0.04, type:'route',
    zoneLevelBonus:75, investCost:40000,
    poolCommon:   ['golbat','geodude','graveler','mightyena'],
    poolUncommon: ['hariyama','lairon','medicham'],
    poolRare:     ['aggron','absol','claydol'],
    poolVeryRare: ['bagon','shelgon'],
    poolLegendary:[],
    trainers:['acetrainerGen3','acetrainerFGen3','blackbelt','veteran'],
    eliteTrainer:'steven' },

  { id:'sky_pillar', fr:'Tour Céleste', en:'Sky Pillar', rep:3500, spawnRate:0.04, type:'special',
    zoneLevelBonus:74, investCost:45000,
    poolCommon:   ['golbat','altaria','swablu'],
    poolUncommon: ['claydol','dusclops','chimecho'],
    poolRare:     ['salamence','flygon','gardevoir'],
    poolVeryRare: ['dragonite'],
    poolLegendary:['rayquaza'],
    trainers:['acetrainerGen3','acetrainerFGen3','ruinmaniac','dragontamer'],
    eliteTrainer:'steven' },

  // ── Laboratoire Spatial (Quête Deoxys — débloqué via la mission) ─
  { id:'laboratoire_spatial', fr:'Laboratoire Spatial Devon', en:'Devon Space Research Lab', rep:4500, spawnRate:0.05, type:'building',
    zoneLevelBonus:84, investCost:60000,
    poolCommon:   ['porygon','beldum'],
    poolUncommon: ['metang','claydol','porygon2'],
    poolRare:     ['metagross'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['engineerGen3','ruinmaniac','acetrainerGen3','acetrainerFGen3','collectorGen3'],
    eliteTrainer:'steven',
    desc_fr:'Les chercheurs de Devon ont capté un signal extraterrestre. L\'accès est restreint — des données cosmiques y sont jalousement gardées.',
    desc_en:'Devon Corp researchers detected an alien signal. Access is restricted — cosmic data is guarded jealously here.' },


  // ══════════════════════════════════════════════════════════════
  // VILLES / ARÈNES
  // ══════════════════════════════════════════════════════════════

  { id:'rustboro_gym', fr:'Bourg-en-Roc', en:'Rustboro City', rep:2050, spawnRate:0.06, type:'city',
    zoneLevelBonus:56, investCost:2500,
    poolCommon:   ['geodude','nosepass','aron'],
    poolUncommon: ['graveler','lairon'],
    poolRare:     ['aggron'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['youngster','lass','hikerGen3'],
    eliteTrainer:'roxanne', gymLeader:'roxanne', gymType:'rock', xpBonus:1.5 },

  { id:'dewford_gym', fr:'Hectorville', en:'Dewford Town', rep:2200, spawnRate:0.06, type:'city',
    zoneLevelBonus:59, investCost:4500,
    poolCommon:   ['machop','makuhita','meditite'],
    poolUncommon: ['machoke','hariyama','medicham'],
    poolRare:     ['primeape','breloom'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['youngster','blackbelt','hikerGen3'],
    eliteTrainer:'brawly', gymLeader:'brawly', gymType:'fighting', xpBonus:1.5 },

  { id:'mauville_gym', fr:'Falbarr', en:'Mauville City', rep:2350, spawnRate:0.06, type:'city',
    zoneLevelBonus:61, investCost:7000,
    poolCommon:   ['electrike','voltorb','magnemite'],
    poolUncommon: ['manectric','electrode','magneton'],
    poolRare:     ['plusle','minun','jolteon'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['youngster','lass','triathlete'],
    eliteTrainer:'wattson', gymLeader:'wattson', gymType:'electric', xpBonus:1.8 },

  { id:'lavaridge_gym', fr:'Lavandia', en:'Lavaridge Town', rep:2600, spawnRate:0.06, type:'city',
    zoneLevelBonus:63, investCost:12000,
    poolCommon:   ['numel','slugma','vulpix'],
    poolUncommon: ['camerupt','magcargo','ninetales'],
    poolRare:     ['torkoal','arcanine'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['kindler','hikerGen3'],
    eliteTrainer:'flannery', gymLeader:'flannery', gymType:'fire', xpBonus:2.0 },

  { id:'petalburg_gym', fr:'Bourg-Épée', en:'Petalburg City', rep:2750, spawnRate:0.06, type:'city',
    zoneLevelBonus:64, investCost:14000,
    poolCommon:   ['zigzagoon','linoone','slakoth'],
    poolUncommon: ['vigoroth','slaking','spinda'],
    poolRare:     ['kangaskhan','chansey'],
    poolVeryRare: ['blissey'],
    poolLegendary:[],
    trainers:['youngster','lass','acetrainerGen3','acetrainerFGen3'],
    eliteTrainer:'normanHoenn', gymLeader:'normanHoenn', gymType:'normal', xpBonus:2.0 },

  { id:'fortree_gym', fr:'Brocélome', en:'Fortree City', rep:3000, spawnRate:0.06, type:'city',
    zoneLevelBonus:68, investCost:20000,
    poolCommon:   ['taillow','swablu','wingull'],
    poolUncommon: ['swellow','altaria','pelipper'],
    poolRare:     ['tropius','skarmory','xatu'],
    poolVeryRare: ['skarmory'],
    poolLegendary:[],
    trainers:['birdkeeperGen3','acetrainerGen3','acetrainerFGen3'],
    eliteTrainer:'winona', gymLeader:'winona', gymType:'flying', xpBonus:2.2 },

  { id:'mossdeep_gym', fr:'Moussîle', en:'Mossdeep City', rep:3200, spawnRate:0.06, type:'city',
    zoneLevelBonus:70, investCost:28000,
    poolCommon:   ['ralts','spoink','lunatone'],
    poolUncommon: ['kirlia','grumpig','solrock'],
    poolRare:     ['gardevoir','xatu','claydol'],
    poolVeryRare: ['metagross'],
    poolLegendary:[],
    trainers:['acetrainerGen3','acetrainerFGen3','ruinmaniac','liza'],
    eliteTrainer:'tate', gymLeader:'tate', gymType:'psychic', xpBonus:2.5 },

  { id:'sootopolis_gym', fr:'Blanche-Fontaine', en:'Sootopolis City', rep:3350, spawnRate:0.06, type:'city',
    zoneLevelBonus:72, investCost:35000,
    poolCommon:   ['wailmer','spheal','clamperl'],
    poolUncommon: ['wailord','sealeo','huntail','gorebyss'],
    poolRare:     ['walrein','kingdra','milotic'],
    poolVeryRare: ['gyarados'],
    poolLegendary:['kyogre'],
    trainers:['swimmerGen3','swimmerFGen3','acetrainerGen3'],
    eliteTrainer:'juan', gymLeader:'juan', gymType:'water', xpBonus:2.8 },

  { id:'ever_grande_hoenn', fr:'Grand-Large (Ligue Hoenn)', en:'Ever Grande City (Hoenn League)',
    rep:3700, spawnRate:0.05, type:'city',
    zoneLevelBonus:78, investCost:70000,
    poolCommon:   ['gardevoir','metagross','salamence'],
    poolUncommon: ['flygon','aggron','manectric'],
    poolRare:     ['absol','bagon'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['acetrainerGen3','acetrainerFGen3','veteran','veteranf','sidney','glacia'],
    eliteTrainer:'steven', gymLeader:'steven', gymType:'mixed', xpBonus:3.5 },


  // ══════════════════════════════════════════════════════════════
  // LIEUX SPÉCIAUX
  // ══════════════════════════════════════════════════════════════

  { id:'team_magma_hideout', fr:'QG Team Magma', en:'Team Magma Hideout', rep:2850, spawnRate:0.05, type:'special',
    zoneLevelBonus:66, investCost:20000,
    unlockItem:'magma_hideout_key',
    poolCommon:   ['numel','slugma','golbat'],
    poolUncommon: ['camerupt','mightyena','electrode'],
    poolRare:     ['camerupt','torkoal'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['magmagrunt','magmagruntf','tabitha','courtney'],
    eliteTrainer:'maxie' },

  { id:'team_aqua_hideout', fr:'QG Team Aqua', en:'Team Aqua Hideout', rep:2900, spawnRate:0.05, type:'special',
    zoneLevelBonus:67, investCost:22000,
    unlockItem:'aqua_hideout_key',
    poolCommon:   ['zubat','carvanha','poochyena'],
    poolUncommon: ['golbat','sharpedo','mightyena'],
    poolRare:     ['walrein','sharpedo'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['aquagrunt','aquagruntf','matt','shelly'],
    eliteTrainer:'archie' },

  { id:'cave_of_origin', fr:'Caverne Originelle', en:'Cave of Origin', rep:3300, spawnRate:0.04, type:'special',
    zoneLevelBonus:71, investCost:38000,
    unlockItem:'cave_origin_pass',
    poolCommon:   ['zubat','golbat','whismur'],
    poolUncommon: ['loudred','exploud','sableye'],
    poolRare:     ['dusclops','banette'],
    poolVeryRare: [],
    poolLegendary:['kyogre','groudon'],
    trainers:['acetrainerGen3','acetrainerFGen3'],
    eliteTrainer:'juan' },

  { id:'scorched_slab', fr:'Roche Ardente', en:'Scorched Slab', rep:2650, spawnRate:0.05, type:'special',
    zoneLevelBonus:64, investCost:15000,
    poolCommon:   ['slugma','vulpix','growlithe'],
    poolUncommon: ['magcargo','ninetales','arcanine'],
    poolRare:     ['torkoal','rapidash'],
    poolVeryRare: [],
    poolLegendary:['groudon'],
    trainers:['kindler','hikerGen3','magmagrunt'],
    eliteTrainer:'tabitha' },

  { id:'island_cave_ruins', fr:'Grottes des Régis', en:'Regi Chambers', rep:3400, spawnRate:0.03, type:'special',
    zoneLevelBonus:73, investCost:40000,
    unlockItem:'regi_seal',
    poolCommon:   ['geodude','zubat','aron'],
    poolUncommon: ['graveler','golbat','lairon'],
    poolRare:     ['aggron','claydol'],
    poolVeryRare: [],
    poolLegendary:['regirock','regice','registeel'],
    trainers:['ruinmaniac','hikerGen3'],
    eliteTrainer:'steven' },

];


// ════════════════════════════════════════════════════════════════
// ÉVÉNEMENTS SPÉCIAUX HOENN
// ════════════════════════════════════════════════════════════════

const SPECIAL_EVENTS_HOENN = [

  // ── Team Magma vs Aqua ───────────────────────────────────────
  { id:'magma_ambush', fr:'Embuscade Team Magma !', en:'Team Magma Ambush!', icon:'🌋',
    trainerKey:'magmagrunt', chance:0.04, minRep:2050,
    reward:{ money:[3000,8000], rep:12 },
    desc_fr:'Des sbires Magma bloquent la route. Ils cherchent des artefacts anciens.',
    desc_en:'Magma grunts block the road. They\'re hunting ancient artifacts.' },

  { id:'aqua_raid', fr:'Raid Team Aqua !', en:'Team Aqua Raid!', icon:'🌊',
    trainerKey:'aquagrunt', chance:0.04, minRep:2100,
    reward:{ money:[3000,8000], rep:12 },
    desc_fr:'Team Aqua surgit des profondeurs — ils veulent réveiller Kyogre.',
    desc_en:'Team Aqua rises from the depths — they want to awaken Kyogre.' },

  { id:'maxie_showdown', fr:'Confrontation avec Maxie !', en:'Maxie Showdown!', icon:'🔥',
    trainerKey:'maxie', chance:0.01, minRep:2800,
    reward:{ money:[15000,30000], rep:50, rareBoost:120000 },
    desc_fr:"Maxie réclame les continents. Il vous défie pour l'honneur de la Team Magma.",
    desc_en:"Maxie claims the continents. He challenges you for Team Magma's honor." },

  { id:'archie_showdown', fr:'Confrontation avec Archie !', en:'Archie Showdown!', icon:'🌀',
    trainerKey:'archie', chance:0.01, minRep:2900,
    reward:{ money:[15000,30000], rep:50, rareBoost:120000 },
    desc_fr:"Archie veut étendre les océans. Votre gang se dresse en travers de ses plans.",
    desc_en:'Archie wants to expand the oceans. Your gang stands in the way of his plans.' },

  // ── Rival ────────────────────────────────────────────────────
  { id:'rival_brendan', fr:'Défi de Brendan/Flora !', en:'Rival Challenge!', icon:'⚔️',
    trainerKey:'brendan', chance:0.04, minRep:2050,
    reward:{ money:[4000,9000], rep:15, xpBonus:40 },
    desc_fr:"Votre rival surgit à nouveau. Déterminé comme toujours à être le meilleur.",
    desc_en:'Your rival appears again. Determined as ever to be the best.' },

  // ── Légendaires ──────────────────────────────────────────────
  { id:'latias_sighting', fr:'Latias aperçue !', en:'Latias Spotted!', icon:'💫',
    trainerKey:null, chance:0.02, minRep:2900,
    reward:{ rareBoost:150000, shinyBoost:60000, xpBonus:80 },
    desc_fr:'Latias survole la zone à toute vitesse. Les Pokémon Dragon s\'éveillent !',
    desc_en:'Latias flies overhead at full speed. Dragon Pokémon stir!' },

  { id:'latios_pursuit', fr:'Latios en chasse !', en:'Latios Pursuit!', icon:'✨',
    trainerKey:null, chance:0.02, minRep:3000,
    reward:{ rareBoost:150000, shinyBoost:60000, xpBonus:80 },
    desc_fr:"Latios traverse la zone comme un éclair. Un éclat psychique reste dans l'air.",
    desc_en:'Latios crosses the area like lightning. A psychic shimmer lingers in the air.' },

  { id:'rayquaza_descent', fr:'Rayquaza descend des cieux !', en:'Rayquaza Descends!', icon:'🌩️',
    trainerKey:null, chance:0.008, minRep:3500,
    reward:{ rareBoost:300000, shinyBoost:150000, eggGift:['bagon'] },
    desc_fr:"Rayquaza traverse la stratosphère. Sa présence fait s'éveiller les Dracolosse !",
    desc_en:"Rayquaza tears through the stratosphere. Its presence awakens Dragonite!" },

  { id:'kyogre_surge', fr:'Déferlante de Kyogre !', en:'Kyogre Surge!', icon:'🌧️',
    trainerKey:null, chance:0.01, minRep:3200,
    reward:{ rareBoost:200000, shinyBoost:90000, eggGift:['mudkip'] },
    desc_fr:"La pluie inonde soudainement la zone — Kyogre est proche. Les Pokémon Eau affluent.",
    desc_en:'Rain suddenly floods the area — Kyogre is near. Water Pokémon surge!' },

  { id:'groudon_tremor', fr:'Tremblement de Groudon !', en:'Groudon Tremor!', icon:'🌋',
    trainerKey:null, chance:0.01, minRep:3200,
    reward:{ rareBoost:200000, shinyBoost:90000, eggGift:['torchic'] },
    desc_fr:"La terre tremble — Groudon s'éveille. Les Pokémon Feu et Sol envahissent la zone.",
    desc_en:'The earth trembles — Groudon stirs. Fire and Ground Pokémon flood the area.' },

  // ── Champions d'arène ────────────────────────────────────────
  { id:'roxanne_challenge', fr:'Défi de Sandra !', en:"Roxanne's Challenge!", icon:'⛏️',
    trainerKey:'roxanne', chance:0.04, minRep:2050,
    reward:{ money:[2000,4500], rep:12, xpBonus:25 },
    desc_fr:"Sandra, la Reine des Pierres de Bourg-en-Roc, bloque l'accès à la forêt !",
    desc_en:"Roxanne, Rustboro's Rock-type master, blocks the forest entrance!" },

  { id:'flannery_inferno', fr:'Enfer de Lavandia !', en:"Flannery's Inferno!", icon:'🔥',
    trainerKey:'flannery', chance:0.03, minRep:2600,
    reward:{ money:[4000,8000], rep:18, xpBonus:45 },
    desc_fr:"Adriane envahit la zone de flammes ! Ses Camérupt crachent la lave.",
    desc_en:"Flannery engulfs the area in flames! Her Camerupt spit lava." },

  { id:'winona_flyover', fr:'Survol de Brocélome !', en:"Winona's Flyover!", icon:'🦅',
    trainerKey:'winona', chance:0.03, minRep:3000,
    reward:{ money:[5000,10000], rep:22, xpBonus:60 },
    desc_fr:"Alizée et ses Pokémon Volants patrouillent dans les airs. Montrez ce dont vous êtes capable !",
    desc_en:"Winona and her Flying-types patrol the skies. Show her what you're made of!" },

  { id:'steven_visit', fr:"Visite de Pierre !", en:"Steven Visits!", icon:'💎',
    trainerKey:'steven', chance:0.015, minRep:3700,
    reward:{ money:[20000,40000], rep:70, rareBoost:180000 },
    desc_fr:"Pierre, Champion de Hoenn, descend de la Ligue pour tester votre gang.",
    desc_en:"Steven, Hoenn's Champion, descends from the League to test your gang." },

  // ── Elite Four Hoenn ─────────────────────────────────────────
  { id:'phoebe_haunts', fr:'Cauchemar de Spectra !', en:"Phoebe's Haunts!", icon:'👻',
    trainerKey:'phoebe', chance:0.02, minRep:3600,
    reward:{ money:[8000,16000], rep:30, shinyBoost:60000 },
    desc_fr:"Spectra du Conseil 4 de Hoenn envoie ses Pokémon Spectre dans l'obscurité.",
    desc_en:"Phoebe from the Elite Four sends her Ghost-types into the darkness." },

  { id:'drake_dragons', fr:'Dragons de Drake !', en:"Drake's Dragons!", icon:'🐉',
    trainerKey:'drake', chance:0.02, minRep:3650,
    reward:{ money:[10000,20000], rep:35, xpBonus:100 },
    desc_fr:'Drake du Conseil 4 rugit avec sa flotte de Dragons. Tenez bon !',
    desc_en:"Drake from the Elite Four roars with his Dragon fleet. Hold your ground!" },

  // ── Pokémon fossiles ─────────────────────────────────────────
  { id:'fossil_discovery', fr:'Découverte Fossile !', en:'Fossil Discovery!', icon:'🦕',
    trainerKey:null, chance:0.04, minRep:2200,
    zoneIds:['granite_cave','route111_desert','island_cave_ruins'],
    reward:{ eggGift:['lileep','anorith'], rareBoost:60000, money:[3000,8000] },
    desc_fr:"Un fossile rare est découvert dans les roches. Lileep ou Anorith en émerge !",
    desc_en:'A rare fossil is discovered in the rocks. Lileep or Anorith emerges!' },

  // ── Migrateurs Hoenn ─────────────────────────────────────────
  { id:'swablu_migration', fr:'Migration des Tylton !', en:'Swablu Migration!', icon:'☁️',
    trainerKey:null, chance:0.05, minRep:2800,
    reward:{ rareBoost:90000, shinyBoost:30000, eggGift:['swablu'] },
    desc_fr:'Des nuées de Tylton migrent au-dessus de la région. Les Altaria les escortent.',
    desc_en:'Flocks of Swablu migrate over the region. Altaria escort them.' },

  { id:'bagon_awakening', fr:'Éveil des Draby !', en:'Bagon Awakening!', icon:'🐉',
    trainerKey:null, chance:0.03, minRep:3100,
    zoneIds:['route120_121','victory_road_hoenn','sky_pillar'],
    reward:{ eggGift:['bagon'], rareBoost:120000, xpBonus:80 },
    desc_fr:'Des Draby émergent des canyons et sautent de leurs falaises en rêvant de voler !',
    desc_en:'Bagon emerge from canyons and leap from cliffs dreaming of flight!' },

  // ── Fabuleux ──────────────────────────────────────────────────
  // ── Météore (drop → utilisé pour relancer le combat Deoxys) ──────
  { id:'meteore_crash', fr:'Pluie de Météores', en:'Meteor Shower', icon:'☄️',
    trainerKey:null, chance:0.005, minRep:3500,
    zoneIds:['sky_pillar','mt_chimney','ever_grande_hoenn','laboratoire_spatial','cave_of_origin'],
    reward:{ itemGift:'meteore' },
    desc_fr:"Une météorite s'écrase aux alentours. Un fragment lumineux reste dans le cratère...",
    desc_en:'A meteorite crashes nearby. A glowing fragment remains in the crater...' },

];


// ════════════════════════════════════════════════════════════════
// MUSIQUES PAR ZONE
// ════════════════════════════════════════════════════════════════

const ZONE_MUSIC_MAP_HOENN = {
  hoenn_gang_hq:      'city',
  // Routes & nature
  route101:           'forest',
  petalburg_woods:    'forest',
  route102_103:       'forest',
  route104_106:       'sea',
  route110:           'forest',
  route111_desert:    'cave',
  mt_chimney:         'cave',
  jagged_pass:        'cave',
  route114_115:       'forest',
  route119:           'forest',
  route120_121:       'forest',
  safari_hoenn:       'safari',
  victory_road_hoenn: 'elite4',
  sky_pillar:         'elite4',
  // Villes & arènes
  rustboro_gym:       'city',
  dewford_gym:        'gym',
  mauville_gym:       'city',
  lavaridge_gym:      'gym',
  petalburg_gym:      'gym',
  fortree_gym:        'gym',
  mossdeep_gym:       'gym',
  sootopolis_gym:     'gym',
  ever_grande_hoenn:  'elite4',
  // Lieux spéciaux
  team_magma_hideout:   'silph',
  team_aqua_hideout:    'silph',
  cave_of_origin:       'cave',
  scorched_slab:        'cave',
  island_cave_ruins:    'cave',
  laboratoire_spatial:  'silph',
};


// ════════════════════════════════════════════════════════════════
// INJECTION — pool[] + rarePool[] depuis les tiers + enregistrement
// ════════════════════════════════════════════════════════════════

ZONES_HOENN.forEach(z => {
  z.region = 'hoenn';

  if ((z.poolCommon?.length || z.poolUncommon?.length) && !z.pool?.length) {
    z.pool = [...(z.poolCommon || []), ...(z.poolUncommon || [])];
  }

  const rare      = (z.poolRare      || []).map(en => ({ en, w: 3 }));
  const veryRare  = (z.poolVeryRare  || []).map(en => ({ en, w: 1 }));
  const legendary = (z.poolLegendary || []).map(en => ({ en, w: 1 }));
  if ((rare.length || veryRare.length || legendary.length) && !z.rarePool?.length) {
    z.rarePool = [...rare, ...veryRare, ...legendary];
  }
  // NB : ne pas pousser dans ZONES ici — c'est activateHoennRegion() qui le fait
});

// Index rapide Hoenn
const ZONE_HOENN_BY_ID = {};
ZONES_HOENN.forEach(z => ZONE_HOENN_BY_ID[z.id] = z);
