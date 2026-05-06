/* Trainer data extracted from app.js */

const TRAINER_TYPES = {
  // Basic trainers
  youngster:    { fr:'Gamin',        en:'Youngster',    sprite:'youngster',    diff:1, reward:[10,30],    rep:1  },
  lass:         { fr:'Fillette',     en:'Lass',         sprite:'lass',         diff:1, reward:[10,30],    rep:1  },
  bugcatcher:   { fr:'Chasseur',     en:'Bug Catcher',  sprite:'bugcatcher',   diff:1, reward:[10,30],    rep:1  },
  camper:       { fr:'Campeur',      en:'Camper',       sprite:'camper',       diff:1, reward:[15,40],    rep:1  },
  picnicker:    { fr:'Pique-niqueuse',en:'Picnicker',   sprite:'picnicker',    diff:1, reward:[15,40],    rep:1  },
  fisherman:    { fr:'Pêcheur',      en:'Fisherman',    sprite:'fisherman',    diff:1, reward:[20,50],    rep:2  },
  // Mid-tier trainers
  hiker:        { fr:'Montagnard',   en:'Hiker',        sprite:'hiker',        diff:2, reward:[25,75],    rep:3  },
  swimmer:      { fr:'Nageur',       en:'Swimmer',      sprite:'swimmer',      diff:2, reward:[25,75],    rep:3  },
  psychic:      { fr:'Médium',       en:'Psychic',      sprite:'psychic',      diff:2, reward:[25,75],    rep:3  },
  gentleman:    { fr:'Gentleman',    en:'Gentleman',    sprite:'gentleman',    diff:2, reward:[30,90],    rep:3  },
  beauty:       { fr:'Canon',        en:'Beauty',       sprite:'beauty',       diff:2, reward:[30,90],    rep:3  },
  sailor:       { fr:'Marin',        en:'Sailor',       sprite:'sailor',       diff:2, reward:[25,80],    rep:3  },
  blackbelt:    { fr:'Karatéka',     en:'Black Belt',   sprite:'blackbelt',    diff:2, reward:[30,85],    rep:3  },
  supernerd:    { fr:'Intello',      en:'Super Nerd',   sprite:'supernerd',    diff:2, reward:[25,75],    rep:3  },
  // High-tier trainers
  acetrainer:   { fr:'Topdresseur',  en:'Ace Trainer',  sprite:'acetrainer',   diff:3, reward:[50,150],   rep:5  },
  acetrainerf:  { fr:'Topdresseuse', en:'Ace Trainer',  sprite:'acetrainerf',  diff:3, reward:[50,150],   rep:5  },
  scientist:    { fr:'Scientifique', en:'Scientist',    sprite:'scientist',    diff:3, reward:[50,150],   rep:5  },
  channeler:    { fr:'Mystimana',    en:'Channeler',    sprite:'channeler',    diff:3, reward:[40,125],   rep:5  },
  juggler:      { fr:'Jongleur',     en:'Juggler',      sprite:'juggler',      diff:3, reward:[50,140],   rep:5  },
  // Team Rocket
  rocketgrunt:  { fr:'Sbire Rocket', en:'Rocket Grunt', sprite:'rocketgrunt',  diff:4, reward:[100,300],  rep:10 },
  rocketgruntf: { fr:'Sbire Rocket', en:'Rocket Grunt', sprite:'rocketgruntf', diff:4, reward:[100,300],  rep:10 },
  archer:       { fr:'Archer',       en:'Archer',       sprite:'archer',       diff:4, reward:[150,400],  rep:12 },
  ariana:       { fr:'Ariane',       en:'Ariana',       sprite:'ariana',       diff:4, reward:[150,400],  rep:12 },
  proton:       { fr:'Lambda',       en:'Proton',       sprite:'proton',       diff:4, reward:[150,400],  rep:12 },
  giovanni:     { fr:'Giovanni',     en:'Giovanni',     sprite:'giovanni',     diff:5, reward:[2500,5000], rep:25},
  // Gym Leaders
  brock:        { fr:'Pierre',       en:'Brock',        sprite:'brock',        diff:3, reward:[1000,2000],rep:15 },
  misty:        { fr:'Ondine',       en:'Misty',        sprite:'misty',        diff:3, reward:[1000,2500],rep:15 },
  ltsurge:      { fr:'Maj. Bob',     en:'Lt. Surge',    sprite:'ltsurge',      diff:4, reward:[1500,3000],rep:18 },
  erika:        { fr:'Érika',        en:'Erika',        sprite:'erika',        diff:4, reward:[1500,3000],rep:18 },
  koga:         { fr:'Koga',         en:'Koga',         sprite:'koga',         diff:4, reward:[2000,4000],rep:20 },
  sabrina:      { fr:'Morgane',      en:'Sabrina',      sprite:'sabrina',      diff:5, reward:[2500,5000], rep:22},
  blaine:       { fr:'Auguste',      en:'Blaine',       sprite:'blaine',       diff:5, reward:[2500,5000], rep:22},
  falkner:      { fr:'Foxy',         en:'Falkner',      sprite:'falkner',      diff:3, reward:[1200,2400], rep:15},
  bugsy:        { fr:'Léna',         en:'Bugsy',        sprite:'bugsy',        diff:3, reward:[1200,2400], rep:15},
  whitney:      { fr:'Blanche',      en:'Whitney',      sprite:'whitney',      diff:4, reward:[1800,3500], rep:18},
  morty:        { fr:'Mortimer',     en:'Morty',        sprite:'morty',        diff:4, reward:[2200,4200], rep:20},
  chuck:        { fr:'Bastien',      en:'Chuck',        sprite:'chuck',        diff:5, reward:[2500,5000], rep:22},
  jasmine:      { fr:'Jasmine',      en:'Jasmine',      sprite:'jasmine',      diff:5, reward:[3000,6000], rep:24},
  pryce:        { fr:'Froid',        en:'Pryce',        sprite:'pryce',        diff:5, reward:[3200,6500], rep:24},
  clair:        { fr:'Cathy',        en:'Clair',        sprite:'clair',        diff:6, reward:[4500,8000], rep:30},
  // Elite Four & Champion
  lorelei:        { fr:'Olga',           en:'Lorelei',        sprite:'lorelei',        diff:6, reward:[4000,7500],  rep:30},
  bruno:          { fr:'Aldo',           en:'Bruno',          sprite:'bruno',          diff:6, reward:[4000,7500],  rep:30},
  agatha:         { fr:'Agatha',         en:'Agatha',         sprite:'agatha',         diff:6, reward:[4000,7500],  rep:30},
  lance:          { fr:'Peter',          en:'Lance',          sprite:'lance',          diff:7, reward:[5000,10000], rep:40},
  will:           { fr:'Yoran',          en:'Will',           sprite:'will',           diff:6, reward:[4500,8500],  rep:32},
  karen:          { fr:'Carole',         en:'Karen',          sprite:'karen',          diff:6, reward:[5000,9000],  rep:34},
  blue:           { fr:'Blue',           en:'Blue',           sprite:'blue',           diff:7, reward:[6000,12500], rep:50},
  red:            { fr:'Red',            en:'Red',            sprite:'red',            diff:8, reward:[7500,15000], rep:60},
  silver:         { fr:'Silver',         en:'Silver',         sprite:'silver',         diff:6, reward:[4000,9000],  rep:35},
  gold:           { fr:'Éthan',          en:'Ethan',          sprite:'gold',           diff:7, reward:[6000,12000], rep:50},
  // Rangers Pokémon (forces de l'ordre, pokémon puissants : Tauros, Scarabrute, etc.)
  pokemonranger:  { fr:'Ranger Pokémon', en:'Pokémon Ranger', sprite:'pokemonranger',  diff:4, reward:[125,350],   rep:10},
  pokemonrangerf: { fr:'Ranger Pokémon', en:'Pokémon Ranger', sprite:'pokemonrangerf', diff:4, reward:[125,350],   rep:10},
  // Police (Arcanin, Caninos — zones Rocket)
  policeman:      { fr:'Policier',       en:'Policeman',      sprite:'policeman',      diff:4, reward:[150,400],   rep:12},
};

export { TRAINER_TYPES };
