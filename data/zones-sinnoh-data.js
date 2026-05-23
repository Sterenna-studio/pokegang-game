// ════════════════════════════════════════════════════════════════
// PokéGang — Zones Sinnoh Data (Gen 4)
// Chargé avant app.js comme <script> ordinaire (globals partagés)
// Doit être chargé APRÈS zones-data.js + zones-johto-data.js + zones-hoenn-data.js dans index.html.
//
// Format de pool identique à zones-hoenn-data.js :
//   poolCommon[]    — toujours présents
//   poolUncommon[]  — zone level 1+
//   poolRare[]      — zone level 2+ (w:3 dans rarePool)
//   poolVeryRare[]  — zone level 5+ (w:1 dans rarePool)
//   poolLegendary[] — zone level 8+ (w:1 dans rarePool)
//
// Dresseurs Sinnoh disponibles (trainers-data.js) :
//   pokekid, aromalady, veteran, veteranf, skierGen4,
//   blackbeltGen4, acetrainerGen4, acetrainerFGen4,
//   hikerGen4, swimmerGen4, swimmerFGen4,
//   galacticgrunt, galacticgruntf, mars, jupiter, saturn, cyrus,
//   roark, gardenia, maylene, crasherwake, fantina, byron, candice, volkner,
//   aaron, bertha, flint, lucian, cynthia,
//   barry
// ════════════════════════════════════════════════════════════════

const ZONES_SINNOH = [

  // ══ QUARTIER GÉNÉRAL SINNOH ═════════════════════════════════════
  { id:'sinnoh_gang_hq', fr:'Repaire de Bonaugure', en:'Twinleaf Hideout', rep:0, spawnRate:0, type:'gang_park',
    zoneLevelBonus:0, pool:[], poolCommon:[], trainers:[], investCost:0,
    desc_fr:'Votre repaire discret à Bonaugure. Là où tout commence, avant la conquête de Sinnoh.',
    desc_en:'Your discreet hideout in Twinleaf Town. Where everything begins, before the conquest of Sinnoh.' },


  // ══════════════════════════════════════════════════════════════
  // ROUTES & NATURE
  // ══════════════════════════════════════════════════════════════

  // ── Début Sinnoh (Rep 4000–4350) ─────────────────────────────

  { id:'route201_202', fr:'Routes 201 & 202', en:'Routes 201 & 202', rep:4000, spawnRate:0.07, type:'route',
    zoneLevelBonus:80, investCost:0,
    poolCommon:   ['starly','bidoof','shinx'],
    poolUncommon: ['staravia','bibarel','luxio'],
    poolRare:     ['buneary','pachirisu'],
    poolVeryRare: ['lopunny'],
    poolLegendary:[],
    trainers:['youngster','lass','pokekid'],
    eliteTrainer:'barry' },

  { id:'ravaged_path', fr:'Grottes Ventosses', en:'Ravaged Path', rep:4050, spawnRate:0.05, type:'route',
    zoneLevelBonus:81, investCost:2000,
    poolCommon:   ['geodude','zubat','psyduck'],
    poolUncommon: ['graveler','golbat','golduck'],
    poolRare:     ['bronzor','meditite'],
    poolVeryRare: ['bronzong'],
    poolLegendary:[],
    trainers:['hikerGen4','blackbeltGen4'],
    eliteTrainer:'roark' },

  { id:'eterna_forest', fr:'Forêt Éternelle', en:'Eterna Forest', rep:4100, spawnRate:0.07, type:'route',
    zoneLevelBonus:82, investCost:3000,
    poolCommon:   ['budew','silcoon','cascoon','gastly'],
    poolUncommon: ['roselia','beautifly','dustox','haunter'],
    poolRare:     ['murkrow','misdreavus','drifloon'],
    poolVeryRare: ['gengar'],
    poolLegendary:[],
    trainers:['youngster','lass','aromalady'],
    eliteTrainer:'gardenia' },

  { id:'route205_207', fr:'Routes 205, 206 & 207', en:'Routes 205, 206 & 207', rep:4150, spawnRate:0.07, type:'route',
    zoneLevelBonus:83, investCost:4000,
    poolCommon:   ['shinx','buizel','shellos'],
    poolUncommon: ['luxio','floatzel','gastrodon'],
    poolRare:     ['ponyta','scyther'],
    poolVeryRare: ['rapidash'],
    poolLegendary:[],
    trainers:['youngster','lass','swimmerGen4','swimmerFGen4'],
    eliteTrainer:'gardenia' },

  { id:'mt_coronet_base', fr:'Mont Couronné (bas)', en:'Mt. Coronet (lower)', rep:4200, spawnRate:0.05, type:'route',
    zoneLevelBonus:84, investCost:6000,
    poolCommon:   ['cleffa','zubat','geodude'],
    poolUncommon: ['clefairy','golbat','graveler','machoke'],
    poolRare:     ['bronzor','chingling'],
    poolVeryRare: ['clefable'],
    poolLegendary:[],
    trainers:['hikerGen4','blackbeltGen4','galacticgrunt'],
    eliteTrainer:'roark' },

  // ── Sinnoh milieu (Rep 4350–4700) ────────────────────────────

  { id:'great_marsh', fr:'Grand Marais', en:'Great Marsh', rep:4350, spawnRate:0.08, type:'special',
    zoneLevelBonus:86, investCost:10000,
    poolCommon:   ['psyduck','wooper','barboach'],
    poolUncommon: ['quagsire','whiscash','bibarel','roselia'],
    poolRare:     ['tangela','kangaskhan','yanma'],
    poolVeryRare: ['tropius','carnivine'],
    poolLegendary:[],
    trainers:['aromalady','pokekid','swimmerGen4','swimmerFGen4'],
    eliteTrainer:'crasherwake' },

  { id:'route208_210', fr:'Routes 208, 209 & 210', en:'Routes 208, 209 & 210', rep:4400, spawnRate:0.07, type:'route',
    zoneLevelBonus:87, investCost:12000,
    poolCommon:   ['bibarel','starly','mime jr'],
    poolUncommon: ['staravia','mr mime','bonsly'],
    poolRare:     ['blissey','happiny'],
    poolVeryRare: ['togekiss'],
    poolLegendary:[],
    trainers:['youngster','lass','acetrainerGen4','acetrainerFGen4','veteran'],
    eliteTrainer:'fantina' },

  { id:'solaceon_ruins', fr:'Ruines de Bonheur', en:'Solaceon Ruins', rep:4450, spawnRate:0.04, type:'special',
    zoneLevelBonus:87, investCost:14000,
    poolCommon:   ['unown','geodude','zubat'],
    poolUncommon: ['bronzor','meditite','chingling'],
    poolRare:     ['bronzong','medicham'],
    poolVeryRare: ['spiritomb'],
    poolLegendary:[],
    trainers:['hikerGen4','veteran','veteranf'],
    eliteTrainer:'fantina' },

  { id:'route211_215', fr:'Routes 211, 213, 214 & 215', en:'Routes 211–215', rep:4500, spawnRate:0.07, type:'route',
    zoneLevelBonus:88, investCost:16000,
    poolCommon:   ['meditite','gastly','sneasel'],
    poolUncommon: ['medicham','haunter','weavile'],
    poolRare:     ['mime jr','gible'],
    poolVeryRare: ['garchomp'],
    poolLegendary:[],
    trainers:['acetrainerGen4','acetrainerFGen4','skierGen4'],
    eliteTrainer:'maylene' },

  { id:'mt_coronet_peak', fr:'Mont Couronné (sommet)', en:'Mt. Coronet (summit)', rep:4600, spawnRate:0.04, type:'route',
    zoneLevelBonus:89, investCost:22000,
    poolCommon:   ['golbat','graveler','snover'],
    poolUncommon: ['noctowl','misdreavus','clefairy'],
    poolRare:     ['bronzong','gabite'],
    poolVeryRare: ['absol'],
    poolLegendary:[],
    trainers:['hikerGen4','galacticgrunt','galacticgruntf','acetrainerGen4'],
    eliteTrainer:'cyrus' },

  // ── Sinnoh avancé (Rep 4700–5700) ────────────────────────────

  { id:'iron_island', fr:'Île Acier', en:'Iron Island', rep:4700, spawnRate:0.05, type:'route',
    zoneLevelBonus:90, investCost:26000,
    poolCommon:   ['geodude','onix','zubat'],
    poolUncommon: ['graveler','steelix','golbat'],
    poolRare:     ['riolu','lucario'],
    poolVeryRare: ['skarmory'],
    poolLegendary:[],
    trainers:['hikerGen4','blackbeltGen4'],
    eliteTrainer:'byron' },

  { id:'route216_217', fr:'Routes 216 & 217', en:'Routes 216 & 217', rep:4800, spawnRate:0.06, type:'route',
    zoneLevelBonus:91, investCost:28000,
    poolCommon:   ['snover','swinub','snorunt'],
    poolUncommon: ['abomasnow','piloswine','glalie'],
    poolRare:     ['froslass','mamoswine'],
    poolVeryRare: ['regice'],
    poolLegendary:[],
    trainers:['skierGen4','acetrainerGen4','acetrainerFGen4'],
    eliteTrainer:'candice' },

  { id:'lake_trio_shores', fr:'Rives des Trois Lacs', en:'Lake Trio Shores', rep:4900, spawnRate:0.06, type:'special',
    zoneLevelBonus:92, investCost:32000,
    poolCommon:   ['psyduck','golduck','marill'],
    poolUncommon: ['slowpoke','slowbro','azumarill'],
    poolRare:     ['chingling','chimecho'],
    poolVeryRare: ['dratini'],
    poolLegendary:['uxie','mesprit','azelf'],
    trainers:['galacticgrunt','galacticgruntf','mars','jupiter'],
    eliteTrainer:'cyrus' },

  { id:'route218_221', fr:'Routes 218, 219, 220 & 221', en:'Routes 218–221', rep:5000, spawnRate:0.07, type:'route',
    zoneLevelBonus:93, investCost:36000,
    poolCommon:   ['tentacool','wingull','shellos'],
    poolUncommon: ['tentacruel','pelipper','gastrodon'],
    poolRare:     ['corsola','remoraid'],
    poolVeryRare: ['lumineon'],
    poolLegendary:[],
    trainers:['swimmerGen4','swimmerFGen4','acetrainerGen4'],
    eliteTrainer:'volkner' },

  { id:'victory_road_sinnoh', fr:'Ligue Victoire Sinnoh', en:'Victory Road Sinnoh', rep:5600, spawnRate:0.04, type:'route',
    zoneLevelBonus:100, investCost:80000,
    poolCommon:   ['golbat','graveler','medicham'],
    poolUncommon: ['floatzel','steelix','haunter'],
    poolRare:     ['garchomp','togekiss','lucario'],
    poolVeryRare: ['dusknoir'],
    poolLegendary:[],
    trainers:['acetrainerGen4','acetrainerFGen4','veteran','veteranf','blackbeltGen4'],
    eliteTrainer:'cynthia' },

  { id:'spear_pillar', fr:'Pilier Axial', en:'Spear Pillar', rep:5500, spawnRate:0.03, type:'special',
    zoneLevelBonus:99, investCost:90000,
    poolCommon:   ['golbat','graveler','chingling'],
    poolUncommon: ['misdreavus','bronzor','clefairy'],
    poolRare:     ['bronzong','garchomp'],
    poolVeryRare: ['absol'],
    poolLegendary:['dialga','palkia','giratina'],
    trainers:['galacticgrunt','galacticgruntf','saturn','cyrus'],
    eliteTrainer:'cyrus' },

  { id:'turnback_cave', fr:'Grotte Sans Retour', en:'Turnback Cave', rep:5400, spawnRate:0.03, type:'special',
    zoneLevelBonus:98, investCost:70000,
    unlockItem:'turnback_seal',
    poolCommon:   ['duskull','golbat','misdreavus'],
    poolUncommon: ['dusclops','haunter','banette'],
    poolRare:     ['dusknoir','spiritomb'],
    poolVeryRare: [],
    poolLegendary:['giratina'],
    trainers:['veteran','veteranf'],
    eliteTrainer:'fantina' },


  // ══════════════════════════════════════════════════════════════
  // VILLES / ARÈNES
  // ══════════════════════════════════════════════════════════════

  { id:'oreburgh_gym', fr:'Orcebar', en:'Oreburgh City', rep:4050, spawnRate:0.06, type:'city',
    zoneLevelBonus:81, investCost:2500,
    poolCommon:   ['geodude','aron','nosepass'],
    poolUncommon: ['graveler','lairon','rhydon'],
    poolRare:     ['cranidos'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['youngster','hikerGen4'],
    eliteTrainer:'roark', gymLeader:'roark', gymType:'rock', xpBonus:1.5 },

  { id:'eterna_gym', fr:'Vestigion', en:'Eterna City', rep:4150, spawnRate:0.06, type:'city',
    zoneLevelBonus:83, investCost:5000,
    poolCommon:   ['budew','roselia','cherubi'],
    poolUncommon: ['roserade','cherrim','tangela'],
    poolRare:     ['carnivine','tropius'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['youngster','lass','aromalady'],
    eliteTrainer:'gardenia', gymLeader:'gardenia', gymType:'grass', xpBonus:1.5 },

  { id:'veilstone_gym', fr:'Joliberges', en:'Veilstone City', rep:4300, spawnRate:0.06, type:'city',
    zoneLevelBonus:85, investCost:8000,
    poolCommon:   ['meditite','machop','lucario'],
    poolUncommon: ['medicham','machoke','riolu'],
    poolRare:     ['machamp','hitmonchan','hitmonlee'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['youngster','blackbeltGen4','acetrainerGen4'],
    eliteTrainer:'maylene', gymLeader:'maylene', gymType:'fighting', xpBonus:1.8 },

  { id:'pastoria_gym', fr:'Marékéble', en:'Pastoria City', rep:4450, spawnRate:0.06, type:'city',
    zoneLevelBonus:87, investCost:12000,
    poolCommon:   ['wooper','psyduck','shellos'],
    poolUncommon: ['quagsire','golduck','gastrodon'],
    poolRare:     ['gyarados','vaporeon','azumarill'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['swimmerGen4','swimmerFGen4','acetrainerGen4'],
    eliteTrainer:'crasherwake', gymLeader:'crasherwake', gymType:'water', xpBonus:1.8 },

  { id:'hearthome_gym', fr:'Arestia', en:'Hearthome City', rep:4550, spawnRate:0.06, type:'city',
    zoneLevelBonus:88, investCost:16000,
    poolCommon:   ['gastly','misdreavus','duskull'],
    poolUncommon: ['haunter','drifblim','mismagius'],
    poolRare:     ['gengar','dusknoir'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['youngster','lass','acetrainerFGen4'],
    eliteTrainer:'fantina', gymLeader:'fantina', gymType:'ghost', xpBonus:2.0 },

  { id:'canalave_gym', fr:'Joliberges (Canalave)', en:'Canalave City', rep:4700, spawnRate:0.06, type:'city',
    zoneLevelBonus:90, investCost:22000,
    poolCommon:   ['bronzor','magnemite','onix'],
    poolUncommon: ['bronzong','magneton','steelix'],
    poolRare:     ['skarmory','forretress','magnezone'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['hikerGen4','veteran','acetrainerGen4'],
    eliteTrainer:'byron', gymLeader:'byron', gymType:'steel', xpBonus:2.2 },

  { id:'snowpoint_gym', fr:'Blizargent', en:'Snowpoint City', rep:4900, spawnRate:0.06, type:'city',
    zoneLevelBonus:92, investCost:32000,
    poolCommon:   ['snover','swinub','snorunt'],
    poolUncommon: ['abomasnow','piloswine','froslass'],
    poolRare:     ['mamoswine','weavile'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['skierGen4','acetrainerGen4','acetrainerFGen4'],
    eliteTrainer:'candice', gymLeader:'candice', gymType:'ice', xpBonus:2.5 },

  { id:'sunyshore_gym', fr:'Rivamar', en:'Sunyshore City', rep:5100, spawnRate:0.06, type:'city',
    zoneLevelBonus:94, investCost:44000,
    poolCommon:   ['shinx','electrike','magnemite'],
    poolUncommon: ['luxio','manectric','magneton'],
    poolRare:     ['luxray','jolteon','electrode'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['youngster','acetrainerGen4','veteran'],
    eliteTrainer:'volkner', gymLeader:'volkner', gymType:'electric', xpBonus:2.8 },

  { id:'pokemon_league_sinnoh', fr:'Ligue Pokémon Sinnoh', en:'Sinnoh Pokémon League',
    rep:5700, spawnRate:0.05, type:'city',
    zoneLevelBonus:102, investCost:120000,
    poolCommon:   ['garchomp','lucario','togekiss','spiritomb'],
    poolUncommon: ['roserade','gastrodon','milotic'],
    poolRare:     ['spiritomb','garchomp'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['acetrainerGen4','acetrainerFGen4','veteran','veteranf'],
    eliteTrainer:'cynthia', gymLeader:'cynthia', gymType:'mixed', xpBonus:4.0 },


  // ══════════════════════════════════════════════════════════════
  // LIEUX SPÉCIAUX
  // ══════════════════════════════════════════════════════════════

  { id:'galactic_hq', fr:'QG Team Galaxie', en:'Team Galactic HQ', rep:4850, spawnRate:0.05, type:'special',
    zoneLevelBonus:91, investCost:40000,
    unlockItem:'galactic_hq_key',
    poolCommon:   ['golbat','electrode','kadabra'],
    poolUncommon: ['haunter','bronzong','clefable'],
    poolRare:     ['toxicroak','weavile'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['galacticgrunt','galacticgruntf','mars','jupiter','saturn'],
    eliteTrainer:'cyrus' },

  { id:'stark_mountain', fr:'Mont Ardent', en:'Stark Mountain', rep:5200, spawnRate:0.04, type:'special',
    zoneLevelBonus:95, investCost:55000,
    poolCommon:   ['slugma','houndour','numel'],
    poolUncommon: ['magcargo','houndoom','camerupt'],
    poolRare:     ['rapidash','torkoal','arcanine'],
    poolVeryRare: ['magmortar'],
    poolLegendary:['heatran'],
    trainers:['veteran','veteranf','hikerGen4','acetrainerGen4'],
    eliteTrainer:'flint' },

  { id:'sendoff_spring', fr:'Source Abandon', en:'Sendoff Spring', rep:5300, spawnRate:0.04, type:'special',
    zoneLevelBonus:97, investCost:65000,
    unlockItem:'turnback_seal',
    poolCommon:   ['duskull','golbat','misdreavus'],
    poolUncommon: ['dusclops','haunter','spiritomb'],
    poolRare:     ['dusknoir','mismagius'],
    poolVeryRare: [],
    poolLegendary:['giratina'],
    trainers:['veteran','veteranf'],
    eliteTrainer:'fantina' },

  { id:'hall_of_origin', fr:'Salle de l\'Origine', en:'Hall of Origin', rep:5800, spawnRate:0.02, type:'special',
    zoneLevelBonus:105, investCost:150000,
    unlockItem:'azure_flute',
    poolCommon:   ['clefairy','togekiss','porygon2'],
    poolUncommon: ['togekiss','clefable','porygon-z'],
    poolRare:     ['latias','latios'],
    poolVeryRare: [],
    poolLegendary:['arceus'],
    trainers:['veteran','veteranf'],
    eliteTrainer:'cynthia' },

];


// ════════════════════════════════════════════════════════════════
// ÉVÉNEMENTS SPÉCIAUX SINNOH
// ════════════════════════════════════════════════════════════════

const SPECIAL_EVENTS_SINNOH = [

  // ── Team Galaxie ─────────────────────────────────────────────
  { id:'galactic_patrol', fr:'Patrouille Team Galaxie !', en:'Team Galactic Patrol!', icon:'⭐',
    trainerKey:'galacticgrunt', chance:0.05, minRep:4100,
    reward:{ money:[4000,9000], rep:14 },
    desc_fr:'Des sbires Galaxie patrouillent la zone. Ils recherchent des fragments cosmiques.',
    desc_en:'Galactic grunts patrol the area. They\'re searching for cosmic fragments.' },

  { id:'mars_ambush', fr:'Embuscade de Mars !', en:'Mars Ambush!', icon:'🔴',
    trainerKey:'mars', chance:0.02, minRep:4350,
    reward:{ money:[8000,15000], rep:28 },
    desc_fr:"Mars de la Team Galaxie tend une embuscade. Son Purugly bondit en premier !",
    desc_en:'Mars from Team Galactic sets an ambush. Her Purugly pounces first!' },

  { id:'jupiter_strike', fr:'Frappe de Jupiter !', en:'Jupiter Strike!', icon:'🟣',
    trainerKey:'jupiter', chance:0.02, minRep:4600,
    reward:{ money:[10000,18000], rep:30 },
    desc_fr:"Jupiter surgit dans le brouillard. Son Skuntank empoisonne l'atmosphère.",
    desc_en:'Jupiter emerges from the fog. Her Skuntank poisons the atmosphere.' },

  { id:'saturn_ambush', fr:'Interférence de Saturne !', en:"Saturn's Interference!", icon:'🟡',
    trainerKey:'saturn', chance:0.02, minRep:4700,
    reward:{ money:[12000,22000], rep:32 },
    desc_fr:'Saturne bloque la route avec sa troupe. Toxicroak en tête de file.',
    desc_en:'Saturn blocks the route with his crew. Toxicroak leads the charge.' },

  { id:'cyrus_confrontation', fr:'Confrontation avec Cyrus !', en:'Cyrus Confrontation!', icon:'🌌',
    trainerKey:'cyrus', chance:0.008, minRep:4850,
    reward:{ money:[25000,50000], rep:80, rareBoost:200000 },
    desc_fr:"Cyrus veut recréer l'univers. Il vous défie pour prouver la futilité de l'humanité.",
    desc_en:'Cyrus wants to recreate the universe. He challenges you to prove the futility of humanity.' },

  // ── Rival ────────────────────────────────────────────────────
  { id:'rival_barry', fr:'Défi de Luca !', en:'Barry Challenge!', icon:'⚡',
    trainerKey:'barry', chance:0.05, minRep:4000,
    reward:{ money:[5000,10000], rep:18, xpBonus:50 },
    desc_fr:"Luca surgit à toute vitesse — il veut encore se mesurer à vous !",
    desc_en:'Barry rushes in at full speed — he wants to face you again!' },

  // ── Légendaires ──────────────────────────────────────────────
  { id:'dialga_resonance', fr:'Résonance de Dialga !', en:'Dialga Resonance!', icon:'💎',
    trainerKey:null, chance:0.01, minRep:5200,
    reward:{ rareBoost:250000, shinyBoost:100000, xpBonus:120 },
    desc_fr:"Le temps vacille — Dialga est proche. Les Pokémon Acier et Dragon s'éveillent !",
    desc_en:'Time wavers — Dialga is near. Steel and Dragon Pokémon stir!' },

  { id:'palkia_rift', fr:'Fissure de Palkia !', en:'Palkia Rift!', icon:'🌀',
    trainerKey:null, chance:0.01, minRep:5200,
    reward:{ rareBoost:250000, shinyBoost:100000, xpBonus:120 },
    desc_fr:"L'espace se distord — Palkia ouvre une fissure. Les Pokémon Dragon se regroupent !",
    desc_en:'Space distorts — Palkia opens a rift. Dragon Pokémon gather!' },

  { id:'giratina_emergence', fr:'Émergence de Giratina !', en:'Giratina Emergence!', icon:'👁️',
    trainerKey:null, chance:0.008, minRep:5400,
    reward:{ rareBoost:300000, shinyBoost:150000, eggGift:['duskull'] },
    desc_fr:"Le monde distordu s'ouvre. Giratina traverse le voile entre les dimensions !",
    desc_en:'The Distortion World cracks open. Giratina crosses the veil between dimensions!' },

  { id:'uxie_vision', fr:'Vision d\'Uxie !', en:'Uxie Vision!', icon:'💛',
    trainerKey:null, chance:0.02, minRep:4600,
    reward:{ rareBoost:120000, shinyBoost:50000, xpBonus:80 },
    desc_fr:"Uxie transmet une vision. Les Pokémon Psy de la zone s'éveillent en transe.",
    desc_en:"Uxie transmits a vision. The area's Psychic Pokémon awaken in a trance." },

  { id:'mesprit_presence', fr:'Présence de Mesprit !', en:'Mesprit Presence!', icon:'🩷',
    trainerKey:null, chance:0.02, minRep:4700,
    reward:{ rareBoost:120000, shinyBoost:50000, eggGift:['chingling'] },
    desc_fr:"Mesprit répand ses émotions dans la zone. Une vague de bonheur enveloppe les Pokémon.",
    desc_en:'Mesprit spreads its emotions through the area. A wave of happiness washes over Pokémon.' },

  { id:'azelf_power', fr:'Puissance d\'Azelf !', en:'Azelf Power!', icon:'💙',
    trainerKey:null, chance:0.02, minRep:4750,
    reward:{ rareBoost:120000, shinyBoost:50000, xpBonus:90 },
    desc_fr:"Azelf libère une bouffée de volonté dans la région. Les Pokémon combattent avec férocité !",
    desc_en:'Azelf releases a surge of willpower across the region. Pokémon fight with fierce resolve!' },

  { id:'heatran_eruption', fr:'Éruption de Heatran !', en:'Heatran Eruption!', icon:'🌋',
    trainerKey:null, chance:0.012, minRep:5200,
    reward:{ rareBoost:200000, shinyBoost:80000, eggGift:['magby'] },
    desc_fr:"Heatran s'éveille dans les profondeurs du Mont Ardent. La lave envahit la zone !",
    desc_en:'Heatran stirs in the depths of Stark Mountain. Lava floods the area!' },

  { id:'arceus_echo', fr:'Écho d\'Arceus !', en:'Arceus Echo!', icon:'✨',
    trainerKey:null, chance:0.003, minRep:5800,
    reward:{ rareBoost:500000, shinyBoost:250000, eggGift:['togepi'] },
    desc_fr:"Un souffle divin traverse Sinnoh. Arceus lui-même fait résonner sa présence.",
    desc_en:'A divine breath sweeps through Sinnoh. Arceus itself resonates its presence.' },

  // ── Champions d'arène ────────────────────────────────────────
  { id:'roark_drilling', fr:'Forage de Noé !', en:"Roark's Drilling!", icon:'⛏️',
    trainerKey:'roark', chance:0.04, minRep:4050,
    reward:{ money:[2500,5000], rep:14, xpBonus:30 },
    desc_fr:"Noé, l'expert Roche d'Orcebar, fore la zone à la recherche de fossiles rares.",
    desc_en:"Roark, Oreburgh's Rock expert, drills through the area searching for rare fossils." },

  { id:'gardenia_bloom', fr:'Floraison de Flora !', en:"Gardenia's Bloom!", icon:'🌸',
    trainerKey:'gardenia', chance:0.04, minRep:4150,
    reward:{ money:[2500,5000], rep:14, xpBonus:30 },
    desc_fr:"Flora de Vestigion fait fleurir la zone. Ses Pokémon Plante inondent le terrain.",
    desc_en:"Gardenia from Eterna makes the area bloom. Her Grass Pokémon flood the terrain." },

  { id:'fantina_haunting', fr:'Apparition de Fantina !', en:"Fantina's Haunting!", icon:'👻',
    trainerKey:'fantina', chance:0.03, minRep:4450,
    reward:{ money:[5000,10000], rep:20, shinyBoost:40000 },
    desc_fr:"Fantina danse avec ses Pokémon Spectre. Leur présence glace les environs.",
    desc_en:"Fantina dances with her Ghost Pokémon. Their presence chills the surroundings." },

  { id:'volkner_surge', fr:'Décharge de Tanguy !', en:"Volkner's Surge!", icon:'⚡',
    trainerKey:'volkner', chance:0.025, minRep:5000,
    reward:{ money:[8000,16000], rep:28, xpBonus:80 },
    desc_fr:"Tanguy, l'expert Électrik de Rivamar, libère sa puissance dans la zone.",
    desc_en:"Volkner, Sunyshore's Electric expert, unleashes his power across the area." },

  // ── Elite Four Sinnoh ────────────────────────────────────────
  { id:'aaron_swarm', fr:'Nuée d\'Aaron !', en:"Aaron's Swarm!", icon:'🐛',
    trainerKey:'aaron', chance:0.025, minRep:5500,
    reward:{ money:[8000,16000], rep:28, xpBonus:80 },
    desc_fr:"Aaron du Conseil 4 libère un essaim de Pokémon Insecte. La zone en est envahie.",
    desc_en:"Aaron from the Elite Four releases a swarm of Bug Pokémon. The area is overrun." },

  { id:'bertha_quake', fr:'Séisme de Bertha !', en:"Bertha's Quake!", icon:'🪨',
    trainerKey:'bertha', chance:0.02, minRep:5550,
    reward:{ money:[10000,20000], rep:32, xpBonus:90 },
    desc_fr:"Bertha du Conseil 4 fait trembler la terre. Les Pokémon Sol sortent des profondeurs.",
    desc_en:"Bertha from the Elite Four shakes the ground. Ground Pokémon emerge from the depths." },

  { id:'flint_inferno', fr:'Brasier de Carlos !', en:"Flint's Inferno!", icon:'🔥',
    trainerKey:'flint', chance:0.02, minRep:5600,
    reward:{ money:[12000,22000], rep:35, xpBonus:100 },
    desc_fr:"Carlos du Conseil 4 embrase la zone. Ses Pokémon Feu carbonisent tout.",
    desc_en:"Flint from the Elite Four ignites the area. His Fire Pokémon scorch everything." },

  { id:'lucian_mind', fr:'Force Mentale de Lucio !', en:"Lucian's Mind!", icon:'📚',
    trainerKey:'lucian', chance:0.02, minRep:5600,
    reward:{ money:[12000,22000], rep:35, xpBonus:100 },
    desc_fr:"Lucio du Conseil 4 envahit les esprits. Ses Pokémon Psy lisent vos stratégies.",
    desc_en:"Lucian from the Elite Four invades minds. His Psychic Pokémon read your strategies." },

  { id:'cynthia_visit', fr:"Visite de Cynthia !", en:"Cynthia Visits!", icon:'🏆',
    trainerKey:'cynthia', chance:0.01, minRep:5700,
    reward:{ money:[30000,60000], rep:100, rareBoost:250000 },
    desc_fr:"Cynthia, Championne de Sinnoh, descend de la Ligue pour défier votre gang.",
    desc_en:"Cynthia, Sinnoh's Champion, descends from the League to challenge your gang." },

  // ── Fossiles & Migrateurs ─────────────────────────────────────
  { id:'fossil_cranidos', fr:'Fossile Cranidos !', en:'Cranidos Fossil!', icon:'🦕',
    trainerKey:null, chance:0.04, minRep:4050,
    zoneIds:['ravaged_path','oreburgh_gym','mt_coronet_base'],
    reward:{ eggGift:['cranidos'], rareBoost:70000, money:[4000,10000] },
    desc_fr:"Un fossile de Crânimax est extrait des mines d'Orcebar !",
    desc_en:'A Cranidos fossil is extracted from the Oreburgh mines!' },

  { id:'fossil_shieldon', fr:'Fossile Ptitard !', en:'Shieldon Fossil!', icon:'🛡️',
    trainerKey:null, chance:0.04, minRep:4050,
    zoneIds:['ravaged_path','oreburgh_gym','mt_coronet_base'],
    reward:{ eggGift:['shieldon'], rareBoost:70000, money:[4000,10000] },
    desc_fr:"Un fossile de Dinoclier émerge du sous-sol d'Orcebar !",
    desc_en:'A Shieldon fossil emerges from beneath Oreburgh!' },

  { id:'starly_migration', fr:'Migration des Étourmi !', en:'Starly Migration!', icon:'🐦',
    trainerKey:null, chance:0.06, minRep:4000,
    reward:{ rareBoost:60000, shinyBoost:20000, eggGift:['starly'] },
    desc_fr:'Des nuées d\'Étourmi migrent en formation serrée. Les Étourvol les encadrent.',
    desc_en:'Flocks of Starly migrate in tight formation. Staravia escort them.' },

  { id:'gible_emergence', fr:'Apparition des Griknot !', en:'Gible Emergence!', icon:'🐉',
    trainerKey:null, chance:0.03, minRep:4500,
    zoneIds:['route211_215','mt_coronet_base','mt_coronet_peak'],
    reward:{ eggGift:['gible'], rareBoost:150000, xpBonus:100 },
    desc_fr:'Des Griknot sortent des cavernes et mordent tout ce qui passe. Gardez vos distances !',
    desc_en:'Gible emerge from caverns and bite everything in sight. Keep your distance!' },

  // ── Légendaires/Fabuleux extra-rares — récupération via event ────
  { id:'cresselia_dream', fr:'Songes de Cresselia', en:"Cresselia's Dream", icon:'🌙',
    trainerKey:null, chance:0.006, minRep:4800,
    zoneIds:['lake_trio_shores','sendoff_spring'],
    reward:{ eggGift:['cresselia'], shinyBoost:120000, rareBoost:200000 },
    desc_fr:"Un éclat lunaire illumine la rive. Cresselia laisse une plume d'œuf...",
    desc_en:'Lunar light illuminates the shore. Cresselia leaves an egg feather...' },

  { id:'darkrai_nightmare', fr:'Cauchemar de Darkrai', en:"Darkrai's Nightmare", icon:'🌑',
    trainerKey:null, chance:0.005, minRep:5000,
    zoneIds:['sendoff_spring','turnback_cave'],
    reward:{ eggGift:['darkrai'], shinyBoost:150000, xpBonus:120 },
    desc_fr:'Les ombres ondulent. Un œuf noir apparaît dans la pénombre...',
    desc_en:'Shadows ripple. A dark egg materialises in the gloom...' },

  { id:'shaymin_grace', fr:'Grâce de Shaymin', en:"Shaymin's Grace", icon:'🌸',
    trainerKey:null, chance:0.007, minRep:4400,
    zoneIds:['eterna_forest','route205_207','route208_210'],
    reward:{ eggGift:['shaymin'], rareBoost:120000, shinyBoost:60000 },
    desc_fr:'Les fleurs autour de vous se mettent à briller. Un œuf vert pâle est là.',
    desc_en:'Flowers around you start to glow. A pale-green egg appears.' },

  { id:'manaphy_drift', fr:'Dérive de Manaphy', en:"Manaphy's Drift", icon:'💧',
    trainerKey:null, chance:0.006, minRep:5000,
    zoneIds:['route218_221','lake_trio_shores'],
    reward:{ eggGift:['manaphy','phione'], rareBoost:180000 },
    desc_fr:"Un œuf bleu transparent flotte à la surface — Manaphy ou Phione, qui sait ?",
    desc_en:'A translucent blue egg floats at the surface — Manaphy or Phione, who knows?' },

  { id:'regigigas_summon', fr:'Réveil de Regigigas', en:'Regigigas Awakens', icon:'⛰️',
    trainerKey:null, chance:0.004, minRep:5500,
    zoneIds:['snowpoint_gym'],
    reward:{ eggGift:['regigigas'], rareBoost:250000 },
    desc_fr:"Les Régis (Roc, Glace, Acier) résonnent à l'unisson — leur maître stirre.",
    desc_en:'The Regis (Rock, Ice, Steel) resonate in unison — their master stirs.' },

  { id:'jirachi_wish', fr:'Vœu de Jirachi', en:"Jirachi's Wish", icon:'🌟',
    trainerKey:null, chance:0.003, minRep:4200,
    reward:{ eggGift:['jirachi'], shinyBoost:300000, rareBoost:300000 },
    desc_fr:'Une étoile filante traverse le ciel — votre vœu est-il assez fort ?',
    desc_en:'A shooting star crosses the sky — is your wish strong enough?' },

];


// ════════════════════════════════════════════════════════════════
// MUSIQUES PAR ZONE
// ════════════════════════════════════════════════════════════════

const ZONE_MUSIC_MAP_SINNOH = {
  sinnoh_gang_hq:       'city',
  // Routes & nature
  route201_202:         'forest',
  ravaged_path:         'cave',
  eterna_forest:        'forest',
  route205_207:         'forest',
  mt_coronet_base:      'cave',
  great_marsh:          'safari',
  route208_210:         'forest',
  solaceon_ruins:       'cave',
  route211_215:         'forest',
  mt_coronet_peak:      'cave',
  iron_island:          'cave',
  route216_217:         'forest',
  lake_trio_shores:     'sea',
  route218_221:         'sea',
  victory_road_sinnoh:  'elite4',
  spear_pillar:         'elite4',
  turnback_cave:        'cave',
  // Villes & arènes
  oreburgh_gym:         'city',
  eterna_gym:           'gym',
  veilstone_gym:        'city',
  pastoria_gym:         'gym',
  hearthome_gym:        'gym',
  canalave_gym:         'gym',
  snowpoint_gym:        'gym',
  sunyshore_gym:        'city',
  pokemon_league_sinnoh:'elite4',
  // Lieux spéciaux
  galactic_hq:          'silph',
  stark_mountain:       'cave',
  sendoff_spring:       'cave',
  hall_of_origin:       'elite4',
};


// ════════════════════════════════════════════════════════════════
// INJECTION — pool[] + rarePool[] depuis les tiers + enregistrement
// ════════════════════════════════════════════════════════════════

ZONES_SINNOH.forEach(z => {
  z.region = 'sinnoh';

  if ((z.poolCommon?.length || z.poolUncommon?.length) && !z.pool?.length) {
    z.pool = [...(z.poolCommon || []), ...(z.poolUncommon || [])];
  }

  const rare      = (z.poolRare      || []).map(en => ({ en, w: 3 }));
  const veryRare  = (z.poolVeryRare  || []).map(en => ({ en, w: 1 }));
  const legendary = (z.poolLegendary || []).map(en => ({ en, w: 1 }));
  if ((rare.length || veryRare.length || legendary.length) && !z.rarePool?.length) {
    z.rarePool = [...rare, ...veryRare, ...legendary];
  }
  // NB : ne pas pousser dans ZONES ici — c'est activateSinnohRegion() qui le fait
});

// Index rapide Sinnoh
const ZONE_SINNOH_BY_ID = {};
ZONES_SINNOH.forEach(z => ZONE_SINNOH_BY_ID[z.id] = z);
