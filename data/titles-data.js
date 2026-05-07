// ════════════════════════════════════════════════════════════════
// PokéForge — Titles Data
// Chargé avant app.js comme <script> ordinaire (globals partagés)
// ════════════════════════════════════════════════════════════════

const TITLES = [
  // Réputation (débloqués auto selon seuil)
  { id:'recrue',      label:'Recrue',            category:'rep', repReq:0 },
  { id:'apprenti',    label:'Apprenti',           category:'rep', repReq:50 },
  { id:'chasseur',    label:'Chasseur',           category:'rep', repReq:100 },
  { id:'agent',       label:'Agent',              category:'rep', repReq:250 },
  { id:'capo',        label:'Capo',               category:'rep', repReq:500 },
  { id:'lieutenant',  label:'Lieutenant',         category:'rep', repReq:900 },
  { id:'boss_adj',    label:'Boss-Adjoint',       category:'rep', repReq:1500 },
  { id:'boss',        label:'Boss',               category:'rep', repReq:2500 },
  { id:'baron',       label:'Baron',              category:'rep', repReq:4000 },
  { id:'parrain',     label:'Parrain',            category:'rep', repReq:6000 },
  { id:'legende',     label:'Légende',            category:'rep', repReq:8500 },
  { id:'intouchable', label:"L'Intouchable",      category:'rep', repReq:10000 },
  // Type capture (débloqués quand assez de Pokémon d'un type)
  { id:'pyromane',    label:'Pyromane',           category:'type_capture', typeReq:'Fire',     countReq:10 },
  { id:'surfeur',     label:'Surfeur',            category:'type_capture', typeReq:'Water',    countReq:10 },
  { id:'botaniste',   label:'Botaniste',          category:'type_capture', typeReq:'Grass',    countReq:10 },
  { id:'electricien', label:'Électricien',        category:'type_capture', typeReq:'Electric', countReq:8 },
  { id:'psy',         label:'Psychique',          category:'type_capture', typeReq:'Psychic',  countReq:6 },
  { id:'spectre',     label:'Chasseur de Spectres',category:'type_capture', typeReq:'Ghost',   countReq:4 },
  { id:'dragon_lord', label:'Dompteur de Dragons',category:'type_capture', typeReq:'Dragon',   countReq:3 },
  { id:'venimeux',    label:'Venimeux',           category:'type_capture', typeReq:'Poison',   countReq:10 },
  { id:'combattant',  label:'Combattant',         category:'type_capture', typeReq:'Fighting', countReq:8 },
  // Stats
  { id:'collectionneur',label:'Collectionneur',  category:'stat', statReq:'totalCaught',    countReq:100 },
  { id:'grand_vendeur', label:'Grand Vendeur',   category:'stat', statReq:'totalSold',       countReq:50 },
  { id:'guerrier',      label:'Guerrier',        category:'stat', statReq:'totalFightsWon',  countReq:100 },
  { id:'chasseur_shiny',label:'Chasseur Shiny',  category:'stat', statReq:'shinyCaught',     countReq:5 },
  // Achetable en boutique
  { id:'richissime',  label:'Richissime',         category:'shop', shopPrice:5000000 },
  // Spéciaux (débloqués par quête/event)
  { id:'glitcheur',         label:'Glitcheur',              category:'special' }, // possession de MissingNo
  { id:'fondateur',         label:'Fondateur',              category:'special' }, // débloqué au début
  { id:'early_backer',      label:'Vétéran de la Première Heure', category:'special' }, // code exclusif early players
  { id:'maitre_chronicles', label:'Maître des Chronicles',  category:'special' }, // titre ultime GM
  // Pokédex (débloqués en complétant le Pokédex)
  { id:'professeur',      label:'Professeur',          category:'pokedex', dexType:'kanto' },     // 151 espèces Kanto
  { id:'maitre_dresseur', label:'Maître Dresseur',     category:'pokedex', dexType:'full' },      // toutes espèces non-cachées
  // Chromatiques (débloqués avec les shinies)
  { id:'triade_chroma',   label:'Triade Chromatique',  category:'shiny_special', shinyType:'starters' },    // 3 starters shiny
  { id:'seigneur_chroma', label:'Seigneur Chromatique',category:'shiny_special', shinyType:'legendaries' }, // tous légendaires shiny
  { id:'dresseur_chroma', label:'Dresseur Chromatique',category:'shiny_special', shinyType:'full_dex' },    // tous pokémon shiny
  // Chromatiques légendaires individuels (un titre par légendaire shiny)
  { id:'chroma_articuno', label:'Voile de Givre',         category:'shiny_special', shinyType:'species', speciesReq:'articuno' },
  { id:'chroma_zapdos',   label:'Éclair Doré',            category:'shiny_special', shinyType:'species', speciesReq:'zapdos'   },
  { id:'chroma_moltres',  label:'Cendres de Phénix',      category:'shiny_special', shinyType:'species', speciesReq:'moltres'  },
  { id:'chroma_mewtwo',   label:'Clone Émeraude',         category:'shiny_special', shinyType:'species', speciesReq:'mewtwo'   },
  { id:'chroma_mew',      label:'Fantôme Azur',           category:'shiny_special', shinyType:'species', speciesReq:'mew'      },
  { id:'chroma_lugia',    label:'Gardien Doré',           category:'shiny_special', shinyType:'species', speciesReq:'lugia'    },
  { id:'chroma_hooh',     label:'Arc-en-Ciel Éternel',    category:'shiny_special', shinyType:'species', speciesReq:'ho-oh'    },
  { id:'chroma_raikou',   label:'Tonnerre Arctique',      category:'shiny_special', shinyType:'species', speciesReq:'raikou'   },
  { id:'chroma_entei',    label:'Brasier Sombre',         category:'shiny_special', shinyType:'species', speciesReq:'entei'    },
  { id:'chroma_suicune',  label:'Cristal Rose',           category:'shiny_special', shinyType:'species', speciesReq:'suicune'  },
  { id:'chroma_celebi',   label:'Fée du Passé',           category:'shiny_special', shinyType:'species', speciesReq:'celebi'   },
  // Collection (débloqués en possédant un ensemble d'espèces)
  { id:'seigneur_cieux',  label:'Seigneur des Cieux',     category:'collection', speciesReq:['articuno','zapdos','moltres'] }, // les 3 oiseaux légendaires
];
