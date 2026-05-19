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

// ── Constantes ────────────────────────────────────────────────────
const DARKRAI_SPRITE = 'https://play.pokemonshowdown.com/sprites/gen5/darkrai.png';

// ── État interne ──────────────────────────────────────────────────
let _overlay   = null;
let _torchChoice = null; // 'torch' | 'pokemon'

// ── Helpers globaux ───────────────────────────────────────────────
const _state    = ()     => globalThis.state ?? {};
const _save     = ()     => globalThis.saveState?.();
const _notify   = (m, t) => globalThis.notify?.(m, t);

// ── Typewriter ────────────────────────────────────────────────────
function _typewrite(el, text, speed = 26) {
  return new Promise(resolve => {
    el.textContent = '';
    let i = 0;
    const tick = () => {
      if (i < text.length) {
        el.textContent += text[i++];
        setTimeout(tick, speed);
      } else {
        resolve();
      }
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

    .dkr-sprite-wrap { text-align: center; margin-bottom: 14px; }
    .dkr-sprite {
      width: 112px; height: 112px;
      image-rendering: pixelated;
      animation: dkr-appear .65s .15s both;
    }
    .dkr-sprite.silhouette { filter: brightness(0); }
    .dkr-sprite.revealed   { filter: brightness(.35) saturate(.2); animation-delay: 0s; }

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

function _clear() {
  if (_overlay) _overlay.innerHTML = '';
}

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
  // Darkness beat before scene starts
  _clear();
  await _wait(1100);
  _step1();
}

async function _step1() {
  _clear();
  const box = _box();
  _title(box, '— CAUCHEMAR —');
  const txt = _text(box);
  const ch  = _choices(box);

  await _typewrite(txt,
    'Tu avances dans une grotte que tu ne reconnais pas.\nL\'air est lourd. Le silence, oppressant.\nTa torche éclaire à peine quelques pas devant toi.\n\nPuis — un bruit. Un frôlement. Quelque chose de proche.\n\nTa torche s\'éteint brusquement.',
  );

  await _wait(380);

  const b1 = _btn('▸  Tenter de rallumer la torche');
  b1.onclick = () => { _torchChoice = 'torch'; _step1bTorch(); };
  ch.appendChild(b1);

  const b2 = _btn('▸  Se saisir d\'un de ses Pokémon');
  b2.onclick = () => { _torchChoice = 'pokemon'; _step1bPokemon(); };
  ch.appendChild(b2);
}

async function _step1bPokemon() {
  _clear();
  const box = _box();
  _title(box, '— VIDE —');
  const txt = _text(box);
  const ch  = _choices(box);

  await _typewrite(txt,
    'Par réflexe, ta main se tend vers ta ceinture.\n\nLa sensation de vide en refermant ta paume te glace le sang.\n\nTu n\'as pas tes Pokémon. Tu es seul ici.',
    30,
  );

  await _wait(500);
  const b = _btn('▸  Continuer…');
  b.onclick = () => _step2();
  ch.appendChild(b);
}

async function _step1bTorch() {
  _clear();
  const box = _box();
  _title(box, '— OBSCURITÉ —');
  const txt = _text(box);
  const ch  = _choices(box);

  await _typewrite(txt,
    'Tes doigts cherchent l\'allumeur à tâtons.\n\nLa torche clignote — une fraction de seconde — et t\'éblouit.\n\nDu coin de l\'œil tu distingues une masse sombre, suspendue dans les airs au centre de la pièce.\n\nSilencieuse. Immobile.\n\nTu sens son regard peser sur toi, et tu te figes.',
  );

  await _wait(400);
  const b = _btn('▸  Continuer…');
  b.onclick = () => _step2();
  ch.appendChild(b);
}

async function _step2() {
  _clear();
  const box = _box();
  _title(box, '— L\'OMBRE —');

  // Darkrai silhouette
  const sw  = document.createElement('div');
  sw.className = 'dkr-sprite-wrap';
  const img = document.createElement('img');
  img.src       = DARKRAI_SPRITE;
  img.className = 'dkr-sprite silhouette';
  img.alt       = '???';
  sw.appendChild(img);
  box.appendChild(sw);

  const txt = _text(box);
  const ch  = _choices(box);

  await _typewrite(txt,
    'Tes yeux s\'habituent peu à peu à la pénombre.\n\nDevant toi se dessine une silhouette menaçante —\nsuspendue, immobile, comme si le vide lui obéissait.\n\nQue dites-vous ?',
  );

  // Option 1
  const b1 = _btn('▸  "Qui… qui es-tu ?"');
  b1.onclick = () => _step3();
  ch.appendChild(b1);

  // Option 2
  const b2 = _btn('▸  "Je ne te veux aucun mal."');
  b2.onclick = () => _step3();
  ch.appendChild(b2);

  // Option 3 — custom input
  const inputWrap = document.createElement('div');
  const b3 = _btn('▸  [Écrire soi-même…]');
  b3.onclick = () => {
    b3.remove();
    const inp = document.createElement('input');
    inp.type        = 'text';
    inp.maxLength   = 60;
    inp.placeholder = 'Votre réplique…';
    inp.className   = 'dkr-input';
    inputWrap.appendChild(inp);
    const bConfirm = _btn('▸  Dire cela', 'red');
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
  _title(box, '— DERRIÈRE TOI —');
  const txt = _text(box);

  await _typewrite(txt,
    'L\'ombre disparaît.\n\nUn instant de silence absolu.\n\nPuis tu la sens.\nDerrière toi.',
    32,
  );

  await _wait(650);

  const voice = document.createElement('div');
  voice.className = 'dkr-voice';
  box.appendChild(voice);
  await _typewrite(voice,
    '— faible…\n  encore beaucoup trop faible…\n\n  trouve-moi\n  deviens plus fort\n  affronte-moi\n  trouve-moi —',
    42,
  );

  await _wait(500);

  // Darkrai slightly more visible
  const sw  = document.createElement('div');
  sw.className = 'dkr-sprite-wrap';
  const img = document.createElement('img');
  img.src       = DARKRAI_SPRITE;
  img.className = 'dkr-sprite revealed';
  img.alt       = '???';
  sw.appendChild(img);
  box.appendChild(sw);

  await _wait(700);

  const ch = _choices(box);
  const b  = _btn('▸  Se retourner…');
  b.onclick = () => _step4();
  ch.appendChild(b);
}

async function _step4() {
  _clear();
  const box = _box();
  _title(box, '— RÉVEIL —');
  const txt = _text(box);

  await _typewrite(txt,
    'Tu t\'éveilles.\nLa lumière du matin filtre à travers les volets.\n\nTes Pokémon ne sont pas là.\nUne sensation étrange parcourt ton corps — comme une menace distante, mais bien réelle.\n\nTon Pokédex émet un bip.',
  );

  await _wait(500);

  // Pokédex beep
  const beep = document.createElement('div');
  beep.className = 'dkr-dex-beep';
  beep.textContent = '[ ★ NOUVELLE ENTRÉE POKÉDEX ★ ]';
  box.appendChild(beep);

  await _wait(900);

  // Mysterious entry
  const entry = document.createElement('div');
  entry.className = 'dkr-dex-entry';
  entry.innerHTML = `
    <img class="dkr-dex-img" src="${DARKRAI_SPRITE}" alt="???">
    <div>
      <div class="dkr-dex-label">★ SINNOH — SECTION DÉVERROUILLÉE</div>
      <div class="dkr-dex-num">#491 — ???</div>
      <div class="dkr-dex-desc">
        ??? / ???<br>
        ?????? ???????? ???? ??????????? ????<br>
        ???? ????????? ??? ?? ??? ???.
      </div>
    </div>
  `;
  box.appendChild(entry);

  // Unlock sinnoh tease
  const s = _state();
  if (s.discoveryProgress) s.discoveryProgress.sinnohTeaseUnlocked = true;

  await _wait(500);

  const ch = _choices(box);
  const b  = _btn('▸  Le lendemain…', 'gold');
  b.onclick = () => _step5();
  ch.appendChild(b);
}

async function _step5() {
  _clear();
  const box = _box();
  _title(box, '— LE LENDEMAIN —');
  const txt = _text(box);

  await _typewrite(txt,
    'Une envie de puissance s\'est éveillée en toi au cours de la nuit.\n\nTu le sais maintenant — une équipe de trois Pokémon ne suffira pas.\n\nIl te faut une équipe complète. Six Pokémon. Tes meilleurs.',
    26,
  );

  await _wait(350);

  const hint = document.createElement('div');
  hint.className = 'dkr-gang-hint';
  hint.textContent = 'Rendez-vous dans l\'onglet Gang\npour composer votre équipe à 6 Pokémon.';
  box.appendChild(hint);

  const ch = _choices(box);
  const b  = _btn('▸  Constituer mon équipe →', 'red');
  b.onclick = () => _finish();
  ch.appendChild(b);
}

// ── Fin de la cinématique ─────────────────────────────────────────
function _finish() {
  const s = _state();

  // Mark seen
  s.gang.darkraiCutsceneSeen = true;

  // Reload boss team from active slot (ensures 6-slot format propagated)
  const slot = s.gang.activeBossTeamSlot ?? 0;
  if (Array.isArray(s.gang.bossTeamSlots?.[slot])) {
    s.gang.bossTeam = [...s.gang.bossTeamSlots[slot]];
  }

  invalidateBossTeamPower();
  _save();
  _notify('Équipe du Boss — choisissez vos 6 Pokémon dans l\'onglet Gang', 'success');

  // Fade out
  _overlay.style.transition = 'opacity .55s';
  _overlay.style.opacity    = '0';
  setTimeout(() => {
    _overlay?.remove();
    _overlay = null;
    // Navigate to gang tab so player immediately sees boss team slots
    globalThis.switchTab?.('tabGang');
    globalThis.renderAll?.();
  }, 580);
}

// ── Déclenchement ─────────────────────────────────────────────────
function _startCutscene() {
  if (_overlay) return; // already running
  _overlay      = _buildOverlay();
  _torchChoice  = null;
  _step0();
}

/**
 * À appeler dans boot() après que l'état est chargé, juste avant
 * d'afficher les éventuels autres popups (johto, starterGift…).
 * Ne fait rien si la cinématique a déjà été vue ou si le joueur n'est
 * pas encore assez avancé.
 */
export function checkDarkraiCutscene() {
  const s = _state();
  if (s.gang?.darkraiCutsceneSeen)           return; // already seen
  if (!s.gang?.initialized)                  return; // not yet onboarded
  if ((s.pokemons?.length ?? 0) < 3)         return; // too early
  _startCutscene();
}

/**
 * Hook à appeler lors de la première victoire à la Ligue Indigo.
 * Déclenche la cinématique pour les nouveaux joueurs qui n'ont pas
 * eu la condition « save existante » (moins de 3 pokémons au boot).
 */
export function triggerDarkraiOnLeagueVictory() {
  const s = _state();
  if (s.gang?.darkraiCutsceneSeen) return;
  _startCutscene();
}

// Exposer sur globalThis pour les modules sans import direct
Object.assign(globalThis, { checkDarkraiCutscene, triggerDarkraiOnLeagueVictory });

export {};
