'use strict';

// ════════════════════════════════════════════════════════════════
//  advisor-data.js — les répliques du transfuge, après le tunnel
//
//  À la fin de l'onboarding, le transfuge quittait l'écran pour de bon et la
//  narration s'arrêtait net : Giovanni avait fondé le gang, l'agent était
//  posté, puis plus personne ne parlait — le HUD reprenait avec des consignes
//  purement mécaniques (« Complète ton équipe Boss »). Celui qui a raconté le
//  début reste donc à l'écran comme conseiller.
//
//  Chaque clé correspond à un `id` d'objectif renvoyé par getNextObjective()
//  (modules/systems/sessionObjectives.js). Sa voix : ex-sbire Rocket, direct,
//  un peu rêche, loyal — le prolongement de ONBOARDING_GUIDE_LINES, jamais du
//  ton d'un tutoriel.
//
//  `{zone}` est remplacé par le nom de la zone visée.
// ════════════════════════════════════════════════════════════════

const ADVISOR_LINES = {
  first_catch: {
    fr: "Un gang sans Pokémon, c'est juste des types qui traînent. Va en attraper.",
    en: "A gang with no Pokémon is just guys loitering. Go catch some.",
  },
  boss_team_empty: {
    fr: "Tu comptes aller au front les mains vides ? Mets au moins un Pokémon dans ton équipe.",
    en: "You planning to walk in empty-handed? Put at least one Pokémon on your team.",
  },
  boss_team_partial: {
    fr: "Trois Pokémon, c'est le minimum pour pas rentrer à pied. Complète.",
    en: "Three Pokémon is the minimum if you don't want to walk home. Fill it out.",
  },
  first_agent: {
    fr: "Je peux pas ratisser tout Kanto tout seul. Trouve-moi du renfort.",
    en: "I can't sweep all of Kanto by myself. Get me some backup.",
  },
  unlock_zone: {
    fr: "{zone} est encore fermé. Fais-toi un nom, la porte s'ouvrira toute seule.",
    en: "{zone} is still shut. Make a name for yourself and the door opens on its own.",
  },
  more_agents: {
    fr: "Plus on est nombreux, plus on ratisse large. Trois gars, c'est un vrai gang.",
    en: "The more of us there are, the wider we sweep. Three guys is an actual gang.",
  },
  pokedex: {
    fr: "Le patron aime les collections complètes. Ça se saurait si c'était rapide.",
    en: "The boss likes complete collections. Nobody said it'd be quick.",
  },
  kanto_done: {
    fr: "Kanto est à nous. J'aurais jamais cru dire ça en gardant ce terrain.",
    en: "Kanto's ours. Never thought I'd say that back when I was guarding that field.",
  },
};

/** Réplique de repli quand un objectif n'a pas encore de ligne dédiée. */
const ADVISOR_FALLBACK = {
  fr: "On avance. Regarde l'objectif en haut, je te suis.",
  en: "We're making progress. Check the objective up top, I'm right behind you.",
};

/** Ce qu'il dit quand on le sollicite sans qu'il ait rien de neuf. */
const ADVISOR_IDLE = {
  fr: "Rien de neuf de mon côté, boss.",
  en: "Nothing new on my end, boss.",
};

const ADVISOR_COPY = {
  title:   { fr: 'Ton bras droit', en: 'Your right hand' },
  dismiss: { fr: 'Compris', en: 'Got it' },
};

export { ADVISOR_LINES, ADVISOR_FALLBACK, ADVISOR_IDLE, ADVISOR_COPY };
