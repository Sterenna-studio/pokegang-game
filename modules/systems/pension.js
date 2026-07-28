import { EventBus, EVENTS } from '../core/eventBus.js';
import { PENSION_SHINY_RATE_NONE, PENSION_SHINY_RATE_ONE, PENSION_SHINY_RATE_BOTH } from '../../data/gameplay-config-data.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY,        { msg, type });
const _dirty  = ()               => EventBus.emit(EVENTS.STATE_DIRTY);
const _topBar = ()               => EventBus.emit(EVENTS.UI_TOPBAR_UPDATE);
const _save   = ()               => globalThis.saveState?.();
const _t      = (fr, en)         => (globalThis.state?.lang === 'en' ? en : fr);

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
const EGG_GEN_MS = 5 * 60 * 1000;

// ── Random breeding pair: any 2 non-legendary in pension slots ──
function _getBreedingPair() {
  const state = globalThis.state;
  const slots = state.pension?.slots || [];
  const candidates = slots
    .map(id => state.pokemons.find(p => p.id === id))
    .filter(Boolean);
  if (candidates.length < 2) return [];
  // Shuffle and pick first two (stays deterministic within a tick, varies each egg cycle)
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1]];
}

function pensionTick() {
  const state = globalThis.state;
  const p = state.pension;
  const now = Date.now();

  // Pick a random pair fresh each tick (varies each egg cycle)
  const pair = _getBreedingPair();
  const [pkA, pkB] = pair;
  const hasPair = pair.length >= 2;

  // Generate egg when ≥2 pokemon in pension and timer elapsed
  if (hasPair && p.eggAt && now >= p.eggAt) {
    const isLegA = SPECIES_BY_EN[pkA.species_en]?.rarity === 'legendary';
    const isLegB = SPECIES_BY_EN[pkB.species_en]?.rarity === 'legendary';
    if (isLegA && isLegB) {
      p.eggAt = now + EGG_GEN_MS;
      saveState();
      return;
    }
    const parent = isLegA ? pkB : isLegB ? pkA : (Math.random() < 0.5 ? pkA : pkB);
    const baseSpeciesEn = getBaseSpecies(parent.species_en);
    const sp = SPECIES_BY_EN[baseSpeciesEn];
    if (sp && EGG_HATCH_MS[sp.rarity] !== null) {
      const avgPot = Math.floor((pkA.potential + pkB.potential) / 2);
      const potential = Math.min(5, avgPot + (Math.random() < 0.2 ? 1 : 0));
      const shinyChance = (pkA.shiny && pkB.shiny) ? PENSION_SHINY_RATE_BOTH : (pkA.shiny || pkB.shiny) ? PENSION_SHINY_RATE_ONE : PENSION_SHINY_RATE_NONE;
      const egg = {
        id: `egg_${now}_${Math.random().toString(36).slice(2, 7)}`,
        species_en: baseSpeciesEn,
        hatchAt: null,
        incubating: false,
        rarity: sp.rarity,
        potential,
        shiny: Math.random() < shinyChance,
        parentA: pkA.species_en,
        parentB: pkB.species_en,
      };
      state.eggs.push(egg);
      tryAutoIncubate();
      p.eggAt = now + EGG_GEN_MS;
      notify(_t(
        `Un œuf mystérieux est apparu à la pension !${state.purchases?.autoIncubator ? ' (auto-incubé)' : ' Placez-le dans un incubateur.'}`,
        `A mysterious egg appeared at the Daycare!${state.purchases?.autoIncubator ? ' (auto-incubated)' : ' Place it in an incubator.'}`,
      ), 'gold');
      saveState();
      if (activeTab === 'tabPC') renderPCTab();
    }
  }

  // Start timer when pension first reaches ≥2 pokemon
  if (hasPair && !p.eggAt) {
    p.eggAt = now + EGG_GEN_MS;
    saveState();
  }

  // Clear timer when fewer than 2 pokemon in pension
  if (!hasPair) p.eggAt = null;

  // Mark eggs as ready (status = 'ready') when hatchAt elapsed — don't auto-hatch
  // Keep incubating: true so the incubator count stays correct until the player hatches
  const justReady = state.eggs.filter(e => e.incubating && e.hatchAt && e.hatchAt <= now && e.status !== 'ready');
  if (justReady.length > 0) {
    for (const egg of justReady) egg.status = 'ready';
    saveState();
    notify(_t(
      `${justReady.length > 1 ? `${justReady.length} œufs sont` : 'Un œuf est'} prêt${justReady.length > 1 ? 's' : ''} à éclore !`,
      `${justReady.length > 1 ? `${justReady.length} eggs are` : 'One egg is'} ready to hatch!`,
    ), 'gold');
    if (activeTab === 'tabPC') renderPCTab();
  }
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
  EventBus.emit(EVENTS.POKEMON_CAPTURED, { pokemon: hatched, zoneId: 'pension' });
  state.stats.totalCaught++;
  state.stats.eggsHatched = (state.stats.eggsHatched || 0) + 1;
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

// ── Single-egg hatch animation popup ────────────────────────────
// onDone(hatched|null) is called after dismiss
function openHatchAnimation(egg, onDone) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9600;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;cursor:pointer';

  const eggSrc = globalThis.eggSprite?.(egg, false) || '';

  overlay.innerHTML = `
    <div id="_hatchAnimRoot" style="display:flex;flex-direction:column;align-items:center;gap:16px;pointer-events:none">
      <style>
        @keyframes _eggWobble{0%,100%{transform:rotate(-18deg) scale(1.08)}50%{transform:rotate(18deg) scale(1.08)}}
        @keyframes _eggCrack{0%{transform:scale(1);opacity:1}40%{transform:scale(1.4);filter:brightness(3) saturate(0);opacity:.8}100%{transform:scale(0.2);opacity:0}}
        @keyframes _pokeReveal{0%{transform:scale(0) rotate(-10deg);opacity:0}65%{transform:scale(1.15) rotate(3deg);opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}
      </style>
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);letter-spacing:2px">${_t('ÉCLOSION !', 'HATCHING!')}</div>
      <img id="_hatchEggImg" src="${eggSrc}" style="width:88px;height:88px;image-rendering:pixelated;animation:_eggWobble .35s ease-in-out infinite">
      <div style="font-size:8px;color:var(--text-dim);animation:none">${_t('Tap pour continuer…', 'Tap to continue…')}</div>
    </div>`;

  document.body.appendChild(overlay);

  let _phase = 'wobble'; // wobble → crack → reveal → done
  function advance() {
    if (_phase === 'wobble') {
      _phase = 'crack';
      const img = overlay.querySelector('#_hatchEggImg');
      if (img) img.style.animation = '_eggCrack .45s ease-out forwards';
      setTimeout(doReveal, 450);
    } else if (_phase === 'done') {
      overlay.remove();
      if (typeof onDone === 'function') onDone();
    }
  }

  function doReveal() {
    _phase = 'reveal';
    const pk = _hatchEggSilent(egg);
    const sold = pk ? _autoSellHatched(pk) : false;
    if (pk) {
      _save();
      _topBar();
    }
    const root = overlay.querySelector('#_hatchAnimRoot');
    if (!root) return;
    const pokeImg = pk ? (globalThis.pokeSprite?.(pk.species_en, pk.shiny) || '') : '';
    root.innerHTML = `
      ${pk
        ? `<div style="font-family:var(--font-pixel);font-size:11px;color:${pk.shiny ? '#ffcc5a' : 'var(--green)'};letter-spacing:2px">${pk.shiny ? '✨ ' : ''}${_t('ÉCLOS !', 'HATCHED!')}</div>
           <img src="${pokeImg}" style="width:96px;height:96px;image-rendering:pixelated;animation:_pokeReveal .5s ease-out forwards;${pk.shiny ? 'filter:drop-shadow(0 0 10px #ffcc5a)' : ''}">
           <div style="font-family:var(--font-pixel);font-size:10px;color:var(--text)">${globalThis.speciesName?.(pk.species_en) || pk.species_en}</div>
           <div style="font-size:9px;color:var(--gold)">${'★'.repeat(pk.potential)}${pk.shiny ? ' ✨' : ''}</div>
           ${sold ? `<div style="font-size:8px;color:var(--text-dim);margin-top:2px">${_t('Vendu automatiquement !', 'Automatically sold!')}</div>` : ''}
           <div style="font-size:8px;color:var(--text-dim);margin-top:8px">${_t('Tap pour fermer', 'Tap to close')}</div>`
        : `<div style="font-size:9px;color:var(--red)">${_t('Erreur — œuf invalide', 'Error — invalid egg')}</div>
           <div style="font-size:8px;color:var(--text-dim)">${_t('Tap pour fermer', 'Tap to close')}</div>`}`;
    _phase = 'done';
  }

  overlay.addEventListener('click', advance);
}

// ── renderPensionView — merged pension + eggs view ──────────────
function renderPensionView(container) {
  const state = globalThis.state;
  const p = state.pension;
  const now = Date.now();

  const SLOT_PRICES = [0, 0, 50000, 150000, 300000, 500000];
  const maxSlots = globalThis.getMaxPensionSlots();
  const slots = p.slots || [];
  const hasPair = slots.length >= 2;

  const hasScientist = !!state.purchases?.scientist;
  const nurseOwned   = !!state.purchases?.autoIncubator;
  const nurseEnabled = state.purchases?.autoIncubatorEnabled !== false;
  const autoSellOwned   = !!state.purchases?.autoSellEggs;
  const autoSellEnabled = state.purchases?.autoSellEggsEnabled !== false;
  const scEnabled = state.purchases?.scientistEnabled !== false;

  const nextEggMs = (hasPair && p.eggAt) ? Math.max(0, p.eggAt - now) : null;
  const nextEggStr = nextEggMs !== null
    ? (nextEggMs < 60000 ? `${Math.ceil(nextEggMs / 1000)}s` : `${Math.ceil(nextEggMs / 60000)}min`)
    : '--';

  // ── Pension slots grid — tous les slots sont des reproducteurs potentiels ──
  const slotsHtml = slots.map(id => {
    const pk = state.pokemons.find(p2 => p2.id === id);
    if (!pk) return '';
    return `<div class="pension-slot filled" style="position:relative;display:flex;flex-direction:column;align-items:center;padding:10px 6px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);gap:4px">
      <img src="${pokeSprite(pk.species_en, pk.shiny)}" style="width:48px;height:48px;image-rendering:pixelated">
      <div style="font-size:8px;text-align:center;line-height:1.3">${speciesName(pk.species_en)}</div>
      <div style="font-size:8px;color:var(--text-dim)">Lv.${pk.level} ${'★'.repeat(pk.potential)}</div>
      <button class="pension-remove-btn" data-pk-id="${pk.id}" style="margin-top:2px;font-size:7px;padding:2px 6px;background:var(--bg);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--red);cursor:pointer">Retirer</button>
    </div>`;
  }).filter(Boolean);

  for (let i = slots.length; i < maxSlots; i++) {
    slotsHtml.push(`<div class="pension-slot empty" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 6px;background:var(--bg);border:1px dashed var(--border);border-radius:var(--radius-sm);min-height:100px;gap:4px">
      <div style="font-size:20px;opacity:.3">+</div>
      <div style="font-size:8px;color:var(--text-dim);text-align:center">Slot libre</div>
    </div>`);
  }

  const nextSlotCost = SLOT_PRICES[maxSlots] || null;
  const buySlotBtn = (maxSlots < 6 && nextSlotCost !== null)
    ? `<button id="btnBuyPensionSlot" style="font-family:var(--font-pixel);font-size:8px;padding:5px 10px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">+ Slot (${nextSlotCost.toLocaleString()}₽)</button>`
    : '';

  // ── Eggs inventory ──────────────────────────────────────────
  const incubatorCount = state.inventory.incubator || 0;
  const allIncubated   = state.eggs.filter(e => e.incubating);   // ready + in-progress
  const readyEggs      = state.eggs.filter(e => e.status === 'ready');
  const waitingEggs    = state.eggs.filter(e => !e.incubating && e.status !== 'ready');
  const incubatingEggs = allIncubated.filter(e => e.status !== 'ready'); // for legacy compat
  const freeIncubators = Math.max(0, incubatorCount - allIncubated.length);

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
    incubatorHtml = `<div style="font-size:9px;color:var(--text-dim);padding:8px;text-align:center;border:1px dashed var(--border);border-radius:var(--radius-sm)">${_t('Aucun incubateur — achetez-en un au Marché (15 000₽)', 'No incubator — buy one at the Market (15,000₽)')}</div>`;
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
      _incubSlots.push(`
        <div ${isReady ? `data-hatch-egg="${egg.id}"` : ''} style="position:relative;display:flex;flex-direction:column;align-items:center;padding:10px 6px 8px;gap:5px;border:2px solid ${isReady ? 'var(--green)' : 'var(--gold-dim)'};border-radius:var(--radius-sm);background:var(--bg);${isReady ? 'cursor:pointer;animation:eggReadyGlow .8s ease-in-out infinite alternate;' : ''}">
          ${isReady ? `<div style="position:absolute;top:-9px;right:-9px;font-family:var(--font-pixel);font-size:8px;color:var(--bg);background:var(--green);border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;z-index:2;animation:eggReadyBadge .4s ease-in-out infinite alternate">!</div>` : ''}
          ${imgTag}
          <div style="font-size:8px;text-align:center;line-height:1.2;max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${lbl.name}${lbl.shiny}</div>
          <div style="font-size:7px;color:var(--text-dim)">${lbl.pot}</div>
          ${!isReady ? `<div style="background:var(--border);border-radius:2px;height:3px;width:100%;min-width:60px"><div style="background:var(--gold-dim);height:3px;border-radius:2px;width:${pct}%;transition:width .3s"></div></div>` : ''}
          <div style="font-size:8px;color:${isReady ? 'var(--green)' : 'var(--gold)'};font-family:var(--font-pixel)">${remStr}</div>
          ${_revealBtn(egg)}
        </div>`);
    }
    for (let i = allIncubated.length; i < incubatorCount; i++) {
      _incubSlots.push(`
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 8px;gap:5px;border:1px dashed var(--border);border-radius:var(--radius-sm);background:var(--bg);min-height:110px">
          <img src="${globalThis.ITEM_SPRITE_URLS?.incubator || ''}" style="width:28px;height:28px;opacity:.3;image-rendering:pixelated" onerror="this.style.display='none'">
          <div style="font-size:8px;color:var(--text-dim)">${_t('Libre', 'Free')}</div>
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

  // ── Services section (all in one) ───────────────────────────
  const nurseColor    = nurseOwned    ? (nurseEnabled    ? 'var(--green)' : 'var(--border)') : 'var(--border)';
  const autoSellColor = autoSellOwned ? (autoSellEnabled ? 'var(--green)' : 'var(--border)') : 'var(--border)';
  const scColor       = hasScientist  ? (scEnabled       ? 'var(--green)' : 'var(--border)') : 'var(--border)';

  const nurseHtml = `<div style="background:var(--bg);border:1px solid ${nurseColor};border-radius:var(--radius-sm);padding:10px;display:flex;gap:10px;align-items:flex-start">
    <img src="${globalThis.trainerSprite?.('nurse') || ''}" style="width:36px;height:36px;image-rendering:pixelated;flex-shrink:0;${nurseOwned && !nurseEnabled ? 'opacity:.4;filter:grayscale(1)' : ''}" onerror="this.style.display='none'">
    <div style="flex:1">
      <div style="font-family:var(--font-pixel);font-size:8px;color:${nurseOwned ? (nurseEnabled ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:3px">${_t('Infirmière Joëlle corrompue', 'Corrupted Nurse Joy')}</div>
      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">${_t("Auto-incube les œufs dès qu'un incubateur est libre.", 'Automatically incubates eggs as soon as an incubator is free.')}</div>
      ${nurseOwned
        ? `<div style="display:flex;align-items:center;gap:8px">
             <span style="font-family:var(--font-pixel);font-size:7px;color:${nurseEnabled ? 'var(--green)' : 'var(--text-dim)'}">${nurseEnabled ? _t('✓ EN POSTE', '✓ ON DUTY') : _t('✗ CONGÉ', '✗ OFF DUTY')}</span>
             <button id="btnToggleNurse" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid ${nurseEnabled ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${nurseEnabled ? 'var(--red)' : 'var(--green)'};cursor:pointer">${nurseEnabled ? _t('Congé', 'Dismiss') : _t('Rappeler', 'Recall')}</button>
           </div>`
        : `<button id="btnBuyNurse" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">${_t('Embaucher', 'Hire')} — 300 000₽</button>`}
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
            <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">PENSION (${slots.length}/${maxSlots})</div>
            ${buySlotBtn}
            ${slots.length > 0 ? `<button id="btnPensionClearAll" style="margin-left:auto;font-family:var(--font-pixel);font-size:8px;padding:4px 8px;background:var(--bg);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--red);cursor:pointer">${_t('Tout retirer', 'Remove all')}</button>` : ''}
          </div>
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:8px">${_t(`Accouplement aléatoire entre tous les pensionnaires — un œuf toutes les ${EGG_GEN_MS / 60000} min. (min. 2 Pokémon)`, `Random breeding among all Daycare residents — one egg every ${EGG_GEN_MS / 60000} min. (min. 2 Pokémon)`)}</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${slotsHtml.join('')}</div>
          ${hasPair ? `<div style="margin-top:8px;font-size:9px;color:var(--text-dim);padding:6px 8px;background:var(--bg);border-radius:var(--radius-sm)">${_t('Prochain œuf dans :', 'Next egg in:')} <b style="color:var(--gold)">${nextEggStr}</b></div>` : ''}
        </div>

        <!-- Ready eggs -->
        ${readyEggs.length > 0 ? `
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="font-family:var(--font-pixel);font-size:10px;color:var(--green)">🥚 ${_t('PRÊTS À ÉCLORE', 'READY TO HATCH')} (${readyEggs.length})</div>
            <button id="btnHatchAll" style="margin-left:auto;font-family:var(--font-pixel);font-size:8px;padding:4px 10px;background:var(--bg);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--green);cursor:pointer">${_t('Faire éclore', 'Hatch')} ▶</button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${readyEggs.map(egg => {
              const lbl = _eggLabel(egg);
              const imgTag = globalThis.eggImgTag?.(egg, false, 'width:40px;height:40px;image-rendering:pixelated') || '🥚';
              return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;background:var(--bg);border:1px solid var(--green);border-radius:var(--radius-sm);min-width:70px;position:relative">
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
          <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold);margin-bottom:8px">INCUBATEURS (${allIncubated.length}/${incubatorCount})</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px">${incubatorHtml || `<div style="font-size:9px;color:var(--text-dim);text-align:center;padding:8px">${_t('Aucun incubateur — achetez-en un au Marché', 'No incubator — buy one at the Market')}</div>`}</div>
        </div>

        <!-- Waiting eggs -->
        ${waitingEggs.length > 0 ? `
        <div>
          <div style="font-family:var(--font-pixel);font-size:10px;color:var(--text-dim);margin-bottom:8px">${_t("EN ATTENTE D'INCUBATION", 'WAITING FOR INCUBATION')} (${waitingEggs.length})</div>
          <div style="display:flex;flex-direction:column;gap:6px">${waitingEggsHtml}</div>
        </div>` : ''}

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
    state.pension.eggAt = null;
    saveState();
    notify(_t('Pension vidée.', 'Daycare cleared.'), 'success');
    renderPensionView(container);
  });

  container.querySelector('#btnBuyPensionSlot')?.addEventListener('click', () => {
    const cost = SLOT_PRICES[maxSlots];
    if (state.gang.money < cost) { notify(_t('Fonds insuffisants.', 'Insufficient funds.'), 'error'); return; }
    state.gang.money -= cost;
    EventBus.emit(EVENTS.MONEY_CHANGED, { delta: -cost, newTotal: state.gang.money });
    state.pension.extraSlotsPurchased = (state.pension.extraSlotsPurchased || 0) + 1;
    saveState();
    _topBar();
    notify(_t(`Slot de pension débloqué ! (${globalThis.getMaxPensionSlots()} slots)`, `Daycare slot unlocked! (${globalThis.getMaxPensionSlots()} slots)`), 'gold');
    renderPensionView(container);
  });

  container.querySelector('#btnHatchAll')?.addEventListener('click', () => openHatchPopup());

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
    state.purchases.autoIncubatorEnabled = !nurseEnabled;
    saveState();
    notify(state.purchases.autoIncubatorEnabled
      ? _t('💉 Joëlle est de retour !', '💉 Joy is back!')
      : _t('😴 Joëlle est en congé.', '😴 Joy is off duty.'), 'success');
    renderPensionView(container);
  });

  container.querySelector('#btnBuyNurse')?.addEventListener('click', () => {
    if (state.gang.money < 300000) { notify(_t('Fonds insuffisants.', 'Insufficient funds.'), 'error'); return; }
    globalThis.showConfirm?.(_t("Embaucher l'Infirmière Joëlle corrompue pour 300 000₽ ? (permanent)", 'Hire Corrupted Nurse Joy for 300,000₽? (permanent)'), () => {
      state.gang.money -= 300000;
      EventBus.emit(EVENTS.MONEY_CHANGED, { delta: -300000, newTotal: state.gang.money });
      state.purchases.autoIncubator = true;
      state.purchases.autoIncubatorEnabled = true;
      saveState();
      _topBar();
      notify(_t('💉 Joëlle est en poste !', '💉 Joy is on duty!'), 'gold');
      globalThis.tryAutoIncubate?.();
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
      const before = state.pension.slots.length;
      state.pension.slots = state.pension.slots.filter(sid => sid !== id);
      if (state.pension.slots.length < before) state.pension.eggAt = null;
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
      egg.incubating = true;
      egg.hatchAt = Date.now() + (EGG_HATCH_MS[rarity] || EGG_HATCH_MS.common);
      saveState();
      notify(_t("Œuf placé dans l'incubateur !", 'Egg placed in the incubator!'), 'success');
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

Object.assign(globalThis, { EGG_HATCH_MS, EGG_GEN_MS, pensionTick, renderPensionView, openHatchPopup, openHatchAnimation });
export {};
