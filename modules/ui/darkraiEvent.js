'use strict';

// ════════════════════════════════════════════════════════════════
//  DARKRAI EVENT — "L'importance d'une bonne équipe — Cauchemar"
//
//  Scénario en 6 étapes :
//    0. Fade-in / noir
//    1. Grotte, torche éteinte — 2 choix (torche | pokémon)
//    1b. Détour si choix "pokémon" (ceinture vide) ou "torche" (flash)
//    2. Silhouette Darkrai + 3 répliques (2 preset, 1 libre)
//    3. L'ombre disparaît, voix dans la tête
//    4. Réveil + entrée Pokédex mystérieuse (tease Sinnoh)
//    5. "Le lendemain" → redirige vers Gang tab pour composer l'équipe à 6
//
//  Déclenchement :
//    checkDarkraiCutscene()           — à appeler dans boot() après init
//    triggerDarkraiOnLeagueVictory()  — hook ligue Indigo (nouveaux joueurs)
//
//  Dépendances globalThis :
//    state, saveState, notify, renderAll, switchTab,
//    invalidateBossTeamPower (exposé par bossPower.js)
// ════════════════════════════════════════════════════════════════

import { invalidateBossTeamPower } from '../systems/bossPower.js';
import { EventBus, EVENTS } from '../core/eventBus.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY, { msg, type });
const _save   = ()               => globalThis.saveState?.();

const _t = (fr, en) => (globalThis.state?.lang === 'en' ? en : fr);

// ── Constantes ────────────────────────────────────────────────────
const DARKRAI_SPRITE = 'assets/pokemon_sprite/legendary_fight_by_muzyun/darkray.png';

// ── État interne ──────────────────────────────────────────────────
let _overlay     = null;
let _torchChoice = null; // 'torch' | 'pokemon'

// ── Helpers globaux ───────────────────────────────────────────────
const _state = () => globalThis.state ?? {};

// ── Typewriter ────────────────────────────────────────────────────
function _typewrite(el, text, speed = 26) {
  return new Promise(resolve => {
    el.textContent = '';
    let i = 0;
    const tick = () => {
      if (i < text.length) { el.textContent += text[i++]; setTimeout(tick, speed); }
      else resolve();
    };
    tick();
  });
}

// ── Styles (injectés une seule fois) ─────────────────────────────
function _injectStyles() {
  if (document.getElementById('darkrai-event-styles')) return;
  const style = document.createElement('style');
  style.id = 'darkrai-event-styles';
  style.textContent = `
    @keyframes dkr-fadein   { from { opacity:0; } to { opacity:1; } }
    @keyframes dkr-fadeout  { from { opacity:1; } to { opacity:0; } }
    @keyframes dkr-pulse    { 0%,100% { opacity:.2; } 50% { opacity:.7; } }
    @keyframes dkr-appear   {
      from { opacity:0; transform:scale(.82) translateY(16px); filter:blur(6px); }
      to   { opacity:1; transform:scale(1)   translateY(0);    filter:blur(0);   }
    }
    @keyframes dkr-tremble  {
      0%,100% { transform:translate(0,0); }
      20%     { transform:translate(-2px,2px); }
      40%     { transform:translate(2px,-1px); }
      60%     { transform:translate(-1px,3px); }
      80%     { transform:translate(1px,-2px); }
    }

    #darkrai-event-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: #000;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 24px 16px;
      animation: dkr-fadein .9s ease forwards;
      user-select: none;
      overflow-y: auto;
    }

    .dkr-box {
      max-width: 520px; width: 100%;
      background: rgba(4,4,8,.97);
      border: 1px solid #1a1a2a;
      padding: 26px 28px 24px;
      position: relative;
    }

    .dkr-title {
      font-family: var(--font-pixel, monospace);
      font-size: 7px;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: #cc1111;
      margin-bottom: 18px;
      text-align: center;
    }

    .dkr-text {
      font-family: var(--font-pixel, monospace);
      font-size: 8.5px;
      line-height: 2;
      color: #c8c8c8;
      min-height: 70px;
      margin-bottom: 18px;
      white-space: pre-wrap;
    }

    .dkr-voice {
      font-family: var(--font-pixel, monospace);
      font-size: 8.5px;
      line-height: 2.2;
      color: #9966dd;
      text-align: center;
      letter-spacing: 2px;
      white-space: pre-wrap;
      margin-bottom: 16px;
      font-style: italic;
    }

    .dkr-choices { display: flex; flex-direction: column; gap: 8px; }

    .dkr-btn {
      background: none;
      border: 1px solid #2a2a2a;
      color: #999;
      font-family: var(--font-pixel, monospace);
      font-size: 7px;
      padding: 10px 14px;
      text-align: left;
      cursor: pointer;
      letter-spacing: 1px;
      transition: border-color .18s, color .18s, background .18s;
    }
    .dkr-btn:hover { border-color: #cc1111; color: #e8e8e8; background: rgba(204,17,17,.07); }
    .dkr-btn.red   { border-color: #cc1111; color: #e63535; }
    .dkr-btn.gold  { border-color: #ffcc5a; color: #ffcc5a; }
    .dkr-btn.gold:hover { background: rgba(255,204,90,.07); }

    .dkr-sprite-wrap {
      position: relative;
      display: inline-block;
      text-align: center;
      margin-bottom: 14px;
    }
    .dkr-sprite-wrap.aura::before,
    .dkr-sprite-wrap.aura::after {
      content: '';
      position: absolute;
      inset: -18px;
      border-radius: 50%;
      pointer-events: none;
      animation: dkr-aura-pulse 2.4s ease-in-out infinite;
    }
    .dkr-sprite-wrap.aura::before {
      background: radial-gradient(ellipse at center,
        rgba(180, 0, 255, 0.30) 0%,
        rgba(180, 0, 255, 0.10) 45%,
        transparent 70%);
      animation-delay: 0s;
    }
    .dkr-sprite-wrap.aura::after {
      inset: -10px;
      background: radial-gradient(ellipse at center,
        rgba(204, 17, 17, 0.45) 0%,
        rgba(204, 17, 17, 0.18) 50%,
        transparent 72%);
      animation-delay: 1.2s;
    }
    @keyframes dkr-aura-pulse {
      0%, 100% { opacity: 0.7; transform: scale(1); }
      50%       { opacity: 1.0; transform: scale(1.12); }
    }
    .dkr-sprite {
      position: relative;
      z-index: 1;
      width: 112px; height: 112px;
      image-rendering: pixelated;
      animation: dkr-appear .65s .15s both;
    }
    .dkr-sprite.silhouette {
      filter: brightness(0) drop-shadow(0 0 8px rgba(140, 0, 200, 0.6));
    }
    .dkr-sprite.revealed {
      filter: brightness(0.08) saturate(0) drop-shadow(0 0 12px rgba(180, 0, 255, 0.7))
              drop-shadow(0 0 6px rgba(204, 17, 17, 0.8));
      animation-delay: 0s;
    }

    .dkr-input {
      width: 100%; box-sizing: border-box;
      background: #060608;
      border: 1px solid #2a2a2a;
      border-top: none;
      color: #e8e8e8;
      font-family: var(--font-pixel, monospace);
      font-size: 8px;
      padding: 9px 12px;
      outline: none;
    }
    .dkr-input:focus { border-color: #cc1111; }

    .dkr-dex-beep {
      font-family: var(--font-pixel, monospace);
      font-size: 7px;
      color: #4499ff;
      letter-spacing: 2px;
      text-align: center;
      padding: 10px 0 6px;
      animation: dkr-pulse 1.4s infinite;
    }
    .dkr-dex-entry {
      border: 1px solid #1a1a3e;
      background: rgba(30,20,60,.45);
      padding: 12px 14px;
      margin-top: 10px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .dkr-dex-img {
      width: 56px; height: 56px;
      image-rendering: pixelated;
      filter: brightness(.15) sepia(1) saturate(4) hue-rotate(220deg);
      flex-shrink: 0;
    }
    .dkr-dex-label {
      font-family: var(--font-pixel, monospace);
      font-size: 7px;
      color: #8866cc;
      letter-spacing: 2px;
      margin-bottom: 5px;
    }
    .dkr-dex-num  { font-family: var(--font-pixel, monospace); font-size: 8px; color: #e8e8e8; margin-bottom: 4px; }
    .dkr-dex-desc { font-size: 8px; line-height: 1.8; color: #333; }

    .dkr-gang-hint {
      font-family: var(--font-pixel, monospace);
      font-size: 7px;
      color: #cc1111;
      text-align: center;
      letter-spacing: 1px;
      margin-bottom: 14px;
      line-height: 2;
    }
  `;
  document.head.appendChild(style);
}

// ── Overlay helpers ───────────────────────────────────────────────
function _buildOverlay() {
  _injectStyles();
  const el = document.createElement('div');
  el.id = 'darkrai-event-overlay';
  document.body.appendChild(el);
  return el;
}

function _clear() { if (_overlay) _overlay.innerHTML = ''; }

function _box() {
  const b = document.createElement('div');
  b.className = 'dkr-box';
  _overlay.appendChild(b);
  return b;
}

function _title(box, text) {
  const el = document.createElement('div');
  el.className = 'dkr-title';
  el.textContent = text;
  box.appendChild(el);
  return el;
}

function _text(box) {
  const el = document.createElement('div');
  el.className = 'dkr-text';
  box.appendChild(el);
  return el;
}

function _choices(box) {
  const el = document.createElement('div');
  el.className = 'dkr-choices';
  box.appendChild(el);
  return el;
}

function _btn(label, cls = '') {
  const el = document.createElement('button');
  el.className = 'dkr-btn' + (cls ? ' ' + cls : '');
  el.textContent = label;
  return el;
}

function _wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Steps ─────────────────────────────────────────────────────────

async function _step0() {
  _clear();
  await _wait(1100);
  _step1();
}

async function _step1() {
  _clear();
  const box = _box();
  _title(box, _t('— CAUCHEMAR —', '— NIGHTMARE —'));
  const txt = _text(box);
  const ch  = _choices(box);

  await _typewrite(txt, _t(
    'Tu avances dans une grotte que tu ne reconnais pas.\nL\'air est lourd. Le silence, oppressant.\nTa torche éclaire à peine quelques pas devant toi.\n\nPuis — un bruit. Un frôlement. Quelque chose de proche.\n\nTa torche s\'éteint brusquement.',
    'You move through a cave you don\'t recognise.\nThe air is heavy. The silence, oppressive.\nYour torch barely lights a few steps ahead.\n\nThen — a sound. A brush. Something close.\n\nYour torch goes out.',
  ));

  await _wait(380);

  const b1 = _btn(_t('▸  Tenter de rallumer la torche', '▸  Try to relight the torch'));
  b1.onclick = () => { _torchChoice = 'torch'; _step1bTorch(); };
  ch.appendChild(b1);

  const b2 = _btn(_t('▸  Se saisir d\'un de ses Pokémon', '▸  Grab one of your Pokémon'));
  b2.onclick = () => { _torchChoice = 'pokemon'; _step1bPokemon(); };
  ch.appendChild(b2);
}

async function _step1bPokemon() {
  _clear();
  const box = _box();
  _title(box, _t('— VIDE —', '— EMPTY —'));
  const txt = _text(box);
  const ch  = _choices(box);

  await _typewrite(txt, _t(
    'Par réflexe, ta main se tend vers ta ceinture.\n\nLa sensation de vide en refermant ta paume te glace le sang.\n\nTu n\'as pas tes Pokémon. Tu es seul ici.',
    'By reflex, your hand reaches for your belt.\n\nThe feeling of emptiness as your palm closes sends a chill through you.\n\nYou don\'t have your Pokémon. You are alone here.',
  ), 30);

  await _wait(500);
  const b = _btn(_t('▸  Continuer…', '▸  Continue…'));
  b.onclick = () => _step2();
  ch.appendChild(b);
}

async function _step1bTorch() {
  _clear();
  const box = _box();
  _title(box, _t('— OBSCURITÉ —', '— DARKNESS —'));
  const txt = _text(box);
  const ch  = _choices(box);

  await _typewrite(txt, _t(
    'Tes doigts cherchent l\'allumeur à tâtons.\n\nLa torche clignote — une fraction de seconde — et t\'éblouit.\n\nDu coin de l\'œil tu distingues une masse sombre, suspendue dans les airs au centre de la pièce.\n\nSilencieuse. Immobile.\n\nTu sens son regard peser sur toi, et tu te figes.',
    'Your fingers grope for the lighter.\n\nThe torch flickers — a split second — and blinds you.\n\nOut of the corner of your eye you make out a dark mass, suspended in mid-air at the centre of the room.\n\nSilent. Still.\n\nYou feel its gaze weighing on you, and you freeze.',
  ));

  await _wait(400);
  const b = _btn(_t('▸  Continuer…', '▸  Continue…'));
  b.onclick = () => _step2();
  ch.appendChild(b);
}

async function _step2() {
  _clear();
  const box = _box();
  _title(box, _t('— L\'OMBRE —', '— THE SHADOW —'));

  const sw  = document.createElement('div');
  sw.className = 'dkr-sprite-wrap aura';
  const img = document.createElement('img');
  img.src       = DARKRAI_SPRITE;
  img.className = 'dkr-sprite silhouette';
  img.alt       = '???';
  sw.appendChild(img);
  box.appendChild(sw);

  const txt = _text(box);
  const ch  = _choices(box);

  await _typewrite(txt, _t(
    'Tes yeux s\'habituent peu à peu à la pénombre.\n\nDevant toi se dessine une silhouette menaçante —\nsuspendue, immobile, comme si le vide lui obéissait.\n\nQue dites-vous ?',
    'Your eyes slowly adjust to the darkness.\n\nA menacing silhouette takes shape before you —\nsuspended, motionless, as though the void obeyed it.\n\nWhat do you say?',
  ));

  const b1 = _btn(_t('▸  "Qui… qui es-tu ?"', '▸  "Who… who are you?"'));
  b1.onclick = () => _step3();
  ch.appendChild(b1);

  const b2 = _btn(_t('▸  "Je ne te veux aucun mal."', '▸  "I mean you no harm."'));
  b2.onclick = () => _step3();
  ch.appendChild(b2);

  const inputWrap = document.createElement('div');
  const b3 = _btn(_t('▸  [Écrire soi-même…]', '▸  [Write your own…]'));
  b3.onclick = () => {
    b3.remove();
    const inp = document.createElement('input');
    inp.type        = 'text';
    inp.maxLength   = 60;
    inp.placeholder = _t('Votre réplique…', 'Your line…');
    inp.className   = 'dkr-input';
    inputWrap.appendChild(inp);
    const bConfirm = _btn(_t('▸  Dire cela', '▸  Say this'), 'red');
    bConfirm.onclick = () => { if (inp.value.trim()) _step3(); };
    inputWrap.appendChild(bConfirm);
    setTimeout(() => inp.focus(), 50);
  };
  inputWrap.appendChild(b3);
  ch.appendChild(inputWrap);
}

async function _step3() {
  _clear();
  const box = _box();
  _title(box, _t('— DERRIÈRE TOI —', '— BEHIND YOU —'));
  const txt = _text(box);

  await _typewrite(txt, _t(
    'L\'ombre disparaît.\n\nUn instant de silence absolu.\n\nPuis tu la sens.\nDerrière toi.',
    'The shadow vanishes.\n\nA moment of absolute silence.\n\nThen you feel it.\nBehind you.',
  ), 32);

  await _wait(650);

  const voice = document.createElement('div');
  voice.className = 'dkr-voice';
  box.appendChild(voice);
  await _typewrite(voice, _t(
    '— faible…\n  encore beaucoup trop faible…\n\n  trouve-moi\n  deviens plus fort\n  affronte-moi\n  trouve-moi —',
    '— weak…\n  still far too weak…\n\n  find me\n  grow stronger\n  face me\n  find me —',
  ), 42);

  await _wait(500);

  const sw  = document.createElement('div');
  sw.className = 'dkr-sprite-wrap aura';
  const img = document.createElement('img');
  img.src       = DARKRAI_SPRITE;
  img.className = 'dkr-sprite revealed';
  img.alt       = '???';
  sw.appendChild(img);
  box.appendChild(sw);

  await _wait(700);

  const ch = _choices(box);
  const b  = _btn(_t('▸  Se retourner…', '▸  Turn around…'));
  b.onclick = () => _step4();
  ch.appendChild(b);
}

async function _step4() {
  _clear();
  const box = _box();
  _title(box, _t('— RÉVEIL —', '— AWAKENING —'));
  const txt = _text(box);

  await _typewrite(txt, _t(
    'Tu t\'éveilles.\nLa lumière du matin filtre à travers les volets.\n\nTes Pokémon ne sont pas là.\nUne sensation étrange parcourt ton corps — comme une menace distante, mais bien réelle.\n\nTon Pokédex émet un bip.',
    'You wake up.\nMorning light filters through the shutters.\n\nYour Pokémon are not here.\nA strange sensation runs through your body — like a distant, but very real threat.\n\nYour Pokédex beeps.',
  ));

  await _wait(500);

  const beep = document.createElement('div');
  beep.className = 'dkr-dex-beep';
  beep.textContent = _t('[ ★ NOUVELLE ENTRÉE POKÉDEX ★ ]', '[ ★ NEW POKÉDEX ENTRY ★ ]');
  box.appendChild(beep);

  await _wait(900);

  const entry = document.createElement('div');
  entry.className = 'dkr-dex-entry';
  entry.innerHTML = `
    <img class="dkr-dex-img" src="${DARKRAI_SPRITE}" alt="???">
    <div>
      <div class="dkr-dex-label">${_t('★ SINNOH — SECTION DÉVERROUILLÉE', '★ SINNOH — SECTION UNLOCKED')}</div>
      <div class="dkr-dex-num">#491 — ???</div>
      <div class="dkr-dex-desc">
        ??? / ???<br>
        ?????? ???????? ???? ??????????? ????<br>
        ???? ????????? ??? ?? ??? ???.
      </div>
    </div>
  `;
  box.appendChild(entry);

  const s = _state();
  if (s.discoveryProgress) s.discoveryProgress.sinnohTeaseUnlocked = true;

  await _wait(500);

  const ch = _choices(box);
  const b  = _btn(_t('▸  Le lendemain…', '▸  The next day…'), 'gold');
  b.onclick = () => _step5();
  ch.appendChild(b);
}

async function _step5() {
  _clear();
  const box = _box();
  _title(box, _t('— LE LENDEMAIN —', '— THE NEXT DAY —'));
  const txt = _text(box);

  await _typewrite(txt, _t(
    'Une envie de puissance s\'est éveillée en toi au cours de la nuit.\n\nTu le sais maintenant — une équipe de trois Pokémon ne suffira pas.\n\nIl te faut une équipe complète. Six Pokémon. Tes meilleurs.',
    'A desire for power awakened in you during the night.\n\nYou know it now — a team of three Pokémon will not be enough.\n\nYou need a full team. Six Pokémon. Your best.',
  ), 26);

  await _wait(350);

  const hint = document.createElement('div');
  hint.className = 'dkr-gang-hint';
  hint.textContent = _t(
    'Rendez-vous dans l\'onglet Gang\npour composer votre équipe à 6 Pokémon.',
    'Head to the Gang tab\nto build your 6-Pokémon team.',
  );
  box.appendChild(hint);

  const ch = _choices(box);
  const b  = _btn(_t('▸  Constituer mon équipe →', '▸  Build my team →'), 'red');
  b.onclick = () => _finish();
  ch.appendChild(b);
}

// ── Fin de la cinématique ─────────────────────────────────────────
function _finish() {
  const s = _state();

  s.gang.darkraiCutsceneSeen = true;

  const slot = s.gang.activeBossTeamSlot ?? 0;
  if (Array.isArray(s.gang.bossTeamSlots?.[slot])) {
    s.gang.bossTeam = [...s.gang.bossTeamSlots[slot]];
  }

  invalidateBossTeamPower();
  _save();
  _notify(
    _t(
      'Équipe du Boss — choisissez vos 6 Pokémon dans l\'onglet Gang',
      'Boss Team — choose your 6 Pokémon in the Gang tab',
    ),
    'success',
  );

  _overlay.style.transition = 'opacity .55s';
  _overlay.style.opacity    = '0';
  setTimeout(() => {
    _overlay?.remove();
    _overlay = null;
    globalThis.switchTab?.('tabGang');
    globalThis.renderAll?.();
  }, 580);
}

// ── Déclenchement ─────────────────────────────────────────────────
function _startCutscene() {
  if (_overlay) return;
  _overlay      = _buildOverlay();
  _torchChoice  = null;
  _step0();
}

export function checkDarkraiCutscene() {
  const s = _state();
  if (s.gang?.darkraiCutsceneSeen)          return;
  if (!s.gang?.initialized)                 return;
  // Rattrapage boot-time uniquement pour les joueurs ayant déjà vaincu le
  // Champion (indigo_plateau) sans avoir vu la cinématique (ex: sauvegarde
  // antérieure à l'ajout de la feature) — le vrai déclencheur pour les
  // nouveaux joueurs est triggerDarkraiOnLeagueVictory() juste après la
  // victoire. Sans cette garde, un nouveau joueur avec 3 Pokémon capturés
  // (atteignable en quelques minutes) recevait cette cinématique post-ligue
  // (teasing Sinnoh, "constituer une équipe de 6") bien avant d'avoir
  // affronté le premier Arène.
  if (!s.zones?.indigo_plateau?.gymDefeated) return;
  _startCutscene();
}

export function triggerDarkraiOnLeagueVictory() {
  const s = _state();
  if (s.gang?.darkraiCutsceneSeen) return;
  _startCutscene();
}

Object.assign(globalThis, { checkDarkraiCutscene, triggerDarkraiOnLeagueVictory });

export {};
