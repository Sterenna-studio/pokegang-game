/* Dex helper functions extracted from app.js */

import { POKEDEX_DESC, POKEDEX_DESC_EN } from './pokedex-desc.js';

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

const TYPE_DESC_EN = {
  Fire:'Fire type — a master of flames.',
  Water:'Water type — lives in aquatic environments.',
  Grass:'Grass type — absorbs solar energy.',
  Electric:'Electric type — generates electric charges.',
  Psychic:'Psychic type — possesses mental powers.',
  Ice:'Ice type — withstands extreme cold.',
  Dragon:'Dragon type — a force to be reckoned with.',
  Normal:'Normal type — versatile and widespread.',
  Fighting:'Fighting type — a master of martial arts.',
  Poison:'Poison type — secretes dangerous toxins.',
  Ground:'Ground type — digs and moves underground.',
  Flying:'Flying type — glides on the air currents.',
  Bug:'Bug type — thrives amid vegetation.',
  Rock:'Rock type — its body is as hard as stone.',
  Ghost:'Ghost type — elusive and mysterious.',
};

function getDexDesc(species_en, speciesByEn = SPECIES_BY_EN) {
  const isEn = globalThis.state?.lang === 'en';
  const dict = isEn ? POKEDEX_DESC_EN : POKEDEX_DESC;
  if (dict[species_en]) return dict[species_en];
  const sp = speciesByEn?.[species_en];
  if (!sp) return '???';
  const typeDesc = isEn ? TYPE_DESC_EN : TYPE_DESC_FR;
  return typeDesc[sp.types?.[0]] || (isEn ? 'A Pokémon whose abilities remain largely unknown.' : 'Un Pokémon aux capacités encore peu connues.');
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
