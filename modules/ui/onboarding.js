'use strict';

// ════════════════════════════════════════════════════════════════
//  Onboarding V2 — contrôleur du tunnel de première session
//
//  Enchaînement : le joueur atterrit sur un terrain inconnu et capture
//  librement → des sbires Rocket lui tombent dessus → Giovanni révèle que
//  le terrain est à lui et fonde le gang avec lui → un transfuge Rocket
//  croisé sur place devient son premier agent ET son guide, qui réclame
//  successivement un Pokémon, une affectation de zone, puis l'activation
//  de son option de combat.
//
//  Le contrôleur ne dessine rien lui-même : il tient l'état, écoute
//  l'EventBus et délègue l'affichage (zone, Giovanni, guide, payoff).
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';
import {
  acquireStoryLock,
  getStoryLockOwner,
  releaseStoryLock,
  requestStory,
  STORY_PRIORITIES,
} from '../core/storyLock.js';
import {
  ONBOARDING_AMBUSH_GRUNTS,
  ONBOARDING_AMBUSH_TRAINER_KEY,
  ONBOARDING_CAPTURE_GOAL,
  ONBOARDING_ZONE_ID,
  buildAmbushRoster,
  pickAmbushSprites,
} from '../../data/onboarding-data.js';
import { BOSS_TEAM_SLOTS } from '../../data/game-config-data.js';
import {
  ONBOARDING_STEPS,
  ONBOARDING_VERSION,
  ONBOARDING_COMPLETION_REWARD,
  advanceOnboarding,
  getOnboardingArcProgress,
  getOnboardingElapsedSeconds,
  isOnboardingActive,
  isOnboardingFreeCapture,
  isManualPlayerCombatWin,
  normalizeOnboardingState,
  shouldRunOnboardingV2,
  startOnboarding,
} from '../systems/onboardingFlow.js';

const LOCK_OWNER = 'onboarding-v2';
const AMBUSH_SPAWN_ID = 'onboarding-ambush';
// Plafond d'attente de la séquence visuelle de l'embuscade (cf.
// _afterAmbushSequence). Volontairement très au-dessus du budget d'animation
// (~14 s côté zoneWindows, plus la pause finale) : ce n'est pas un rythme,
// c'est un filet — s'il se déclenche, c'est que le combat a été interrompu.
const AMBUSH_SEQUENCE_TIMEOUT_MS = 40_000;

let _ctx = {};
let _running = false;
let _eventsBound = false;
let _lastResumeFingerprint = '';

export function configureOnboarding(ctx = {}) {
  _ctx = { ..._ctx, ...ctx };
  _bindOnboardingEvents();
}

function _state() {
  return _ctx.getState?.();
}

function _onboarding() {
  return normalizeOnboardingState(_state()?.onboarding);
}

function _track(name, params = {}) {
  const state = _state();
  globalThis.trackEvent?.(name, {
    onboarding_version: ONBOARDING_VERSION,
    step: state?.onboarding?.step ?? null,
    seconds_since_new_game: getOnboardingElapsedSeconds(state?.onboarding),
    ...params,
  });
}

function _saveOrRestore(previous) {
  try {
    _ctx.saveState?.();
    return true;
  } catch (error) {
    const state = _state();
    if (state) state.onboarding = previous;
    throw error;
  }
}

function _commitStep(expectedStep, nextStep, details = {}, onCommitted = null) {
  const state = _state();
  if (!state) return false;
  const current = normalizeOnboardingState(state.onboarding);
  if (current.step !== expectedStep) return false;

  const previous = state.onboarding;
  const next = advanceOnboarding(current, nextStep, details);
  state.onboarding = next;
  _saveOrRestore(previous);
  onCommitted?.(next);

  const secondsSinceNewGame = getOnboardingElapsedSeconds(next);
  EventBus.emit(EVENTS.ONBOARDING_STEP_COMPLETED, {
    version: ONBOARDING_VERSION,
    step: expectedStep,
    nextStep,
    secondsSinceNewGame,
  });
  if (nextStep === ONBOARDING_STEPS.COMPLETED) {
    EventBus.emit(EVENTS.ONBOARDING_COMPLETED, {
      version: ONBOARDING_VERSION,
      secondsSinceNewGame,
    });
    _ctx.notify?.(
      state.lang === 'en' ? 'Onboarding complete — your gang is operational.' : 'Onboarding terminé — ton gang est opérationnel.',
      'gold',
    );
  }
  _ctx.renderAll?.();
  return true;
}

function _updateOnboardingDetails(details, { render = true } = {}) {
  const state = _state();
  if (!state) return false;
  const previous = state.onboarding;
  state.onboarding = { ...normalizeOnboardingState(previous), ...details };
  _saveOrRestore(previous);
  if (render) _ctx.renderAll?.();
  return true;
}

// ── Terrain de départ ─────────────────────────────────────────────
/** Ouvre (ou ré-ouvre) le terrain inconnu et rend la main au gameplay. */
function _openField() {
  document.getElementById('introOverlay')?.classList.remove('active');
  if (_ctx.switchTab?.('tabZones') === false) return false;
  _ctx.openZoneWindow?.(ONBOARDING_ZONE_ID);
  return true;
}

// ── Embuscade Rocket ──────────────────────────────────────────────
/**
 * Le tirage des assaillants, tel qu'il est persisté dans la save. Le poser ici
 * plutôt qu'au seul déclenchement de l'embuscade couvre les saves écrites avant
 * que ce set n'existe : sans lui, le raid et la modale de ralliement
 * repartiraient chacun sur un tirage frais, et le joueur choisirait parmi des
 * visages qu'il n'a jamais croisés.
 */
function _ambushSprites() {
  const existing = _onboarding().ambushSprites;
  if (existing?.length) return existing;
  const drawn = pickAmbushSprites(ONBOARDING_AMBUSH_GRUNTS).map(entry => entry.key);
  _updateOnboardingDetails({ ambushSprites: drawn }, { render: false });
  return drawn;
}

/**
 * Plante le raid des sbires sur le terrain. Volontairement construit via
 * makeRaidSpawn avec une zone synthétique : toute la logique d'équipes, de
 * récompenses et de réputation des raids existants est réutilisée telle
 * quelle, seule la composition est imposée.
 */
function _spawnAmbush() {
  const spawns = _ctx.getZoneSpawns?.(ONBOARDING_ZONE_ID);
  if (!Array.isArray(spawns)) return false;
  if (spawns.some(spawn => spawn.spawnCtx?.ambush)) return true;

  // Le terrain se vide de ses Pokémon sauvages : le raid doit être la seule
  // chose cliquable, et la zone plafonne à cinq spawns.
  for (const spawn of [...spawns]) _ctx.removeSpawn?.(ONBOARDING_ZONE_ID, spawn.id);

  const zone = _ctx.getZoneById?.(ONBOARDING_ZONE_ID);
  if (!zone) return false;
  // Les assaillants affichés SONT le tirage persisté, donc exactement les
  // candidats que la modale du transfuge proposera ensuite. Le roster fixe à la
  // fois leur nombre, leurs stats (clés TRAINER_TYPES) et leurs visages.
  const roster = buildAmbushRoster(_ambushSprites());
  const raid = globalThis.makeRaidSpawn?.(
    { ...zone, trainers: [], eliteTrainer: ONBOARDING_AMBUSH_TRAINER_KEY },
    ONBOARDING_ZONE_ID,
    1,
    { roster },
  );
  if (!raid) return false;

  const spawn = {
    ...raid,
    id: AMBUSH_SPAWN_ID,
    position: { x: 150, y: 60 },
    // La réplique d'intro est portée par le sprite des sbires, pas par un
    // toast : elle doit rester à l'écran tant que le raid n'est pas engagé, et
    // revenir telle quelle si le joueur ferme puis rouvre la fenêtre de zone.
    bubble: _ctx.ambushIntroLine?.(_state()?.lang) ?? '',
    bubbleHostile: true,
    spawnCtx: { onboarding: true, ambush: true },
  };
  spawns.push(spawn);
  _ctx.renderSpawn?.(ONBOARDING_ZONE_ID, spawn);
  return true;
}

/** Rejoue le raid si le joueur a fermé la fenêtre de zone en pleine embuscade. */
export function ensureOnboardingAmbush() {
  if (_onboarding().step !== ONBOARDING_STEPS.ROCKET_AMBUSH) return false;
  return _spawnAmbush();
}

/**
 * Le tunnel n'a plus d'étape « constitue ton équipe » : le joueur arrive à
 * l'embuscade avec un PC plein et une équipe Boss vide, et openCombatPopup
 * refuse alors d'ouvrir le combat — le raid devient incliquable et le terrain
 * un cul-de-sac. On envoie donc au front ce qu'il a de meilleur, ce qui est
 * aussi ce que la suite du tunnel (agent, zones) suppose déjà fait.
 */
function _ensureBossTeamForAmbush() {
  const state = _state();
  if (!state?.gang || state.gang.bossTeam?.some(Boolean)) return false;
  const roster = [...(state.pokemons || [])]
    .sort((a, b) => (b.level ?? 0) - (a.level ?? 0) || (b.potential ?? 0) - (a.potential ?? 0))
    .slice(0, BOSS_TEAM_SLOTS)
    .map(pokemon => pokemon.id);
  if (!roster.length) return false;
  state.gang.bossTeam = roster;
  if (state.gang.bossTeamSlots) {
    state.gang.bossTeamSlots[state.gang.activeBossTeamSlot || 0] = [...roster];
  }
  globalThis.invalidateBossTeamPower?.();
  return true;
}

function _startAmbush() {
  _ensureBossTeamForAmbush();
  // Le trio d'assaillants est tiré ici et persisté : le transfuge sera l'un
  // d'eux, donc le choix proposé plus tard doit être exactement ce set — et
  // il doit survivre à un rechargement en pleine embuscade.
  const ambushSprites = _onboarding().ambushSprites?.length
    ? _onboarding().ambushSprites
    : pickAmbushSprites(ONBOARDING_AMBUSH_GRUNTS).map(entry => entry.key);
  const committed = _commitStep(
    ONBOARDING_STEPS.FREE_CAPTURE,
    ONBOARDING_STEPS.ROCKET_AMBUSH,
    { ambushSprites },
    () => _track('ambush_started', {
      zone: ONBOARDING_ZONE_ID,
      captures: _onboarding().fieldCaptures,
      sprites: ambushSprites.join(','),
    }),
  );
  if (!committed) return false;
  _openField();
  _spawnAmbush();
  // Les sbires entrent en scène plutôt que d'apparaître : la scène tient le
  // verrou et le viewport le temps de la marche d'entrée, puis rend la main
  // pour que le raid redevienne cliquable. La popup de défi s'affiche juste
  // après : sans elle, rien n'indique au joueur qu'il doit cliquer le raid,
  // ni que son équipe a déjà été constituée pour lui.
  void _ctx.playAmbushArrival?.().then(() => {
    _ctx.showAmbushChallengePopup?.({
      zoneId: ONBOARDING_ZONE_ID,
      onConfirm: () => _runScriptedAmbush(),
    });
  });
  return true;
}

/**
 * L'embuscade ne passe plus par le moteur de combat : elle est jouée comme une
 * scène et son issue est écrite (le joueur se fait prendre). La défaite était
 * déjà l'issue attendue — une équipe de première session face à six Pokémon —
 * mais elle dépendait d'un tirage, et le combat réel imposait son propre
 * rythme à un moment qui est narratif, pas ludique.
 */
function _runScriptedAmbush() {
  const state = _state();
  const starterId = state?.gang?.bossTeam?.find(Boolean);
  const starter = starterId ? state.pokemons?.find(p => p.id === starterId) : null;
  // Aucun combat réel derrière : on enchaîne dès la fin de la scène.
  const done = () => _resolveAmbush(false, { waitForCombat: false });
  const scene = _ctx.playScriptedAmbush?.({
    starterSpeciesEn: starter?.species_en || '',
    starterShiny: !!starter?.shiny,
  });
  if (scene?.then) void scene.then(done, done);
  else done(); // scène indisponible (tests, scène annulée) — on n'enferme pas le joueur
}

/**
 * L'embuscade se solde par Giovanni dans les deux cas : la défaite est
 * l'issue attendue (2-3 sbires contre une équipe de première session), mais
 * un joueur qui gagne ne doit surtout pas rester bloqué sur un terrain vide.
 */
function _resolveAmbush(won, { waitForCombat = true } = {}) {
  const committed = _commitStep(
    ONBOARDING_STEPS.ROCKET_AMBUSH,
    ONBOARDING_STEPS.IDENTITY,
    { ambushAt: Date.now(), ambushWon: !!won },
    () => _track('ambush_resolved', { won: !!won, zone: ONBOARDING_ZONE_ID }),
  );
  if (!committed) return false;
  // COMBAT_WON/LOST est émis par applyCombatResult, donc AVANT que le combat
  // n'ait affiché sa première image : couper ici (ce que faisait la version
  // précédente) supprimait purement et simplement l'unique combat de la
  // première session — le joueur voyait le raid disparaître d'un coup, puis
  // Giovanni. On laisse donc la séquence visuelle se dérouler et on n'enchaîne
  // qu'à COMBAT_SEQUENCE_ENDED, une fois le DOM de la zone rendu : sans ça,
  // patchZoneWindow refuse de reconstruire la rencontre et ni Giovanni ni le
  // transfuge ne peuvent apparaître.
  // L'embuscade normale est désormais scénarisée : il n'y a plus de séquence
  // de combat à attendre, et guetter COMBAT_SEQUENCE_ENDED laisserait le
  // joueur devant un terrain figé jusqu'au filet de sécurité. L'attente ne
  // sert plus qu'au chemin résiduel — un vrai combat déclenché dans la zone
  // (auto-combat d'agent, par exemple) pendant l'étape d'embuscade.
  const runAfter = waitForCombat ? _afterAmbushSequence : (fn) => fn();
  runAfter(() => {
    // No-op si le combat s'est déjà refermé de lui-même ; indispensable si on
    // arrive ici par le filet de sécurité.
    _ctx.endZoneCombat?.(ONBOARDING_ZONE_ID);
    const spawns = _ctx.getZoneSpawns?.(ONBOARDING_ZONE_ID);
    if (Array.isArray(spawns)) {
      for (const spawn of [...spawns]) _ctx.removeSpawn?.(ONBOARDING_ZONE_ID, spawn.id);
    }
    // Le mot de la fin des sbires, l'arrivée de Giovanni puis son écran
    // d'identité s'enchaînent dans _openIdentityStep, sous un seul verrou.
    setTimeout(() => { void _openIdentityStep(); }, 600);
  });
  return true;
}

/**
 * Exécute `next` quand la séquence visuelle du combat d'embuscade est finie.
 * Filet de sécurité obligatoire : si le combat est interrompu autrement
 * (fenêtre de zone fermée, teardown par une autre surface), COMBAT_SEQUENCE_ENDED
 * n'arrivera jamais et le tunnel resterait bloqué sur un terrain vide.
 */
function _afterAmbushSequence(next) {
  let done = false;
  let unsubscribe = null;
  let safety = null;
  const run = () => {
    if (done) return;
    done = true;
    unsubscribe?.();
    clearTimeout(safety);
    next();
  };
  unsubscribe = EventBus.on(EVENTS.COMBAT_SEQUENCE_ENDED, ({ zoneId } = {}) => {
    if (zoneId === ONBOARDING_ZONE_ID) run();
  });
  safety = setTimeout(run, AMBUSH_SEQUENCE_TIMEOUT_MS);
}

// ── Giovanni ──────────────────────────────────────────────────────
function _openIdentity() {
  const onboarding = _onboarding();
  const state = _state();
  // Le slot 1 de l'équipe peut avoir été réordonné dans la popup de défi de
  // l'embuscade (le joueur y promeut un autre Pokémon en starter) — c'est
  // LUI que Giovanni doit citer, pas forcément la toute première capture
  // sauvage figée dans onboarding.starterSpecies.
  const starterId = state?.gang?.bossTeam?.[0];
  const starterPokemon = starterId ? state.pokemons.find(p => p.id === starterId) : null;
  const starterEn = starterPokemon?.species_en || onboarding.starterSpecies || '';
  return new Promise((resolve, reject) => {
    _track('identity_started', {});
    const opened = _ctx.openGiovanniIntro?.({
      slotIdx: _ctx.getActiveSaveSlot?.() ?? 0,
      starterEn,
      identityOnly: true,
      lockOwner: LOCK_OWNER,
      onComplete: payload => resolve(payload),
    });
    if (opened === false) reject(new Error('[onboarding] Giovanni identity screen could not open'));
  });
}

async function _openIdentityStep() {
  if (_onboarding().step !== ONBOARDING_STEPS.IDENTITY) return false;
  // Ce beat se déclenche à la résolution de l'embuscade, donc bien après la
  // fin de _runOnboardingV2 : le verrou narratif a déjà été relâché, et
  // openGiovanniIntro refuse de s'ouvrir si personne ne le tient sous ce nom.
  // On le reprend ici, et on le rend quoi qu'il arrive.
  const alreadyOwned = getStoryLockOwner() === LOCK_OWNER;
  if (!alreadyOwned && !acquireStoryLock(LOCK_OWNER)) {
    // Une autre surface narrative occupe l'écran : on repassera au prochain
    // tick de zone plutôt que d'échouer définitivement.
    setTimeout(() => { void _openIdentityStep(); }, 1_000);
    return false;
  }
  try {
    // Giovanni arrive sur le terrain et parle AVANT que son écran ne s'ouvre.
    // Sur une reprise à cette étape, le terrain n'est pas encore à l'écran
    // (le hub l'est) : la scène se saute d'elle-même et l'écran s'ouvre direct.
    await _ctx.playGiovanniArrival?.({ won: _onboarding().ambushWon });
    await _openIdentity();
    if (!_commitStep(ONBOARDING_STEPS.IDENTITY, ONBOARDING_STEPS.GUIDE_MET)) return false;
    _track('identity_completed', {});
    _openField();
    // Il repart ; le sbire qui reste planté là est le transfuge, que
    // placeGuide rend dès que la scène a rendu le terrain.
    await _ctx.playGiovanniDeparture?.();
    _ctx.placeGuide?.();
    // Enchaîne directement sur sa fenêtre de recrutement (même popup que le
    // clic manuel sur son sprite) plutôt que de renvoyer le joueur devant le
    // terrain sans lui dire quoi faire — comme la popup de défi de
    // l'embuscade, ça évite de dépendre d'un sprite in-zone à repérer.
    _ctx.openGuideRecruitModal?.();
    return true;
  } catch (error) {
    console.error('[onboarding] identity step failed:', error);
    EventBus.emit(EVENTS.ONBOARDING_FAILED, {
      version: ONBOARDING_VERSION, step: ONBOARDING_STEPS.IDENTITY, reason: 'identity_error',
    });
    return false;
  } finally {
    if (!alreadyOwned) releaseStoryLock(LOCK_OWNER);
  }
}

// ── Guide transfuge ───────────────────────────────────────────────
/** Appelé par le module guide une fois le sprite choisi et l'agent recruté. */
export function onGuideRecruited(agentId, spriteKey) {
  const onboarding = _onboarding();
  if (onboarding.step !== ONBOARDING_STEPS.GUIDE_MET || onboarding.guideAgentId) return false;
  const committed = _commitStep(
    ONBOARDING_STEPS.GUIDE_MET,
    ONBOARDING_STEPS.GUIDE_TEAM,
    { guideAgentId: agentId, guideSprite: spriteKey || null },
    () => _track('guide_recruited', { sprite: spriteKey || null }),
  );
  if (committed) {
    _ctx.refreshGuide?.();
    // La popup de recrutement vient de se refermer sur un flux qui, pour le
    // joueur, s'est joué entièrement par-dessus le jeu (identité → départ de
    // Giovanni → recrutement) : forcer le refresh évite de revenir sur un
    // onglet resté construit avec l'état d'avant, même souci que
    // forceZonesRefresh à la fin complète de l'onboarding.
    _ctx.forceZonesRefresh?.();
  }
  return committed;
}

function _completeOnboarding(source = 'guide') {
  const state = _state();
  const onboarding = _onboarding();
  if (!state || onboarding.step !== ONBOARDING_STEPS.GUIDE_COMBAT) return false;

  const previousMoney = state.gang?.money ?? 0;
  const previousTotalMoneyEarned = state.stats?.totalMoneyEarned ?? 0;
  const rewardMoney = onboarding.completionRewardGrantedAt ? 0 : ONBOARDING_COMPLETION_REWARD;
  const grantedAt = rewardMoney > 0 ? Date.now() : onboarding.completionRewardGrantedAt;
  if (rewardMoney > 0) {
    state.gang.money = previousMoney + rewardMoney;
    if (state.stats) state.stats.totalMoneyEarned = previousTotalMoneyEarned + rewardMoney;
  }
  // Il vient de la vivre en direct : jamais lui reproposer un flashback de sa
  // propre cinématique. Une save déjà `completed` avant cette écriture (donc
  // qui n'est jamais passée par ici) reste éligible.
  const previousFlashbackOffered = !!state.discoveryProgress?.introFlashbackOffered;
  if (!state.discoveryProgress) state.discoveryProgress = {};
  state.discoveryProgress.introFlashbackOffered = true;

  const rollback = () => {
    if (rewardMoney > 0) {
      state.gang.money = previousMoney;
      if (state.stats) state.stats.totalMoneyEarned = previousTotalMoneyEarned;
    }
    state.discoveryProgress.introFlashbackOffered = previousFlashbackOffered;
  };

  let committed = false;
  try {
    committed = _commitStep(
      ONBOARDING_STEPS.GUIDE_COMBAT,
      ONBOARDING_STEPS.COMPLETED,
      {
        completionRewardGrantedAt: grantedAt,
        completionRewardMoney: rewardMoney || onboarding.completionRewardMoney || 0,
      },
      () => _track('guide_combat_enabled', { source }),
    );
  } catch (error) {
    rollback();
    throw error;
  }
  if (!committed) { rollback(); return false; }

  if (rewardMoney > 0) {
    EventBus.emit(EVENTS.MONEY_CHANGED, { delta: rewardMoney, newTotal: state.gang.money });
  }
  _ctx.clearGuide?.();
  // Le terrain de départ sort du sélecteur dès que l'onboarding est fini, mais
  // sa fenêtre reste ouverte tant qu'on ne la ferme pas : le joueur se
  // retrouverait avec une zone affichée qu'il ne peut plus jamais rouvrir.
  _ctx.closeZoneWindow?.(ONBOARDING_ZONE_ID);
  if (Array.isArray(state.openZoneOrder)) {
    state.openZoneOrder = state.openZoneOrder.filter(id => id !== ONBOARDING_ZONE_ID);
  }
  // Le joueur est presque toujours sur l'onglet Agents à cet instant (dernier
  // geste du transfuge) : sans cet appel explicite, le fogmap ne serait
  // reconstruit qu'au prochain clic sur Zones, avec le Marché/Pokédex/etc.
  // fraîchement débloqués mais invisibles jusque-là.
  _ctx.forceZonesRefresh?.();
  const agent = state.agents?.find(item => item.id === onboarding.guideAgentId);
  _ctx.showOnboardingIdlePayoff?.({
    agent,
    zone: _ctx.getZoneById?.(agent?.assignedZone),
    lang: state.lang,
    nextUnlock: 'market',
    rewardMoney,
    progress: getOnboardingArcProgress(state),
  });
  return true;
}

// ── EventBus ──────────────────────────────────────────────────────
function _bindOnboardingEvents() {
  if (_eventsBound) return;
  _eventsBound = true;

  // Capture libre : chaque prise sur le terrain compte, la première fixe
  // l'espèce montrée par Giovanni sur son écran de résumé.
  EventBus.on(EVENTS.POKEMON_CAPTURED, ({ pokemon, zoneId } = {}) => {
    const state = _state();
    if (!pokemon || !isOnboardingFreeCapture(state, zoneId)) return;
    const onboarding = normalizeOnboardingState(state.onboarding);
    const fieldCaptures = onboarding.fieldCaptures + 1;
    const details = { fieldCaptures };
    if (!onboarding.starterSpecies) details.starterSpecies = pokemon.species_en;
    _updateOnboardingDetails(details, { render: false });
    if (fieldCaptures === 1) {
      _track('first_wild_capture', { species: pokemon.species_en, zone: ONBOARDING_ZONE_ID });
    }
    if (fieldCaptures >= ONBOARDING_CAPTURE_GOAL) _startAmbush();
    else _ctx.renderAll?.();
  });

  // Issue de l'embuscade — quelle qu'elle soit.
  EventBus.on(EVENTS.COMBAT_WON, event => {
    if (event?.zoneId === ONBOARDING_ZONE_ID
      && _onboarding().step === ONBOARDING_STEPS.ROCKET_AMBUSH) {
      _resolveAmbush(true);
      return;
    }
    // Hors embuscade, on garde la métrique historique du premier combat
    // gagné à la main — elle ne conditionne plus aucune étape.
    const onboarding = _onboarding();
    if (isManualPlayerCombatWin(event) && isOnboardingActive(_state()) && !onboarding.firstBattleAt) {
      _updateOnboardingDetails({ firstBattleAt: Date.now() }, { render: false });
      _track('first_battle_won', { zone: event?.zoneId ?? null, trainer: event?.trainerKey ?? null });
    }
  });

  EventBus.on(EVENTS.COMBAT_LOST, event => {
    if (event?.zoneId === ONBOARDING_ZONE_ID
      && _onboarding().step === ONBOARDING_STEPS.ROCKET_AMBUSH) _resolveAmbush(false);
  });

  // « Confie-moi un Pokémon » — il faut que ce soit SON équipe.
  EventBus.on(EVENTS.TEAM_MEMBER_SET, ({ team, agentId, source } = {}) => {
    const onboarding = _onboarding();
    if (team !== 'agent' || !onboarding.guideAgentId || agentId !== onboarding.guideAgentId) return;
    if (_commitStep(
      ONBOARDING_STEPS.GUIDE_TEAM,
      ONBOARDING_STEPS.GUIDE_ZONE,
      {},
      () => _track('guide_team_set', { source: source ?? null }),
    )) _ctx.refreshGuide?.();
  });

  // « Assigne-moi à une zone ».
  EventBus.on(EVENTS.AGENT_ASSIGNED, ({ agentId, zoneId } = {}) => {
    const onboarding = _onboarding();
    if (!zoneId || !onboarding.guideAgentId || agentId !== onboarding.guideAgentId) return;
    if (_commitStep(
      ONBOARDING_STEPS.GUIDE_ZONE,
      ONBOARDING_STEPS.GUIDE_COMBAT,
      {},
      () => _track('guide_zone_assigned', { zone: zoneId }),
    )) {
      // Même souci que forceZonesRefresh au recrutement/à la fin de
      // l'onboarding : l'assignation se fait depuis l'onglet Agents, donc la
      // fenêtre de zone (assignation visible, prochaine bulle du guide)
      // resterait construite avec l'état d'avant tant que le joueur ne
      // rouvre pas Zones lui-même.
      _ctx.forceZonesRefresh?.();
      _ctx.refreshGuide?.();
    }
  });

  // « Active mon option de combat ».
  EventBus.on(EVENTS.AGENT_FLAG_CHANGED, ({ agentId, flag, value } = {}) => {
    const onboarding = _onboarding();
    if (flag !== 'autoCombat' || value !== true) return;
    if (!onboarding.guideAgentId || agentId !== onboarding.guideAgentId) return;
    _completeOnboarding('flag');
  });
}

// ── Cycle de vie ──────────────────────────────────────────────────
async function _runOnboardingV2({ slotIdx = 0, resume = false, onComplete } = {}) {
  let state = _state();
  if (_running || (resume && !shouldRunOnboardingV2(state))) {
    releaseStoryLock(LOCK_OWNER);
    return false;
  }

  _running = true;
  try {
    if (!resume) {
      _ctx.resetStateForNewGame?.();
      state = _state();
      // Les quêtes journalières se mesurent contre un baseline figé au premier
      // initMissions(). Le refaire ICI, sur un état vierge, le fixe à zéro :
      // les captures du tunnel comptent alors pour « Attraper 5 Pokémon », et
      // l'onglet Missions s'ouvre plus tard sur une quête déjà réclamable. Sans
      // ça, le baseline était pris au premier rendu de l'onglet — donc APRÈS
      // les dix captures, qui étaient purement et simplement effacées.
      _ctx.initMissions?.();
    }
    _ctx.setActiveSaveSlot?.(slotIdx);
    const current = normalizeOnboardingState(state.onboarding);
    const isStarting = !resume || current.step === ONBOARDING_STEPS.NOT_STARTED;
    state.onboarding = resume ? current : startOnboarding(null);
    if (state.onboarding.step === ONBOARDING_STEPS.NOT_STARTED) {
      state.onboarding = startOnboarding(state.onboarding);
    }
    _ctx.saveState?.();

    if (isStarting) {
      EventBus.emit(EVENTS.ONBOARDING_STARTED, {
        version: ONBOARDING_VERSION,
        slotIdx,
        startedAt: state.onboarding.startedAt,
      });
      _track('free_capture_started', { zone: ONBOARDING_ZONE_ID, slot: slotIdx });
    }

    switch (state.onboarding.step) {
      case ONBOARDING_STEPS.FREE_CAPTURE:
        _openField();
        _ctx.notifyFieldIntro?.(state.lang);
        break;
      case ONBOARDING_STEPS.ROCKET_AMBUSH:
        _openField();
        _spawnAmbush();
        break;
      case ONBOARDING_STEPS.IDENTITY:
        await _openIdentityStep();
        break;
      default:
        document.getElementById('introOverlay')?.classList.remove('active');
        _openField();
        _ctx.placeGuide?.();
        break;
    }

    _ctx.renderAll?.();
    onComplete?.({ onboarding: state.onboarding });
    return true;
  } catch (error) {
    console.error('[onboarding] V2 flow failed:', error);
    EventBus.emit(EVENTS.ONBOARDING_FAILED, {
      version: ONBOARDING_VERSION,
      step: state?.onboarding?.step ?? null,
      reason: 'controller_error',
    });
    _ctx.notify?.(
      state?.lang === 'en' ? 'The onboarding sequence could not continue.' : "La séquence d'onboarding n'a pas pu continuer.",
      'error',
    );
    return false;
  } finally {
    _running = false;
    releaseStoryLock(LOCK_OWNER);
  }
}

/** Queue the guided first session with the highest story priority. */
export function startOnboardingV2(options = {}) {
  const resume = options.resume === true;
  return requestStory(
    LOCK_OWNER,
    () => {
      void _runOnboardingV2(options);
      return true;
    },
    {
      priority: STORY_PRIORITIES.ONBOARDING,
      isEligible: () => !resume || shouldRunOnboardingV2(_state()),
    },
  );
}

/**
 * Rattrape les jalons déjà atteints dans la save avant d'exposer l'objectif
 * courant — sans quoi une reprise peut demander une action déjà faite.
 */
export function reconcileOnboardingProgress() {
  const state = _state();
  if (!state) return null;
  state.onboarding = normalizeOnboardingState(state.onboarding);
  const onboarding = state.onboarding;

  if (onboarding.step === ONBOARDING_STEPS.FREE_CAPTURE
    && onboarding.fieldCaptures >= ONBOARDING_CAPTURE_GOAL) {
    _startAmbush();
  }
  if (onboarding.step === ONBOARDING_STEPS.GUIDE_MET && onboarding.guideAgentId) {
    _commitStep(ONBOARDING_STEPS.GUIDE_MET, ONBOARDING_STEPS.GUIDE_TEAM);
  }
  const guide = state.agents?.find(item => item.id === state.onboarding.guideAgentId);
  if (state.onboarding.step === ONBOARDING_STEPS.GUIDE_TEAM && guide?.team?.length) {
    _commitStep(ONBOARDING_STEPS.GUIDE_TEAM, ONBOARDING_STEPS.GUIDE_ZONE);
  }
  if (state.onboarding.step === ONBOARDING_STEPS.GUIDE_ZONE && guide?.assignedZone) {
    _commitStep(ONBOARDING_STEPS.GUIDE_ZONE, ONBOARDING_STEPS.GUIDE_COMBAT);
  }
  if (state.onboarding.step === ONBOARDING_STEPS.GUIDE_COMBAT && guide?.autoCombat === true) {
    _completeOnboarding('reconcile');
  }
  // Un guide effacé de la save (import, édition manuelle) ne doit pas bloquer
  // le tunnel sur une demande adressée à quelqu'un qui n'existe plus.
  if (state.onboarding.guideAgentId && !guide) {
    _updateOnboardingDetails({ guideAgentId: null }, { render: false });
  }
  return state.onboarding;
}

export function resumeOnboardingV2({ slotIdx = 0 } = {}) {
  const state = _state();
  const onboarding = reconcileOnboardingProgress();
  if (!state || !isOnboardingActive(state)) return false;

  const fingerprint = `${slotIdx}:${onboarding.step}:${onboarding.startedAt}`;
  if (_lastResumeFingerprint !== fingerprint) {
    _lastResumeFingerprint = fingerprint;
    EventBus.emit(EVENTS.ONBOARDING_RESUMED, {
      version: ONBOARDING_VERSION,
      step: onboarding.step,
      secondsSinceNewGame: getOnboardingElapsedSeconds(onboarding),
    });
  }
  return startOnboardingV2({ slotIdx, resume: true });
}
