'use strict';

// ════════════════════════════════════════════════════════════════
//  Déblocage progressif des onglets — règles et libellés
//
//  L'onboarding V2 masque tout sauf l'onglet dont le tunnel a besoin
//  (getOnboardingTabAccess). À la sortie, onze onglets réapparaissaient d'un
//  coup — y compris le Marché que la carte de fin annonce pourtant comme un
//  « nouveau déblocage ». Ces règles étalent la révélation.
//
//  Principe : un onglet s'ouvre quand le joueur a une RAISON et les MOYENS de
//  s'en servir, et il ne doit jamais s'ouvrir sur un écran vide. Les seuils
//  sont calés sur l'état réel de fin de tunnel — ≈11 Pokémon, 5 500 ₽
//  (5 000 de départ + 500 de récompense), 1 agent posté, 2ᵉ agent à 15 000 ₽.
//
//  La logique vit dans modules/systems/tabUnlocks.js ; ce fichier ne contient
//  que des constantes, pour que state/migrateSave.js puisse s'y référer sans
//  dépendre d'un module système.
// ════════════════════════════════════════════════════════════════

/** Onglets acquis d'office : le tunnel les a déjà tous fait manipuler. */
const BASE_TABS = Object.freeze(['tabZones', 'tabPC', 'tabAgents', 'tabGang']);

/**
 * Ordre et déclencheurs. `rule` est interprété par evaluateTabUnlocks().
 *
 *   Marché      fin du tunnel      5 500 ₽ = leurres/encens, tous des boosts
 *                                  de CAPTURE, le geste qu'il vient d'apprendre
 *   Pokédex     1 capture          11/151 déjà remplis, rien à payer
 *   Missions    5 captures         arrive avec une quête déjà réclamable
 *                                  (baseline journalier figé à zéro au départ)
 *   Évts        1 opé d'agent      seul onglet dont le contenu n'existe
 *                                  qu'après ; il prouve la promesse idle
 *   Raids       50 de réputation   injouable avec une seule équipe
 *   Classement  100 de réputation  n'a de sens qu'avec un score à comparer
 *   Compte      2ᵉ session         « tu reviens » = le bon moment pour
 *                                  proposer de sécuriser la progression
 */
const TAB_UNLOCK_RULES = Object.freeze([
  { tab: 'tabMarket',      rule: 'onboarding',  threshold: 0   },
  { tab: 'tabPokedex',     rule: 'captures',    threshold: 1   },
  { tab: 'tabMissions',    rule: 'captures',    threshold: 5   },
  { tab: 'tabBattleLog',   rule: 'agentOps',    threshold: 1   },
  { tab: 'tabCompetition', rule: 'reputation',  threshold: 50  },
  { tab: 'tabLeaderboard', rule: 'reputation',  threshold: 100 },
  { tab: 'tabCompte',      rule: 'sessions',    threshold: 1   },
]);

const UNLOCKABLE_TABS = Object.freeze(TAB_UNLOCK_RULES.map(entry => entry.tab));

/** Libellé + raison, affichés par la carte de déblocage. */
const TAB_UNLOCK_COPY = Object.freeze({
  tabMarket:      { fr: 'Marché',     en: 'Market',
    whyFr: 'Dépense tes pokédollars contre des ressources — et jette un œil au Marché Noir, pour les missions moins recommandables.',
    whyEn: 'Spend your pokédollars on resources — and check out the Black Market, for the less reputable jobs.' },
  tabPokedex:     { fr: 'Pokédex',    en: 'Pokédex',
    whyFr: 'Ta collection se remplit à chaque capture.',
    whyEn: 'Your collection fills up with every catch.' },
  tabMissions:    { fr: 'Missions',   en: 'Missions',
    whyFr: 'Des objectifs qui paient — tu en as déjà terminé.',
    whyEn: 'Objectives that pay — you have already cleared some.' },
  tabBattleLog:   { fr: 'Événements', en: 'Events',
    whyFr: 'Le journal de ce que tes agents font sans toi.',
    whyEn: 'The log of what your agents do without you.' },
  tabCompetition: { fr: 'Raids',      en: 'Raids',
    whyFr: 'Ton gang est assez solide pour attaquer les autres.',
    whyEn: 'Your gang is strong enough to raid the others.' },
  tabLeaderboard: { fr: 'Classement', en: 'Leaderboard',
    whyFr: 'Compare ta réputation à celle des autres boss.',
    whyEn: 'Compare your reputation with the other bosses.' },
  tabCompte:      { fr: 'Compte',     en: 'Account',
    whyFr: 'Sauvegarde ta progression dans le cloud.',
    whyEn: 'Back your progress up to the cloud.' },
});

export { BASE_TABS, TAB_UNLOCK_RULES, UNLOCKABLE_TABS, TAB_UNLOCK_COPY };
