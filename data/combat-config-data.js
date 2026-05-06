/* Combat config extracted from app.js */

// Trainers qui donnent +10 rep (gym leaders, Elite 4, personnages d'histoire)
const SPECIAL_TRAINER_KEYS = new Set([
  'brock','misty','ltsurge','erika','koga','sabrina','blaine',  // arènes
  'lorelei','bruno','agatha','lance',                             // Conseil des 4
  'falkner','bugsy','whitney','morty','chuck','jasmine','pryce','clair', // arènes Johto
  'will','karen',                                                  // Conseil des 4 Johto
  'blue','red','oak','giovanni',                                  // personnages d'histoire
  'archer','ariana','proton',                                      // exécutifs Rocket
  'silver','gold',                                                 // personnages d'histoire Johto
]);

const MAX_COMBAT_REWARD = 5000;

export { SPECIAL_TRAINER_KEYS, MAX_COMBAT_REWARD };
