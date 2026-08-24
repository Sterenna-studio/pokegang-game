'use strict';

import { EventBus, EVENTS } from '../core/eventBus.js';
import { esc as _esc } from '../core/escape.js';
import {
  getStoryLockOwner,
  releaseStoryLock,
  requestStory,
  STORY_PRIORITIES,
} from '../core/storyLock.js';
import { ONBOARDING_STARTERS as INTRO_STARTERS } from '../../data/onboarding-data.js';

const _dirty  = ()               => EventBus.emit(EVENTS.STATE_DIRTY);
const _t      = (fr, en)         => (globalThis.state?.lang === 'en' ? en : fr);
const _lvl    = (n)              => _t(`Niv. ${n}`, `Lvl ${n}`);


// ════════════════════════════════════════════════════════════════
//  GIOVANNI INTRO — narrative character creation sequence
//  Legacy full sequence or identity-only screen for onboarding V2.
//  deps (injected via configureIntro):
//    getState, makePokemon, calculateStats, pokeSprite, trainerSprite,
//    BOSS_SPRITES, saveState, notify, setActiveSaveSlot
//
//  Presentation (colors, sizes, layout, animations) lives in
//  css/onboarding.css under the `gi-*`/`sgp-*` prefixes. Only genuinely
//  dynamic values stay inline here: fade-transition opacity/transform
//  during step changes, and the typewriter cursor's blink visibility.
// ════════════════════════════════════════════════════════════════

let _ctx = {};
export function configureIntro(ctx) { _ctx = { ..._ctx, ...ctx }; }

const _starterName  = (s) => _t(s.fr, s.nameEn);
const _starterTypes = (s) => (_t(s.types, s.typesEn) || []).join(' · ');
const _starterDesc  = (s) => _t(s.desc, s.descEn);

// SPECIES_BY_EN : global posé par le <script> classique data/species-data.js,
// accessible par nom nu dans un module ES — jamais via globalThis (cf. CLAUDE.md).
function _resolveIdentityStarterName(speciesEn) {
  const sp = SPECIES_BY_EN?.[speciesEn];
  return sp ? _t(sp.fr, sp.en) : (speciesEn || _t('ton Pokémon', 'your Pokémon'));
}

// ── Boss sprite pool (player-character looking) ───────────────────
const INTRO_BOSS_SPRITES = [
  'red','leaf','ethan','kris','brendan','may','lucas','dawn','hilbert','hilda',
  'silver','blue','n','bianca','cheren',
];

// ── Giovanni's dialog lines ───────────────────────────────────────
const LINES = {
  name:    (identityOnly = false) => _t(
    identityOnly ? `Pas mal. Mais je ne sais même pas encore à qui j'ai affaire...` : `P'tit gars... c'est quoi ton nom déjà ?`,
    identityOnly ? `Not bad. But I don't even know who I'm dealing with yet...` : `Kid... what was your name again?`
  ),
  starter: (name) => _t(
    `${name}. J'ai vu en toi quelque chose — un potentiel. Je vais te confier l'un de mes Pokémon. Choisis celui qui te ressemble.`,
    `${name}. I saw something in you — potential. I'm going to entrust you with one of my Pokémon. Choose the one that suits you.`
  ),
  gang:    (starter) => _t(
    `${starter}... bon choix. Maintenant, ce gang a besoin d'un nom. Quelque chose qui en impose.`,
    `${starter}... good choice. Now, this gang needs a name. Something that commands respect.`
  ),
  sprite:  (gang) => _t(
    `"${gang}"... j'aime ça. Et toi — à quoi tu ressembles ? Montre-moi ta tête.`,
    `"${gang}"... I like it. Now you — what do you look like? Show me your face.`
  ),
  done:    (name, gang) => _t(
    `Parfait, ${name}. La ${gang} est fondée. Maintenant va — et prouve-moi que tu vaux quelque chose.`,
    `Perfect, ${name}. The ${gang} is founded. Now go — and prove to me you're worth something.`
  ),
};

// ── Typewriter effect ─────────────────────────────────────────────
function _typewrite(el, text, onDone) {
  el.textContent = '';
  let i = 0;
  const interval = setInterval(() => {
    el.textContent += text[i++];
    if (i >= text.length) { clearInterval(interval); onDone?.(); }
  }, 22);
  return interval;
}

// ── Step transition ───────────────────────────────────────────────
// The opacity/transform values here are genuinely dynamic (animated per
// call, not a fixed decorative style), so they stay inline on purpose.
function _fadeTransition(el, fn) {
  el.style.transition = 'opacity .18s ease, transform .18s ease';
  el.style.opacity = '0';
  el.style.transform = 'translateY(6px)';
  setTimeout(() => {
    fn();
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  }, 180);
}

// ── Main entry point ──────────────────────────────────────────────
export function openGiovanniIntro({
  slotIdx = 0,
  onComplete,
  starterEn: capturedStarter = '',
  identityOnly = false,
  lockOwner = null,
  _queued = false,
} = {}) {
  const storyOwner = lockOwner || 'giovanni-intro';
  const ownsStoryLock = !lockOwner;
  if (ownsStoryLock && !_queued) {
    return requestStory(storyOwner, () => openGiovanniIntro({
      slotIdx,
      onComplete,
      starterEn: capturedStarter,
      identityOnly,
      _queued: true,
    }), {
      priority: STORY_PRIORITIES.GAMEPLAY,
      isEligible: () => !document.getElementById('giovanni-intro-overlay'),
    });
  }
  if (document.getElementById('giovanni-intro-overlay')) return false;
  if (ownsStoryLock && getStoryLockOwner() !== storyOwner) return false;
  if (!ownsStoryLock && getStoryLockOwner() !== storyOwner) return false;
  if (!identityOnly) globalThis.trackEvent?.('intro_started', { slot: slotIdx });

  const state       = _ctx.getState?.();
  const BOSS_SPRITES = _ctx.BOSS_SPRITES || INTRO_BOSS_SPRITES;

  // Session state
  let bossName   = '';
  let gangName   = '';
  let bossSprite = INTRO_BOSS_SPRITES[0];
  let starterEn  = capturedStarter;
  let _typeTimer = null;
  let _isClosing = false;

  // ── Overlay ───────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'giovanni-intro-overlay';
  overlay.className = 'gi-overlay';

  // Subtle background texture
  overlay.innerHTML = `
    <div class="gi-bg-texture"></div>
    <div id="gi-stage" class="gi-stage"></div>`;

  document.body.appendChild(overlay);

  const stage = overlay.querySelector('#gi-stage');

  // ── Giovanni portrait area ────────────────────────────────────
  const portrait = document.createElement('div');
  portrait.id = 'gi-portrait';
  portrait.className = 'gi-portrait';
  portrait.innerHTML = `
    <div class="gi-portrait-inner">
      <img src="${_trainerSprite('giovanni')}" class="gi-portrait-img" onerror="this.style.opacity='.3'">
      <div class="gi-portrait-shadow"></div>
    </div>`;
  overlay.appendChild(portrait);

  // ── Content zone (choices rendered above dialog) ──────────────
  const contentZone = document.createElement('div');
  contentZone.id = 'gi-content';
  contentZone.className = 'gi-content';
  stage.appendChild(contentZone);

  // ── Dialog box ────────────────────────────────────────────────
  const dialog = document.createElement('div');
  dialog.id = 'gi-dialog';
  dialog.className = 'gi-dialog';
  dialog.innerHTML = `
    <div class="gi-dialog-label">Giovanni</div>
    <div id="gi-text" class="gi-text"></div>
    <div id="gi-input-area" class="gi-input-area"></div>
    <div id="gi-cursor" class="gi-cursor" style="display:none">▶</div>
  `;
  stage.appendChild(dialog);

  // ── Step dots ─────────────────────────────────────────────────
  const stepDots = document.createElement('div');
  stepDots.className = 'gi-step-dots';
  stepDots.innerHTML = ['', '', '', ''].map(() => `<div class="gi-dot"></div>`).join('');
  dialog.insertBefore(stepDots, dialog.firstChild);

  function _updateDots(current) {
    stepDots.querySelectorAll('.gi-dot').forEach((d, i) => {
      d.className = 'gi-dot' + (i < current ? ' done' : i === current ? ' active' : '');
    });
  }

  // ── Helpers ───────────────────────────────────────────────────
  const textEl    = dialog.querySelector('#gi-text');
  const inputArea = dialog.querySelector('#gi-input-area');
  const cursor    = dialog.querySelector('#gi-cursor');

  function _clearTypeTimer() {
    if (!_typeTimer) return;
    clearInterval(_typeTimer);
    clearTimeout(_typeTimer);
    _typeTimer = null;
  }

  function _closeIntro(payload, shouldComplete = true) {
    if (_isClosing) return;
    _isClosing = true;
    _clearTypeTimer();

    overlay.style.transition = 'opacity .4s ease';
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
      if (ownsStoryLock) releaseStoryLock(storyOwner);
      if (shouldComplete) onComplete?.(payload);
    }, 400);
  }

  function _say(text, onDone) {
    _clearTypeTimer();
    cursor.style.display = 'none';
    _typeTimer = _typewrite(textEl, text, () => {
      _typeTimer = null;
      cursor.style.display = 'block';
      onDone?.();
    });
  }

  function _clearContent() {
    _clearTypeTimer();
    _fadeTransition(contentZone, () => { contentZone.innerHTML = ''; });
    inputArea.innerHTML = '';
    cursor.style.display = 'none';
  }

  // ── STEP 0 — Boss name ────────────────────────────────────────
  function stepName() {
    _updateDots(0);
    _clearContent();
    _say(LINES.name(identityOnly), () => {
      _fadeTransition(inputArea, () => {
        inputArea.innerHTML = `
          <div class="gi-input-row">
            <input class="gi-input" id="gi-name-input" maxlength="20" placeholder="${_t('Ton nom de boss…', 'Your boss name…')}" autocomplete="off">
            <button class="gi-btn gi-btn-primary" id="gi-name-next">→</button>
          </div>
          <div class="gi-hint">${_t('Max. 20 caractères', 'Max. 20 characters')}</div>`;
        const input = inputArea.querySelector('#gi-name-input');
        const btn   = inputArea.querySelector('#gi-name-next');
        input.focus();
        const next = () => {
          const val = input.value.trim();
          if (!val) { input.style.borderColor = 'rgba(255,80,80,.9)'; input.focus(); return; }
          bossName = val;
          if (identityOnly) {
            // Le starter réel (onboarding V2) est capturé librement dans la
            // zone — quasiment jamais un des 3 de INTRO_STARTERS (qui ne
            // servent qu'au choix de l'ancien flux ci-dessous). Le nom vient
            // donc de la vraie base d'espèces, pas de cette liste legacy.
            stepGang(_resolveIdentityStarterName(starterEn));
          } else {
            stepStarter();
          }
        };
        btn.addEventListener('click', next);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') next(); });
      });
    });
  }

  // ── STEP 1 — Starter choice ───────────────────────────────────
  function stepStarter() {
    _clearTypeTimer();
    _updateDots(1);

    // Show starter cards above dialog
    _fadeTransition(contentZone, () => {
      contentZone.innerHTML = `
        <div class="gi-starter-row">
          ${INTRO_STARTERS.map(s => `
            <div class="gi-starter-card" data-en="${s.en}">
              <img src="${_ctx.pokeSprite?.(s.en, false) || ''}" class="gi-starter-card-img" onerror="this.style.opacity='.2'">
              <div class="gi-starter-card-name">${_starterName(s)}</div>
              <div class="gi-starter-card-types">${_starterTypes(s)}</div>
              <div class="gi-starter-card-desc">${_starterDesc(s)}</div>
              <div class="gi-starter-card-level">${_lvl(15)} · ★★★</div>
            </div>`).join('')}
        </div>`;

      contentZone.querySelectorAll('.gi-starter-card').forEach(card => {
        card.addEventListener('click', () => {
          contentZone.querySelectorAll('.gi-starter-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          starterEn = card.dataset.en;
        });
      });
    });

    // Say line after a short delay (cards appear first)
    setTimeout(() => {
      _say(LINES.starter(bossName), () => {
        _fadeTransition(inputArea, () => {
          inputArea.innerHTML = `<div class="gi-actions-end">
            <button class="gi-btn gi-btn-primary" id="gi-starter-next">${_t('Choisir →', 'Choose →')}</button>
          </div>`;
          inputArea.querySelector('#gi-starter-next').addEventListener('click', () => {
            if (!starterEn) {
              // Auto-select first if none chosen
              const firstCard = contentZone.querySelector('.gi-starter-card');
              if (firstCard) { firstCard.classList.add('selected'); starterEn = firstCard.dataset.en; }
              else return;
            }
            const starterName = _starterName(INTRO_STARTERS.find(s => s.en === starterEn)) || starterEn;
            stepGang(starterName);
          });
        });
      });
    }, 260);
  }

  // ── STEP 2 — Gang name ────────────────────────────────────────
  function stepGang(starterName) {
    _clearTypeTimer();
    _updateDots(2);

    // Collapse starter cards
    _fadeTransition(contentZone, () => { contentZone.innerHTML = ''; });

    setTimeout(() => {
      _say(LINES.gang(starterName), () => {
        _fadeTransition(inputArea, () => {
          inputArea.innerHTML = `
            <div class="gi-input-row">
              <input class="gi-input" id="gi-gang-input" maxlength="24" placeholder="${_t('Nom du gang…', 'Gang name…')}" autocomplete="off">
              <button class="gi-btn gi-btn-primary" id="gi-gang-next">→</button>
            </div>
            <div class="gi-hint">${_t('Max. 24 caractères', 'Max. 24 characters')}</div>`;
          const input = inputArea.querySelector('#gi-gang-input');
          const btn   = inputArea.querySelector('#gi-gang-next');
          input.focus();
          const next = () => {
            const val = input.value.trim();
            if (!val) { input.style.borderColor = 'rgba(255,80,80,.9)'; input.focus(); return; }
            gangName = val;
            stepSprite();
          };
          btn.addEventListener('click', next);
          input.addEventListener('keydown', e => { if (e.key === 'Enter') next(); });
        });
      });
    }, 160);
  }

  // ── STEP 3 — Boss sprite ──────────────────────────────────────
  function stepSprite() {
    _clearTypeTimer();
    _updateDots(3);

    _fadeTransition(contentZone, () => {
      const spritePool = (BOSS_SPRITES?.length ? BOSS_SPRITES : INTRO_BOSS_SPRITES).slice(0, 20);
      contentZone.innerHTML = `
        <div class="gi-sprite-pool">
          <div class="gi-sprite-grid">
            ${spritePool.map(s => `
              <div class="gi-sprite-opt" data-sprite="${s}">
                <img src="${_trainerSprite(s)}" class="gi-sprite-img" onerror="this.closest('.gi-sprite-opt').style.display='none'">
              </div>`).join('')}
          </div>
        </div>`;

      // Default select first
      bossSprite = spritePool[0];
      contentZone.querySelector('.gi-sprite-opt')?.classList.add('selected');

      contentZone.querySelectorAll('.gi-sprite-opt').forEach(opt => {
        opt.addEventListener('click', () => {
          contentZone.querySelectorAll('.gi-sprite-opt').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
          bossSprite = opt.dataset.sprite;
          // Update portrait
          portrait.querySelector('img').src = _trainerSprite(bossSprite);
        });
      });
    });

    setTimeout(() => {
      _say(LINES.sprite(gangName), () => {
        _fadeTransition(inputArea, () => {
          inputArea.innerHTML = `<div class="gi-actions-end">
            <button class="gi-btn gi-btn-primary" id="gi-sprite-next">${_t("C'est moi →", "That's me →")}</button>
          </div>`;
          inputArea.querySelector('#gi-sprite-next').addEventListener('click', stepDone);
        });
      });
    }, 200);
  }

  // ── STEP 4 — Done ─────────────────────────────────────────────
  function stepDone() {
    _clearTypeTimer();
    _updateDots(4);

    // Update portrait to chosen boss sprite
    portrait.querySelector('img').src = _trainerSprite(bossSprite);

    const starterData = INTRO_STARTERS.find(s => s.en === starterEn) || INTRO_STARTERS[0];

    _fadeTransition(contentZone, () => {
      contentZone.innerHTML = `
        <div class="gi-summary">
          <div class="gi-summary-label">${_t('RÉSUMÉ', 'SUMMARY')}</div>
          <div class="gi-summary-row">
            <img src="${_trainerSprite(bossSprite)}" class="gi-summary-boss-img" onerror="this.style.opacity='.2'">
            <div>
              <div class="gi-summary-name">${_esc(bossName)}</div>
              <div class="gi-summary-gang">${gangName}</div>
            </div>
            <div class="gi-summary-starter">
              <img src="${_ctx.pokeSprite?.(starterData.en, false) || ''}" class="gi-summary-starter-img" onerror="this.style.opacity='.2'">
              <div class="gi-summary-starter-name">${_starterName(starterData)}${identityOnly ? '' : ` ${_lvl(15)}`}</div>
            </div>
          </div>
        </div>`;
    });

    setTimeout(() => {
      _say(LINES.done(bossName, gangName), () => {
        _fadeTransition(inputArea, () => {
          inputArea.innerHTML = `
            <div class="gi-actions-end-gap">
              <button class="gi-btn gi-btn-ghost" id="gi-back-btn">${_t('← Modifier', '← Edit')}</button>
              <button class="gi-btn gi-btn-primary" id="gi-confirm-btn">${_t("C'est parti ! 🚀", "Let's go! 🚀")}</button>
            </div>`;

          inputArea.querySelector('#gi-back-btn').addEventListener('click', () => stepName());
          inputArea.querySelector('#gi-confirm-btn').addEventListener('click', () => _confirm());
        });
      });
    }, 200);
  }

  // ── Confirm + apply ───────────────────────────────────────────
  function _confirm() {
    if (_isClosing) return;

    const state = _ctx.getState?.();
    const sp = starterEn || INTRO_STARTERS[0].en;
    const payload = { bossName, gangName, bossSprite, starterEn: sp, slotIdx };

    if (!state) {
      // Nothing to persist, but the caller must still be released: onboarding
      // V2 awaits onComplete here, and skipping it left that promise pending
      // forever with the story lock still held — a worse failure than the
      // missing state itself. Callers detect the no-op from the unchanged step.
      console.error('[intro] No state available — identity was not persisted.');
      _closeIntro(payload, true);
      return;
    }

    try {
      // Apply player choices
      state.gang.bossName  = bossName  || 'Boss';
      state.gang.name      = gangName  || 'Team Fury';
      state.gang.bossSprite = bossSprite || 'red';
      state.gang.initialized = true;
      state.gang.introSeen   = true;

      // Legacy path creates the gift here. Onboarding V2 has already captured
      // the starter through zoneSystem.tryCapture(), so it must not be added twice.
      if (!identityOnly) {
        const starter = _ctx.makePokemon?.(sp, 'intro', 'pokeball');
        if (starter) {
          starter.level     = 15;
          starter.potential = 3;
          if (_ctx.calculateStats) starter.stats = _ctx.calculateStats(starter);
          starter.capturedIn = 'intro';
          starter.history = [{ type: 'starter', ts: Date.now(), zone: 'intro', ball: 'giovanni' }];
          if (!Array.isArray(state.pokemons)) state.pokemons = [];
          state.pokemons.push(starter); _dirty();
          EventBus.emit(EVENTS.POKEMON_CAPTURED, { pokemon: starter, zoneId: null, source: 'starter' });
          globalThis.registerPokedexCapture?.(state, starter);
        }
      }

      _ctx.setActiveSaveSlot?.(slotIdx);
      _ctx.saveState?.();
      _ctx.notify?.(_t(`🎉 Bienvenue ${bossName} ! Ta ${gangName} est fondée.`, `🎉 Welcome ${bossName}! Your ${gangName} is founded.`), 'gold');
      globalThis.trackEvent?.('new_game_started', { slot: slotIdx });
      if (!identityOnly) globalThis.trackEvent?.('starter_chosen', { species: sp });
      if (!identityOnly) globalThis.trackEvent?.('intro_completed', { slot: slotIdx });
    } catch (err) {
      console.error('[intro] Giovanni intro failed to persist:', err);
    } finally {
      _closeIntro(payload);
    }
  }

  // ── Start ─────────────────────────────────────────────────────
  stepName();
  return true;
}
// ── Private helper — trainer sprite URL ──────────────────────────
function _trainerSprite(name) {
  if (_ctx.trainerSprite) return _ctx.trainerSprite(name);
  return `https://play.pokemonshowdown.com/sprites/trainers/${name}.png`;
}

// ════════════════════════════════════════════════════════════════
//  CATCH-UP STARTER GIFT
//  Shown on boot for existing players who never went through the
//  Giovanni intro. Auto-fills their existing save info; they only
//  need to pick a starter.
// ════════════════════════════════════════════════════════════════
function _openStarterGiftPopupNow({ onComplete } = {}) {
  if (document.getElementById('starter-gift-overlay')) return false;

  const state = _ctx.getState?.();
  if (!state || !state.gang?.initialized || state.gang?.introSeen) return false;
  const storyOwner = 'starter-gift';

  const bossName = state.gang?.bossName || 'Boss';
  const gangName = state.gang?.name     || 'Team Fury';
  const bossSprite = state.gang?.bossSprite || 'red';

  let starterEn = '';
  let _isClosing = false;

  // ── Overlay (same visual language as main intro) ──────────────
  const overlay = document.createElement('div');
  overlay.id = 'starter-gift-overlay';
  overlay.className = 'gi-overlay';
  overlay.innerHTML = `
    <div class="gi-bg-texture"></div>
    <div id="sgp-stage" class="gi-stage"></div>`;

  document.body.appendChild(overlay);
  const stage = overlay.querySelector('#sgp-stage');

  // ── Giovanni portrait ─────────────────────────────────────────
  const portrait = document.createElement('div');
  portrait.className = 'gi-portrait';
  portrait.innerHTML = `
    <div class="gi-portrait-inner">
      <img src="${_trainerSprite('giovanni')}" class="gi-portrait-img" onerror="this.style.opacity='.3'">
    </div>`;
  overlay.appendChild(portrait);

  // ── Starter card area ─────────────────────────────────────────
  const contentZone = document.createElement('div');
  contentZone.className = 'gi-content';
  stage.appendChild(contentZone);

  // ── Dialog box ────────────────────────────────────────────────
  const dialog = document.createElement('div');
  dialog.className = 'gi-dialog';
  dialog.innerHTML = `
    <div class="gi-dialog-label">Giovanni</div>
    <div id="sgp-text" class="gi-text"></div>
    <div id="sgp-input" class="gi-input-area"></div>
    <div id="sgp-cursor" class="gi-cursor" style="display:none">▶</div>
  `;
  stage.appendChild(dialog);

  // ── Helpers ───────────────────────────────────────────────────
  const textEl  = dialog.querySelector('#sgp-text');
  const inputEl = dialog.querySelector('#sgp-input');
  const cursor  = dialog.querySelector('#sgp-cursor');
  let _twTimer  = null;

  function _clearTypeTimer() {
    if (!_twTimer) return;
    clearInterval(_twTimer);
    clearTimeout(_twTimer);
    _twTimer = null;
  }

  function _closeGift() {
    if (_isClosing) return;
    _isClosing = true;
    _clearTypeTimer();

    overlay.style.transition = 'opacity .4s ease';
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
      releaseStoryLock(storyOwner);
      onComplete?.();
    }, 400);
  }

  function _say(text, onDone) {
    _clearTypeTimer();
    cursor.style.display = 'none';
    textEl.textContent = '';
    let i = 0;
    _twTimer = setInterval(() => {
      textEl.textContent += text[i++];
      if (i >= text.length) {
        _clearTypeTimer();
        cursor.style.display = 'block';
        onDone?.();
      }
    }, 22);
  }

  // ── Giovanni's catch-up line ──────────────────────────────────
  const line = _t(
    `Tiens tiens… ${bossName}. Je vois que la ${gangName} est déjà sur pied. Mais tu n'as pas encore choisi ton Pokémon. Remédions à ça.`,
    `Well, well… ${bossName}. I see the ${gangName} is already up and running. But you haven't picked your Pokémon yet. Let's fix that.`
  );

  // Show starter cards
  contentZone.innerHTML = `
    <div class="gi-starter-row">
      ${INTRO_STARTERS.map(s => `
        <div class="sgp-starter-card" data-en="${s.en}">
          <img src="${_ctx.pokeSprite?.(s.en, false) || ''}" class="gi-starter-card-img" onerror="this.style.opacity='.2'">
          <div class="gi-starter-card-name">${_starterName(s)}</div>
          <div class="gi-starter-card-types">${_starterTypes(s)}</div>
          <div class="gi-starter-card-desc">${_starterDesc(s)}</div>
          <div class="gi-starter-card-level">${_lvl(15)} · ★★★</div>
        </div>`).join('')}
    </div>`;

  contentZone.querySelectorAll('.sgp-starter-card').forEach(card => {
    card.addEventListener('click', () => {
      contentZone.querySelectorAll('.sgp-starter-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      starterEn = card.dataset.en;
    });
  });

  _say(line, () => {
    inputEl.innerHTML = `
      <div class="gi-actions-end">
        <button class="gi-btn gi-btn-primary" id="sgp-confirm-btn">${_t('Prendre ce Pokémon →', 'Take this Pokémon →')}</button>
      </div>`;

    dialog.querySelector('#sgp-confirm-btn').addEventListener('click', () => {
      // Auto-pick first if nothing selected
      if (!starterEn) {
        const first = contentZone.querySelector('.sgp-starter-card');
        if (first) { first.classList.add('selected'); starterEn = first.dataset.en; }
      }
      _applyGift();
    });
  });

  // ── Apply gift ────────────────────────────────────────────────
  function _applyGift() {
    if (_isClosing) return;

    const sp = starterEn || INTRO_STARTERS[0].en;

    try {
      const starter = _ctx.makePokemon?.(sp, 'intro', 'pokeball');
      if (starter) {
        starter.level     = 15;
        starter.potential = 3;
        if (_ctx.calculateStats) starter.stats = _ctx.calculateStats(starter);
        starter.capturedIn = 'intro';
        starter.history = [{ type: 'starter', ts: Date.now(), zone: 'intro', ball: 'giovanni' }];
        if (!Array.isArray(state.pokemons)) state.pokemons = [];
        state.pokemons.push(starter); _dirty();
        EventBus.emit(EVENTS.POKEMON_CAPTURED, { pokemon: starter, zoneId: null, source: 'starter' });
        globalThis.registerPokedexCapture?.(state, starter);
      }

      state.gang.introSeen = true;
      _ctx.saveState?.();

      const starterName = _starterName(INTRO_STARTERS.find(s => s.en === sp)) || sp;
      _ctx.notify?.(_t(`🎁 Giovanni t'a offert ${starterName} niv. 15 !`, `🎁 Giovanni gave you ${starterName} lvl. 15!`), 'gold');
      globalThis.trackEvent?.('starter_gift_claimed', { species: sp });
    } catch (err) {
      console.error('[intro] Starter gift failed to persist:', err);
    } finally {
      _closeGift();
    }
  }

  return true;
}

export function openStarterGiftPopup(options = {}) {
  const storyOwner = 'starter-gift';
  const eligible = () => {
    const state = _ctx.getState?.();
    return !!state?.gang?.initialized && !state.gang.introSeen;
  };
  if (!eligible()) return false;
  return requestStory(storyOwner, () => _openStarterGiftPopupNow(options), {
    priority: STORY_PRIORITIES.BOOT,
    isEligible: eligible,
  });
}
