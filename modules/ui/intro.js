'use strict';

// ════════════════════════════════════════════════════════════════
//  GIOVANNI INTRO — narrative character creation sequence
//  Triggered when a new game slot is chosen on the hub.
//  deps (injected via configureIntro):
//    getState, makePokemon, calculateStats, pokeSprite, trainerSprite,
//    BOSS_SPRITES, saveState, notify
// ════════════════════════════════════════════════════════════════

let _ctx = {};
export function configureIntro(ctx) { _ctx = { ..._ctx, ...ctx }; }

// ── Starters offered by Giovanni ─────────────────────────────────
const INTRO_STARTERS = [
  {
    en: 'meowth',
    fr: 'Miaous',
    dex: 52,
    types: ['Normal'],
    desc: 'Agile et opportuniste.\nMaître des combines.',
    icon: '🪙',
  },
  {
    en: 'zubat',
    fr: 'Nosferapti',
    dex: 41,
    types: ['Poison', 'Vol'],
    desc: 'Discret et tenace.\nIl voit dans l\'ombre.',
    icon: '🦇',
  },
  {
    en: 'gastly',
    fr: 'Fantominus',
    dex: 92,
    types: ['Spectre', 'Poison'],
    desc: 'Insaisissable.\nSème la panique.',
    icon: '👻',
  },
];

// ── Boss sprite pool (player-character looking) ───────────────────
const INTRO_BOSS_SPRITES = [
  'red','leaf','ethan','kris','brendan','may','lucas','dawn','hilbert','hilda',
  'silver','blue','n','bianca','cheren',
];

// ── Giovanni's dialog lines ───────────────────────────────────────
const LINES = {
  name:    () => `P'tit gars... c'est quoi ton nom déjà ?`,
  starter: (name) => `${name}. J'ai vu en toi quelque chose — un potentiel. Je vais te confier l'un de mes Pokémon. Choisis celui qui te ressemble.`,
  gang:    (starter) => `${starter}... bon choix. Maintenant, ce gang a besoin d'un nom. Quelque chose qui en impose.`,
  sprite:  (gang) => `"${gang}"... j'aime ça. Et toi — à quoi tu ressembles ? Montre-moi ta tête.`,
  done:    (name, gang) => `Parfait, ${name}. La ${gang} est fondée. Maintenant va — et prouve-moi que tu vaux quelque chose.`,
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
export function openGiovanniIntro({ slotIdx = 0, onComplete } = {}) {
  const state       = _ctx.getState?.();
  const BOSS_SPRITES = _ctx.BOSS_SPRITES || INTRO_BOSS_SPRITES;

  // Session state
  let bossName   = '';
  let gangName   = '';
  let bossSprite = INTRO_BOSS_SPRITES[0];
  let starterEn  = '';
  let _typeTimer = null;

  // ── Overlay ───────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'giovanni-intro-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:8000;
    background:linear-gradient(160deg,#09090f 0%,#140808 55%,#0a0a0f 100%);
    display:flex;flex-direction:column;align-items:center;justify-content:flex-end;
    font-family:var(--font-system,sans-serif);
    overflow:hidden;
    padding:0 0 0 0;
  `;

  // Subtle background texture
  overlay.innerHTML = `
    <div style="position:absolute;inset:0;pointer-events:none;
      background:radial-gradient(ellipse at 50% 20%,rgba(180,30,30,.07) 0%,transparent 65%),
                 radial-gradient(ellipse at 20% 80%,rgba(80,20,80,.05) 0%,transparent 50%)">
    </div>
    <div id="gi-stage" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:0 16px 0;">
    </div>`;

  document.body.appendChild(overlay);

  const stage = overlay.querySelector('#gi-stage');

  // ── Giovanni portrait area ────────────────────────────────────
  const portrait = document.createElement('div');
  portrait.id = 'gi-portrait';
  portrait.style.cssText = `
    position:absolute;top:0;left:50%;transform:translateX(-50%);
    width:100%;max-width:560px;
    display:flex;align-items:flex-start;justify-content:center;
    padding-top:32px;
    pointer-events:none;
    transition:opacity .3s ease;
  `;
  portrait.innerHTML = `
    <div style="position:relative;text-align:center">
      <img src="${_trainerSprite('giovanni')}"
        style="width:140px;height:140px;image-rendering:pixelated;
               filter:drop-shadow(0 8px 24px rgba(180,20,20,.45));
               animation:gi-bob 2.8s ease-in-out infinite"
        onerror="this.style.opacity='.3'">
      <div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);
        width:80px;height:10px;
        background:radial-gradient(ellipse,rgba(0,0,0,.5) 0%,transparent 70%);
        filter:blur(3px)"></div>
    </div>`;
  overlay.appendChild(portrait);

  // ── Content zone (choices rendered above dialog) ──────────────
  const contentZone = document.createElement('div');
  contentZone.id = 'gi-content';
  contentZone.style.cssText = `
    width:100%;max-width:560px;
    margin-bottom:8px;
    min-height:180px;
    display:flex;align-items:flex-end;justify-content:center;
    padding:0 8px;
  `;
  stage.appendChild(contentZone);

  // ── Dialog box ────────────────────────────────────────────────
  const dialog = document.createElement('div');
  dialog.id = 'gi-dialog';
  dialog.style.cssText = `
    width:100%;max-width:560px;
    background:rgba(6,6,10,.95);
    border:2px solid rgba(180,30,30,.6);
    border-radius:8px;
    padding:16px 18px 18px;
    margin-bottom:24px;
    box-shadow:0 -4px 32px rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,255,255,.04);
    position:relative;
  `;
  dialog.innerHTML = `
    <div style="font-family:var(--font-pixel,monospace);font-size:7px;color:rgba(204,60,60,.9);
      letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px">Giovanni</div>
    <div id="gi-text" style="font-size:14px;color:#e8e8e8;line-height:1.65;min-height:46px"></div>
    <div id="gi-input-area" style="margin-top:14px"></div>
    <div id="gi-cursor" style="position:absolute;bottom:14px;right:16px;
      font-size:10px;color:rgba(204,60,60,.7);
      animation:gi-blink 1s ease-in-out infinite;display:none">▶</div>
  `;
  stage.appendChild(dialog);

  // ── CSS animations ────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    @keyframes gi-bob   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
    @keyframes gi-blink { 0%,100%{opacity:.7} 50%{opacity:.15} }
    @keyframes gi-fadein{ from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    #gi-dialog { animation:gi-fadein .3s ease }
    .gi-starter-card {
      flex:1;min-width:0;
      background:rgba(255,255,255,.03);
      border:2px solid rgba(255,255,255,.1);
      border-radius:8px;padding:12px 8px;
      cursor:pointer;text-align:center;
      transition:border-color .15s,background .15s,transform .12s;
    }
    .gi-starter-card:hover { border-color:rgba(204,60,60,.6);background:rgba(204,60,60,.07);transform:translateY(-3px) }
    .gi-starter-card.selected { border-color:var(--gold,#fcc800);background:rgba(200,160,0,.10);transform:translateY(-3px) }
    .gi-sprite-opt {
      width:68px;height:68px;
      background:rgba(255,255,255,.04);
      border:2px solid rgba(255,255,255,.08);
      border-radius:6px;
      cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      transition:border-color .15s,background .15s;
    }
    .gi-sprite-opt:hover  { border-color:rgba(200,160,0,.5);background:rgba(200,160,0,.07) }
    .gi-sprite-opt.selected { border-color:var(--gold,#fcc800);background:rgba(200,160,0,.12) }
    .gi-btn {
      font-family:var(--font-pixel,monospace);
      font-size:10px;padding:10px 22px;
      border-radius:6px;border:none;
      cursor:pointer;transition:background .15s,transform .1s;
    }
    .gi-btn:active { transform:scale(.97) }
    .gi-btn-primary { background:var(--red,#cc3333);color:#fff }
    .gi-btn-primary:hover { background:#aa2222 }
    .gi-btn-ghost {
      background:transparent;
      border:1px solid rgba(255,255,255,.15);
      color:rgba(255,255,255,.5);
      font-size:9px;padding:8px 14px;
    }
    .gi-btn-ghost:hover { border-color:rgba(255,255,255,.35);color:rgba(255,255,255,.8) }
    .gi-input {
      width:100%;background:rgba(255,255,255,.05);
      border:1px solid rgba(180,30,30,.5);
      border-radius:6px;color:#e8e8e8;
      padding:10px 14px;font-size:16px;
      box-sizing:border-box;outline:none;
      transition:border-color .15s;
    }
    .gi-input:focus { border-color:rgba(204,60,60,.9) }
    .gi-step-dots { display:flex;gap:6px;justify-content:center;margin-bottom:6px }
    .gi-dot { width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,.15);transition:background .3s }
    .gi-dot.active { background:rgba(204,60,60,.85) }
    .gi-dot.done   { background:rgba(200,160,0,.6) }
  `;
  document.head.appendChild(style);

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

  function _say(text, onDone) {
    if (_typeTimer) clearInterval(_typeTimer);
    cursor.style.display = 'none';
    _typeTimer = _typewrite(textEl, text, () => {
      cursor.style.display = 'block';
      onDone?.();
    });
  }

  function _clearContent() {
    _fadeTransition(contentZone, () => { contentZone.innerHTML = ''; });
    inputArea.innerHTML = '';
    cursor.style.display = 'none';
  }

  function _trainerUrl(name) { return _trainerSprite(name); }

  // ── STEP 0 — Boss name ────────────────────────────────────────
  function stepName() {
    _updateDots(0);
    _clearContent();
    _say(LINES.name(), () => {
      _fadeTransition(inputArea, () => {
        inputArea.innerHTML = `
          <div style="display:flex;gap:8px;align-items:center">
            <input class="gi-input" id="gi-name-input" maxlength="20" placeholder="Ton nom de boss…" autocomplete="off">
            <button class="gi-btn gi-btn-primary" id="gi-name-next">→</button>
          </div>
          <div style="font-size:9px;color:rgba(255,255,255,.25);margin-top:6px">Max. 20 caractères</div>`;
        const input = inputArea.querySelector('#gi-name-input');
        const btn   = inputArea.querySelector('#gi-name-next');
        input.focus();
        const next = () => {
          const val = input.value.trim();
          if (!val) { input.style.borderColor = 'rgba(255,80,80,.9)'; input.focus(); return; }
          bossName = val;
          stepStarter();
        };
        btn.addEventListener('click', next);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') next(); });
      });
    });
  }

  // ── STEP 1 — Starter choice ───────────────────────────────────
  function stepStarter() {
    _updateDots(1);

    // Show starter cards above dialog
    _fadeTransition(contentZone, () => {
      contentZone.innerHTML = `
        <div style="display:flex;gap:10px;width:100%;padding:0 4px;align-items:stretch">
          ${INTRO_STARTERS.map(s => `
            <div class="gi-starter-card" data-en="${s.en}">
              <img src="${_ctx.pokeSprite?.(s.en, false) || ''}"
                style="width:72px;height:72px;image-rendering:pixelated;display:block;margin:0 auto 8px"
                onerror="this.style.opacity='.2'">
              <div style="font-family:var(--font-pixel,monospace);font-size:9px;color:#e8e8e8;margin-bottom:4px">${s.fr}</div>
              <div style="font-size:8px;color:rgba(255,255,255,.35);margin-bottom:8px">${s.types.join(' · ')}</div>
              <div style="font-size:10px;color:rgba(255,255,255,.6);line-height:1.5;white-space:pre-line">${s.desc}</div>
              <div style="margin-top:8px;font-size:8px;color:rgba(200,160,0,.7)">Niv. 15 · ★★★</div>
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
          inputArea.innerHTML = `<div style="display:flex;justify-content:flex-end">
            <button class="gi-btn gi-btn-primary" id="gi-starter-next">Choisir →</button>
          </div>`;
          inputArea.querySelector('#gi-starter-next').addEventListener('click', () => {
            if (!starterEn) {
              // Auto-select first if none chosen
              const firstCard = contentZone.querySelector('.gi-starter-card');
              if (firstCard) { firstCard.classList.add('selected'); starterEn = firstCard.dataset.en; }
              else return;
            }
            const starterFr = INTRO_STARTERS.find(s => s.en === starterEn)?.fr || starterEn;
            stepGang(starterFr);
          });
        });
      });
    }, 260);
  }

  // ── STEP 2 — Gang name ────────────────────────────────────────
  function stepGang(starterFr) {
    _updateDots(2);

    // Collapse starter cards
    _fadeTransition(contentZone, () => { contentZone.innerHTML = ''; });

    setTimeout(() => {
      _say(LINES.gang(starterFr), () => {
        _fadeTransition(inputArea, () => {
          inputArea.innerHTML = `
            <div style="display:flex;gap:8px;align-items:center">
              <input class="gi-input" id="gi-gang-input" maxlength="24" placeholder="Nom du gang…" autocomplete="off">
              <button class="gi-btn gi-btn-primary" id="gi-gang-next">→</button>
            </div>
            <div style="font-size:9px;color:rgba(255,255,255,.25);margin-top:6px">Max. 24 caractères</div>`;
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
    _updateDots(3);

    _fadeTransition(contentZone, () => {
      const spritePool = (BOSS_SPRITES?.length ? BOSS_SPRITES : INTRO_BOSS_SPRITES).slice(0, 20);
      contentZone.innerHTML = `
        <div style="width:100%;background:rgba(0,0,0,.3);border-radius:8px;padding:12px 8px">
          <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
            ${spritePool.map(s => `
              <div class="gi-sprite-opt" data-sprite="${s}">
                <img src="${_trainerSprite(s)}"
                  style="width:44px;height:44px;image-rendering:pixelated"
                  onerror="this.closest('.gi-sprite-opt').style.display='none'">
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
          inputArea.innerHTML = `<div style="display:flex;justify-content:flex-end">
            <button class="gi-btn gi-btn-primary" id="gi-sprite-next">C'est moi →</button>
          </div>`;
          inputArea.querySelector('#gi-sprite-next').addEventListener('click', stepDone);
        });
      });
    }, 200);
  }

  // ── STEP 4 — Done ─────────────────────────────────────────────
  function stepDone() {
    _updateDots(4);

    // Update portrait to chosen boss sprite
    portrait.querySelector('img').src = _trainerSprite(bossSprite);

    const starterData = INTRO_STARTERS.find(s => s.en === starterEn) || INTRO_STARTERS[0];

    _fadeTransition(contentZone, () => {
      contentZone.innerHTML = `
        <div style="width:100%;background:rgba(0,0,0,.3);border:1px solid rgba(200,160,0,.15);
          border-radius:8px;padding:16px 18px;display:flex;flex-direction:column;gap:10px">
          <div style="font-family:var(--font-pixel,monospace);font-size:8px;color:rgba(200,160,0,.7);
            letter-spacing:.6px;margin-bottom:2px">RÉSUMÉ</div>
          <div style="display:flex;align-items:center;gap:14px">
            <img src="${_trainerSprite(bossSprite)}"
              style="width:52px;height:52px;image-rendering:pixelated"
              onerror="this.style.opacity='.2'">
            <div>
              <div style="font-size:15px;color:#e8e8e8;font-weight:600">${bossName}</div>
              <div style="font-size:11px;color:rgba(255,255,255,.45);margin-top:2px">${gangName}</div>
            </div>
            <div style="margin-left:auto;text-align:center">
              <img src="${_ctx.pokeSprite?.(starterData.en, false) || ''}"
                style="width:56px;height:56px;image-rendering:pixelated;display:block;margin:0 auto"
                onerror="this.style.opacity='.2'">
              <div style="font-size:9px;color:rgba(255,255,255,.45);margin-top:2px">${starterData.fr} niv.15</div>
            </div>
          </div>
        </div>`;
    });

    setTimeout(() => {
      _say(LINES.done(bossName, gangName), () => {
        _fadeTransition(inputArea, () => {
          inputArea.innerHTML = `
            <div style="display:flex;justify-content:flex-end;gap:10px;align-items:center">
              <button class="gi-btn gi-btn-ghost" id="gi-back-btn">← Modifier</button>
              <button class="gi-btn gi-btn-primary" id="gi-confirm-btn">C'est parti ! 🚀</button>
            </div>`;

          inputArea.querySelector('#gi-back-btn').addEventListener('click', () => stepName());
          inputArea.querySelector('#gi-confirm-btn').addEventListener('click', () => _confirm());
        });
      });
    }, 200);
  }

  // ── Confirm + apply ───────────────────────────────────────────
  function _confirm() {
    const state = _ctx.getState?.();
    if (!state) return;

    // Apply player choices
    state.gang.bossName  = bossName  || 'Boss';
    state.gang.name      = gangName  || 'Team Fury';
    state.gang.bossSprite = bossSprite || 'red';
    state.gang.initialized = true;
    state.gang.introSeen   = true;

    // Create starter Pokémon (level 15, potential 3)
    const sp = starterEn || INTRO_STARTERS[0].en;
    const starter = _ctx.makePokemon?.(sp, 'intro', 'pokeball');
    if (starter) {
      starter.level     = 15;
      starter.potential = 3;
      if (_ctx.calculateStats) starter.stats = _ctx.calculateStats(starter);
      starter.capturedIn = 'intro';
      starter.history = [{ type: 'starter', ts: Date.now(), zone: 'intro', ball: 'giovanni' }];
      if (!Array.isArray(state.pokemons)) state.pokemons = [];
      state.pokemons.push(starter);
    }

    // Save + close
    _ctx.saveState?.();
    _ctx.notify?.(`🎉 Bienvenue ${bossName} ! Ta ${gangName} est fondée.`, 'gold');

    // Fade out overlay
    overlay.style.transition = 'opacity .4s ease';
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
      style.remove();
      onComplete?.({ bossName, gangName, bossSprite, starterEn: sp, slotIdx });
    }, 400);
  }

  // ── Start ─────────────────────────────────────────────────────
  stepName();
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
export function openStarterGiftPopup({ onComplete } = {}) {
  const state = _ctx.getState?.();
  if (!state) return;

  const bossName = state.gang?.bossName || 'Boss';
  const gangName = state.gang?.name     || 'Team Fury';
  const bossSprite = state.gang?.bossSprite || 'red';

  let starterEn = '';

  // ── Overlay (same visual language as main intro) ──────────────
  const overlay = document.createElement('div');
  overlay.id = 'starter-gift-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:8000;
    background:linear-gradient(160deg,#09090f 0%,#140808 55%,#0a0a0f 100%);
    display:flex;flex-direction:column;align-items:center;justify-content:flex-end;
    font-family:var(--font-system,sans-serif);
    overflow:hidden;
  `;
  overlay.innerHTML = `
    <div style="position:absolute;inset:0;pointer-events:none;
      background:radial-gradient(ellipse at 50% 20%,rgba(180,30,30,.07) 0%,transparent 65%),
                 radial-gradient(ellipse at 20% 80%,rgba(80,20,80,.05) 0%,transparent 50%)">
    </div>
    <div id="sgp-stage" style="position:absolute;inset:0;display:flex;flex-direction:column;
      align-items:center;justify-content:flex-end;padding:0 16px 0;"></div>`;

  document.body.appendChild(overlay);
  const stage = overlay.querySelector('#sgp-stage');

  // ── Giovanni portrait ─────────────────────────────────────────
  const portrait = document.createElement('div');
  portrait.style.cssText = `
    position:absolute;top:0;left:50%;transform:translateX(-50%);
    width:100%;max-width:560px;
    display:flex;align-items:flex-start;justify-content:center;
    padding-top:32px;pointer-events:none;
  `;
  portrait.innerHTML = `
    <div style="position:relative;text-align:center">
      <img src="${_trainerSprite('giovanni')}"
        style="width:140px;height:140px;image-rendering:pixelated;
               filter:drop-shadow(0 8px 24px rgba(180,20,20,.45));
               animation:gi-bob 2.8s ease-in-out infinite"
        onerror="this.style.opacity='.3'">
    </div>`;
  overlay.appendChild(portrait);

  // ── Starter card area ─────────────────────────────────────────
  const contentZone = document.createElement('div');
  contentZone.style.cssText = `
    width:100%;max-width:560px;margin-bottom:8px;min-height:180px;
    display:flex;align-items:flex-end;justify-content:center;padding:0 8px;
  `;
  stage.appendChild(contentZone);

  // ── Dialog box ────────────────────────────────────────────────
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    width:100%;max-width:560px;
    background:rgba(6,6,10,.95);
    border:2px solid rgba(180,30,30,.6);
    border-radius:8px;padding:16px 18px 18px;
    margin-bottom:24px;
    box-shadow:0 -4px 32px rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,255,255,.04);
    position:relative;
  `;
  dialog.innerHTML = `
    <div style="font-family:var(--font-pixel,monospace);font-size:7px;color:rgba(204,60,60,.9);
      letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px">Giovanni</div>
    <div id="sgp-text" style="font-size:14px;color:#e8e8e8;line-height:1.65;min-height:46px"></div>
    <div id="sgp-input" style="margin-top:14px"></div>
    <div id="sgp-cursor" style="position:absolute;bottom:14px;right:16px;
      font-size:10px;color:rgba(204,60,60,.7);
      animation:gi-blink 1s ease-in-out infinite;display:none">▶</div>
  `;
  stage.appendChild(dialog);

  // ── Shared CSS (reuse gi-* keyframes if already present) ─────
  const style = document.createElement('style');
  style.textContent = `
    @keyframes gi-bob   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
    @keyframes gi-blink { 0%,100%{opacity:.7} 50%{opacity:.15} }
    .sgp-starter-card {
      flex:1;min-width:0;
      background:rgba(255,255,255,.03);
      border:2px solid rgba(255,255,255,.1);
      border-radius:8px;padding:12px 8px;
      cursor:pointer;text-align:center;
      transition:border-color .15s,background .15s,transform .12s;
    }
    .sgp-starter-card:hover  { border-color:rgba(204,60,60,.6);background:rgba(204,60,60,.07);transform:translateY(-3px) }
    .sgp-starter-card.selected { border-color:var(--gold,#fcc800);background:rgba(200,160,0,.10);transform:translateY(-3px) }
  `;
  document.head.appendChild(style);

  // ── Helpers ───────────────────────────────────────────────────
  const textEl  = dialog.querySelector('#sgp-text');
  const inputEl = dialog.querySelector('#sgp-input');
  const cursor  = dialog.querySelector('#sgp-cursor');
  let _twTimer  = null;

  function _say(text, onDone) {
    if (_twTimer) clearInterval(_twTimer);
    cursor.style.display = 'none';
    textEl.textContent = '';
    let i = 0;
    _twTimer = setInterval(() => {
      textEl.textContent += text[i++];
      if (i >= text.length) { clearInterval(_twTimer); cursor.style.display = 'block'; onDone?.(); }
    }, 22);
  }

  // ── Giovanni's catch-up line ──────────────────────────────────
  const line = `Tiens tiens… ${bossName}. Je vois que la ${gangName} est déjà sur pied. Mais tu n'as pas encore choisi ton Pokémon. Remédions à ça.`;

  // Show starter cards
  contentZone.innerHTML = `
    <div style="display:flex;gap:10px;width:100%;padding:0 4px;align-items:stretch">
      ${INTRO_STARTERS.map(s => `
        <div class="sgp-starter-card" data-en="${s.en}">
          <img src="${_ctx.pokeSprite?.(s.en, false) || ''}"
            style="width:72px;height:72px;image-rendering:pixelated;display:block;margin:0 auto 8px"
            onerror="this.style.opacity='.2'">
          <div style="font-family:var(--font-pixel,monospace);font-size:9px;color:#e8e8e8;margin-bottom:4px">${s.fr}</div>
          <div style="font-size:8px;color:rgba(255,255,255,.35);margin-bottom:8px">${s.types.join(' · ')}</div>
          <div style="font-size:10px;color:rgba(255,255,255,.6);line-height:1.5;white-space:pre-line">${s.desc}</div>
          <div style="margin-top:8px;font-size:8px;color:rgba(200,160,0,.7)">Niv. 15 · ★★★</div>
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
      <div style="display:flex;justify-content:flex-end">
        <button style="
          font-family:var(--font-pixel,monospace);font-size:10px;
          padding:10px 22px;border-radius:6px;border:none;cursor:pointer;
          background:var(--red,#cc3333);color:#fff;transition:background .15s"
          id="sgp-confirm-btn">Prendre ce Pokémon →</button>
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
    const sp = starterEn || INTRO_STARTERS[0].en;
    const starter = _ctx.makePokemon?.(sp, 'intro', 'pokeball');
    if (starter) {
      starter.level     = 15;
      starter.potential = 3;
      if (_ctx.calculateStats) starter.stats = _ctx.calculateStats(starter);
      starter.capturedIn = 'intro';
      starter.history = [{ type: 'starter', ts: Date.now(), zone: 'intro', ball: 'giovanni' }];
      if (!Array.isArray(state.pokemons)) state.pokemons = [];
      state.pokemons.push(starter);
    }

    state.gang.introSeen = true;
    _ctx.saveState?.();

    const starterFr = INTRO_STARTERS.find(s => s.en === sp)?.fr || sp;
    _ctx.notify?.(`🎁 Giovanni t'a offert ${starterFr} niv. 15 !`, 'gold');

    // Fade out
    overlay.style.transition = 'opacity .4s ease';
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
      style.remove();
      onComplete?.();
    }, 400);
  }
}
