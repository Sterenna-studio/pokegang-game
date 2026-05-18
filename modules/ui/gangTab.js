'use strict';

import { SHOWCASE_SLOTS, BOSS_TEAM_SLOTS } from '../../data/game-config-data.js';
import { BALL_SPRITES } from '../../data/assets-data.js';

// deps (globalThis): state, notify, saveState, updateTopBar, switchTab, showConfirm, SFX,
//   pokeSprite, pokeIcon, trainerSprite, pokemonDisplayName,
//   getBossFullTitle, getTitleLabel, getShinySpeciesCount,
//   getDexKantoCaught, getDexNationalCaught, KANTO_DEX_SIZE, NATIONAL_DEX_SIZE,
//   EVO_BY_SPECIES, isZoneUnlocked, applyCosmetics, MusicPlayer, MUSIC_TRACKS, GAME_VERSION,
//   openBossEditModal, openTitleModal, openShowcasePicker, openTeamPickerModal,
//   showEvoPreviewModal, openNameModal, openSpritePicker,
//   COSMETIC_BGS, FABRIC_SPECIES, PATCH_PIDS, fabricBgUrl, patchUrl,
//   _gbase_openExportModal
// classic-script globals (bare name): ZONES

const _gangCollapsed = { services: false, music: false, appearance: false, stats: false };
let _statsViewMode = 'session';

// ── Render guard — évite les rechargements intempestifs du tab Gang ──
// _gangTabLocked        : posé par les pickers/modals ouverts sur ce tab
// _gangTabTimer         : debounce 80 ms pour regrouper les appels rapides successifs
// _gangTabPendingRender : render différé (lock actif ou focus dans le tab)
// _gangFocusOutWired    : listener focusout déjà posé (évite les doublons)
let _gangTabLocked        = false;
let _gangTabTimer         = null;
let _gangTabPendingRender = false;
let _gangFocusOutWired    = false;

export function lockGangTab()   { _gangTabLocked = true; }
export function unlockGangTab() {
  _gangTabLocked = false;
  if (_gangTabPendingRender) { _gangTabPendingRender = false; renderGangTab(); }
}

// Pose un listener focusout unique sur le tab pour déclencher le render différé
// dès que l'utilisateur quitte l'input actif.
function _ensureGangFocusOutHandler(tab) {
  if (_gangFocusOutWired) return;
  _gangFocusOutWired = true;
  tab.addEventListener('focusout', function onFocusOut(e) {
    // Ignorer si le focus reste dans le tab (ex: passer d'un range à un bouton)
    if (tab.contains(e.relatedTarget)) return;
    _gangFocusOutWired = false;
    tab.removeEventListener('focusout', onFocusOut);
    if (_gangTabPendingRender) { _gangTabPendingRender = false; renderGangTab(); }
  });
}
const FABRIC_SHOP_COST = 100_000;

// ── Fabric slider freeze — préserve la scrollbar quand le joueur survole la grille ──
// Lorsque _fabricFrozen est vrai, renderAppearancePanel détache le slider existant
// avant de reconstruire le HTML et le réinsère ensuite (scroll intact).
let _fabricFrozen = false;
let _fabricFreezeTimer = null;
function _freezeFabric()  {
  clearTimeout(_fabricFreezeTimer);
  _fabricFrozen = true;
}
function _thawFabric(delay = 1500) {
  clearTimeout(_fabricFreezeTimer);
  _fabricFreezeTimer = setTimeout(() => { _fabricFrozen = false; }, delay);
}
function _wireFabricFreeze(sliderEl) {
  sliderEl.addEventListener('mouseenter', _freezeFabric);
  sliderEl.addEventListener('mouseleave', () => _thawFabric(1500));
  sliderEl.addEventListener('touchstart', _freezeFabric, { passive: true });
  sliderEl.addEventListener('touchend',   () => _thawFabric(3000), { passive: true });
}

// ── Music panel ───────────────────────────────────────────────────────────────
function renderMusicPanel(container) {
  const JUKEBOX_TRACKS = [
    { key: 'base',     icon: '🏠', label: 'Base' },
    { key: 'forest',   icon: '🌿', label: 'Route' },
    { key: 'cave',     icon: '⛏',  label: 'Caverne' },
    { key: 'city',     icon: '🏙', label: 'Ville' },
    { key: 'sea',      icon: '🌊', label: 'Mer' },
    { key: 'safari',   icon: '🦒', label: 'Safari' },
    { key: 'lavender', icon: '💜', label: 'Lavanville' },
    { key: 'tower',    icon: '👻', label: 'Tour' },
    { key: 'mansion',  icon: '🕯',  label: 'Manoir' },
    { key: 'gym',      icon: '⚔',  label: 'Arène' },
    { key: 'rocket',   icon: '🚀', label: 'Rocket' },
    { key: 'silph',    icon: '🔬', label: 'Sylphe' },
    { key: 'elite4',   icon: '👑', label: 'Élite 4' },
    { key: 'casino',   icon: '🎰', label: 'Casino' },
  ];
  const MUSIC_TRACKS = globalThis.MUSIC_TRACKS || {};
  const currentJuke  = globalThis.state.settings?.jukeboxTrack || null;
  const isTrackUnlocked = (key) => {
    if (key === 'base') return true;
    return ZONES.some(z => z.music === key && globalThis.isZoneUnlocked(z.id));
  };

  const jukeHtml = JUKEBOX_TRACKS.map(t => {
    const ok  = isTrackUnlocked(t.key);
    const act = currentJuke === t.key;
    return `<div class="jukebox-track${act ? ' active' : ''}${ok ? '' : ' locked'}" data-jukebox-track="${t.key}" title="${t.label}${ok ? '' : ' — Verrou'}">
      <span class="juke-icon">${ok ? t.icon : '🔒'}</span>
      <span class="juke-label">${t.label}</span>
    </div>`;
  }).join('');

  container.innerHTML = `
    <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:6px">
      En cours : <span style="color:var(--gold)">${currentJuke ? (MUSIC_TRACKS[currentJuke]?.fr || currentJuke) : 'AUTO'}</span>
    </div>
    <div class="base-jukebox">
      ${jukeHtml}
      <div class="jukebox-track${!currentJuke ? ' active' : ''}" data-jukebox-track="__auto__" title="Musique automatique selon la zone">
        <span class="juke-icon">🔄</span><span class="juke-label">AUTO</span>
      </div>
    </div>`;

  container.querySelectorAll('[data-jukebox-track]').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.jukeboxTrack;
      if (el.classList.contains('locked')) { globalThis.notify('🔒 Débloquez cette zone pour accéder à cette musique', 'error'); return; }
      if (key === '__auto__') {
        globalThis.state.settings.jukeboxTrack = null;
        globalThis.notify('🎵 Jukebox → Auto', 'success');
      } else {
        globalThis.state.settings.jukeboxTrack = key;
        globalThis.notify(`🎵 ${MUSIC_TRACKS[key]?.fr || key}`, 'success');
      }
      globalThis.saveState();
      globalThis.MusicPlayer?.updateFromContext();
      renderMusicPanel(container);
    });
  });
}

// ── Ball skins section ────────────────────────────────────────────────────────
const BALL_SKIN_KEYS = ['greatball', 'duskball', 'ultraball', 'masterball'];

function _buildBallSkinsHtml(state) {
  const lang = state.lang === 'fr' ? 'fr' : 'en';
  const BALLS = globalThis.BALLS || {};
  const activeBall = state.activeBall || 'pokeball';

  const rows = BALL_SKIN_KEYS.map(key => {
    const ballDef   = BALLS[key] || { fr: key, en: key, color: '#888', icon: '?' };
    const skinItem  = (globalThis.SHOP_ITEMS || []).find(s => s.ballSkin === key);
    const owned     = !!(state.purchases?.[`skin_${key}`]);
    const active    = activeBall === key;
    const cost      = skinItem?.cost || 0;
    const canAfford = (state.gang.money || 0) >= cost;
    const shopIdx   = (globalThis.SHOP_ITEMS || []).indexOf(skinItem);

    return `<div style="display:flex;align-items:center;gap:10px;padding:6px 4px;border-bottom:1px solid var(--border-dim)">
      <img src="${BALL_SPRITES[key] || ''}" style="width:24px;height:24px;image-rendering:pixelated;flex-shrink:0">
      <div style="flex:1;min-width:0">
        <div style="font-size:10px;color:var(--text)">${lang === 'fr' ? ballDef.fr : ballDef.en}</div>
        ${owned ? `<div style="font-size:8px;color:var(--text-dim)">Débloqué</div>` : `<div style="font-size:8px;color:var(--gold)">${cost.toLocaleString()}₽</div>`}
      </div>
      ${owned
        ? `<button data-gang-set-ball="${key}" style="font-family:var(--font-pixel);font-size:8px;padding:4px 9px;cursor:pointer;
            background:${active ? 'var(--red-dark)' : 'var(--bg)'};
            border:1px solid ${active ? 'var(--red)' : 'var(--border-light)'};
            border-radius:var(--radius-sm);color:${active ? 'var(--text)' : 'var(--text-dim)'};white-space:nowrap">
            ${active ? '✓ ACTIF' : 'UTILISER'}
           </button>`
        : `<button data-gang-buy-skin="${shopIdx}" ${canAfford && shopIdx >= 0 ? '' : 'disabled'}
            style="font-family:var(--font-pixel);font-size:8px;padding:4px 9px;
            cursor:${canAfford && shopIdx >= 0 ? 'pointer' : 'default'};
            background:var(--bg);border:1px solid ${canAfford && shopIdx >= 0 ? 'var(--gold-dim)' : 'var(--border)'};
            border-radius:var(--radius-sm);color:${canAfford && shopIdx >= 0 ? 'var(--gold)' : 'var(--text-dim)'}">
            ACHETER
           </button>`
      }
    </div>`;
  }).join('');

  // Skin actif du boss (poké ball = défaut, toujours dispo)
  const activeDef = BALLS[activeBall] || { fr: 'Poké Ball', en: 'Poké Ball' };
  const activeLabel = lang === 'fr' ? activeDef.fr : activeDef.en;

  return `
    <div style="margin-top:20px">
      <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold-dim);margin-bottom:6px;letter-spacing:.5px">
        🎳 SKINS DE BALL
      </div>
      <div style="font-size:9px;color:var(--text-dim);margin-bottom:8px">
        Skin actif : <b style="color:var(--gold)">${activeLabel}</b>
        <span style="font-size:8px;opacity:.6"> — cosmétique uniquement (boss + agents)</span>
      </div>
      ${rows}
    </div>`;
}

// ── Appearance panel (backgrounds + pins) ────────────────────────────────────
function renderAppearancePanel(container) {
  // ── Détache le slider si le joueur est dessus (évite le reset de scrollbar) ──
  const _existingSlider = container.querySelector('#fabricSlider');
  let   _detachedSlider = null;
  if (_fabricFrozen && _existingSlider) {
    _detachedSlider = _existingSlider;
    _existingSlider.remove();         // retiré du DOM, mais conservé en mémoire
  }

  const state         = globalThis.state;
  const unlocked      = new Set(state.cosmetics?.unlockedBgs || []);
  const active        = state.cosmetics?.gameBg || null;
  const favoriteBgs   = state.cosmetics?.favoriteBgs  || [];
  const activePatches = state.cosmetics?.activePatches || [];
  const fabricMode    = state.cosmetics?.fabricMode    || 'repeat';
  const fabricSize    = state.cosmetics?.fabricSize    ?? 320;
  const fabricOpacity = state.cosmetics?.fabricOpacity ?? 72;
  const isFabricActive = active?.startsWith('fabric_') ?? false;

  // ── wallpaper card builder (80px thumb) ──
  const _bgCard = (key, c) => {
    const own   = unlocked.has(key);
    const isAct = active === key;
    const thumb = c.type === 'image'
      ? `<div style="height:80px;background-image:url('${c.url}');background-size:cover;background-position:center;border-radius:2px;margin-bottom:6px"></div>`
      : `<div style="height:80px;background:${c.gradient};border-radius:2px;margin-bottom:6px"></div>`;
    return `<div class="cosm-card${isAct ? ' cosm-active' : ''}" data-cosm="${key}"
      style="border:2px solid ${isAct ? 'var(--gold)' : own ? 'var(--green)' : 'var(--border)'};border-radius:var(--radius-sm);padding:8px;cursor:pointer;background:var(--bg-card)">
      ${thumb}
      <div style="font-size:9px">${c.fr}</div>
      <div style="font-size:8px;color:${isAct ? 'var(--gold)' : own ? 'var(--green)' : 'var(--text-dim)'}">
        ${isAct ? '[ ACTIF ]' : own ? 'Équiper' : c.cost.toLocaleString() + '₽'}
      </div>
    </div>`;
  };

  const defaultCard = `<div class="cosm-card${!active ? ' cosm-active' : ''}" data-cosm="none"
    style="border:2px solid ${!active ? 'var(--gold)' : 'var(--border)'};border-radius:var(--radius-sm);padding:8px;cursor:pointer;background:var(--bg-card)">
    <div style="height:80px;background:linear-gradient(180deg,#0a0a0a,#1a1a1a);border-radius:2px;margin-bottom:6px"></div>
    <div style="font-size:9px">Défaut</div>
    <div style="font-size:8px;color:${!active ? 'var(--gold)' : 'var(--text-dim)'}">Gratuit${!active ? ' [ ACTIF ]' : ''}</div>
  </div>`;

  const bgHtml = Object.entries(COSMETIC_BGS).map(([k, c]) => _bgCard(k, c)).join('');

  // ── fabric card builder (no _emb, 110px preview via <img>) ──
  const fabricUnlocked = [...unlocked].filter(k => k.startsWith('fabric_') && !k.endsWith('_emb'));
  const allFabricKeys  = [];
  for (const spec of FABRIC_SPECIES) {
    const pid = spec[0];
    allFabricKeys.push(`fabric_${pid}`);
    if (spec[2] >= 2) allFabricKeys.push(`fabric_${pid}_v2`);
  }

  const _buildFabricCard = (key) => {
    const m = key.match(/^fabric_(\d+)(?:_v(\d+))?$/);
    if (!m) return '';
    const pid     = parseInt(m[1], 10);
    const variant = m[2] ? parseInt(m[2], 10) : 1;
    const spec    = FABRIC_SPECIES.find(s => s[0] === pid);
    const fr      = spec ? spec[1] : `#${pid}`;
    const own     = unlocked.has(key);
    const isAct   = active === key;
    const isFav   = favoriteBgs.includes(key);
    const previewUrl = fabricBgUrl(pid, variant);
    const badge   = variant > 1 ? `v${variant}` : '';
    const suffix  = variant > 1 ? ' (alt)' : '';
    return `<div class="cosm-card cosm-fabric-card${isAct ? ' cosm-active' : ''}" data-cosm="${key}" data-fabric-key="${key}"
      style="position:relative;border:2px solid ${isAct ? 'var(--gold)' : own ? 'var(--green)' : 'var(--border)'};border-radius:var(--radius-sm);padding:6px;cursor:pointer;background:var(--bg-card);min-width:0">
      <img src="${previewUrl}" style="width:100%;height:110px;object-fit:cover;border-radius:2px;margin-bottom:4px;display:block"
        onerror="this.closest('[data-fabric-key]').style.display='none'">
      ${badge ? `<div style="position:absolute;top:4px;right:4px;font-size:9px;background:rgba(0,0,0,.7);border-radius:3px;padding:1px 4px">${badge}</div>` : ''}
      <button class="cosm-fav-btn" data-fav-key="${key}" style="position:absolute;top:4px;left:4px;background:rgba(0,0,0,.6);border:none;border-radius:3px;cursor:pointer;font-size:10px;padding:1px 3px;line-height:1">${isFav ? '⭐' : '☆'}</button>
      <div style="font-size:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${fr}${suffix}</div>
      <div style="font-size:7px;color:${isAct ? 'var(--gold)' : own ? 'var(--green)' : 'var(--text-dim)'}">
        ${isAct ? '[ ACTIF ]' : own ? 'Équiper' : FABRIC_SHOP_COST.toLocaleString() + '₽'}
      </div>
    </div>`;
  };

  // ── fabric settings panel (shown only when a fabric BG is active) ──
  const _modeBtn = (mode, label) => {
    const act = fabricMode === mode;
    return `<button class="fabric-mode-btn" data-mode="${mode}"
      style="font-family:var(--font-pixel);font-size:8px;padding:4px 10px;border-radius:var(--radius-sm);cursor:pointer;
             border:1px solid ${act ? 'var(--gold)' : 'var(--border)'};
             background:${act ? 'rgba(255,200,0,0.10)' : 'var(--bg)'};
             color:${act ? 'var(--gold)' : 'var(--text-dim)'}">${label}</button>`;
  };
  const fabricSettingsHtml = isFabricActive ? `
    <div id="fabricSettings" style="margin-top:12px;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm)">
      <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:8px;letter-spacing:.4px">⚙ PARAMÈTRES TISSU</div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        ${_modeBtn('full',   'Plein écran')}
        ${_modeBtn('repeat', 'Répétition')}
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="${fabricMode === 'repeat' ? '' : 'opacity:0.35;pointer-events:none'}">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:8px;color:var(--text-dim)">Taille motif</span>
            <span id="fabricSizeVal" style="font-size:8px;color:var(--gold)">${fabricSize}px</span>
          </div>
          <input type="range" id="fabricSizeRange" min="80" max="600" step="10" value="${fabricSize}"
            style="width:100%;accent-color:var(--gold);cursor:pointer">
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:8px;color:var(--text-dim)">Transparence UI</span>
            <span id="fabricOpacityVal" style="font-size:8px;color:var(--gold)">${fabricOpacity}%</span>
          </div>
          <input type="range" id="fabricOpacityRange" min="30" max="95" step="1" value="${fabricOpacity}"
            style="width:100%;accent-color:var(--gold);cursor:pointer">
        </div>
      </div>
    </div>` : '';

  // ── patches ──
  const _patchLabel = {
    1:'Bulbizarre', 4:'Salamèche', 7:'Carapuce', 25:'Pikachu', 39:'Rondoudou',
    50:'Taupiqueur', 54:'Psykokwak', 94:'Ectoplasma', 129:'Magicarpe', 131:'Lokhlass',
    132:'Métamorph', 133:'Évoli', 143:'Ronflex', 149:'Dracolosse', 151:'Mew',
  };
  const patchesHtml = PATCH_PIDS.map(pid => {
    const isAct = activePatches.includes(pid);
    return `<div class="cosm-patch-card" data-patch-pid="${pid}"
      style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px;border:2px solid ${isAct ? 'var(--gold)' : 'var(--border)'};border-radius:var(--radius-sm);cursor:pointer;background:${isAct ? 'rgba(255,200,0,0.08)' : 'var(--bg-card)'};width:72px;flex-shrink:0">
      <img src="${patchUrl(pid)}" style="width:48px;height:48px;object-fit:contain;image-rendering:pixelated" onerror="this.style.display='none'">
      <div style="font-size:7px;text-align:center;color:${isAct ? 'var(--gold)' : 'var(--text-dim)'}">${_patchLabel[pid] || `#${pid}`}</div>
      ${isAct ? '<div style="font-size:7px;color:var(--gold)">[ ON ]</div>' : ''}
    </div>`;
  }).join('');

  container.innerHTML = `
    <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold-dim);margin-bottom:8px;letter-spacing:.5px">🖼 FONDS D'ÉCRAN</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:20px">
      ${defaultCard}${bgHtml}
    </div>

    <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold-dim);margin-bottom:8px;letter-spacing:.5px">
      🧵 ORIGINAL STITCH
      <span style="font-size:7px;color:var(--text-dim);font-weight:normal;margin-left:6px">${fabricUnlocked.length} débloqué(s)</span>
    </div>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
      <button class="fabric-filter-btn" data-fabric-filter="owned"
        style="font-family:var(--font-pixel);font-size:8px;padding:4px 10px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg);color:var(--text-dim);cursor:pointer">Possédé</button>
      <button class="fabric-filter-btn" data-fabric-filter="all"
        style="font-family:var(--font-pixel);font-size:8px;padding:4px 10px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg);color:var(--text-dim);cursor:pointer">Tous</button>
      <button class="fabric-filter-btn" data-fabric-filter="favorites"
        style="font-family:var(--font-pixel);font-size:8px;padding:4px 10px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg);color:var(--text-dim);cursor:pointer">⭐ Favoris</button>
    </div>
    <div id="fabricSlider"
      style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;overflow-y:auto;max-height:380px;padding:4px 2px 10px;scrollbar-width:thin">
      ${fabricUnlocked.length > 0
        ? fabricUnlocked.map(_buildFabricCard).join('')
        : '<div style="font-size:9px;color:var(--text-dim);padding:12px;grid-column:1/-1">Capture des Pokémon pour débloquer des fonds tissu !</div>'}
    </div>
    ${fabricSettingsHtml}

    <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold-dim);margin-top:20px;margin-bottom:8px;letter-spacing:.5px">
      📌 PINS <span style="font-size:7px;color:var(--text-dim);font-weight:normal">${activePatches.length}/3 actifs</span>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px">${patchesHtml}</div>

    ${_buildBallSkinsHtml(state)}`;

  // ── Réinsère le slider détaché (freeze) ou câble le nouveau ──────────────────
  {
    const newSlider = container.querySelector('#fabricSlider');
    if (_detachedSlider && newSlider) {
      // Le joueur était dessus : on rebranche le slider existant (scroll préservé)
      newSlider.parentNode.replaceChild(_detachedSlider, newSlider);
      // Patch les états actifs sans reconstruire
      _patchActiveFabric(container, active);
      _wireFabricFreeze(_detachedSlider);
    } else if (newSlider) {
      _wireFabricFreeze(newSlider);
    }
  }

  // ── wallpaper handlers ──
  container.querySelectorAll('.cosm-card:not(.cosm-fabric-card)').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.cosm;
      if (key === 'none') {
        state.cosmetics.gameBg = null;
        globalThis.saveState(); globalThis.applyCosmetics();
        _patchActiveBg(container, null); return;
      }
      const c = COSMETIC_BGS[key];
      if (!c) return;
      if (unlocked.has(key)) {
        state.cosmetics.gameBg = key;
        globalThis.saveState(); globalThis.applyCosmetics();
        _patchActiveBg(container, key);
      } else {
        if (state.gang.money < c.cost) { globalThis.notify('Fonds insuffisants.', 'error'); return; }
        globalThis.showConfirm(`Acheter "${c.fr}" pour ${c.cost.toLocaleString()}₽ ?`, () => {
          state.gang.money -= c.cost;
          state.cosmetics.unlockedBgs = [...(state.cosmetics.unlockedBgs || []), key];
          state.cosmetics.gameBg = key;
          globalThis.saveState(); globalThis.applyCosmetics(); globalThis.updateTopBar();
          globalThis.notify(`🎨 "${c.fr}" débloqué !`, 'gold');
          globalThis.SFX.play('unlock');
          renderAppearancePanel(container);
        }, null, { confirmLabel: 'Acheter', cancelLabel: 'Annuler' });
      }
    });
  });

  // ── fabric card + fav handlers ──
  const _bindFabricHandlers = (root) => {
    root.querySelectorAll('.cosm-fav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key  = btn.dataset.favKey;
        const favs = state.cosmetics.favoriteBgs || [];
        const idx  = favs.indexOf(key);
        if (idx >= 0) favs.splice(idx, 1); else favs.push(key);
        state.cosmetics.favoriteBgs = favs;
        globalThis.saveState();
        btn.textContent = favs.includes(key) ? '⭐' : '☆';
      });
    });
    root.querySelectorAll('.cosm-fabric-card').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('cosm-fav-btn')) return;
        const key = el.dataset.cosm;
        if (!key) return;
        if (unlocked.has(key)) {
          state.cosmetics.gameBg = key;
          globalThis.saveState(); globalThis.applyCosmetics();
          _patchActiveFabric(container, key);
        } else {
          const m   = key.match(/^fabric_(\d+)/);
          const pid = m ? parseInt(m[1], 10) : 0;
          const spec = pid ? FABRIC_SPECIES.find(s => s[0] === pid) : null;
          const fr   = spec ? spec[1] : `#${pid}`;
          if (state.gang.money < FABRIC_SHOP_COST) { globalThis.notify('Fonds insuffisants (100 000₽).', 'error'); return; }
          globalThis.showConfirm(`Acheter le fond tissu "${fr}" pour ${FABRIC_SHOP_COST.toLocaleString()}₽ ?`, () => {
            state.gang.money -= FABRIC_SHOP_COST;
            state.cosmetics.unlockedBgs = [...(state.cosmetics.unlockedBgs || []), key];
            state.cosmetics.gameBg = key;
            globalThis.saveState(); globalThis.applyCosmetics(); globalThis.updateTopBar();
            globalThis.notify(`🧵 Fond tissu "${fr}" débloqué !`, 'gold');
            globalThis.SFX.play('unlock');
            renderAppearancePanel(container);
          }, null, { confirmLabel: 'Acheter', cancelLabel: 'Annuler' });
        }
      });
    });
  };
  // N'attache les handlers que sur le nouveau slider (pas sur le slider réinséré frozen)
  const fabricSlider = container.querySelector('#fabricSlider');
  if (fabricSlider && fabricSlider !== _detachedSlider) _bindFabricHandlers(fabricSlider);

  // ── filter buttons ──
  container.querySelectorAll('.fabric-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.fabricFilter;
      const slider = container.querySelector('#fabricSlider');
      if (!slider) return;
      let keys = filter === 'owned'     ? fabricUnlocked
               : filter === 'all'       ? allFabricKeys
               : favoriteBgs.filter(k => k.startsWith('fabric_') && !k.endsWith('_emb'));
      const favSet = new Set(favoriteBgs);
      keys = [...keys].sort((a, b) => (favSet.has(b) ? 1 : 0) - (favSet.has(a) ? 1 : 0));
      slider.innerHTML = keys.length > 0
        ? keys.map(_buildFabricCard).join('')
        : '<div style="font-size:9px;color:var(--text-dim);padding:12px">Aucun fond dans cette catégorie.</div>';
      _bindFabricHandlers(slider);
      // Re-freeze dès que le contenu change (le mouseenter peut avoir disparu pendant le rebuild)
      _wireFabricFreeze(slider);
    });
  });

  // ── fabric settings handlers ──
  const fabricSettings = container.querySelector('#fabricSettings');
  if (fabricSettings) {
    fabricSettings.querySelectorAll('.fabric-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.cosmetics.fabricMode = btn.dataset.mode;
        globalThis.saveState(); globalThis.applyCosmetics();
        _patchFabricSettings(container, state.cosmetics);
      });
    });
    const sizeRange    = fabricSettings.querySelector('#fabricSizeRange');
    const sizeVal      = fabricSettings.querySelector('#fabricSizeVal');
    const opacityRange = fabricSettings.querySelector('#fabricOpacityRange');
    const opacityVal   = fabricSettings.querySelector('#fabricOpacityVal');
    if (sizeRange && sizeVal) {
      sizeRange.addEventListener('input', () => {
        sizeVal.textContent = sizeRange.value + 'px';
        state.cosmetics.fabricSize = parseInt(sizeRange.value, 10);
        globalThis.applyCosmetics();
      });
      sizeRange.addEventListener('change', () => globalThis.saveState());
    }
    if (opacityRange && opacityVal) {
      opacityRange.addEventListener('input', () => {
        opacityVal.textContent = opacityRange.value + '%';
        state.cosmetics.fabricOpacity = parseInt(opacityRange.value, 10);
        globalThis.applyCosmetics();
      });
      opacityRange.addEventListener('change', () => globalThis.saveState());
    }
  }

  // ── patch handlers ──
  container.querySelectorAll('.cosm-patch-card').forEach(el => {
    el.addEventListener('click', () => {
      const pid     = parseInt(el.dataset.patchPid, 10);
      const patches = [...(state.cosmetics.activePatches || [])];
      const idx     = patches.indexOf(pid);
      if (idx >= 0) {
        patches.splice(idx, 1);
        globalThis.notify('📌 Pin retiré', 'success');
      } else {
        if (patches.length >= 3) { globalThis.notify('Maximum 3 pins actifs.', 'error'); return; }
        patches.push(pid);
        globalThis.notify(`📌 Pin "${_patchLabel[pid] || pid}" activé !`, 'gold');
      }
      state.cosmetics.activePatches = patches;
      globalThis.saveState();
      _patchPinCards(container, patches);
    });
  });

  // ── ball skin handlers ──
  container.querySelectorAll('[data-gang-set-ball]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeBall = btn.dataset.gangSetBall;
      globalThis.saveState();
      renderAppearancePanel(container);
    });
  });
  container.querySelectorAll('[data-gang-buy-skin]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = (globalThis.SHOP_ITEMS || [])[parseInt(btn.dataset.gangBuySkin)];
      if (!item || btn.disabled) return;
      globalThis.buyItem?.(item);
      globalThis.updateTopBar?.();
      renderAppearancePanel(container);
    });
  });
}

// ── Services HTML builder ─────────────────────────────────────────────────────
function _buildServicesHtml(state) {
  const parts = [];

  // Auto collect
  const ownAC = !!state.purchases.autoCollect;
  const enAC  = state.purchases.autoCollectEnabled !== false;
  parts.push(`<div style="background:var(--bg);border:1px solid ${ownAC ? (enAC ? 'var(--green)' : 'var(--border)') : 'var(--border)'};border-radius:var(--radius-sm);padding:10px;display:flex;gap:10px;align-items:flex-start">
    <div style="font-size:22px;flex-shrink:0;${ownAC && !enAC ? 'opacity:.4;filter:grayscale(1)' : ''}">🪙</div>
    <div style="flex:1">
      <div style="font-family:var(--font-pixel);font-size:8px;color:${ownAC ? (enAC ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:3px">Récolte automatique</div>
      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">Collecte les revenus de zone sans animation. Combat calculé en arrière-plan.</div>
      ${ownAC
        ? `<div style="display:flex;align-items:center;gap:8px">
             <span style="font-family:var(--font-pixel);font-size:7px;color:${enAC ? 'var(--green)' : 'var(--text-dim)'}">${enAC ? '✓ ACTIVE' : '✗ INACTIVE'}</span>
             <button id="btnToggleAutoCollect" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid ${enAC ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${enAC ? 'var(--red)' : 'var(--green)'};cursor:pointer">${enAC ? 'Désactiver' : 'Activer'}</button>
           </div>`
        : `<button id="btnBuyAutoCollect" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Acheter — 100 000₽</button>`}
    </div>
  </div>`);

  // Auto sell agent
  const ownAS = !!state.purchases.autoSellAgent;
  const enAS  = state.purchases.autoSellAgentEnabled !== false;
  parts.push(`<div style="background:var(--bg);border:1px solid ${ownAS ? (enAS ? 'var(--green)' : 'var(--border)') : 'var(--border)'};border-radius:var(--radius-sm);padding:10px;display:flex;gap:10px;align-items:flex-start">
    <div style="font-size:22px;flex-shrink:0;${ownAS && !enAS ? 'opacity:.4;filter:grayscale(1)' : ''}">🤖</div>
    <div style="flex:1">
      <div style="font-family:var(--font-pixel);font-size:8px;color:${ownAS ? (enAS ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:3px">Vente automatique (captures agent)</div>
      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">Vend automatiquement les Pokémon capturés par les agents. Shinies toujours protégés.</div>
      ${ownAS
        ? `<div style="display:flex;flex-direction:column;gap:6px">
             <div style="display:flex;align-items:center;gap:8px">
               <span style="font-family:var(--font-pixel);font-size:7px;color:${enAS ? 'var(--green)' : 'var(--text-dim)'}">${enAS ? '✓ ACTIVE' : '✗ INACTIVE'}</span>
               <button id="btnToggleAutoSellAgent" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid ${enAS ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${enAS ? 'var(--red)' : 'var(--green)'};cursor:pointer">${enAS ? 'Désactiver' : 'Activer'}</button>
             </div>
             <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
               <label style="display:flex;align-items:center;gap:4px;font-size:8px;cursor:pointer"><input type="radio" name="autoSellMode" value="all" ${(state.settings.autoSellAgent?.mode || 'all') === 'all' ? 'checked' : ''}> Tout vendre</label>
               <label style="display:flex;align-items:center;gap:4px;font-size:8px;cursor:pointer"><input type="radio" name="autoSellMode" value="by_potential" ${state.settings.autoSellAgent?.mode === 'by_potential' ? 'checked' : ''}> Par potentiel</label>
             </div>
             ${state.settings.autoSellAgent?.mode === 'by_potential' ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${[1,2,3,4,5].map(p => `<label style="display:flex;align-items:center;gap:3px;font-size:8px;cursor:pointer"><input type="checkbox" class="autoSellPot" value="${p}" ${(state.settings.autoSellAgent?.potentials || []).includes(p) ? 'checked' : ''}> ${'★'.repeat(p)}</label>`).join('')}</div>` : ''}
           </div>`
        : `<button id="btnBuyAutoSellAgent" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Acheter — 10 000 000₽</button>`}
    </div>
  </div>`);

  // Nurse
  const ownN = !!state.purchases.autoIncubator;
  const enN  = state.purchases.autoIncubatorEnabled !== false;
  parts.push(`<div style="background:var(--bg);border:1px solid ${ownN ? (enN ? 'var(--green)' : 'var(--border)') : 'var(--border)'};border-radius:var(--radius-sm);padding:10px;display:flex;gap:10px;align-items:flex-start">
    <img src="${globalThis.trainerSprite('nurse')}" style="width:36px;height:36px;image-rendering:pixelated;flex-shrink:0;${ownN && !enN ? 'opacity:.4;filter:grayscale(1)' : ''}" onerror="this.style.display='none'">
    <div style="flex:1">
      <div style="font-family:var(--font-pixel);font-size:8px;color:${ownN ? (enN ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:3px">Infirmière Joëlle corrompue</div>
      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">Auto-incube les œufs dès qu'un incubateur est libre.</div>
      ${ownN
        ? `<div style="display:flex;align-items:center;gap:8px">
             <span style="font-family:var(--font-pixel);font-size:7px;color:${enN ? 'var(--green)' : 'var(--text-dim)'}">${enN ? '✓ EN POSTE' : '✗ CONGÉ'}</span>
             <button id="btnToggleNurse" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid ${enN ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${enN ? 'var(--red)' : 'var(--green)'};cursor:pointer">${enN ? 'Mettre en congé' : 'Rappeler'}</button>
           </div>`
        : `<button id="btnBuyNurse" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Embaucher — 300 000₽</button>`}
    </div>
  </div>`);

  // Scientist
  const ownSc = !!state.purchases.scientist;
  const enSc  = state.purchases.scientistEnabled !== false;
  parts.push(`<div style="background:var(--bg);border:1px solid ${ownSc ? (enSc ? 'var(--green)' : 'var(--border)') : 'var(--border)'};border-radius:var(--radius-sm);padding:10px;display:flex;gap:10px;align-items:flex-start">
    <img src="${globalThis.trainerSprite('scientist')}" style="width:36px;height:36px;image-rendering:pixelated;flex-shrink:0;${ownSc && !enSc ? 'opacity:.4;filter:grayscale(1)' : ''}" onerror="this.style.display='none'">
    <div style="flex:1">
      <div style="font-family:var(--font-pixel);font-size:8px;color:${ownSc ? (enSc ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:3px">Scientifique peu scrupuleux</div>
      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">Révèle l'espèce des œufs (10k₽) · Mutation artificielle : sacrifice ★★★★★ même espèce pour potentiel max.</div>
      ${ownSc
        ? `<div style="display:flex;align-items:center;gap:8px">
             <span style="font-family:var(--font-pixel);font-size:7px;color:${enSc ? 'var(--green)' : 'var(--text-dim)'}">${enSc ? '✓ EN POSTE' : '✗ RENVOYÉ'}</span>
             <button id="btnToggleScientist" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid ${enSc ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${enSc ? 'var(--red)' : 'var(--green)'};cursor:pointer">${enSc ? 'Renvoyer' : 'Rappeler'}</button>
           </div>`
        : `<button id="btnBuyScientist" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Engager — 5 000 000₽</button>`}
    </div>
  </div>`);

  // Special purchases
  const SPECIALS = [
    { id:'title_richissime',     icon:'💰', label:'Titre "Richissime"',        desc:'Débloque le titre légendaire. Ostentation maximale.',  cost:5_000_000,
      owned: () => !!state.purchases.title_richissime || (state.unlockedTitles||[]).includes('richissime') },
    { id:'title_doublerichissim', icon:'💎', label:'Titre "Double Richissime"', desc:'Débloque le titre ultime. Noblesse oblige.',           cost:10_000_000,
      owned: () => !!state.purchases.title_doublerichissim || (state.unlockedTitles||[]).includes('doublerichissim') },
    { id:'chromaCharm',           icon:'✨', label:'Charme Chroma',             desc:'Double le taux de Pokémon chromatiques. Permanent.',   cost:5_000_000,
      owned: () => !!state.purchases.chromaCharm },
  ];
  parts.push(`<div>
    <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold-dim);margin:4px 0 6px;letter-spacing:1px">🛒 ACHATS SPÉCIAUX</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${SPECIALS.map(sp => {
        const own = sp.owned();
        return `<div style="background:var(--bg);border:1px solid ${own ? 'var(--green)' : 'var(--border)'};border-radius:var(--radius-sm);padding:8px;display:flex;gap:10px;align-items:center">
          <div style="font-size:20px;flex-shrink:0">${sp.icon}</div>
          <div style="flex:1">
            <div style="font-family:var(--font-pixel);font-size:8px;color:${own ? 'var(--green)' : 'var(--text)'};margin-bottom:2px">${sp.label}</div>
            <div style="font-size:7px;color:var(--text-dim)">${sp.desc}</div>
          </div>
          ${own
            ? `<div style="font-family:var(--font-pixel);font-size:7px;color:var(--green);white-space:nowrap">✓ ACTIF</div>`
            : `<button class="btn-special-buy" data-sp-id="${sp.id}" style="font-family:var(--font-pixel);font-size:7px;padding:4px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer;white-space:nowrap">${sp.cost.toLocaleString()}₽</button>`}
        </div>`;
      }).join('')}
    </div>
  </div>`);

  return parts.join('');
}

// ── Targeted DOM patch helpers (avoid full re-render on every click) ──────────

function _patchActiveBg(container, newKey) {
  container.querySelectorAll('.cosm-card:not(.cosm-fabric-card)').forEach(el => {
    const k = el.dataset.cosm;
    const isAct = (newKey === null && k === 'none') || k === newKey;
    el.classList.toggle('cosm-active', isAct);
    el.style.borderColor = isAct ? 'var(--gold)' : (el.dataset.owned === '1' ? 'var(--green)' : 'var(--border)');
    const sub = el.querySelector('[data-cosm-sub]');
    if (sub) sub.style.color = isAct ? 'var(--gold)' : (el.dataset.owned === '1' ? 'var(--green)' : 'var(--text-dim)');
  });
}

function _patchActiveFabric(container, newKey) {
  container.querySelectorAll('.cosm-fabric-card').forEach(el => {
    const k = el.dataset.cosm;
    const isAct = k === newKey;
    el.classList.toggle('cosm-active', isAct);
    el.style.borderColor = isAct ? 'var(--gold)' : (el.dataset.owned === '1' ? 'var(--green)' : 'var(--border)');
  });
}

function _patchFabricSettings(container, cosmetics) {
  const settings = container.querySelector('#fabricSettings');
  if (!settings) return;
  const mode = cosmetics.fabricMode || 'repeat';
  settings.querySelectorAll('.fabric-mode-btn').forEach(btn => {
    const act = btn.dataset.mode === mode;
    btn.style.borderColor = act ? 'var(--gold)' : 'var(--border)';
    btn.style.background  = act ? 'rgba(255,200,0,0.10)' : 'var(--bg)';
    btn.style.color       = act ? 'var(--gold)' : 'var(--text-dim)';
  });
  const sizeRange = settings.querySelector('#fabricSizeRange');
  if (sizeRange) {
    const sizeWrap = sizeRange.closest('div');
    if (sizeWrap) sizeWrap.style.opacity = mode === 'repeat' ? '1' : '0.35';
    sizeRange.style.pointerEvents = mode === 'repeat' ? '' : 'none';
  }
}

function _patchPinCards(container, activePatches) {
  container.querySelectorAll('.cosm-patch-card').forEach(el => {
    const pid = parseInt(el.dataset.patchPid, 10);
    const isAct = activePatches.includes(pid);
    el.style.borderColor = isAct ? 'var(--gold)' : 'var(--border)';
    el.style.background  = isAct ? 'rgba(255,200,0,0.08)' : 'var(--bg-card)';
    const labels = el.querySelectorAll('div');
    if (labels.length) labels[labels.length - 1].style.color = isAct ? 'var(--gold)' : 'var(--text-dim)';
    let onTag = el.querySelector('.cosm-on-tag');
    if (isAct && !onTag) {
      onTag = document.createElement('div');
      onTag.className = 'cosm-on-tag';
      onTag.style.cssText = 'font-size:7px;color:var(--gold)';
      onTag.textContent = '[ ON ]';
      el.appendChild(onTag);
    } else if (!isAct && onTag) {
      onTag.remove();
    }
  });
}

// ── Main Gang tab ─────────────────────────────────────────────────────────────
function renderGangTab() {
  if (_gangTabLocked) { _gangTabPendingRender = true; return; }
  if (_gangTabTimer) { clearTimeout(_gangTabTimer); _gangTabTimer = null; }
  _gangTabTimer = setTimeout(() => {
    _gangTabTimer = null;
    // Ne pas reconstruire le DOM si l'utilisateur a le focus sur un input/range/select
    // (évite de reset les sliders, radios, dropdowns en cours d'interaction)
    const focused = document.activeElement;
    const tab = document.getElementById('tabGang');
    if (focused && tab?.contains(focused) && ['INPUT', 'SELECT', 'TEXTAREA'].includes(focused.tagName)) {
      _gangTabPendingRender = true;
      _ensureGangFocusOutHandler(tab);
      return;
    }
    _doRenderGangTab();
  }, 80);
}

function _doRenderGangTab() {
  const tab = document.getElementById('tabGang');
  if (!tab) return;

  // Sauvegarder les positions de scroll avant reconstruction
  const _savedTabScroll  = tab.scrollTop;
  const _savedCosmScroll = tab.querySelector('#gangAppearanceContainer')?.scrollTop ?? 0;

  const state      = globalThis.state;
  const g          = state.gang;
  const s          = state.stats;
  const activeSlot = g.activeBossTeamSlot || 0;
  const teamPks    = (g.bossTeam || []).map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);

  // Vitrine
  const showcaseArr = [...(g.showcase || [])];
  while (showcaseArr.length < SHOWCASE_SLOTS) showcaseArr.push(null);
  const showcaseHtml = showcaseArr.slice(0, SHOWCASE_SLOTS).map((pkId, i) => {
    const pk = pkId ? state.pokemons.find(p => p.id === pkId) : null;
    if (pk) {
      const evos    = globalThis.EVO_BY_SPECIES?.[pk.species_en];
      const evoHint = evos?.length > 0 ? `<button class="gang-evo-hint" data-pk-id="${pk.id}" title="Voir évolution">❓</button>` : '';
      return `<div class="gang-showcase-slot filled" data-showcase-idx="${i}">
        <img src="${globalThis.pokeSprite(pk.species_en, pk.shiny)}" style="width:48px;height:48px;image-rendering:pixelated;${pk.shiny ? 'filter:drop-shadow(0 0 4px var(--gold))' : ''}">
        <div style="font-size:7px;margin-top:2px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${globalThis.pokemonDisplayName(pk)}${pk.shiny ? ' ✨' : ''}</div>
        <div style="font-size:7px;color:var(--text-dim)">Lv.${pk.level} ${'★'.repeat(pk.potential)}</div>
        <div style="display:flex;gap:3px;margin-top:3px;align-items:center;justify-content:center">
          ${evoHint}
          <button class="gang-showcase-remove" data-idx="${i}" style="font-size:7px;padding:1px 4px;background:var(--bg);border:1px solid var(--red);border-radius:2px;color:var(--red);cursor:pointer">✕</button>
        </div>
      </div>`;
    }
    return `<div class="gang-showcase-slot empty" data-showcase-idx="${i}">
      <div style="font-size:16px;opacity:.3">🏆</div>
      <div style="font-size:7px;color:var(--text-dim);margin-top:3px">Slot ${i+1}</div>
      <button class="gang-showcase-add" data-idx="${i}" style="margin-top:5px;font-size:7px;padding:2px 5px;background:var(--bg);border:1px solid var(--border-light);border-radius:2px;color:var(--text-dim);cursor:pointer">+</button>
    </div>`;
  }).join('');

  // Boss team tabs
  const SLOT_COSTS = [0, 500_000, 1_000_000];
  const purchased  = g.bossTeamSlotsPurchased || [true, false, false];
  const teamTabsHtml = [0, 1, 2].map(i => {
    const isAct  = i === activeSlot;
    const isPur  = purchased[i];
    const label  = i === 0 ? 'Slot 1' : isPur ? `Slot ${i+1}` : `Slot ${i+1} — ${SLOT_COSTS[i].toLocaleString()}₽`;
    return `<button class="gang-team-slot-tab${isAct ? ' active' : ''}${!isPur ? ' locked' : ''}" data-team-slot="${i}"
      style="font-family:var(--font-pixel);font-size:7px;padding:4px 8px;border-radius:var(--radius-sm) var(--radius-sm) 0 0;border:1px solid ${isAct ? 'var(--gold-dim)' : 'var(--border)'};border-bottom:${isAct ? '1px solid var(--bg-panel)' : '1px solid var(--border)'};background:${isAct ? 'var(--bg-panel)' : 'var(--bg)'};color:${isAct ? 'var(--gold)' : 'var(--text-dim)'};cursor:pointer;opacity:${isPur || isAct ? '1' : '.7'}">
      ${!isPur ? '🔒 ' : ''}${label}
    </button>`;
  }).join('');

  const teamHtml = Array.from({length: BOSS_TEAM_SLOTS}, (_, i) => {
    const pk = teamPks[i];
    if (pk) return `<div class="gang-team-slot filled" data-boss-slot="${i}" title="${globalThis.pokemonDisplayName(pk)} Lv.${pk.level}">
      <img src="${globalThis.pokeIcon(pk.species_en)}" style="width:40px;height:30px;image-rendering:pixelated;${pk.shiny ? 'filter:drop-shadow(0 0 3px var(--gold))' : ''}" onerror="this.src='${globalThis.pokeSprite(pk.species_en, pk.shiny)}';this.style.width='40px';this.style.height='40px'">
      <div style="font-size:7px;margin-top:2px;color:${pk.shiny ? 'var(--gold)' : 'var(--text)'}">${globalThis.pokemonDisplayName(pk)}</div>
      <div style="font-size:7px;color:var(--text-dim)">Lv.${pk.level}</div>
    </div>`;
    return `<div class="gang-team-slot empty" data-boss-slot="${i}"><span style="font-size:7px;color:var(--text-dim)">Slot ${i+1}</span></div>`;
  }).join('');

  // Stats
  const _sb        = globalThis._gangSessionStatsBase || {};
  const _isSession = _statsViewMode === 'session';
  const _sv        = k => _isSession ? Math.max(0, (s[k] || 0) - (_sb[k] || 0)) : (s[k] || 0);
  const statsHtml  = [
    [state.pokemons.length,                                                      'Possédés'],
    [_sv('totalCaught'),                                                         'Capturés'],
    [_sv('totalSold'),                                                           'Vendus'],
    [_isSession ? _sv('shinyCaught') : globalThis.getShinySpeciesCount?.(),      _isSession ? '✨ Chromas' : '✨ Espèces chroma'],
    [_isSession ? '' : s.shinyCaught,                                            _isSession ? '' : '✨ Chromas (total)'],
    [`${_sv('totalFightsWon')}/${_sv('totalFights')}`,                           'Combats'],
    [`${_sv('totalMoneyEarned').toLocaleString()}₽`,                             'Gains'],
  ].filter(([val]) => val !== '').map(([val, label]) =>
    `<div class="gang-stat-card"><div class="stat-value">${val}</div><div class="stat-label">${label}</div></div>`
  ).join('');

  const repPct = Math.min(100, g.reputation);

  tab.innerHTML = `
  <div class="gang-card-layout">
    <div class="gang-card-header" style="flex-direction:column;gap:0;padding:0">
      <div style="display:flex;align-items:flex-start;gap:14px;padding:14px">
        <div class="gang-boss-sprite">
          ${g.bossSprite ? `<img src="${globalThis.trainerSprite(g.bossSprite)}" style="width:72px;height:72px;image-rendering:pixelated">` : '<div style="width:72px;height:72px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm)"></div>'}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--font-pixel);font-size:15px;color:var(--red);line-height:1.3">${g.name}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:2px">Boss : <span style="color:var(--text)">${g.bossName}</span></div>
          <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold-dim);margin-top:2px;letter-spacing:.5px">${globalThis.getBossFullTitle?.() || ''}</div>
          ${(() => {
            const tC = globalThis.getTitleLabel?.(g.titleC);
            const tD = globalThis.getTitleLabel?.(g.titleD);
            const badges = [tC, tD].filter(Boolean);
            if (!badges.length) return '';
            const colors = ['#4fc3f7','#ce93d8'];
            return `<div style="display:flex;gap:5px;margin-top:3px;flex-wrap:wrap">${badges.map((b,bi) => `<span style="font-family:var(--font-pixel);font-size:6px;padding:2px 6px;border-radius:10px;border:1px solid ${colors[bi]};color:${colors[bi]}">${b}</span>`).join('')}</div>`;
          })()}
          <button id="btnOpenTitles" style="margin-top:4px;font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">🏆 Titres</button>
          <div style="display:flex;gap:14px;margin-top:6px;flex-wrap:wrap">
            <span style="font-size:10px;color:var(--gold)">⭐ ${g.reputation.toLocaleString()}</span>
            <span style="font-size:10px;color:var(--text)">₽ ${g.money.toLocaleString()}</span>
            <span style="font-size:10px;color:var(--text-dim)" title="Pokédex Kanto / National">📖 ${globalThis.getDexKantoCaught?.() ?? 0}/${globalThis.KANTO_DEX_SIZE ?? 151} <span style="font-size:8px;opacity:.6">[${globalThis.getDexNationalCaught?.() ?? 0}/${globalThis.NATIONAL_DEX_SIZE ?? 151}]</span></span>
          </div>
          <div style="margin-top:8px;background:var(--border);border-radius:2px;height:4px;max-width:200px">
            <div style="background:var(--gold-dim);height:4px;border-radius:2px;width:${repPct}%;transition:width .5s"></div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex-shrink:0">
          <button id="btnExportGang" style="font-family:var(--font-pixel);font-size:7px;padding:5px 8px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">📋 Exporter</button>
          <button id="btnEditBoss"   style="font-family:var(--font-pixel);font-size:7px;padding:5px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">✏ Modifier</button>
        </div>
      </div>
      <div style="border-top:1px solid var(--border);padding:10px 14px">
        <div style="font-family:var(--font-pixel);font-size:7px;color:var(--gold-dim);letter-spacing:1px;margin-bottom:7px">— VITRINE —</div>
        <div class="gang-showcase-row">${showcaseHtml}</div>
      </div>
      <div style="border-top:1px solid var(--border);padding:10px 14px 14px">
        <div style="font-family:var(--font-pixel);font-size:7px;color:var(--gold-dim);letter-spacing:1px;margin-bottom:6px">— ÉQUIPE BOSS —</div>
        <div style="display:flex;gap:0;margin-bottom:-1px">${teamTabsHtml}</div>
        <div style="border:1px solid var(--border);border-radius:0 var(--radius-sm) var(--radius-sm) var(--radius-sm);padding:8px;background:var(--bg-panel)">
          <div class="gang-team-row" style="margin-bottom:0">${teamHtml}</div>
        </div>
      </div>
    </div>

    <div class="gang-section-label gang-collapsible-header" data-section="services" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none">
      <span>— SERVICES —</span><span style="font-size:9px;color:var(--text-dim)">${_gangCollapsed.services ? '▶' : '▼'}</span>
    </div>
    <div class="gang-collapsible-body" data-section-body="services" style="${_gangCollapsed.services ? 'display:none' : ''}">
      <div style="padding:0 2px 8px;display:flex;flex-direction:column;gap:8px">${_buildServicesHtml(state)}</div>
    </div>

    <div class="gang-section-label gang-collapsible-header" data-section="music" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none">
      <span>— MUSIQUE —</span><span style="font-size:9px;color:var(--text-dim)">${_gangCollapsed.music ? '▶' : '▼'}</span>
    </div>
    <div class="gang-collapsible-body" data-section-body="music" style="${_gangCollapsed.music ? 'display:none' : ''}">
      <div id="gangMusicContainer" style="padding:0 2px 8px"></div>
    </div>

    <div class="gang-section-label gang-collapsible-header" data-section="appearance" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none">
      <span>— APPARENCE —</span><span style="font-size:9px;color:var(--text-dim)">${_gangCollapsed.appearance ? '▶' : '▼'}</span>
    </div>
    <div class="gang-collapsible-body" data-section-body="appearance" style="${_gangCollapsed.appearance ? 'display:none' : ''}">
      <div id="gangAppearanceContainer" style="padding:0 2px 8px"></div>
    </div>

    <div class="gang-section-label gang-collapsible-header" data-section="stats" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none">
      <span>— STATISTIQUES —</span>
      <div style="display:flex;align-items:center;gap:8px">
        <button id="btnToggleStatsView" onclick="event.stopPropagation()" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:${_isSession ? 'var(--gold)' : 'var(--text-dim)'};cursor:pointer">${_isSession ? '⏱ SESSION' : '🌐 GLOBAL'}</button>
        <span style="font-size:9px;color:var(--text-dim)">${_gangCollapsed.stats ? '▶' : '▼'}</span>
      </div>
    </div>
    <div class="gang-collapsible-body" data-section-body="stats" style="${_gangCollapsed.stats ? 'display:none' : ''}">
      <div class="gang-stats-row">${statsHtml}</div>
    </div>

    <div style="margin-top:16px;text-align:center;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);letter-spacing:1px;opacity:.5">${globalThis.GAME_VERSION || ''}</div>
  </div>`;

  // Restaurer le scroll du tab immédiatement après reconstruction
  tab.scrollTop = _savedTabScroll;

  // Collapsible toggles
  tab.querySelectorAll('.gang-collapsible-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.dataset.section;
      _gangCollapsed[section] = !_gangCollapsed[section];
      const body  = tab.querySelector(`[data-section-body="${section}"]`);
      const arrow = header.querySelector('span:last-child');
      if (body)  body.style.display  = _gangCollapsed[section] ? 'none' : '';
      if (arrow) arrow.textContent   = _gangCollapsed[section] ? '▶' : '▼';
    });
  });

  // Stats toggle
  tab.querySelector('#btnToggleStatsView')?.addEventListener('click', e => {
    e.stopPropagation();
    _statsViewMode = _statsViewMode === 'session' ? 'global' : 'session';
    renderGangTab();
  });

  // Auto-sell mode radios
  tab.querySelectorAll('input[name="autoSellMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (!globalThis.state.settings.autoSellAgent) globalThis.state.settings.autoSellAgent = { mode: 'all', potentials: [] };
      globalThis.state.settings.autoSellAgent.mode = radio.value;
      globalThis.saveState(); renderGangTab();
    });
  });
  tab.querySelectorAll('.autoSellPot').forEach(cb => {
    cb.addEventListener('change', () => {
      if (!globalThis.state.settings.autoSellAgent) globalThis.state.settings.autoSellAgent = { mode: 'by_potential', potentials: [] };
      const pot  = parseInt(cb.value);
      const pots = globalThis.state.settings.autoSellAgent.potentials || [];
      globalThis.state.settings.autoSellAgent.potentials = cb.checked
        ? [...new Set([...pots, pot])] : pots.filter(p => p !== pot);
      globalThis.saveState();
    });
  });

  // Services handlers
  tab.querySelector('#btnBuyScientist')?.addEventListener('click', () => {
    const st = globalThis.state;
    if (st.gang.money < 5_000_000) { globalThis.notify('Fonds insuffisants.', 'error'); return; }
    globalThis.showConfirm('Engager le <b>Scientifique peu scrupuleux</b> pour <b>5 000 000₽</b> ?', () => {
      st.gang.money -= 5_000_000; st.purchases.scientist = true; st.purchases.scientistEnabled = true;
      globalThis.saveState(); globalThis.updateTopBar(); globalThis.SFX.play('unlock');
      globalThis.notify('🧬 Le scientifique est en poste !', 'gold'); renderGangTab();
    }, null, { confirmLabel: 'Engager', cancelLabel: 'Annuler' });
  });
  tab.querySelector('#btnToggleScientist')?.addEventListener('click', () => {
    const st = globalThis.state;
    st.purchases.scientistEnabled = st.purchases.scientistEnabled === false;
    globalThis.saveState();
    globalThis.notify(st.purchases.scientistEnabled !== false ? '🧬 Scientifique rappelé !' : '🚫 Scientifique renvoyé.', 'success');
    renderGangTab();
  });

  tab.querySelector('#btnBuyAutoCollect')?.addEventListener('click', () => {
    const st = globalThis.state;
    if (st.gang.money < 100_000) { globalThis.notify('Fonds insuffisants.', 'error'); return; }
    globalThis.showConfirm('Acheter la <b>Récolte automatique</b> pour <b>100 000₽</b> ?', () => {
      st.gang.money -= 100_000; st.purchases.autoCollect = true; st.purchases.autoCollectEnabled = true;
      globalThis.saveState(); globalThis.updateTopBar(); globalThis.SFX.play('unlock');
      globalThis.notify('🪙 Récolte automatique activée !', 'gold'); renderGangTab();
    }, null, { confirmLabel: 'Acheter', cancelLabel: 'Annuler' });
  });
  tab.querySelector('#btnToggleAutoCollect')?.addEventListener('click', () => {
    const st = globalThis.state;
    st.purchases.autoCollectEnabled = st.purchases.autoCollectEnabled === false;
    globalThis.saveState();
    globalThis.notify(st.purchases.autoCollectEnabled !== false ? '🪙 Récolte automatique activée !' : '🚫 Récolte automatique désactivée.', '');
    renderGangTab();
  });

  tab.querySelector('#btnBuyAutoSellAgent')?.addEventListener('click', () => {
    const st = globalThis.state;
    if (st.gang.money < 10_000_000) { globalThis.notify('Fonds insuffisants.', 'error'); return; }
    globalThis.showConfirm('Acheter la <b>Vente automatique</b> pour <b>10 000 000₽</b> ?', () => {
      st.gang.money -= 10_000_000; st.purchases.autoSellAgent = true; st.purchases.autoSellAgentEnabled = true;
      if (!st.settings.autoSellAgent) st.settings.autoSellAgent = { mode: 'all', potentials: [] };
      globalThis.saveState(); globalThis.updateTopBar(); globalThis.SFX.play('unlock');
      globalThis.notify('🤖 Vente automatique activée !', 'gold'); renderGangTab();
    }, null, { confirmLabel: 'Acheter', cancelLabel: 'Annuler' });
  });
  tab.querySelector('#btnToggleAutoSellAgent')?.addEventListener('click', () => {
    const st = globalThis.state;
    st.purchases.autoSellAgentEnabled = st.purchases.autoSellAgentEnabled === false;
    globalThis.saveState();
    globalThis.notify(st.purchases.autoSellAgentEnabled !== false ? '🤖 Vente automatique activée !' : '🚫 Vente automatique désactivée.', '');
    renderGangTab();
  });

  tab.querySelector('#btnBuyNurse')?.addEventListener('click', () => {
    const st = globalThis.state;
    if (st.gang.money < 300_000) { globalThis.notify('Fonds insuffisants.', 'error'); return; }
    globalThis.showConfirm("Embaucher l'<b>Infirmière Joëlle</b> pour <b>300 000₽</b> ?", () => {
      st.gang.money -= 300_000; st.purchases.autoIncubator = true; st.purchases.autoIncubatorEnabled = true;
      globalThis.saveState(); globalThis.updateTopBar(); globalThis.SFX.play('unlock');
      globalThis.notify('💉 Joëlle est en poste !', 'gold'); renderGangTab();
    }, null, { confirmLabel: 'Embaucher', cancelLabel: 'Annuler' });
  });
  tab.querySelector('#btnToggleNurse')?.addEventListener('click', () => {
    const st = globalThis.state;
    st.purchases.autoIncubatorEnabled = st.purchases.autoIncubatorEnabled === false;
    globalThis.saveState();
    globalThis.notify(st.purchases.autoIncubatorEnabled !== false ? '💉 Joëlle est de retour !' : '💤 Joëlle en congé.', '');
    renderGangTab();
  });

  const SPECIAL_DEFS = {
    title_richissime:      { cost: 5_000_000,  label: 'Titre "Richissime"' },
    title_doublerichissim: { cost: 10_000_000, label: 'Titre "Double Richissime"' },
    chromaCharm:           { cost: 5_000_000,  label: 'Charme Chroma' },
  };
  tab.querySelectorAll('.btn-special-buy').forEach(btn => {
    btn.addEventListener('click', () => {
      const spId = btn.dataset.spId;
      const def  = SPECIAL_DEFS[spId];
      if (!def) return;
      const st = globalThis.state;
      if (st.gang.money < def.cost) { globalThis.notify('Fonds insuffisants.', 'error'); return; }
      globalThis.showConfirm(`Acheter <b>${def.label}</b> pour <b>${def.cost.toLocaleString()}₽</b> ?`, () => {
        st.gang.money -= def.cost;
        st.purchases[spId] = true;
        if (spId === 'title_richissime') {
          if (!st.unlockedTitles) st.unlockedTitles = [];
          if (!st.unlockedTitles.includes('richissime')) st.unlockedTitles.push('richissime');
        } else if (spId === 'title_doublerichissim') {
          if (!st.unlockedTitles) st.unlockedTitles = [];
          if (!st.unlockedTitles.includes('doublerichissim')) st.unlockedTitles.push('doublerichissim');
        }
        globalThis.saveState(); globalThis.updateTopBar(); globalThis.SFX.play('unlock');
        globalThis.notify(`✨ ${def.label} débloqué !`, 'gold'); renderGangTab();
      }, null, { confirmLabel: 'Acheter', cancelLabel: 'Annuler' });
    });
  });

  // Header buttons
  tab.querySelector('#btnOpenTitles')?.addEventListener('click', () => globalThis.openTitleModal?.());
  tab.querySelector('#btnExportGang')?.addEventListener('click', () => globalThis._gbase_openExportModal?.());
  tab.querySelector('#btnEditBoss')?.addEventListener('click', () => globalThis.openBossEditModal?.(() => renderGangTab()));

  // Boss team slot tabs
  tab.querySelectorAll('.gang-team-slot-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const st      = globalThis.state;
      const slotIdx = parseInt(btn.dataset.teamSlot);
      const isPur   = (st.gang.bossTeamSlotsPurchased || [true, false, false])[slotIdx];
      if (!isPur) {
        const cost = SLOT_COSTS[slotIdx];
        globalThis.showConfirm(`Débloquer le Slot ${slotIdx + 1} pour ${cost.toLocaleString()}₽ ?`, () => {
          if (st.gang.money < cost) { globalThis.notify('Fonds insuffisants.', 'error'); globalThis.SFX.play('error'); return; }
          st.gang.money -= cost;
          st.gang.bossTeamSlotsPurchased[slotIdx] = true;
          st.gang.activeBossTeamSlot = slotIdx;
          st.gang.bossTeam = [...(st.gang.bossTeamSlots[slotIdx] || [])];
          globalThis.saveState(); globalThis.updateTopBar(); globalThis.SFX.play('unlock'); renderGangTab();
        }, null, { confirmLabel: 'Acheter', cancelLabel: 'Annuler' }); return;
      }
      st.gang.activeBossTeamSlot = slotIdx;
      st.gang.bossTeam = [...(st.gang.bossTeamSlots[slotIdx] || [])];
      globalThis.saveState(); renderGangTab();
    });
  });

  // Showcase
  tab.querySelectorAll('.gang-showcase-add').forEach(btn => {
    btn.addEventListener('click', () => globalThis.openShowcasePicker?.(parseInt(btn.dataset.idx)));
  });
  tab.querySelectorAll('.gang-showcase-slot.filled').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.classList.contains('gang-showcase-remove') || e.target.classList.contains('gang-evo-hint')) return;
      globalThis.openShowcasePicker?.(parseInt(el.dataset.showcaseIdx));
    });
  });
  tab.querySelectorAll('.gang-showcase-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      const st  = globalThis.state;
      while (st.gang.showcase.length < SHOWCASE_SLOTS) st.gang.showcase.push(null);
      st.gang.showcase[idx] = null;
      globalThis.saveState(); renderGangTab();
    });
  });

  // Evo hint
  tab.querySelectorAll('.gang-evo-hint').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const pk = globalThis.state.pokemons.find(p => p.id === btn.dataset.pkId);
      if (pk) globalThis.showEvoPreviewModal?.(pk);
    });
  });

  // Boss team slots
  tab.querySelectorAll('.gang-team-slot').forEach(el => {
    el.addEventListener('click', () => {
      const st = globalThis.state;
      const i  = parseInt(el.dataset.bossSlot);
      if (el.classList.contains('filled')) {
        st.gang.bossTeam.splice(i, 1);
        st.gang.bossTeamSlots[st.gang.activeBossTeamSlot || 0] = [...st.gang.bossTeam];
        globalThis.saveState(); renderGangTab();
      } else {
        globalThis.openTeamPickerModal?.(i, () => renderGangTab());
      }
    });
  });

  // Populate sub-panels
  const musicEl = tab.querySelector('#gangMusicContainer');
  if (musicEl) renderMusicPanel(musicEl);
  const appearanceEl = tab.querySelector('#gangAppearanceContainer');
  if (appearanceEl) {
    renderAppearancePanel(appearanceEl);
    // Restaurer le scroll du carousel apparence après reconstruction
    if (_savedCosmScroll) appearanceEl.scrollTop = _savedCosmScroll;
  }
}

Object.assign(globalThis, {
  _gtab_renderGangTab: renderGangTab,
  lockGangTab,
  unlockGangTab,
});
