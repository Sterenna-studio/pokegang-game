// ════════════════════════════════════════════════════════════════
// PokéGang — Zones Johto Data
// Chargé avant app.js comme <script> ordinaire (globals partagés)
// Couvre la région de Johto (Or/HeartGold & Argent/SoulSilver)
// Destiné à étendre ZONES[] une fois le support multi-région activé
// ════════════════════════════════════════════════════════════════

// ── Toutes les zones Johto ────────────────────────────────────
// Convention identique à zones-data.js :
//   type: 'route' | 'city' | 'special' | 'gang_park'
//   rep   : réputation minimale pour débloquer (progression Johto)
//   pool  : spawns normaux
//   rarePool (optionnel) : spawns rares pondérés {en, w}
//   trainers[] : types de dresseurs présents
//   eliteTrainer : dresseur boss de la zone
//   investCost : coût d'investissement en PokéDollars
//   unlockItem (optionnel) : item requis pour accéder
//   gymLeader / gymType / xpBonus : uniquement pour type 'city'
//   ghostZone (optionnel) : zone hantée (modifie spawn ghost)
// ════════════════════════════════════════════════════════════════

const ZONES_JOHTO = [

  // ══ QUARTIER GÉNÉRAL JOHTO (base gang Johto — toujours ouverte) ══
  { id:'johto_gang_hq',   fr:'Planque de New Bark',  en:'New Bark Hideout',  rep:0,    spawnRate:0,    type:'gang_park',
    pool:[], trainers:[], investCost:0,
    desc_fr:'Votre planque à New Bark Town. Point de départ de la conquête de Johto.',
    desc_en:'Your hideout in New Bark Town. Starting point of the Johto conquest.' },

  // ══ ROUTES & NATURE ══

  { id:'route29',         fr:'Route 29',             en:'Route 29',          rep:0,    spawnRate:0.07, type:'route',
    pool:['sentret','hoothoot','hoppip','mareep','rattata','pidgey','caterpie','weedle'],
    trainers:['youngster','lass'], eliteTrainer:'acetrainer', investCost:0 },

  { id:'route30_31',      fr:'Routes 30 & 31',       en:'Routes 30 & 31',    rep:20,   spawnRate:0.07, type:'route',
    pool:['ledyba','spinarak','caterpie','metapod','weedle','kakuna','hoothoot','noctowl','bellsprout','hoppip'],
    trainers:['youngster','lass','bugcatcher'], eliteTrainer:'acetrainer', investCost:1500 },

  { id:'dark_cave',       fr:'Grotte Sombre',        en:'Dark Cave',         rep:80,   spawnRate:0.05, type:'route',
    pool:['zubat','geodude','wobbuffet','dunsparce','graveler','golbat','teddiursa','ursaring'],
    trainers:['hiker','camper'], eliteTrainer:'hiker', investCost:3000 },

  { id:'ilex_forest',     fr:'Forêt de Viridis',     en:'Ilex Forest',       rep:180,  spawnRate:0.08, type:'route',
    pool:['caterpie','metapod','butterfree','oddish','psyduck','slowpoke','hoothoot','noctowl','aipom','yanma'],
    rarePool:[
      {en:'celebi', w:1},
      {en:'scyther', w:2}, {en:'pinsir', w:2},
      {en:'heracross', w:3}, {en:'shuckle', w:3},
      {en:'aipom', w:4}, {en:'yanma', w:4},
    ],
    trainers:['bugcatcher','youngster','lass'], eliteTrainer:'bugsy', investCost:4000,
    ghostZone: false },

  { id:'route36_37',      fr:'Routes 36 & 37',       en:'Routes 36 & 37',    rep:280,  spawnRate:0.07, type:'route',
    pool:['girafarig','stantler','snubbull','growlithe','vulpix','tauros','miltank','hoppip','skiploom'],
    trainers:['youngster','lass','picnicker','camper'], eliteTrainer:'acetrainer', investCost:5000 },

  { id:'mt_mortar',       fr:'Mont Mortier',         en:'Mt. Mortar',        rep:380,  spawnRate:0.04, type:'route',
    pool:['machop','machoke','geodude','graveler','zubat','golbat','rattata','marill','tyrogue'],
    rarePool:[
      {en:'tyrogue', w:2},
      {en:'hitmonlee', w:2}, {en:'hitmonchan', w:2}, {en:'hitmontop', w:2},
      {en:'machamp', w:1},
    ],
    trainers:['hiker','blackbelt'], eliteTrainer:'blackbelt', investCost:8000 },

  { id:'route42_43',      fr:'Routes 42 & 43',       en:'Routes 42 & 43',    rep:480,  spawnRate:0.06, type:'route',
    pool:['marill','flaaffy','ampharos','mareep','aipom','tauros','miltank','drowzee','hypno'],
    trainers:['picnicker','camper','swimmer'], eliteTrainer:'acetrainer', investCost:9000 },

  { id:'ice_path',        fr:'Chemin Glacé',         en:'Ice Path',          rep:650,  spawnRate:0.04, type:'route',
    pool:['swinub','piloswine','jynx','sneasel','delibird','zubat','golbat','wobbuffet'],
    trainers:['hiker','blackbelt'], eliteTrainer:'pryce', investCost:15000 },

  { id:'route44_45_46',   fr:'Routes 44, 45 & 46',   en:'Routes 44, 45 & 46',rep:700,  spawnRate:0.05, type:'route',
    pool:['weepinbell','victreebel','tangela','pinsir','scyther','heracross','dratini','dragonair'],
    trainers:['picnicker','camper','acetrainer'], eliteTrainer:'acetrainer', investCost:20000 },

  { id:'mt_silver_johto', fr:'Mont Argenté (versant Johto)', en:'Mt. Silver (Johto Side)', rep:1100, spawnRate:0.03, type:'route',
    pool:['dragonite','gyarados','snorlax','lapras','pikachu','chansey','larvitar','pupitar'],
    rarePool:[
      {en:'tyranitar', w:1},
      {en:'larvitar', w:4}, {en:'pupitar', w:2},
    ],
    trainers:['acetrainer','blackbelt','pokemonranger'], eliteTrainer:'red', investCost:0 },

  // ══ VILLES / ARÈNES ══

  { id:'violet_gym',      fr:'Ecorfeuil',            en:'Violet City',       rep:50,   spawnRate:0.06, type:'city',
    pool:['pidgey','spearow','hoothoot','noctowl','doduo','farfetchd','togetic','aerodactyl'],
    trainers:['youngster','lass','camper'], eliteTrainer:'falkner', investCost:1500,
    gymLeader:'falkner', gymType:'flying', xpBonus:1.5 },

  { id:'azalea_gym',      fr:'Azalée',               en:'Azalea Town',       rep:150,  spawnRate:0.06, type:'city',
    pool:['caterpie','metapod','weedle','kakuna','spinarak','ledyba','scyther','pinsir','heracross'],
    trainers:['bugcatcher','youngster','lass'], eliteTrainer:'bugsy', investCost:3000,
    gymLeader:'bugsy', gymType:'bug', xpBonus:1.5 },

  { id:'goldenrod_gym',   fr:'Doublonville',         en:'Goldenrod City',    rep:250,  spawnRate:0.06, type:'city',
    pool:['clefairy','snubbull','granbull','jigglypuff','wigglytuff','meowth','persian','eevee','miltank'],
    trainers:['lass','beauty','youngster'], eliteTrainer:'whitney', investCost:5000,
    gymLeader:'whitney', gymType:'normal', xpBonus:1.8 },

  { id:'ecruteak_gym',    fr:'Ecorussie',            en:'Ecruteak City',     rep:400,  spawnRate:0.05, type:'city',
    pool:['gastly','haunter','gengar','misdreavus','duskull','shuppet','banette','sableye','murkrow'],
    trainers:['channeler','psychic'], eliteTrainer:'morty', investCost:8000,
    gymLeader:'morty', gymType:'ghost', xpBonus:2.0,
    ghostZone: true },

  { id:'cianwood_gym',    fr:'Acajou',               en:'Cianwood City',     rep:500,  spawnRate:0.06, type:'city',
    pool:['machop','machoke','machamp','poliwag','poliwhirl','poliwrath','mankey','primeape','hitmonlee','hitmonchan'],
    trainers:['blackbelt','hiker','sailor'], eliteTrainer:'chuck', investCost:10000,
    gymLeader:'chuck', gymType:'fighting', xpBonus:2.0 },

  { id:'olivine_gym',     fr:'Oliville',             en:'Olivine City',      rep:560,  spawnRate:0.06, type:'city',
    pool:['magnemite','magneton','forretress','steelix','scizor','skarmory','onix','aron'],
    trainers:['sailor','supernerd','acetrainer'], eliteTrainer:'jasmine', investCost:12000,
    gymLeader:'jasmine', gymType:'steel', xpBonus:2.2 },

  { id:'mahogany_gym',    fr:'Acajou',               en:'Mahogany Town',     rep:650,  spawnRate:0.06, type:'city',
    pool:['seel','dewgong','shellder','cloyster','swinub','piloswine','sneasel','delibird','lapras','jynx'],
    trainers:['hiker','youngster','acetrainer'], eliteTrainer:'pryce', investCost:15000,
    gymLeader:'pryce', gymType:'ice', xpBonus:2.3 },

  { id:'blackthorn_gym',  fr:'Saquedenave',          en:'Blackthorn City',   rep:800,  spawnRate:0.06, type:'city',
    pool:['dratini','dragonair','dragonite','horsea','seadra','kingdra','magikarp','gyarados','aerodactyl'],
    trainers:['acetrainer','blackbelt'], eliteTrainer:'clair', investCost:25000,
    gymLeader:'clair', gymType:'dragon', xpBonus:2.8 },

  { id:'indigo_johto',    fr:'Plateau Indigo (Johto)',en:'Indigo Plateau (Johto)', rep:1000, spawnRate:0.06, type:'city',
    pool:['dragonite','gyarados','espeon','umbreon','alakazam','machamp','gengar','blissey','heracross'],
    trainers:['acetrainer','acetrainerf','pokemonranger'], eliteTrainer:'lance', investCost:50000,
    gymLeader:'lance', gymType:'mixed', xpBonus:3.0 },

  // ══ LIEUX SPÉCIAUX ══

  { id:'slowpoke_well',   fr:'Puits Ramoloss',       en:'Slowpoke Well',     rep:130,  spawnRate:0.05, type:'special',
    pool:['slowpoke','slowbro','slowking','zubat','golbat','psyduck','golduck','magikarp','wooper','quagsire'],
    trainers:['rocketgrunt','rocketgruntf','supernerd'], eliteTrainer:'proton', investCost:3000 },

  { id:'ruins_of_alph',   fr:'Ruines d\'Alph',       en:'Ruins of Alph',     rep:200,  spawnRate:0.04, type:'special',
    pool:['unown','geodude','graveler','natu','xatu','smeargle','sudowoodo'],
    rarePool:[
      {en:'unown', w:10},
      {en:'natu', w:5},  {en:'xatu', w:3},
      {en:'smeargle', w:2}, {en:'sudowoodo', w:2},
      {en:'ho-oh', w:1},
    ],
    trainers:['psychic','supernerd'], eliteTrainer:'psychic', investCost:5000 },

  { id:'national_park',   fr:'Parc National',        en:'National Park',     rep:270,  spawnRate:0.08, type:'special',
    pool:['caterpie','metapod','butterfree','weedle','kakuna','beedrill','paras','parasect','scyther','pinsir','heracross','yanma','venonat','venomoth'],
    rarePool:[
      {en:'scyther', w:3}, {en:'pinsir', w:3}, {en:'heracross', w:2},
      {en:'yanma', w:2},   {en:'snorlax', w:1},
    ],
    trainers:['bugcatcher','youngster','lass','picnicker'], eliteTrainer:'bugsy', investCost:5000 },

  { id:'burned_tower',    fr:'Tour Cramée',          en:'Burned Tower',      rep:380,  spawnRate:0.04, type:'special',
    pool:['koffing','weezing','growlithe','arcanine','vulpix','ninetales','magmar','rapidash','rattata','raticate'],
    rarePool:[
      {en:'raikou',  w:1},
      {en:'entei',   w:1},
      {en:'suicune', w:1},
      {en:'arcanine', w:3}, {en:'ninetales', w:3},
    ],
    trainers:['rocketgrunt','scientist','channeler'], eliteTrainer:'morty', investCost:10000,
    ghostZone: true },

  { id:'team_rocket_hq',  fr:'QG Team Rocket Mahogany', en:'Team Rocket HQ Mahogany', rep:620, spawnRate:0.05, type:'special',
    unlockItem:'rocket_hq_keycard',
    pool:['electrode','voltorb','koffing','weezing','rattata','raticate','ditto','porygon','porygon2'],
    trainers:['rocketgrunt','rocketgruntf','scientist','archer','ariana','proton'], eliteTrainer:'archer', investCost:20000 },

  { id:'radio_tower',     fr:'Tour Radio Doublonville', en:'Goldenrod Radio Tower', rep:700, spawnRate:0.05, type:'special',
    unlockItem:'rocket_uniform',
    pool:['electrode','voltorb','magneton','porygon','porygon2','ditto'],
    trainers:['rocketgrunt','rocketgruntf','scientist','archer','ariana','proton','policeman'], eliteTrainer:'giovanni', investCost:30000 },

  { id:'dragons_den',     fr:'Antre du Dragon',      en:'Dragon\'s Den',     rep:850,  spawnRate:0.04, type:'special',
    pool:['dratini','dragonair','dragonite','kingdra','gyarados','horsea','seadra','magikarp','lapras'],
    rarePool:[
      {en:'dragonite', w:1},
      {en:'dragonair', w:3}, {en:'kingdra', w:2},
    ],
    trainers:['acetrainer','blackbelt'], eliteTrainer:'clair', investCost:25000 },

  { id:'safari_johto',    fr:'Parc Safari de Johto', en:'Johto Safari Zone', rep:450,  spawnRate:0.07, type:'special',
    pool:['tauros','miltank','stantler','girafarig','heracross','nidoran-f','nidoran-m','kangaskhan','dratini'],
    rarePool:[
      // Ultra-rare (starters johto, évolutions)
      {en:'chikorita',w:1},{en:'bayleef',w:1},{en:'meganium',w:1},
      {en:'cyndaquil',w:1},{en:'quilava',w:1},{en:'typhlosion',w:1},
      {en:'totodile',w:1}, {en:'croconaw',w:1},{en:'feraligatr',w:1},
      // Légendaires chiens (très rares)
      {en:'raikou',w:1},{en:'entei',w:1},{en:'suicune',w:1},
      // Évolutions rares Johto
      {en:'espeon',w:2},{en:'umbreon',w:2},{en:'scizor',w:2},{en:'steelix',w:2},
      {en:'blissey',w:2},{en:'tyranitar',w:1},{en:'ampharos',w:3},
      // Communs Johto évolués
      {en:'flaaffy',w:4},{en:'togetic',w:3},{en:'politoed',w:3},
      {en:'slowking',w:3},{en:'wobbuffet',w:4},{en:'girafarig',w:4},
      {en:'granbull',w:4},{en:'sneasel',w:3},{en:'magby',w:4},{en:'elekid',w:4},
    ],
    trainers:['acetrainer','pokemonranger'], eliteTrainer:'jasmine', investCost:15000 },

  { id:'whirl_islands',   fr:'Îles Tourbillon',      en:'Whirl Islands',     rep:900,  spawnRate:0.04, type:'special',
    pool:['lugia','politoed','slowking','kingdra','tentacruel','dewgong','lapras','seadra','starmie','tentacool','golduck','psyduck'],
    trainers:['swimmer','acetrainer'], eliteTrainer:'lorelei', investCost:45000,
    unlockItem:'tourbillon_permit' },

  { id:'tin_tower',       fr:'Tour Carillon',        en:'Tin Tower',         rep:950,  spawnRate:0.04, type:'special',
    pool:['ho-oh','espeon','umbreon','blissey','crobat','bellossom','clefable','wigglytuff','chansey','snorlax','pichu','cleffa'],
    trainers:['acetrainer','psychic'], eliteTrainer:'lance', investCost:45000,
    unlockItem:'carillon_permit' },

  { id:'mt_silver_summit',fr:'Mont Argenté — Sommet',en:'Mt. Silver — Summit',rep:1200, spawnRate:0.03, type:'special',
    pool:['dragonite','pikachu','snorlax','lapras','gyarados','espeon','blissey','chansey'],
    rarePool:[
      {en:'mewtwo', w:1},
    ],
    trainers:['acetrainer','blackbelt'], eliteTrainer:'red', investCost:0,
    unlockItem:'silver_permit' },

];

// ── Événements spéciaux Johto ─────────────────────────────────
const SPECIAL_EVENTS_JOHTO = [

  // --- Team Rocket Neo (Johto) ---
  { id:'rocket_radio_takeover', fr:'Prise d\'Antenne Rocket !', en:'Rocket Radio Takeover!', icon:'📻',
    trainerKey:'archer', chance:0.03, minRep:600,
    reward: { money:[5000,12000], rep:20 },
    desc_fr:'Archer prend le contrôle de la Tour Radio ! Battez-le pour libérer les ondes.',
    desc_en:'Archer takes over the Radio Tower! Defeat him to free the airwaves.' },

  { id:'rocket_slowpoke_heist', fr:'Vol des Queues Ramoloss !', en:'Slowpoke Tail Heist!', icon:'🐾',
    trainerKey:'proton', chance:0.05, minRep:100,
    reward: { money:[2000,5000], rep:12 },
    desc_fr:'Lambda rackette les habitants d\'Azalée avec des queues de Ramoloss !',
    desc_en:'Proton is extorting Azalea residents with Slowpoke Tails!' },

  { id:'rocket_lake_raid',  fr:'Raid au Lac de Mahogany !',  en:'Mahogany Lake Raid!', icon:'🎣',
    trainerKey:'ariana', chance:0.04, minRep:400,
    reward: { money:[3000,7000], rep:15 },
    desc_fr:'Ariane dirige une opération secrète au lac Acajou. Arrêtez-la !',
    desc_en:'Ariana is running a secret operation at Mahogany Lake. Stop her!' },

  { id:'giovanni_comeback', fr:'Retour de Giovanni !',        en:'Giovanni Returns!',    icon:'💼',
    trainerKey:'giovanni', chance:0.01, minRep:900,
    reward: { money:[20000,40000], rep:60, rareBoost:90000 },
    desc_fr:'Giovanni revient dans l\'ombre pour reconstruire la Team Rocket. Défaites-le une fois pour toutes !',
    desc_en:'Giovanni returns from the shadows to rebuild Team Rocket. Defeat him once and for all!' },

  // --- Rival Silver ---
  { id:'silver_ambush',    fr:'Embuscade de Silver !',        en:'Silver\'s Ambush!',    icon:'⚔️',
    trainerKey:'silver', chance:0.03, minRep:200,
    reward: { money:[3000,7000], rep:15, xpBonus:40 },
    desc_fr:'Silver surgit ! \"Les faibles ne méritent pas les Pokémon.\"',
    desc_en:'Silver appears! "The weak don\'t deserve Pokémon."' },

  { id:'silver_final',     fr:'Confrontation Finale avec Silver !', en:'Final Showdown with Silver!', icon:'🌑',
    trainerKey:'silver', chance:0.015, minRep:900,
    reward: { money:[10000,20000], rep:40, xpBonus:100 },
    desc_fr:'Silver revient transformé. Un dernier duel pour conclure votre rivalité.',
    desc_en:'Silver returns, changed. One final duel to end your rivalry.' },

  // --- Légendaires chiens ---
  { id:'raikou_sighting',  fr:'Apparition de Raikou !',       en:'Raikou Sighting!',     icon:'⚡',
    trainerKey:null, chance:0.02, minRep:350,
    reward: { rareBoost:90000, shinyBoost:30000, xpBonus:60 },
    desc_fr:'Un éclair traverse la zone — Raikou est là ! Les Pokémon Électrik afflent !',
    desc_en:'A bolt strikes the area — Raikou is here! Electric Pokémon surge in!' },

  { id:'entei_eruption',   fr:'Éruption d\'Entei !',          en:'Entei\'s Eruption!',   icon:'🌋',
    trainerKey:null, chance:0.02, minRep:350,
    reward: { rareBoost:90000, shinyBoost:30000, xpBonus:60 },
    desc_fr:'La terre tremble — Entei galope dans la zone ! Les Pokémon Feu s\'embrasent !',
    desc_en:'The ground trembles — Entei gallops through! Fire Pokémon ignite!' },

  { id:'suicune_blessing',  fr:'Bénédiction de Suicune !',    en:'Suicune\'s Blessing!', icon:'💧',
    trainerKey:null, chance:0.02, minRep:350,
    reward: { rareBoost:90000, shinyBoost:45000, chestBoost:45000 },
    desc_fr:'Suicune purifie les eaux de la zone. Des Pokémon rares émergent des profondeurs !',
    desc_en:'Suicune purifies the waters. Rare Pokémon emerge from the depths!' },

  // --- Champions d'arène Johto ---
  { id:'falkner_challenge', fr:'Défi de Foxy !',              en:'Falkner\'s Challenge!', icon:'🦅',
    trainerKey:'falkner', chance:0.04, minRep:50,
    reward: { money:[1500,3000], rep:12, xpBonus:25 },
    desc_fr:'Foxy, le Champion Envol d\'Ecorfeuil, surveille les cieux depuis son arène !',
    desc_en:'Falkner, Violet City\'s Gym Leader, watches the skies from his gym!' },

  { id:'bugsy_challenge',   fr:'Défi de Léna !',              en:'Bugsy\'s Challenge!',   icon:'🐛',
    trainerKey:'bugsy', chance:0.04, minRep:130,
    reward: { money:[1500,3000], rep:12, xpBonus:25 },
    desc_fr:'Léna, la pro en entomologie, envoie ses insectes à l\'assaut !',
    desc_en:'Bugsy, the bug expert, sends her insects into battle!' },

  { id:'whitney_challenge', fr:'Défi de Blanche !',           en:'Whitney\'s Challenge!', icon:'🐄',
    trainerKey:'whitney', chance:0.03, minRep:220,
    reward: { money:[2000,4500], rep:15, xpBonus:30 },
    desc_fr:'Blanche fond en larmes... puis envoie son Écremeuh. Bonne chance.',
    desc_en:'Whitney bursts into tears... then sends out her Miltank. Good luck.' },

  { id:'morty_challenge',   fr:'Défi de Mortimer !',          en:'Morty\'s Challenge!',   icon:'👻',
    trainerKey:'morty', chance:0.03, minRep:350,
    reward: { money:[2500,5500], rep:18, xpBonus:40 },
    desc_fr:'Mortimer, le Champion Spectre, vous attire dans le brouillard d\'Ecorussie.',
    desc_en:'Morty, the Ghost-type master, lures you into Ecruteak\'s fog.' },

  { id:'chuck_challenge',   fr:'Défi de Bastien !',           en:'Chuck\'s Challenge!',   icon:'💪',
    trainerKey:'chuck', chance:0.03, minRep:460,
    reward: { money:[3000,6000], rep:18, xpBonus:45 },
    desc_fr:'Bastien sort de sa cascade d\'entraînement pour vous affronter !',
    desc_en:'Chuck steps out from his waterfall training to battle you!' },

  { id:'jasmine_challenge', fr:'Défi de Jasmine !',           en:'Jasmine\'s Challenge!', icon:'⚙️',
    trainerKey:'jasmine', chance:0.03, minRep:530,
    reward: { money:[3500,7000], rep:20, xpBonus:50 },
    desc_fr:'Jasmine, la Fille de Fer d\'Oliville, sort son Steelix sans hésiter.',
    desc_en:'Jasmine, the Steel-clad Girl of Olivine, sends out her Steelix without hesitation.' },

  { id:'pryce_challenge',   fr:'Défi de Froid !',             en:'Pryce\'s Challenge!',   icon:'🧊',
    trainerKey:'pryce', chance:0.02, minRep:620,
    reward: { money:[4000,8000], rep:20, xpBonus:55 },
    desc_fr:'Froid, le Maître de Glace aux 30 ans d\'expérience, gèle vos espoirs.',
    desc_en:'Pryce, the ice master with 30 years of experience, freezes your hopes.' },

  { id:'clair_challenge',   fr:'Défi de Cathy !',             en:'Clair\'s Challenge!',   icon:'🐉',
    trainerKey:'clair', chance:0.02, minRep:760,
    reward: { money:[6000,12000], rep:25, xpBonus:70 },
    desc_fr:'Cathy, la Reine des Dragons de Saquedenave, ne s\'avouera jamais vaincue.',
    desc_en:'Clair, Blackthorn\'s Dragon Queen, will never admit defeat.' },

  // --- Conseil des 4 Johto ---
  { id:'will_arrives',      fr:'Yoran apparaît !',            en:'Will Appears!',         icon:'🔮',
    trainerKey:'will', chance:0.02, minRep:850,
    reward: { money:[8000,15000], rep:30, xpBonus:80 },
    desc_fr:'Yoran du Conseil 4 de Johto invoque ses Pokémon Psy depuis le néant !',
    desc_en:'Will of the Johto Elite Four summons his Psychic Pokémon from thin air!' },

  { id:'koga_johto',        fr:'Koga du Conseil 4 !',         en:'Koga (Elite Four)!',    icon:'🥷',
    trainerKey:'koga', chance:0.02, minRep:880,
    reward: { money:[9000,17000], rep:32, xpBonus:85 },
    desc_fr:'Koga, promu au Conseil 4 de Johto, surgit de l\'ombre avec de nouveaux Pokémon !',
    desc_en:'Koga, now in the Johto Elite Four, strikes from the shadows with new Pokémon!' },

  { id:'bruno_johto',       fr:'Aldo (Johto) !',              en:'Bruno (Johto)!',         icon:'💪',
    trainerKey:'bruno', chance:0.02, minRep:880,
    reward: { money:[9000,17000], rep:32, xpBonus:85 },
    desc_fr:'Aldo est de retour au Conseil 4, plus fort que jamais. Vous l\'affronton encore ?',
    desc_en:'Bruno is back in the Elite Four, stronger than ever. Dare you face him again?' },

  { id:'karen_appears',     fr:'Carole apparaît !',           en:'Karen Appears!',         icon:'🌑',
    trainerKey:'karen', chance:0.02, minRep:920,
    reward: { money:[10000,20000], rep:35, xpBonus:90 },
    desc_fr:'Carole du Conseil 4 arrive avec ses Ténèbres. \"Les forts ne s\'excusent pas.\"',
    desc_en:'Karen of the Elite Four arrives with her Dark-types. "Strong Pokémon need no excuses."' },

  { id:'lance_johto',       fr:'Peter — Champion de Johto !', en:'Lance — Johto Champion!',icon:'🐉',
    trainerKey:'lance', chance:0.015, minRep:980,
    reward: { money:[12000,25000], rep:50, xpBonus:120 },
    desc_fr:'Peter, Champion de la région de Johto, descend du Plateau Indigo pour vous défier !',
    desc_en:'Lance, Johto\'s Champion, descends from the Indigo Plateau to challenge you!' },

  // --- Red & Gold ---
  { id:'ethan_gold_appears',fr:'Éthan surgit !',              en:'Ethan Appears!',         icon:'🌟',
    trainerKey:'gold', chance:0.02, minRep:700,
    reward: { money:[6000,12000], rep:20, xpBonus:60 },
    desc_fr:'Éthan, le dresseur légendaire de New Bark Town, croise votre route.',
    desc_en:'Ethan, the legendary trainer from New Bark Town, crosses your path.' },

  { id:'red_at_summit',     fr:'Red au sommet !',             en:'Red at the Summit!',     icon:'🗻',
    trainerKey:'red', chance:0.01, minRep:1100,
    reward: { money:[20000,40000], rep:70, xpBonus:180 },
    desc_fr:'Red est au sommet du Mont Argenté, silencieux. Il accepte votre défi d\'un geste.',
    desc_en:'Red stands at the summit of Mt. Silver, silent. He accepts your challenge with a nod.' },

  // --- Légendaires (apparitions) ---
  { id:'lugia_emerges',     fr:'Lugia émerge des flots !',   en:'Lugia Emerges!',          icon:'🌊',
    trainerKey:null, chance:0.01, minRep:850,
    reward: { rareBoost:150000, shinyBoost:60000, chestBoost:60000 },
    desc_fr:'Lugia s\'élève des Îles Tourbillon ! Une aura mystique envahit la zone.',
    desc_en:'Lugia rises from the Whirl Islands! A mystical aura floods the area.' },

  { id:'hooh_flies_over',   fr:'Ho-Oh survole la région !',  en:'Ho-Oh Flies Over!',       icon:'🌈',
    trainerKey:null, chance:0.01, minRep:900,
    reward: { rareBoost:150000, shinyBoost:90000, eggGift:['ho-oh'] },
    desc_fr:'Un arc-en-ciel traverse le ciel — Ho-Oh passe au-dessus de Johto ! Les Pokémon Feu s\'éveillent.',
    desc_en:'A rainbow crosses the sky — Ho-Oh soars over Johto! Fire Pokémon awaken.' },

  { id:'celebi_whisper',    fr:'Murmure de Célébi !',        en:'Celebi\'s Whisper!',      icon:'🍃',
    trainerKey:null, chance:0.008, minRep:600,
    reward: { eggGift:['celebi'], rareBoost:120000, shinyBoost:60000 },
    desc_fr:'Un frisson traverse la forêt de Viridis... Célébi voyage dans le temps ici même.',
    desc_en:'A shiver runs through Ilex Forest... Celebi is time-traveling here.' },

  // --- Événements lore Johto ---
  { id:'kimono_girls_event',fr:'Filles Kimono !',             en:'Kimono Girls!',           icon:'🎎',
    trainerKey:null, chance:0.04, minRep:450,
    reward: { xpBonus:50, rareBoost:45000, chestBoost:30000 },
    desc_fr:'Les cinq Filles Kimono dansent à Ecorussie. Une énergie mystique réveille les Pokémon rares.',
    desc_en:'The five Kimono Girls dance in Ecruteak. Mystic energy awakens rare Pokémon.' },

  { id:'sudowoodo_appears', fr:'Faux-Faux-Boss bloque la route !', en:'Sudowoodo Blocks the Path!', icon:'🪨',
    trainerKey:null, chance:0.05, minRep:300,
    reward: { eggGift:['sudowoodo'], money:[1500,4000], rep:8 },
    desc_fr:'Un Faux-Faux-Boss mime un arbre et bloque le passage. Arrosez-le pour débloquer la zone.',
    desc_en:'A Sudowoodo mimics a tree and blocks the path. Water it to unlock the area.' },

  { id:'egg_from_oak',      fr:'Œuf du Prof. Chen !',         en:'Egg from Prof. Elm!',     icon:'🥚',
    trainerKey:null, chance:0.05, minRep:50,
    reward: { eggGift:['togepi'], xpBonus:20, chestBoost:20000 },
    desc_fr:'Le Prof. Orme vous confie un mystérieux œuf. On dirait qu\'il est sur le point d\'éclore.',
    desc_en:'Prof. Elm entrusts you with a mysterious egg. It looks about to hatch.' },

  { id:'crystal_onix',      fr:'Onix de Cristal !',           en:'Crystal Onix!',           icon:'💎',
    trainerKey:null, chance:0.02, minRep:500,
    reward: { eggGift:['steelix'], rareBoost:60000, shinyBoost:60000 },
    desc_fr:'Une légende : un Onix de cristal sommeille quelque part. Son éclat attire les shinies.',
    desc_en:'Legend speaks of a crystal Onix dormant somewhere. Its shine draws out shinies.' },

  { id:'rocket_broadcast',  fr:'Diffusion Rocket !',          en:'Rocket Broadcast!',       icon:'📡',
    trainerKey:'archer', chance:0.03, minRep:650,
    reward: { money:[5000,10000], rep:18, rareBoost:30000 },
    desc_fr:'La Team Rocket pirate les ondes radio pour appeler Giovanni. Coupez la transmission !',
    desc_en:'Team Rocket hijacks the radio waves to call Giovanni. Cut the transmission!' },

  // --- Zones spécifiques ---
  { id:'ruins_alph_signal', fr:'Signal des Ruines !',         en:'Ruins Signal!',           icon:'🔣',
    trainerKey:null, chance:0.06, minRep:150,
    zoneIds:['ruins_of_alph'],
    reward:{ rareBoost:60000, shinyBoost:30000, eggGift:['unown'] },
    desc_fr:'Les symboles Zarbi s\'illuminent dans les Ruines d\'Alph... Un signal mystérieux apparaît.',
    desc_en:'Unown symbols light up in the Ruins of Alph... A mysterious signal appears.' },

  { id:'burned_beast_run',  fr:'Pokémon Bestial Aperçu !',   en:'Beast Pokémon Spotted!',   icon:'🐆',
    trainerKey:null, chance:0.04, minRep:300,
    zoneIds:['burned_tower','route36_37','route42_43'],
    reward:{ rareBoost:120000, shinyBoost:45000 },
    desc_fr:'Un Pokémon Bestial a été aperçu dans la zone ! Il court — vite !',
    desc_en:'A Beast Pokémon was spotted in the area! It runs — fast!' },

  { id:'dragon_den_ritual', fr:'Rituel de l\'Antre !',       en:'Dragon\'s Den Ritual!',    icon:'🐉',
    trainerKey:'clair', chance:0.03, minRep:800,
    zoneIds:['dragons_den','blackthorn_gym'],
    reward:{ money:[8000,16000], rep:28, eggGift:['dratini'], xpBonus:70 },
    desc_fr:'Un antique rituel de dresseurs de Dragons se tient dans l\'Antre. Cathy vous y invite.',
    desc_en:'An ancient Dragon Tamer ritual takes place in the Den. Clair invites you in.' },

  { id:'ecruteak_haunting', fr:'Hantise d\'Ecorussie !',     en:'Ecruteak Haunting!',       icon:'🏮',
    trainerKey:null, chance:0.05, minRep:350,
    zoneIds:['ecruteak_gym','burned_tower'],
    reward:{ shinyBoost:75000, rareBoost:45000 },
    desc_fr:'Une nuit sans lune à Ecorussie. Les Pokémon Spectre envahissent la Tour Cramée.',
    desc_en:'A moonless night in Ecruteak. Ghost Pokémon flood the Burned Tower.' },

];

// ── Musiques par zone Johto ───────────────────────────────────
// Réutilise les clés de ZONE_MUSIC_MAP existantes dans zones-data.js
// Ajoutez des pistes Johto dans game/music/ si besoin puis étendez ici.
const ZONE_MUSIC_MAP_JOHTO = {
  johto_gang_hq:      'city',
  // Routes
  route29:            'forest',
  route30_31:         'forest',
  route36_37:         'forest',
  route42_43:         'forest',
  route44_45_46:      'forest',
  // Grottes & montagne
  dark_cave:          'cave',
  mt_mortar:          'cave',
  ice_path:           'cave',
  mt_silver_johto:    'elite4',
  mt_silver_summit:   'elite4',
  // Forêt
  ilex_forest:        'forest',
  // Villes / arènes
  violet_gym:         'gym',
  azalea_gym:         'gym',
  goldenrod_gym:      'city',
  ecruteak_gym:       'gym',
  cianwood_gym:       'gym',
  olivine_gym:        'gym',
  mahogany_gym:       'gym',
  blackthorn_gym:     'gym',
  indigo_johto:       'elite4',
  // Lieux spéciaux
  slowpoke_well:      'cave',
  ruins_of_alph:      'cave',
  national_park:      'safari',
  burned_tower:       'mansion',
  team_rocket_hq:     'silph',
  radio_tower:        'silph',
  dragons_den:        'cave',
  safari_johto:       'safari',
  // Légendaires
  whirl_islands:      'sea',
  tin_tower:          'elite4',
};

// ── Index rapide Johto ────────────────────────────────────────
const ZONE_JOHTO_BY_ID = {};
ZONES_JOHTO.forEach(z => ZONE_JOHTO_BY_ID[z.id] = z);
