/* I18N dictionary extracted from app.js */

const I18N = {
  // Tabs
  gang_tab:      { fr:'💀 Gang',     en:'💀 Gang'     },
  agents_tab:    { fr:'👥 Agents',   en:'👥 Agents'   },
  zones_tab:     { fr:'🗺️ Zones',   en:'🗺️ Zones'   },
  bag_tab:       { fr:'🎒 Sac',      en:'🎒 Bag'      },
  market_tab:    { fr:'💰 Marché',   en:'💰 Market'   },
  pc_tab:        { fr:'💻 PC',       en:'💻 PC'       },
  pokedex_tab:   { fr:'📖 Pokédex',  en:'📖 Pokédex'  },
  // Gang
  boss:          { fr:'Boss',        en:'Boss'        },
  reputation:    { fr:'Réputation',  en:'Reputation'  },
  agents:        { fr:'Agents',      en:'Agents'      },
  no_agents:     { fr:'Aucun agent recruté', en:'No agents recruited' },
  recruit_agent: { fr:'Recruter',    en:'Recruit'     },
  promote:       { fr:'Promouvoir',  en:'Promote'     },
  // Zone
  mastery:       { fr:'Maîtrise',    en:'Mastery'     },
  fights_won:    { fr:'Combats gagnés', en:'Fights won' },
  locked:        { fr:'🔒 Verrouillé (rep {rep})', en:'🔒 Locked (rep {rep})' },
  open_zone:     { fr:'Ouvrir',      en:'Open'        },
  close_zone:    { fr:'Fermer',      en:'Close'       },
  zone_mastered: { fr:'Zone maîtrisée !', en:'Zone mastered!' },
  // Capture
  catch_success: { fr:'{name} capturé !', en:'{name} caught!' },
  catch_shiny:   { fr:'✨ {name} SHINY capturé !', en:'✨ SHINY {name} caught!' },
  no_balls:      { fr:'Plus de {ball} !', en:'No {ball} left!' },
  // Combat
  combat_win:    { fr:'Victoire ! +{money}₽ +{rep} rep', en:'Victory! +{money}₽ +{rep} rep' },
  combat_lose:   { fr:'Défaite...', en:'Defeat...' },
  combat_title:  { fr:'Combat',     en:'Combat'     },
  // Market
  sell:          { fr:'Vendre',      en:'Sell'        },
  buy:           { fr:'Acheter',     en:'Buy'         },
  sold:          { fr:'Vendu {n} Pokémon pour {price}₽', en:'Sold {n} Pokémon for {price}₽' },
  bought:        { fr:'{item} acheté !', en:'{item} purchased!' },
  not_enough:    { fr:'Pas assez de ₽', en:'Not enough ₽' },
  // PC
  level:         { fr:'Niv.',        en:'Lv.'         },
  nature:        { fr:'Nature',      en:'Nature'      },
  potential:     { fr:'Potentiel',   en:'Potential'    },
  moves:         { fr:'Capacités',   en:'Moves'       },
  zone_caught:   { fr:'Zone',        en:'Zone'        },
  assign:        { fr:'Assigner',    en:'Assign'      },
  release:       { fr:'Relâcher',    en:'Release'     },
  // Agent
  agent_catch:   { fr:'{agent} a capturé {pokemon} !', en:'{agent} caught {pokemon}!' },
  agent_win:     { fr:'{agent} a vaincu un dresseur !', en:'{agent} defeated a trainer!' },
  agent_lose:    { fr:'{agent} a perdu un combat...', en:'{agent} lost a fight...' },
  agent_promo:   { fr:'{agent} promu {title} !', en:'{agent} promoted to {title}!' },
  // Stats
  total_caught:  { fr:'Capturés',    en:'Caught'      },
  total_sold:    { fr:'Vendus',      en:'Sold'        },
  total_fights:  { fr:'Combats',     en:'Fights'      },
  total_money:   { fr:'₽ gagnés',    en:'₽ earned'    },
  shiny_caught:  { fr:'Shinies',     en:'Shinies'     },
  // Settings
  settings:      { fr:'Paramètres',  en:'Settings'    },
  language:      { fr:'Langue',      en:'Language'    },
  save_export:   { fr:'Exporter',    en:'Export'      },
  save_import:   { fr:'Importer',    en:'Import'      },
  reset_all:     { fr:'Tout effacer',en:'Reset all'   },
  reset_confirm: { fr:'Vraiment tout supprimer ?', en:'Really delete everything?' },
  // Intro
  intro_title:   { fr:'PokéForge',   en:'PokéForge'   },
  intro_sub:     { fr:'Crée ton gang. Conquiers Kanto.', en:'Build your gang. Conquer Kanto.' },
  boss_name:     { fr:'Nom du Boss', en:'Boss Name'   },
  gang_name:     { fr:'Nom du Gang', en:'Gang Name'   },
  avatar:        { fr:'Avatar',      en:'Avatar'      },
  start_game:    { fr:'Commencer',   en:'Start'       },
  // LLM
  llm_connected: { fr:'LLM connecté', en:'LLM connected' },
  llm_off:       { fr:'LLM hors-ligne', en:'LLM offline' },
  // Misc
  pokedex_progress:{ fr:'{caught}/{total} capturés', en:'{caught}/{total} caught' },
  // Hub modals
  hub_slot_repair_title:   { fr:'🔧 Réparer un slot',    en:'🔧 Repair a slot'   },
  hub_slot_empty:          { fr:'Slot vide — rien à réparer.', en:'Empty slot — nothing to repair.' },
  hub_slot_repair_confirm: { fr:'Réparer le Slot {slot} ?', en:'Repair Slot {slot}?' },
  hub_slot_repair_body:    { fr:'Toutes les migrations seront réappliquées. Données intactes.', en:'All migrations will be re-applied. Data untouched.' },
  hub_slot_repair_btn:     { fr:'🔧 Réparer ce slot',    en:'🔧 Repair this slot' },
  hub_slot_repaired:       { fr:'✅ Slot {slot} réparé.', en:'✅ Slot {slot} repaired.' },
  hub_slot_repaired_hist:  { fr:'✅ Slot {slot} réparé. {n} entrées d\'historique nettoyées.', en:'✅ Slot {slot} repaired. {n} history entries cleaned.' },
  hub_repair_error:        { fr:'Erreur lors de la réparation — slot non modifié.', en:'Repair error — slot unchanged.' },
  hub_slot_empty_label:    { fr:'Vide',                  en:'Empty'              },
  hub_repair_data_safe:    { fr:'Tes données ne seront pas effacées.', en:'Your data will not be deleted.' },
  hub_repair_desc:         { fr:'Réapplique toutes les migrations, corrige les champs manquants et nettoie les incohérences.', en:'Re-applies all migrations, fixes missing fields and cleans up inconsistencies.' },
  hub_cancel:              { fr:'Annuler',               en:'Cancel'             },
  hub_sprite_invalid_title:{ fr:'⚠ Sprite invalide',    en:'⚠ Invalid sprite'   },
  hub_sprite_invalid_body: { fr:'Le sprite "{sprite}" est introuvable. Choisis un nouveau sprite pour ton Boss :', en:'The sprite "{sprite}" could not be found. Pick a new sprite for your Boss:' },
  hub_sprite_confirm:      { fr:'Confirmer',             en:'Confirm'            },
  hub_sprite_updated:      { fr:'Sprite mis à jour !',   en:'Sprite updated!'    },
};

export { I18N };
