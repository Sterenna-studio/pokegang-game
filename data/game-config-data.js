/* Game config constants extracted from app.js */

const NATURES = {
  hardy:   { fr:'Hardi',    en:'Hardy',   atk:1,   def:1,   spd:1   },
  brave:   { fr:'Brave',    en:'Brave',   atk:1.1, def:1,   spd:0.9 },
  timid:   { fr:'Timide',   en:'Timid',   atk:0.9, def:1,   spd:1.1 },
  bold:    { fr:'Assuré',   en:'Bold',    atk:0.9, def:1.1, spd:1   },
  jolly:   { fr:'Jovial',   en:'Jolly',   atk:1,   def:0.9, spd:1.1 },
  adamant: { fr:'Rigide',   en:'Adamant', atk:1.1, def:1,   spd:0.9 },
  calm:    { fr:'Calme',    en:'Calm',    atk:1,   def:1.1, spd:0.9 },
  modest:  { fr:'Modeste',  en:'Modest',  atk:0.9, def:1,   spd:1.1 },
  careful: { fr:'Prudent', en:'Careful', atk:1,   def:1.1, spd:0.9 },
  naive:   { fr:'Naïf',     en:'Naive',   atk:1,   def:0.9, spd:1.1 },
};
const NATURE_KEYS = Object.keys(NATURES);

// ── Boss sprites to pick from ─────────────────────────────────
const BOSS_SPRITES = [
  // Kanto Gym Leaders
  'brock','misty','ltsurge','erika','koga','sabrina','blaine','giovanni',
  // Kanto Elite Four + Rivals
  'lorelei','bruno','agatha','lance','blue','red','silver','oak',
  // Team Rocket
  'archer','ariana','proton','scientist','rocketexecutive','teamrocket',
  // Johto Gym Leaders
  'falkner','bugsy','whitney','morty','chuck','jasmine','pryce','clair',
  // Johto Elite Four
  'will','karen',
  // Hoenn Gym Leaders
  'roxanne','brawly','wattson','flannery','norman','winona','tate','liza','juan',
  // Hoenn Elite Four + Champion
  'sidney','phoebe','glacia','drake','steven','wallace',
  // Hoenn gang/faction bosses
  'archieGen3','archieGen6','maxieGen3','maxieGen6','matt','shelly','courtney','tabitha',
  // Sinnoh Gym Leaders
  'roark','gardenia','maylene','fantina','byron','candice','volkner',
  // Sinnoh Elite Four + Champion
  'aaron','bertha','flint','lucian','cynthia',
  // Sinnoh gang/faction bosses
  'cyrus','mars','jupiter','saturn','charon',
  // Unova
  'n','ghetsis','iris','drayden','cheren','bianca','colress',
];

// ── Agent name pools ──────────────────────────────────────────
const AGENT_NAMES_M = ['Marco','Léo','Jin','Viktor','Dante','Axel','Zane','Kai','Nero','Blaze','Rex','Ash','Saul','Ren','Hugo'];
const AGENT_NAMES_F = ['Mira','Luna','Jade','Nova','Aria','Ivy','Nyx','Zara','Kira','Elsa','Rosa','Saki','Lena','Yuki','Tess'];
const AGENT_SPRITES = [
  // Team Rocket
  'rocketgrunt','rocketgruntf','scientist','archer','ariana','proton',
  // Common trainers
  'camper','picnicker','acetrainer','acetrainerf',
  'youngster','lass','bugcatcher','hiker','fisherman','beauty','blackbelt',
  'swimmer','swimmerf','psychic','psychicf','gentleman','gambler',
  'juggler','burglar','channeler','birdkeeper','cueball','tamer','rocker',
  // Kanto/Johto misc
  'cooltrainer','cooltrainerf','pokefan','pokefanf',
  // Hoenn / Gen 3 — gangs rivaux, économie, terrain
  'aquaGruntM','aquaGruntF','magmaGruntM','magmaGruntF',
  'aquaGruntMGen3','aquaGruntFGen3','magmaGruntMGen3','magmaGruntFGen3',
  'collectorGen3','interviewersGen3','richBoyGen3','engineerGen3','burglarGen3',
  'pokemonRangerGen3','pokemonRangerFGen3','triathleteBikerMGen3','triathleteRunnerMGen3','triathleteSwimmerMGen3',
  // Sinnoh / Gen 4 — Galactic, police, logistique, vétérans
  'galacticGruntM','galacticGruntF','policemanGen4','workerGen4','scientistGen4','collectorGen4',
  'cyclistGen4','cyclistFGen4','burglarGen4','richBoyGen4','socialiteGen4',
  'veteranGen4','veteranFGen4','battleGirlGen4','reporterGen4',
  // Forces de l'ordre
  'pokemonranger','pokemonrangerf','policeman',
];
const AGENT_PERSONALITIES = ['loyal','nervous','reckless','calm','cunning','lazy','fierce','quiet','greedy','brave','curious','stubborn'];

// ── Nouveau système de grades (v2) ────────────────────────────
// Progression séquentielle : grunt → sergent → lieutenant → commandant → élite/général
// Élite [gang] : les 4 premiers à atteindre le niveau 100
// Général [gang] : tous ceux qui suivent
const TITLE_REQUIREMENTS = {
  sergent:    { level: 25 },
  lieutenant: { level: 50 },
  commandant: { level: 75 },
  elite:      { level: 100 },
  general:    { level: 100 },
};

// Bonus de puissance de combat par grade
const TITLE_BONUSES = {
  grunt:      0,
  sergent:    0.08,
  lieutenant: 0.18,
  commandant: 0.30,
  elite:      0.45,
  general:    0.40,
};

// Labels d'affichage par grade (FR / EN)
// Pour 'elite' et 'general', le nom du gang est ajouté dynamiquement
const AGENT_RANK_LABELS = {
  grunt:      { fr: 'Grunt',      en: 'Grunt'      },
  sergent:    { fr: 'Sergent',    en: 'Sergeant'   },
  lieutenant: { fr: 'Lieutenant', en: 'Lieutenant' },
  commandant: { fr: 'Commandant', en: 'Commander'  },
  elite:      { fr: 'Élite',      en: 'Elite'      },
  general:    { fr: 'Général',    en: 'General'    },
};

// Chaîne ordonnée des grades (hors élite/général qui sont des variantes du dernier palier)
const RANK_CHAIN = ['grunt', 'sergent', 'lieutenant', 'commandant'];

// ── Atouts d'agent (perks) ─────────────────────────────────────────────────────
// Toutes les 10 niveaux, l'agent peut choisir un atout parmi 3 propositions.
// effect : "type:valeur" ou "type:sous-type:valeur"
//   capture_type:<pokéType>:<bonus%>  → % de chance supplémentaire de capturer ce type
//   shiny:<bonus%>                    → % multiplicatif de chance shiny
//   combat:<bonus%>                   → % puissance de combat
//   chest_loot:<bonus%>               → % loot coffres supplémentaire
//   money:<bonus%>                    → % argent des combats
//   capture_potential:<n>             → +n étoiles potentiel sur capture
//   ball_recovery:<prob>              → probabilité de récupérer la ball après capture
//   encounter_rare:<bonus%>           → % chance de spawn rare
const AGENT_PERKS = [
  // ── Affinités de types ──
  { id:'fire_affinity',    fr:'Instinct du Feu',     icon:'🔥', desc:'+30% capture Feu',        effect:'capture_type:fire:0.30'    },
  { id:'water_affinity',   fr:'Instinct de l\'Eau',  icon:'💧', desc:'+30% capture Eau',        effect:'capture_type:water:0.30'   },
  { id:'grass_affinity',   fr:'Instinct Plante',     icon:'🌿', desc:'+30% capture Plante',     effect:'capture_type:grass:0.30'   },
  { id:'electric_affinity',fr:'Instinct Électrik',   icon:'⚡', desc:'+30% capture Électrik',   effect:'capture_type:electric:0.30'},
  { id:'psychic_eye',      fr:'Vision Psionique',    icon:'🔮', desc:'+30% capture Psy',        effect:'capture_type:psychic:0.30' },
  { id:'ghost_affinity',   fr:'Instinct Spectre',    icon:'👻', desc:'+30% capture Spectre',    effect:'capture_type:ghost:0.30'   },
  { id:'dragon_pact',      fr:'Pacte du Dragon',     icon:'🐉', desc:'+40% capture Dragon',     effect:'capture_type:dragon:0.40'  },
  { id:'ice_touch',        fr:'Contact Glace',       icon:'❄️', desc:'+30% capture Glace',      effect:'capture_type:ice:0.30'     },
  { id:'dark_instinct',    fr:'Instinct des Ténèbres',icon:'🌑',desc:'+30% capture Ténèbres',   effect:'capture_type:dark:0.30'    },
  // ── Qualité des rencontres ──
  { id:'lucky_find',       fr:'Sixième Sens',        icon:'⭐', desc:'+25% rencontres rares',   effect:'encounter_rare:0.25'       },
  { id:'shiny_radar',      fr:'Radar Shiny',         icon:'✨', desc:'+100% chance shiny',      effect:'shiny:1.00'                },
  { id:'potential_eye',    fr:'Œil du Potentiel',    icon:'👁', desc:'+1 ★ sur chaque capture', effect:'capture_potential:1'       },
  { id:'ball_recovery',    fr:'Récup. Poké Ball',    icon:'🟣', desc:'20% récupérer la ball',   effect:'ball_recovery:0.20'        },
  // ── Combat ──
  { id:'combat_focus',     fr:'Concentration',       icon:'⚔️', desc:'+25% puissance de combat', effect:'combat:0.25'              },
  { id:'intimidation',     fr:'Intimidation',        icon:'😤', desc:'-15% difficulté dresseurs',effect:'trainer_debuff:0.15'      },
  // ── Économie ──
  { id:'treasure_hunter',  fr:'Chasseur de Trésors', icon:'📦', desc:'+50% loot des coffres',   effect:'chest_loot:0.50'           },
  { id:'money_sense',      fr:'Flair du Fric',       icon:'💰', desc:'+30% argent des combats', effect:'money:0.30'                },
];

export { NATURES, NATURE_KEYS, BOSS_SPRITES, AGENT_NAMES_M, AGENT_NAMES_F, AGENT_SPRITES, AGENT_PERSONALITIES, TITLE_REQUIREMENTS, TITLE_BONUSES, AGENT_RANK_LABELS, RANK_CHAIN, AGENT_PERKS };
