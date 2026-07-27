// ════════════════════════════════════════════════════════════════
// PokéForge — Titles Data
// Chargé avant app.js comme <script> ordinaire (globals partagés)
// ════════════════════════════════════════════════════════════════

const TITLES = [
  // Réputation (débloqués auto selon seuil)
  { id:'recrue',      label:'Recrue',            label_en:'Recruit',           category:'rep', repReq:0 },
  { id:'apprenti',    label:'Apprenti',           label_en:'Apprentice',        category:'rep', repReq:50 },
  { id:'chasseur',    label:'Chasseur',           label_en:'Hunter',            category:'rep', repReq:100 },
  { id:'agent',       label:'Agent',              label_en:'Agent',             category:'rep', repReq:250 },
  { id:'capo',        label:'Capo',               label_en:'Capo',              category:'rep', repReq:500 },
  { id:'lieutenant',  label:'Lieutenant',         label_en:'Lieutenant',        category:'rep', repReq:900 },
  { id:'boss_adj',    label:'Boss-Adjoint',       label_en:'Underboss',         category:'rep', repReq:1500 },
  { id:'boss',        label:'Boss',               label_en:'Boss',              category:'rep', repReq:2500 },
  { id:'baron',       label:'Baron',              label_en:'Baron',             category:'rep', repReq:4000 },
  { id:'parrain',     label:'Parrain',            label_en:'Godfather',         category:'rep', repReq:6000 },
  { id:'legende',     label:'Légende',            label_en:'Legend',            category:'rep', repReq:8500 },
  { id:'intouchable', label:"L'Intouchable",      label_en:'The Untouchable',   category:'rep', repReq:10000 },
  // Type capture (débloqués quand assez de Pokémon d'un type)
  { id:'pyromane',    label:'Pyromane',           label_en:'Pyromaniac',        category:'type_capture', typeReq:'Fire',     countReq:10 },
  { id:'surfeur',     label:'Surfeur',            label_en:'Surfer',            category:'type_capture', typeReq:'Water',    countReq:10 },
  { id:'botaniste',   label:'Botaniste',          label_en:'Botanist',          category:'type_capture', typeReq:'Grass',    countReq:10 },
  { id:'electricien', label:'Électricien',        label_en:'Electrician',       category:'type_capture', typeReq:'Electric', countReq:8 },
  { id:'psy',         label:'Psychique',          label_en:'Psychic',           category:'type_capture', typeReq:'Psychic',  countReq:6 },
  { id:'spectre',     label:'Chasseur de Spectres',label_en:'Ghost Hunter',     category:'type_capture', typeReq:'Ghost',   countReq:4 },
  { id:'dragon_lord', label:'Dompteur de Dragons',label_en:'Dragon Tamer',      category:'type_capture', typeReq:'Dragon',   countReq:3 },
  { id:'venimeux',    label:'Venimeux',           label_en:'Venomous',          category:'type_capture', typeReq:'Poison',   countReq:10 },
  { id:'combattant',  label:'Combattant',         label_en:'Fighter',           category:'type_capture', typeReq:'Fighting', countReq:8 },
  // Stats
  { id:'collectionneur',label:'Collectionneur',  label_en:'Collector',       category:'stat', statReq:'totalCaught',    countReq:100 },
  { id:'grand_vendeur', label:'Grand Vendeur',   label_en:'Master Seller',   category:'stat', statReq:'totalSold',       countReq:50 },
  { id:'guerrier',      label:'Guerrier',        label_en:'Warrior',         category:'stat', statReq:'totalFightsWon',  countReq:100 },
  { id:'chasseur_shiny',label:'Chasseur Shiny',  label_en:'Shiny Hunter',    category:'stat', statReq:'shinyCaught',     countReq:5 },
  // Achetable en boutique
  { id:'richissime',  label:'Richissime',         label_en:'Tycoon',            category:'shop', shopPrice:5000000 },
  // Spéciaux (débloqués par quête/event)
  { id:'glitcheur',         label:'Glitcheur',              label_en:'Glitcher',                category:'special' }, // possession de MissingNo
  { id:'fondateur',         label:'Fondateur',              label_en:'Founder',                 category:'special' }, // débloqué au début
  { id:'early_backer',      label:'Vétéran de la Première Heure', label_en:'Day-One Veteran',   category:'special' }, // code exclusif early players
  { id:'maitre_chronicles', label:'Maître des Chronicles',  label_en:'Master of Chronicles',    category:'special' }, // titre ultime GM
  // Pokédex (débloqués en complétant le Pokédex)
  { id:'professeur',      label:'Professeur',          label_en:'Professor',       category:'pokedex', dexType:'kanto' },     // 151 espèces Kanto
  { id:'maitre_dresseur', label:'Maître Dresseur',     label_en:'Master Trainer',  category:'pokedex', dexType:'full' },      // toutes espèces non-cachées
  // Chromatiques (débloqués avec les shinies)
  { id:'triade_chroma',   label:'Triade Chromatique',  label_en:'Chromatic Triad',    category:'shiny_special', shinyType:'starters' },    // 3 starters shiny
  { id:'seigneur_chroma', label:'Seigneur Chromatique',label_en:'Chromatic Lord',     category:'shiny_special', shinyType:'legendaries' }, // tous légendaires shiny
  { id:'dresseur_chroma', label:'Dresseur Chromatique',label_en:'Chromatic Trainer',  category:'shiny_special', shinyType:'full_dex' },    // tous pokémon shiny
  // Chromatiques légendaires individuels (un titre par légendaire shiny)
  { id:'chroma_articuno', label:'Voile de Givre',         label_en:'Frost Veil',           category:'shiny_special', shinyType:'species', speciesReq:'articuno' },
  { id:'chroma_zapdos',   label:'Éclair Doré',            label_en:'Golden Bolt',          category:'shiny_special', shinyType:'species', speciesReq:'zapdos'   },
  { id:'chroma_moltres',  label:'Cendres de Phénix',      label_en:'Phoenix Ashes',        category:'shiny_special', shinyType:'species', speciesReq:'moltres'  },
  { id:'chroma_mewtwo',   label:'Clone Émeraude',         label_en:'Emerald Clone',        category:'shiny_special', shinyType:'species', speciesReq:'mewtwo'   },
  { id:'chroma_mew',      label:'Fantôme Azur',           label_en:'Azure Phantom',        category:'shiny_special', shinyType:'species', speciesReq:'mew'      },
  { id:'chroma_lugia',    label:'Gardien Doré',           label_en:'Golden Guardian',      category:'shiny_special', shinyType:'species', speciesReq:'lugia'    },
  { id:'chroma_hooh',     label:'Arc-en-Ciel Éternel',    label_en:'Eternal Rainbow',      category:'shiny_special', shinyType:'species', speciesReq:'ho-oh'    },
  { id:'chroma_raikou',   label:'Tonnerre Arctique',      label_en:'Arctic Thunder',       category:'shiny_special', shinyType:'species', speciesReq:'raikou'   },
  { id:'chroma_entei',    label:'Brasier Sombre',         label_en:'Dark Blaze',           category:'shiny_special', shinyType:'species', speciesReq:'entei'    },
  { id:'chroma_suicune',  label:'Cristal Rose',           label_en:'Rose Crystal',         category:'shiny_special', shinyType:'species', speciesReq:'suicune'  },
  { id:'chroma_celebi',   label:'Fée du Passé',           label_en:'Fairy of the Past',    category:'shiny_special', shinyType:'species', speciesReq:'celebi'   },
  // ── Collection chromatique de groupe (shinyType:'collection') ─────────────────────
  // Trio des Oiseaux Légendaires chromatiques (demandé explicitement)
  { id:'triumvirat_celeste',  label:'Triumvirat Céleste',      label_en:'Celestial Triumvirate', category:'shiny_special', shinyType:'collection', speciesReq:['articuno','zapdos','moltres'] },
  // Trio des Bêtes Sacrées chromatiques
  { id:'triade_sacree',       label:'Triade Sacrée',           label_en:'Sacred Triad',          category:'shiny_special', shinyType:'collection', speciesReq:['raikou','entei','suicune'] },
  // Duo Céleste chromatique (Lugia + Ho-Oh)
  { id:'aube_crepuscule',     label:'Aube et Crépuscule',      label_en:'Dawn and Dusk',         category:'shiny_special', shinyType:'collection', speciesReq:['lugia','ho-oh'] },
  // Starters Johto chromatiques
  { id:'triade_johto_chroma', label:'Triade de Johto',         label_en:'Johto Triad',           category:'shiny_special', shinyType:'collection', speciesReq:['chikorita','cyndaquil','totodile'] },
  // Tous les starters (Kanto + Johto) chromatiques
  { id:'legende_origines',    label:'Légende des Origines',    label_en:'Legend of Origins',     category:'shiny_special', shinyType:'collection', speciesReq:['bulbasaur','charmander','squirtle','chikorita','cyndaquil','totodile'] },
  // Famille Évoli chromatique complète
  { id:'spectre_prismatique', label:'Spectre Prismatique',     label_en:'Prismatic Spectre',     category:'shiny_special', shinyType:'collection', speciesReq:['eevee','vaporeon','jolteon','flareon','espeon','umbreon'] },
  // Fossiles chromatiques
  { id:'archeologue_ombre',   label:'Archéologue de l\'Ombre', label_en:'Shadow Archaeologist',  category:'shiny_special', shinyType:'collection', speciesReq:['omanyte','omastar','kabuto','kabutops','aerodactyl'] },
  // Lignée Dragon chromatique
  { id:'elu_dragon_chroma',   label:'Élu du Dragon',           label_en:'Dragon\'s Chosen',      category:'shiny_special', shinyType:'collection', speciesReq:['dratini','dragonair','dragonite','kingdra'] },

  // ── Collection (possession, pas forcément chromatique) ────────────────────────────
  { id:'seigneur_cieux',      label:'Seigneur des Cieux',      label_en:'Lord of the Skies',           category:'collection', speciesReq:['articuno','zapdos','moltres'] },
  { id:'maitre_betes',        label:'Maître des Bêtes Sacrées',label_en:'Master of the Sacred Beasts', category:'collection', speciesReq:['raikou','entei','suicune'] },
  { id:'gardien_deux_mondes', label:'Gardien des Deux Mondes', label_en:'Guardian of Two Worlds',      category:'collection', speciesReq:['lugia','ho-oh'] },
  { id:'starters_kanto',      label:'Triplette de Kanto',      label_en:'Kanto Trio',                  category:'collection', speciesReq:['bulbasaur','charmander','squirtle'] },
  { id:'starters_johto',      label:'Triplette de Johto',      label_en:'Johto Trio',                  category:'collection', speciesReq:['chikorita','cyndaquil','totodile'] },
  { id:'tous_starters',       label:'Grand Dresseur',          label_en:'Grand Trainer',               category:'collection', speciesReq:['bulbasaur','charmander','squirtle','chikorita','cyndaquil','totodile'] },
  { id:'famille_evoli',       label:'Famille Évoli',           label_en:'Eevee Family',                category:'collection', speciesReq:['eevee','vaporeon','jolteon','flareon','espeon','umbreon'] },
  { id:'paleontologue',       label:'Paléontologue',           label_en:'Paleontologist',              category:'collection', speciesReq:['omanyte','omastar','kabuto','kabutops','aerodactyl'] },
  { id:'lignee_dragon',       label:'Seigneur du Dragon',      label_en:'Dragon Lord',                 category:'collection', speciesReq:['dratini','dragonair','dragonite','kingdra'] },
  { id:'chasseur_legendes',   label:'Chasseur de Légendes',    label_en:'Legend Hunter',               category:'collection', speciesReq:['articuno','zapdos','moltres','mewtwo','mew','lugia','ho-oh','raikou','entei','suicune','celebi'] },
];
