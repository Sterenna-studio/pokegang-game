/* Dex helper functions extracted from app.js */

import { POKEDEX_DESC } from './pokedex-desc.js';

const TYPE_DESC_FR = {
  Fire:'Type Feu, maîtrise les flammes.',
  Water:'Type Eau, vit dans les milieux aquatiques.',
  Grass:'Type Plante, absorbe l\'énergie solaire.',
  Electric:'Type Électrik, génère des charges électriques.',
  Psychic:'Type Psy, possède des pouvoirs mentaux.',
  Ice:'Type Glace, résiste aux températures extrêmes.',
  Dragon:'Type Dragon, une force hors du commun.',
  Normal:'Type Normal, polyvalent et répandu.',
  Fighting:'Type Combat, maîtrise les arts martiaux.',
  Poison:'Type Poison, sécrète des toxines dangereuses.',
  Ground:'Type Sol, creuse et se déplace sous terre.',
  Flying:'Type Vol, plane sur les courants d\'air.',
  Bug:'Type Insecte, pullule dans la végétation.',
  Rock:'Type Roche, son corps est aussi dur que la pierre.',
  Ghost:'Type Spectre, insaisissable et mystérieux.',
};

function getDexDesc(species_en, speciesByEn = SPECIES_BY_EN) {
  if (POKEDEX_DESC[species_en]) return POKEDEX_DESC[species_en];
  const sp = speciesByEn?.[species_en];
  if (!sp) return '???';
  return TYPE_DESC_FR[sp.types?.[0]] || 'Un Pokémon aux capacités encore peu connues.';
}

function buildSpeciesNameMaps(speciesList) {
  const FR_TO_EN = {};
  const EN_TO_FR = {};
  (speciesList || []).forEach(s => {
    FR_TO_EN[s.fr.toLowerCase()] = s.en;
    EN_TO_FR[s.en] = s.fr;
  });
  return { FR_TO_EN, EN_TO_FR };
}

export { getDexDesc, buildSpeciesNameMaps };
