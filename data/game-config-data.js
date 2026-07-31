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
  // Gen 2 / Johto — archétypes dédiés
  'boarder','kimonogirl','firebreather','guitarist','sage',
  'twins','schoolkid','skier','medium','officer',
  'acetrainerGen2','acetrainerFGen2','beautyGen2','bikerGen2','hikerGen2',
  'jugglerGen2','psychicGen2','pokemaniacGen2','birdkeeperGen2','bugcatcherGen2','camperGen2','gentlemanGen2',
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

// Multiplicateur appliqué à la somme des puissances Pokémon de l'agent.
// Formula : agentPower = sum(pokemonPower) × TITLE_BONUSES[grade]
// Slots Pokémon : grunt=1, sergent=2, lieutenant+=3 (géré dans getAgentTeamSlots)
const TITLE_BONUSES = {
  grunt:      0.9,   // léger malus — pas encore formé
  sergent:    1.0,   // référence neutre
  lieutenant: 1.1,   // +10 %
  commandant: 1.2,   // +20 %
  general:    1.35,  // +35 %
  elite:      1.5,   // +50 % (4 max par gang)
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

// ── Gang / UI limits ─────────────────────────────────────────
const BOSS_TEAM_SLOTS      = 6;  // équipe du boss : 6 Pokémon
const SHOWCASE_SLOTS       = 6;  // emplacements vitrine du boss
const MAX_BOSS_NAME_LENGTH = 16; // caractères max pour le nom du boss
const MAX_GANG_NAME_LENGTH = 24; // caractères max pour le nom du gang

// ── Pokédex ranges ───────────────────────────────────────────
const KANTO_DEX_MIN = 1;
const KANTO_DEX_MAX = 151;
const JOHTO_DEX_MIN = 152;
const JOHTO_DEX_MAX = 251;

// ── Chroma Charm ─────────────────────────────────────────────
const CHROMA_CHARM_COST = 10_000_000; // ₽ — milestone qui déclenche l'obtention du charme

export {
  NATURES, NATURE_KEYS, BOSS_SPRITES,
  AGENT_NAMES_M, AGENT_NAMES_F, AGENT_SPRITES, AGENT_PERSONALITIES,
  TITLE_REQUIREMENTS, TITLE_BONUSES, AGENT_RANK_LABELS, RANK_CHAIN,
  BOSS_TEAM_SLOTS, SHOWCASE_SLOTS, MAX_BOSS_NAME_LENGTH, MAX_GANG_NAME_LENGTH,
  KANTO_DEX_MIN, KANTO_DEX_MAX, JOHTO_DEX_MIN, JOHTO_DEX_MAX,
  CHROMA_CHARM_COST,
};
