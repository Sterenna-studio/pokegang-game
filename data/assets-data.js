/* Asset URL constants extracted from app.js */

const FALLBACK_TRAINER_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%231a1a1a'/%3E%3Ccircle cx='32' cy='20' r='10' fill='%23444'/%3E%3Cellipse cx='32' cy='50' rx='16' ry='14' fill='%23444'/%3E%3Ctext x='32' y='62' text-anchor='middle' font-size='8' fill='%23666'%3E%3F%3F%3C/text%3E%3C/svg%3E`;
const FALLBACK_POKEMON_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%231a1a1a'/%3E%3Cellipse cx='32' cy='36' rx='20' ry='18' fill='%23333'/%3E%3Ccircle cx='32' cy='18' r='10' fill='%23333'/%3E%3Ctext x='32' y='62' text-anchor='middle' font-size='8' fill='%23555'%3E%3F%3C/text%3E%3C/svg%3E`;

const BALL_SPRITES = {
  pokeball:  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png',
  greatball: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/great-ball.png',
  ultraball: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png',
  duskball:  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dusk-ball.png',
};

// Item sprites — PokeAPI (renommé ITEM_SPRITE_URLS pour éviter collision avec loaders.js)
const ITEM_SPRITE_URLS = {
  pokeball:   'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png',
  greatball:  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/great-ball.png',
  ultraball:  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png',
  duskball:   'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/dusk-ball.png',
  masterball: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png',
  lure:       'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/honey.png',
  superlure:  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/lure-ball.png',
  potion:     'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/potion.png',
  incense:    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/luck-incense.png',
  rarescope:  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/scope-lens.png',
  aura:       'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/shiny-stone.png',
  evostone:   'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/fire-stone.png',
  rarecandy:  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png',
  chestBoost: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/big-nugget.png',
  translator: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-flute.png',
  mysteryegg: 'https://www.pokepedia.fr/images/b/b1/Miniature_%C5%92uf_EV.png',
  incubator:  'https://www.pokepedia.fr/images/b/b1/Miniature_%C5%92uf_EV.png',
  map_pallet:   'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/town-map.png',
  casino_ticket:'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/coin-case.png',
  silph_keycard:'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/silph-scope.png',
  boat_ticket:  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ss-ticket.png',
  pokecoin:     'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/amulet-coin.png',
  silver_wing:       'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/silver-wing.png',
  rainbow_wing:      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rainbow-wing.png',
  tourbillon_permit: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/silver-wing.png',
  carillon_permit:   'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rainbow-wing.png',
};

// Chest sprite URL
const CHEST_SPRITE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/rare-candy.png';

export { FALLBACK_TRAINER_SVG, FALLBACK_POKEMON_SVG, BALL_SPRITES, ITEM_SPRITE_URLS, CHEST_SPRITE_URL };
