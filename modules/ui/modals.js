'use strict';

// deps via configureModals(ctx):
// - getState, setState, saveState, renderAll, notify, migrate
// - formatPlaytime, exportSave, createDefaultState, getActiveSaveSlot, getSaveKeys
// - getKantoDexSize, getNationalDexSize, getSaveSchemaVersion
// - getAgentRankLabel, pokeSprite, speciesName, switchTab, showIntro
// - applyAutoMutation, cleanObsoleteData, getSlotPreview
// - getOpenZones, renderZonesTab (showShinyPopup/showRarePopup)
// classic-script data globals used by import modals: POKEMON_GEN1, ZONES, ZONE_BY_ID

import { SFX } from './audio.js';
import { esc as _esc } from '../core/escape.js';

const MODAL_EN = {
  confirm_label:'Confirm', cancel_label:'Cancel',
  info_gang_title:'💀 THE GANG', info_gang_rep_label:'Reputation',
  info_gang_rep_desc:'A key resource. Unlocks zones, additional agents and special purchases. Shown in the top-right bar.',
  info_gang_money_label:'Money (₽)',
  info_gang_money_desc:'Battle rewards accumulate in zones. Collect them using the gold ₽ icon or automatically through your agents.',
  info_gang_boss_label:'Boss',
  info_gang_boss_desc:'Your avatar. Assign up to <strong>6 Pokémon</strong> to the Boss team from the PC to strengthen battles.',
  info_gang_bag_label:'Bag',
  info_gang_bag_desc:'Active Balls, temporary boosts and incubators. Click a Ball to make it the default.',
  info_gang_cosmetics_label:'Cosmetics',
  info_gang_cosmetics_desc:'Customize the Boss and gang appearance (unlocked through special purchases).',
  info_gang_tip:'Tip: the higher your reputation, the stronger the available zones and agents.',
  info_agents_title:'👥 AGENTS', info_agents_level_label:'Level',
  info_agents_level_desc:'An agent’s overall power. Increases by winning battles and catching Pokémon. Cap: 100.',
  info_agents_grade_label:'Rank',
  info_agents_grade_desc:'Grunt → Sergeant (Lv.25) → Lieutenant (Lv.50) → Commander (Lv.75) → Elite / General (Lv.100). Each rank boosts battle power.',
  info_agents_zone_label:'Assigned zone',
  info_agents_zone_desc:'The agent farms passively in the background at the zone’s actual pace: catches, battles and chests.',
  info_agents_cap_label:'Cap at 10',
  info_agents_cap_desc:'Agents beyond the 10th slot require a paid unlock with an increasing cost.',
  info_agents_tip:'An agent without an assigned zone does nothing. A high-ranking agent with a good team makes a significant difference in battle.',
  info_zones_title:'🗺️ ZONES', info_zones_open_label:'Open zone',
  info_zones_open_desc:'Visible window with interactive spawns. You can catch and battle manually. The timer follows the zone’s pace.',
  info_zones_closed_label:'Closed zone + agent',
  info_zones_closed_desc:'Silent background simulation at the actual spawn pace. The agent catches, battles and opens chests automatically.',
  info_zones_inactive_label:'Inactive zone', info_zones_inactive_desc:'No agent assigned; nothing happens.',
  info_zones_mastery_label:'Mastery ★',
  info_zones_mastery_desc:'Builds up with victories in the zone. Improves spawns and unlocks elite trainers.',
  info_zones_raids_label:'Hostile raids',
  info_zones_raids_desc:'An enemy gang can attack zones you control. Your agents defend automatically.',
  info_zones_slots_label:'Agent slots',
  info_zones_slots_desc:'Each zone has a maximum number of assignable agents, determined by its investment level.',
  info_zones_tip:'A closed zone with a good agent is often more efficient than an open zone left unattended.',
  info_market_title:'💰 MARKET', info_market_quests_label:'Hourly quests',
  info_market_quests_desc:'3 Medium + 2 Hard quests, reset every hour. Reroll available for 10 REP.',
  info_market_session_label:'Session objectives',
  info_market_session_desc:'Short quests active during your session. Immediate rewards.',
  info_market_balls_label:'Balls',
  info_market_balls_desc:'Poké Ball — unlimited, catching never runs out. The other types (Great, Ultra, Dusk, Master) are one-time cosmetic skins bought here: they change how captures look but have no effect on potential.',
  info_market_boosts_label:'Temporary boosts',
  info_market_boosts_desc:'Activated from the Bag in a zone window. Duration 60–120s. Double XP, double loot, shiny radar…',
  info_market_special_label:'Special purchases',
  info_market_special_desc:'Unlocked through reputation: auto-sell, cosmetics and additional slots.',
  info_market_tip:'Sell Pokémon from the PC to fund purchases. Rare and ★5 Pokémon are worth much more.',
  info_pc_title:'💻 PC', info_pc_power_label:'Power (CP)',
  info_pc_power_desc:'Calculated as ATK×1.25 + DEF×0.65 + SPD×1.10 with a soft cap at 620 (beyond it, gains are reduced to ×0.52). Very tanky Pokémon are disadvantaged against fast attackers.',
  info_pc_shiny_label:'Shiny',
  info_pc_shiny_desc:'Shiny Pokémon have a permanent <strong>+10%</strong> power bonus to their base CP.',
  info_pc_variance_label:'Individual variance',
  info_pc_variance_desc:'Each Pokémon receives a unique [×0.90–×1.10] multiplier when caught, stored permanently. Two identical Pokémon may therefore have slightly different CP.',
  info_pc_nature_label:'Nature',
  info_pc_nature_desc:'Multiplies 2 stats and penalizes 1, directly affecting CP through the weighted formula.',
  info_pc_potential_label:'Potential ★',
  info_pc_potential_desc:'Permanent. Determines the Pokémon’s power ceiling. ★5 = S tier. Rolled randomly on capture, temporarily boostable with the Lucky Incense.',
  info_pc_evo_label:'Evolution',
  info_pc_evo_desc:'Through the Lab. Some evolutions require a minimum level, others a stone. Stats increase significantly.',
  info_pc_daycare_label:'Daycare',
  info_pc_daycare_desc:'2 compatible Pokémon produce an Egg (incubator required). The Egg inherits its parents’ potential.',
  info_pc_training_label:'Training room',
  info_pc_training_desc:'Levels up passive Pokémon. ₽ cost increases with level.',
  info_pc_sell_label:'Selling', info_pc_sell_desc:'Price = rarity × potential × nature. No resale penalty.',
  info_pc_tip:'Filter by rarity, type or ★ to quickly find your best Pokémon.',
  info_pokedex_title:'📖 POKÉDEX', info_pokedex_seen_label:'Seen 👁',
  info_pokedex_seen_desc:'This Pokémon appeared in a zone (visible or background spawn).',
  info_pokedex_caught_label:'Caught ✓', info_pokedex_caught_desc:'You own at least one in your PC.',
  info_pokedex_shiny_label:'Shiny ✨',
  info_pokedex_shiny_desc:'Shiny version caught. Very low base chance, increased by Shiny Radar perks and temporary boosts.',
  info_pokedex_progress_label:'Progress',
  info_pokedex_progress_desc:'Completing the Kanto Pokédex grants REP and unlocks. Gen 2 (Johto) is available from the start. A special event unlocks a Gen 3 (Sinnoh) preview.',
  info_pokedex_stats_label:'Player stats',
  info_pokedex_stats_desc:'Catch enough Pokémon of a species to unlock permanent bonuses through the expanded Pokédex.',
  info_pokedex_tip:'Legendary and very rare Pokémon only appear in specific high-mastery zones.',
  shiny_popup_prefix:'✨ SHINY ', rare_popup_prefix:'⚡ Rare sighting: ',
  mini_combat_win_prefix:'⚔ Victory — ', mini_combat_lose_prefix:'💀 Defeat — ',
  mini_combat_lost_fight:'battle lost',
  mig_eggs:'Egg system', mig_pension:'Daycare', mig_training:'Training room',
  mig_missions:'Missions', mig_cosmetics:'Cosmetics', mig_titles:'Unlocked titles',
  mig_title_slots:'Title slots (×4)', mig_logs:'Behavior logs', mig_lab:'Laboratory',
  mig_purchases:'Special purchases', mig_incubator:'Incubator inventory',
  mig_ui_settings:'Advanced UI settings', mig_none:'No migration required — save is up to date',
  badge_legacy:'Old version', badge_compatible:'Compatible format',
  import_modal_title:'📥 Import a Save', import_save_label:'IMPORTED SAVE',
  import_boss_label:'Boss', import_pokemon_count:'Pokémon', import_agents_count:'Agents',
  import_rep_count:'Rep.', import_national_label:'National', import_shiny_species:'Shiny species',
  import_saved_at:'Saved on', import_playtime:'Playtime', import_schema:'Schema',
  import_auto_migration:'AUTOMATIC MIGRATION', import_full_label:'Full import',
  import_overwrite_warning:'will permanently replace the active save',
  import_backup_hint:'Export your current save first if you want to keep it.',
  btn_export_before_import:'Export my current save before importing',
  btn_import_full:'Full import', btn_import_full_sub:'All data migrated automatically',
  btn_import_heritage:'Legacy mode', btn_import_heritage_sub:'1 agent + 2 Pokémon',
  btn_cancel:'Cancel', btn_exported_ok:'Current save exported!',
  confirm_import_replace:'Replace the save in slot', confirm_import_by:'with the imported save from',
  notify_import_success_prefix:'Save from', notify_import_success_suffix:'imported and converted to the current format.',
  notify_import_error:'Conversion error — save was not imported.', btn_import_confirm:'Import',
  legacy_no_agent:'No agent in this save', legacy_no_pokemon:'No Pokémon',
  legacy_modal_title:'LEGACY IMPORT',
  legacy_intro:'Save from an earlier version detected. You may keep',
  legacy_agent:'agent', legacy_and:'and', legacy_pokemon:'Pokémon',
  legacy_egg_hint:'The 2 Pokémon will be placed in the Daycare to produce a starter Egg.',
  legacy_pick_agent:'CHOOSE 1 AGENT', legacy_pick_pokemon:'CHOOSE 2 POKÉMON',
  legacy_poke_count:'0/2 selected', btn_legacy_start:'START', legacy_selected:'selected',
  notify_select_2_pokemon:'Select exactly 2 Pokémon.',
  default_gang_name:'The Gang', default_boss_name:'Boss',
  notify_legacy_started:'New legacy game started! The Pokémon are in the Daycare.',
  slot_empty:'Empty', warn_4star_detected:'4★ Pokémon detected', warn_including:'including',
  warn_will_upgrade:'all will be upgraded to 5★', warn_no_4star:'No 4★ Pokémon detected',
  warn_orphan_zones:'obsolete zone(s) removed', warn_no_orphan:'No obsolete zones',
  hub_import_title:'📥 Import a Save', hub_imported_save:'IMPORTED SAVE',
  hub_pokedex_kanto:'Kanto Pokédex', hub_national:'Nat.',
  hub_slot_dest:'DESTINATION SLOT', hub_import_options:'IMPORT OPTIONS',
  opt_mutation_label:'⚡ Auto mutation 4★ → 5★',
  opt_mutation_desc:'Automatically upgrades all 4★ Pokémon to 5★.',
  opt_mutation_desc2:'Priority: ✨ shiny → level → PC order. Shinies will never be used as source material.',
  opt_clean_label:'🧹 Obsolete data cleanup',
  opt_clean_desc:'Removes zones, states and environments that no longer exist in the current game version.',
  opt_clean_desc2:'This data will be replaced by',
  opt_clean_lost_data:'"information lost over time"',
  hub_overwrite_warning_prefix:'The destination slot will be', hub_overwrite_label:'overwritten',
  hub_overwrite_warning_suffix:'Export your current save if you want to keep it.',
  btn_export_current:'Export my current save', btn_import_in_slot:'Import into this slot',
  confirm_hub_import_prefix:'Import the save from', confirm_hub_import_slot:'into Slot',
  confirm_hub_import_warning:'The current slot contents will be erased.',
  import_note_lost_data:'information lost over time',
  import_note_zones_removed:'obsolete zone(s) removed',
  notify_hub_import_prefix:'Save from', notify_hub_import_slot:'imported into Slot',
  notify_mutated:'4★ → 5★ Pokémon.', notify_cleaned:'obsolete zone(s) removed.',
  notify_click_to_play:'Click ▶ on the slot to play.',
  notify_hub_import_error:'Import error — save unchanged.',
  migration_old_save:'Old save detected',
  migration_converted:'Converted and transferred to the current slot. The old key was deleted.',
  migration_banner_title:'🔄 SAVE UPDATED', migration_from:'From', migration_schema:'schema',
  migration_new_fields:'New items added',
  migration_intact:'Your progress, Pokémon and money are intact.',
  btn_migration_ok:'OK, continue →',
};

// ── i18n helper ───────────────────────────────────────────────────────────────
// Returns the translation for key if available in the active locale, otherwise
// falls back to the provided French default string so the UI is never blank.
function _t(key, fr) {
  try {
    const lang = modalCtx.getState?.()?.lang ?? globalThis.state?.lang ?? 'fr';
    if (lang === 'fr') return fr;
    return MODAL_EN[key] ?? fr;
  } catch {
    return fr;
  }
}

let modalCtx = {};

function configureModals(ctx = {}) {
  modalCtx = { ...modalCtx, ...ctx };
}

function callCtx(name, ...args) {
  return modalCtx[name]?.(...args);
}

function getState() { return modalCtx.getState?.() ?? globalThis.state ?? {}; }
function setState(...args) { return callCtx('setState', ...args); }
function saveState(...args) { return callCtx('saveState', ...args); }
function renderAll(...args) { return callCtx('renderAll', ...args); }
function notify(...args) { return callCtx('notify', ...args); }
function migrate(raw) { return callCtx('migrate', raw) ?? raw; }
function formatPlaytime(...args) { return callCtx('formatPlaytime', ...args) ?? ''; }
function exportSave(...args) { return callCtx('exportSave', ...args); }
function createDefaultState(...args) { return callCtx('createDefaultState', ...args) ?? {}; }
function getActiveSaveSlot() { return modalCtx.getActiveSaveSlot?.() ?? 0; }
function getSaveKeys() { return modalCtx.getSaveKeys?.() ?? []; }
function getKantoDexSize() { return modalCtx.getKantoDexSize?.() ?? 151; }
function getNationalDexSize() { return modalCtx.getNationalDexSize?.() ?? 151; }
function getSaveSchemaVersion() { return modalCtx.getSaveSchemaVersion?.() ?? '?'; }
function getAgentRankLabel(...args) { return callCtx('getAgentRankLabel', ...args); }
function pokeSprite(...args) { return callCtx('pokeSprite', ...args) ?? ''; }
function speciesName(value) { return callCtx('speciesName', value) ?? value; }
function switchTab(...args) { return callCtx('switchTab', ...args); }
function showIntro(...args) { return callCtx('showIntro', ...args); }
function applyAutoMutation(...args) { return callCtx('applyAutoMutation', ...args) ?? 0; }
function cleanObsoleteData(...args) { return callCtx('cleanObsoleteData', ...args) ?? 0; }
function getSlotPreview(...args) { return callCtx('getSlotPreview', ...args); }

function showConfirm(message, onConfirm, onCancel = null, opts = {}) {
  const existing = document.getElementById('confirmModal');
  if (existing) existing.remove();
  SFX.play('menuOpen');

  const modal = document.createElement('div');
  modal.id = 'confirmModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;';

  const danger = opts.danger ? 'var(--red)' : 'var(--gold-dim)';
  const confirmLabel = opts.confirmLabel || _t('confirm_label', 'Confirmer');
  const cancelLabel  = opts.cancelLabel  || _t('cancel_label',  'Annuler');

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid ${danger};border-radius:var(--radius);padding:24px 28px;max-width:440px;width:90%;display:flex;flex-direction:column;gap:16px">
      <div style="font-size:13px;color:var(--text);line-height:1.6">${message}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="confirmModalCancel" style="font-family:var(--font-pixel);font-size:9px;padding:8px 16px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">${cancelLabel}</button>
        <button id="confirmModalOk" style="font-family:var(--font-pixel);font-size:9px;padding:8px 16px;background:${opts.danger ? 'var(--red-dark)' : 'var(--bg)'};border:1px solid ${danger};border-radius:var(--radius-sm);color:${opts.danger ? '#fff' : 'var(--gold)'};cursor:pointer">${confirmLabel}</button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  document.getElementById('confirmModalOk').addEventListener('click', () => { SFX.play('menuClose'); modal.remove(); onConfirm?.(); });
  document.getElementById('confirmModalCancel').addEventListener('click', () => { SFX.play('menuClose'); modal.remove(); onCancel?.(); });
  modal.addEventListener('click', e => { if (e.target === modal) { SFX.play('menuClose'); modal.remove(); onCancel?.(); } });
}

function showInfoModal(tabId) {
  const INFO = {
    tabGang: {
      title: _t('info_gang_title', '💀 LE GANG'),
      body: `
        <strong>${_t('info_gang_rep_label', 'Réputation')}</strong> — ${_t('info_gang_rep_desc', 'Ressource clé. Débloque zones, agents supplémentaires, achats spéciaux. Barre en haut à droite.')}<br><br>
        <strong>${_t('info_gang_money_label', 'Argent (₽)')}</strong> — ${_t('info_gang_money_desc', 'Les récompenses de combat s\'accumulent dans les zones. Collecte via l\'icône ₽ dorée ou automatiquement via tes agents.')}<br><br>
        <strong>${_t('info_gang_boss_label', 'Boss')}</strong> — ${_t('info_gang_boss_desc', 'Ton avatar. Assigne jusqu\'à <strong>6 Pokémon</strong> à son équipe depuis le PC pour renforcer les combats.')}<br><br>
        <strong>${_t('info_gang_bag_label', 'Sac')}</strong> — ${_t('info_gang_bag_desc', 'Balls actives, boosts temporaires, incubateurs. Clique une Ball pour l\'activer comme Ball par défaut.')}<br><br>
        <strong>${_t('info_gang_cosmetics_label', 'Cosmétiques')}</strong> — ${_t('info_gang_cosmetics_desc', 'Personnalise l\'apparence du boss et du gang (déblocable via achats spéciaux).')}<br><br>
        <span class="dim">${_t('info_gang_tip', 'Conseil : plus ta réputation est haute, plus les zones et agents disponibles sont puissants.')}</span>
      `
    },
    tabAgents: {
      title: _t('info_agents_title', '👥 AGENTS'),
      body: `
        <strong>${_t('info_agents_level_label', 'Niveau')}</strong> — ${_t('info_agents_level_desc', 'Toute la puissance d\'un agent. Monte en gagnant des combats et en capturant des Pokémon. Plafond : 100.')}<br><br>
        <strong>${_t('info_agents_grade_label', 'Grade')}</strong> — ${_t('info_agents_grade_desc', 'Grunt → Sergent (Lv.25) → Lieutenant (Lv.50) → Commandant (Lv.75) → Élite / Général (Lv.100). Chaque grade booste la puissance en combat.')}<br><br>
        <strong>${_t('info_agents_zone_label', 'Zone assignée')}</strong> — ${_t('info_agents_zone_desc', 'L\'agent farme passivement en background au vrai rythme de la zone : captures, combats, coffres.')}<br><br>
        <strong>${_t('info_agents_cap_label', 'Cap à 10')}</strong> — ${_t('info_agents_cap_desc', 'Les agents au-delà du 10e slot nécessitent un déblocage payant (coût croissant).')}<br><br>
        <span class="dim">${_t('info_agents_tip', 'Un agent sans zone assignée ne fait rien. Un agent de haut grade avec une bonne équipe fait une différence significative en combat.')}</span>
      `
    },
    tabZones: {
      title: _t('info_zones_title', '🗺️ ZONES'),
      body: `
        <strong>${_t('info_zones_open_label', 'Zone ouverte')}</strong> — ${_t('info_zones_open_desc', 'Fenêtre visible, spawns interactifs. Tu peux capturer et combattre manuellement. Le timer tourne au rythme de la zone.')}<br><br>
        <strong>${_t('info_zones_closed_label', 'Zone fermée + agent')}</strong> — ${_t('info_zones_closed_desc', 'Simulation silencieuse en background au vrai rythme de spawn. L\'agent capture, combat et ouvre les coffres automatiquement.')}<br><br>
        <strong>${_t('info_zones_inactive_label', 'Zone inactive')}</strong> — ${_t('info_zones_inactive_desc', 'Aucun agent assigné, rien ne se passe.')}<br><br>
        <strong>${_t('info_zones_mastery_label', 'Maîtrise ★')}</strong> — ${_t('info_zones_mastery_desc', 'S\'accumule avec les victoires dans la zone. Améliore les spawns et débloque des dresseurs d\'élite.')}<br><br>
        <strong>${_t('info_zones_raids_label', 'Raids hostiles')}</strong> — ${_t('info_zones_raids_desc', 'Un gang adverse peut attaquer tes zones tenues. Tes agents défendent automatiquement.')}<br><br>
        <strong>${_t('info_zones_slots_label', 'Slots d\'agents')}</strong> — ${_t('info_zones_slots_desc', 'Chaque zone a un maximum d\'agents assignables, déterminé par son niveau d\'investissement.')}<br><br>
        <span class="dim">${_t('info_zones_tip', 'Une zone fermée avec un bon agent est souvent plus efficace qu\'une zone ouverte sans attention.')}</span>
      `
    },
    tabMarket: {
      title: _t('info_market_title', '💰 MARCHÉ'),
      body: `
        <strong>${_t('info_market_quests_label', 'Quêtes horaires')}</strong> — ${_t('info_market_quests_desc', '3 Moyennes + 2 Difficiles, réinitialisées chaque heure. Reroll possible contre 10 REP.')}<br><br>
        <strong>${_t('info_market_session_label', 'Objectifs de session')}</strong> — ${_t('info_market_session_desc', 'Quêtes courtes actives pendant ta session. Récompenses immédiates.')}<br><br>
        <strong>${_t('info_market_balls_label', 'Balls')}</strong> — ${_t('info_market_balls_desc', 'Poké Ball — illimitée, la capture ne tombe jamais à court. Les autres types (Super, Hyper, Sombre, Master) sont des skins cosmétiques achetables ici une fois : ils changent l\'apparence de la capture mais n\'ont aucun effet sur le potentiel.')}<br><br>
        <strong>${_t('info_market_boosts_label', 'Boosts temporaires')}</strong> — ${_t('info_market_boosts_desc', 'Activés depuis le Sac dans la fenêtre de zone. Durée 60–120s. Double XP, double loot, radar shiny…')}<br><br>
        <strong>${_t('info_market_special_label', 'Achats spéciaux')}</strong> — ${_t('info_market_special_desc', 'Déblocables à la réputation : auto-vente, cosmétiques, slots supplémentaires.')}<br><br>
        <span class="dim">${_t('info_market_tip', 'Vends des Pokémon depuis le PC pour financer tes achats. Les rares et ★5 valent beaucoup plus.')}</span>
      `
    },
    tabPC: {
      title: _t('info_pc_title', '💻 PC'),
      body: `
        <strong>${_t('info_pc_power_label', 'Puissance (PC)')}</strong> — ${_t('info_pc_power_desc', 'Calculée via ATK×1.25 + DEF×0.65 + SPD×1.10 avec un soft cap à 620 (au-delà, les gains sont réduits à ×0.52). Les Pokémon très tanky (haute DEF) sont désavantagés face aux attaquants rapides.')}<br><br>
        <strong>${_t('info_pc_shiny_label', 'Shiny')}</strong> — ${_t('info_pc_shiny_desc', 'Les chromatiques ont un bonus de puissance permanent de <strong>+10%</strong> sur leur PC de base.')}<br><br>
        <strong>${_t('info_pc_variance_label', 'Variance individuelle')}</strong> — ${_t('info_pc_variance_desc', 'Chaque Pokémon reçoit un multiplicateur unique [×0.90–×1.10] assigné à la capture et stocké définitivement. Deux Pokémon identiques peuvent donc différer légèrement de PC.')}<br><br>
        <strong>${_t('info_pc_nature_label', 'Nature')}</strong> — ${_t('info_pc_nature_desc', 'Multiplie 2 stats et en pénalise 1, impactant directement le PC via la formule pondérée.')}<br><br>
        <strong>${_t('info_pc_potential_label', 'Potentiel ★')}</strong> — ${_t('info_pc_potential_desc', 'Permanent. Détermine le plafond de puissance du Pokémon. ★5 = tier S. Tiré aléatoirement à la capture, améliorable temporairement avec l\'Encens Chance.')}<br><br>
        <strong>${_t('info_pc_evo_label', 'Évolution')}</strong> — ${_t('info_pc_evo_desc', 'Via le Labo. Certaines évolutions nécessitent un niveau minimum, d\'autres une pierre. Les stats augmentent significativement.')}<br><br>
        <strong>${_t('info_pc_daycare_label', 'Pension')}</strong> — ${_t('info_pc_daycare_desc', '2 Pokémon compatibles produisent un œuf (incubateur requis). L\'œuf hérite du potentiel des parents.')}<br><br>
        <strong>${_t('info_pc_training_label', 'Salle d\'entraînement')}</strong> — ${_t('info_pc_training_desc', 'Monte en niveau des Pokémon passifs. Coût en ₽ croissant avec le niveau.')}<br><br>
        <strong>${_t('info_pc_sell_label', 'Vente')}</strong> — ${_t('info_pc_sell_desc', 'Prix = rareté × potentiel × nature. Pas de malus à la revente.')}<br><br>
        <span class="dim">${_t('info_pc_tip', 'Filtre par rareté, type ou ★ pour retrouver tes meilleurs Pokémon rapidement.')}</span>
      `
    },
    tabPokedex: {
      title: _t('info_pokedex_title', '📖 POKÉDEX'),
      body: `
        <strong>${_t('info_pokedex_seen_label', 'Vu 👁')}</strong> — ${_t('info_pokedex_seen_desc', 'Ce Pokémon est apparu dans une zone (spawn visible ou background).')}<br><br>
        <strong>${_t('info_pokedex_caught_label', 'Capturé ✓')}</strong> — ${_t('info_pokedex_caught_desc', 'Tu en possèdes au moins un dans ton PC.')}<br><br>
        <strong>${_t('info_pokedex_shiny_label', 'Shiny ✨')}</strong> — ${_t('info_pokedex_shiny_desc', 'Version chromatique capturée. Chance de base très faible — boostée par les atouts Radar Shiny et les boosts temporaires.')}<br><br>
        <strong>${_t('info_pokedex_progress_label', 'Progression')}</strong> — ${_t('info_pokedex_progress_desc', 'Compléter le Pokédex Kanto donne des REP et déblocages. Gen 2 (Johto) disponible dès le départ. Un événement spécial débloque un aperçu de la Gen 3 (Sinnoh).')}<br><br>
        <strong>${_t('info_pokedex_stats_label', 'Stats du joueur')}</strong> — ${_t('info_pokedex_stats_desc', 'Capture assez de Pokémon d\'une espèce pour débloquer des bonus permanents (via le Pokédex étendu).')}<br><br>
        <span class="dim">${_t('info_pokedex_tip', 'Légendaires et très rares n\'apparaissent que dans des zones spécifiques à haute maîtrise.')}</span>
      `
    },
  };

  const info = INFO[tabId];
  if (!info) return;

  document.getElementById('infoModalTitle').textContent = info.title;
  document.getElementById('infoModalBody').innerHTML = info.body;
  document.getElementById('infoModal').classList.add('active');
}

// ── Dopamine popups — shiny / rare aperçu ─────────────────────────────────
function getOpenZones() { return modalCtx.getOpenZones?.() ?? new Set(); }
function renderZonesTab(...args) { return callCtx('renderZonesTab', ...args); }

let _shinyPopupTimer = null;

function showShinyPopup(species_en) {
  try {
    const el = document.getElementById('shinyPopup');
    const sprite = document.getElementById('shinyPopupSprite');
    const label  = document.getElementById('shinyPopupLabel');
    if (!el) return;
    sprite.src = pokeSprite(species_en, true);
    label.textContent = _t('shiny_popup_prefix', '✨ SHINY ') + speciesName(species_en) + ' !';
    el.classList.add('show');
    clearTimeout(_shinyPopupTimer);
    _shinyPopupTimer = setTimeout(() => el.classList.remove('show'), 3000);
  } catch {}
}

let _rarePopupTimer = null;

function showRarePopup(species_en, zoneId) {
  try {
    const el     = document.getElementById('rarePopup');
    const sprite = document.getElementById('rarePopupSprite');
    const label  = document.getElementById('rarePopupLabel');
    const hint   = document.getElementById('rarePopupHint');
    if (!el) return;
    const state = getState();
    sprite.src = pokeSprite(species_en);
    label.textContent = _t('rare_popup_prefix', '⚡ Rare aperçu : ') + speciesName(species_en);

    // Afficher le nom de la zone et le hint cliquable
    if (zoneId && hint) {
      const zone = ZONE_BY_ID[zoneId];
      const zoneName = zone ? (state.lang === 'fr' ? zone.fr : zone.en) : zoneId;
      hint.textContent = `→ ${zoneName}`;
    } else if (hint) {
      hint.textContent = '';
    }

    // Stocker le zoneId pour le clic
    el.dataset.targetZone = zoneId || '';

    el.classList.add('show');
    clearTimeout(_rarePopupTimer);
    _rarePopupTimer = setTimeout(() => el.classList.remove('show'), 3500);
  } catch {}
}

let _miniCombatPopupTimer = null;

/**
 * Popup compacte pour un combat auto-résolu (dresseur/raid) hors du champ de
 * vision du joueur — zone fermée (agent seul) ou zone ouverte mais onglet
 * Zones pas actif. "Dernier seulement" : un nouvel appel remplace l'affichage
 * en cours plutôt que de faire la queue (cf. showShinyPopup/showRarePopup).
 */
function showMiniCombatPopup({ win, zoneId, trainerKey, trainerName, agentSprite, reward = 0, repGain = 0 } = {}) {
  try {
    const el     = document.getElementById('miniCombatPopup');
    const agentImg = document.getElementById('miniCombatPopupAgent');
    const enemyImg = document.getElementById('miniCombatPopupEnemy');
    const label  = document.getElementById('miniCombatPopupLabel');
    const detail = document.getElementById('miniCombatPopupDetail');
    if (!el) return;
    const state = getState();

    agentImg.src = agentSprite || '';
    enemyImg.src = globalThis.trainerSprite?.(trainerKey) || '';
    label.textContent = win
      ? `${_t('mini_combat_win_prefix', '⚔ Victoire — ')}${trainerName}`
      : `${_t('mini_combat_lose_prefix', '💀 Défaite — ')}${trainerName}`;

    const zone = ZONE_BY_ID[zoneId];
    const zoneName = zone ? (state.lang === 'fr' ? zone.fr : zone.en) : (zoneId || '');
    detail.textContent = win
      ? `${zoneName} · +${reward.toLocaleString()}₽ +${repGain}rep`
      : `${zoneName} · ${_t('mini_combat_lost_fight', 'combat perdu')}`;

    el.dataset.targetZone = zoneId || '';
    el.classList.toggle('win',  !!win);
    el.classList.toggle('lose', !win);

    el.classList.add('show');
    clearTimeout(_miniCombatPopupTimer);
    _miniCombatPopupTimer = setTimeout(() => el.classList.remove('show'), 4000);
  } catch {}
}

// Ouvre/affiche la fenêtre de la zone ciblée et y scrolle avec un bref
// surlignage — logique partagée par tous les popups cliquables qui renvoient
// vers une zone (mini-combat, rare aperçu).
function _focusZoneWindow(zoneId) {
  if (!zoneId) return;
  switchTab('tabZones');
  const openZones = getOpenZones();
  if (!openZones.has(zoneId)) {
    openZones.add(zoneId);
    const state = getState();
    if (!state.openZoneOrder) state.openZoneOrder = [];
    if (!state.openZoneOrder.includes(zoneId)) state.openZoneOrder.push(zoneId);
  }
  renderZonesTab();
  setTimeout(() => {
    const zoneWin = document.getElementById(`zw-${zoneId}`);
    zoneWin?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    zoneWin?.classList.add('zone-highlight');
    setTimeout(() => zoneWin?.classList.remove('zone-highlight'), 1500);
  }, 100);
}

// ── Clic sur la popup mini-combat → switch vers la zone ────────
(function _bindMiniCombatPopupClick() {
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('miniCombatPopup');
    if (!el) return;
    el.addEventListener('click', () => {
      const zoneId = el.dataset.targetZone;
      clearTimeout(_miniCombatPopupTimer);
      el.classList.remove('show');
      _focusZoneWindow(zoneId);
    });
  });
})();

// ── Clic sur le popup rare → switch vers la zone ──────────────
(function _bindRarePopupClick() {
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('rarePopup');
    if (!el) return;
    el.addEventListener('click', () => {
      const zoneId = el.dataset.targetZone;
      if (!zoneId) return;
      clearTimeout(_rarePopupTimer);
      el.classList.remove('show');
      _focusZoneWindow(zoneId);
    });
  });
})();

function openImportPreviewModal(raw) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:20000;display:flex;align-items:center;justify-content:center;padding:16px';

  // ── Analyse de la save importée ──────────────────────────────────────────
  const schemaVer   = raw._schemaVersion ?? raw.version ?? '?';
  const isLegacy    = !raw.eggs || !raw.pension || !raw.trainingRoom;
  const isVeryOld   = !raw.gang || !raw.pokemons;
  const gangName    = raw.gang?.name    ?? '—';
  const bossName    = raw.gang?.bossName ?? '—';
  const reputation  = (raw.gang?.reputation ?? 0).toLocaleString();
  const money       = (raw.gang?.money ?? 0).toLocaleString();
  const pokeCount   = (raw.pokemons  || []).length;
  const agentCount  = (raw.agents    || []).length;
  const _dexRaw     = raw.pokedex || {};
  const dexKanto    = POKEMON_GEN1.filter(s => !s.hidden && s.dex >= 1 && s.dex <= 151 && _dexRaw[s.en]?.caught).length;
  const dexCaught   = POKEMON_GEN1.filter(s => !s.hidden && _dexRaw[s.en]?.caught).length;
  const shinyCount  = POKEMON_GEN1.filter(s => !s.hidden && _dexRaw[s.en]?.shiny).length;
  const savedAt     = raw._savedAt ? new Date(raw._savedAt).toLocaleString('fr-FR') : '—';
  const playtime    = raw.playtime  ? formatPlaytime(raw.playtime) : '—';

  // ── Liste des champs qui seront ajoutés/migrés ───────────────────────────
  const migrations = [];
  if (!raw.eggs)             migrations.push(_t('mig_eggs',           'Système d\'œufs'));
  if (!raw.pension)          migrations.push(_t('mig_pension',        'Pension'));
  if (!raw.trainingRoom)     migrations.push(_t('mig_training',       'Salle d\'entraînement'));
  if (!raw.missions)         migrations.push(_t('mig_missions',       'Missions'));
  if (!raw.cosmetics)        migrations.push(_t('mig_cosmetics',      'Cosmétiques'));
  if (!raw.unlockedTitles)   migrations.push(_t('mig_titles',         'Titres débloqués'));
  if (raw.gang?.titleC === undefined) migrations.push(_t('mig_title_slots', 'Slots de titres (×4)'));
  if (!raw.behaviourLogs)    migrations.push(_t('mig_logs',           'Logs comportementaux'));
  if (!raw.lab)              migrations.push(_t('mig_lab',            'Laboratoire'));
  if (!raw.purchases)        migrations.push(_t('mig_purchases',      'Achats spéciaux'));
  if (!raw.eggs && !raw.inventory?.incubator) migrations.push(_t('mig_incubator', 'Inventaire incubateurs'));
  if (raw.settings?.uiScale === undefined) migrations.push(_t('mig_ui_settings', 'Paramètres UI avancés'));

  const migHtml = migrations.length
    ? migrations.map(m => `<div style="display:flex;gap:6px;align-items:center;font-size:8px;color:var(--text-dim)"><span style="color:var(--green)">✓</span>${m}</div>`).join('')
    : `<div style="font-size:8px;color:var(--green)">${_t('mig_none', 'Aucune migration nécessaire — save à jour')}</div>`;

  const versionBadge = isLegacy
    ? `<span style="font-size:7px;padding:2px 6px;border-radius:8px;background:rgba(255,160,0,.15);border:1px solid #ffa000;color:#ffa000">${_t('badge_legacy', 'Version ancienne')}</span>`
    : `<span style="font-size:7px;padding:2px 6px;border-radius:8px;background:rgba(0,200,100,.1);border:1px solid var(--green);color:var(--green)">${_t('badge_compatible', 'Format compatible')}</span>`;

  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:24px;max-width:620px;width:100%;max-height:90vh;overflow-y:auto;display:flex;flex-direction:column;gap:16px">

      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-family:var(--font-pixel);font-size:11px;color:var(--gold)">${_t('import_modal_title', '📥 Importer une Save')}</div>
        <button id="btnImportClose" style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer">✕</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">

        <!-- Infos save importée -->
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim)">${_t('import_save_label', 'SAVE IMPORTÉE')}</div>
            ${versionBadge}
          </div>
          <div style="font-family:var(--font-pixel);font-size:12px;color:var(--red)">${_esc(gangName)}</div>
          <div style="font-size:9px;color:var(--text-dim)">${_t('import_boss_label', 'Boss')} : <span style="color:var(--text)">${_esc(bossName)}</span></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:4px">
            <div style="font-size:8px;color:var(--text-dim)">🎯 ${_t('import_pokemon_count', 'Pokémon')} <span style="color:var(--text)">${pokeCount}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">👤 ${_t('import_agents_count', 'Agents')} <span style="color:var(--text)">${agentCount}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">⭐ ${_t('import_rep_count', 'Rép.')} <span style="color:var(--gold)">${reputation}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">₽ <span style="color:var(--text)">${money}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">📖 Kanto <span style="color:var(--text)">${dexKanto}/${getKantoDexSize()}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">🌐 ${_t('import_national_label', 'National')} <span style="color:var(--text)">${dexCaught}/${getNationalDexSize()}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">✨ ${_t('import_shiny_species', 'Espèces chromas')} <span style="color:var(--text)">${shinyCount}</span></div>
          </div>
          <div style="font-size:7px;color:var(--text-dim);border-top:1px solid var(--border);padding-top:6px;margin-top:2px">
            ${_t('import_saved_at', 'Sauvegardé le')} ${savedAt}<br>${_t('import_playtime', 'Temps de jeu')} : ${playtime} · ${_t('import_schema', 'Schéma')} v${schemaVer}
          </div>
        </div>

        <!-- Champs à migrer -->
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;gap:6px">
          <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:4px">${_t('import_auto_migration', 'MIGRATION AUTOMATIQUE')}</div>
          ${migHtml}
        </div>
      </div>

      <!-- Avertissement écrasement -->
      <div style="background:rgba(204,51,51,.08);border:1px solid rgba(204,51,51,.3);border-radius:var(--radius-sm);padding:10px;font-size:9px;color:var(--text-dim)">
        ⚠ <b style="color:var(--red)">${_t('import_full_label', 'Import complet')}</b> : ${_t('import_overwrite_warning', 'remplacera définitivement la save active')} (slot ${getActiveSaveSlot() + 1}).
        ${_t('import_backup_hint', 'Exporte d\'abord ta save actuelle si tu veux la conserver.')}
      </div>

      <div style="display:flex;flex-direction:column;gap:8px">
        <button id="btnImportBackupFirst" style="font-family:var(--font-pixel);font-size:8px;padding:8px 12px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer;text-align:left">
          💾 ${_t('btn_export_before_import', 'Exporter ma save actuelle avant d\'importer')}
        </button>
        <div style="display:flex;gap:8px">
          <button id="btnImportFull" style="flex:2;font-family:var(--font-pixel);font-size:9px;padding:12px;background:var(--bg);border:2px solid var(--gold);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">
            ⚡ ${_t('btn_import_full', 'Import complet')}<br><span style="font-size:7px;color:var(--text-dim);font-family:sans-serif">${_t('btn_import_full_sub', 'Tous les données migrées automatiquement')}</span>
          </button>
          ${isLegacy ? `<button id="btnImportHeritage" style="flex:1;font-family:var(--font-pixel);font-size:9px;padding:12px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
            🏆 ${_t('btn_import_heritage', 'Mode héritage')}<br><span style="font-size:7px;font-family:sans-serif">${_t('btn_import_heritage_sub', '1 agent + 2 Pokémon')}</span>
          </button>` : ''}
        </div>
        <button id="btnImportCancel" style="font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
          ${_t('btn_cancel', 'Annuler')}
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#btnImportClose')?.addEventListener('click',  () => overlay.remove());
  overlay.querySelector('#btnImportCancel')?.addEventListener('click', () => overlay.remove());

  overlay.querySelector('#btnImportBackupFirst')?.addEventListener('click', () => {
    exportSave();
    overlay.querySelector('#btnImportBackupFirst').textContent = `✅ ${_t('btn_exported_ok', 'Save actuelle exportée !')}`;
    overlay.querySelector('#btnImportBackupFirst').style.color = 'var(--green)';
  });

  overlay.querySelector('#btnImportFull')?.addEventListener('click', () => {
    showConfirm(
      `${_t('confirm_import_replace', 'Remplacer la save du slot')} ${getActiveSaveSlot() + 1} ${_t('confirm_import_by', 'par la save importée de')} "${gangName}" ?`,
      () => {
        try {
          setState(migrate(raw));
          saveState();
          overlay.remove();
          renderAll();
          notify(`✅ ${_t('notify_import_success_prefix', 'Save de')} "${gangName}" ${_t('notify_import_success_suffix', 'importée et convertie au format actuel.')}`, 'success');
        } catch (err) {
          notify(_t('notify_import_error', 'Erreur lors de la conversion — save non-importée.'), 'error');
          console.error(err);
        }
      },
      null,
      { confirmLabel: _t('btn_import_confirm', 'Importer'), cancelLabel: _t('btn_cancel', 'Annuler') }
    );
  });

  overlay.querySelector('#btnImportHeritage')?.addEventListener('click', () => {
    overlay.remove();
    openLegacyImportModal(raw);
  });
}



function openLegacyImportModal(legacyData) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';

  const agents = legacyData.agents || [];
  const pokemons = legacyData.pokemons || [];

  const agentHtml = agents.length
    ? agents.map(a => `<label style="display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid var(--border);cursor:pointer">
        <input type="radio" name="legacyAgent" value="${a.id}" style="accent-color:var(--gold)">
        <img src="${a.sprite || ''}" style="width:32px;height:32px" onerror="this.style.display='none'">
        <span style="font-size:10px">${a.name} — Lv.${a.level} (${getAgentRankLabel?.(a) ?? a.title})</span>
      </label>`).join('')
    : `<div style="color:var(--text-dim);font-size:10px;padding:8px">${_t('legacy_no_agent', 'Aucun agent dans cette save')}</div>`;

  const pokeHtml = pokemons.slice(0, 60).map(p => `<label style="display:flex;align-items:center;gap:6px;padding:4px;border-bottom:1px solid var(--border);cursor:pointer">
      <input type="checkbox" name="legacyPoke" value="${p.id}" style="accent-color:var(--gold)">
      <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:28px;height:28px">
      <span style="font-size:9px">${speciesName(p.species_en)} Lv.${p.level} ${'*'.repeat(p.potential)}${p.shiny?' [S]':''}</span>
    </label>`).join('') || `<div style="color:var(--text-dim);font-size:10px">${_t('legacy_no_pokemon', 'Aucun Pokémon')}</div>`;

  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto">
      <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold);margin-bottom:8px">${_t('legacy_modal_title', 'IMPORT HERITAGE')}</div>
      <div style="font-size:10px;color:var(--text-dim);margin-bottom:16px">
        ${_t('legacy_intro', 'Save d\'une version antérieure détectée. Tu peux conserver')} <b style="color:var(--text)">1 ${_t('legacy_agent', 'agent')}</b> ${_t('legacy_and', 'et')} <b style="color:var(--text)">2 ${_t('legacy_pokemon', 'Pokémon')}</b>.<br>
        ${_t('legacy_egg_hint', 'Les 2 Pokémon seront placés à la Pension pour pondre un oeuf de départ.')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:8px">${_t('legacy_pick_agent', 'CHOISIR 1 AGENT')}</div>
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:200px;overflow-y:auto">${agentHtml}</div>
        </div>
        <div>
          <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:8px">${_t('legacy_pick_pokemon', 'CHOISIR 2 POKEMON')}</div>
          <div id="legacyPokeCount" style="font-size:9px;color:var(--red);margin-bottom:4px">${_t('legacy_poke_count', '0/2 sélectionnés')}</div>
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:200px;overflow-y:auto">${pokeHtml}</div>
        </div>
      </div>

      <div style="margin-top:16px;display:flex;gap:8px">
        <button id="btnLegacyConfirm" style="flex:1;font-family:var(--font-pixel);font-size:10px;padding:10px;background:var(--bg);border:2px solid var(--gold);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">${_t('btn_legacy_start', 'COMMENCER')}</button>
        <button id="btnLegacyCancel" style="font-family:var(--font-pixel);font-size:10px;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">${_t('btn_cancel', 'Annuler')}</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Limit pokemon checkboxes to 2
  overlay.querySelectorAll('input[name="legacyPoke"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const checked = [...overlay.querySelectorAll('input[name="legacyPoke"]:checked')];
      const countEl = document.getElementById('legacyPokeCount');
      if (checked.length > 2) { cb.checked = false; return; }
      if (countEl) countEl.textContent = `${checked.length}/2 ${_t('legacy_selected', 'sélectionnés')}`;
    });
  });

  document.getElementById('btnLegacyCancel')?.addEventListener('click', () => overlay.remove());

  document.getElementById('btnLegacyConfirm')?.addEventListener('click', () => {
    const agentId = overlay.querySelector('input[name="legacyAgent"]:checked')?.value;
    const pokeIds = [...overlay.querySelectorAll('input[name="legacyPoke"]:checked')].map(cb => cb.value);

    if (pokeIds.length !== 2) {
      notify(_t('notify_select_2_pokemon', 'Sélectionne exactement 2 Pokémon.')); return;
    }

    // Build fresh state
    const fresh = createDefaultState();
    // Transfer gang basics from legacy
    fresh.gang.name = legacyData.gang?.name || _t('default_gang_name', 'La Gang');
    fresh.gang.bossName = legacyData.gang?.bossName || _t('default_boss_name', 'Boss');
    fresh.gang.bossSprite = legacyData.gang?.bossSprite || 'rocketgrunt';

    // Transfer chosen agent
    if (agentId) {
      const agent = agents.find(a => a.id === agentId);
      if (agent) {
        agent.team = []; // reset team
        agent.pendingPerk = false;
        fresh.agents = [agent];
      }
    }

    // Transfer chosen pokemon to pension
    const chosenPokes = pokeIds.map(id => pokemons.find(p => p.id === id)).filter(Boolean);
    chosenPokes.forEach(p => { p.homesick = true; });
    fresh.pokemons = chosenPokes;
    fresh.pension.slots = chosenPokes.slice(0, 2).map(p => p.id);
    fresh.pension.eggAt = Date.now() + 60000; // first egg in 1 minute

    setState(migrate(fresh));
    saveState();
    overlay.remove();
    renderAll();
    notify(_t('notify_legacy_started', 'Nouvelle partie héritée commencée ! Les Pokémon sont à la Pension.'), 'gold');
    switchTab('tabPC');
  });
}



function openHubImportModal(raw) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';

  // ── Save preview data ────────────────────────────────────────────────────
  const gangName    = raw.gang?.name     ?? '—';
  const bossName    = raw.gang?.bossName ?? '—';
  const reputation  = (raw.gang?.reputation ?? 0).toLocaleString();
  const money       = (raw.gang?.money ?? 0).toLocaleString();
  const pokeCount   = (raw.pokemons  || []).length;
  const count4star  = (raw.pokemons  || []).filter(p => p.potential === 4).length;
  const count4shiny = (raw.pokemons  || []).filter(p => p.potential === 4 && p.shiny).length;
  const agentCount  = (raw.agents    || []).length;
  const rawDex      = raw.pokedex || {};
  const dexKanto    = POKEMON_GEN1.filter(s => !s.hidden && s.dex >= 1 && s.dex <= 151 && rawDex[s.en]?.caught).length;
  const dexNat      = POKEMON_GEN1.filter(s => !s.hidden && rawDex[s.en]?.caught).length;
  const shinyCount  = POKEMON_GEN1.filter(s => !s.hidden && rawDex[s.en]?.shiny).length;
  const savedAt     = raw._savedAt ? new Date(raw._savedAt).toLocaleString('fr-FR') : '—';
  const playtime    = raw.playtime  ? formatPlaytime(raw.playtime) : '—';
  const schemaVer   = raw._schemaVersion ?? raw.version ?? '?';

  // Detect potential orphan zones
  const validIds = new Set(ZONES.map(z => z.id));
  const orphanZones = Object.keys(raw.zones || {}).filter(id => !validIds.has(id));

  // ── Slot picker HTML ─────────────────────────────────────────────────────
  const slotHtml = [0, 1, 2].map(i => {
    const prev = getSlotPreview(i);
    const label = prev
      ? `<b style="color:var(--text)">${prev.name}</b> <span style="color:var(--text-dim);font-size:9px">(${prev.pokemon} pkm · ⭐${prev.rep})</span>`
      : `<span style="color:#555;font-style:italic">${_t('slot_empty', 'Vide')}</span>`;
    return `<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;background:var(--bg);transition:border-color .15s" id="hubSlotLabel${i}">
      <input type="radio" name="hubTargetSlot" value="${i}" ${i === 0 ? 'checked' : ''} style="accent-color:var(--gold)">
      <span style="font-family:var(--font-pixel);font-size:8px;color:var(--gold)">SLOT ${i+1}</span>
      <span style="font-size:10px">${label}</span>
    </label>`;
  }).join('');

  // ── Warnings ─────────────────────────────────────────────────────────────
  const warnMutation = count4star > 0
    ? `<span style="color:#ffa040">${count4star} ${_t('warn_4star_detected', 'Pokémon 4★ détectés')}${count4shiny > 0 ? ` (${_t('warn_including', 'dont')} ${count4shiny} ✨ shiny)` : ''} — ${_t('warn_will_upgrade', 'tous passeront en 5★')}</span>`
    : `<span style="color:var(--text-dim)">${_t('warn_no_4star', 'Aucun Pokémon 4★ détecté')}</span>`;
  const warnClean = orphanZones.length > 0
    ? `<span style="color:#ffa040">${orphanZones.length} ${_t('warn_orphan_zones', 'zone(s) obsolète(s) supprimée(s)')}</span>`
    : `<span style="color:var(--text-dim)">${_t('warn_no_orphan', 'Aucune zone obsolète')}</span>`;

  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid #ffa040;border-radius:var(--radius);padding:24px;max-width:640px;width:100%;max-height:92vh;overflow-y:auto;display:flex;flex-direction:column;gap:16px">

      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-family:var(--font-pixel);font-size:11px;color:#ffa040">${_t('hub_import_title', '📥 Importer une Save')}</div>
        <button id="btnHubImportClose" style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer">✕</button>
      </div>

      <!-- Save preview -->
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;gap:6px">
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:4px">${_t('hub_imported_save', 'SAVE IMPORTÉE')}</div>
        <div style="font-family:var(--font-pixel);font-size:13px;color:var(--red)">${_esc(gangName)}</div>
        <div style="font-size:9px;color:var(--text-dim)">${_t('import_boss_label', 'Boss')} : <span style="color:var(--text)">${_esc(bossName)}</span></div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:4px">
          <div style="font-size:8px;color:var(--text-dim)">🎯 ${_t('import_pokemon_count', 'Pokémon')} <span style="color:var(--text)">${pokeCount}</span></div>
          <div style="font-size:8px;color:var(--text-dim)">👤 ${_t('import_agents_count', 'Agents')} <span style="color:var(--text)">${agentCount}</span></div>
          <div style="font-size:8px;color:var(--text-dim)">⭐ ${_t('import_rep_count', 'Rép.')} <span style="color:var(--gold)">${reputation}</span></div>
          <div style="font-size:8px;color:var(--text-dim)">₽ <span style="color:var(--text)">${money}</span></div>
          <div style="font-size:8px;color:var(--text-dim)">📖 ${_t('hub_pokedex_kanto', 'Pokédex Kanto')} <span style="color:var(--text)">${dexKanto}/151</span> <span style="opacity:.6">(${_t('hub_national', 'Nat.')} ${dexNat})</span></div>
          <div style="font-size:8px;color:var(--text-dim)">✨ ${_t('import_shiny_species', 'Espèces chroma')} <span style="color:var(--text)">${shinyCount}</span></div>
        </div>
        <div style="font-size:7px;color:var(--text-dim);border-top:1px solid var(--border);padding-top:6px;margin-top:2px">
          ${_t('import_saved_at', 'Sauvegardé le')} ${savedAt} · ${_t('import_playtime', 'Temps de jeu')} : ${playtime} · ${_t('import_schema', 'Schéma')} v${schemaVer}
        </div>
      </div>

      <!-- Slot picker -->
      <div>
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold);margin-bottom:8px;letter-spacing:1px">${_t('hub_slot_dest', 'SLOT DE DESTINATION')}</div>
        <div style="display:flex;flex-direction:column;gap:6px" id="hubSlotPicker">
          ${slotHtml}
        </div>
      </div>

      <!-- Options -->
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold);letter-spacing:1px">${_t('hub_import_options', 'OPTIONS D\'IMPORT')}</div>

        <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);cursor:pointer">
          <input type="checkbox" id="chkAutoMutation" ${count4star > 0 ? 'checked' : ''} style="margin-top:2px;accent-color:var(--gold)">
          <div>
            <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text);margin-bottom:3px">${_t('opt_mutation_label', '⚡ Mutation auto 4★ → 5★')}</div>
            <div style="font-size:9px;color:var(--text-dim)">${_t('opt_mutation_desc', 'Améliore tous les Pokémon 4★ en 5★ automatiquement.')}<br>${_t('opt_mutation_desc2', 'Priorité : ✨ shiny → niveau → ordre PC. Les shinys ne seront jamais utilisés comme matière première.')}</div>
            <div style="font-size:8px;margin-top:4px">${warnMutation}</div>
          </div>
        </label>

        <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);cursor:pointer">
          <input type="checkbox" id="chkCleanObsolete" ${orphanZones.length > 0 ? 'checked' : ''} style="margin-top:2px;accent-color:var(--gold)">
          <div>
            <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text);margin-bottom:3px">${_t('opt_clean_label', '🧹 Nettoyage des données obsolètes')}</div>
            <div style="font-size:9px;color:var(--text-dim)">${_t('opt_clean_desc', 'Supprime les zones, états et environnements qui n\'existent plus dans la version actuelle du jeu.')}<br>${_t('opt_clean_desc2', 'Ces données seront remplacées par')} <i>${_t('opt_clean_lost_data', '"information perdue avec le temps"')}</i>.</div>
            <div style="font-size:8px;margin-top:4px">${warnClean}</div>
          </div>
        </label>
      </div>

      <!-- Warning -->
      <div style="background:rgba(255,140,0,.08);border:1px solid rgba(255,140,0,.3);border-radius:var(--radius-sm);padding:10px;font-size:9px;color:var(--text-dim)">
        ⚠ ${_t('hub_overwrite_warning_prefix', 'Le slot de destination sera')} <b style="color:#ffa040">${_t('hub_overwrite_label', 'écrasé')}</b>. ${_t('hub_overwrite_warning_suffix', 'Exporte ta save actuelle si tu veux la conserver.')}
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:8px">
        <button id="btnHubImportBackup" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:10px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
          💾 ${_t('btn_export_current', 'Exporter ma save actuelle')}
        </button>
        <button id="btnHubImportConfirm" style="flex:2;font-family:var(--font-pixel);font-size:9px;padding:10px;background:var(--bg);border:2px solid #ffa040;border-radius:var(--radius-sm);color:#ffa040;cursor:pointer">
          📥 ${_t('btn_import_in_slot', 'Importer dans ce slot')}
        </button>
      </div>
      <button id="btnHubImportCancel" style="font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
        ${_t('btn_cancel', 'Annuler')}
      </button>

    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#btnHubImportClose')?.addEventListener('click',  () => overlay.remove());
  overlay.querySelector('#btnHubImportCancel')?.addEventListener('click', () => overlay.remove());

  // Slot label hover effect
  overlay.querySelectorAll('#hubSlotPicker label').forEach(lbl => {
    lbl.addEventListener('mouseenter', () => lbl.style.borderColor = '#ffa040');
    lbl.addEventListener('mouseleave', () => lbl.style.borderColor = 'var(--border)');
  });

  overlay.querySelector('#btnHubImportBackup')?.addEventListener('click', () => {
    exportSave();
    const btn = overlay.querySelector('#btnHubImportBackup');
    btn.textContent = `✅ ${_t('btn_exported_ok', 'Save exportée !')}`;
    btn.style.color = 'var(--green)';
  });

  overlay.querySelector('#btnHubImportConfirm')?.addEventListener('click', () => {
    const targetSlot = parseInt(overlay.querySelector('input[name="hubTargetSlot"]:checked')?.value ?? '0');
    const doMutation = overlay.querySelector('#chkAutoMutation')?.checked ?? false;
    const doClean    = overlay.querySelector('#chkCleanObsolete')?.checked ?? false;

    showConfirm(
      `${_t('confirm_hub_import_prefix', 'Importer la save de')} <b>${gangName}</b> ${_t('confirm_hub_import_slot', 'dans le Slot')} ${targetSlot + 1} ?<br><span style="color:var(--text-dim);font-size:10px">${_t('confirm_hub_import_warning', 'Le contenu actuel du slot sera effacé.')}</span>`,
      () => {
        try {
          // Deep clone before mutation
          const draft = JSON.parse(JSON.stringify(raw));

          // Apply optional steps before migration
          let mutated = 0, cleaned = 0;
          if (doMutation && draft.pokemons) mutated = applyAutoMutation(draft.pokemons);
          if (doClean)                      cleaned  = cleanObsoleteData(draft);

          // Full migration to current schema
          const migrated = migrate(draft);

          // Add cleaned-zone log if relevant
          if (doClean && cleaned > 0) {
            if (!migrated.behaviourLogs) migrated.behaviourLogs = {};
            migrated.behaviourLogs._importCleanedZones = cleaned;
            if (!migrated._importNotes) migrated._importNotes = [];
            migrated._importNotes.push(`${_t('import_note_lost_data', 'information perdue avec le temps')} (${cleaned} ${_t('import_note_zones_removed', 'zone(s) obsolète(s) supprimée(s)')})`);
          }

          // Save to the target slot (don't affect current active game)
          localStorage.setItem(getSaveKeys()[targetSlot], JSON.stringify(migrated));

          overlay.remove();

          // Compose summary message
          const parts = [`✅ ${_t('notify_hub_import_prefix', 'Save de')} "${gangName}" ${_t('notify_hub_import_slot', 'importée dans le Slot')} ${targetSlot + 1}.`];
          if (mutated > 0) parts.push(`⚡ ${mutated} ${_t('notify_mutated', 'Pokémon 4★ → 5★.')}`);
          if (cleaned > 0) parts.push(`🧹 ${cleaned} ${_t('notify_cleaned', 'zone(s) obsolète(s) supprimée(s).')}`);
          parts.push(_t('notify_click_to_play', 'Clique ▶ sur le slot pour jouer.'));
          notify(parts.join(' '), 'success');

          // Refresh hub slot display if introOverlay is visible
          const introSlots = document.getElementById('introSlots');
          if (introSlots) {
            const introOverlay = document.getElementById('introOverlay');
            if (introOverlay?.classList.contains('active')) {
              introOverlay.classList.remove('active');
              showIntro();
            }
          }
        } catch (err) {
          notify(_t('notify_hub_import_error', 'Erreur lors de l\'importation — save non modifiée.'), 'error');
          console.error(err);
        }
      },
      null,
      { confirmLabel: _t('btn_import_confirm', 'Importer'), cancelLabel: _t('btn_cancel', 'Annuler') }
    );
  });
}



function showMigrationBanner({ from, toLegacyKey, fields }) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:12000;
    display:flex;align-items:center;justify-content:center;padding:16px;
    animation:fadeIn .3s ease
  `;
  const fieldsHtml = fields.length
    ? `<ul style="margin:8px 0 0 0;padding-left:18px;font-size:9px;color:var(--text-dim);line-height:1.8">
        ${fields.map(f => `<li>${f}</li>`).join('')}
      </ul>`
    : '';
  const legacyNote = toLegacyKey
    ? `<div style="margin-top:8px;font-size:9px;color:var(--red);background:rgba(255,0,0,.07);padding:6px 8px;border-radius:4px;border-left:2px solid var(--red)">
        ⚠ ${_t('migration_old_save', 'Ancienne sauvegarde détectée')} (<code style="font-size:9px">${toLegacyKey}</code>).<br>
        ${_t('migration_converted', 'Convertie et transférée vers le slot actuel. L\'ancienne clé a été supprimée.')}
      </div>`
    : '';

  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);
                padding:22px 24px;max-width:420px;width:100%;box-shadow:0 8px 40px rgba(0,0,0,.6)">
      <div style="font-family:var(--font-pixel);font-size:11px;color:var(--gold);margin-bottom:4px">
        ${_t('migration_banner_title', '🔄 SAVE MISE À JOUR')}
      </div>
      <div style="font-size:10px;color:var(--text-dim);margin-bottom:4px">
        ${_t('migration_from', 'Depuis')} : <span style="color:var(--text)">${from}</span> →
        ${_t('migration_schema', 'schéma')} <span style="color:var(--gold)">v${getSaveSchemaVersion()}</span>
      </div>
      ${fields.length ? `<div style="font-size:9px;color:var(--text-dim);margin-top:6px">${_t('migration_new_fields', 'Nouveaux éléments ajoutés')} :</div>${fieldsHtml}` : ''}
      ${legacyNote}
      <div style="margin-top:8px;font-size:9px;color:var(--text-dim)">
        ${_t('migration_intact', 'Ta progression, Pokémon et argent sont intacts.')} ✅
      </div>
      <div style="margin-top:16px;text-align:right">
        <button id="btnMigrationOk" class="btn-gold" style="padding:6px 20px;font-size:10px">
          ${_t('btn_migration_ok', 'OK, continuer →')}
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#btnMigrationOk').addEventListener('click', () => {
    overlay.remove();
    saveState(); // persiste le nouveau schéma
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}



export {
  configureModals,
  openHubImportModal,
  openImportPreviewModal,
  openLegacyImportModal,
  showConfirm,
  showInfoModal,
  showMigrationBanner,
  showShinyPopup,
  showRarePopup,
  showMiniCombatPopup,
};
