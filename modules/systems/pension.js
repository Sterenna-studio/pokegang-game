import { EventBus, EVENTS } from '../core/eventBus.js';
import { PENSION_SHINY_RATE_NONE, PENSION_SHINY_RATE_ONE, PENSION_SHINY_RATE_BOTH } from '../../data/gameplay-config-data.js';
import {
  getIncubationConfig,
  getEggIncubationAgent,
  getEggIncubationSummary,
  markEggsReady,
  recordEggHatched,
  reconcileEggIncubationAssignments,
  setEggIncubationPriority,
  startEggIncubation,
} from './eggIncubation.js';
import { NURSE_JOY_PRICE } from '../../data/economy-data.js';
import { EGG_GEN_MS, EGG_STOCK_CAP, PAIR_PRICES, MAX_PAIRS, getMaxPensionPairs, getNextPairPrice, reconcilePensionPairs, removeFromPension } from './pensionPairs.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY,        { msg, type });
const _dirty  = ()               => EventBus.emit(EVENTS.STATE_DIRTY);
const _topBar = ()               => EventBus.emit(EVENTS.UI_TOPBAR_UPDATE);
const _save   = ()               => globalThis.saveState?.();
const _t      = (fr, en)         => (globalThis.state?.lang === 'en' ? en : fr);
const _esc    = s => String(s ?? '').replace(/[&<>"']/g, ch => (
  ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;'
));

// ════════════════════════════════════════════════════════════════
// pension.js — Pension & Eggs system
// Dependencies (globalThis): state, saveState, notify, speciesName,
//   pokeSprite, eggSprite, eggImgTag, EGG_SPRITES, tryAutoIncubate,
//   makePokemon, calculateStats, calculatePrice, getBaseSpecies, getPokemonPower,
//   removePokemonFromAllAssignments, getMaxPensionSlots, getPensionSlotIds,
//   showConfirm, updateTopBar, activeTab, renderPCTab, switchTab, addLog,
//   trainerSprite, SPECIES_BY_EN, EGG_HATCH_MS (re-exported below),
//   BASE_PRICE, POTENTIAL_MULT, ITEM_SPRITE_URLS
// ════════════════════════════════════════════════════════════════

let _pensionSearch = '';

const EGG_HATCH_MS = {
  common:    1 * 60 * 1000,
  uncommon:  5 * 60 * 1000,
  rare:      15 * 60 * 1000,
  very_rare: 45 * 60 * 1000,
  legendary: 60 * 60 * 1000,
};
// ── Œufs : un minuteur par couple, stock plafonné ───────────────
function _createEgg(pkA, pkB, now) {
  const state = globalThis.state;
  const isLegA = SPECIES_BY_EN[pkA.species_en]?.rarity === 'legendary';
  const isLegB = SPECIES_BY_EN[pkB.species_en]?.rarity === 'legendary';
  if (isLegA && isLegB) return null;
  const parent = isLegA ? pkB : isLegB ? pkA : (Math.random() < 0.5 ? pkA : pkB);
  const baseSpeciesEn = getBaseSpecies(parent.species_en);
  const sp = SPECIES_BY_EN[baseSpeciesEn];
  if (!sp || EGG_HATCH_MS[sp.rarity] === null) return null;
  const avgPot = Math.floor((pkA.potential + pkB.potential) / 2);
  const potential = Math.min(5, avgPot + (Math.random() < 0.2 ? 1 : 0));
  const shinyChance = (pkA.shiny && pkB.shiny) ? PENSION_SHINY_RATE_BOTH : (pkA.shiny || pkB.shiny) ? PENSION_SHINY_RATE_ONE : PENSION_SHINY_RATE_NONE;
  const egg = {
    id: `egg_${now}_${Math.random().toString(36).slice(2, 7)}`,
    species_en: baseSpeciesEn,
    hatchAt: null,
    // Durée de couvaison fixée par la rareté : sans elle, l'auto-incubation retombait sur 45 min.
    hatchMs: EGG_HATCH_MS[sp.rarity],
    incubating: false,
    rarity: sp.rarity,
    potential,
    shiny: Math.random() < shinyChance,
    parentA: pkA.species_en,
    parentB: pkB.species_en,
  };
  state.eggs.push(egg);
  return egg;
}

// Joëlle (option « éclosion auto ») ouvre elle-même les œufs déposés à la base.
function _autoHatchReadyEggs() {
  const state = globalThis.state;
  if (!state.purchases?.autoIncubator || state.purchases.autoHatchEggs !== true) return;
  const ready = state.eggs.filter(e => e.status === 'ready');
  if (!ready.length) return;
  let hatched = 0, sold = 0;
  for (const egg of ready) {
    const pk = _hatchEggSilent(egg);
    if (!pk) continue;
    hatched++;
    if (_autoSellHatched(pk)) sold++;
  }
  if (!hatched) return;
  _save();
  if (sold > 0) _topBar();
  _notify(_t(`💉 Joëlle a fait éclore ${hatched} œuf${hatched > 1 ? 's' : ''}${sold ? ` (${sold} vendu${sold > 1 ? 's' : ''})` : ''}.`,
    `💉 Joy hatched ${hatched} egg${hatched > 1 ? 's' : ''}${sold ? ` (${sold} sold)` : ''}.`), 'gold');
}

function pensionTick() {
  const state = globalThis.state;
  const p = state.pension;
  const now = Date.now();

  reconcilePensionPairs(state, now);
  let produced = 0;
  let dirty = false;

  const nurseHired = !!state.purchases?.autoIncubator;
  for (const pair of nurseHired ? p.pairs : []) {
    if (!pair.a || !pair.b || !pair.eggAt || now < pair.eggAt) continue;
    // Stock plein : la production attend (l'œuf est dû, il sort dès qu'une place se libère).
    if (state.eggs.length >= EGG_STOCK_CAP) break;
    const pkA = state.pokemons.find(pk => pk.id === pair.a);
    const pkB = state.pokemons.find(pk => pk.id === pair.b);
    pair.eggAt = now + EGG_GEN_MS;
    dirty = true;
    if (pkA && pkB && _createEgg(pkA, pkB, now)) produced++;
  }
  if (produced > 0) {
    notify(_t(
      produced > 1 ? `${produced} œufs sont apparus à la pension !` : 'Un œuf est apparu à la pension !',
      produced > 1 ? `${produced} eggs appeared at the Daycare!` : 'An egg appeared at the Daycare!',
    ), 'gold');
  }
  reconcilePensionPairs(state, now);   // met à jour le miroir p.eggAt

  // Les œufs arrivés à terme sont déposés à la base par leur agent.
  const delivered = markEggsReady(state, now);
  if (delivered > 0) {
    dirty = true;
    notify(_t(
      `${delivered > 1 ? `${delivered} œufs ont été déposés` : 'Un œuf a été déposé'} à la base !`,
      `${delivered > 1 ? `${delivered} eggs were` : 'An egg was'} dropped off at the base!`,
    ), 'gold');
  }

  // Les agents sans œuf vont en chercher un à la pension.
  const before = getEggIncubationSummary(state).used;
  globalThis.tryAutoIncubate?.({ silent: true });
  if (getEggIncubationSummary(state).used !== before) dirty = true;

  _autoHatchReadyEggs();

  if (dirty) saveState();
  if ((produced > 0 || delivered > 0) && activeTab === 'tabPC') renderPCTab();
  // La pile « à éclore » de l'agent apparaît dès la livraison.
  if (delivered > 0 && activeTab === 'tabAgents') globalThis.renderAgentsTab?.();
}

// ── Silent batch-hatch helper (no animation — used by multi-hatch popup) ──
function _hatchEggSilent(egg) {
  const state = globalThis.state;
  const now = Date.now();
  const baseEn = getBaseSpecies(egg.species_en);
  const sp = SPECIES_BY_EN[baseEn];
  if (!sp) return null;
  const hatched = makePokemon(baseEn, 'pension', 'pokeball');
  if (!hatched) return null;
  hatched.level = 1;
  hatched.xp = 0;
  hatched.potential = egg.potential;
  hatched.shiny = egg.shiny;
  hatched.stats = calculateStats(hatched);
  hatched.history = [{ type: 'hatched', ts: now }];
  state.pokemons.push(hatched); _dirty();
  EventBus.emit(EVENTS.POKEMON_CAPTURED, { pokemon: hatched, zoneId: 'pension', source: 'hatch' });
  state.stats.totalCaught++;
  state.stats.eggsHatched = (state.stats.eggsHatched || 0) + 1;
  recordEggHatched(egg, state);
  if (hatched.shiny) state.stats.shinyCaught++;
  globalThis.registerPokedexCapture?.(state, hatched);
  // Fabric BG unlock
  globalThis._unlockFabricBg?.(hatched.dex, hatched.shiny);
  state.eggs = state.eggs.filter(e => e.id !== egg.id);
  return hatched;
}

// ── Auto-sell a freshly hatched pokemon if autoSellEggs is active ──
function _autoSellHatched(pokemon) {
  const state = globalThis.state;
  if (!state.purchases?.autoSellEggs) return false;
  if (state.purchases.autoSellEggsEnabled === false) return false;
  if (pokemon.favorite) return false;
  const protected_ = state.settings?.protectedSpecies || [];
  if (protected_.includes(pokemon.species_en)) return false;
  const cfg = state.settings?.autoSellEggs || {};
  if (pokemon.shiny && !cfg.allowShiny) return false;
  if (cfg.mode === 'by_potential') {
    if (!(cfg.potentials || []).includes(pokemon.potential)) return false;
  }
  const price = globalThis.calculatePrice?.(pokemon) || (pokemon.potential * 500);
  const idx = state.pokemons.findIndex(p => p.id === pokemon.id);
  if (idx === -1) return false;
  state.pokemons.splice(idx, 1); _dirty();
  state.gang.money += price;
  state.stats.totalSold = (state.stats.totalSold || 0) + 1;
  state.stats.totalMoneyEarned = (state.stats.totalMoneyEarned || 0) + price;
  EventBus.emit(EVENTS.MONEY_CHANGED, { delta: price, newTotal: state.gang.money });
  EventBus.emit(EVENTS.POKEMON_SOLD, { pokemonIds: [pokemon.id], totalPrice: price });
  globalThis.addLog?.(_t(
    `[Auto-vente œuf] ${globalThis.speciesName(pokemon.species_en)} → ${price.toLocaleString()}₽`,
    `[Egg auto-sell] ${globalThis.speciesName(pokemon.species_en)} → ${price.toLocaleString()}₽`,
  ));
  return true;
}

// ── Multiple hatch popup for ready eggs ─────────────────────────
function openHatchPopup() {
  const state = globalThis.state;
  const readyEggs = state.eggs.filter(e => e.status === 'ready');
  if (readyEggs.length === 0) return;

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center';

  const eggRows = readyEggs.map((egg, i) => {
    const rarity = egg.rarity || SPECIES_BY_EN[egg.species_en]?.rarity || 'common';
    const revealed = egg.revealed;
    const spName = revealed ? speciesName(egg.species_en) : '???';
    const potStr = revealed ? '★'.repeat(egg.potential) : '?';
    const shinyStr = revealed && egg.shiny ? ' ✨' : '';
    const imgTag = globalThis.eggImgTag?.(egg, false, 'width:36px;height:36px;image-rendering:pixelated') || '🥚';
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid var(--border)">
      <input type="checkbox" class="hatch-sel" data-idx="${i}" checked style="width:16px;height:16px;cursor:pointer">
      ${imgTag}
      <div style="flex:1">
        <div style="font-size:10px">${spName} ${potStr}${shinyStr}</div>
        <div style="font-size:8px;color:var(--text-dim)">${rarity}</div>
      </div>
    </div>`;
  }).join('');

  modal.innerHTML = `<div style="background:var(--bg-panel);border:2px solid var(--gold);border-radius:var(--radius);padding:20px;max-width:380px;width:94%;display:flex;flex-direction:column;gap:14px">
    <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">🥚 ${_t('ŒUFS PRÊTS', 'READY EGGS')} (${readyEggs.length})</div>
    <div style="max-height:320px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm)">${eggRows}</div>
    <div style="font-size:9px;color:var(--text-dim)">${_t('Sélectionne les œufs à faire éclore.', 'Select the eggs to hatch.')}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button id="hatchCancel" style="font-family:var(--font-pixel);font-size:9px;padding:8px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">${_t('Annuler', 'Cancel')}</button>
      <button id="hatchConfirm" style="font-family:var(--font-pixel);font-size:9px;padding:8px 14px;background:var(--bg);border:1px solid var(--gold);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">${_t('Faire éclore ✓', 'Hatch ✓')}</button>
    </div>
  </div>`;

  document.body.appendChild(modal);
  modal.querySelector('#hatchCancel').addEventListener('click', () => modal.remove());
  modal.querySelector('#hatchConfirm').addEventListener('click', () => {
    const selected = [...modal.querySelectorAll('.hatch-sel:checked')].map(cb => readyEggs[parseInt(cb.dataset.idx)]);
    if (selected.length === 0) { modal.remove(); return; }
    let hatched = 0, sold = 0;
    for (const egg of selected) {
      const pk = _hatchEggSilent(egg);
      if (pk) {
        hatched++;
        if (_autoSellHatched(pk)) sold++;
      }
    }
    _save();
    if (sold > 0) _topBar();
    let msg = _t(`${hatched} Pokémon ont éclos !`, `${hatched} Pokémon hatched!`);
    if (sold > 0) msg += _t(` (${sold} vendu${sold > 1 ? 's' : ''} automatiquement)`, ` (${sold} automatically sold)`);
    if (hatched > 0) _notify(msg, 'gold');
    modal.remove();
    if (globalThis.activeTab === 'tabPC') globalThis.renderPCTab();
  });
}

// ── Egg-opening popup ───────────────────────────────────────────
// Centred over the whole game. The player taps the egg to crack it: tap 1 shows
// its type, tap 2 its grade (potential), tap 3 opens it and reveals whether it is
// shiny. Progress is kept on the egg (crackStage), so closing early loses nothing.
const _EGG_TYPE_META = {
  Normal: ['Normal', 'Normal', '#a8a878'], Fire: ['Feu', 'Fire', '#f08030'], Water: ['Eau', 'Water', '#6890f0'],
  Grass: ['Plante', 'Grass', '#78c850'], Electric: ['Électrik', 'Electric', '#f8d030'], Ice: ['Glace', 'Ice', '#98d8d8'],
  Fighting: ['Combat', 'Fighting', '#c03028'], Poison: ['Poison', 'Poison', '#a040a0'], Ground: ['Sol', 'Ground', '#e0c068'],
  Flying: ['Vol', 'Flying', '#a890f0'], Psychic: ['Psy', 'Psychic', '#f85888'], Bug: ['Insecte', 'Bug', '#a8b820'],
  Rock: ['Roche', 'Rock', '#b8a038'], Ghost: ['Spectre', 'Ghost', '#705898'], Dragon: ['Dragon', 'Dragon', '#7038f8'],
  Dark: ['Ténèbres', 'Dark', '#705848'], Steel: ['Acier', 'Steel', '#b8b8d0'], Fairy: ['Fée', 'Fairy', '#ee99ac'],
};

function _eggTypeChips(egg) {
  const types = SPECIES_BY_EN[getBaseSpecies(egg.species_en)]?.types || [];
  if (!types.length) return '<span style="color:var(--text-dim)">?</span>';
  return types.map(tp => {
    const meta = _EGG_TYPE_META[tp] || [tp, tp, '#888'];
    return `<span style="display:inline-block;padding:3px 9px;border-radius:10px;background:${meta[2]};color:#111;font-family:var(--font-pixel);font-size:8px">${_t(meta[0], meta[1])}</span>`;
  }).join(' ');
}

const _EGG_CRACKS = [
  '',
  '<polyline points="52,16 46,30 56,40 48,56" />',
  '<polyline points="52,16 46,30 56,40 48,56" /><polyline points="56,38 72,44 78,60" /><polyline points="46,26 30,34 24,52" />',
];

function openEggCrackPopup(egg, { remaining = 0, onNext = null, onDone = null } = {}) {
  const state = globalThis.state;
  if (!egg || egg.status !== 'ready') { onDone?.(); return; }
  document.getElementById('_eggCrackOverlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = '_eggCrackOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9600;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;user-select:none';
  const eggSrc = globalThis.eggSprite?.(egg, false) || '';
  // Le sprite NB est une petite toile à marges larges : on l'agrandit pour que l'œuf remplisse le cadre des fissures.
  const eggArtScale = /_NB\.png/.test(eggSrc) ? 2.3 : 1;
  let stage = Math.max(0, Math.min(2, egg.crackStage || 0));
  let hatched = null;
  let sold = false;
  let busy = false;

  const slot = (label, content, on) => `<div style="flex:1;min-width:84px;text-align:center;padding:8px 6px;border:1px solid ${on ? 'var(--gold)' : 'var(--border)'};border-radius:var(--radius-sm);background:var(--bg-card);opacity:${on ? 1 : .55}">
    <div style="font-size:7px;color:var(--text-dim);margin-bottom:5px;font-family:var(--font-pixel)">${label}</div>
    <div style="min-height:18px;font-size:10px;color:var(--gold)">${on ? content : '?'}</div>
  </div>`;

  function paint(shake) {
    const grade = '★'.repeat(egg.potential || 0) || '–';
    const rarity = egg.rarity || SPECIES_BY_EN[egg.species_en]?.rarity || 'common';
    const shinySlot = hatched
      ? (hatched.shiny ? `<span style="color:#ffcc5a">✨ ${_t('Chromatique !', 'Shiny!')}</span>` : `<span style="color:var(--text-dim)">${_t('Pas chromatique', 'Not shiny')}</span>`)
      : '';
    overlay.innerHTML = `
      <style>
        @keyframes _ecIdle{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
        @keyframes _ecShake{0%{transform:rotate(0) scale(1)}20%{transform:rotate(-9deg) scale(1.08)}45%{transform:rotate(8deg) scale(1.1)}70%{transform:rotate(-5deg) scale(1.05)}100%{transform:rotate(0) scale(1)}}
        @keyframes _ecPop{0%{transform:scale(0) rotate(-12deg);opacity:0}65%{transform:scale(1.18) rotate(3deg);opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}
        @keyframes _ecFlash{0%{opacity:.95}100%{opacity:0}}
      </style>
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:18px;padding:24px 20px;max-width:420px;width:94%">
        <button id="_ecClose" style="position:absolute;top:0;right:4px;background:none;border:none;color:var(--text-dim);font-size:16px;cursor:pointer" aria-label="${_t('Fermer', 'Close')}">✕</button>
        <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold);letter-spacing:2px">${hatched ? _t('ÉCLOS !', 'HATCHED!') : _t('ŒUF PRÊT', 'EGG READY')}${remaining > 0 ? ` · +${remaining}` : ''}</div>
        ${hatched ? `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:8px">
            ${hatched.shiny ? '<div style="position:absolute;inset:-60px;background:radial-gradient(circle,#ffe58a 0%,transparent 65%);animation:_ecFlash 1.4s ease-out forwards;pointer-events:none"></div>' : ''}
            <img src="${globalThis.pokeSprite?.(hatched.species_en, hatched.shiny) || ''}" style="width:128px;height:128px;image-rendering:pixelated;animation:_ecPop .55s ease-out forwards;${hatched.shiny ? 'filter:drop-shadow(0 0 12px #ffcc5a)' : ''}">
            <div style="font-family:var(--font-pixel);font-size:11px;color:var(--text)">${globalThis.speciesName?.(hatched.species_en) || hatched.species_en}</div>
            ${sold ? `<div style="font-size:8px;color:var(--text-dim)">${_t('Vendu automatiquement !', 'Automatically sold!')}</div>` : ''}
          </div>` : `
          <div id="_ecEggWrap" style="position:relative;width:176px;height:176px;cursor:pointer">
            <div style="width:100%;height:100%;transform:scale(${eggArtScale})"><img id="_ecEgg" src="${eggSrc}" style="width:100%;height:100%;object-fit:contain;image-rendering:pixelated;animation:${shake ? '_ecShake .45s ease-out' : '_ecIdle 1.6s ease-in-out infinite'}"></div>
            <svg viewBox="0 0 100 100" style="position:absolute;inset:0;pointer-events:none;fill:none;stroke:#fff8c8;stroke-width:2.2;stroke-linejoin:round;filter:drop-shadow(0 0 2px #000)">${_EGG_CRACKS[stage]}</svg>
          </div>
          <div style="font-size:9px;color:var(--text-dim)">${_t('Clique sur l’œuf pour le craqueler…', 'Tap the egg to crack it…')}</div>`}
        <div style="display:flex;gap:8px;width:100%">
          ${slot(_t('TYPE', 'TYPE'), _eggTypeChips(egg), stage >= 1 || !!hatched)}
          ${slot(_t('GRADE', 'GRADE'), `${grade}<div style="font-size:7px;color:var(--text-dim);margin-top:2px">${rarity}</div>`, stage >= 2 || !!hatched)}
          ${slot(_t('CHROMA', 'SHINY'), shinySlot, !!hatched)}
        </div>
        ${hatched ? `<div style="display:flex;gap:8px">
          ${remaining > 0 ? `<button id="_ecNext" style="font-family:var(--font-pixel);font-size:9px;padding:8px 16px;background:var(--bg);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--green);cursor:pointer">${_t('Œuf suivant', 'Next egg')} ▶</button>` : ''}
          <button id="_ecDone" style="font-family:var(--font-pixel);font-size:9px;padding:8px 16px;background:var(--bg);border:1px solid var(--gold);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">${_t('Fermer', 'Close')}</button>
        </div>` : ''}
      </div>`;
    overlay.querySelector('#_ecClose')?.addEventListener('click', () => finish(false));
    overlay.querySelector('#_ecDone')?.addEventListener('click', () => finish(false));
    overlay.querySelector('#_ecNext')?.addEventListener('click', () => finish(true));
    overlay.querySelector('#_ecEggWrap')?.addEventListener('click', crack);
  }

  function crack() {
    if (busy || hatched) return;
    if (stage < 2) {
      stage++;
      egg.crackStage = stage;
      _dirty();
      paint(true);
      return;
    }
    // 3rd tap: the egg opens
    busy = true;
    const img = overlay.querySelector('#_ecEgg');
    if (img) img.style.animation = '_ecShake .45s ease-out';
    setTimeout(() => {
      delete egg.crackStage;
      hatched = _hatchEggSilent(egg);
      if (hatched) {
        sold = _autoSellHatched(hatched);
        _save();
        _topBar();
      }
      busy = false;
      if (!hatched) { finish(false); return; }
      paint(false);
    }, 450);
  }

  function finish(next) {
    overlay.remove();
    if (next && onNext) onNext(); else onDone?.();
  }

  document.body.appendChild(overlay);
  paint(false);
}

// Opens every ready egg one after the other. `agentId` restreint la file aux œufs
// « à éclore » d'un agent, `eggIds` à une liste précise (le tas des œufs sans nid).
// Sans option : tous les œufs prêts.
function openEggCrackQueue(onDone, { agentId = null, eggIds = null } = {}) {
  const pick = () => {
    const state = globalThis.state;
    if (agentId) return state.eggs.filter(e => e.status === 'ready' && (e.incubationAgentId || e.agentId) === agentId);
    if (eggIds) return state.eggs.filter(e => e.status === 'ready' && eggIds.includes(e.id));
    return state.eggs.filter(e => e.status === 'ready');
  };
  const step = () => {
    const ready = pick();
    if (!ready.length) { onDone?.(); return; }
    openEggCrackPopup(ready[0], { remaining: ready.length - 1, onNext: step, onDone });
  };
  step();
}

// Single-egg entry point kept for the base, the PC egg list and the Daycare.
function openHatchAnimation(egg, onDone) {
  openEggCrackPopup(egg, { onDone });
}

// ── renderPensionView — merged pension + eggs view ──────────────
function renderPensionView(container) {
  const state = globalThis.state;
  const p = state.pension;
  const now = Date.now();

  reconcilePensionPairs(state, now);
  const maxPairs = getMaxPensionPairs(state);
  const maxSlots = maxPairs * 2;
  const slots = p.slots || [];
  const hasPair = p.pairs.some(pair => pair.a && pair.b);

  const hasScientist = !!state.purchases?.scientist;
  const nurseOwned   = !!state.purchases?.autoIncubator;
  const nurseEnabled = state.purchases?.autoHatchEggs === true;   // option « éclosion auto » de Joëlle
  const autoSellOwned   = !!state.purchases?.autoSellEggs;
  const autoSellEnabled = state.purchases?.autoSellEggsEnabled !== false;
  const scEnabled = state.purchases?.scientistEnabled !== false;

  const _fmtMs = ms => ms < 60000 ? `${Math.ceil(ms / 1000)}s` : `${Math.ceil(ms / 60000)}min`;
  const stockFull = state.eggs.length >= EGG_STOCK_CAP;

  const seatHtml = id => {
    const pk = id ? state.pokemons.find(p2 => p2.id === id) : null;
    if (!pk) {
      return `<div class="pension-slot empty" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 6px;background:var(--bg);border:1px dashed var(--border);border-radius:var(--radius-sm);min-height:100px;gap:4px">
        <div style="font-size:20px;opacity:.3">+</div>
        <div style="font-size:8px;color:var(--text-dim);text-align:center">${_t('Siège libre', 'Free seat')}</div>
      </div>`;
    }
    return `<div class="pension-slot filled" style="position:relative;display:flex;flex-direction:column;align-items:center;padding:10px 6px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);gap:4px">
      <img src="${pokeSprite(pk.species_en, pk.shiny)}" style="width:48px;height:48px;image-rendering:pixelated">
      <div style="font-size:8px;text-align:center;line-height:1.3">${speciesName(pk.species_en)}</div>
      <div style="font-size:8px;color:var(--text-dim)">Lv.${pk.level} ${'★'.repeat(pk.potential)}</div>
      <button class="pension-remove-btn" data-pk-id="${pk.id}" style="margin-top:2px;font-size:7px;padding:2px 6px;background:var(--bg);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--red);cursor:pointer">${_t('Retirer', 'Remove')}</button>
    </div>`;
  };

  const pairsHtml = p.pairs.map((pair, i) => {
    const complete = !!(pair.a && pair.b);
    const left = complete && pair.eggAt ? Math.max(0, pair.eggAt - now) : null;
    const timer = !complete
      ? _t('Il faut 2 Pokémon pour former un couple.', 'Two Pokémon are needed to form a pair.')
      : !nurseOwned ? _t('Pension fermée — Joëlle requise.', 'Daycare closed — Nurse Joy required.')
      : stockFull ? _t('Stock d’œufs plein — production en pause.', 'Egg stock full — production paused.')
      : `${_t('Prochain œuf dans :', 'Next egg in:')} <b style="color:var(--gold)">${_fmtMs(left)}</b>`;
    return `<div style="border:1px solid ${complete ? 'var(--gold-dim)' : 'var(--border)'};border-radius:var(--radius-sm);padding:8px;background:var(--bg-card)">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold)">${_t('COUPLE', 'PAIR')} ${i + 1}</div>
        <div style="font-size:8px;color:var(--text-dim);margin-left:auto">${timer}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 18px 1fr;align-items:center;gap:6px">
        ${seatHtml(pair.a)}<div style="text-align:center;color:var(--red);font-size:12px">♥</div>${seatHtml(pair.b)}
      </div>
    </div>`;
  });
  const slotsHtml = pairsHtml;

  const nextPairCost = getNextPairPrice(state);
  const buySlotBtn = nextPairCost !== null
    ? `<button id="btnBuyPensionSlot" style="font-family:var(--font-pixel);font-size:8px;padding:5px 10px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">+ ${_t('Couple', 'Pair')} (${nextPairCost.toLocaleString()}₽)</button>`
    : '';

  // ── Eggs inventory ──────────────────────────────────────────
  reconcileEggIncubationAssignments(state);
  const incubationSummary = getEggIncubationSummary(state);
  const incubatorCount = Math.max(incubationSummary.capacity, incubationSummary.used);
  const allIncubated   = state.eggs.filter(e => e.incubating);   // ready + in-progress
  const readyEggs      = state.eggs.filter(e => e.status === 'ready');
  const waitingEggs    = state.eggs.filter(e => !e.incubating && e.status !== 'ready');
  const incubatingEggs = allIncubated.filter(e => e.status !== 'ready'); // for legacy compat
  const freeIncubators = incubationSummary.free;

  // Egg display helper — hides species/potential until revealed
  function _eggLabel(egg) {
    if (!egg.revealed) return { name: '???', pot: '?', shiny: '' };
    return { name: speciesName(egg.species_en), pot: '★'.repeat(egg.potential), shiny: egg.shiny ? ' ✨' : '' };
  }

  // Scientist button (10 000₽ → reveal)
  function _revealBtn(egg) {
    if (!hasScientist || egg.revealed) return '';
    return `<button class="egg-reveal-btn" data-egg-id="${egg.id}" style="font-family:var(--font-pixel);font-size:7px;padding:2px 6px;background:var(--bg);border:1px solid #c05be0;border-radius:var(--radius-sm);color:#c05be0;cursor:pointer">🧬 10k₽</button>`;
  }

  // ── Incubator grid cells ────────────────────────────────────
  let incubatorHtml = '';
  if (incubatorCount === 0) {
    incubatorHtml = `<div style="font-size:9px;color:var(--text-dim);padding:8px;text-align:center;border:1px dashed var(--border);border-radius:var(--radius-sm)">${_t('Aucun slot agent — recrute un agent pour lancer une incubation.', 'No agent slot — recruit an agent to start incubating.')}</div>`;
  } else {
    const _incubSlots = [];
    for (const egg of allIncubated) {
      const isReady = egg.status === 'ready';
      const rarity  = egg.rarity || SPECIES_BY_EN[egg.species_en]?.rarity || 'common';
      const total   = EGG_HATCH_MS[rarity] || EGG_HATCH_MS.common;
      const rem     = isReady ? 0 : Math.max(0, (egg.hatchAt || 0) - now);
      const pct     = isReady ? 100 : (total > 0 ? Math.round((1 - rem / total) * 100) : 0);
      const remStr  = isReady ? _t('✓ Prêt !', '✓ Ready!') : rem < 60000 ? `${Math.ceil(rem / 1000)}s` : `${Math.ceil(rem / 60000)}min`;
      const imgTag  = globalThis.eggImgTag?.(egg, false, 'width:44px;height:44px;image-rendering:pixelated') || '🥚';
      const lbl     = _eggLabel(egg);
      const refAgent = getEggIncubationAgent(egg, state);
      const refLine = refAgent
        ? `<div style="font-size:7px;color:var(--text-dim);max-width:82px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_t('Réf.', 'Ref.')} ${_esc(refAgent.name)} · ×${(egg.incubationSpeedMultiplier || 1).toFixed(2)}</div>`
        : '';
      _incubSlots.push(`
        <div ${isReady ? `data-hatch-egg="${egg.id}"` : ''} style="position:relative;display:flex;flex-direction:column;align-items:center;padding:10px 6px 8px;gap:5px;border:2px solid ${isReady ? 'var(--green)' : 'var(--gold-dim)'};border-radius:var(--radius-sm);background:var(--bg);${isReady ? 'cursor:pointer;animation:eggReadyGlow .8s ease-in-out infinite alternate;' : ''}">
          ${isReady ? `<div style="position:absolute;top:-9px;right:-9px;font-family:var(--font-pixel);font-size:8px;color:var(--bg);background:var(--green);border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;z-index:2;animation:eggReadyBadge .4s ease-in-out infinite alternate">!</div>` : ''}
          ${imgTag}
          <div style="font-size:8px;text-align:center;line-height:1.2;max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${lbl.name}${lbl.shiny}</div>
          <div style="font-size:7px;color:var(--text-dim)">${lbl.pot}</div>
          ${refLine}
          ${!isReady ? `<div style="background:var(--border);border-radius:2px;height:3px;width:100%;min-width:60px"><div style="background:var(--gold-dim);height:3px;border-radius:2px;width:${pct}%;transition:width .3s"></div></div>` : ''}
          <div style="font-size:8px;color:${isReady ? 'var(--green)' : 'var(--gold)'};font-family:var(--font-pixel)">${remStr}</div>
          ${_revealBtn(egg)}
        </div>`);
    }
    for (let i = allIncubated.length; i < incubatorCount; i++) {
      _incubSlots.push(`
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 8px;gap:5px;border:1px dashed var(--border);border-radius:var(--radius-sm);background:var(--bg);min-height:110px">
          <img src="${globalThis.trainerSprite?.('acetrainer') || ''}" style="width:28px;height:28px;opacity:.35;image-rendering:pixelated" onerror="this.style.display='none'">
          <div style="font-size:8px;color:var(--text-dim)">${_t('Agent libre', 'Free agent')}</div>
        </div>`);
    }
    incubatorHtml = _incubSlots.join('');
  }

  const waitingEggsHtml = waitingEggs.map(egg => {
    const rarity = egg.rarity || SPECIES_BY_EN[egg.species_en]?.rarity || 'common';
    const imgTag = globalThis.eggImgTag?.(egg, false, 'width:28px;height:28px;image-rendering:pixelated') || '🥚';
    const lbl = _eggLabel(egg);
    return `<div class="pension-egg-waiting" data-egg-id="${egg.id}" style="display:flex;align-items:center;gap:8px;padding:7px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);cursor:${freeIncubators > 0 ? 'pointer' : 'default'}">
      ${imgTag}
      <div style="flex:1">
        <div style="font-size:9px">${lbl.name} ${lbl.pot}${lbl.shiny}</div>
        <div style="font-size:8px;color:var(--text-dim)">${rarity}</div>
      </div>
      ${_revealBtn(egg)}
      ${freeIncubators > 0 ? `<div class="egg-incubate-action" style="font-size:8px;color:var(--gold)">▶ ${_t('Incuber', 'Incubate')}</div>` : ''}
    </div>`;
  }).join('') || '';

  const incubationCfg = getIncubationConfig(state);
  const eligibleAgents = (state.agents || []).filter(agent => !agent.legacyLocked);
  const priorityIds = incubationCfg.priorityAgentIds || [];
  const priorityAgents = priorityIds
    .map(id => eligibleAgents.find(agent => agent.id === id))
    .filter(Boolean);
  const unlistedAgents = eligibleAgents.filter(agent => !priorityIds.includes(agent.id));
  const priorityRows = priorityAgents.map((agent, idx) => {
    const activeEgg = allIncubated.find(egg => egg.incubationAgentId === agent.id);
    const status = activeEgg
      ? _t('couve un œuf', 'incubating an egg')
      : agent.resting ? _t('indisponible', 'unavailable')
      : agent.assignedZone ? _t('en zone', 'in zone')
      : _t('disponible', 'available');
    const hatched = agent.eggStats?.hatched || 0;
    return `<div class="egg-priority-row" data-agent-id="${agent.id}" style="display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg)">
      <span style="font-family:var(--font-pixel);font-size:8px;color:var(--gold);width:18px">#${idx + 1}</span>
      <img src="${agent.sprite || globalThis.trainerSprite?.('acetrainer') || ''}" style="width:24px;height:24px;image-rendering:pixelated" onerror="this.style.display='none'">
      <div style="flex:1;min-width:0">
        <div style="font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(agent.name)}</div>
        <div style="font-size:7px;color:var(--text-dim)">${status} · ${hatched} ${_t('éclos', 'hatched')}</div>
      </div>
      <button class="egg-priority-up" data-agent-id="${agent.id}" ${idx === 0 ? 'disabled' : ''} style="font-size:8px;padding:2px 5px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);cursor:pointer">↑</button>
      <button class="egg-priority-down" data-agent-id="${agent.id}" ${idx === priorityAgents.length - 1 ? 'disabled' : ''} style="font-size:8px;padding:2px 5px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);cursor:pointer">↓</button>
      <button class="egg-priority-remove" data-agent-id="${agent.id}" style="font-size:8px;padding:2px 5px;background:var(--bg);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--red);cursor:pointer">×</button>
    </div>`;
  }).join('');
  const priorityHtml = `<div>
    <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold);margin-bottom:8px">${_t('PRIORITÉ D’ÉCLOSION', 'HATCHING PRIORITY')}</div>
    <div style="font-size:8px;color:var(--text-dim);margin-bottom:8px">${_t('Les agents vont chercher les œufs selon cet ordre. Si la liste est vide, l’ordre du roster est utilisé.', 'Agents pick up eggs in this order. If the list is empty, roster order is used.')}</div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">
      ${priorityRows || `<div style="font-size:9px;color:var(--text-dim);padding:8px;border:1px dashed var(--border);border-radius:var(--radius-sm)">${_t('Aucune priorité personnalisée.', 'No custom priority.')}</div>`}
    </div>
    ${unlistedAgents.length ? `<select id="eggPriorityAddSelect" style="width:100%;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:var(--radius-sm);font-size:9px;padding:5px 6px;margin-bottom:8px">
      <option value="">${_t('Ajouter un agent à la priorité…', 'Add an agent to priority…')}</option>
      ${unlistedAgents.map(agent => `<option value="${agent.id}">${_esc(agent.name)}</option>`).join('')}
    </select>` : ''}
    <label style="display:flex;gap:6px;align-items:center;font-size:8px;color:var(--text-dim);margin-bottom:4px">
      <input id="eggPreferAvailable" type="checkbox" ${incubationCfg.preferAvailable !== false ? 'checked' : ''}>
      ${_t('Préférer les agents disponibles', 'Prefer currently available agents')}
    </label>
    <label style="display:flex;gap:6px;align-items:center;font-size:8px;color:var(--text-dim)">
      <input id="eggAllowFallback" type="checkbox" ${incubationCfg.allowFallback !== false ? 'checked' : ''}>
      ${_t('Fallback vers un autre agent si nécessaire', 'Fallback to another agent if needed')}
    </label>
  </div>`;

  // ── Services section (all in one) ───────────────────────────
  const nurseColor    = nurseOwned    ? (nurseEnabled    ? 'var(--green)' : 'var(--border)') : 'var(--border)';
  const autoSellColor = autoSellOwned ? (autoSellEnabled ? 'var(--green)' : 'var(--border)') : 'var(--border)';
  const scColor       = hasScientist  ? (scEnabled       ? 'var(--green)' : 'var(--border)') : 'var(--border)';

  const nurseHtml = `<div style="background:var(--bg);border:1px solid ${nurseColor};border-radius:var(--radius-sm);padding:10px;display:flex;gap:10px;align-items:flex-start">
    <img src="${globalThis.trainerSprite?.('nurse') || ''}" style="width:36px;height:36px;image-rendering:pixelated;flex-shrink:0;${nurseOwned && !nurseEnabled ? 'opacity:.4;filter:grayscale(1)' : ''}" onerror="this.style.display='none'">
    <div style="flex:1">
      <div style="font-family:var(--font-pixel);font-size:8px;color:${nurseOwned ? (nurseEnabled ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:3px">${_t('Infirmière Joëlle corrompue', 'Corrupted Nurse Joy')}</div>
      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">${_t("Ouvre la pension : sans elle, aucun couple ne produit d'œuf et les agents n'en récupèrent pas. Option « éclosion auto » : elle ouvre elle-même les œufs déposés à la base (sinon, tu les ouvres quand tu veux).", 'Opens the Daycare: without her no pair lays eggs and agents fetch none. "Auto-hatch" option: she opens the eggs dropped at the base herself (otherwise you open them whenever you like).')}</div>
      ${nurseOwned
        ? `<div style="display:flex;align-items:center;gap:8px">
             <span style="font-family:var(--font-pixel);font-size:7px;color:${nurseEnabled ? 'var(--green)' : 'var(--text-dim)'}">${nurseEnabled ? _t('✓ ÉCLOSION AUTO', '✓ AUTO-HATCH') : _t('✗ ÉCLOSION MANUELLE', '✗ MANUAL HATCH')}</span>
             <button id="btnToggleNurse" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid ${nurseEnabled ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${nurseEnabled ? 'var(--red)' : 'var(--green)'};cursor:pointer">${nurseEnabled ? _t('Désactiver', 'Disable') : _t('Activer', 'Enable')}</button>
           </div>`
        : `<button id="btnBuyNurse" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">${_t('Embaucher', 'Hire')} — ${NURSE_JOY_PRICE.toLocaleString()}₽</button>`}
    </div>
  </div>`;

  const autoSellCfg = state.settings?.autoSellEggs || {};
  const autoSellHtml = `<div style="background:var(--bg);border:1px solid ${autoSellColor};border-radius:var(--radius-sm);padding:10px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
      <span style="font-size:14px">🤖</span>
      <div style="font-family:var(--font-pixel);font-size:8px;color:${autoSellOwned ? (autoSellEnabled ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'}">${_t('Vente auto des éclots', 'Auto-sell hatched Pokémon')}</div>
    </div>
    <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">${_t('Vend automatiquement les Pokémon issus des œufs après éclosion.', 'Automatically sells Pokémon produced by eggs after they hatch.')}</div>
    ${autoSellOwned
      ? `<div style="display:flex;flex-direction:column;gap:6px">
           <div style="display:flex;align-items:center;gap:8px">
             <span style="font-family:var(--font-pixel);font-size:7px;color:${autoSellEnabled ? 'var(--green)' : 'var(--text-dim)'}">${autoSellEnabled ? _t('✓ ACTIF', '✓ ACTIVE') : _t('✗ INACTIF', '✗ INACTIVE')}</span>
             <button id="btnToggleAutoSellEggs" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid ${autoSellEnabled ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${autoSellEnabled ? 'var(--red)' : 'var(--green)'};cursor:pointer">${autoSellEnabled ? _t('Désactiver', 'Disable') : _t('Activer', 'Enable')}</button>
           </div>
           <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
             <label style="font-size:8px;color:var(--text-dim);display:flex;align-items:center;gap:4px;cursor:pointer">
               <input type="radio" name="autoSellEggsMode" value="all" ${(autoSellCfg.mode||'all')==='all' ? 'checked' : ''}> ${_t('Tous', 'All')}
             </label>
             <label style="font-size:8px;color:var(--text-dim);display:flex;align-items:center;gap:4px;cursor:pointer">
               <input type="radio" name="autoSellEggsMode" value="by_potential" ${autoSellCfg.mode==='by_potential' ? 'checked' : ''}> ${_t('Par potentiel', 'By potential')}
             </label>
             ${autoSellCfg.mode === 'by_potential' ? `<div style="display:flex;gap:3px;flex-wrap:wrap">${[1,2,3,4,5].map(n => `<label style="font-size:8px;cursor:pointer;display:flex;align-items:center;gap:2px"><input type="checkbox" class="pot-filter" value="${n}" ${(autoSellCfg.potentials||[]).includes(n) ? 'checked' : ''}> ${'★'.repeat(n)}</label>`).join('')}</div>` : ''}
             <label style="font-size:8px;color:var(--gold);display:flex;align-items:center;gap:4px;cursor:pointer">
               <input type="checkbox" id="autoSellEggsAllowShiny" ${autoSellCfg.allowShiny ? 'checked' : ''}> ${_t('Inclure ✨ shiny', 'Include ✨ Shiny')}
             </label>
           </div>
         </div>`
      : `<button id="btnBuyAutoSellEggs" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">${_t('Acheter', 'Buy')} — 5 000 000₽</button>`}
  </div>`;

  const scientistHtml = `<div style="background:var(--bg);border:1px solid ${scColor};border-radius:var(--radius-sm);padding:10px;display:flex;gap:10px;align-items:flex-start">
    <img src="${globalThis.trainerSprite?.('scientist') || ''}" style="width:36px;height:36px;image-rendering:pixelated;flex-shrink:0;${hasScientist && !scEnabled ? 'opacity:.4;filter:grayscale(1)' : ''}" onerror="this.style.display='none'">
    <div style="flex:1">
      <div style="font-family:var(--font-pixel);font-size:8px;color:${hasScientist ? (scEnabled ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:3px">${_t('Scientifique peu scrupuleux', 'Unscrupulous Scientist')}</div>
      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">${_t("Révèle l'espèce d'un œuf (10k₽) · Mutation artificielle : sacrifice ★★★★★ même espèce pour porter un Pokémon au max.", 'Reveals the species inside an egg (10k₽) · Artificial mutation: sacrifice a ★★★★★ Pokémon of the same species to maximize another Pokémon.')}</div>
      ${hasScientist
        ? `<div style="display:flex;align-items:center;gap:8px">
             <span style="font-family:var(--font-pixel);font-size:7px;color:${scEnabled ? 'var(--green)' : 'var(--text-dim)'}">${scEnabled ? _t('✓ EN POSTE', '✓ ON DUTY') : _t('✗ RENVOYÉ', '✗ DISMISSED')}</span>
             <button id="btnToggleScientistPension" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid ${scEnabled ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${scEnabled ? 'var(--red)' : 'var(--green)'};cursor:pointer">${scEnabled ? _t('Renvoyer', 'Dismiss') : _t('Rappeler', 'Recall')}</button>
           </div>`
        : `<button id="btnBuyScientistPension" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">${_t('Engager', 'Hire')} — 15 000₽</button>`}
    </div>
  </div>`;

  // ── Proto boosts (placeholder) ──────────────────────────────
  const boostHtml = `<div style="background:var(--bg);border:1px dashed var(--border);border-radius:var(--radius-sm);padding:10px;opacity:.5">
    <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:6px">⚗️ ${_t('BOOSTS (bientôt)', 'BOOSTS (coming soon)')}</div>
    <div style="display:flex;gap:6px">
      <div style="flex:1;padding:8px;border:1px dashed var(--border);border-radius:var(--radius-sm);text-align:center">
        <div style="font-size:11px">🥚</div>
        <div style="font-size:7px;color:var(--text-dim);margin-top:2px">${_t('Boost reproduction', 'Breeding boost')}<br><span style="color:var(--gold)">500 000₽</span></div>
      </div>
      <div style="flex:1;padding:8px;border:1px dashed var(--border);border-radius:var(--radius-sm);text-align:center">
        <div style="font-size:11px">🔥</div>
        <div style="font-size:7px;color:var(--text-dim);margin-top:2px">${_t('Boost incubation', 'Incubation boost')}<br><span style="color:var(--gold)">500 000₽</span></div>
      </div>
    </div>
  </div>`;

  // ── Picker column ───────────────────────────────────────────
  const pensionSet   = globalThis.getPensionSlotIds();
  const teamIds      = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => teamIds.add(id));
  const trainingIds  = new Set(state.trainingRoom?.pokemon || []);
  const pensionFull  = slots.length >= maxSlots;
  const q = _pensionSearch.toLowerCase();

  const allCandidates = state.pokemons
    .filter(pk => !pensionSet.has(pk.id) && !teamIds.has(pk.id) && !trainingIds.has(pk.id) && SPECIES_BY_EN[pk.species_en]?.rarity !== 'legendary')
    .sort((a, b) => getPokemonPower(b) - getPokemonPower(a));
  const candidates = q
    ? allCandidates.filter(pk => speciesName(pk.species_en).toLowerCase().includes(q) || pk.species_en.includes(q))
    : allCandidates;

  const pickerHtml = candidates.map(pk =>
    `<div class="pension-candidate" data-pk-id="${pk.id}" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid var(--border);cursor:${pensionFull ? 'default' : 'pointer'};opacity:${pensionFull ? '.5' : '1'}">
      <img src="${pokeSprite(pk.species_en, pk.shiny)}" style="width:30px;height:30px;image-rendering:pixelated">
      <div style="flex:1">
        <div style="font-size:10px">${speciesName(pk.species_en)} ${'★'.repeat(pk.potential)}${pk.shiny ? ' ✨' : ''}</div>
        <div style="font-size:8px;color:var(--text-dim)">Lv.${pk.level}</div>
      </div>
    </div>`,
  ).join('') || `<div style="color:var(--text-dim);font-size:9px;padding:12px;text-align:center">${_t('Aucun Pokémon disponible', 'No Pokémon available')}</div>`;

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 220px;gap:16px;padding:12px">
      <div style="display:flex;flex-direction:column;gap:14px">

        <!-- Pension slots -->
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">PENSION (${p.pairs.filter(x => x.a && x.b).length}/${maxPairs} ${_t('couples', 'pairs')})</div>
            ${buySlotBtn}
            ${slots.length > 0 ? `<button id="btnPensionClearAll" style="margin-left:auto;font-family:var(--font-pixel);font-size:8px;padding:4px 8px;background:var(--bg);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--red);cursor:pointer">${_t('Tout retirer', 'Remove all')}</button>` : ''}
          </div>
          ${nurseOwned ? '' : `<div style="font-size:9px;color:var(--gold);padding:8px;margin-bottom:8px;border:1px dashed var(--gold-dim);border-radius:var(--radius-sm)">🔒 ${_t(`La pension est fermée : embauche l'Infirmière Joëlle (${NURSE_JOY_PRICE.toLocaleString()}₽, section Services plus bas) pour lancer l'élevage.`, `The Daycare is closed: hire Nurse Joy (${NURSE_JOY_PRICE.toLocaleString()}₽, Services section below) to start breeding.`)}</div>`}
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:8px">${_t(`Chaque couple produit un œuf toutes les ${EGG_GEN_MS / 60000} min. Les agents sans œuf vont en chercher un ici, le couvent gratuitement et le déposent à la base une fois prêt.`, `Each pair produces an egg every ${EGG_GEN_MS / 60000} min. Agents without an egg pick one up here, incubate it for free and drop it at the base once ready.`)} (${state.eggs.length}/${EGG_STOCK_CAP})</div>
          <div style="display:flex;flex-direction:column;gap:8px">${slotsHtml.join('')}</div>
        </div>

        <!-- Ready eggs -->
        ${readyEggs.length > 0 ? `
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="font-family:var(--font-pixel);font-size:10px;color:var(--green)">🥚 ${_t('PRÊTS À ÉCLORE', 'READY TO HATCH')} (${readyEggs.length})</div>
            <button id="btnHatchQuick" style="margin-left:auto;font-family:var(--font-pixel);font-size:7px;padding:4px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">${_t('Éclosion rapide', 'Quick hatch')}</button>
            <button id="btnHatchAll" style="font-family:var(--font-pixel);font-size:8px;padding:4px 10px;background:var(--bg);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--green);cursor:pointer">${_t('Ouvrir les œufs', 'Open eggs')} ▶</button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${readyEggs.map(egg => {
              const lbl = _eggLabel(egg);
              const imgTag = globalThis.eggImgTag?.(egg, false, 'width:40px;height:40px;image-rendering:pixelated') || '🥚';
              return `<div data-open-egg="${egg.id}" style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;background:var(--bg);border:1px solid var(--green);border-radius:var(--radius-sm);min-width:70px;position:relative;cursor:pointer;animation:eggReadyGlow .8s ease-in-out infinite alternate">
                ${imgTag}
                <div style="font-size:8px;text-align:center">${lbl.name}</div>
                <div style="font-size:8px;color:var(--text-dim)">${lbl.pot}${lbl.shiny}</div>
                ${_revealBtn(egg)}
              </div>`;
            }).join('')}
          </div>
        </div>` : ''}

        <!-- Incubators -->
        <div>
          <style>@keyframes eggReadyGlow{from{box-shadow:0 0 0 rgba(110,207,138,0)}to{box-shadow:0 0 12px rgba(110,207,138,.7)}}@keyframes eggReadyBadge{from{transform:scale(1)}to{transform:scale(1.35)}}</style>
          <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold);margin-bottom:8px">${_t('SLOTS D’ÉCLOSION AGENTS', 'AGENT HATCHING SLOTS')} (${allIncubated.length}/${incubationSummary.capacity})</div>
          <div style="font-size:8px;color:var(--text-dim);margin-bottom:8px">${_t('1 agent recruté = 1 œuf couvé à la fois, gratuitement. Prêt, l’œuf est déposé à la base et l’agent repart en chercher un autre.', '1 recruited agent = 1 egg incubating at a time, for free. When ready the egg is dropped at the base and the agent fetches another.')}</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px">${incubatorHtml || `<div style="font-size:9px;color:var(--text-dim);text-align:center;padding:8px">${_t('Aucun slot agent disponible', 'No agent slot available')}</div>`}</div>
        </div>

        <!-- Waiting eggs -->
        ${waitingEggs.length > 0 ? `
        <div>
          <div style="font-family:var(--font-pixel);font-size:10px;color:var(--text-dim);margin-bottom:8px">${_t("EN ATTENTE D'INCUBATION", 'WAITING FOR INCUBATION')} (${waitingEggs.length})</div>
          <div style="display:flex;flex-direction:column;gap:6px">${waitingEggsHtml}</div>
        </div>` : ''}

        ${eligibleAgents.length > 0 ? priorityHtml : ''}

        <!-- Services -->
        <div>
          <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold);margin-bottom:8px">SERVICES</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${nurseHtml}
            ${scientistHtml}
            ${autoSellHtml}
            ${boostHtml}
          </div>
        </div>

      </div>

      <!-- Picker column -->
      <div>
        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:8px">${_t('AJOUTER À LA PENSION', 'ADD TO DAYCARE')}</div>
        <input id="pensionSearchInput" type="text" placeholder="${_t('Rechercher…', 'Search…')}" value="${_pensionSearch}"
          style="width:100%;padding:6px 8px;margin-bottom:6px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:10px;box-sizing:border-box;outline:none">
        <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">${pensionFull ? _t('Pension pleine.', 'Daycare full.') : _t('Cliquer pour ajouter.', 'Click to add.')}</div>
        <div id="pensionPicker" style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:500px;overflow-y:auto">${pickerHtml}</div>
      </div>
    </div>`;

  // ── Event handlers ────────────────────────────────────────────

  container.querySelector('#btnPensionClearAll')?.addEventListener('click', () => {
    state.pension.slots = [];
    reconcilePensionPairs(state);
    saveState();
    notify(_t('Pension vidée.', 'Daycare cleared.'), 'success');
    renderPensionView(container);
  });

  container.querySelector('#btnBuyPensionSlot')?.addEventListener('click', () => {
    const cost = getNextPairPrice(state);
    if (cost === null) return;
    if (state.gang.money < cost) { notify(_t('Fonds insuffisants.', 'Insufficient funds.'), 'error'); return; }
    state.gang.money -= cost;
    EventBus.emit(EVENTS.MONEY_CHANGED, { delta: -cost, newTotal: state.gang.money });
    state.pension.extraPairsPurchased = (state.pension.extraPairsPurchased || 0) + 1;
    reconcilePensionPairs(state);
    saveState();
    _topBar();
    notify(_t(`Nouveau couple débloqué ! (${getMaxPensionPairs(state)} couples)`, `New pair unlocked! (${getMaxPensionPairs(state)} pairs)`), 'gold');
    renderPensionView(container);
  });

  container.querySelector('#btnHatchAll')?.addEventListener('click', () => {
    openEggCrackQueue(() => { if (globalThis.activeTab === 'tabPC') renderPensionView(container); });
  });
  container.querySelector('#btnHatchQuick')?.addEventListener('click', () => openHatchPopup());
  container.querySelectorAll('[data-open-egg]').forEach(el => {
    el.addEventListener('click', ev => {
      if (ev.target.closest?.('.egg-reveal-btn')) return;
      const egg = state.eggs.find(e => e.id === el.dataset.openEgg);
      if (!egg || egg.status !== 'ready') return;
      openHatchAnimation(egg, () => { if (globalThis.activeTab === 'tabPC') renderPensionView(container); });
    });
  });

  const updatePriority = nextIds => {
    setEggIncubationPriority(nextIds, state);
    reconcileEggIncubationAssignments(state);
    saveState();
    renderPensionView(container);
  };

  container.querySelector('#eggPriorityAddSelect')?.addEventListener('change', e => {
    const id = e.target.value;
    if (!id) return;
    updatePriority([...(getIncubationConfig(state).priorityAgentIds || []), id]);
  });

  container.querySelectorAll('.egg-priority-up, .egg-priority-down, .egg-priority-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const ids = [...(getIncubationConfig(state).priorityAgentIds || [])];
      const idx = ids.indexOf(btn.dataset.agentId);
      if (idx === -1) return;
      if (btn.classList.contains('egg-priority-remove')) ids.splice(idx, 1);
      else if (btn.classList.contains('egg-priority-up') && idx > 0) [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
      else if (btn.classList.contains('egg-priority-down') && idx < ids.length - 1) [ids[idx + 1], ids[idx]] = [ids[idx], ids[idx + 1]];
      updatePriority(ids);
    });
  });

  container.querySelector('#eggPreferAvailable')?.addEventListener('change', e => {
    getIncubationConfig(state).preferAvailable = e.target.checked;
    reconcileEggIncubationAssignments(state);
    saveState();
    renderPensionView(container);
  });

  container.querySelector('#eggAllowFallback')?.addEventListener('change', e => {
    getIncubationConfig(state).allowFallback = e.target.checked;
    reconcileEggIncubationAssignments(state);
    saveState();
    renderPensionView(container);
  });

  // Click on ready egg cell in incubator grid → hatch animation
  container.querySelectorAll('[data-hatch-egg]').forEach(el => {
    el.addEventListener('click', () => {
      const eggId = el.dataset.hatchEgg;
      const egg = state.eggs.find(e => e.id === eggId);
      if (!egg || egg.status !== 'ready') return;
      openHatchAnimation(egg, () => {
        if (globalThis.activeTab === 'tabPC') renderPensionView(container);
        _dirty();
      });
    });
  });

  container.querySelector('#btnToggleNurse')?.addEventListener('click', () => {
    state.purchases.autoHatchEggs = !nurseEnabled;
    saveState();
    notify(state.purchases.autoHatchEggs
      ? _t('💉 Joëlle ouvrira les œufs à ta place.', '💉 Joy will open the eggs for you.')
      : _t('🥚 Tu ouvres les œufs toi-même.', '🥚 You open the eggs yourself.'), 'success');
    renderPensionView(container);
  });

  container.querySelector('#btnBuyNurse')?.addEventListener('click', () => {
    if (state.gang.money < NURSE_JOY_PRICE) { notify(_t('Fonds insuffisants.', 'Insufficient funds.'), 'error'); return; }
    globalThis.showConfirm?.(_t(`Embaucher l'Infirmière Joëlle corrompue pour ${NURSE_JOY_PRICE.toLocaleString()}₽ ? (permanent)`, `Hire Corrupted Nurse Joy for ${NURSE_JOY_PRICE.toLocaleString()}₽? (permanent)`), () => {
      state.gang.money -= NURSE_JOY_PRICE;
      EventBus.emit(EVENTS.MONEY_CHANGED, { delta: -NURSE_JOY_PRICE, newTotal: state.gang.money });
      state.purchases.autoIncubator = true;
      state.purchases.autoHatchEggs = false;
      saveState();
      _topBar();
      notify(_t('💉 Joëlle est en poste !', '💉 Joy is on duty!'), 'gold');
      renderPensionView(container);
    }, null, { confirmLabel: _t('Embaucher', 'Hire'), cancelLabel: _t('Annuler', 'Cancel') });
  });

  container.querySelector('#btnToggleScientistPension')?.addEventListener('click', () => {
    state.purchases.scientistEnabled = !scEnabled;
    saveState();
    notify(state.purchases.scientistEnabled
      ? _t('🧬 Scientifique rappelé !', '🧬 Scientist recalled!')
      : _t('🧬 Scientifique renvoyé.', '🧬 Scientist dismissed.'), 'success');
    renderPensionView(container);
  });

  container.querySelector('#btnBuyScientistPension')?.addEventListener('click', () => {
    if (state.gang.money < 15_000) { notify(_t('Fonds insuffisants.', 'Insufficient funds.'), 'error'); return; }
    globalThis.showConfirm?.(_t('Engager le Scientifique peu scrupuleux pour 15 000₽ ?', 'Hire the Unscrupulous Scientist for 15,000₽?'), () => {
      state.gang.money -= 15_000;
      EventBus.emit(EVENTS.MONEY_CHANGED, { delta: -15_000, newTotal: state.gang.money });
      state.stats.totalMoneySpent = (state.stats.totalMoneySpent || 0) + 15_000;
      state.purchases.scientist = true;
      state.purchases.scientistEnabled = true;
      saveState();
      _topBar();
      notify(_t('🧬 Scientifique engagé !', '🧬 Scientist hired!'), 'gold');
      renderPensionView(container);
    }, null, { confirmLabel: _t('Engager', 'Hire'), cancelLabel: _t('Annuler', 'Cancel') });
  });

  container.querySelector('#btnBuyAutoSellEggs')?.addEventListener('click', () => {
    if (state.gang.money < 5_000_000) { notify(_t('Fonds insuffisants.', 'Insufficient funds.'), 'error'); return; }
    globalThis.showConfirm?.(_t('Acheter la vente automatique des éclots pour 5 000 000₽ ?', 'Buy automatic sales for hatched Pokémon for 5,000,000₽?'), () => {
      state.gang.money -= 5_000_000;
      EventBus.emit(EVENTS.MONEY_CHANGED, { delta: -5_000_000, newTotal: state.gang.money });
      state.purchases.autoSellEggs = true;
      state.purchases.autoSellEggsEnabled = true;
      saveState();
      _topBar();
      notify(_t('🤖 Vente automatique des éclots activée !', '🤖 Automatic sales for hatched Pokémon enabled!'), 'gold');
      renderPensionView(container);
    }, null, { confirmLabel: _t('Acheter', 'Buy'), cancelLabel: _t('Annuler', 'Cancel') });
  });

  container.querySelector('#btnToggleAutoSellEggs')?.addEventListener('click', () => {
    state.purchases.autoSellEggsEnabled = !autoSellEnabled;
    saveState();
    notify(state.purchases.autoSellEggsEnabled
      ? _t('🤖 Vente auto éclots activée.', '🤖 Auto-sell for hatched Pokémon enabled.')
      : _t('⏸ Vente auto éclots désactivée.', '⏸ Auto-sell for hatched Pokémon disabled.'), 'success');
    renderPensionView(container);
  });

  container.querySelectorAll('input[name="autoSellEggsMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (!state.settings.autoSellEggs) state.settings.autoSellEggs = {};
      state.settings.autoSellEggs.mode = radio.value;
      saveState();
      renderPensionView(container);
    });
  });

  container.querySelectorAll('.pot-filter').forEach(cb => {
    cb.addEventListener('change', () => {
      if (!state.settings.autoSellEggs) state.settings.autoSellEggs = {};
      const checked = [...container.querySelectorAll('.pot-filter:checked')].map(c => parseInt(c.value));
      state.settings.autoSellEggs.potentials = checked;
      saveState();
    });
  });

  container.querySelector('#autoSellEggsAllowShiny')?.addEventListener('change', e => {
    if (!state.settings.autoSellEggs) state.settings.autoSellEggs = {};
    state.settings.autoSellEggs.allowShiny = e.target.checked;
    saveState();
  });

  container.querySelector('#pensionSearchInput')?.addEventListener('input', e => {
    _pensionSearch = e.target.value;
    renderPensionView(container);
  });

  container.querySelectorAll('.pension-remove-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.pkId;
      removeFromPension(id, state);
      saveState();
      renderPensionView(container);
    });
  });

  container.querySelectorAll('.pension-candidate').forEach(el => {
    el.addEventListener('click', () => {
      if (slots.length >= maxSlots) { notify(_t('Pension pleine.', 'Daycare full.'), 'error'); return; }
      const pkId = el.dataset.pkId;
      removePokemonFromAllAssignments(pkId);
      if (!state.pension.slots.includes(pkId)) {
        state.pension.slots.push(pkId);
        reconcilePensionPairs(state);
        saveState();
        renderPensionView(container);
      }
    });
  });

  container.querySelectorAll('.pension-egg-waiting').forEach(el => {
    el.addEventListener('click', ev => {
      // Prevent incubate when clicking reveal button
      if (ev.target.classList.contains('egg-reveal-btn') || ev.target.closest?.('.egg-reveal-btn')) return;
      if (freeIncubators <= 0) return;
      if (!ev.target.classList.contains('egg-incubate-action') && !ev.target.closest?.('.egg-incubate-action')) return;
      const egg = state.eggs.find(e => e.id === el.dataset.eggId);
      if (!egg || egg.incubating) return;
      const rarity = egg.rarity || SPECIES_BY_EN[egg.species_en]?.rarity || 'common';
      const started = startEggIncubation(egg, {
        state,
        baseMs: EGG_HATCH_MS[rarity] || EGG_HATCH_MS.common,
      });
      if (!started) {
        notify(_t('Aucun slot agent disponible.', 'No agent slot available.'), 'error');
        renderPensionView(container);
        return;
      }
      saveState();
      notify(_t("Œuf confié à un agent !", 'Egg assigned to an agent!'), 'success');
      renderPensionView(container);
    });
  });

  // Scientist reveal buttons (works for incubating + waiting + ready eggs)
  container.querySelectorAll('.egg-reveal-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const eggId = btn.dataset.eggId;
      const egg = state.eggs.find(eg => eg.id === eggId);
      if (!egg || egg.revealed) return;
      if (state.gang.money < 10000) { notify(_t('Fonds insuffisants (10 000₽).', 'Insufficient funds (10,000₽).'), 'error'); return; }
      state.gang.money -= 10000;
      EventBus.emit(EVENTS.MONEY_CHANGED, { delta: -10000, newTotal: state.gang.money });
      egg.revealed = true;
      saveState();
      _topBar();
      notify(`🧬 Analyse : ${speciesName(egg.species_en)} ${'★'.repeat(egg.potential)}${egg.shiny ? ' ✨' : ''}`, 'gold');
      renderPensionView(container);
    });
  });
}

Object.assign(globalThis, { EGG_HATCH_MS, EGG_GEN_MS, pensionTick, renderPensionView, openHatchPopup, openHatchAnimation, openEggCrackPopup, openEggCrackQueue });
export {};
