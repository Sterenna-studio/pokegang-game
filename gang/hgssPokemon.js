import { HGSS_METADATA, HGSS_BODY_HEIGHT } from '../assets/pokemon_hgss/metadata.js';
import { attachVivariumAnimation } from './pmdSprites.js';
import { pokemonDisplayHeight } from './pokemonSize.js';

export function hgssPokemonVariant({ dex, shiny } = {}) {
  return HGSS_METADATA[dex]?.[shiny ? 'shiny' : 'normal'] || null;
}

export function attachHgssPokemon(host, pokemon) {
  return attachVivariumAnimation(host, hgssPokemonVariant(pokemon),
    new URL('../assets/pokemon_hgss/', import.meta.url), {
      displayHeight: pokemonDisplayHeight(pokemon.dex, pokemon.trueSize),
      bodyHeight: HGSS_BODY_HEIGHT[`${pokemon.dex}/${pokemon.shiny ? 'shiny' : 'normal'}`],
    });
}
