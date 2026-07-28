let settingsContext = {};

export function configureSettingsModal(ctx = {}) {
  settingsContext = { ...settingsContext, ...ctx };
}
function getContextValue(name, fallback) {
  const value = settingsContext[name];
  if (value !== undefined) return value;
  return fallback;
}

function callContext(name, ...args) {
  const fn = settingsContext[name] ?? globalThis[name];
  return typeof fn === 'function' ? fn(...args) : undefined;
}

function makeProxy(getTarget) {
  return new Proxy({}, {
    get(_target, prop) {
      const target = getTarget();
      const value = target?.[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(_target, prop, value) {
      const target = getTarget();
      if (!target) return false;
      target[prop] = value;
      return true;
    },
    has(_target, prop) {
      const target = getTarget();
      return !!target && prop in target;
    },
    ownKeys() {
      return Reflect.ownKeys(getTarget() ?? {});
    },
    getOwnPropertyDescriptor(_target, prop) {
      const target = getTarget() ?? {};
      const desc = Object.getOwnPropertyDescriptor(target, prop);
      return desc ? { ...desc, configurable: true } : undefined;
    },
  });
}

function getStateObject() {
  return settingsContext.getState?.() ?? settingsContext.state ?? globalThis.state ?? {};
}

const state = makeProxy(getStateObject);
const document = makeProxy(() => getContextValue('document', globalThis.document));
const window = makeProxy(() => getContextValue('window', globalThis.window));
const localStorage = makeProxy(() => getContextValue('localStorage', globalThis.localStorage));
const location = makeProxy(() => getContextValue('location', globalThis.location));
const caches = makeProxy(() => getContextValue('caches', globalThis.caches));
const MusicPlayer = makeProxy(() => getContextValue('MusicPlayer', globalThis.MusicPlayer));
const SFX = makeProxy(() => getContextValue('SFX', globalThis.SFX));
const SPECIES_BY_EN = makeProxy(() => settingsContext.getSpeciesMap?.() ?? getContextValue('SPECIES_BY_EN'));

function exportSave() { return callContext('exportSave'); }
function importSave(file) { return callContext('importSave', file); }
function saveState() { return callContext('saveState'); }
function showConfirm(...args) { return callContext('showConfirm', ...args); }
function notify(...args) { return callContext('notify', ...args); }
function t(...args) { return callContext('t', ...args); }
function setState(nextState) { return callContext('setState', nextState); }
function closeZoneWindow(...args) { return callContext('closeZoneWindow', ...args); }
function showIntro(...args) { return callContext('showIntro', ...args); }
function tryCheatCode(...args) { return callContext('tryCheatCode', ...args); }
function detectLLM(...args) { return callContext('detectLLM', ...args); }
function renderAll(...args) { return callContext('renderAll', ...args); }
function getPokemonSprite(...args) { return callContext('getPokemonSprite', ...args); }

function createDefaultState() {
  const factory = settingsContext.createDefaultState ?? globalThis.createDefaultState;
  if (typeof factory === 'function') return factory();
  return structuredClone(globalThis.DEFAULT_STATE ?? {});
}

function getSaveKey() {
  return settingsContext.getSaveKey?.() ?? globalThis.SAVE_KEY;
}

function getGameVersion() {
  return settingsContext.GAME_VERSION ?? globalThis.GAME_VERSION ?? '';
}

function getOpenZones() {
  return settingsContext.getOpenZones?.() ?? globalThis.openZones ?? new Set();
}

function resetTransientSelections() {
  if (typeof settingsContext.resetTransientSelections === 'function') {
    settingsContext.resetTransientSelections();
  }
}

const _t = (fr, en) => (globalThis.state?.lang === 'en' ? en : fr);

// ════════════════════════════════════════════════════════════════
// UI — SETTINGS MODAL
// ════════════════════════════════════════════════════════════════

// ── SFX individual sound labels ────────────────────────────────
const SFX_LABELS = () => ({
  levelUp:   _t('Montée de niveau', 'Level Up'),
  capture:   _t('Capture', 'Capture'),
  evolve:    _t('Évolution', 'Evolution'),
  ballThrow: _t('Lancer de Ball', 'Ball Throw'),
  notify:    _t('Notification', 'Notification'),
  coin:      _t('Argent / Récolte', 'Money / Collect'),
  buy:       _t('Achat', 'Purchase'),
  unlock:    _t('Déverrouillage', 'Unlock'),
  chest:     _t('Coffre', 'Chest'),
  sell:      _t('Vente', 'Sale'),
  error:     _t('Erreur', 'Error'),
  click:     _t('Clic UI', 'UI Click'),
  tabSwitch: _t('Changement onglet', 'Tab Switch'),
  menuOpen:  _t('Ouverture menu', 'Menu Open'),
  menuClose: _t('Fermeture menu', 'Menu Close'),
});

// ── Snapshot pour live-preview + revert ─────────────────────────────────────
let _settingsSnap     = null;
let _settingsLangSnap = 'fr';

export function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (!modal) return;
  _settingsSnap     = structuredClone(state.settings);
  _settingsLangSnap = state.lang;
  renderSettingsPanel();
  _bindSettingsLive();
  modal.classList.add('active');
}

function _applySettingsLive() {
  const el = document.getElementById('settingsContent');
  if (!el) return;
  const readTog = (id, def) => {
    const b = el.querySelector(`[data-toggle-id="${id}"]`);
    return b ? b.dataset.on === 'true' : def;
  };

  const lightTheme  = readTog('lightTheme', false);
  const lowSpec     = readTog('lowSpec',    false);
  const musicOn     = readTog('music',      false);
  const sfxOn       = readTog('sfx',        true);
  const musicVol    = parseInt(document.getElementById('sVolMusic')?.value)   || 80;
  const sfxVol      = parseInt(document.getElementById('sVolSFX')?.value)     || 80;
  const uiScale     = parseInt(document.getElementById('sUIScale')?.value)    || 100;
  const zoneScale   = parseInt(document.getElementById('sZoneScale')?.value)  || 100;

  document.body.classList.toggle('theme-light', lightTheme);
  document.body.classList.toggle('low-spec',    lowSpec);
  document.documentElement.style.setProperty('--ui-scale',   (uiScale   / 100).toFixed(2));
  document.documentElement.style.setProperty('--zone-scale', (zoneScale / 100).toFixed(2));

  if (musicOn) {
    MusicPlayer.setVolume(musicVol / 1000);
    MusicPlayer.updateFromContext?.();
  } else {
    MusicPlayer.stop();
  }

  Object.assign(state.settings, {
    lightTheme, lowSpec, sfxEnabled: sfxOn, sfxVol,
    musicEnabled: musicOn, musicVol, uiScale, zoneScale,
  });
}

function _revertSettings() {
  if (!_settingsSnap) return;
  state.settings = structuredClone(_settingsSnap);
  state.lang      = _settingsLangSnap;

  const S = state.settings;
  document.body.classList.toggle('theme-light', S.lightTheme === true);
  document.body.classList.toggle('low-spec',    S.lowSpec    === true);
  document.documentElement.style.setProperty('--ui-scale',   ((S.uiScale   ?? 100) / 100).toFixed(2));
  document.documentElement.style.setProperty('--zone-scale', ((S.zoneScale ?? 100) / 100).toFixed(2));
  if (S.musicEnabled) {
    MusicPlayer.setVolume((S.musicVol ?? 80) / 1000);
    MusicPlayer.updateFromContext?.();
  } else {
    MusicPlayer.stop();
  }
}

function _bindSettingsLive() {
  const el = document.getElementById('settingsContent');
  if (!el) return;

  el.querySelectorAll('.s-toggle[data-toggle-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const on = btn.dataset.on !== 'true';
      btn.dataset.on  = String(on);
      btn.textContent = on ? _t('Activé', 'Enabled') : _t('Désactivé', 'Disabled');
      _applySettingsLive();
    });
  });

  el.querySelectorAll('.s-toggle[data-sfx-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      const on = btn.dataset.on !== 'true';
      btn.dataset.on  = String(on);
      btn.textContent = on ? _t('Activé', 'Enabled') : _t('Désactivé', 'Disabled');
      if (!state.settings.sfxIndividual) state.settings.sfxIndividual = {};
      state.settings.sfxIndividual[btn.dataset.sfxKey] = on;
    });
  });

  el.querySelectorAll('.sfx-preview-btn[data-sfx-preview]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.sfxPreview;
      try { SFX[key]?.(); } catch {}
      btn.textContent = '♪';
      setTimeout(() => { btn.textContent = '▶'; }, 400);
    });
  });

  const bindSlider = (id, labelId, suffix, applyFn) => {
    const slider = document.getElementById(id);
    const label  = document.getElementById(labelId);
    if (!slider) return;
    slider.addEventListener('input', function () {
      if (label) label.textContent = this.value + suffix;
      applyFn?.(this.value);
      _applySettingsLive();
    });
  };
  bindSlider('sVolMusic',  'sVolMusicVal',  '%');
  bindSlider('sVolSFX',    'sVolSFXVal',    '%');
  bindSlider('sUIScale',   'sUIScaleVal',   '%');
  bindSlider('sZoneScale', 'sZoneScaleVal', '%');

  document.getElementById('btnSfxSubToggle')?.addEventListener('click', () => {
    const inner = document.getElementById('sfxSubList');
    if (inner) {
      inner.classList.toggle('open');
      const arrow = inner.classList.contains('open') ? '▾' : '▸';
      const b = document.getElementById('btnSfxSubToggle');
      if (b) b.textContent = `${arrow} ${_t('Sons individuels', 'Individual sounds')}`;
    }
  });

  document.getElementById('spriteModeGrid')?.querySelectorAll('.sprite-mode-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.sprite-mode-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      state.settings.spriteMode = card.dataset.spriteMode;
    });
  });

  _bindSettingsActionButtons();

  const vEl = document.getElementById('settingsVersion');
  if (vEl) vEl.textContent = getGameVersion();
}

function renderSettingsPanel() {
  const el = document.getElementById('settingsContent');
  if (!el) return;

  const S = state.settings;
  const labels = SFX_LABELS();

  const tog = (id, on) =>
    `<button class="s-toggle" data-toggle-id="${id}" data-on="${!!on}">${on ? _t('Activé','Enabled') : _t('Désactivé','Disabled')}</button>`;

  const sfxRows = Object.entries(labels).map(([key, label]) => {
    const on = S.sfxIndividual?.[key] !== false;
    return `<div class="sfx-sub-row">
      <label>${label}</label>
      <div style="display:flex;align-items:center;gap:6px">
        <button class="sfx-preview-btn" data-sfx-preview="${key}" title="${_t('Ecouter','Listen')}" style="font-family:var(--font-pixel);font-size:9px;padding:2px 7px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer;line-height:1">▶</button>
        <button class="s-toggle" data-sfx-key="${key}" data-on="${on}">${on ? _t('Activé','Enabled') : _t('Désactivé','Disabled')}</button>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <!-- Langue -->
    <div class="settings-section">
      <h4>🌐 ${_t('Langue','Language')}</h4>
      <div class="settings-row">
        <label>${_t('Langue du jeu','Game language')}</label>
        <select id="settingLang">
          <option value="fr" ${S.lang === 'fr' || state.lang === 'fr' ? 'selected' : ''}>Français</option>
          <option value="en" ${state.lang === 'en' ? 'selected' : ''}>English</option>
        </select>
      </div>
    </div>

    <!-- Gameplay -->
    <div class="settings-section">
      <h4>🎮 ${_t('Gameplay','Gameplay')}</h4>
      <div class="settings-row">
        <label>${_t('Auto-combat agents','Agent auto-battle')}</label>
        ${tog('autoCombat', S.autoCombat !== false)}
      </div>
      <div class="settings-row">
        <label>${_t('Popup combat — zones fermées (arrière-plan)','Battle popup — closed zones (background)')}</label>
        ${tog('miniCombatNotifyBackground', S.miniCombatNotifyBackground !== false)}
      </div>
      <div class="settings-row">
        <label>${_t('Popup combat — zones ouvertes hors onglet Zones','Battle popup — open zones outside Zones tab')}</label>
        ${tog('miniCombatNotifyUnfocused', S.miniCombatNotifyUnfocused !== false)}
      </div>
      <div class="settings-row">
        <label>${_t('Rapport de mission au retour','Mission report on return')}</label>
        <select id="settingOfflineReport">
          ${(() => {
            const cur = typeof S.offlineReportThreshold === 'number' ? S.offlineReportThreshold : 300;
            const opts = [
              { v: 0,    lFr: 'Jamais',   lEn: 'Never' },
              { v: 60,   lFr: '≥ 1 min',   lEn: '≥ 1 min' },
              { v: 300,  lFr: '≥ 5 min',   lEn: '≥ 5 min' },
              { v: 900,  lFr: '≥ 15 min',  lEn: '≥ 15 min' },
              { v: 1800, lFr: '≥ 30 min',  lEn: '≥ 30 min' },
              { v: 3600, lFr: '≥ 1 h',     lEn: '≥ 1 h' },
            ];
            return opts.map(o => `<option value="${o.v}" ${cur === o.v ? 'selected' : ''}>${_t(o.lFr, o.lEn)}</option>`).join('');
          })()}
        </select>
      </div>
      <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:8px">
        <label style="margin-bottom:2px">🖼 ${_t('Mode sprites Pokémon','Pokémon sprite mode')}</label>
        ${(() => {
          const SPRITE_MODES = [
            { id:'local', label:'FireRed', sub:_t('Local HD','Local HD'), img: (() => { const sp = SPECIES_BY_EN['pikachu']; const id = sp?.dex; return (id && typeof getPokemonSprite==='function') ? getPokemonSprite(id,'main') : null; })() },
            { id:'gen1',  label:'Gen 1',  sub:_t('Rogue/Bleu','Red/Blue'),    img:`https://play.pokemonshowdown.com/sprites/gen1/pikachu.png` },
            { id:'gen2',  label:'Gen 2',  sub:_t('Or/Argent','Gold/Silver'),  img:`https://play.pokemonshowdown.com/sprites/gen2/pikachu.png` },
            { id:'gen3',  label:'Gen 3',  sub:_t('RS/FRLG','RS/FRLG'),        img:`https://play.pokemonshowdown.com/sprites/gen3/pikachu.png` },
            { id:'gen4',  label:'Gen 4',  sub:_t('DP/Platine','DP/Platinum'), img:`https://play.pokemonshowdown.com/sprites/gen4/pikachu.png` },
            { id:'gen5',  label:'Gen 5',  sub:_t('Noir/Blanc','Black/White'), img:`https://play.pokemonshowdown.com/sprites/gen5/pikachu.png` },
            { id:'ani',   label:_t('Animé','Anim'),  sub:_t('GIF Gen 6+','GIF Gen 6+'), img:`https://play.pokemonshowdown.com/sprites/ani/pikachu.gif` },
            { id:'dex',   label:'Dex',    sub:_t('XY/ORAS HD','XY/ORAS HD'),  img:`https://play.pokemonshowdown.com/sprites/dex/pikachu.png` },
            { id:'home',  label:'HOME',   sub:_t('Switch HD','Switch HD'),    img:`https://play.pokemonshowdown.com/sprites/home-centered/pikachu.png` },
          ];
          const cur = S.spriteMode || 'local';
          return `<div class="sprite-mode-grid" id="spriteModeGrid">${
            SPRITE_MODES.map(m => `
              <div class="sprite-mode-card${m.id===cur?' active':''}" data-sprite-mode="${m.id}" title="${m.sub}">
                <img src="${m.img||''}" style="width:40px;height:40px;image-rendering:pixelated;object-fit:contain" onerror="this.style.opacity='.3'">
                <span class="smc-label">${m.label}</span>
                <span class="smc-sub">${m.sub}</span>
              </div>`).join('')
          }</div>`;
        })()}
      </div>
      <div class="settings-row">
        <label>${_t('Évolution auto','Auto evolution')} <span style="font-size:.75em;opacity:.6">${_t('(choix aléatoire, sans cartes)','(random choice, no cards)')}</span></label>
        ${tog('autoEvoChoice', S.autoEvoChoice === true)}
      </div>
    </div>

    <!-- Audio -->
    <div class="settings-section">
      <h4>🔊 ${_t('Audio','Audio')}</h4>
      <div class="settings-row">
        <label>${_t('Musique de fond','Background music')}</label>
        ${tog('music', S.musicEnabled === true)}
      </div>
      <div class="settings-row">
        <label>${_t('Volume musique','Music volume')} <span id="sVolMusicVal" style="color:var(--gold);margin-left:4px">${S.musicVol ?? 80}%</span></label>
        <input type="range" id="sVolMusic" min="0" max="100" step="5" value="${S.musicVol ?? 80}" style="width:110px">
      </div>
      <div class="settings-row">
        <label>${_t('Effets sonores (SFX)','Sound effects (SFX)')}</label>
        ${tog('sfx', S.sfxEnabled !== false)}
      </div>
      <div class="settings-row">
        <label>${_t('Volume SFX','SFX volume')} <span id="sVolSFXVal" style="color:var(--gold);margin-left:4px">${S.sfxVol ?? 80}%</span></label>
        <input type="range" id="sVolSFX" min="0" max="100" step="5" value="${S.sfxVol ?? 80}" style="width:110px">
      </div>
      <div class="sfx-sublist">
        <button id="btnSfxSubToggle" style="font-family:var(--font-pixel);font-size:8px;padding:4px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer;width:100%;text-align:left">
          ▸ ${_t('Sons individuels','Individual sounds')}
        </button>
        <div class="sfx-sublist-inner" id="sfxSubList">
          ${sfxRows}
        </div>
      </div>
    </div>

    <!-- Affichage -->
    <div class="settings-section">
      <h4>🖥 ${_t('Affichage','Display')}</h4>
      <div class="settings-row">
        <label>${_t('Thème clair','Light theme')}</label>
        ${tog('lightTheme', S.lightTheme === true)}
      </div>
      <div class="settings-row">
        <label>${_t('Mode légère','Low-spec mode')} <span style="font-size:.75em;opacity:.6">${_t('(réduit animations)','(reduces animations)')}</span></label>
        ${tog('lowSpec', S.lowSpec === true)}
      </div>
      <div class="settings-row">
        <label>${_t('Taille interface','Interface size')} <span id="sUIScaleVal" style="color:var(--gold);margin-left:4px">${S.uiScale ?? 100}%</span></label>
        <input type="range" id="sUIScale" min="70" max="130" step="5" value="${S.uiScale ?? 100}" style="width:110px">
      </div>
      <div class="settings-row">
        <label>${_t('Sprites zones','Zone sprites')} <span id="sZoneScaleVal" style="color:var(--gold);margin-left:4px">${S.zoneScale ?? 100}%</span></label>
        <input type="range" id="sZoneScale" min="50" max="200" step="10" value="${S.zoneScale ?? 100}" style="width:110px">
      </div>
    </div>

    <!-- Sauvegarde -->
    <div class="settings-section">
      <h4>💾 ${_t('Sauvegarde','Save')}</h4>
      <div class="settings-actions">
        <button id="btnExportSave">📤 ${_t('Exporter','Export')}</button>
        <button id="btnImportSave">📥 ${_t('Importer','Import')}</button>
      </div>
    </div>

    <!-- Cache -->
    <div class="settings-section">
      <h4>🗑 ${_t('Cache','Cache')}</h4>
      <div class="settings-actions">
        <button id="btnPurgeSprites" class="danger">${_t('Purger sprites','Purge sprites')}</button>
        <button id="btnResetAll" class="danger">${_t('Reset complet','Full reset')}</button>
      </div>
    </div>

    <!-- Code récompense -->
    <div class="settings-section">
      <h4>🎁 ${_t('Code récompense','Reward code')}</h4>
      <div class="settings-row" style="flex-direction:column;align-items:stretch;gap:6px">
        <div style="display:flex;gap:6px">
          <input type="text" id="rewardCodeInput" placeholder="${_t('Entre un code...','Enter a code...')}" style="flex:1;text-transform:uppercase;letter-spacing:1px">
          <button id="btnRedeemCode" style="font-family:var(--font-pixel);font-size:8px;padding:6px 10px;background:var(--red-dark);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--text);cursor:pointer;white-space:nowrap">${_t('Valider','Redeem')}</button>
        </div>
        <div style="font-size:9px;color:var(--text-dim)">${_t('Les codes sont distribués sur le Discord.','Codes are distributed on Discord.')}</div>
      </div>
    </div>

    <!-- Aide -->
    <div class="settings-section">
      <h4>ℹ ${_t('Aide &amp; Contact','Help &amp; Contact')}</h4>
      <div style="font-size:10px;color:var(--text-dim);line-height:1.6;margin-bottom:10px">
        <b style="color:var(--gold)">PokéForge — Gang Wars</b><br>
        ${_t('Capturez des Pokémon, recrutez des agents, combattez des dresseurs et élargissez votre gang.','Catch Pokémon, recruit agents, battle trainers and grow your gang.')}<br><br>
        <b style="color:var(--text)">${_t('Progression :','Progression:')}</b> ${_t('Gagnez de la réputation via les <b>combats spéciaux</b> et les <b>raids</b>.','Earn reputation through <b>special battles</b> and <b>raids</b>.')}<br>
        <b style="color:var(--text)">${_t('Oeufs :','Eggs:')}</b> ${_t('Élevez des Pokémon à la Pension — achetez un <b>incubateur</b> au Marché.','Raise Pokémon at the Daycare — buy an <b>incubator</b> at the Market.')}<br>
        <b style="color:var(--text)">${_t('Agents :','Agents:')}</b> ${_t('Recrutez des agents et assignez-les à des zones pour automatiser captures et combats.','Recruit agents and assign them to zones to automate catches and battles.')}<br>
        <b style="color:var(--text)">${_t('Labo :','Lab:')}</b> ${_t('Sacrifiez des doublons pour améliorer le potentiel de vos meilleurs Pokémon.','Sacrifice duplicates to boost the potential of your best Pokémon.')}
      </div>
      <div style="padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);font-size:10px;text-align:center">
        ${_t('Contact &amp; Support — Discord :','Contact &amp; Support — Discord:')} <b style="color:var(--gold)">mutenrock</b>
      </div>
    </div>
  `;
}

function _bindSettingsActionButtons() {
  document.getElementById('btnExportSave')?.addEventListener('click', exportSave);
  document.getElementById('btnImportSave')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', () => {
      if (input.files[0]) importSave(input.files[0]);
    });
    input.click();
  });
  document.getElementById('btnPurgeSprites')?.addEventListener('click', () => {
    const doReload = () => { saveState(); location.reload(true); };
    if ('caches' in window) {
      caches.keys().then(names => {
        Promise.all(names.map(n => caches.delete(n))).then(doReload).catch(doReload);
      }).catch(doReload);
    } else {
      doReload();
    }
    notify(_t('🗑 Cache purgé — rechargement en cours…', '🗑 Cache purged — reloading…'), 'success');
  });
  document.getElementById('btnResetAll')?.addEventListener('click', () => {
    showConfirm(t('reset_confirm'), () => {
      localStorage.removeItem(getSaveKey());
      setState(createDefaultState());
      for (const zid of [...getOpenZones()]) closeZoneWindow(zid);
      resetTransientSelections();
      showIntro();
    }, null, { danger: true, confirmLabel: _t('Réinitialiser', 'Reset'), cancelLabel: _t('Annuler', 'Cancel') });
  });
  document.getElementById('btnRedeemCode')?.addEventListener('click', () => tryCheatCode('rewardCodeInput'));
  document.getElementById('rewardCodeInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') tryCheatCode('rewardCodeInput');
  });
}

export function initSettings() {
  document.getElementById('btnSettings')?.addEventListener('click', () => {
    SFX.play('menuOpen');
    openSettingsModal();
  });

  document.getElementById('btnCloseSettings')?.addEventListener('click', () => {
    _revertSettings();
    SFX.play('menuClose');
    document.getElementById('settingsModal')?.classList.remove('active');
  });

  document.getElementById('btnSaveSettings')?.addEventListener('click', () => {
    const el = document.getElementById('settingsContent');
    const readToggle = (id, def = true) => {
      const btn = el?.querySelector(`[data-toggle-id="${id}"]`);
      return btn ? btn.dataset.on === 'true' : def;
    };

    const langSel = document.getElementById('settingLang');
    if (langSel) state.lang = langSel.value;

    state.settings.autoCombat     = readToggle('autoCombat',    true);
    state.settings.miniCombatNotifyBackground = readToggle('miniCombatNotifyBackground', true);
    state.settings.miniCombatNotifyUnfocused  = readToggle('miniCombatNotifyUnfocused',  true);
    const offlineReportSel = document.getElementById('settingOfflineReport');
    if (offlineReportSel) {
      const v = parseInt(offlineReportSel.value, 10);
      state.settings.offlineReportThreshold = Number.isFinite(v) ? v : 300;
    }
    state.settings.autoEvoChoice  = readToggle('autoEvoChoice', false);
    state.settings.musicEnabled   = readToggle('music',         false);
    state.settings.sfxEnabled     = readToggle('sfx',           true);
    state.settings.lightTheme     = readToggle('lightTheme',    false);
    state.settings.lowSpec        = readToggle('lowSpec',        false);

    state.settings.musicVol  = parseInt(document.getElementById('sVolMusic')?.value)   || 80;
    state.settings.sfxVol    = parseInt(document.getElementById('sVolSFX')?.value)     || 80;
    state.settings.uiScale   = parseInt(document.getElementById('sUIScale')?.value)    || 100;
    state.settings.zoneScale = parseInt(document.getElementById('sZoneScale')?.value)  || 100;

    if (!state.settings.sfxIndividual) state.settings.sfxIndividual = {};
    el?.querySelectorAll('.s-toggle[data-sfx-key]').forEach(btn => {
      state.settings.sfxIndividual[btn.dataset.sfxKey] = btn.dataset.on === 'true';
    });

    document.body.classList.toggle('theme-light', state.settings.lightTheme === true);
    document.body.classList.toggle('low-spec',    state.settings.lowSpec    === true);
    document.documentElement.style.setProperty('--ui-scale',   (state.settings.uiScale   / 100).toFixed(2));
    document.documentElement.style.setProperty('--zone-scale', (state.settings.zoneScale / 100).toFixed(2));
    if (state.settings.musicEnabled) { MusicPlayer.setVolume(state.settings.musicVol / 1000); MusicPlayer.updateFromContext(); }
    else MusicPlayer.stop();

    saveState();
    detectLLM();
    SFX.play('menuClose');
    document.getElementById('settingsModal')?.classList.remove('active');

    const needsReload = (_settingsSnap?.spriteMode !== state.settings.spriteMode)
                     || (_settingsLangSnap         !== state.lang);
    if (needsReload) {
      setTimeout(() => location.reload(true), 150);
    } else {
      renderAll();
    }
  });
}
