'use strict';

// deps via configureModals(ctx):
// - getState, setState, saveState, renderAll, notify, migrate
// - formatPlaytime, exportSave, createDefaultState, getActiveSaveSlot, getSaveKeys
// - getKantoDexSize, getNationalDexSize, getSaveSchemaVersion
// - getAgentRankLabel, pokeSprite, speciesName, switchTab, showIntro
// - applyAutoMutation, cleanObsoleteData, getSlotPreview
// classic-script data globals used by import modals: POKEMON_GEN1, ZONES

import { SFX } from './audio.js';

let modalCtx = {};

function configureModals(ctx = {}) {
  modalCtx = { ...modalCtx, ...ctx };
}

function callCtx(name, ...args) {
  return modalCtx[name]?.(...args);
}

function getState() { return modalCtx.getState?.() ?? globalThis.state ?? {}; }
function setState(...args) { return callCtx('setState', ...args); }
function saveState(...args) { return callCtx('saveState', ...args); }
function renderAll(...args) { return callCtx('renderAll', ...args); }
function notify(...args) { return callCtx('notify', ...args); }
function migrate(raw) { return callCtx('migrate', raw) ?? raw; }
function formatPlaytime(...args) { return callCtx('formatPlaytime', ...args) ?? ''; }
function exportSave(...args) { return callCtx('exportSave', ...args); }
function createDefaultState(...args) { return callCtx('createDefaultState', ...args) ?? {}; }
function getActiveSaveSlot() { return modalCtx.getActiveSaveSlot?.() ?? 0; }
function getSaveKeys() { return modalCtx.getSaveKeys?.() ?? []; }
function getKantoDexSize() { return modalCtx.getKantoDexSize?.() ?? 151; }
function getNationalDexSize() { return modalCtx.getNationalDexSize?.() ?? 151; }
function getSaveSchemaVersion() { return modalCtx.getSaveSchemaVersion?.() ?? '?'; }
function getAgentRankLabel(...args) { return callCtx('getAgentRankLabel', ...args); }
function pokeSprite(...args) { return callCtx('pokeSprite', ...args) ?? ''; }
function speciesName(value) { return callCtx('speciesName', value) ?? value; }
function switchTab(...args) { return callCtx('switchTab', ...args); }
function showIntro(...args) { return callCtx('showIntro', ...args); }
function applyAutoMutation(...args) { return callCtx('applyAutoMutation', ...args) ?? 0; }
function cleanObsoleteData(...args) { return callCtx('cleanObsoleteData', ...args) ?? 0; }
function getSlotPreview(...args) { return callCtx('getSlotPreview', ...args); }

function showConfirm(message, onConfirm, onCancel = null, opts = {}) {
  const existing = document.getElementById('confirmModal');
  if (existing) existing.remove();
  SFX.play('menuOpen');

  const modal = document.createElement('div');
  modal.id = 'confirmModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;';

  const danger = opts.danger ? 'var(--red)' : 'var(--gold-dim)';
  const confirmLabel = opts.confirmLabel || (opts.lang === 'fr' ? 'Confirmer' : 'Confirm');
  const cancelLabel  = opts.cancelLabel  || (opts.lang === 'fr' ? 'Annuler'   : 'Cancel');

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid ${danger};border-radius:var(--radius);padding:24px 28px;max-width:440px;width:90%;display:flex;flex-direction:column;gap:16px">
      <div style="font-size:13px;color:var(--text);line-height:1.6">${message}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="confirmModalCancel" style="font-family:var(--font-pixel);font-size:9px;padding:8px 16px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">${cancelLabel}</button>
        <button id="confirmModalOk" style="font-family:var(--font-pixel);font-size:9px;padding:8px 16px;background:${opts.danger ? 'var(--red-dark)' : 'var(--bg)'};border:1px solid ${danger};border-radius:var(--radius-sm);color:${opts.danger ? '#fff' : 'var(--gold)'};cursor:pointer">${confirmLabel}</button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  document.getElementById('confirmModalOk').addEventListener('click', () => { SFX.play('menuClose'); modal.remove(); onConfirm?.(); });
  document.getElementById('confirmModalCancel').addEventListener('click', () => { SFX.play('menuClose'); modal.remove(); onCancel?.(); });
  modal.addEventListener('click', e => { if (e.target === modal) { SFX.play('menuClose'); modal.remove(); onCancel?.(); } });
}

function showInfoModal(tabId) {
  const INFO = {
    tabGang: {
      title: '💀 LE GANG',
      body: `
        <strong>Réputation</strong> — Ressource clé. Débloque zones, agents supplémentaires, achats spéciaux. Barre en haut à droite.<br><br>
        <strong>Argent (₽)</strong> — Les récompenses de combat s'accumulent dans les zones. Collecte via l'icône ₽ dorée ou automatiquement via tes agents.<br><br>
        <strong>Boss</strong> — Ton avatar. Assigne jusqu'à <strong>3 Pokémon</strong> à son équipe depuis le PC pour renforcer les combats.<br><br>
        <strong>Sac</strong> — Balls actives, boosts temporaires, incubateurs. Clique une Ball pour l'activer comme Ball par défaut.<br><br>
        <strong>Cosmétiques</strong> — Personnalise l'apparence du boss et du gang (déblocable via achats spéciaux).<br><br>
        <span class="dim">Conseil : plus ta réputation est haute, plus les zones et agents disponibles sont puissants.</span>
      `
    },
    tabAgents: {
      title: '👥 AGENTS',
      body: `
        <strong>Niveau</strong> — Toute la puissance d'un agent. Monte en gagnant des combats et en capturant des Pokémon. Plafond : 100.<br><br>
        <strong>Grade</strong> — Grunt → Sergent (Lv.25) → Lieutenant (Lv.50) → Commandant (Lv.75) → Élite / Général (Lv.100). Chaque grade booste la puissance en combat.<br><br>
        <strong>Zone assignée</strong> — L'agent farme passivement en background au vrai rythme de la zone : captures, combats, coffres.<br><br>
        <strong>Cap à 10</strong> — Les agents au-delà du 10e slot nécessitent un déblocage payant (coût croissant).<br><br>
        <span class="dim">Un agent sans zone assignée ne fait rien. Un agent de haut grade avec une bonne équipe fait une différence significative en combat.</span>
      `
    },
    tabZones: {
      title: '🗺️ ZONES',
      body: `
        <strong>Zone ouverte</strong> — Fenêtre visible, spawns interactifs. Tu peux capturer et combattre manuellement. Le timer tourne au rythme de la zone.<br><br>
        <strong>Zone fermée + agent</strong> — Simulation silencieuse en background au vrai rythme de spawn. L'agent capture, combat et ouvre les coffres automatiquement.<br><br>
        <strong>Zone inactive</strong> — Aucun agent assigné, rien ne se passe.<br><br>
        <strong>Maîtrise ★</strong> — S'accumule avec les victoires dans la zone. Améliore les spawns et débloque des dresseurs d'élite.<br><br>
        <strong>Raids hostiles</strong> — Un gang adverse peut attaquer tes zones tenues. Tes agents défendent automatiquement.<br><br>
        <strong>Slots d'agents</strong> — Améliore la zone pour augmenter le nombre d'agents assignables.<br><br>
        <span class="dim">Une zone fermée avec un bon agent est souvent plus efficace qu'une zone ouverte sans attention.</span>
      `
    },
    tabMarket: {
      title: '💰 MARCHÉ',
      body: `
        <strong>Quêtes horaires</strong> — 3 Moyennes + 2 Difficiles, réinitialisées chaque heure. Reroll possible contre 10 REP.<br><br>
        <strong>Objectifs de session</strong> — Quêtes courtes actives pendant ta session. Récompenses immédiates.<br><br>
        <strong>Balls</strong> — Chaque type améliore le potentiel max des captures. Poké Ball → Super → Hyper → Master Ball (probabiliste pour les légendaires).<br><br>
        <strong>Boosts temporaires</strong> — Activés depuis le Sac dans la fenêtre de zone. Durée 60–120s. Double XP, double loot, radar shiny…<br><br>
        <strong>Achats spéciaux</strong> — Déblocables à la réputation : auto-vente, cosmétiques, slots supplémentaires.<br><br>
        <span class="dim">Vends des Pokémon depuis le PC pour financer tes achats. Les rares et ★5 valent beaucoup plus.</span>
      `
    },
    tabPC: {
      title: '💻 PC',
      body: `
        <strong>Potentiel ★</strong> — Permanent. Détermine le plafond de puissance du Pokémon. ★5 = tier S. Dépend de la Ball utilisée à la capture.<br><br>
        <strong>Nature</strong> — Chaque nature multiplie 2 stats et en pénalise 1. <em>Hardy</em> = neutre. Impacte ATK, DEF, SPD.<br><br>
        <strong>Évolution</strong> — Via le Labo. Certaines évolutions nécessitent un niveau minimum, d'autres une pierre. Les stats augmentent significativement.<br><br>
        <strong>Pension</strong> — 2 Pokémon compatibles produisent un œuf (incubateur requis). L'œuf hérite du potentiel des parents.<br><br>
        <strong>Salle d'entraînement</strong> — Monte en niveau des Pokémon passifs. Coût en ₽ croissant avec le niveau.<br><br>
        <strong>Vente</strong> — Prix = rareté × potentiel × nature. Pas de malus à la revente.<br><br>
        <span class="dim">Filtre par rareté, type ou ★ pour retrouver tes meilleurs Pokémon rapidement.</span>
      `
    },
    tabPokedex: {
      title: '📖 POKÉDEX',
      body: `
        <strong>Vu 👁</strong> — Ce Pokémon est apparu dans une zone (spawn visible ou background).<br><br>
        <strong>Capturé ✓</strong> — Tu en possèdes au moins un dans ton PC.<br><br>
        <strong>Shiny ✨</strong> — Version chromatique capturée. Chance de base très faible — boostée par les atouts Radar Shiny et les boosts temporaires.<br><br>
        <strong>Progression</strong> — Compléter le Pokédex Kanto donne des REP et débloques. Gen 2 (Johto) débloquée à haut niveau de réputation.<br><br>
        <strong>Stats du joueur</strong> — Capture assez de Pokémon d'une espèce pour débloquer des bonus permanents (via le Pokédex étendu).<br><br>
        <span class="dim">Légendaires et très rares n'apparaissent que dans des zones spécifiques à haute maîtrise.</span>
      `
    },
  };

  const info = INFO[tabId];
  if (!info) return;

  document.getElementById('infoModalTitle').textContent = info.title;
  document.getElementById('infoModalBody').innerHTML = info.body;
  document.getElementById('infoModal').classList.add('active');
}



function openImportPreviewModal(raw) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:20000;display:flex;align-items:center;justify-content:center;padding:16px';

  // ── Analyse de la save importée ──────────────────────────────────────────
  const schemaVer   = raw._schemaVersion ?? raw.version ?? '?';
  const isLegacy    = !raw.eggs || !raw.pension || !raw.trainingRoom;
  const isVeryOld   = !raw.gang || !raw.pokemons;
  const gangName    = raw.gang?.name    ?? '—';
  const bossName    = raw.gang?.bossName ?? '—';
  const reputation  = (raw.gang?.reputation ?? 0).toLocaleString();
  const money       = (raw.gang?.money ?? 0).toLocaleString();
  const pokeCount   = (raw.pokemons  || []).length;
  const agentCount  = (raw.agents    || []).length;
  const _dexRaw     = raw.pokedex || {};
  const dexKanto    = POKEMON_GEN1.filter(s => !s.hidden && s.dex >= 1 && s.dex <= 151 && _dexRaw[s.en]?.caught).length;
  const dexCaught   = POKEMON_GEN1.filter(s => !s.hidden && _dexRaw[s.en]?.caught).length;
  const shinyCount  = POKEMON_GEN1.filter(s => !s.hidden && _dexRaw[s.en]?.shiny).length;
  const savedAt     = raw._savedAt ? new Date(raw._savedAt).toLocaleString('fr-FR') : '—';
  const playtime    = raw.playtime  ? formatPlaytime(raw.playtime) : '—';

  // ── Liste des champs qui seront ajoutés/migrés ───────────────────────────
  const migrations = [];
  if (!raw.eggs)             migrations.push('Système d\'œufs');
  if (!raw.pension)          migrations.push('Pension');
  if (!raw.trainingRoom)     migrations.push('Salle d\'entraînement');
  if (!raw.missions)         migrations.push('Missions');
  if (!raw.cosmetics)        migrations.push('Cosmétiques');
  if (!raw.unlockedTitles)   migrations.push('Titres débloqués');
  if (raw.gang?.titleC === undefined) migrations.push('Slots de titres (×4)');
  if (!raw.behaviourLogs)    migrations.push('Logs comportementaux');
  if (!raw.lab)              migrations.push('Laboratoire');
  if (!raw.purchases)        migrations.push('Achats spéciaux');
  if (!raw.eggs && !raw.inventory?.incubator) migrations.push('Inventaire incubateurs');
  if (raw.settings?.uiScale === undefined) migrations.push('Paramètres UI avancés');

  const migHtml = migrations.length
    ? migrations.map(m => `<div style="display:flex;gap:6px;align-items:center;font-size:8px;color:var(--text-dim)"><span style="color:var(--green)">✓</span>${m}</div>`).join('')
    : '<div style="font-size:8px;color:var(--green)">Aucune migration nécessaire — save à jour</div>';

  const versionBadge = isLegacy
    ? `<span style="font-size:7px;padding:2px 6px;border-radius:8px;background:rgba(255,160,0,.15);border:1px solid #ffa000;color:#ffa000">Version ancienne</span>`
    : `<span style="font-size:7px;padding:2px 6px;border-radius:8px;background:rgba(0,200,100,.1);border:1px solid var(--green);color:var(--green)">Format compatible</span>`;

  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:24px;max-width:620px;width:100%;max-height:90vh;overflow-y:auto;display:flex;flex-direction:column;gap:16px">

      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-family:var(--font-pixel);font-size:11px;color:var(--gold)">📥 Importer une Save</div>
        <button id="btnImportClose" style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer">✕</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">

        <!-- Infos save importée -->
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim)">SAVE IMPORTÉE</div>
            ${versionBadge}
          </div>
          <div style="font-family:var(--font-pixel);font-size:12px;color:var(--red)">${gangName}</div>
          <div style="font-size:9px;color:var(--text-dim)">Boss : <span style="color:var(--text)">${bossName}</span></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:4px">
            <div style="font-size:8px;color:var(--text-dim)">🎯 Pokémon <span style="color:var(--text)">${pokeCount}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">👤 Agents <span style="color:var(--text)">${agentCount}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">⭐ Rép. <span style="color:var(--gold)">${reputation}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">₽ <span style="color:var(--text)">${money}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">📖 Kanto <span style="color:var(--text)">${dexKanto}/${getKantoDexSize()}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">🌐 National <span style="color:var(--text)">${dexCaught}/${getNationalDexSize()}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">✨ Espèces chromas <span style="color:var(--text)">${shinyCount}</span></div>
          </div>
          <div style="font-size:7px;color:var(--text-dim);border-top:1px solid var(--border);padding-top:6px;margin-top:2px">
            Sauvegardé le ${savedAt}<br>Temps de jeu : ${playtime} · Schéma v${schemaVer}
          </div>
        </div>

        <!-- Champs à migrer -->
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;gap:6px">
          <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:4px">MIGRATION AUTOMATIQUE</div>
          ${migHtml}
        </div>
      </div>

      <!-- Avertissement écrasement -->
      <div style="background:rgba(204,51,51,.08);border:1px solid rgba(204,51,51,.3);border-radius:var(--radius-sm);padding:10px;font-size:9px;color:var(--text-dim)">
        ⚠ <b style="color:var(--red)">Import complet</b> : remplacera définitivement la save active (slot ${getActiveSaveSlot() + 1}).
        Exporte d'abord ta save actuelle si tu veux la conserver.
      </div>

      <div style="display:flex;flex-direction:column;gap:8px">
        <button id="btnImportBackupFirst" style="font-family:var(--font-pixel);font-size:8px;padding:8px 12px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer;text-align:left">
          💾 Exporter ma save actuelle avant d'importer
        </button>
        <div style="display:flex;gap:8px">
          <button id="btnImportFull" style="flex:2;font-family:var(--font-pixel);font-size:9px;padding:12px;background:var(--bg);border:2px solid var(--gold);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">
            ⚡ Import complet<br><span style="font-size:7px;color:var(--text-dim);font-family:sans-serif">Tous les données migrées automatiquement</span>
          </button>
          ${isLegacy ? `<button id="btnImportHeritage" style="flex:1;font-family:var(--font-pixel);font-size:9px;padding:12px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
            🏆 Mode héritage<br><span style="font-size:7px;font-family:sans-serif">1 agent + 2 Pokémon</span>
          </button>` : ''}
        </div>
        <button id="btnImportCancel" style="font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
          Annuler
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#btnImportClose')?.addEventListener('click',  () => overlay.remove());
  overlay.querySelector('#btnImportCancel')?.addEventListener('click', () => overlay.remove());

  overlay.querySelector('#btnImportBackupFirst')?.addEventListener('click', () => {
    exportSave();
    overlay.querySelector('#btnImportBackupFirst').textContent = '✅ Save actuelle exportée !';
    overlay.querySelector('#btnImportBackupFirst').style.color = 'var(--green)';
  });

  overlay.querySelector('#btnImportFull')?.addEventListener('click', () => {
    showConfirm(
      `Remplacer la save du slot ${getActiveSaveSlot() + 1} par la save importée de "${gangName}" ?`,
      () => {
        try {
          setState(migrate(raw));
          saveState();
          overlay.remove();
          renderAll();
          notify(`✅ Save de "${gangName}" importée et convertie au format actuel.`, 'success');
        } catch (err) {
          notify('Erreur lors de la conversion — save non-importée.', 'error');
          console.error(err);
        }
      },
      null,
      { confirmLabel: 'Importer', cancelLabel: 'Annuler' }
    );
  });

  overlay.querySelector('#btnImportHeritage')?.addEventListener('click', () => {
    overlay.remove();
    openLegacyImportModal(raw);
  });
}



function openLegacyImportModal(legacyData) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';

  const agents = legacyData.agents || [];
  const pokemons = legacyData.pokemons || [];

  const agentHtml = agents.length
    ? agents.map(a => `<label style="display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid var(--border);cursor:pointer">
        <input type="radio" name="legacyAgent" value="${a.id}" style="accent-color:var(--gold)">
        <img src="${a.sprite || ''}" style="width:32px;height:32px" onerror="this.style.display='none'">
        <span style="font-size:10px">${a.name} — Lv.${a.level} (${getAgentRankLabel?.(a) ?? a.title})</span>
      </label>`).join('')
    : '<div style="color:var(--text-dim);font-size:10px;padding:8px">Aucun agent dans cette save</div>';

  const pokeHtml = pokemons.slice(0, 60).map(p => `<label style="display:flex;align-items:center;gap:6px;padding:4px;border-bottom:1px solid var(--border);cursor:pointer">
      <input type="checkbox" name="legacyPoke" value="${p.id}" style="accent-color:var(--gold)">
      <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:28px;height:28px">
      <span style="font-size:9px">${speciesName(p.species_en)} Lv.${p.level} ${'*'.repeat(p.potential)}${p.shiny?' [S]':''}</span>
    </label>`).join('') || '<div style="color:var(--text-dim);font-size:10px">Aucun Pokémon</div>';

  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto">
      <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold);margin-bottom:8px">IMPORT HERITAGE</div>
      <div style="font-size:10px;color:var(--text-dim);margin-bottom:16px">
        Save d'une version antérieure détectée. Tu peux conserver <b style="color:var(--text)">1 agent</b> et <b style="color:var(--text)">2 Pokémon</b>.<br>
        Les 2 Pokémon seront placés à la Pension pour pondre un oeuf de départ.
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:8px">CHOISIR 1 AGENT</div>
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:200px;overflow-y:auto">${agentHtml}</div>
        </div>
        <div>
          <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:8px">CHOISIR 2 POKEMON</div>
          <div id="legacyPokeCount" style="font-size:9px;color:var(--red);margin-bottom:4px">0/2 sélectionnés</div>
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:200px;overflow-y:auto">${pokeHtml}</div>
        </div>
      </div>

      <div style="margin-top:16px;display:flex;gap:8px">
        <button id="btnLegacyConfirm" style="flex:1;font-family:var(--font-pixel);font-size:10px;padding:10px;background:var(--bg);border:2px solid var(--gold);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">COMMENCER</button>
        <button id="btnLegacyCancel" style="font-family:var(--font-pixel);font-size:10px;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Limit pokemon checkboxes to 2
  overlay.querySelectorAll('input[name="legacyPoke"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const checked = [...overlay.querySelectorAll('input[name="legacyPoke"]:checked')];
      const countEl = document.getElementById('legacyPokeCount');
      if (checked.length > 2) { cb.checked = false; return; }
      if (countEl) countEl.textContent = `${checked.length}/2 sélectionnés`;
    });
  });

  document.getElementById('btnLegacyCancel')?.addEventListener('click', () => overlay.remove());

  document.getElementById('btnLegacyConfirm')?.addEventListener('click', () => {
    const agentId = overlay.querySelector('input[name="legacyAgent"]:checked')?.value;
    const pokeIds = [...overlay.querySelectorAll('input[name="legacyPoke"]:checked')].map(cb => cb.value);

    if (pokeIds.length !== 2) {
      notify('Sélectionne exactement 2 Pokémon.'); return;
    }

    // Build fresh state
    const fresh = createDefaultState();
    // Transfer gang basics from legacy
    fresh.gang.name = legacyData.gang?.name || 'La Gang';
    fresh.gang.bossName = legacyData.gang?.bossName || 'Boss';
    fresh.gang.bossSprite = legacyData.gang?.bossSprite || 'rocketgrunt';

    // Transfer chosen agent
    if (agentId) {
      const agent = agents.find(a => a.id === agentId);
      if (agent) {
        agent.team = []; // reset team
        agent.pendingPerk = false;
        fresh.agents = [agent];
      }
    }

    // Transfer chosen pokemon to pension
    const chosenPokes = pokeIds.map(id => pokemons.find(p => p.id === id)).filter(Boolean);
    chosenPokes.forEach(p => { p.homesick = true; });
    fresh.pokemons = chosenPokes;
    fresh.pension.slots = chosenPokes.slice(0, 2).map(p => p.id);
    fresh.pension.eggAt = Date.now() + 60000; // first egg in 1 minute

    setState(migrate(fresh));
    saveState();
    overlay.remove();
    renderAll();
    notify('Nouvelle partie héritée commencée ! Les Pokémon sont à la Pension.', 'gold');
    switchTab('tabPC');
  });
}



function openHubImportModal(raw) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';

  // ── Save preview data ────────────────────────────────────────────────────
  const gangName    = raw.gang?.name     ?? '—';
  const bossName    = raw.gang?.bossName ?? '—';
  const reputation  = (raw.gang?.reputation ?? 0).toLocaleString();
  const money       = (raw.gang?.money ?? 0).toLocaleString();
  const pokeCount   = (raw.pokemons  || []).length;
  const count4star  = (raw.pokemons  || []).filter(p => p.potential === 4).length;
  const count4shiny = (raw.pokemons  || []).filter(p => p.potential === 4 && p.shiny).length;
  const agentCount  = (raw.agents    || []).length;
  const rawDex      = raw.pokedex || {};
  const dexKanto    = POKEMON_GEN1.filter(s => !s.hidden && s.dex >= 1 && s.dex <= 151 && rawDex[s.en]?.caught).length;
  const dexNat      = POKEMON_GEN1.filter(s => !s.hidden && rawDex[s.en]?.caught).length;
  const shinyCount  = POKEMON_GEN1.filter(s => !s.hidden && rawDex[s.en]?.shiny).length;
  const savedAt     = raw._savedAt ? new Date(raw._savedAt).toLocaleString('fr-FR') : '—';
  const playtime    = raw.playtime  ? formatPlaytime(raw.playtime) : '—';
  const schemaVer   = raw._schemaVersion ?? raw.version ?? '?';

  // Detect potential orphan zones
  const validIds = new Set(ZONES.map(z => z.id));
  const orphanZones = Object.keys(raw.zones || {}).filter(id => !validIds.has(id));

  // ── Slot picker HTML ─────────────────────────────────────────────────────
  const slotHtml = [0, 1, 2].map(i => {
    const prev = getSlotPreview(i);
    const label = prev
      ? `<b style="color:var(--text)">${prev.name}</b> <span style="color:var(--text-dim);font-size:9px">(${prev.pokemon} pkm · ⭐${prev.rep})</span>`
      : `<span style="color:#555;font-style:italic">Vide</span>`;
    return `<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;background:var(--bg);transition:border-color .15s" id="hubSlotLabel${i}">
      <input type="radio" name="hubTargetSlot" value="${i}" ${i === 0 ? 'checked' : ''} style="accent-color:var(--gold)">
      <span style="font-family:var(--font-pixel);font-size:8px;color:var(--gold)">SLOT ${i+1}</span>
      <span style="font-size:10px">${label}</span>
    </label>`;
  }).join('');

  // ── Warnings ─────────────────────────────────────────────────────────────
  const warnMutation = count4star > 0
    ? `<span style="color:#ffa040">${count4star} Pokémon 4★ détectés${count4shiny > 0 ? ` (dont ${count4shiny} ✨ shiny)` : ''} — tous passeront en 5★</span>`
    : `<span style="color:var(--text-dim)">Aucun Pokémon 4★ détecté</span>`;
  const warnClean = orphanZones.length > 0
    ? `<span style="color:#ffa040">${orphanZones.length} zone(s) obsolète(s) supprimée(s)</span>`
    : `<span style="color:var(--text-dim)">Aucune zone obsolète</span>`;

  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid #ffa040;border-radius:var(--radius);padding:24px;max-width:640px;width:100%;max-height:92vh;overflow-y:auto;display:flex;flex-direction:column;gap:16px">

      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-family:var(--font-pixel);font-size:11px;color:#ffa040">📥 Importer une Save</div>
        <button id="btnHubImportClose" style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer">✕</button>
      </div>

      <!-- Save preview -->
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;gap:6px">
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:4px">SAVE IMPORTÉE</div>
        <div style="font-family:var(--font-pixel);font-size:13px;color:var(--red)">${gangName}</div>
        <div style="font-size:9px;color:var(--text-dim)">Boss : <span style="color:var(--text)">${bossName}</span></div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:4px">
          <div style="font-size:8px;color:var(--text-dim)">🎯 Pokémon <span style="color:var(--text)">${pokeCount}</span></div>
          <div style="font-size:8px;color:var(--text-dim)">👤 Agents <span style="color:var(--text)">${agentCount}</span></div>
          <div style="font-size:8px;color:var(--text-dim)">⭐ Rép. <span style="color:var(--gold)">${reputation}</span></div>
          <div style="font-size:8px;color:var(--text-dim)">₽ <span style="color:var(--text)">${money}</span></div>
          <div style="font-size:8px;color:var(--text-dim)">📖 Pokédex Kanto <span style="color:var(--text)">${dexKanto}/151</span> <span style="opacity:.6">(Nat. ${dexNat})</span></div>
          <div style="font-size:8px;color:var(--text-dim)">✨ Espèces chroma <span style="color:var(--text)">${shinyCount}</span></div>
        </div>
        <div style="font-size:7px;color:var(--text-dim);border-top:1px solid var(--border);padding-top:6px;margin-top:2px">
          Sauvegardé le ${savedAt} · Temps de jeu : ${playtime} · Schéma v${schemaVer}
        </div>
      </div>

      <!-- Slot picker -->
      <div>
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold);margin-bottom:8px;letter-spacing:1px">SLOT DE DESTINATION</div>
        <div style="display:flex;flex-direction:column;gap:6px" id="hubSlotPicker">
          ${slotHtml}
        </div>
      </div>

      <!-- Options -->
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold);letter-spacing:1px">OPTIONS D'IMPORT</div>

        <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);cursor:pointer">
          <input type="checkbox" id="chkAutoMutation" ${count4star > 0 ? 'checked' : ''} style="margin-top:2px;accent-color:var(--gold)">
          <div>
            <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text);margin-bottom:3px">⚡ Mutation auto 4★ → 5★</div>
            <div style="font-size:9px;color:var(--text-dim)">Améliore tous les Pokémon 4★ en 5★ automatiquement.<br>Priorité : ✨ shiny → niveau → ordre PC. Les shinys ne seront jamais utilisés comme matière première.</div>
            <div style="font-size:8px;margin-top:4px">${warnMutation}</div>
          </div>
        </label>

        <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);cursor:pointer">
          <input type="checkbox" id="chkCleanObsolete" ${orphanZones.length > 0 ? 'checked' : ''} style="margin-top:2px;accent-color:var(--gold)">
          <div>
            <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text);margin-bottom:3px">🧹 Nettoyage des données obsolètes</div>
            <div style="font-size:9px;color:var(--text-dim)">Supprime les zones, états et environnements qui n'existent plus dans la version actuelle du jeu.<br>Ces données seront remplacées par <i>"information perdue avec le temps"</i>.</div>
            <div style="font-size:8px;margin-top:4px">${warnClean}</div>
          </div>
        </label>
      </div>

      <!-- Warning -->
      <div style="background:rgba(255,140,0,.08);border:1px solid rgba(255,140,0,.3);border-radius:var(--radius-sm);padding:10px;font-size:9px;color:var(--text-dim)">
        ⚠ Le slot de destination sera <b style="color:#ffa040">écrasé</b>. Exporte ta save actuelle si tu veux la conserver.
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:8px">
        <button id="btnHubImportBackup" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:10px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
          💾 Exporter ma save actuelle
        </button>
        <button id="btnHubImportConfirm" style="flex:2;font-family:var(--font-pixel);font-size:9px;padding:10px;background:var(--bg);border:2px solid #ffa040;border-radius:var(--radius-sm);color:#ffa040;cursor:pointer">
          📥 Importer dans ce slot
        </button>
      </div>
      <button id="btnHubImportCancel" style="font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
        Annuler
      </button>

    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#btnHubImportClose')?.addEventListener('click',  () => overlay.remove());
  overlay.querySelector('#btnHubImportCancel')?.addEventListener('click', () => overlay.remove());

  // Slot label hover effect
  overlay.querySelectorAll('#hubSlotPicker label').forEach(lbl => {
    lbl.addEventListener('mouseenter', () => lbl.style.borderColor = '#ffa040');
    lbl.addEventListener('mouseleave', () => lbl.style.borderColor = 'var(--border)');
  });

  overlay.querySelector('#btnHubImportBackup')?.addEventListener('click', () => {
    exportSave();
    const btn = overlay.querySelector('#btnHubImportBackup');
    btn.textContent = '✅ Save exportée !';
    btn.style.color = 'var(--green)';
  });

  overlay.querySelector('#btnHubImportConfirm')?.addEventListener('click', () => {
    const targetSlot = parseInt(overlay.querySelector('input[name="hubTargetSlot"]:checked')?.value ?? '0');
    const doMutation = overlay.querySelector('#chkAutoMutation')?.checked ?? false;
    const doClean    = overlay.querySelector('#chkCleanObsolete')?.checked ?? false;

    showConfirm(
      `Importer la save de <b>${gangName}</b> dans le Slot ${targetSlot + 1} ?<br><span style="color:var(--text-dim);font-size:10px">Le contenu actuel du slot sera effacé.</span>`,
      () => {
        try {
          // Deep clone before mutation
          const draft = JSON.parse(JSON.stringify(raw));

          // Apply optional steps before migration
          let mutated = 0, cleaned = 0;
          if (doMutation && draft.pokemons) mutated = applyAutoMutation(draft.pokemons);
          if (doClean)                      cleaned  = cleanObsoleteData(draft);

          // Full migration to current schema
          const migrated = migrate(draft);

          // Add cleaned-zone log if relevant
          if (doClean && cleaned > 0) {
            if (!migrated.behaviourLogs) migrated.behaviourLogs = {};
            migrated.behaviourLogs._importCleanedZones = cleaned;
            // Add a visible log to pokedex area isn't natural — add a note to notifications array if present
            if (!migrated._importNotes) migrated._importNotes = [];
            migrated._importNotes.push(`information perdue avec le temps (${cleaned} zone(s) obsolète(s) supprimée(s))`);
          }

          // Save to the target slot (don't affect current active game)
          localStorage.setItem(getSaveKeys()[targetSlot], JSON.stringify(migrated));

          overlay.remove();

          // Compose summary message
          const parts = [`✅ Save de "${gangName}" importée dans le Slot ${targetSlot + 1}.`];
          if (mutated > 0) parts.push(`⚡ ${mutated} Pokémon 4★ → 5★.`);
          if (cleaned > 0) parts.push(`🧹 ${cleaned} zone(s) obsolète(s) supprimée(s).`);
          parts.push('Clique ▶ sur le slot pour jouer.');
          notify(parts.join(' '), 'success');

          // Refresh hub slot display if introOverlay is visible
          const introSlots = document.getElementById('introSlots');
          if (introSlots) {
            // Re-trigger showIntro rendering by dispatching a custom event, or simply reload slots
            // We call the global renderSlots if accessible — it's locally scoped, so refresh the overlay
            const introOverlay = document.getElementById('introOverlay');
            if (introOverlay?.classList.contains('active')) {
              // Remove active class to reset, then re-show
              introOverlay.classList.remove('active');
              showIntro();
            }
          }
        } catch (err) {
          notify('Erreur lors de l\'importation — save non modifiée.', 'error');
          console.error(err);
        }
      },
      null,
      { confirmLabel: 'Importer', cancelLabel: 'Annuler' }
    );
  });
}



function showMigrationBanner({ from, toLegacyKey, fields }) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:12000;
    display:flex;align-items:center;justify-content:center;padding:16px;
    animation:fadeIn .3s ease
  `;
  const fieldsHtml = fields.length
    ? `<ul style="margin:8px 0 0 0;padding-left:18px;font-size:9px;color:var(--text-dim);line-height:1.8">
        ${fields.map(f => `<li>${f}</li>`).join('')}
      </ul>`
    : '';
  const legacyNote = toLegacyKey
    ? `<div style="margin-top:8px;font-size:9px;color:var(--red);background:rgba(255,0,0,.07);padding:6px 8px;border-radius:4px;border-left:2px solid var(--red)">
        ⚠ Ancienne sauvegarde détectée (<code style="font-size:9px">${toLegacyKey}</code>).<br>
        Convertie et transférée vers le slot actuel. L'ancienne clé a été supprimée.
      </div>`
    : '';

  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);
                padding:22px 24px;max-width:420px;width:100%;box-shadow:0 8px 40px rgba(0,0,0,.6)">
      <div style="font-family:var(--font-pixel);font-size:11px;color:var(--gold);margin-bottom:4px">
        🔄 SAVE MISE À JOUR
      </div>
      <div style="font-size:10px;color:var(--text-dim);margin-bottom:4px">
        Depuis : <span style="color:var(--text)">${from}</span> →
        schéma <span style="color:var(--gold)">v${getSaveSchemaVersion()}</span>
      </div>
      ${fields.length ? `<div style="font-size:9px;color:var(--text-dim);margin-top:6px">Nouveaux éléments ajoutés :</div>${fieldsHtml}` : ''}
      ${legacyNote}
      <div style="margin-top:8px;font-size:9px;color:var(--text-dim)">
        Ta progression, Pokémon et argent sont intacts. ✅
      </div>
      <div style="margin-top:16px;text-align:right">
        <button id="btnMigrationOk" class="btn-gold" style="padding:6px 20px;font-size:10px">
          OK, continuer →
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#btnMigrationOk').addEventListener('click', () => {
    overlay.remove();
    saveState(); // persiste le nouveau schéma
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}



export {
  configureModals,
  openHubImportModal,
  openImportPreviewModal,
  openLegacyImportModal,
  showConfirm,
  showInfoModal,
  showMigrationBanner,
};
