'use strict';

// ════════════════════════════════════════════════════════════════
//  panels.js — panneaux cosmétiques portés depuis modules/ui/gangTab.js
//  et modules/systems/titles.js / modules/ui/pickers.js.
//
//  Dépendances globalThis (posées par gang-app.js) :
//    state, notify, showConfirm, SFX, saveState, isZoneUnlocked,
//    pokeSprite, pokemonDisplayName, applyCosmetics,
//    COSMETIC_BGS, FABRIC_SPECIES, PATCH_PIDS, fabricBgUrl, patchUrl,
//    SHOWCASE_SLOTS, BALL_SPRITES, BALLS, SHOP_ITEMS
//  Dépendances classiques (bare-name) : ZONES, TITLES, POKEMON_GEN1
// ════════════════════════════════════════════════════════════════

const FABRIC_SHOP_COST = 100_000;

// ── Musique ────────────────────────────────────────────────────────────────
// Portage quasi-verbatim de modules/ui/gangTab.js:61-121. La lecture audio
// réelle reste pilotée par le lecteur du jeu principal à son prochain
// chargement (state.settings.jukeboxTrack est le seul état partagé) — pas
// de lecteur dupliqué sur cette page.
export function renderMusicPanel(container) {
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
  const state = globalThis.state;
  const currentJuke = state.settings?.jukeboxTrack || null;
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
    <div class="gang-panel-title">🎵 MUSIQUE</div>
    <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:10px">
      En cours : <span style="color:var(--gold)">${currentJuke ? currentJuke : 'AUTO'}</span>
      <span style="opacity:.6"> — appliqué au prochain chargement du jeu</span>
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
      state.settings.jukeboxTrack = key === '__auto__' ? null : key;
      globalThis.notify(key === '__auto__' ? '🎵 Jukebox → Auto' : `🎵 ${key}`, 'success');
      globalThis.saveState();
      renderMusicPanel(container);
    });
  });
}

// ── Apparence (fonds, tissus, pins, skins de ball) ──────────────────────────
// Portage de modules/ui/gangTab.js:182-504.
export function renderAppearancePanel(container) {
  const state          = globalThis.state;
  const COSMETIC_BGS   = globalThis.COSMETIC_BGS;
  const FABRIC_SPECIES = globalThis.FABRIC_SPECIES;
  const PATCH_PIDS     = globalThis.PATCH_PIDS;
  const fabricBgUrl    = globalThis.fabricBgUrl;
  const patchUrl       = globalThis.patchUrl;

  const unlocked      = new Set(state.cosmetics?.unlockedBgs || []);
  const active        = state.cosmetics?.gameBg || null;
  const favoriteBgs   = state.cosmetics?.favoriteBgs  || [];
  const activePatches = state.cosmetics?.activePatches || [];
  const fabricMode    = state.cosmetics?.fabricMode    || 'repeat';
  const fabricSize    = state.cosmetics?.fabricSize    ?? 320;
  const fabricOpacity = state.cosmetics?.fabricOpacity ?? 72;
  const isFabricActive = active?.startsWith('fabric_') ?? false;

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
    <div class="gang-panel-title">🖼 APPARENCE</div>
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
      style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;padding:4px 2px 10px">
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

  container.querySelectorAll('.cosm-card:not(.cosm-fabric-card)').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.cosm;
      if (key === 'none') {
        state.cosmetics.gameBg = null;
        globalThis.saveState(); globalThis.applyCosmetics();
        renderAppearancePanel(container); return;
      }
      const c = COSMETIC_BGS[key];
      if (!c) return;
      if (unlocked.has(key)) {
        state.cosmetics.gameBg = key;
        globalThis.saveState(); globalThis.applyCosmetics();
        renderAppearancePanel(container);
      } else {
        if (state.gang.money < c.cost) { globalThis.notify('Fonds insuffisants.', 'error'); return; }
        globalThis.showConfirm(`Acheter "${c.fr}" pour ${c.cost.toLocaleString()}₽ ?`, () => {
          state.gang.money -= c.cost;
          state.cosmetics.unlockedBgs = [...(state.cosmetics.unlockedBgs || []), key];
          state.cosmetics.gameBg = key;
          globalThis.saveState(); globalThis.applyCosmetics();
          globalThis.notify(`🎨 "${c.fr}" débloqué !`, 'gold');
          renderAppearancePanel(container);
        }, null, { confirmLabel: 'Acheter', cancelLabel: 'Annuler' });
      }
    });
  });

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
          renderAppearancePanel(container);
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
            globalThis.saveState(); globalThis.applyCosmetics();
            globalThis.notify(`🧵 Fond tissu "${fr}" débloqué !`, 'gold');
            renderAppearancePanel(container);
          }, null, { confirmLabel: 'Acheter', cancelLabel: 'Annuler' });
        }
      });
    });
  };
  const fabricSlider = container.querySelector('#fabricSlider');
  if (fabricSlider) _bindFabricHandlers(fabricSlider);

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
    });
  });

  const fabricSettings = container.querySelector('#fabricSettings');
  if (fabricSettings) {
    fabricSettings.querySelectorAll('.fabric-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.cosmetics.fabricMode = btn.dataset.mode;
        globalThis.saveState(); globalThis.applyCosmetics();
        renderAppearancePanel(container);
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
      renderAppearancePanel(container);
    });
  });

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
      if ((state.gang.money || 0) < item.cost) { globalThis.notify('Fonds insuffisants.', 'error'); return; }
      state.gang.money -= item.cost;
      state.purchases[`skin_${item.ballSkin}`] = true;
      state.activeBall = item.ballSkin;
      globalThis.saveState();
      globalThis.notify(`🎳 Skin "${item.ballSkin}" débloqué !`, 'gold');
      renderAppearancePanel(container);
    });
  });
}

const BALL_SKIN_KEYS = ['greatball', 'duskball', 'ultraball', 'masterball'];
function _buildBallSkinsHtml(state) {
  const lang = state.lang === 'fr' ? 'fr' : 'en';
  const BALLS = globalThis.BALLS || {};
  const BALL_SPRITES = globalThis.BALL_SPRITES || {};
  const activeBall = state.activeBall || 'pokeball';

  const rows = BALL_SKIN_KEYS.map(key => {
    const ballDef   = BALLS[key] || { fr: key, en: key };
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

// ── Titre ────────────────────────────────────────────────────────────────
// Portage de modules/systems/titles.js (openTitleModal) — même logique de
// slots/liaison, ouverte depuis un panneau dédié au lieu d'une modal
// par-dessus le jeu.
const LIAISONS = ['', 'de', "de l'", 'du', 'des', 'à', 'et', '&', 'alias', 'dit'];
const SLOT_DEFS = [
  { key:'titleA', label:'Titre 1', color:'var(--gold)',  bg:'rgba(255,204,90,.15)' },
  { key:'titleB', label:'Titre 2', color:'var(--red)',   bg:'rgba(204,51,51,.15)' },
  { key:'titleC', label:'Badge 1', color:'#4fc3f7',      bg:'rgba(79,195,247,.12)' },
  { key:'titleD', label:'Badge 2', color:'#ce93d8',      bg:'rgba(206,147,216,.12)' },
];

function _getTitleLabel(titleId) { return TITLES.find(t => t.id === titleId)?.label || ''; }
function _getBossFullTitle() {
  const state = globalThis.state;
  const t1 = _getTitleLabel(state.gang.titleA);
  const t2 = _getTitleLabel(state.gang.titleB);
  const lia = state.gang.titleLiaison || '';
  if (!t1 && !t2) return 'Recrue';
  if (t1 && !t2) return t1;
  if (!t1 && t2) return t2;
  return `${t1}${lia ? ' ' + lia : ''} ${t2}`;
}

export function renderTitrePanel(container) {
  const state = globalThis.state;
  let _activeSlot = 0;

  const draw = () => {
    const unlocked = new Set(state.unlockedTitles || []);
    const slots = SLOT_DEFS.map(s => state.gang[s.key]);
    const lia = state.gang.titleLiaison || '';
    const activeSlotDef = SLOT_DEFS[_activeSlot];

    const categories = {
      rep:'Réputation', type_capture:'Type', stat:'Exploit',
      shop:'Boutique', special:'Spécial',
      pokedex:'Pokédex', shiny_special:'Chromatique', collection:'Collection',
    };

    const liaOptions = LIAISONS.map(l => `<option value="${l}" ${l === lia ? 'selected' : ''}>${l || '(aucun)'}</option>`).join('');
    const slotBtns = SLOT_DEFS.map((s, i) => {
      const isActive = i === _activeSlot;
      const val = slots[i];
      const lbl = val ? _getTitleLabel(val) : '—';
      return `<button class="slot-sel-btn" data-slot="${i}"
        style="flex:1;font-family:var(--font-pixel);font-size:7px;padding:5px 4px;border-radius:var(--radius-sm);cursor:pointer;
               background:${isActive ? s.bg : 'var(--bg)'};
               border:2px solid ${isActive ? s.color : 'var(--border)'};
               color:${isActive ? s.color : 'var(--text-dim)'}">
        ${s.label}<br><span style="font-size:6px;opacity:.8">${lbl}</span>
      </button>`;
    }).join('');

    let titlesHtml = '';
    for (const [cat, catLabel] of Object.entries(categories)) {
      const group = TITLES.filter(t => t.category === cat);
      if (group.length === 0) continue;
      titlesHtml += `<div style="margin-bottom:12px">
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">${catLabel}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">`;
      for (const t of group) {
        const isUnlocked = unlocked.has(t.id);
        const slotIdx = slots.findIndex(s => s === t.id);
        const assigned = slotIdx >= 0;
        const assignedColor = assigned ? SLOT_DEFS[slotIdx].color : '';
        const assignedBg    = assigned ? SLOT_DEFS[slotIdx].bg    : '';
        const style = isUnlocked
          ? `background:${assigned ? assignedBg : 'var(--bg-card)'};border:1px solid ${assigned ? assignedColor : 'var(--border)'};color:${assigned ? assignedColor : 'var(--text)'};cursor:pointer`
          : 'background:var(--bg);border:1px solid var(--border);color:var(--text-dim);opacity:.4;cursor:not-allowed';
        const badge = assigned ? ` <span style="font-size:6px;opacity:.7">${SLOT_DEFS[slotIdx].label}</span>` : '';
        titlesHtml += `<div class="title-chip ${isUnlocked ? 'title-unlocked' : 'title-locked'}" data-title-id="${t.id}"
          style="font-family:var(--font-pixel);font-size:8px;padding:4px 8px;border-radius:var(--radius-sm);${style}"
          title="${isUnlocked ? (assigned ? `Assigné — cliquer pour retirer` : `Assigner au ${activeSlotDef.label}`) : 'Verrouillé'}">
          ${t.label}${badge}
        </div>`;
      }
      titlesHtml += '</div></div>';
    }

    container.innerHTML = `
      <div class="gang-panel-title">🏆 TITRE</div>
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;text-align:center;margin-bottom:12px">
        <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold-dim)">${_getBossFullTitle()}</div>
        <div style="display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;margin-top:8px">
          <span style="font-size:8px;color:var(--text-dim)">Liaison :</span>
          <select id="gangTitleLiaison" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;font-size:8px;padding:2px 4px">${liaOptions}</select>
          <button id="gangClearTitles" style="font-size:7px;padding:2px 6px;background:var(--bg);border:1px solid var(--border);border-radius:3px;color:var(--text-dim);cursor:pointer">Tout effacer</button>
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:10px">
        <span style="font-size:8px;color:var(--text-dim);align-self:center;white-space:nowrap">Slot actif :</span>
        ${slotBtns}
      </div>
      <div style="font-size:8px;color:var(--text-dim);text-align:center;margin-bottom:10px">
        Clic → assigner au <span style="color:${activeSlotDef.color}">${activeSlotDef.label}</span> · clic sur un titre déjà assigné → retirer
      </div>
      <div>${titlesHtml}</div>`;

    container.querySelector('#gangTitleLiaison')?.addEventListener('change', e => {
      state.gang.titleLiaison = e.target.value;
      globalThis.saveState(); draw();
    });
    container.querySelector('#gangClearTitles')?.addEventListener('click', () => {
      state.gang.titleA = 'recrue'; state.gang.titleB = null;
      state.gang.titleC = null;    state.gang.titleD = null;
      globalThis.saveState(); draw();
    });
    container.querySelectorAll('.slot-sel-btn').forEach(btn => {
      btn.addEventListener('click', () => { _activeSlot = Number(btn.dataset.slot); draw(); });
    });
    container.querySelectorAll('.title-unlocked').forEach(chip => {
      chip.addEventListener('click', () => {
        const id = chip.dataset.titleId;
        const slotKey = SLOT_DEFS[_activeSlot].key;
        if (state.gang[slotKey] === id) {
          state.gang[slotKey] = _activeSlot === 0 ? 'recrue' : null;
        } else {
          for (const s of SLOT_DEFS) { if (state.gang[s.key] === id) state.gang[s.key] = null; }
          state.gang[slotKey] = id;
        }
        globalThis.saveState(); draw();
      });
    });
  };

  draw();
}

// ── Vitrine — 6 slots compacts ──────────────────────────────────────────
export function renderVitrinePanel(container) {
  const state = globalThis.state;
  const SHOWCASE_SLOTS = globalThis.SHOWCASE_SLOTS;
  const showcaseArr = [...(state.gang.showcase || [])];
  while (showcaseArr.length < SHOWCASE_SLOTS) showcaseArr.push(null);

  const slotHtml = showcaseArr.slice(0, SHOWCASE_SLOTS).map((pkId, i) => {
    const pk = pkId ? state.pokemons.find(p => p.id === pkId) : null;
    if (pk) {
      return `<div class="gang-vslot filled" data-vslot="${i}">
        <img src="${globalThis.pokeSprite(pk.species_en, pk.shiny)}" alt="">
        <div class="gang-vslot-name">${globalThis.pokemonDisplayName(pk)}${pk.shiny ? ' ✨' : ''}</div>
        <button class="gang-vslot-remove" data-vslot-remove="${i}" title="Retirer">✕</button>
      </div>`;
    }
    return `<div class="gang-vslot empty" data-vslot="${i}">
      <div class="gang-vslot-plus">+</div>
      <div class="gang-vslot-name">Vide</div>
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="gang-vitrine-layout">
      <div class="gang-vitrine-sidebar">
        <div class="gang-panel-title" style="margin-bottom:8px">🏛 VITRINE</div>
        ${slotHtml}
      </div>
      <div class="gang-environment-zone" id="gangEnvironmentZone"></div>
    </div>`;

  container.querySelectorAll('[data-vslot]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('gang-vslot-remove')) return;
      openShowcasePicker(parseInt(el.dataset.vslot, 10), () => renderVitrinePanel(container));
    });
  });
  container.querySelectorAll('[data-vslot-remove]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.vslotRemove, 10);
      state.gang.showcase[idx] = null;
      globalThis.saveState();
      renderVitrinePanel(container);
    });
  });
}

// Portage de modules/ui/pickers.js:213-266 (openShowcasePicker).
function openShowcasePicker(slotIdx, onDone) {
  const state = globalThis.state;
  const SHOWCASE_SLOTS = globalThis.SHOWCASE_SLOTS;
  const teamIds = new Set(state.gang.bossTeam);
  const candidates = state.pokemons.filter(p => !teamIds.has(p.id));

  const modal = document.createElement('div');
  modal.className = 'gang-picker-overlay';

  const _renderItems = (filtered) => filtered.map(p => `
    <div class="showcase-pick-item" data-pk-id="${p.id}">
      <img src="${globalThis.pokeSprite(p.species_en, p.shiny)}" alt="">
      <div class="showcase-pick-info">
        <div>${globalThis.pokemonDisplayName(p)}${p.shiny ? ' ✨' : ''} ${'★'.repeat(p.potential)}</div>
        <div class="dim">Lv.${p.level}</div>
      </div>
    </div>`).join('') || `<div class="gang-picker-empty">Aucun Pokémon disponible</div>`;

  modal.innerHTML = `
    <div class="gang-picker-box">
      <div class="gang-panel-title">VITRINE — SLOT ${slotIdx + 1}</div>
      <input type="text" id="showcasePickSearch" placeholder="Rechercher un Pokémon…">
      <div id="showcasePickList" class="gang-picker-list">${_renderItems(candidates)}</div>
      <button id="showcasePickCancel">Annuler</button>
    </div>`;
  document.body.appendChild(modal);

  const listEl = modal.querySelector('#showcasePickList');
  function _wireItems() {
    listEl.querySelectorAll('.showcase-pick-item').forEach(el => {
      el.addEventListener('click', () => {
        if (!state.gang.showcase) state.gang.showcase = [];
        while (state.gang.showcase.length < SHOWCASE_SLOTS) state.gang.showcase.push(null);
        state.gang.showcase[slotIdx] = el.dataset.pkId;
        globalThis.saveState();
        modal.remove();
        onDone?.();
      });
    });
  }
  _wireItems();

  modal.querySelector('#showcasePickSearch').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = q
      ? candidates.filter(p => globalThis.pokemonDisplayName(p).toLowerCase().includes(q) || p.species_en.toLowerCase().includes(q))
      : candidates;
    listEl.innerHTML = _renderItems(filtered);
    _wireItems();
  });

  modal.querySelector('#showcasePickCancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}
