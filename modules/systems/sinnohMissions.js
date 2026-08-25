'use strict';

// ════════════════════════════════════════════════════════════════
//  SINNOH MISSIONS — Team Galaxie · Dialga/Palkia · Giratina · Trio du Lac
//  Trois quêtes parallèles inspirées de Pokémon Diamant/Perle/Platine.
//
//  L'intro, le tracker (progression, item de rejeu) et le comptage des
//  combats de grind restent gérés ici tels quels. Les affrontements de
//  quête (commandantes/chef/légendaires) ne se déclenchent plus depuis un
//  modal à jet de probabilité (`resolveSpecialCombat`) : une fois l'étape
//  atteinte, getSinnohQuestEncounterForZone(zoneId) fait apparaître le
//  dresseur/légendaire comme sprite persistant dans sa zone (agrégé par
//  modules/ui/zoneWindows.js) ; un clic ouvre un vrai combat tour-par-tour
//  (modules/ui/questEncounterPopup.js + modules/systems/questCombat.js),
//  avec possibilité d'envoyer des agents affaiblir l'adversaire avant de
//  l'affronter directement — même patron que kantoMissions.js/
//  johtoMissions.js/legendaryMissions.js.
//
//  Zones d'ancrage : des zones dédiées existaient déjà dans
//  data/zones-sinnoh-data.js, jamais utilisées par l'ancien système
//  (galactic_hq, spear_pillar, turnback_cave, sendoff_spring,
//  lake_trio_shores) — à ne pas confondre avec les SPECIAL_EVENTS du même
//  nom (mars_ambush, cyrus_confrontation, …), qui sont des drops de zone
//  éphémères sans rapport avec cette quête.
//
//  Quête Galaxie (5 étapes) :
//    1. Vaincre 20 membres Galaxie dans leurs zones (galactic_hq, mt_coronet, …)
//    2. Vaincre Mars ET Jupiter — galactic_hq
//    3. Vaincre 12 combats au Pilier Axial (spear_pillar)
//    4. Vaincre Cyrus — spear_pillar
//    5. Choisir puis affronter Dialga ou Palkia — spear_pillar
//
//  Quête Giratina (3 étapes, débloquée après Cyrus) :
//    1. Vaincre 10 combats dans Grotte Retour (turnback_cave)
//    2. Vaincre Saturne — turnback_cave
//    3. Affronter Giratina — sendoff_spring
//
//  Trio du Lac (2 étapes × 3, parallèles, débloqué à rep ≥ 4200) :
//    Uxie / Mesprit / Azelf — 8 combats aux Rives du Lac (zones partagées)
//    → capture à lake_trio_shores
//
//  Rejouable :
//    1 Fragment Temporel → relance Dialga ou Palkia (déjà capturé)
//    1 Onde Distorsion   → relance Giratina
//    1 Cristal du Lac    → relance un légendaire du Lac
//
//  Déclenchement :
//    checkSinnohMissionsUnlock()      — à appeler au boot + après activation Sinnoh
//    openSinnohMissions()             — ouvre le tracker (progression)
//    getSinnohQuestEncounterForZone() — sprite de combat pour une zone
//
//  Dépendances globalThis :
//    state, saveState, makePokemon, calculateStats, registerPokedexCapture,
//    trainerSprite, getBossTeamPower, switchTab, openQuestEncounterPopup,
//    patchZoneWindow
//  Dépendances import :
//    defaultEncounterState (modules/systems/questCombat.js)
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';
import { defaultEncounterState } from './questCombat.js';
import { MISSION_REWARD_SHINY_RATE } from '../../data/gameplay-config-data.js';
import { requestSimulationSave, suppressSimulationNotification } from '../core/simulationContext.js';

const _notify = (msg, type = '') => {
  if (!suppressSimulationNotification()) EventBus.emit(EVENTS.UI_NOTIFY, { msg, type });
};
const _save = () => {
  requestSimulationSave(() => globalThis.saveState?.());
};
const _t = (fr, en) => (globalThis.state?.lang === 'en' ? en : fr);

// ── Sprites (popup + sprite-sur-zone) ─────────────────────────────
const DIALGA_STATIC   = 'https://play.pokemonshowdown.com/sprites/gen4/dialga.png';
const PALKIA_STATIC   = 'https://play.pokemonshowdown.com/sprites/gen4/palkia.png';
const GIRATINA_STATIC = 'https://play.pokemonshowdown.com/sprites/gen4/giratina-origin.png';
const UXIE_STATIC     = 'https://play.pokemonshowdown.com/sprites/gen4/uxie.png';
const MESPRIT_STATIC  = 'https://play.pokemonshowdown.com/sprites/gen4/mesprit.png';
const AZELF_STATIC    = 'https://play.pokemonshowdown.com/sprites/gen4/azelf.png';

// ── Zones de suivi (grind) ─────────────────────────────────────────
const _GALACTIC_ZONES = new Set([
  'galactic_hq', 'mt_coronet_base', 'mt_coronet_peak', 'eterna_gym',
  'veilstone_gym', 'spear_pillar', 'sunyshore_gym', 'pokemon_league_sinnoh',
]);
const _SPEAR_ZONES    = new Set(['spear_pillar', 'mt_coronet_peak']);
const _TURNBACK_ZONES = new Set(['turnback_cave', 'sendoff_spring']);
const _LAKE_ZONES     = new Set(['lake_trio_shores', 'route211_215', 'solaceon_ruins']);

// ── Zones d'ancrage (combat de quête) ─────────────────────────────
const _GALACTIC_HQ_ZONE = 'galactic_hq';   // Mars, Jupiter
const _SPEAR_PILLAR_ZONE = 'spear_pillar';  // Cyrus, puis Dialga/Palkia
const _TURNBACK_CAVE_ZONE = 'turnback_cave'; // Saturne
const _SENDOFF_SPRING_ZONE = 'sendoff_spring'; // Giratina
const _LAKE_SHORES_ZONE = 'lake_trio_shores'; // Uxie/Mesprit/Azelf

// ── Config des commandantes/chef (équipes converties en team structuré) ──
// Niveaux calibrés en conservant l'écart relatif de l'ancien système
// (Mars/Jupiter req. 5000 < Saturne 5500 < Cyrus 6500, contre Dialga/Palkia
// 7500 et Giratina 8000) plutôt qu'un chiffre choisi au hasard.
const TRAINERS = {
  mars: {
    name: 'Mars', trainerKey: 'mars',
    team: [{ species_en: 'golbat', level: 58 }, { species_en: 'bronzor', level: 58 }, { species_en: 'purugly', level: 60 }],
  },
  jupiter: {
    name: 'Jupiter', trainerKey: 'jupiter',
    team: [{ species_en: 'golbat', level: 58 }, { species_en: 'bronzor', level: 58 }, { species_en: 'skuntank', level: 60 }],
  },
  saturn: {
    name: 'Saturn', trainerKey: 'saturn',
    team: [{ species_en: 'golbat', level: 60 }, { species_en: 'bronzor', level: 60 }, { species_en: 'toxicroak', level: 62 }],
  },
  cyrus: {
    name: 'Cyrus', trainerKey: 'cyrus',
    team: [
      { species_en: 'sneasel', level: 63 }, { species_en: 'golbat', level: 63 },
      { species_en: 'honchkrow', level: 64 }, { species_en: 'gyarados', level: 64 },
      { species_en: 'crobat', level: 65 }, { species_en: 'weavile', level: 66 },
    ],
  },
};

// ── Config Dialga/Palkia (choix) ──────────────────────────────────
// `desc` est une fonction (pas une string figée) : GALAXIE_LEGENDS est
// construit une seule fois à l'import du module — souvent avant même que
// state.lang soit chargé depuis la sauvegarde — donc une string évaluée ici
// se figerait en français pour toute la session (y compris les joueurs
// itch.io, en anglais par défaut). Appelé à chaque rendu du chooser à la
// place (c.desc()) pour toujours lire la langue courante.
const GALAXIE_LEGENDS = {
  dialga: {
    name: 'Dialga', species: 'dialga', static: DIALGA_STATIC,
    accent: '#4060d0', icon: '💎',
    desc: () => _t('Maître du Temps — son rugissement fait vibrer le passé et le futur.', 'Master of Time — its roar makes the past and future tremble.'),
    catchBase: 0.45, level: 72, pot: 3, statMult: 1.7,
  },
  palkia: {
    name: 'Palkia', species: 'palkia', static: PALKIA_STATIC,
    accent: '#c050a0', icon: '🌀',
    desc: () => _t("Maître de l'Espace — il distord les dimensions à sa guise.", 'Master of Space — it warps dimensions at will.'),
    catchBase: 0.45, level: 72, pot: 3, statMult: 1.7,
  },
};

const GIRATINA = {
  // `species` doit rester la clé valide 'giratina' (seule présente dans
  // SPECIES_BY_EN — 'giratina-origin' n'existe pas comme espèce jouable et
  // faisait échouer silencieusement calculateStats()/makePokemon() : stats
  // adverses à 10/10/10 en combat, et légendaire jamais ajouté au PC malgré
  // giratinaOwned=true). `static` reste le sprite Forme Originelle : c'est
  // purement l'apparence visuelle du combat, sans lien avec la clé espèce.
  name: 'Giratina', species: 'giratina', static: GIRATINA_STATIC,
  catchBase: 0.42, level: 72, pot: 3, statMult: 1.75,
};

// ── Config Trio du Lac ─────────────────────────────────────────────
const LAKES = {
  uxie:    { name: 'Uxie',    species: 'uxie',    static: UXIE_STATIC,    accent: '#f0d040', icon: '💛', catchBase: 0.45, level: 50, pot: 2, statMult: 1.3 },
  mesprit: { name: 'Mesprit', species: 'mesprit', static: MESPRIT_STATIC, accent: '#ff80b0', icon: '🩷', catchBase: 0.45, level: 50, pot: 2, statMult: 1.3 },
  azelf:   { name: 'Azelf',   species: 'azelf',   static: AZELF_STATIC,   accent: '#6080ff', icon: '💙', catchBase: 0.45, level: 50, pot: 2, statMult: 1.3 },
};

// ── State accessor ────────────────────────────────────────────────
const _state = () => globalThis.state ?? null;

function _repatchZone(zoneId) {
  const win = document.getElementById(`zw-${zoneId}`);
  if (win) globalThis.patchZoneWindow?.(zoneId, win);
}

// ── Capture générique (légendaires ajoutés au PC après victoire) ─────────────
function _addLegendToPC(species, level, pot, zoneId) {
  const s = _state();
  if (!s) return null;
  try {
    const p = globalThis.makePokemon?.(species, zoneId ?? null, 'pokeball');
    if (!p) return null;
    p.level     = level;
    p.shiny     = Math.random() < MISSION_REWARD_SHINY_RATE;
    p.potential = pot;
    if (globalThis.calculateStats) p.stats = globalThis.calculateStats(p);
    if (!s.pokemons) s.pokemons = [];
    s.pokemons.push(p);
    EventBus.emit(EVENTS.STATE_DIRTY);
    EventBus.emit(EVENTS.POKEMON_CAPTURED, { pokemon: p, zoneId: zoneId ?? null, source: 'quest' });
    globalThis.registerPokedexCapture?.(s, p);
    return p;
  } catch (e) {
    console.warn('[sinnohMissions] makePokemon failed:', e);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
//  RENCONTRES DE QUÊTE (sprite sur zone → popup de combat réel)
// ════════════════════════════════════════════════════════════════

function _openTrainer(key) {
  const cfg = TRAINERS[key];
  const gx = _state()?.galaxieMission;
  const gt = _state()?.giratinaMission;
  const q = key === 'saturn' ? gt : gx;
  if (!cfg || !q) return;
  const stateKey = `${key}Encounter`;
  if (!q[stateKey]) q[stateKey] = defaultEncounterState();
  globalThis.openQuestEncounterPopup?.({
    id: `snm-${key}`, kind: 'trainer',
    name: cfg.name, icon: '🌌',
    spriteUrl: globalThis.trainerSprite?.(cfg.trainerKey) ?? '',
    lore: _t('Commandement Team Galaxie', 'Team Galactic Command'),
    team: cfg.team,
    encounterState: q[stateKey],
    onResolved: (result) => {
      if (!result.won) return;
      _onTrainerDefeated(key);
    },
  });
}

function _onTrainerDefeated(key) {
  const s = _state();
  const gx = s.galaxieMission;
  const gt = s.giratinaMission;

  if (key === 'mars' || key === 'jupiter') {
    if (key === 'mars') gx.marsDefeated = true; else gx.jupiterDefeated = true;
    if (gx.marsDefeated && gx.jupiterDefeated) {
      gx.step = 3;
      _notify(_t('🌌 Quête Galaxie — Étape 3 : Combattez au Pilier Axial !', '🌌 Galactic Quest — Step 3: Battle at Spear Pillar!'), 'gold');
    } else {
      const other = key === 'mars' ? 'Jupiter' : 'Mars';
      _notify(_t(`🌌 ${TRAINERS[key].name} vaincue ! Défiez maintenant ${other}.`, `🌌 ${TRAINERS[key].name} defeated! Now challenge ${other}.`), 'gold');
    }
    _save();
    _repatchZone(_GALACTIC_HQ_ZONE);
    return;
  }

  if (key === 'cyrus') {
    gx.cyrusDefeated = true;
    gx.step = 5;
    _notify(_t('🌌 Cyrus est vaincu. Choisissez votre légendaire !', '🌌 Cyrus is defeated. Choose your legendary!'), 'gold');
    if (gt && !gt.active) {
      gt.active = true;
      gt.step = 1;
      _notify(_t("👁️ Quête Distorsion débloquée — Cyrus a ouvert une fissure dans l'espace…", '👁️ Distortion Quest unlocked — Cyrus tore open a rift in space…'), 'gold');
    }
    _save();
    _repatchZone(_SPEAR_PILLAR_ZONE);
    return;
  }

  if (key === 'saturn') {
    gt.saturnDefeated = true;
    gt.step = 3;
    _notify(_t("👁️ Saturne est vaincu. Giratina attend à la Source Abandon.", '👁️ Saturn is defeated. Giratina awaits at Sendoff Spring.'), 'gold');
    _save();
    _repatchZone(_TURNBACK_CAVE_ZONE);
  }
}

function _chooseGalaxieLegend(key) {
  const s = _state();
  const gx = s?.galaxieMission;
  if (!gx) return;
  gx.chosenLegend = key;
  _save();
  _repatchZone(_SPEAR_PILLAR_ZONE);
}

function _openGalaxieLegend() {
  const s = _state();
  const gx = s?.galaxieMission;
  if (!gx || gx.step !== 5 || !gx.chosenLegend) return;
  const leg = GALAXIE_LEGENDS[gx.chosenLegend];
  if (!leg) return;
  if (!gx.legendEncounter) gx.legendEncounter = defaultEncounterState();
  globalThis.openQuestEncounterPopup?.({
    id: 'snm-galaxie-legend', kind: 'legendary',
    name: leg.name, icon: leg.icon, spriteUrl: leg.static,
    team: [{ species_en: leg.species, level: leg.level, potential: leg.pot }],
    statMult: leg.statMult, catchBase: leg.catchBase,
    potential: leg.pot, zoneId: _SPEAR_PILLAR_ZONE,
    encounterState: gx.legendEncounter,
    onResolved: (result) => {
      if (!result.won) return;
      if (!result.captured) {
        _notify(_t(`⚡ ${leg.name} s'échappe !`, `⚡ ${leg.name} escapes!`), '');
        return;
      }
      _addLegendToPC(leg.species, leg.level, leg.pot, _SPEAR_PILLAR_ZONE);
      gx.legendOwned = true;
      gx.totalCaptures = (gx.totalCaptures || 0) + 1;
      gx.step = 6;
      _notify(_t(`★ ${leg.name} capturé — Niv.${leg.level} / Pot.${leg.pot} !`, `★ ${leg.name} caught — Lv.${leg.level} / Pot.${leg.pot}!`), 'gold');
      _save();
      _repatchZone(_SPEAR_PILLAR_ZONE);
    },
  });
}

function _openGiratina() {
  const s = _state();
  const gt = s?.giratinaMission;
  if (!gt || gt.step !== 3) return;
  if (!gt.legendEncounter) gt.legendEncounter = defaultEncounterState();
  globalThis.openQuestEncounterPopup?.({
    id: 'snm-giratina', kind: 'legendary',
    name: GIRATINA.name, icon: '👁️', spriteUrl: GIRATINA.static,
    team: [{ species_en: GIRATINA.species, level: GIRATINA.level, potential: GIRATINA.pot }],
    statMult: GIRATINA.statMult, catchBase: GIRATINA.catchBase,
    potential: GIRATINA.pot, zoneId: _SENDOFF_SPRING_ZONE,
    encounterState: gt.legendEncounter,
    onResolved: (result) => {
      if (!result.won) return;
      if (!result.captured) {
        _notify(_t('⚡ Giratina s\'échappe !', '⚡ Giratina escapes!'), '');
        return;
      }
      _addLegendToPC(GIRATINA.species, GIRATINA.level, GIRATINA.pot, _SENDOFF_SPRING_ZONE);
      gt.giratinaOwned = true;
      gt.totalCaptures = (gt.totalCaptures || 0) + 1;
      gt.step = 4;
      _notify(_t(`★ Giratina capturé — Niv.${GIRATINA.level} / Pot.${GIRATINA.pot} !`, `★ Giratina caught — Lv.${GIRATINA.level} / Pot.${GIRATINA.pot}!`), 'gold');
      _save();
      _repatchZone(_SENDOFF_SPRING_ZONE);
    },
  });
}

function _openLake(key) {
  const s = _state();
  const m = s?.lakeMission?.[key];
  const cfg = LAKES[key];
  if (!m || !cfg || m.step !== 2) return;
  if (!m.encounter) m.encounter = defaultEncounterState();
  globalThis.openQuestEncounterPopup?.({
    id: `snm-lake-${key}`, kind: 'legendary',
    name: cfg.name, icon: cfg.icon, spriteUrl: cfg.static,
    team: [{ species_en: cfg.species, level: cfg.level, potential: cfg.pot }],
    statMult: cfg.statMult, catchBase: cfg.catchBase,
    potential: cfg.pot, zoneId: _LAKE_SHORES_ZONE,
    encounterState: m.encounter,
    onResolved: (result) => {
      if (!result.won) return;
      if (!result.captured) {
        _notify(_t(`⚡ ${cfg.name} s'échappe !`, `⚡ ${cfg.name} escapes!`), '');
        return;
      }
      _addLegendToPC(cfg.species, cfg.level, cfg.pot, _LAKE_SHORES_ZONE);
      m.owned = true;
      m.captures = (m.captures || 0) + 1;
      m.step = 3;
      _notify(_t(`✅ ${cfg.name} capturé${Math.random() < 0 ? '' : ' !'}`, `✅ ${cfg.name} caught!`), 'success');
      _save();
      _repatchZone(_LAKE_SHORES_ZONE);
    },
  });
}

function _doGalaxieRerun() {
  const s = _state();
  if (!s?.galaxieMission?.legendOwned) return;
  if ((s.inventory.fragment_temporel || 0) < 1) {
    _notify(_t('⚠️ Aucun Fragment Temporel en inventaire.', '⚠️ No Time Fragment in inventory.'), 'error');
    return;
  }
  s.inventory.fragment_temporel--;
  s.galaxieMission.step = 5;
  s.galaxieMission.legendEncounter = defaultEncounterState();
  _save();
  _repatchZone(_SPEAR_PILLAR_ZONE);
  _notify(_t('💎 Portail rouvert au Pilier Axial.', '💎 Portal reopened at Spear Pillar.'), 'gold');
}

function _doGiratinaRerun() {
  const s = _state();
  if (!s?.giratinaMission?.giratinaOwned) return;
  if ((s.inventory.onde_distorsion || 0) < 1) {
    _notify(_t('⚠️ Aucune Onde Distorsion en inventaire.', '⚠️ No Distortion Wave in inventory.'), 'error');
    return;
  }
  s.inventory.onde_distorsion--;
  s.giratinaMission.step = 3;
  s.giratinaMission.legendEncounter = defaultEncounterState();
  _save();
  _repatchZone(_SENDOFF_SPRING_ZONE);
  _notify(_t('👁️ Fissure rouverte à la Source Abandon.', '👁️ Rift reopened at Sendoff Spring.'), 'gold');
}

function _doLakeRerun(key) {
  const s = _state();
  const m = s?.lakeMission?.[key];
  if (!m?.owned) return;
  if ((s.inventory.cristal_lac || 0) < 1) {
    _notify(_t('⚠️ Aucun Cristal du Lac en inventaire.', '⚠️ No Lake Crystal in inventory.'), 'error');
    return;
  }
  s.inventory.cristal_lac--;
  m.step = 2;
  m.encounter = defaultEncounterState();
  _save();
  _repatchZone(_LAKE_SHORES_ZONE);
  _notify(_t(`${LAKES[key].icon} ${LAKES[key].name} réapparaît aux Rives du Lac.`, `${LAKES[key].icon} ${LAKES[key].name} reappears at the Lake Shores.`), 'gold');
}

/** Agrégateur appelé par modules/ui/zoneWindows.js pour savoir si un
 *  dresseur/légendaire de quête doit apparaître comme sprite persistant
 *  dans la fenêtre de zone zoneId à l'étape courante. */
export function getSinnohQuestEncounterForZone(zoneId) {
  const s = _state();
  if (!s) return null;
  const gx = s.galaxieMission;
  const gt = s.giratinaMission;
  const lk = s.lakeMission;

  if (gx?.active) {
    if (gx.step === 2 && zoneId === _GALACTIC_HQ_ZONE) {
      const key = !gx.marsDefeated ? 'mars' : 'jupiter';
      const cfg = TRAINERS[key];
      return { id: `snm-${key}`, name: cfg.name, icon: '🌌', spriteUrl: globalThis.trainerSprite?.(cfg.trainerKey) ?? '', onClick: () => _openTrainer(key) };
    }
    if (gx.step === 4 && zoneId === _SPEAR_PILLAR_ZONE) {
      const cfg = TRAINERS.cyrus;
      return { id: 'snm-cyrus', name: cfg.name, icon: '🌌', spriteUrl: globalThis.trainerSprite?.(cfg.trainerKey) ?? '', onClick: () => _openTrainer('cyrus') };
    }
    if (gx.step === 5 && zoneId === _SPEAR_PILLAR_ZONE && gx.chosenLegend) {
      const leg = GALAXIE_LEGENDS[gx.chosenLegend];
      return { id: 'snm-galaxie-legend', name: leg.name, icon: leg.icon, spriteUrl: leg.static, onClick: () => _openGalaxieLegend() };
    }
  }

  if (gt?.active) {
    if (gt.step === 2 && zoneId === _TURNBACK_CAVE_ZONE) {
      const cfg = TRAINERS.saturn;
      return { id: 'snm-saturn', name: cfg.name, icon: '🌌', spriteUrl: globalThis.trainerSprite?.(cfg.trainerKey) ?? '', onClick: () => _openTrainer('saturn') };
    }
    if (gt.step === 3 && zoneId === _SENDOFF_SPRING_ZONE) {
      return { id: 'snm-giratina', name: GIRATINA.name, icon: '👁️', spriteUrl: GIRATINA.static, onClick: () => _openGiratina() };
    }
  }

  if (lk && zoneId === _LAKE_SHORES_ZONE) {
    for (const key of ['uxie', 'mesprit', 'azelf']) {
      const m = lk[key];
      if (m?.active && m.step === 2) {
        const cfg = LAKES[key];
        return { id: `snm-lake-${key}`, name: cfg.name, icon: cfg.icon, spriteUrl: cfg.static, onClick: () => _openLake(key) };
      }
    }
  }

  return null;
}

// ════════════════════════════════════════════════════════════════
//  TRACKER (progression) — rendu inchangé dans sa structure, les boutons
//  de combat directs sont remplacés par une indication de zone.
// ════════════════════════════════════════════════════════════════

function _renderTrackerBtn() {
  const s = _state();
  if (!s?.purchases?.sinnohUnlocked) return '';
  const gx = s.galaxieMission;
  const gt = s.giratinaMission;
  const lk = s.lakeMission;
  if (!gx?.active && !gt?.active && !lk?.uxie?.active) return '';

  const gxLabel = gx?.active ? `🌌${gx.step}/5` : '';
  const gtLabel = gt?.active ? `👁️${gt.step}/3` : '';
  const lkActive = lk ? ['uxie', 'mesprit', 'azelf'].filter(k => lk[k]?.active) : [];
  const lkLabel = lkActive.length ? `${lkActive.map(k => LAKES[k].icon).join('')}` : '';

  const parts = [gxLabel, gtLabel, lkLabel].filter(Boolean).join(' ');
  return `<button class="zone-region-btn snm-quest-btn" data-snm-open="true" title="${_t('Quêtes Sinnoh', 'Sinnoh Quests')}">${parts}</button>`;
}

function openSinnohMissions() {
  const s = _state();
  if (!s) return;
  document.getElementById('snm-modal')?.remove();

  const gx = s.galaxieMission ?? {};
  const gt = s.giratinaMission ?? {};
  const lk = s.lakeMission ?? {};

  function _progress(val, max, label) {
    const pct = Math.min(100, (val / max) * 100);
    return `<div class="snm-prog-row">
      <span class="snm-prog-label">${label}</span>
      <div class="snm-prog-bar"><div class="snm-prog-fill" style="width:${pct}%"></div></div>
      <span class="snm-prog-val">${val}/${max}</span>
    </div>`;
  }

  const zoneName = zoneId => globalThis.getZoneById?.(zoneId)?.[s.lang === 'en' ? 'en' : 'fr'] ?? zoneId;

  function _galaxieStepHtml() {
    if (!gx.active) return `<div class="snm-inactive">${_t('Victoire à la Ligue Sinnoh requise (Rép ≥ 4 500)', 'Sinnoh League victory required (Rep ≥ 4,500)')}</div>`;
    const step = gx.step ?? 1;
    const rows = [];
    rows.push(_progress(gx.galacticFightsWon ?? 0, 20, _t('1. Sbires Galaxie vaincus', '1. Galactic grunts defeated')));
    rows.push(`<div class="snm-step-row ${step === 2 ? 'snm-active' : ''}">
      ${_t('2. Commandantes', '2. Commanders')} — Mars ${gx.marsDefeated ? '✅' : '⬜'} · Jupiter ${gx.jupiterDefeated ? '✅' : '⬜'}
      ${step === 2 ? `<span class="snm-goto">→ ${_t('Rendez-vous au', 'Head to the')} ${zoneName(_GALACTIC_HQ_ZONE)}</span>` : ''}</div>`);
    rows.push(_progress(gx.spearFightsWon ?? 0, 12, _t('3. Combats au Pilier Axial', '3. Battles at Spear Pillar')));
    rows.push(`<div class="snm-step-row ${step === 4 ? 'snm-active' : ''}">
      ${_t('4. Cyrus', '4. Cyrus')} ${gx.cyrusDefeated ? '✅' : '⬜'}
      ${step === 4 ? `<span class="snm-goto">→ ${_t('Rendez-vous au', 'Head to the')} ${zoneName(_SPEAR_PILLAR_ZONE)}</span>` : ''}
    </div>`);
    rows.push(`<div class="snm-step-row ${step >= 5 ? 'snm-active' : ''}">
      ${_t('5. Légendaire', '5. Legendary')} ${gx.legendOwned ? `✅ ${gx.chosenLegend ?? '?'}` : gx.chosenLegend ? `⬜ ${gx.chosenLegend}` : '⬜'}
      ${step === 5 && !gx.chosenLegend ? `<button class="snm-btn snm-btn-sm" data-action="choose-legend">🌌 ${_t('Choisir', 'Choose')}</button>` : ''}
      ${step === 5 && gx.chosenLegend && !gx.legendOwned ? `<span class="snm-goto">→ ${_t('Rendez-vous au', 'Head to the')} ${zoneName(_SPEAR_PILLAR_ZONE)}</span>` : ''}
      ${gx.legendOwned ? `<button class="snm-btn snm-btn-sm snm-rerun" data-action="rerun-galaxie">💎 ${_t('Rejouer', 'Retry')}</button>` : ''}
    </div>`);
    return rows.join('');
  }

  function _giratinaStepHtml() {
    if (!gt.active) return `<div class="snm-inactive">${_t('Déblocable après avoir vaincu Cyrus (quête Galaxie)', 'Unlockable after defeating Cyrus (Galactic quest)')}</div>`;
    const step = gt.step ?? 1;
    const rows = [];
    rows.push(_progress(gt.turnbackFightsWon ?? 0, 10, _t('1. Combats Grotte Retour', '1. Turnback Cave battles')));
    rows.push(`<div class="snm-step-row ${step === 2 ? 'snm-active' : ''}">
      ${_t('2. Saturne', '2. Saturn')} ${gt.saturnDefeated ? '✅' : '⬜'}
      ${step === 2 ? `<span class="snm-goto">→ ${_t('Rendez-vous à la', 'Head to')} ${zoneName(_TURNBACK_CAVE_ZONE)}</span>` : ''}
    </div>`);
    rows.push(`<div class="snm-step-row ${step >= 3 ? 'snm-active' : ''}">
      ${_t('3. Giratina', '3. Giratina')} ${gt.giratinaOwned ? '✅' : '⬜'}
      ${step === 3 ? `<span class="snm-goto">→ ${_t('Rendez-vous à la', 'Head to')} ${zoneName(_SENDOFF_SPRING_ZONE)}</span>` : ''}
      ${gt.giratinaOwned ? `<button class="snm-btn snm-btn-sm snm-rerun" data-action="rerun-giratina">👁️ ${_t('Rejouer', 'Retry')}</button>` : ''}
    </div>`);
    return rows.join('');
  }

  function _lakeCardHtml(key) {
    const m = lk[key] ?? {};
    const cfg = LAKES[key];
    if (!m.active) return `<div class="snm-lake-card snm-inactive-card">
      <div class="snm-lake-icon">${cfg.icon}</div>
      <div class="snm-lake-name">${cfg.name}</div>
      <div class="snm-lake-status">${_t('Pas encore débloqué', 'Not yet unlocked')}</div>
    </div>`;
    const step = m.step ?? 1;
    return `<div class="snm-lake-card" style="--accent:${cfg.accent}">
      <img class="snm-lake-gif" src="${cfg.static}" alt="${cfg.name}">
      <div class="snm-lake-name">${cfg.icon} ${cfg.name}</div>
      ${_progress(m.fightsWon ?? 0, 8, _t('Combats au Lac', 'Lake battles'))}
      <div class="snm-step-row ${step >= 2 ? 'snm-active' : ''}">
        ${m.owned ? `✅ ${_t('Capturé', 'Caught')}` : `⬜ ${_t('Non capturé', 'Not caught')}`}
        ${step === 2 && !m.owned ? `<span class="snm-goto">→ ${zoneName(_LAKE_SHORES_ZONE)}</span>` : ''}
        ${m.owned ? `<button class="snm-btn snm-btn-sm snm-rerun" data-action="rerun-lake-${key}">💙 ${_t('Rejouer', 'Retry')}</button>` : ''}
      </div>
    </div>`;
  }

  const modal = document.createElement('div');
  modal.id = 'snm-modal';
  modal.className = 'snm-overlay';
  modal.innerHTML = `
    <div class="snm-panel">
      <div class="snm-header">
        <span class="snm-title">🌌 ${_t('Quêtes Sinnoh — Légendaires', 'Sinnoh Quests — Legendaries')}</span>
        <button class="snm-close" data-action="close">✕</button>
      </div>

      <section class="snm-section">
        <div class="snm-section-title">
          <span class="snm-sec-icon">💎🌀</span>
          <span>${_t('Quête Galaxie — Dialga & Palkia', 'Galactic Quest — Dialga & Palkia')}</span>
          ${gx.active ? `<span class="snm-badge snm-badge-step">${_t('Étape', 'Step')} ${gx.step ?? 1}/5</span>` : ''}
          ${gx.legendOwned ? `<span class="snm-badge snm-badge-done">✅ ${_t('COMPLÈTE', 'COMPLETE')}</span>` : ''}
        </div>
        <div class="snm-steps">${_galaxieStepHtml()}</div>
      </section>

      <section class="snm-section">
        <div class="snm-section-title">
          <span class="snm-sec-icon">👁️</span>
          <span>${_t('Quête Distorsion — Giratina', 'Distortion Quest — Giratina')}</span>
          ${gt.active ? `<span class="snm-badge snm-badge-step">${_t('Étape', 'Step')} ${gt.step ?? 1}/3</span>` : ''}
          ${gt.giratinaOwned ? `<span class="snm-badge snm-badge-done">✅ ${_t('COMPLÈTE', 'COMPLETE')}</span>` : ''}
        </div>
        <div class="snm-steps">${_giratinaStepHtml()}</div>
      </section>

      <section class="snm-section">
        <div class="snm-section-title">
          <span class="snm-sec-icon">💛🩷💙</span>
          <span>${_t('Trio du Lac', 'Lake Guardians Trio')}</span>
        </div>
        <div class="snm-lake-grid">
          ${_lakeCardHtml('uxie')}
          ${_lakeCardHtml('mesprit')}
          ${_lakeCardHtml('azelf')}
        </div>
      </section>

      ${_infoBarHtml(s)}
    </div>`;

  document.body.appendChild(modal);
  _injectCss();

  modal.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'close') { modal.remove(); return; }
    if (action === 'choose-legend') { modal.remove(); _openLegendChooser(); return; }
    if (action === 'rerun-galaxie')  { modal.remove(); _doGalaxieRerun(); return; }
    if (action === 'rerun-giratina') { modal.remove(); _doGiratinaRerun(); return; }
    for (const key of ['uxie', 'mesprit', 'azelf']) {
      if (action === `rerun-lake-${key}`) { modal.remove(); _doLakeRerun(key); return; }
    }
  });
}

/** Choix Dialga/Palkia — reste un chooser dédié (pas un combat), inchangé
 *  dans son principe, seul le style de bouton est aligné sur le reste. */
function _openLegendChooser() {
  const s = _state();
  if (!s?.galaxieMission) return;
  const overlay = document.createElement('div');
  overlay.id = 'snm-chooser-modal';
  overlay.className = 'snm-modal-overlay';
  overlay.innerHTML = `
    <div class="snm-modal snm-chooser-modal">
      <div class="snm-modal-header">
        <span class="snm-modal-title">🌌 ${_t('Choisissez votre légendaire', 'Choose your legendary')}</span>
      </div>
      <p class="snm-chooser-sub">${_t("Au Pilier Axial, deux portes s'ouvrent. Laquelle franchissez-vous ?", 'At Spear Pillar, two doors open. Which one do you go through?')}</p>
      <div class="snm-chooser-grid">
        ${Object.entries(GALAXIE_LEGENDS).map(([key, c]) => `
          <div class="snm-chooser-card" data-key="${key}" style="--accent:${c.accent}">
            <img class="snm-chooser-gif" src="${c.static}" alt="${c.name}">
            <div class="snm-chooser-name">${c.icon} ${c.name}</div>
            <div class="snm-chooser-desc">${c.desc()}</div>
            <button class="snm-btn snm-btn-accent" data-action="choose" data-key="${key}">
              ${_t('Choisir', 'Choose')} ${c.name}
            </button>
          </div>`).join('')}
      </div>
      <button class="snm-btn snm-btn-ghost snm-chooser-cancel" data-action="close">${_t('Annuler', 'Cancel')}</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    const key = e.target.closest('[data-key]')?.dataset.key;
    if (action === 'close') { overlay.remove(); return; }
    if (action === 'choose' && key) { overlay.remove(); _chooseGalaxieLegend(key); }
  });
}

function _infoBarHtml(s) {
  const inv = s.inventory ?? {};
  const ft = inv.fragment_temporel ?? 0;
  const od = inv.onde_distorsion ?? 0;
  const cl = inv.cristal_lac ?? 0;
  if (!ft && !od && !cl) return '';
  return `<div class="snm-info-bar">
    <span class="snm-info-label">${_t('Inventaire quêtes', 'Quest inventory')} :</span>
    ${ft ? `<span class="snm-info-item">💎 ${_t('Fragment Temporel', 'Time Fragment')} ×${ft}</span>` : ''}
    ${od ? `<span class="snm-info-item">👁️ ${_t('Onde Distorsion', 'Distortion Wave')} ×${od}</span>` : ''}
    ${cl ? `<span class="snm-info-item">💙 ${_t('Cristal du Lac', 'Lake Crystal')} ×${cl}</span>` : ''}
  </div>`;
}

// ── Gestionnaire des combats de grind gagnés ──────────────────────────────
function _onCombatWon({ zoneId, trainerKey: tk } = {}) {
  const s = _state();
  if (!s?.purchases?.sinnohUnlocked) return;

  const gx = s.galaxieMission;
  const gt = s.giratinaMission;
  const lk = s.lakeMission;
  let changed = false;

  if (gx?.active && gx.step === 1 && _GALACTIC_ZONES.has(zoneId) &&
      ['galacticgrunt', 'galacticgruntf'].includes(tk)) {
    gx.galacticFightsWon = (gx.galacticFightsWon ?? 0) + 1;
    if (gx.galacticFightsWon >= 20) {
      gx.step = 2;
      _notify(_t('🌌 Quête Galaxie — Étape 2 : Défiez Mars et Jupiter !', '🌌 Galactic Quest — Step 2: Challenge Mars and Jupiter!'), 'gold');
    }
    changed = true;
  }

  if (gx?.active && gx.step === 3 && _SPEAR_ZONES.has(zoneId)) {
    gx.spearFightsWon = (gx.spearFightsWon ?? 0) + 1;
    if (gx.spearFightsWon >= 12) {
      gx.step = 4;
      _notify(_t('🌌 Quête Galaxie — Étape 4 : Affrontez Cyrus !', '🌌 Galactic Quest — Step 4: Face Cyrus!'), 'gold');
    }
    changed = true;
  }

  if (gt?.active && gt.step === 1 && _TURNBACK_ZONES.has(zoneId)) {
    gt.turnbackFightsWon = (gt.turnbackFightsWon ?? 0) + 1;
    if (gt.turnbackFightsWon >= 10) {
      gt.step = 2;
      _notify(_t('👁️ Quête Distorsion — Étape 2 : Défiez Saturne !', '👁️ Distortion Quest — Step 2: Challenge Saturn!'), 'gold');
    }
    changed = true;
  }

  if (lk && _LAKE_ZONES.has(zoneId)) {
    for (const key of ['uxie', 'mesprit', 'azelf']) {
      const m = lk[key];
      if (m?.active && m.step === 1) {
        m.fightsWon = (m.fightsWon ?? 0) + 1;
        if (m.fightsWon >= 8) {
          m.step = 2;
          _notify(_t(`${LAKES[key].icon} ${LAKES[key].name} — Prêt à être capturé !`, `${LAKES[key].icon} ${LAKES[key].name} — Ready to be caught!`), 'gold');
        }
        changed = true;
        break;
      }
    }
  }

  if (changed) _save();
}

// ── EventBus subscriptions ────────────────────────────────────────────────
let _registered = false;
function _register() {
  if (_registered) return;
  _registered = true;
  EventBus.on(EVENTS.COMBAT_WON, ({ zoneId, trainerKey } = {}) => _onCombatWon({ zoneId, trainerKey }));

  EventBus.on(EVENTS.ITEM_RECEIVED, ({ itemId } = {}) => {
    const s = _state();
    if (!s?.purchases?.sinnohUnlocked) return;
    if (['fragment_temporel', 'onde_distorsion', 'cristal_lac'].includes(itemId)) {
      const tracker = document.getElementById('snm-modal');
      if (tracker) { tracker.remove(); setTimeout(() => openSinnohMissions(), 100); }
    }
  });
}

// ── Vérification de déclenchement ────────────────────────────────────────
export function checkSinnohMissionsUnlock() {
  const s = _state();
  if (!s?.purchases?.sinnohUnlocked) return;
  const rep = s.gang?.reputation ?? 0;
  let changed = false;

  if (!s.galaxieMission) {
    s.galaxieMission = { active: false, step: 0, galacticFightsWon: 0, marsDefeated: false,
      jupiterDefeated: false, spearFightsWon: 0, cyrusDefeated: false,
      chosenLegend: null, legendOwned: false, totalCaptures: 0 };
  }
  if (!s.giratinaMission) {
    s.giratinaMission = { active: false, step: 0, turnbackFightsWon: 0, saturnDefeated: false,
      giratinaOwned: false, totalCaptures: 0 };
  }
  if (!s.lakeMission) {
    s.lakeMission = {
      uxie:    { active: false, step: 0, fightsWon: 0, owned: false, captures: 0 },
      mesprit: { active: false, step: 0, fightsWon: 0, owned: false, captures: 0 },
      azelf:   { active: false, step: 0, fightsWon: 0, owned: false, captures: 0 },
    };
  }

  if (rep >= 4200) {
    for (const key of ['uxie', 'mesprit', 'azelf']) {
      const m = s.lakeMission[key];
      if (!m.active) {
        m.active = true; m.step = 1;
        _notify(_t(`${LAKES[key].icon} Quête débloquée : ${LAKES[key].name} — explorez les Rives du Lac !`, `${LAKES[key].icon} Quest unlocked: ${LAKES[key].name} — explore the Lake Trio Shores!`), 'gold');
        changed = true;
      }
    }
  }

  if (rep >= 4500 && !s.galaxieMission.active) {
    s.galaxieMission.active = true;
    s.galaxieMission.step = 1;
    _notify(_t("💎 Quête débloquée : Dialga & Palkia — La Team Galaxie s'agite au Mont Couronné !", '💎 Quest unlocked: Dialga & Palkia — Team Galactic is stirring at Mt. Coronet!'), 'gold');
    changed = true;
  }

  if (changed) { _register(); _save(); }
}

// ── Boot ──────────────────────────────────────────────────────────────────
_register();

globalThis.openSinnohMissions        = openSinnohMissions;
globalThis.checkSinnohMissionsUnlock = checkSinnohMissionsUnlock;
globalThis.getSinnohQuestEncounterForZone = getSinnohQuestEncounterForZone;
globalThis._snmRenderTrackerBtn      = _renderTrackerBtn;

// ── CSS ───────────────────────────────────────────────────────────────────
function _injectCss() {
  if (document.getElementById('snm-css')) return;
  const s = document.createElement('style');
  s.id = 'snm-css';
  s.textContent = `
  .snm-overlay {
    position: fixed; inset: 0; z-index: 9998;
    background: rgba(0,0,0,.75); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
  }
  .snm-panel {
    background: #111; border: 1px solid #333; border-radius: 12px;
    width: min(680px, 100%); max-height: 88vh; overflow-y: auto;
    display: flex; flex-direction: column; gap: 0;
    scrollbar-width: thin; scrollbar-color: #333 #111;
  }
  .snm-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px; border-bottom: 1px solid #222;
    position: sticky; top: 0; background: #111; z-index: 2;
  }
  .snm-title { font-size: 15px; font-weight: 700; color: #e8d8a0; letter-spacing: .04em; }
  .snm-close {
    background: none; border: none; color: #666; font-size: 16px; cursor: pointer; padding: 4px 8px;
  }
  .snm-close:hover { color: #fff; }
  .snm-section {
    padding: 14px 18px; border-bottom: 1px solid #1a1a1a;
  }
  .snm-section-title {
    display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;
  }
  .snm-section-title > span:nth-child(2) { font-size: 13px; font-weight: 600; color: #ccc; }
  .snm-sec-icon { font-size: 16px; }
  .snm-badge {
    font-size: 9px; padding: 2px 7px; border-radius: 99px; font-weight: 700; letter-spacing: .05em;
  }
  .snm-badge-step { background: #333; color: #aaa; }
  .snm-badge-done { background: #0a2a0a; color: #4f4; border: 1px solid #2a5a2a; }
  .snm-inactive { font-size: 11px; color: #555; font-style: italic; padding: 8px 0; }
  .snm-steps { display: flex; flex-direction: column; gap: 6px; }
  .snm-prog-row {
    display: flex; align-items: center; gap: 8px; font-size: 11px; color: #888;
  }
  .snm-prog-label { flex: 0 0 auto; min-width: 160px; }
  .snm-prog-bar {
    flex: 1; height: 5px; background: #222; border-radius: 3px; overflow: hidden;
  }
  .snm-prog-fill { height: 100%; background: #4488cc; border-radius: 3px; transition: width .3s; }
  .snm-prog-val { flex: 0 0 auto; font-size: 10px; color: #666; }
  .snm-step-row {
    display: flex; align-items: center; gap: 8px; font-size: 11px; color: #666;
    padding: 4px 8px; border-radius: 6px; background: #0d0d0d;
    flex-wrap: wrap;
  }
  .snm-step-row.snm-active { color: #aaa; background: #151515; }
  .snm-goto { margin-left: auto; color: #ffcc5a; font-size: 10px; }
  .snm-btn {
    border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;
    padding: 5px 10px; transition: opacity .15s;
  }
  .snm-btn:hover { opacity: .85; }
  .snm-btn-ghost   { background: transparent; color: #888; border: 1px solid #333; }
  .snm-btn-sm      { padding: 3px 8px; font-size: 10px; background: #333; color: #ddd; }
  .snm-btn-accent  { background: var(--accent, #4466cc); color: #fff; width: 100%; margin-top: 8px; }
  .snm-rerun       { background: #2a1a00; color: #c8a040; border: 1px solid #5a3a00; }
  .snm-lake-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .snm-lake-card {
    background: #0d0d0d; border: 1px solid #222; border-radius: 8px;
    padding: 10px 8px; display: flex; flex-direction: column; align-items: center; gap: 6px;
  }
  .snm-lake-card:not(.snm-inactive-card) { border-color: color-mix(in srgb, var(--accent,#444) 40%, #222); }
  .snm-lake-gif { width: 48px; height: 48px; image-rendering: pixelated; object-fit: contain; }
  .snm-lake-name { font-size: 12px; font-weight: 700; color: #ccc; }
  .snm-lake-status { font-size: 10px; color: #555; font-style: italic; }
  .snm-inactive-card { opacity: .5; }
  .snm-modal-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,.8); display: flex; align-items: center; justify-content: center;
  }
  .snm-modal {
    background: #111; border: 1px solid #333; border-radius: 12px;
    width: min(400px, 92vw); overflow: hidden;
  }
  .snm-modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; border-bottom: 1px solid #222;
  }
  .snm-modal-title { font-size: 13px; font-weight: 700; color: #e8d8a0; }
  .snm-chooser-modal { width: min(520px, 92vw); }
  .snm-chooser-sub { font-size: 11px; color: #888; padding: 10px 16px 4px; }
  .snm-chooser-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0 16px 8px; }
  .snm-chooser-card {
    background: #0d0d0d; border: 1px solid color-mix(in srgb, var(--accent) 30%, #222);
    border-radius: 8px; padding: 12px; display: flex; flex-direction: column;
    align-items: center; gap: 8px; text-align: center;
  }
  .snm-chooser-gif { width: 72px; height: 72px; image-rendering: pixelated; object-fit: contain; }
  .snm-chooser-name { font-size: 13px; font-weight: 700; color: #ddd; }
  .snm-chooser-desc { font-size: 10px; color: #777; }
  .snm-chooser-cancel { margin: 0 16px 12px; }
  .snm-info-bar {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    padding: 10px 18px; font-size: 10px; color: #888; background: #0d0d0d;
    border-radius: 0 0 12px 12px;
  }
  .snm-info-label { color: #666; }
  .snm-info-item  { color: #aaa; background: #1a1a1a; padding: 2px 7px; border-radius: 99px; }
  .snm-quest-btn { font-size: 10px; background: rgba(60,40,100,.6); border-color: #554477; }
  @media (max-width: 480px) {
    .snm-lake-grid { grid-template-columns: 1fr 1fr; }
    .snm-chooser-grid { grid-template-columns: 1fr; }
  }
  `;
  document.head.appendChild(s);
}
