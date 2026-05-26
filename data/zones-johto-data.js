// ════════════════════════════════════════════════════════════════
// PokéGang — Zones Johto Data (v2 — système de tiers)
// Chargé avant app.js comme <script> ordinaire (globals partagés)
// Doit être chargé APRÈS zones-data.js dans index.html.
//
// Nouveau format de pool (portage vers regions-config.js / getActivePoolTiers) :
//   poolCommon[]    : espèces communes — toujours présentes
//   poolUncommon[]  : disponibles dès zone level 1 (palier 'uncommon')
//   poolRare[]      : disponibles dès zone level 3 (palier 'rare')     → w:3 dans rarePool[]
//   poolVeryRare[]  : disponibles dès zone level 5 (palier 'very_rare')→ w:1 dans rarePool[]
//   poolLegendary[] : disponibles dès zone level 9 (palier 'legendary')→ w:1 dans rarePool[]
//
// L'injection en bas du fichier auto-construit pool[] et rarePool[] depuis
// ces tiers — aucune duplication nécessaire.
//
// Dresseurs : utiliser les clés Gen 2 dédiées (trainers-data.js) quand possible :
//   boarder, kimonogirl, firebreather, guitarist, sage, twins, schoolkid,
//   skier, medium, officer, pokefan, pokefanf,
//   acetrainerGen2, acetrainerFGen2, beautyGen2, bikerGen2, hikerGen2,
//   jugglerGen2, psychicGen2, pokemaniacGen2, birdkeeperGen2,
//   bugcatcherGen2, camperGen2, gentlemanGen2, eusine, janine, kris, ethan
// ════════════════════════════════════════════════════════════════

const ZONES_JOHTO = [

  // ══ QUARTIER GÉNÉRAL JOHTO (base gang — toujours ouverte) ══
  { id:'johto_gang_hq', fr:'Planque de Bourg Geon', en:'New Bark Hideout', rep:0, spawnRate:0, type:'gang_park',
    zoneLevelBonus:0,
    pool:[], poolCommon:[], trainers:[], investCost:0,
    desc_fr:'Votre planque à Bourg Geon. Point de départ de la conquête de Johto.',
    desc_en:'Your hideout in New Bark Town. Starting point of the Johto conquest.' },


  // ══════════════════════════════════════════════════════════════
  // ROUTES & NATURE
  // ══════════════════════════════════════════════════════════════

  // ── Début Johto (Rep 0–180) ───────────────────────────────────

  { id:'route29', fr:'Route 29', en:'Route 29', rep:0, spawnRate:0.07, type:'route',
    zoneLevelBonus:20, investCost:0,
    poolCommon:   ['sentret','hoothoot','rattata','pidgey'],
    poolUncommon: ['hoppip','caterpie','weedle'],
    poolRare:     ['mareep','ledyba'],
    poolVeryRare: ['pikachu'],
    poolLegendary:[],
    trainers:['youngster','lass','twins','schoolkid'],
    eliteTrainer:'falkner' },

  { id:'route30_31', fr:'Routes 30 & 31', en:'Routes 30 & 31', rep:20, spawnRate:0.07, type:'route',
    zoneLevelBonus:21, investCost:1500,
    poolCommon:   ['ledyba','spinarak','hoothoot','bellsprout'],
    poolUncommon: ['caterpie','metapod','weedle','kakuna'],
    poolRare:     ['noctowl','hoppip'],
    poolVeryRare: ['yanma'],
    poolLegendary:[],
    trainers:['youngster','lass','bugcatcherGen2','schoolkid'],
    eliteTrainer:'bugsy' },

  { id:'dark_cave', fr:'Antre Noir', en:'Dark Cave', rep:80, spawnRate:0.05, type:'route',
    zoneLevelBonus:22, investCost:3000,
    poolCommon:   ['zubat','geodude','wobbuffet'],
    poolUncommon: ['graveler','golbat','dunsparce'],
    poolRare:     ['teddiursa','onix'],
    poolVeryRare: ['ursaring'],
    poolLegendary:[],
    trainers:['hikerGen2','camperGen2'],
    eliteTrainer:'hikerGen2' },

  { id:'ilex_forest', fr:'Bois aux Chênes', en:'Ilex Forest', rep:180, spawnRate:0.08, type:'route',
    zoneLevelBonus:25, investCost:4000,
    poolCommon:   ['caterpie','metapod','oddish','hoothoot'],
    poolUncommon: ['psyduck','aipom','paras'],
    poolRare:     ['heracross','yanma'],
    poolVeryRare: ['scyther'],
    poolLegendary:['celebi'],
    ghostZone: false,
    trainers:['bugcatcherGen2','schoolkid','youngster','lass'],
    eliteTrainer:'bugsy' },

  // ── Johto milieu (Rep 280–650) ────────────────────────────────

  { id:'route36_37', fr:'Routes 36 & 37', en:'Routes 36 & 37', rep:280, spawnRate:0.07, type:'route',
    zoneLevelBonus:28, investCost:5000,
    poolCommon:   ['girafarig','stantler','snubbull'],
    poolUncommon: ['growlithe','vulpix','hoppip','skiploom'],
    poolRare:     ['tauros','miltank'],
    poolVeryRare: ['togetic'],
    poolLegendary:[],
    trainers:['youngster','lass','camperGen2','twins','guitarist'],
    eliteTrainer:'acetrainerGen2' },

  { id:'mt_mortar', fr:'Mont Mortier', en:'Mt. Mortar', rep:380, spawnRate:0.04, type:'route',
    zoneLevelBonus:31, investCost:8000,
    poolCommon:   ['machop','geodude','zubat'],
    poolUncommon: ['machoke','graveler','golbat','marill'],
    poolRare:     ['rattata','raticate'],
    poolVeryRare: ['hitmonlee','hitmonchan','hitmontop'],
    poolLegendary:[],
    trainers:['hikerGen2','blackbelt'],
    eliteTrainer:'blackbelt' },

  { id:'route42_43', fr:'Routes 42 & 43', en:'Routes 42 & 43', rep:480, spawnRate:0.06, type:'route',
    zoneLevelBonus:34, investCost:9000,
    poolCommon:   ['marill','mareep','drowzee'],
    poolUncommon: ['flaaffy','aipom','tauros'],
    poolRare:     ['miltank','hypno'],
    poolVeryRare: ['ampharos'],
    poolLegendary:[],
    trainers:['camperGen2','picnicker','swimmer','fisherman','bikerGen2','birdkeeperGen2'],
    eliteTrainer:'acetrainerGen2' },

  { id:'ice_path', fr:'Route de Glace', en:'Ice Path', rep:650, spawnRate:0.04, type:'route',
    zoneLevelBonus:39, investCost:15000,
    poolCommon:   ['swinub','zubat','golbat'],
    poolUncommon: ['jynx','delibird','wobbuffet'],
    poolRare:     ['sneasel','piloswine'],
    poolVeryRare: ['dewgong'],
    poolLegendary:[],
    trainers:['boarder','skier','hikerGen2'],
    eliteTrainer:'pryce' },

  // ── Johto avancé (Rep 700–1100) ───────────────────────────────

  { id:'route44_45_46', fr:'Routes 44, 45 & 46', en:'Routes 44, 45 & 46', rep:700, spawnRate:0.05, type:'route',
    zoneLevelBonus:40, investCost:20000,
    poolCommon:   ['weepinbell','tangela','pinsir'],
    poolUncommon: ['victreebel','scyther','heracross'],
    poolRare:     ['dratini'],
    poolVeryRare: ['dragonair'],
    poolLegendary:[],
    trainers:['camperGen2','acetrainerGen2','twins'],
    eliteTrainer:'clair' },

  { id:'mt_silver_johto', fr:'Mont Argenté (versant Johto)', en:'Mt. Silver (Johto Side)',
    rep:1100, spawnRate:0.03, type:'route',
    zoneLevelBonus:52, investCost:0,
    poolCommon:   ['larvitar','pupitar'],
    poolUncommon: ['snorlax','lapras','dragonite'],
    poolRare:     ['pikachu','chansey'],
    poolVeryRare: ['tyranitar'],
    poolLegendary:[],
    trainers:['acetrainerGen2','pokefan','pokefanf'],
    eliteTrainer:'red' },


  // ══════════════════════════════════════════════════════════════
  // VILLES / ARÈNES
  // ══════════════════════════════════════════════════════════════

  { id:'violet_gym', fr:'Ecorfeuil', en:'Violet City', rep:50, spawnRate:0.06, type:'city',
    zoneLevelBonus:22, investCost:1500,
    poolCommon:   ['pidgey','spearow','hoothoot'],
    poolUncommon: ['noctowl','doduo','farfetchd'],
    poolRare:     ['togetic'],
    poolVeryRare: ['aerodactyl'],
    poolLegendary:[],
    trainers:['youngster','lass','schoolkid','camperGen2'],
    eliteTrainer:'falkner', gymLeader:'falkner', gymType:'flying', xpBonus:1.5 },

  { id:'azalea_gym', fr:'Azalée', en:'Azalea Town', rep:150, spawnRate:0.06, type:'city',
    zoneLevelBonus:24, investCost:3000,
    poolCommon:   ['caterpie','weedle','spinarak'],
    poolUncommon: ['metapod','kakuna','ledyba'],
    poolRare:     ['scyther','pinsir','heracross'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['bugcatcherGen2','youngster','lass'],
    eliteTrainer:'bugsy', gymLeader:'bugsy', gymType:'bug', xpBonus:1.5 },

  { id:'goldenrod_gym', fr:'Doublonville', en:'Goldenrod City', rep:250, spawnRate:0.06, type:'city',
    zoneLevelBonus:27, investCost:5000,
    poolCommon:   ['clefairy','jigglypuff','meowth','snubbull'],
    poolUncommon: ['granbull','wigglytuff','persian'],
    poolRare:     ['eevee','miltank'],
    poolVeryRare: ['togetic'],
    poolLegendary:[],
    trainers:['lass','beautyGen2','youngster','pokefan','pokefanf','guitarist','gentlemanGen2','pokemaniacGen2'],
    eliteTrainer:'whitney', gymLeader:'whitney', gymType:'normal', xpBonus:1.8 },

  { id:'ecruteak_gym', fr:'Ecorcia', en:'Ecruteak City', rep:400, spawnRate:0.05, type:'city',
    zoneLevelBonus:32, investCost:8000,
    poolCommon:   ['gastly','haunter','misdreavus'],
    poolUncommon: ['gengar','murkrow','zubat'],
    poolRare:     ['rattata','raticate'],
    poolVeryRare: [],
    poolLegendary:[],
    ghostZone: true,
    trainers:['medium','kimonogirl','psychicGen2','jugglerGen2'],
    eliteTrainer:'morty', gymLeader:'morty', gymType:'ghost', xpBonus:2.0 },

  { id:'cianwood_gym', fr:'Irisia', en:'Cianwood City', rep:500, spawnRate:0.06, type:'city',
    zoneLevelBonus:35, investCost:10000,
    poolCommon:   ['machop','machoke','poliwag'],
    poolUncommon: ['poliwhirl','poliwrath','mankey'],
    poolRare:     ['primeape','hitmonlee','hitmonchan'],
    poolVeryRare: ['hitmontop'],
    poolLegendary:[],
    trainers:['blackbelt','hikerGen2','sailor'],
    eliteTrainer:'chuck', gymLeader:'chuck', gymType:'fighting', xpBonus:2.0 },

  { id:'olivine_gym', fr:'Oliville', en:'Olivine City', rep:560, spawnRate:0.06, type:'city',
    zoneLevelBonus:36, investCost:12000,
    poolCommon:   ['magnemite','magneton','onix'],
    poolUncommon: ['forretress','steelix','skarmory'],
    poolRare:     ['scizor'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['sailor','acetrainerGen2','officer','guitarist'],
    eliteTrainer:'jasmine', gymLeader:'jasmine', gymType:'steel', xpBonus:2.2 },

  { id:'mahogany_gym', fr:'Acajou', en:'Mahogany Town', rep:650, spawnRate:0.06, type:'city',
    zoneLevelBonus:39, investCost:15000,
    poolCommon:   ['seel','shellder','swinub'],
    poolUncommon: ['dewgong','cloyster','piloswine'],
    poolRare:     ['sneasel','delibird','jynx'],
    poolVeryRare: ['lapras'],
    poolLegendary:[],
    trainers:['boarder','skier','hikerGen2'],
    eliteTrainer:'pryce', gymLeader:'pryce', gymType:'ice', xpBonus:2.3 },

  { id:'blackthorn_gym', fr:'Saquedenave', en:'Blackthorn City', rep:800, spawnRate:0.06, type:'city',
    zoneLevelBonus:43, investCost:25000,
    poolCommon:   ['dratini','horsea','magikarp'],
    poolUncommon: ['dragonair','seadra','gyarados'],
    poolRare:     ['dragonite','kingdra'],
    poolVeryRare: ['aerodactyl'],
    poolLegendary:[],
    trainers:['acetrainerGen2','blackbelt'],
    eliteTrainer:'clair', gymLeader:'clair', gymType:'dragon', xpBonus:2.8 },

  { id:'indigo_johto', fr:'Plateau Indigo (Johto)', en:'Indigo Plateau (Johto)',
    rep:1000, spawnRate:0.06, type:'city',
    zoneLevelBonus:49, investCost:50000,
    poolCommon:   ['dragonite','gyarados','espeon','umbreon'],
    poolUncommon: ['alakazam','machamp','gengar'],
    poolRare:     ['blissey','heracross'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['acetrainerGen2','acetrainerFGen2','pokemonranger','ethan','kris','gold'],
    eliteTrainer:'lance', gymLeader:'lance', gymType:'mixed', xpBonus:3.0 },


  // ══════════════════════════════════════════════════════════════
  // LIEUX SPÉCIAUX
  // ══════════════════════════════════════════════════════════════

  // ── Team Rocket ───────────────────────────────────────────────

  { id:'slowpoke_well', fr:'Puits Ramoloss', en:'Slowpoke Well', rep:130, spawnRate:0.05, type:'special',
    zoneLevelBonus:24, investCost:3000,
    poolCommon:   ['slowpoke','zubat','psyduck'],
    poolUncommon: ['slowbro','golbat','golduck'],
    poolRare:     ['slowking','magikarp','wooper'],
    poolVeryRare: ['quagsire'],
    poolLegendary:[],
    trainers:['rocketgrunt','rocketgruntf','officer'],
    eliteTrainer:'proton' },

  { id:'team_rocket_hq', fr:'QG Team Rocket Mahogany', en:'Team Rocket HQ Mahogany',
    rep:620, spawnRate:0.05, type:'special',
    zoneLevelBonus:38, investCost:20000,
    unlockItem:'rocket_hq_keycard',
    poolCommon:   ['electrode','voltorb','koffing'],
    poolUncommon: ['weezing','rattata','ditto'],
    poolRare:     ['porygon','porygon2'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['rocketgrunt','rocketgruntf','scientist','archer','ariana','proton'],
    eliteTrainer:'archer' },

  { id:'radio_tower', fr:'Tour Radio Doublonville', en:'Goldenrod Radio Tower',
    rep:700, spawnRate:0.05, type:'special',
    zoneLevelBonus:40, investCost:30000,
    unlockItem:'rocket_uniform',
    poolCommon:   ['electrode','voltorb','magneton'],
    poolUncommon: ['porygon','ditto','magnemite'],
    poolRare:     ['porygon2'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['rocketgrunt','rocketgruntf','scientist','archer','ariana','proton','officer'],
    eliteTrainer:'giovanni' },

  // ── Lieux culturels / mystiques ───────────────────────────────

  { id:'ruins_of_alph', fr:"Ruines d'Alpha", en:'Ruins of Alph', rep:200, spawnRate:0.04, type:'special',
    zoneLevelBonus:26, investCost:5000,
    poolCommon:   ['unown','geodude','natu'],
    poolUncommon: ['graveler','xatu','smeargle'],
    poolRare:     ['sudowoodo'],
    poolVeryRare: [],
    poolLegendary:['ho-oh'],
    trainers:['sage','psychicGen2','medium'],
    eliteTrainer:'eusine' },

  { id:'burned_tower', fr:'Tour Cendrée', en:'Burned Tower', rep:380, spawnRate:0.04, type:'special',
    zoneLevelBonus:31, investCost:10000,
    ghostZone: true,
    poolCommon:   ['koffing','weezing','growlithe'],
    poolUncommon: ['arcanine','vulpix','ninetales','magmar'],
    poolRare:     ['rapidash','rattata'],
    poolVeryRare: ['raikou','entei','suicune'],
    poolLegendary:[],
    trainers:['firebreather','medium','kimonogirl'],
    eliteTrainer:'morty' },

  { id:'tin_tower', fr:'Tour Carillon', en:'Tin Tower', rep:950, spawnRate:0.04, type:'special',
    zoneLevelBonus:48, investCost:45000,
    unlockItem:'carillon_permit',
    poolCommon:   ['espeon','umbreon','chansey'],
    poolUncommon: ['blissey','crobat','bellossom'],
    poolRare:     ['clefable','wigglytuff','snorlax'],
    poolVeryRare: [],
    poolLegendary:['ho-oh'],
    trainers:['acetrainerGen2','psychicGen2','medium','kimonogirl'],
    eliteTrainer:'lance' },

  // ── Nature / Extérieur ────────────────────────────────────────

  { id:'national_park', fr:'Parc National', en:'National Park', rep:270, spawnRate:0.08, type:'special',
    zoneLevelBonus:28, investCost:5000,
    poolCommon:   ['caterpie','metapod','weedle','kakuna'],
    poolUncommon: ['paras','parasect','venonat','venomoth'],
    poolRare:     ['scyther','heracross','yanma'],
    poolVeryRare: ['pinsir','snorlax'],
    poolLegendary:[],
    trainers:['bugcatcherGen2','youngster','lass','twins','schoolkid'],
    eliteTrainer:'bugsy' },

  { id:'safari_johto', fr:'Parc Safari de Johto', en:'Johto Safari Zone', rep:450, spawnRate:0.07, type:'special',
    zoneLevelBonus:33, investCost:15000,
    poolCommon:   ['tauros','miltank','stantler','girafarig'],
    poolUncommon: ['heracross','nidoran-f','nidoran-m','kangaskhan'],
    poolRare:     ['espeon','umbreon','scizor','steelix','blissey','ampharos'],
    poolVeryRare: ['chikorita','cyndaquil','totodile','raikou','entei','suicune'],
    poolLegendary:['tyranitar'],
    trainers:['acetrainerGen2','pokefan','pokefanf','pokemonranger'],
    eliteTrainer:'jasmine' },

  // ── Légendaires / Endgame ─────────────────────────────────────

  { id:'whirl_islands', fr:"Tourb'Îles", en:'Whirl Islands', rep:900, spawnRate:0.04, type:'special',
    zoneLevelBonus:46, investCost:45000,
    unlockItem:'tourbillon_permit',
    poolCommon:   ['tentacool','tentacruel','dewgong'],
    poolUncommon: ['politoed','slowking','golduck'],
    poolRare:     ['lapras','starmie','kingdra'],
    poolVeryRare: ['seadra'],
    poolLegendary:['lugia'],
    trainers:['swimmer','acetrainerGen2'],
    eliteTrainer:'lorelei' },

  { id:'dragons_den', fr:"Antre du Dragon", en:"Dragon's Den", rep:850, spawnRate:0.04, type:'special',
    zoneLevelBonus:45, investCost:25000,
    poolCommon:   ['dratini','horsea','magikarp'],
    poolUncommon: ['dragonair','seadra','lapras'],
    poolRare:     ['dragonite','kingdra','gyarados'],
    poolVeryRare: [],
    poolLegendary:[],
    trainers:['acetrainerGen2','blackbelt'],
    eliteTrainer:'clair' },

  { id:'mt_silver_summit', fr:'Mont Argenté — Sommet', en:'Mt. Silver — Summit',
    rep:1200, spawnRate:0.03, type:'special',
    zoneLevelBonus:55, investCost:0,
    unlockItem:'silver_permit',
    poolCommon:   ['dragonite','pikachu','snorlax'],
    poolUncommon: ['lapras','gyarados','espeon'],
    poolRare:     ['blissey','chansey'],
    poolVeryRare: [],
    poolLegendary:['mewtwo'],
    trainers:['acetrainerGen2','blackbelt'],
    eliteTrainer:'red' },

];


// ════════════════════════════════════════════════════════════════
// ÉVÉNEMENTS SPÉCIAUX JOHTO
// ════════════════════════════════════════════════════════════════

const SPECIAL_EVENTS_JOHTO = [

  // --- Team Rocket Neo ---
  { id:'rocket_radio_takeover', fr:"Prise d'Antenne Rocket !", en:'Rocket Radio Takeover!', icon:'📻',
    trainerKey:'archer', chance:0.03, minRep:600,
    reward: { money:[5000,12000], rep:20 },
    desc_fr:"Archer prend le contrôle de la Tour Radio ! Battez-le pour libérer les ondes.",
    desc_en:'Archer takes over the Radio Tower! Defeat him to free the airwaves.' },
  { id:'giovanni_comeback', fr:'Retour de Giovanni !', en:'Giovanni Returns!', icon:'💼',
    trainerKey:'giovanni', chance:0.01, minRep:900,
    reward: { money:[20000,40000], rep:60, rareBoost:90000 },
    desc_fr:"Giovanni revient dans l'ombre pour reconstruire la Team Rocket. Défaites-le une fois pour toutes !",
    desc_en:'Giovanni returns from the shadows to rebuild Team Rocket. Defeat him once and for all!' },

  // --- Rival Silver ---
  { id:'silver_ambush', fr:"Embuscade de Silver !", en:"Silver's Ambush!", icon:'⚔️',
    trainerKey:'silver', chance:0.03, minRep:200,
    reward: { money:[3000,7000], rep:15, xpBonus:40 },
    desc_fr:'Silver surgit ! "Les faibles ne méritent pas les Pokémon."',
    desc_en:'Silver appears! "The weak don\'t deserve Pokémon."' },
  // --- Légendaires chiens ---
  { id:'raikou_sighting', fr:'Apparition de Raikou !', en:'Raikou Sighting!', icon:'⚡',
    trainerKey:null, chance:0.02, minRep:350,
    reward: { rareBoost:90000, shinyBoost:30000, xpBonus:60 },
    desc_fr:"Un éclair traverse la zone — Raikou est là ! Les Pokémon Électrik afflent !",
    desc_en:'A bolt strikes the area — Raikou is here! Electric Pokémon surge in!' },
  { id:'entei_rampage', fr:"Charge d'Entei !", en:"Entei's Rampage!", icon:'🔥',
    trainerKey:null, chance:0.015, minRep:350,
    reward: { rareBoost:90000, shinyBoost:30000, money:[3000,7000] },
    desc_fr:"Le volcan gronde — Entei surgit ! Un déluge de feu ravage la zone !",
    desc_en:"The volcano rumbles — Entei erupts! A deluge of fire rages through the area!" },
  { id:'suicune_blessing', fr:'Bénédiction de Suicune !', en:"Suicune's Blessing!", icon:'💧',
    trainerKey:null, chance:0.02, minRep:350,
    reward: { rareBoost:90000, shinyBoost:45000, chestBoost:45000 },
    desc_fr:"Suicune purifie les eaux de la zone. Des Pokémon rares émergent des profondeurs !",
    desc_en:'Suicune purifies the waters. Rare Pokémon emerge from the depths!' },

  // --- Eusine (chasseur de Suicune) ---
  { id:'eusine_chase', fr:'Eusine sur la piste !', en:'Eusine on the Trail!', icon:'🔭',
    trainerKey:'eusine', chance:0.03, minRep:300,
    reward: { money:[2500,6000], rep:12, rareBoost:45000 },
    desc_fr:"Eusin traque Suicune à travers Johto. Il vous défie en chemin !",
    desc_en:'Eusine is tracking Suicune across Johto. He challenges you on the way!' },

  // --- Filles Kimono ---
  { id:'kimono_girls_event', fr:'Filles Kimono !', en:'Kimono Girls!', icon:'🎎',
    trainerKey:'kimonogirl', chance:0.04, minRep:400,
    reward: { xpBonus:50, rareBoost:45000, chestBoost:30000 },
    desc_fr:"Les cinq Filles Kimono dansent à Ecorcia. Une énergie mystique réveille les Pokémon rares.",
    desc_en:'The five Kimono Girls dance in Ecruteak. Mystic energy awakens rare Pokémon.' },

  { id:'kimono_ritual', fr:'Rituel des Kimono !', en:'Kimono Ritual!', icon:'🏮',
    trainerKey:'kimonogirl', chance:0.02, minRep:600,
    zoneIds:['ecruteak_gym','burned_tower','tin_tower'],
    reward: { eggGift:['espeon','umbreon'], rareBoost:75000, xpBonus:60 },
    desc_fr:"Les Filles Kimono invoquent Ho-Oh depuis la Tour Carillon. Des Pokémon légendaires s'éveillent.",
    desc_en:'The Kimono Girls summon Ho-Oh from Tin Tower. Legendary Pokémon stir.' },

  // --- Champions d'arène Johto ---
  { id:'falkner_challenge', fr:'Défi de Foxy !', en:"Falkner's Challenge!", icon:'🦅',
    trainerKey:'falkner', chance:0.04, minRep:50,
    reward: { money:[1500,3000], rep:12, xpBonus:25 },
    desc_fr:"Foxy surveille les cieux depuis son arène d'Ecorfeuil !",
    desc_en:"Falkner, Violet City's Gym Leader, watches the skies from his gym!" },
  { id:'whitney_challenge', fr:'Défi de Blanche !', en:"Whitney's Challenge!", icon:'🐄',
    trainerKey:'whitney', chance:0.03, minRep:220,
    reward: { money:[2000,4500], rep:15, xpBonus:30 },
    desc_fr:"Blanche fond en larmes... puis envoie son Écremeuh. Bonne chance.",
    desc_en:"Whitney bursts into tears... then sends out her Miltank. Good luck." },

  { id:'morty_challenge', fr:'Défi de Mortimer !', en:"Morty's Challenge!", icon:'👻',
    trainerKey:'morty', chance:0.03, minRep:350,
    reward: { money:[2500,5500], rep:18, xpBonus:40 },
    desc_fr:"Mortimer, le Champion Spectre, vous attire dans le brouillard d'Ecorcia.",
    desc_en:"Morty, the Ghost-type master, lures you into Ecruteak's fog." },
  { id:'clair_challenge', fr:'Défi de Cathy !', en:"Clair's Challenge!", icon:'🐉',
    trainerKey:'clair', chance:0.02, minRep:760,
    reward: { money:[6000,12000], rep:25, xpBonus:70 },
    desc_fr:"Cathy, la Reine des Dragons de Saquedenave, ne s'avouera jamais vaincue.",
    desc_en:"Clair, Blackthorn's Dragon Queen, will never admit defeat." },

  // --- Conseil des 4 Johto ---
  { id:'will_arrives', fr:'Yoran apparaît !', en:'Will Appears!', icon:'🔮',
    trainerKey:'will', chance:0.02, minRep:850,
    reward: { money:[8000,15000], rep:30, xpBonus:80 },
    desc_fr:'Yoran du Conseil 4 de Johto invoque ses Pokémon Psy depuis le néant !',
    desc_en:'Will of the Johto Elite Four summons his Psychic Pokémon from thin air!' },
  { id:'karen_appears', fr:'Carole apparaît !', en:'Karen Appears!', icon:'🌑',
    trainerKey:'karen', chance:0.02, minRep:920,
    reward: { money:[10000,20000], rep:35, xpBonus:90 },
    desc_fr:'Carole du Conseil 4 arrive avec ses Ténèbres. "Les forts ne s\'excusent pas."',
    desc_en:'Karen of the Elite Four arrives with her Dark-types. "Strong Pokémon need no excuses."' },

  { id:'lance_johto', fr:'Peter — Champion de Johto !', en:'Lance — Johto Champion!', icon:'🐉',
    trainerKey:'lance', chance:0.015, minRep:980,
    reward: { money:[12000,25000], rep:50, xpBonus:120 },
    desc_fr:"Peter, Champion de la région de Johto, descend du Plateau Indigo pour vous défier !",
    desc_en:"Lance, Johto's Champion, descends from the Indigo Plateau to challenge you!" },

  // --- Red & Ethan ---
  { id:'red_at_summit', fr:'Red au sommet !', en:'Red at the Summit!', icon:'🗻',
    trainerKey:'red', chance:0.01, minRep:1100,
    reward: { money:[20000,40000], rep:70, xpBonus:180 },
    desc_fr:"Red est au sommet du Mont Argenté, silencieux. Il accepte votre défi d'un geste.",
    desc_en:'Red stands at the summit of Mt. Silver, silent. He accepts your challenge with a nod.' },

  // --- Légendaires ---
  { id:'hooh_flies_over', fr:'Ho-Oh survole la région !', en:'Ho-Oh Flies Over!', icon:'🌈',
    trainerKey:null, chance:0.01, minRep:900,
    reward: { rareBoost:150000, shinyBoost:90000, eggGift:['ho-oh'] },
    desc_fr:"Un arc-en-ciel traverse le ciel — Ho-Oh passe au-dessus de Johto ! Les Pokémon Feu s'éveillent.",
    desc_en:'A rainbow crosses the sky — Ho-Oh soars over Johto! Fire Pokémon awaken.' },

  { id:'celebi_whisper', fr:'Murmure de Célébi !', en:"Celebi's Whisper!", icon:'🍃',
    trainerKey:null, chance:0.008, minRep:600,
    reward: { eggGift:['celebi'], rareBoost:120000, shinyBoost:60000 },
    desc_fr:"Un frisson traverse le Bois aux Chênes... Célébi voyage dans le temps ici même.",
    desc_en:'A shiver runs through Ilex Forest... Celebi is time-traveling here.' },

  // --- Événements lore ---
  { id:'sudowoodo_appears', fr:'Faux-Faux-Boss bloque la route !', en:'Sudowoodo Blocks the Path!', icon:'🪨',
    trainerKey:null, chance:0.05, minRep:300,
    reward: { eggGift:['sudowoodo'], money:[1500,4000], rep:8 },
    desc_fr:"Un Faux-Faux-Boss mime un arbre et bloque le passage. Arrosez-le pour débloquer la zone.",
    desc_en:'A Sudowoodo mimics a tree and blocks the path. Water it to unlock the area.' },

  { id:'egg_from_elm', fr:'Œuf du Prof. Orme !', en:'Egg from Prof. Elm!', icon:'🥚',
    trainerKey:null, chance:0.05, minRep:50,
    reward: { eggGift:['togepi'], xpBonus:20, chestBoost:20000 },
    desc_fr:"Le Prof. Orme vous confie un mystérieux œuf. On dirait qu'il est sur le point d'éclore.",
    desc_en:'Prof. Elm entrusts you with a mysterious egg. It looks about to hatch.' },

  { id:'crystal_onix', fr:'Onix de Cristal !', en:'Crystal Onix!', icon:'💎',
    trainerKey:null, chance:0.02, minRep:500,
    reward: { eggGift:['steelix'], rareBoost:60000, shinyBoost:60000 },
    desc_fr:"Une légende : un Onix de cristal sommeille quelque part. Son éclat attire les shinies.",
    desc_en:'Legend speaks of a crystal Onix dormant somewhere. Its shine draws out shinies.' },

  { id:'rocket_broadcast', fr:'Diffusion Rocket !', en:'Rocket Broadcast!', icon:'📡',
    trainerKey:'archer', chance:0.03, minRep:650,
    reward: { money:[5000,10000], rep:18, rareBoost:30000 },
    desc_fr:"La Team Rocket pirate les ondes radio pour appeler Giovanni. Coupez la transmission !",
    desc_en:'Team Rocket hijacks the radio waves to call Giovanni. Cut the transmission!' },

  // --- Zones spécifiques ---
  { id:'ruins_alph_signal', fr:'Signal des Ruines !', en:'Ruins Signal!', icon:'🔣',
    trainerKey:null, chance:0.06, minRep:150,
    zoneIds:['ruins_of_alph'],
    reward: { rareBoost:60000, shinyBoost:30000, eggGift:['unown'] },
    desc_fr:"Les symboles Zarbi s'illuminent dans les Ruines d'Alpha... Un signal mystérieux apparaît.",
    desc_en:'Unown symbols light up in the Ruins of Alph... A mysterious signal appears.' },

  { id:'burned_beast_run', fr:'Pokémon Bestial Aperçu !', en:'Beast Pokémon Spotted!', icon:'🐆',
    trainerKey:null, chance:0.04, minRep:300,
    zoneIds:['burned_tower','route36_37','route42_43'],
    reward: { rareBoost:120000, shinyBoost:45000 },
    desc_fr:"Un Pokémon Bestial a été aperçu dans la zone ! Il court — vite !",
    desc_en:'A Beast Pokémon was spotted in the area! It runs — fast!' },

  { id:'dragon_den_ritual', fr:"Rituel de l'Antre !", en:"Dragon's Den Ritual!", icon:'🐉',
    trainerKey:'clair', chance:0.03, minRep:800,
    zoneIds:['dragons_den','blackthorn_gym'],
    reward: { money:[8000,16000], rep:28, eggGift:['dratini'], xpBonus:70 },
    desc_fr:"Un antique rituel de dresseurs de Dragons se tient dans l'Antre. Cathy vous y invite.",
    desc_en:"An ancient Dragon Tamer ritual takes place in the Den. Clair invites you in." },

  { id:'ecruteak_haunting', fr:"Hantise d'Ecorcia !", en:'Ecruteak Haunting!', icon:'🏮',
    trainerKey:null, chance:0.05, minRep:350,
    zoneIds:['ecruteak_gym','burned_tower'],
    reward: { shinyBoost:75000, rareBoost:45000 },
    desc_fr:"Une nuit sans lune à Ecorcia. Les Pokémon Spectre envahissent la Tour Cendrée.",
    desc_en:'A moonless night in Ecruteak. Ghost Pokémon flood the Burned Tower.' },

  { id:'firebreather_show', fr:'Spectacle de Crachefeux !', en:'Firebreather Show!', icon:'🔥',
    trainerKey:'firebreather', chance:0.04, minRep:350,
    zoneIds:['burned_tower','ecruteak_gym'],
    reward: { money:[2000,5000], rep:10, rareBoost:30000 },
    desc_fr:"Des Crachefeux itinérants exhibent leurs Pokémon Feu dans la Tour Cendrée. Arrêtez le spectacle !",
    desc_en:'Itinerant Firebreathers show off their Fire Pokémon in the Burned Tower. Crash the show!' },

  // --- Argent'Aile (silver_wing) — pour quête Lugia + Permis Tourbillon ---
  { id:'silver_wing_found', fr:"Argent'Aile trouvée !", en:'Silver Wing Found!', icon:'🪶',
    trainerKey:null, chance:0.02, minRep:400,
    zoneIds:['whirl_islands','tin_tower','mt_mortar','ice_path','mt_silver_johto'],
    reward: { itemGift:'silver_wing' },
    desc_fr:"Une plume argentée brille dans la zone — une Argent'Aile ! Elle attire Lugia...",
    desc_en:"A silver feather shines in the area — a Silver Wing! It draws Lugia near..." },

  // --- Arcenci'Aile (rainbow_wing) — pour quête Ho-Oh + Permis Carillon ---
  { id:'rainbow_wing_found', fr:"Arcenci'Aile trouvée !", en:'Rainbow Wing Found!', icon:'🌈',
    trainerKey:null, chance:0.02, minRep:400,
    zoneIds:['tin_tower','burned_tower','ruins_of_alph','ecruteak_gym','national_park'],
    reward: { itemGift:'rainbow_wing' },
    desc_fr:"Une plume irisée descend du ciel — une Arcenci'Aile ! Ho-Oh n'est pas loin...",
    desc_en:"An iridescent feather falls from the sky — a Rainbow Wing! Ho-Oh is close..." },

  // --- Cristal Bête (cristal_bete) — relance combat Bêtes Sacrées ---
  { id:'beast_crystal_shard', fr:'Éclat Cristal Bête !', en:'Beast Crystal Shard!', icon:'💎',
    trainerKey:null, chance:0.015, minRep:600,
    zoneIds:['burned_tower','whirl_islands','mt_silver_johto','mt_silver_summit','dark_cave'],
    reward: { itemGift:'cristal_bete' },
    desc_fr:"Un fragment cristallin palpite d'une énergie bestiale. Il contient l'âme des trois Bêtes Sacrées.",
    desc_en:"A crystalline shard pulses with bestial energy. It holds the soul of the three Sacred Beasts." },

];


// ════════════════════════════════════════════════════════════════
// MUSIQUES PAR ZONE
// ════════════════════════════════════════════════════════════════

const ZONE_MUSIC_MAP_JOHTO = {
  johto_gang_hq:   'city',
  // Routes
  route29:         'forest',
  route30_31:      'forest',
  route36_37:      'forest',
  route42_43:      'forest',
  route44_45_46:   'forest',
  // Grottes & montagne
  dark_cave:       'cave',
  mt_mortar:       'cave',
  ice_path:        'cave',
  mt_silver_johto: 'elite4',
  mt_silver_summit:'elite4',
  // Forêt
  ilex_forest:     'forest',
  // Villes / arènes
  violet_gym:      'gym',
  azalea_gym:      'gym',
  goldenrod_gym:   'city',
  ecruteak_gym:    'gym',
  cianwood_gym:    'gym',
  olivine_gym:     'gym',
  mahogany_gym:    'gym',
  blackthorn_gym:  'gym',
  indigo_johto:    'elite4',
  // Lieux spéciaux
  slowpoke_well:   'cave',
  ruins_of_alph:   'cave',
  national_park:   'safari',
  burned_tower:    'mansion',
  team_rocket_hq:  'silph',
  radio_tower:     'silph',
  dragons_den:     'cave',
  safari_johto:    'safari',
  tin_tower:       'elite4',
  whirl_islands:   'sea',
};


// ════════════════════════════════════════════════════════════════
// INJECTION — construit pool[] + rarePool[] depuis les tiers
// et enregistre dans les globaux de zones-data.js
// ════════════════════════════════════════════════════════════════

ZONES_JOHTO.forEach(z => {
  z.region = 'johto';

  // Auto-build flat pool (common + uncommon) pour le moteur actuel
  if ((z.poolCommon?.length || z.poolUncommon?.length) && !z.pool?.length) {
    z.pool = [...(z.poolCommon || []), ...(z.poolUncommon || [])];
  }

  // Auto-build rarePool depuis tiers rare/veryRare/legendary
  const rare      = (z.poolRare      || []).map(en => ({ en, w: 3 }));
  const veryRare  = (z.poolVeryRare  || []).map(en => ({ en, w: 1 }));
  const legendary = (z.poolLegendary || []).map(en => ({ en, w: 1 }));
  if ((rare.length || veryRare.length || legendary.length) && !z.rarePool?.length) {
    z.rarePool = [...rare, ...veryRare, ...legendary];
  }

  ZONES.push(z);
  ZONE_BY_ID[z.id] = z;
});

SPECIAL_EVENTS_JOHTO.forEach(e => SPECIAL_EVENTS.push(e));
Object.assign(ZONE_MUSIC_MAP, ZONE_MUSIC_MAP_JOHTO);

// Index rapide Johto (accès direct par id sans passer par ZONES)
const ZONE_JOHTO_BY_ID = {};
ZONES_JOHTO.forEach(z => ZONE_JOHTO_BY_ID[z.id] = z);
