'use strict';

// ════════════════════════════════════════════════════════════════
//  onboardingFlashback.js — revivre la cinématique d'ouverture
//
//  Toute save déjà `completed` avant que la cinématique d'onboarding.js
//  n'existe (ou qui a fini le tunnel via l'ancienne version toasts-only)
//  n'a jamais vu les sbires arriver ni Giovanni traverser le terrain. Au
//  boot, on le propose UNE fois, sous forme de flashback filtré sépia —
//  jamais forcé, jamais raccordé à l'état de la partie : refuser revient
//  exactement à continuer où on en était, sans reverrouiller le moindre
//  onglet ni rouvrir le terrain de départ (qui a pu disparaître du
//  sélecteur depuis longtemps).
//
//  Auto-contenu : contrairement à onboardingScene.js, cette scène ne
//  s'ancre pas dans le viewport d'une fenêtre de zone (qui peut ne plus
//  exister), mais dans son propre overlay plein écran, sur le modèle de
//  modules/ui/intro.js.
//
//  Dépendances globalThis : trainerSprite
// ════════════════════════════════════════════════════════════════

import {
  getStoryLockOwner,
  releaseStoryLock,
  requestStory,
  STORY_PRIORITIES,
} from '../core/storyLock.js';
import {
  ONBOARDING_AMBUSH_LINES,
  ONBOARDING_GIOVANNI_LINES,
  resolveAmbushSprites,
} from '../../data/onboarding-data.js';
import {
  normalizeOnboardingState,
  shouldOfferOnboardingFlashback,
} from '../systems/onboardingFlow.js';

const STORY_OWNER = 'onboarding-flashback';
const OVERLAY_ID = 'onboardingFlashbackOverlay';

let _ctx = {};
export function configureOnboardingFlashback(ctx = {}) {
  _ctx = { ..._ctx, ...ctx };
}

const _state = () => _ctx.getState?.() ?? globalThis.state;
const _t = (fr, en) => (_state()?.lang === 'en' ? en : fr);
const _line = entry => (_state()?.lang === 'en' ? entry.en : entry.fr);
// `_t`/`_line` ci-dessus lisent la langue via _ctx (le chrome de l'overlay —
// kicker, boutons — doit refléter l'état LIVE du jeu). buildOnboardingFlashbackBeats
// est exportée comme fonction pure : elle doit rester correcte pour n'importe
// quel `state` passé en argument, y compris avant tout configureOnboardingFlashback()
// et même si ce state n'est pas celui que _ctx pointe — d'où ces variantes
// paramétrées plutôt qu'un simple appel à _t/_line.
const _tFor = (state, fr, en) => (state?.lang === 'en' ? en : fr);
const _lineFor = (state, entry) => (state?.lang === 'en' ? entry.en : entry.fr);

function _spriteUrl(key) {
  return globalThis.trainerSprite?.(key)
    || `https://play.pokemonshowdown.com/sprites/trainers/${key}.png`;
}

/**
 * Le sbire du flashback : leur transfuge recruté s'il existe (le flashback
 * redevient alors littéralement LEUR histoire), sinon le premier du tirage
 * persisté, sinon un visage générique pour les saves d'avant ce champ.
 */
function _flashbackGruntSprite(state, onboarding) {
  const guide = onboarding.guideAgentId
    ? state?.agents?.find(agent => agent.id === onboarding.guideAgentId)
    : null;
  if (guide?.spriteKey) return guide.spriteKey;
  return resolveAmbushSprites(onboarding.ambushSprites)[0]?.key || 'rocketgrunt';
}

/**
 * Le scénario du flashback, sous forme de données pures — séparé du rendu
 * pour rester testable sans DOM (même convention que onboardingPayoff.js :
 * les helpers purs sont couverts par tools/test-onboarding-flashback.mjs, le
 * rendu lui-même se vérifie en navigateur).
 */
export function buildOnboardingFlashbackBeats(state) {
  const onboarding = normalizeOnboardingState(state?.onboarding);
  return _buildBeats(state, onboarding);
}

function _buildBeats(state, onboarding) {
  const won = !!onboarding.ambushWon;
  const grunt = { name: _tFor(state, 'Sbire Rocket', 'Rocket Grunt'), sprite: _spriteUrl(_flashbackGruntSprite(state, onboarding)) };
  const giovanni = { name: 'Giovanni', sprite: _spriteUrl('giovanni') };
  return [
    { ...grunt, line: _lineFor(state, won ? ONBOARDING_AMBUSH_LINES.won : ONBOARDING_AMBUSH_LINES.lost) },
    { ...giovanni, line: _lineFor(state, won ? ONBOARDING_GIOVANNI_LINES.arrivalWon : ONBOARDING_GIOVANNI_LINES.arrival) },
    { ...giovanni, line: _lineFor(state, ONBOARDING_GIOVANNI_LINES.claim) },
    { ...giovanni, line: _lineFor(state, ONBOARDING_GIOVANNI_LINES.offer) },
    { ...giovanni, line: _lineFor(state, ONBOARDING_GIOVANNI_LINES.farewell) },
  ];
}

function _showFlashbackOffer() {
  if (document.getElementById(OVERLAY_ID)) return false;
  const state = _state();
  const onboarding = normalizeOnboardingState(state?.onboarding);

  // Marqué vu dès l'AFFICHAGE, pas à la décision : un joueur qui ferme
  // l'onglet en pleine offre ne doit pas se la voir reproposer en boucle à
  // chaque session — même logique que les autres popups de rattrapage boot
  // (starter gift, cinématique Darkrai).
  if (!state.discoveryProgress) state.discoveryProgress = {};
  state.discoveryProgress.introFlashbackOffered = true;
  _ctx.saveState?.();

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:8000;
    background:linear-gradient(160deg,#09090f 0%,#140808 55%,#0a0a0f 100%);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:var(--font-system,sans-serif);
    overflow:hidden;opacity:0;transition:opacity .35s ease;
  `;

  const style = document.createElement('style');
  style.id = `${OVERLAY_ID}-style`;
  style.textContent = `
    @keyframes obfb-fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes obfb-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
    @keyframes obfb-flicker { 0%,100%{opacity:1} 92%{opacity:1} 94%{opacity:.82} 96%{opacity:1} }
    #${OVERLAY_ID}.show { opacity:1; }
    .obfb-card {
      width:100%;max-width:480px;margin:0 16px;
      background:rgba(6,6,10,.95);
      border:2px solid var(--gold-dim,rgba(200,160,0,.5));
      border-radius:10px;padding:22px 22px 20px;
      text-align:center;animation:obfb-fadein .3s ease;
    }
    .obfb-kicker {
      font-family:var(--font-pixel,monospace);font-size:9px;letter-spacing:.1em;
      color:var(--gold,#fcc800);margin-bottom:10px;
    }
    .obfb-body { font-size:13px;line-height:1.6;color:#e8e8e8;margin-bottom:18px }
    .obfb-btns { display:flex;gap:10px;justify-content:center;flex-wrap:wrap }
    .obfb-btn {
      font-family:var(--font-pixel,monospace);font-size:9px;padding:10px 18px;
      border-radius:6px;cursor:pointer;transition:background .15s,transform .1s;border:none;
    }
    .obfb-btn:active { transform:scale(.97) }
    .obfb-btn-primary { background:var(--gold,#fcc800);color:#1a1200 }
    .obfb-btn-primary:hover { background:#ffd93d }
    .obfb-btn-ghost { background:transparent;border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.6) }
    .obfb-btn-ghost:hover { color:#fff;border-color:rgba(255,255,255,.4) }

    /* ── Scène — filtre sépia/N&B « souvenir », posé sur toute la scène ── */
    .obfb-stage {
      width:100%;height:100%;display:flex;flex-direction:column;
      align-items:center;justify-content:flex-end;
      filter:grayscale(.85) sepia(.5) contrast(1.08) brightness(.92);
      animation:obfb-flicker 5s linear infinite;
    }
    .obfb-vignette {
      position:absolute;inset:0;pointer-events:none;
      background:radial-gradient(ellipse at 50% 45%,transparent 45%,rgba(0,0,0,.55) 100%);
    }
    .obfb-tag {
      position:absolute;top:18px;left:50%;transform:translateX(-50%);
      font-family:var(--font-pixel,monospace);font-size:9px;letter-spacing:.15em;
      color:rgba(255,225,150,.75);text-shadow:0 0 8px rgba(0,0,0,.8);
    }
    .obfb-skip {
      position:absolute;top:14px;right:16px;
      background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.25);color:rgba(255,255,255,.7);
      font-family:var(--font-pixel,monospace);font-size:9px;padding:6px 10px;border-radius:6px;
      cursor:pointer;
    }
    .obfb-skip:hover { color:#fff;border-color:rgba(255,255,255,.5) }
    .obfb-portrait { padding-top:60px;text-align:center }
    .obfb-portrait img {
      width:120px;height:120px;image-rendering:pixelated;
      filter:drop-shadow(0 8px 20px rgba(0,0,0,.6));
      animation:obfb-bob 2.8s ease-in-out infinite;
    }
    .obfb-dialog {
      width:100%;max-width:520px;margin:16px 16px 28px;
      background:rgba(4,4,4,.92);border:2px solid rgba(220,190,120,.35);
      border-radius:8px;padding:14px 16px;cursor:pointer;
    }
    .obfb-dialog-name {
      font-family:var(--font-pixel,monospace);font-size:7px;letter-spacing:.08em;
      color:rgba(220,190,120,.9);text-transform:uppercase;margin-bottom:6px;
    }
    .obfb-dialog-text { font-size:13px;line-height:1.6;color:#eee;min-height:44px }
    .obfb-dialog-hint {
      margin-top:8px;font-size:9px;color:rgba(255,255,255,.35);text-align:right;
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));

  function _close() {
    overlay.classList.remove('show');
    setTimeout(() => {
      overlay.remove();
      style.remove();
      if (getStoryLockOwner() === STORY_OWNER) releaseStoryLock(STORY_OWNER);
    }, 350);
  }

  function _renderOffer() {
    overlay.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'obfb-card';
    card.innerHTML = `
      <div class="obfb-kicker">🎬 ${_t('SOUVENIR', 'FLASHBACK')}</div>
      <div class="obfb-body">${_t(
        "Une scène a été ajoutée pour raconter comment tout a commencé — l'embuscade, puis Giovanni sur ton propre terrain. Tu ne l'as jamais vue. La revivre, en flashback ?",
        "A scene was added telling how it all started — the ambush, then Giovanni on your own field. You never saw it. Relive it, as a flashback?",
      )}</div>
      <div class="obfb-btns">
        <button type="button" class="obfb-btn obfb-btn-primary" data-obfb-play>${_t('▶ Revivre', '▶ Relive it')}</button>
        <button type="button" class="obfb-btn obfb-btn-ghost" data-obfb-skip>${_t('Non merci, continuer', 'No thanks, continue')}</button>
      </div>`;
    overlay.appendChild(card);
    card.querySelector('[data-obfb-play]').addEventListener('click', _renderScene);
    // Refuser ne touche à RIEN d'autre que cet overlay : pas d'étape
    // d'onboarding, pas de zone, pas de verrouillage d'onglet — le joueur
    // reprend exactement là où il en était.
    card.querySelector('[data-obfb-skip]').addEventListener('click', _close);
  }

  function _renderScene() {
    const beats = _buildBeats(state, onboarding);
    let index = 0;

    overlay.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'obfb-stage';
    stage.style.position = 'relative';
    stage.innerHTML = `
      <div class="obfb-vignette"></div>
      <div class="obfb-tag">${_t('FLASHBACK', 'FLASHBACK')}</div>
      <button type="button" class="obfb-skip" data-obfb-close>✕ ${_t('Fermer', 'Close')}</button>
      <div class="obfb-portrait"><img alt=""></div>
      <div class="obfb-dialog">
        <div class="obfb-dialog-name"></div>
        <div class="obfb-dialog-text"></div>
        <div class="obfb-dialog-hint">${_t('Clique pour continuer', 'Click to continue')}</div>
      </div>`;
    overlay.appendChild(stage);

    const img = stage.querySelector('.obfb-portrait img');
    const nameEl = stage.querySelector('.obfb-dialog-name');
    const textEl = stage.querySelector('.obfb-dialog-text');
    const dialog = stage.querySelector('.obfb-dialog');
    stage.querySelector('[data-obfb-close]').addEventListener('click', _close);

    function _paint() {
      const beat = beats[index];
      img.src = beat.sprite;
      nameEl.textContent = beat.name;
      textEl.textContent = beat.line;
    }
    function _advance() {
      index += 1;
      if (index >= beats.length) { _close(); return; }
      _paint();
    }
    dialog.addEventListener('click', _advance);
    _paint();
  }

  _renderOffer();
  return true;
}

/**
 * Point d'entrée boot : queue l'offre avec la plus faible priorité narrative
 * — un flashback nostalgique n'a jamais de raison de passer devant une
 * reprise d'onboarding, l'écran d'identité ou le cadeau de rattrapage.
 */
export function maybeOfferOnboardingFlashback() {
  const state = _state();
  if (!shouldOfferOnboardingFlashback(state)) return false;
  return requestStory(STORY_OWNER, () => _showFlashbackOffer(), {
    priority: STORY_PRIORITIES.BOOT,
    isEligible: () => shouldOfferOnboardingFlashback(_state()),
  });
}
