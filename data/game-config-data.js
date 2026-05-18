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

const AGENT_PERKS = [
  // ══ A. AFFINITÉ CAPTURE PAR TYPE (18) ══════════════════════════════════
  { id:'cap_fire',      fr:'Instinct du Feu',        icon:'🔥', desc:'+30% capture Feu',       effect:'capture_type:fire:0.30'      },
  { id:'cap_water',     fr:'Instinct de l\'Eau',     icon:'💧', desc:'+30% capture Eau',       effect:'capture_type:water:0.30'     },
  { id:'cap_grass',     fr:'Instinct Plante',        icon:'🌿', desc:'+30% capture Plante',    effect:'capture_type:grass:0.30'     },
  { id:'cap_electric',  fr:'Instinct Électrik',      icon:'⚡', desc:'+30% capture Électrik',  effect:'capture_type:electric:0.30'  },
  { id:'cap_psychic',   fr:'Vision Psionique',       icon:'🔮', desc:'+30% capture Psy',       effect:'capture_type:psychic:0.30'   },
  { id:'cap_ghost',     fr:'Instinct Spectre',       icon:'👻', desc:'+30% capture Spectre',   effect:'capture_type:ghost:0.30'     },
  { id:'cap_dark',      fr:'Instinct Ténèbres',      icon:'🌑', desc:'+30% capture Ténèbres',  effect:'capture_type:dark:0.30'      },
  { id:'cap_dragon',    fr:'Pacte du Dragon',        icon:'🐉', desc:'+40% capture Dragon',    effect:'capture_type:dragon:0.40'    },
  { id:'cap_ice',       fr:'Contact Glace',          icon:'❄️', desc:'+30% capture Glace',     effect:'capture_type:ice:0.30'       },
  { id:'cap_normal',    fr:'Connivence Naturelle',   icon:'🔘', desc:'+20% capture Normal',    effect:'capture_type:normal:0.20'    },
  { id:'cap_fighting',  fr:'Code du Combat',         icon:'🥊', desc:'+30% capture Combat',    effect:'capture_type:fighting:0.30'  },
  { id:'cap_flying',    fr:'Instinct du Ciel',       icon:'🦅', desc:'+30% capture Vol',       effect:'capture_type:flying:0.30'    },
  { id:'cap_poison',    fr:'Résistance Toxique',     icon:'☠️', desc:'+30% capture Poison',    effect:'capture_type:poison:0.30'    },
  { id:'cap_ground',    fr:'Sens de la Terre',       icon:'🏔️', desc:'+30% capture Sol',       effect:'capture_type:ground:0.30'    },
  { id:'cap_rock',      fr:'Âme de Pierre',          icon:'🪨', desc:'+30% capture Roche',     effect:'capture_type:rock:0.30'      },
  { id:'cap_bug',       fr:'Communion Insecte',      icon:'🐛', desc:'+25% capture Insecte',   effect:'capture_type:bug:0.25'       },
  { id:'cap_steel',     fr:'Toucher d\'Acier',       icon:'⚙️', desc:'+35% capture Acier',     effect:'capture_type:steel:0.35'     },
  { id:'cap_fairy',     fr:'Grâce Féérique',         icon:'🧚', desc:'+35% capture Fée',       effect:'capture_type:fairy:0.35'     },

  // ══ B. RADAR SHINY PAR TYPE (18) ═══════════════════════════════════════
  { id:'shy_fire',      fr:'Flamme Dorée',           icon:'🔥✨', desc:'+60% shiny Feu',        effect:'shiny_type:fire:0.60'        },
  { id:'shy_water',     fr:'Éclair Bleu',            icon:'💧✨', desc:'+60% shiny Eau',        effect:'shiny_type:water:0.60'       },
  { id:'shy_grass',     fr:'Feuille d\'Or',          icon:'🌿✨', desc:'+60% shiny Plante',     effect:'shiny_type:grass:0.60'       },
  { id:'shy_electric',  fr:'Étincelle Rare',         icon:'⚡✨', desc:'+60% shiny Électrik',   effect:'shiny_type:electric:0.60'    },
  { id:'shy_psychic',   fr:'Aura Mystique',          icon:'🔮✨', desc:'+80% shiny Psy',        effect:'shiny_type:psychic:0.80'     },
  { id:'shy_ghost',     fr:'Spectre Lumineux',       icon:'👻✨', desc:'+80% shiny Spectre',    effect:'shiny_type:ghost:0.80'       },
  { id:'shy_dark',      fr:'Ombre Scintillante',     icon:'🌑✨', desc:'+60% shiny Ténèbres',   effect:'shiny_type:dark:0.60'        },
  { id:'shy_dragon',    fr:'Écailles d\'Or',         icon:'🐉✨', desc:'+100% shiny Dragon',    effect:'shiny_type:dragon:1.00'      },
  { id:'shy_ice',       fr:'Cristal Rare',           icon:'❄️✨', desc:'+70% shiny Glace',      effect:'shiny_type:ice:0.70'         },
  { id:'shy_normal',    fr:'Pelage Doré',            icon:'🔘✨', desc:'+40% shiny Normal',     effect:'shiny_type:normal:0.40'      },
  { id:'shy_fighting',  fr:'Poing de Lumière',       icon:'🥊✨', desc:'+60% shiny Combat',     effect:'shiny_type:fighting:0.60'    },
  { id:'shy_flying',    fr:'Plume Précieuse',        icon:'🦅✨', desc:'+60% shiny Vol',        effect:'shiny_type:flying:0.60'      },
  { id:'shy_poison',    fr:'Venin Chatoyant',        icon:'☠️✨', desc:'+60% shiny Poison',     effect:'shiny_type:poison:0.60'      },
  { id:'shy_ground',    fr:'Poudre d\'Étoile',       icon:'🏔️✨', desc:'+60% shiny Sol',        effect:'shiny_type:ground:0.60'      },
  { id:'shy_rock',      fr:'Pierre Précieuse',       icon:'🪨✨', desc:'+70% shiny Roche',      effect:'shiny_type:rock:0.70'        },
  { id:'shy_bug',       fr:'Exosquelette Rare',      icon:'🐛✨', desc:'+50% shiny Insecte',    effect:'shiny_type:bug:0.50'         },
  { id:'shy_steel',     fr:'Métal Poli',             icon:'⚙️✨', desc:'+80% shiny Acier',      effect:'shiny_type:steel:0.80'       },
  { id:'shy_fairy',     fr:'Poussière Féerique',     icon:'🧚✨', desc:'+80% shiny Fée',        effect:'shiny_type:fairy:0.80'       },

  // ══ C. CAPTURE PAR RARETÉ (7) ══════════════════════════════════════════
  { id:'hunt_common',   fr:'Collectionneur',         icon:'📋', desc:'+15% capture Commun',    effect:'capture_rarity:common:0.15'  },
  { id:'hunt_uncommon', fr:'Chasseur Aguerri',       icon:'🎯', desc:'+25% capture Peu Commun',effect:'capture_rarity:uncommon:0.25'},
  { id:'hunt_rare',     fr:'Traqueur',               icon:'🔭', desc:'+40% capture Rare',      effect:'capture_rarity:rare:0.40'    },
  { id:'hunt_veryrare', fr:'Chasseur d\'Élite',      icon:'🏹', desc:'+60% capture Très Rare', effect:'capture_rarity:very_rare:0.60'},
  { id:'hunt_legendary',fr:'Tueur de Légendes',      icon:'👑', desc:'+80% capture Légendaire',effect:'capture_rarity:legendary:0.80'},
  { id:'shiny_magnet',  fr:'Aimant Shiny',           icon:'✨', desc:'+100% chance shiny',     effect:'shiny:1.00'                  },
  { id:'ultra_instinct',fr:'Ultra-Instinct',         icon:'🌟', desc:'+50% rencontres rares',  effect:'encounter_rare:0.50'         },

  // ══ D. QUALITÉ DE CAPTURE (8) ══════════════════════════════════════════
  { id:'potential_eye', fr:'Œil du Potentiel',       icon:'👁', desc:'+1 ★ sur capture',       effect:'capture_potential:1'         },
  { id:'potential_plus',fr:'Vision du Destin',       icon:'👁‍🗨',desc:'+2 ★ sur capture (rare)', effect:'capture_potential:2'         },
  { id:'ball_saver',    fr:'Récup. Poké Ball',       icon:'🟣', desc:'20% récupérer la ball',   effect:'ball_recovery:0.20'          },
  { id:'ball_master',   fr:'Maître des Balls',       icon:'🔵', desc:'35% récupérer la ball',   effect:'ball_recovery:0.35'          },
  { id:'ghost_throw',   fr:'Lancer Fantôme',         icon:'🫧', desc:'10% attraper sans ball',  effect:'ball_recovery:0.10'          },
  { id:'poke_whisperer',fr:'Chuchoteur Pokémon',     icon:'🤫', desc:'+15% capture (tous)',     effect:'capture_type:all:0.15'       },
  { id:'nature_sense',  fr:'Sens de la Nature',      icon:'🌱', desc:'+1 ★ cap. communs',       effect:'capture_rarity:common:0.10'  },
  { id:'perfect_aim',   fr:'Visée Parfaite',         icon:'🎯', desc:'+40% capture rares',      effect:'capture_rarity:rare:0.40'    },

  // ══ E. COMBAT (20) ═════════════════════════════════════════════════════
  { id:'combat_basic',  fr:'Technique de Base',      icon:'⚔', desc:'+15% puissance combat',   effect:'combat:0.15'                 },
  { id:'combat_focus',  fr:'Concentration',          icon:'⚔️', desc:'+25% puissance combat',  effect:'combat:0.25'                 },
  { id:'combat_master', fr:'Maîtrise du Combat',     icon:'🗡', desc:'+40% puissance combat',   effect:'combat:0.40'                 },
  { id:'intimidation',  fr:'Intimidation',           icon:'😤', desc:'-15% difficulté dresseur',effect:'trainer_debuff:0.15'         },
  { id:'intimidation2', fr:'Regard Meurtrier',       icon:'👿', desc:'-25% difficulté dresseur',effect:'trainer_debuff:0.25'         },
  { id:'gym_slayer',    fr:'Briseur d\'Arènes',      icon:'🏟', desc:'+30% vs Arène',           effect:'combat:0.30'                 },
  { id:'raid_veteran',  fr:'Vétéran des Raids',      icon:'🛡', desc:'+25% vs Raids',           effect:'combat:0.25'                 },
  { id:'elite_breaker', fr:'Briseur d\'Élite',       icon:'💎', desc:'+35% vs Élite 4',         effect:'combat:0.35'                 },
  { id:'rocket_hunter', fr:'Chasseur de Rockets',    icon:'🚀', desc:'+20% vs Team Rocket',     effect:'combat:0.20'                 },
  { id:'first_strike',  fr:'Attaque Surprise',       icon:'⚡', desc:'+20% puissance 1er round', effect:'combat:0.20'                },
  { id:'resilience',    fr:'Résilience',             icon:'🛡️', desc:'+15% résistance dommages', effect:'combat:0.15'                },
  { id:'berserker',     fr:'Berserker',              icon:'💢', desc:'+35% ATK, -10% DEF',       effect:'combat:0.35'                 },
  { id:'strategist',    fr:'Stratège',               icon:'🧠', desc:'+20% vs dresseurs forts', effect:'combat:0.20'                 },
  { id:'opportunist',   fr:'Opportuniste',           icon:'🎲', desc:'+30% après défaite',       effect:'combat:0.30'                 },
  { id:'pack_hunter',   fr:'Chasseur de Meute',      icon:'🐺', desc:'+20% en groupe',           effect:'combat:0.20'                 },
  { id:'lone_wolf',     fr:'Loup Solitaire',         icon:'🐺', desc:'+30% en solo',             effect:'combat:0.30'                 },
  { id:'counter_atk',   fr:'Contre-Attaque',         icon:'🔄', desc:'+25% après encaissement',  effect:'combat:0.25'                 },
  { id:'zone_guardian', fr:'Gardien de Zone',        icon:'🏰', desc:'+20% en défense de zone',  effect:'combat:0.20'                 },
  { id:'battle_instinct',fr:'Instinct de Guerrier', icon:'⚔️', desc:'+20% tous combats',        effect:'combat:0.20'                 },
  { id:'assassin',      fr:'Assassin',               icon:'🗡️', desc:'+40% vs dresseurs seuls',  effect:'combat:0.40'                 },

  // ══ F. ÉCONOMIE (20) ═══════════════════════════════════════════════════
  { id:'chest_basic',   fr:'Fouilleur',              icon:'📦', desc:'+25% loot coffres',        effect:'chest_loot:0.25'             },
  { id:'chest_adv',     fr:'Chasseur de Trésors',    icon:'📦', desc:'+50% loot coffres',        effect:'chest_loot:0.50'             },
  { id:'chest_master',  fr:'Maître du Pillage',      icon:'🗝', desc:'+80% loot coffres',        effect:'chest_loot:0.80'             },
  { id:'money_basic',   fr:'Flair des Billets',      icon:'💸', desc:'+20% argent combats',      effect:'money:0.20'                  },
  { id:'money_sense',   fr:'Flair du Fric',          icon:'💰', desc:'+30% argent combats',      effect:'money:0.30'                  },
  { id:'money_master',  fr:'Touche-à-Tout',          icon:'🤑', desc:'+50% argent combats',      effect:'money:0.50'                  },
  { id:'passive_sm',    fr:'Revenu Passif',          icon:'🏦', desc:'+100₽ par action zone',    effect:'passive_income:100'          },
  { id:'passive_md',    fr:'Investisseur',           icon:'📈', desc:'+500₽ par action zone',    effect:'passive_income:500'          },
  { id:'passive_lg',    fr:'Baron de Finance',       icon:'💹', desc:'+2000₽ par action zone',   effect:'passive_income:2000'         },
  { id:'lucky_loot',    fr:'Trouvaille Heureuse',    icon:'🍀', desc:'+20% items rares coffres', effect:'chest_loot:0.20'             },
  { id:'fence',         fr:'Receleur',               icon:'🧳', desc:'+15% argent toutes sources',effect:'money:0.15'                 },
  { id:'bounty_hunter', fr:'Chasseur de Primes',     icon:'🎫', desc:'+40% argent dresseurs',    effect:'money:0.40'                  },
  { id:'salvager',      fr:'Récupérateur',           icon:'♻️', desc:'+20% items récupérés',     effect:'chest_loot:0.20'             },
  { id:'dealer',        fr:'Marchand Ambulant',      icon:'🛒', desc:'+35% argent combats',      effect:'money:0.35'                  },
  { id:'tax_collector', fr:'Percepteur',             icon:'📜', desc:'+25% argent all sources',  effect:'money:0.25'                  },
  { id:'arbitrageur',   fr:'Arbitrageur',            icon:'⚖️', desc:'+30% argent coffres+combat',effect:'money:0.30'                 },
  { id:'smuggler',      fr:'Contrebandier',          icon:'🕵', desc:'+45% argent (hors zone ouverte)',effect:'money:0.45'             },
  { id:'negotiator',    fr:'Négociateur',            icon:'🤝', desc:'+20% argent + -10% difficulté',effect:'money:0.20'              },
  { id:'bank_runner',   fr:'Convoyeur de Fonds',     icon:'🏧', desc:'+1000₽ par victoire raid', effect:'passive_income:1000'         },
  { id:'gold_rush',     fr:'Ruée vers l\'Or',        icon:'⛏', desc:'+60% argent durant les raids',effect:'money:0.60'               },

  // ══ G. DÉCOUVERTE & RENCONTRES (16) ════════════════════════════════════
  { id:'lucky_find',    fr:'Sixième Sens',            icon:'⭐', desc:'+25% rencontres rares',   effect:'encounter_rare:0.25'         },
  { id:'ultra_radar',   fr:'Ultra Radar',             icon:'📡', desc:'+40% rencontres rares',   effect:'encounter_rare:0.40'         },
  { id:'encounter_max', fr:'Aimant à Pokémon',        icon:'🧲', desc:'+60% rencontres rares',   effect:'encounter_rare:0.60'         },
  { id:'legendary_lure',fr:'Appât Légendaire',        icon:'🌠', desc:'+30% chance légendaire',  effect:'encounter_rare:0.30'         },
  { id:'shiny_radar',   fr:'Radar Shiny',             icon:'✨', desc:'+75% chance shiny',       effect:'shiny:0.75'                  },
  { id:'shiny_master',  fr:'Maître Shiny',            icon:'🌈', desc:'+150% chance shiny',      effect:'shiny:1.50'                  },
  { id:'dark_seeker',   fr:'Chercheur des Ombres',    icon:'🔦', desc:'+35% rencontres nocturnes',effect:'encounter_rare:0.35'         },
  { id:'cave_expert',   fr:'Expert des Cavernes',     icon:'⛏', desc:'+30% rencontres en grotte',effect:'encounter_rare:0.30'         },
  { id:'sea_scout',     fr:'Éclaireur Maritime',      icon:'🌊', desc:'+30% rencontres en mer',  effect:'encounter_rare:0.30'         },
  { id:'forest_ranger', fr:'Ranger Forestier',        icon:'🌲', desc:'+30% rencontres en forêt',effect:'encounter_rare:0.30'         },
  { id:'city_informant',fr:'Informateur Urbain',      icon:'🏙', desc:'+25% rencontres en ville', effect:'encounter_rare:0.25'         },
  { id:'safari_guide',  fr:'Guide Safari',            icon:'🦓', desc:'+30% rencontres safari',  effect:'encounter_rare:0.30'         },
  { id:'gym_insider',   fr:'Initié d\'Arène',         icon:'🏟', desc:'+25% rencontres arène',   effect:'encounter_rare:0.25'         },
  { id:'map_reader',    fr:'Lecteur de Cartes',       icon:'🗺', desc:'+20% spawn rate toutes zones',effect:'encounter_rare:0.20'      },
  { id:'trail_blazer',  fr:'Défricheur',              icon:'🔪', desc:'+30% premières rencontres de zone',effect:'encounter_rare:0.30' },
  { id:'master_explorer',fr:'Grand Explorateur',      icon:'🧭', desc:'+50% toutes rencontres',  effect:'encounter_rare:0.50'         },

  // ══ H. UTILITÉ & XP (15) ══════════════════════════════════════════════
  { id:'xp_boost_sm',   fr:'Apprenti Avide',         icon:'📚', desc:'+20% XP agent',           effect:'xp_bonus:0.20'               },
  { id:'xp_boost_lg',   fr:'Étudiant Dévoué',        icon:'📖', desc:'+40% XP agent',           effect:'xp_bonus:0.40'               },
  { id:'xp_master',     fr:'Génie de l\'Expérience', icon:'🎓', desc:'+70% XP agent',           effect:'xp_bonus:0.70'               },
  { id:'trainer_debuff3',fr:'Briseur de Moral',      icon:'💀', desc:'-35% difficulté dresseur', effect:'trainer_debuff:0.35'         },
  { id:'efficiency_sm', fr:'Efficacité',             icon:'⚡', desc:'15% économie de balls',    effect:'ball_recovery:0.15'          },
  { id:'efficiency_lg', fr:'Grande Efficacité',      icon:'🔋', desc:'30% économie de balls',    effect:'ball_recovery:0.30'          },
  { id:'veteran_eye',   fr:'Œil du Vétéran',         icon:'🎖', desc:'+15% tous effets passifs', effect:'combat:0.15'                 },
  { id:'quick_learner', fr:'Apprentissage Rapide',   icon:'⚡', desc:'+30% XP agent',           effect:'xp_bonus:0.30'               },
  { id:'dedication',    fr:'Dévotion',               icon:'❤️', desc:'+50% XP + +10% capture',  effect:'xp_bonus:0.50'               },
  { id:'multi_tasker',  fr:'Polyvalent',             icon:'🔄', desc:'+10% tout types de capture',effect:'capture_type:all:0.10'       },
  { id:'zone_expert',   fr:'Expert de Zone',         icon:'📍', desc:'+20% toutes actions',      effect:'combat:0.20'                 },
  { id:'mentor',        fr:'Mentor',                 icon:'👨‍🏫',desc:'+60% XP agent',           effect:'xp_bonus:0.60'               },
  { id:'team_synergy',  fr:'Synergie d\'Équipe',     icon:'👥', desc:'+15% puissance avec 2+ agents',effect:'combat:0.15'             },
  { id:'ace_agent',     fr:'Agent As',               icon:'🃏', desc:'+20% tout (combat+capture)',effect:'combat:0.20'                 },
  { id:'determination', fr:'Détermination',          icon:'💪', desc:'+25% XP + +25% combat',   effect:'xp_bonus:0.25'               },

  // ══ I. SPÉCIALISTE DE ZONE (9) ════════════════════════════════════════
  { id:'mountain_king', fr:'Roi de la Montagne',     icon:'⛰', desc:'+30% zones montagne',     effect:'capture_type:ground:0.30'    },
  { id:'aqua_master',   fr:'Maître des Eaux',        icon:'🌊', desc:'+30% zones marines',      effect:'capture_type:water:0.30'     },
  { id:'cave_king',     fr:'Roi des Cavernes',       icon:'🦇', desc:'+30% zones souterraines', effect:'capture_type:rock:0.30'      },
  { id:'forest_lord',   fr:'Seigneur de Forêt',      icon:'🌳', desc:'+30% zones forestières',  effect:'capture_type:grass:0.30'     },
  { id:'urban_tactician',fr:'Tacticien Urbain',      icon:'🏙', desc:'+20% zones urbaines',     effect:'combat:0.20'                 },
  { id:'safari_king',   fr:'Roi Safari',             icon:'🦁', desc:'+40% zone safari',        effect:'capture_type:normal:0.40'    },
  { id:'sky_rider',     fr:'Cavalier du Ciel',       icon:'🦅', desc:'+35% zones aériennes',    effect:'capture_type:flying:0.35'    },
  { id:'psychic_realm', fr:'Maître du Psychique',    icon:'🔮', desc:'+35% zones mystiques',    effect:'capture_type:psychic:0.35'   },
  { id:'dark_domain',   fr:'Maître des Ténèbres',    icon:'🌑', desc:'+35% zones obscures',     effect:'capture_type:dark:0.35'      },

  // ══ J. ATOUTS SPÉCIAUX (12) ════════════════════════════════════════════
  { id:'darkrai_touch', fr:'Toucher de Darkrai',     icon:'🌙', desc:'+50% shiny + +20% rare',  effect:'shiny:0.50'                  },
  { id:'darkrai_gift',  fr:'Don de Darkrai',         icon:'🌙', desc:'+100% XP agent',          effect:'xp_bonus:1.00'               },
  { id:'darkrai_eye',   fr:'Œil de Darkrai',         icon:'👁', desc:'+2★ + +50% rare',         effect:'capture_potential:2'         },
  { id:'legendary_bond',fr:'Lien Légendaire',        icon:'⚡', desc:'+100% capture légendaires',effect:'capture_rarity:legendary:1.00'},
  { id:'chaos_master',  fr:'Maître du Chaos',        icon:'🎲', desc:'+50% argent + coffres',   effect:'money:0.50'                  },
  { id:'shadow_step',   fr:'Pas de l\'Ombre',        icon:'👣', desc:'+40% capture + -25% difficulté',effect:'capture_type:ghost:0.40'},
  { id:'gold_touch',    fr:'Touche d\'Or',           icon:'🪙', desc:'+80% argent combats',      effect:'money:0.80'                  },
  { id:'perfect_throw', fr:'Lancer Parfait',         icon:'⚾', desc:'+50% économie balls',      effect:'ball_recovery:0.50'          },
  { id:'shiny_guardian',fr:'Gardien du Shiny',       icon:'💫', desc:'+200% chance shiny',      effect:'shiny:2.00'                  },
  { id:'elemental_bond',fr:'Lien Élémentaire',       icon:'🌀', desc:'+40% types prioritaires', effect:'capture_type:fire:0.40'      },
  { id:'apex_predator', fr:'Prédateur Absolu',       icon:'🦁', desc:'+50% capture tous types', effect:'combat:0.50'                 },
  { id:'galactic_sense',fr:'Sens Galactique',        icon:'🌌', desc:'+80% rencontres légendaires',effect:'encounter_rare:0.80'       },

  // ══ K. BONUS HYBRIDES (7) ══════════════════════════════════════════════
  { id:'hybrid_xp_cap', fr:'Maître Double',           icon:'🎯', desc:'+30% XP + +20% capture',  effect:'xp_bonus:0.30'               },
  { id:'hybrid_combat', fr:'Chasseur Combattant',     icon:'⚔', desc:'+25% combat + rencontres', effect:'combat:0.25'                 },
  { id:'hybrid_chest',  fr:'Fouilleur Brillant',      icon:'🗝', desc:'+30% coffres + argent',    effect:'chest_loot:0.30'             },
  { id:'infinite_balls',fr:'Sac Sans Fond',           icon:'🎒', desc:'40% récupérer toutes balls',effect:'ball_recovery:0.40'         },
  { id:'night_hunter',  fr:'Chasseur Nocturne',       icon:'🦉', desc:'+35% cap. Spectre + ombres',effect:'capture_type:ghost:0.35'    },
  { id:'zone_mastery',  fr:'Maîtrise Totale',         icon:'🌐', desc:'+20% eff. par zone active', effect:'combat:0.20'                },
  { id:'final_form',    fr:'Forme Finale',            icon:'💥', desc:'+50% tous bonus de niveau', effect:'xp_bonus:0.50'              },
];

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
