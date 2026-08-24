'use strict';

// ════════════════════════════════════════════════════════════════
//  Onboarding V2 — contenu du tunnel de première session
//
//  Le joueur commence sur un terrain qu'il ne connaît pas, capture
//  librement, se fait tomber dessus par des sbires Rocket, puis
//  apprend que le terrain appartient à Giovanni. Un transfuge Rocket
//  le prend ensuite en main et sert de guide diégétique — pas
//  d'objectifs abstraits, c'est lui qui demande chaque action.
// ════════════════════════════════════════════════════════════════

/** Zone de départ — définie dans data/zones-data.js, masquée une fois l'onboarding terminé. */
export const ONBOARDING_ZONE_ID = 'unknown_field';

/**
 * Trio du choix diégétique de départ (issue #76) : les trois apparaissent
 * simultanément sur le terrain au tout premier affichage de la zone
 * (modules/ui/onboarding.js:_spawnStarterChoice), la capture de l'un fait
 * disparaître les deux autres. Également utilisé par openStarterGiftPopup
 * (modules/ui/intro.js), le rattrapage pour les saves initialisées avant
 * que l'intro n'existe et qui n'ont jamais reçu de Pokémon de départ.
 */
export const ONBOARDING_STARTERS = [
  {
    en: 'meowth', fr: 'Miaous', nameEn: 'Meowth', dex: 52,
    types: ['Normal'], typesEn: ['Normal'],
    desc: 'Agile et opportuniste.\nMaître des combines.',
    descEn: 'Agile and opportunistic.\nMaster of the hustle.',
    icon: '🪙',
  },
  {
    en: 'zubat', fr: 'Nosferapti', nameEn: 'Zubat', dex: 41,
    types: ['Poison', 'Vol'], typesEn: ['Poison', 'Flying'],
    desc: "Discret et tenace.\nIl voit dans l'ombre.",
    descEn: 'Stealthy and relentless.\nIt sees in the dark.',
    icon: '🦇',
  },
  {
    en: 'gastly', fr: 'Fantominus', nameEn: 'Gastly', dex: 92,
    types: ['Spectre', 'Poison'], typesEn: ['Ghost', 'Poison'],
    desc: 'Insaisissable.\nSème la panique.',
    descEn: 'Elusive.\nSpreads panic.',
    icon: '👻',
  },
];

/**
 * Captures avant que l'embuscade Rocket ne se déclenche. Volontairement
 * généreux : le Boss peut aligner 6 Pokémon et le transfuge en réclame un,
 * donc le joueur doit sortir de cette zone avec de quoi jouer. La zone a un
 * spawnRate très élevé (cf. zones-data.js) pour que ça reste rapide.
 */
export const ONBOARDING_CAPTURE_GOAL = 10;

/** Sbires de l'embuscade — plusieurs, donc difficile à gagner par design. */
export const ONBOARDING_AMBUSH_GRUNTS = 3;

/**
 * Recrues possibles de l'embuscade. Volontairement « bas de l'échelle » :
 * jamais les admins (archer/ariana/proton), qui n'auraient aucune raison de
 * déserter pour suivre un inconnu. Le transfuge est l'un des assaillants, donc
 * le joueur choisit parmi ceux qui viennent de lui tomber dessus — pas dans un
 * catalogue déconnecté de la scène.
 *
 * `key` est une clé de SPRITE (dossier trainers de Showdown), pas une clé
 * TRAINER_TYPES : la moitié de ces classes Gen 1 (burglar, cueball, gambler,
 * tamer, rocker) n'existe pas dans le registre des types de dresseurs. `trainer`
 * dit donc sous quel type ils se battent — tous du muscle Rocket, quel que soit
 * le costume. Sans cette distinction, planter ces clés dans raidTrainers[].key
 * les ferait retomber sur le dresseur de repli de la zone.
 */
export const ONBOARDING_AMBUSH_SPRITE_POOL = [
  { key: 'rocketgrunt',  trainer: 'rocketgrunt',  fr: 'Sbire',        en: 'Grunt'     },
  { key: 'rocketgruntf', trainer: 'rocketgruntf', fr: 'Sbire',        en: 'Grunt'     },
  { key: 'scientist',    trainer: 'scientist',    fr: 'Scientifique', en: 'Scientist' },
  { key: 'burglar',      trainer: 'rocketgrunt',  fr: 'Voleur',       en: 'Burglar'   },
  { key: 'cueball',      trainer: 'rocketgrunt',  fr: 'Malabar',      en: 'Cue Ball'  },
  { key: 'gambler',      trainer: 'rocketgrunt',  fr: 'Joueur',       en: 'Gambler'   },
  { key: 'tamer',        trainer: 'rocketgrunt',  fr: 'Dresseur',     en: 'Tamer'     },
  { key: 'rocker',       trainer: 'rocketgrunt',  fr: 'Rockeur',      en: 'Rocker'    },
];

/** Type de dresseur de repli si une entrée du pool perd son `trainer`. */
export const ONBOARDING_AMBUSH_TRAINER_KEY = 'rocketgrunt';

/** Retrouve les entrées du pool derrière les clés persistées dans la save. */
export function resolveAmbushSprites(keys) {
  const byKey = new Map(ONBOARDING_AMBUSH_SPRITE_POOL.map(entry => [entry.key, entry]));
  return (keys || []).map(key => byKey.get(key)).filter(Boolean);
}

/**
 * Traduit le tirage persisté en roster de raid : `key` reste une clé
 * TRAINER_TYPES (stats, récompenses), `sprite` porte le visage effectivement
 * affiché. C'est ce qui garantit que les assaillants montrés à l'écran sont
 * exactement les candidats proposés ensuite au ralliement.
 */
export function buildAmbushRoster(keys) {
  return resolveAmbushSprites(keys).map(entry => ({
    key: entry.trainer || ONBOARDING_AMBUSH_TRAINER_KEY,
    sprite: entry.key,
    fr: entry.fr,
    en: entry.en,
  }));
}

/** Tire le trio d'assaillants d'une partie — set différent à chaque run. */
export function pickAmbushSprites(count = ONBOARDING_AMBUSH_GRUNTS, random = Math.random) {
  const pool = [...ONBOARDING_AMBUSH_SPRITE_POOL];
  const picked = [];
  const wanted = Math.max(1, Math.min(count, pool.length));
  while (picked.length < wanted) {
    picked.push(...pool.splice(Math.floor(random() * pool.length), 1));
  }
  return picked;
}

/**
 * Répliques du guide. Chaque entrée correspond à une étape de l'onboarding :
 * le sprite du transfuge reste planté sur la zone et porte la bulle courante
 * tant que l'action demandée n'est pas faite.
 */
export const ONBOARDING_GUIDE_LINES = {
  met: {
    fr: "Attends ! Me dénonce pas… J'en ai fini avec la Team Rocket. Ils m'ont laissé sur ce terrain comme un chien de garde.",
    en: "Wait! Don't turn me in… I'm done with Team Rocket. They left me on this field like a guard dog.",
  },
  metFollowUp: {
    fr: "Prends-moi avec toi. Je connais leurs méthodes — je peux t'être utile.",
    en: "Take me with you. I know how they operate — I can be useful.",
  },
  team: {
    fr: "Confie-moi un Pokémon solide. Les mains vides, je te sers à rien.",
    en: "Hand me a solid Pokémon. Empty-handed I'm no use to you.",
  },
  zone: {
    fr: "Maintenant assigne-moi à une zone. Je te ramènerai des captures pendant que tu fais autre chose.",
    en: "Now assign me to a zone. I'll bring back catches while you do other things.",
  },
  combat: {
    fr: "Je me sens assez fort pour affronter du monde. Active mon option de combat, je m'occupe des dresseurs.",
    en: "I feel strong enough to take people on. Switch on my battle option and I'll handle the trainers.",
  },
  done: {
    fr: "C'est parti, boss. Je bosse pour toi maintenant.",
    en: "Here we go, boss. I work for you now.",
  },
};

/** Répliques des sbires pendant l'embuscade. */
export const ONBOARDING_AMBUSH_LINES = {
  intro: {
    fr: "Hé ! Personne ne chasse sur ce terrain. Il appartient à quelqu'un.",
    en: "Hey! Nobody hunts on this field. It belongs to someone.",
  },
  // Le joueur vient de sortir son premier Pokémon : la réplique se moque de
  // ce geste, juste avant que les renforts n'entrent en scène.
  taunt: {
    fr: "Parce que tu penses pouvoir te défendre face à nous !",
    en: "You think you can defend yourself against us!",
  },
  lost: {
    fr: "Tu vois ? On est trop nombreux pour toi. Allez, on l'emmène au patron.",
    en: "See? Too many of us for you. Come on, we're taking them to the boss.",
  },
  won: {
    fr: "Impossible… tu nous as tous mis au tapis ? Le patron va vouloir te voir.",
    en: "Impossible… you took all of us down? The boss is going to want to see you.",
  },
};

/**
 * Giovanni arrive en personne sur le terrain avant que son écran d'identité ne
 * s'ouvre : ses répliques s'enchaînent une par une, chacune portée par la bulle
 * au-dessus de son sprite. `arrival` a une variante pour le joueur qui gagne
 * l'embuscade — rare, mais la scène ne doit pas lui parler d'une défaite.
 */
export const ONBOARDING_GIOVANNI_LINES = {
  arrival: {
    fr: "Laissez-le. C'est donc toi qui chasses sur mes terres.",
    en: "Leave them. So you're the one hunting on my land.",
  },
  arrivalWon: {
    fr: "Laissez-le. Trois de mes hommes au tapis… et toi encore debout.",
    en: "Leave them. Three of my men down… and you still standing.",
  },
  claim: {
    fr: "Ce terrain m'appartient. Comme tout ce qui traîne dessus.",
    en: "This field belongs to me. Like everything else lying around on it.",
  },
  offer: {
    fr: "Mais tu as du cran. Assez pour monter ton propre gang — sous mon nom. Dis-moi qui tu es.",
    en: "But you've got nerve. Enough to run your own gang — under my name. Tell me who you are.",
  },
  farewell: {
    fr: "Le reste, tu te débrouilles. Ne me déçois pas.",
    en: "The rest is on you. Don't disappoint me.",
  },
};

/**
 * Slides du briefing de bienvenue (issue #76) — écran dédié affiché une fois
 * avant l'ouverture du terrain pour un nouveau joueur itch, avant même que
 * l'onboarding V2 ne démarre (aucune étape de state.onboarding ne lui
 * correspond, cf. modules/ui/onboardingBriefing.js). La 3e slide met la vente
 * du surplus en avant-plan — boucle capturer → trier → vendre → réinvestir →
 * conquérir — sans jamais forcer une vente réelle : c'est de la copie
 * narrative pure, aucune action n'y est câblée. La dernière slide enchaîne
 * directement sur l'ouverture du terrain, sans bouton supplémentaire.
 */
export const ONBOARDING_BRIEFING_SLIDES = [
  {
    id: 'lead',
    fr: { title: 'DIRIGE TON GANG', body: 'Conquiers des territoires et développe ta réputation.' },
    en: { title: 'LEAD YOUR GANG', body: 'Conquer territories and build your reputation.' },
  },
  {
    id: 'capture',
    fr: { title: 'CAPTURE DES POKÉMON', body: 'Garde les meilleurs pour tes équipes et ton Pokédex.' },
    en: { title: 'CATCH POKÉMON', body: 'Keep the best for your teams and your Pokédex.' },
  },
  {
    id: 'sell',
    fr: {
      title: 'VENDS LE SURPLUS',
      body: "Les Pokémon dont tu n'as pas besoin deviennent une source majeure de ₽ pour développer ton gang, acheter du matériel et accélérer ta progression.",
    },
    en: {
      title: 'SELL THE SURPLUS',
      body: 'Pokémon you don\'t need become a major source of ₽ to grow your gang, buy gear, and speed up your progress.',
    },
  },
  {
    id: 'recruit',
    fr: { title: 'RECRUTE DES AGENTS', body: 'Confie-leur des Pokémon et des zones ; ils capturent et combattent aussi pendant ton absence.' },
    en: { title: 'RECRUIT AGENTS', body: "Hand them Pokémon and zones — they capture and fight even while you're away." },
  },
  {
    id: 'watch',
    fr: { title: 'ATTENTION…', body: "Quelque chose bouge dans l'herbe." },
    en: { title: 'WATCH OUT…', body: 'Something is moving in the grass.' },
  },
];
