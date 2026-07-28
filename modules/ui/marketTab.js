'use strict';

import { BALLS, SHOP_ITEMS } from '../../data/economy-data.js';
import { esc as _esc } from '../core/escape.js';
import { getActiveMarketEvents } from '../systems/marketEvents.js';
import { EventBus, EVENTS } from '../core/eventBus.js';
import { getCurrentBulletin, completeBlackMarketListing } from '../systems/blackMarket.js';

const _t = (...a) => globalThis.t?.(...a) ?? a[0];

// ════════════════════════════════════════════════════════════════
// 16.  UI — MARKET TAB
// ════════════════════════════════════════════════════════════════

function renderMarketTab() {
  renderSpecialItemPanel();
  renderShopPanel();
  renderBarterPanel();
  renderBlackMarketPanel();
}

// ── BLACK MARKET BULLETIN ─────────────────────────────────────────
function renderBlackMarketPanel() {
  const panel = document.querySelector('#blackMarketPanel .bm-bulletin');
  if (!panel) return;

  const bulletin = getCurrentBulletin();
  const events   = getActiveMarketEvents();

  const _fmtRemaining = ms => {
    if (ms <= 0) return _t('market_expired');
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${m}min`;
  };
  const bulletinRemaining = bulletin ? _fmtRemaining(bulletin.expiresAt - Date.now()) : '—';

  const eventsHtml = events.length ? `
    <div class="bm-events-section">
      <div class="bm-section-label">${_t('market_bm_events')}</div>
      ${events.map(ev => `
        <div class="bm-event" style="border-color:${ev.type.includes('malus') || ev.type === 'shiny_crash' ? '#e57373' : 'var(--gold)'}">
          <span class="bm-event-emoji">${ev.emoji}</span>
          <div class="bm-event-body">
            <div class="bm-event-label">${_esc(ev.label)}</div>
            <div class="bm-event-detail">${_esc(ev.detail)}</div>
          </div>
          <div class="bm-event-timer">${_fmtRemaining(ev.expiresAt - Date.now())}</div>
        </div>
      `).join('')}
    </div>` : '';

  const ITEM_LABELS = {
    masterball: _t('market_item_masterball'),
    ultraball: _t('market_item_ultraball'),
    evostone: _t('market_item_evostone'),
    aura: _t('market_item_aura'),
  };
  const state = globalThis.state;
  const listingsHtml = (bulletin?.listings || []).map(listing => {
    const isDone = listing.completed;
    const r = listing.reward || {};
    const rewardParts = [];
    if (r.money) rewardParts.push(`<span class="bm-reward-money">${r.money.toLocaleString()}₽</span>`);
    if (r.rep)   rewardParts.push(`<span class="bm-reward-rep">+${r.rep} ⭐</span>`);
    if (r.items) {
      for (const [iid, qty] of Object.entries(r.items)) {
        if (!qty) continue;
        rewardParts.push(`<span class="bm-reward-item">${qty}× ${ITEM_LABELS[iid] || iid}</span>`);
      }
    }
    if (r.rareBoost) rewardParts.push(`<span class="bm-reward-boost">×3 rares ${Math.round(r.rareBoost / 3600000)}h</span>`);
    let progressBar = '';
    if (listing.type === 'trainer_bounty' && !isDone) {
      const progress = state.bountyProgress?.[listing.id] || 0;
      const pct = Math.min(100, (progress / listing.qty) * 100);
      progressBar = `
        <div class="bm-progress-bar">
          <div class="bm-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="bm-progress-label">${progress} / ${listing.qty}</div>`;
    }
    return `
      <div class="bm-listing ${isDone ? 'done' : ''}">
        <div class="bm-listing-head">
          <span class="bm-listing-emoji">${listing.emoji}</span>
          <span class="bm-listing-label">${_esc(listing.label)}</span>
          ${isDone ? `<span class="bm-listing-done">${_t('market_bm_done')}</span>` : ''}
        </div>
        <div class="bm-listing-detail">${_esc(listing.detail)}</div>
        ${progressBar}
        <div class="bm-listing-foot">
          <span class="bm-listing-reward">🎁 ${rewardParts.join(' · ')}</span>
          ${!isDone ? `<button class="bm-listing-claim" data-bm-id="${listing.id}">${_t('market_bm_deliver')}</button>` : ''}
        </div>
      </div>`;
  }).join('');

  panel.innerHTML = `
    <div class="bm-header">
      <span class="bm-header-sub">${_t('market_bm_renewal', { t: bulletinRemaining })}</span>
    </div>
    ${eventsHtml}
    <div class="bm-listings">
      ${listingsHtml || `<div class="bm-empty">${_t('market_bm_no_listings')}</div>`}
    </div>`;

  panel.querySelectorAll('.bm-listing-claim').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.bmId;
      const ok = completeBlackMarketListing(id);
      if (ok) {
        renderBlackMarketPanel();
        globalThis.updateTopBar?.();
      }
    });
  });
}

// ── Troc d'objets ───────────────────────────────────────────────
const BARTER_RECIPES = [
  ['lure',       5, 'superlure',  1,   { fr:'5 Leurres → 1 Super Leurre',      en:'5 Lures → 1 Super Lure'       }],
  ['superlure',  3, 'evostone',   1,   { fr:'3 Super Leurres → 1 Pierre Évol.', en:'3 Super Lures → 1 Evo Stone'  }],
  ['incense',    3, 'aura',       1,   { fr:'3 Encens → 1 Aura Shiny',          en:'3 Incense → 1 Shiny Aura'     }],
];

function renderBarterPanel() {
  const panel = document.querySelector('#barterPanel .barter-list');
  if (!panel) return;
  const state = globalThis.state;
  const lang  = state?.lang || 'fr';
  const recipes = BARTER_RECIPES;

  const recipesHtml = recipes.map((r, i) => {
    const [giveId, giveQty, getId, getQty, labelObj] = r;
    const label = lang === 'fr' ? labelObj.fr : labelObj.en;
    const owned = state.inventory?.[giveId] || 0;
    const canAfford = owned >= giveQty;
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--border);opacity:${canAfford ? 1 : 0.5}">
      ${itemSprite(giveId)}
      <div style="flex:1;font-size:9px;color:var(--text)">${label}</div>
      <div style="font-size:8px;color:${canAfford ? 'var(--gold-dim)' : 'var(--text-dim)'}">×${owned}</div>
      <button data-barter="${i}" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:${canAfford ? 'var(--bg-hover)' : 'var(--bg)'};border:1px solid ${canAfford ? 'var(--gold-dim)' : 'var(--border)'};border-radius:var(--radius-sm);color:${canAfford ? 'var(--gold)' : 'var(--text-dim)'};cursor:${canAfford ? 'pointer' : 'default'}" ${canAfford ? '' : 'disabled'}>${_t('market_barter_trade')}</button>
    </div>`;
  }).join('');

  const WING_EXCHANGES = [
    { giveId:'silver_wing',  giveQty:2, getId:'rainbow_wing', getQty:1, label:{ fr:"2 Argent'Ailes \u2192 1 Arcenci'Aile", en:"2 Silver Wings \u2192 1 Rainbow Wing" } },
    { giveId:'rainbow_wing', giveQty:2, getId:'silver_wing',  getQty:1, label:{ fr:"2 Arcenci'Ailes \u2192 1 Argent'Aile", en:"2 Rainbow Wings \u2192 1 Silver Wing" } },
    { giveId:'rainbow_wing', giveQty:5, getId:'plume_sacree', getQty:1, label:{ fr:"5 Arcenci'Ailes \u2192 1 Plume Sacr\u00e9e", en:"5 Rainbow Wings \u2192 1 Sacred Feather" } },
    { giveId:'silver_wing',  giveQty:5, getId:'plume_sacree', getQty:1, label:{ fr:"5 Argent'Ailes \u2192 1 Plume Sacr\u00e9e", en:"5 Silver Wings \u2192 1 Sacred Feather" } },
  ];
  const wingExchangeHtml = `
    <div style="padding:8px 4px 4px;border-top:2px solid var(--border);margin-top:2px">
      <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold);margin-bottom:6px;letter-spacing:1px">${_t('market_wing_section')}</div>
      ${WING_EXCHANGES.map((wx, i) => {
        const owned = state.inventory?.[wx.giveId] || 0;
        const canAfford = owned >= wx.giveQty;
        const label = lang === 'fr' ? wx.label.fr : wx.label.en;
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--border);opacity:${canAfford ? 1 : 0.5}">
          ${itemSprite(wx.giveId)}
          <div style="flex:1;font-size:9px;color:var(--text)">${label}</div>
          <div style="font-size:8px;color:${canAfford ? 'var(--gold-dim)' : 'var(--text-dim)'}">×${owned}</div>
          <button data-wing-barter="${i}" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:${canAfford ? 'var(--bg-hover)' : 'var(--bg)'};border:1px solid ${canAfford ? 'var(--gold-dim)' : 'var(--border)'};border-radius:var(--radius-sm);color:${canAfford ? 'var(--gold)' : 'var(--text-dim)'};cursor:${canAfford ? 'pointer' : 'default'}" ${canAfford ? '' : 'disabled'}>${_t('market_barter_trade')}</button>
        </div>`;
      }).join('')}
    </div>`;

  const WING_PERMITS = [
    { permitId:'tourbillon_permit', wingId:'silver_wing',  wingName:{ fr:"Argent'Aile",  en:'Silver Wing'  }, wingQty:50, zoneName:{ fr:'\u00celes Tourbillon', en:'Whirl Islands' }, icon:'\ud83c\udf0a', legendary:'Lugia' },
    { permitId:'carillon_permit',   wingId:'rainbow_wing', wingName:{ fr:"Arcenci'Aile", en:'Rainbow Wing' }, wingQty:50, zoneName:{ fr:'Tour Carillon',   en:'Bell Tower'    }, icon:'\ud83d\udd14', legendary:'Ho-Oh'  },
  ];
  const wingZonesHtml = `
    <div style="padding:8px 4px 4px;border-top:2px solid var(--border);margin-top:2px">
      <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold);margin-bottom:6px;letter-spacing:1px">${_t('market_wing_zones')}</div>
      ${WING_PERMITS.map(wp => {
        const have = state.inventory?.[wp.wingId] || 0;
        const alreadyOwned = !!state.purchases?.[wp.permitId];
        const canBuy = !alreadyOwned && have >= wp.wingQty;
        const pct = Math.min(100, Math.round(have / wp.wingQty * 100));
        const progressColor = alreadyOwned ? 'var(--green)' : have >= wp.wingQty ? 'var(--gold)' : 'var(--red)';
        const wName = lang === 'fr' ? wp.wingName.fr : wp.wingName.en;
        const zName = lang === 'fr' ? wp.zoneName.fr : wp.zoneName.en;
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--border);opacity:${alreadyOwned ? 0.6 : 1}">
          ${itemSprite(wp.wingId)}
          <div style="flex:1">
            <div style="font-size:9px;color:var(--text)">${wp.wingQty}× ${wName} → ${wp.icon} ${zName}</div>
            <div style="font-size:8px;color:var(--text-dim);margin-top:2px">${_t('market_legendary')} : ${wp.legendary}</div>
            <div style="height:4px;background:var(--border);border-radius:2px;margin-top:4px;overflow:hidden">
              <div style="height:100%;width:${alreadyOwned ? 100 : pct}%;background:${progressColor};border-radius:2px;transition:width .3s"></div>
            </div>
            <div style="font-size:8px;color:${progressColor};margin-top:2px">${alreadyOwned ? _t('market_zone_unlocked') : `${have} / ${wp.wingQty} ${wName}`}</div>
          </div>
          <button data-wing-permit="${wp.permitId}" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:${canBuy ? 'var(--bg-hover)' : 'var(--bg)'};border:1px solid ${canBuy ? 'var(--gold-dim)' : 'var(--border)'};border-radius:var(--radius-sm);color:${alreadyOwned ? 'var(--green)' : canBuy ? 'var(--gold)' : 'var(--text-dim)'};cursor:${canBuy ? 'pointer' : 'default'}" ${canBuy ? '' : 'disabled'}>${alreadyOwned ? _t('market_acquired') : _t('market_exchange')}</button>
        </div>`;
      }).join('')}
    </div>`;

  panel.innerHTML = recipesHtml + wingExchangeHtml + wingZonesHtml;

  panel.querySelectorAll('[data-barter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [giveId, giveQty, getId, getQty] = recipes[parseInt(btn.dataset.barter)];
      if ((state.inventory?.[giveId] || 0) < giveQty) { SFX.play('error'); return; }
      state.inventory[giveId] -= giveQty;
      state.inventory[getId] = (state.inventory[getId] || 0) + getQty;
      EventBus.emit(EVENTS.ITEM_RECEIVED, { itemId: getId, qty: getQty });
      saveState(); updateTopBar(); SFX.play('buy');
      notify(_t('market_barter_done'), 'success');
      renderBarterPanel();
    });
  });

  panel.querySelectorAll('[data-wing-barter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const wx = WING_EXCHANGES[parseInt(btn.dataset.wingBarter)];
      if (!wx) return;
      if ((state.inventory?.[wx.giveId] || 0) < wx.giveQty) { SFX.play('error'); return; }
      state.inventory[wx.giveId] -= wx.giveQty;
      state.inventory[wx.getId] = (state.inventory[wx.getId] || 0) + wx.getQty;
      EventBus.emit(EVENTS.ITEM_RECEIVED, { itemId: wx.getId, qty: wx.getQty });
      saveState(); updateTopBar(); SFX.play('buy');
      notify(_t('market_wing_done'), 'success');
      renderBarterPanel();
    });
  });

  panel.querySelectorAll('[data-wing-permit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const permitId = btn.dataset.wingPermit;
      const itemDef = SHOP_ITEMS.find(s => s.id === permitId);
      if (!itemDef) return;
      if (buyItem(itemDef)) {
        SFX.play('buy');
        renderBarterPanel();
        renderShopPanel();
        if (activeTab === 'tabZones') renderZonesTab();
      }
    });
  });
}

// ── Special Item Panel ───────────────────────────────────────────
function renderSpecialItemPanel() {
  const panel = document.querySelector('#specialItemPanel .special-list');
  if (!panel) return;
  const state = globalThis.state;
  const lang  = state?.lang || 'fr';

  const ZONE_UNLOCK_IDS   = new Set(['map_pallet','casino_ticket','silph_keycard','boat_ticket','tourbillon_permit','carillon_permit','rocket_hq_keycard','rocket_uniform','silver_permit']);
  const WING_PERMIT_IDS   = new Set(['tourbillon_permit','carillon_permit']);
  const ACHIEVEMENT_IDS   = new Set(['rocket_hq_keycard','rocket_uniform']);
  const items = SHOP_ITEMS.filter(item => ZONE_UNLOCK_IDS.has(item.id));

  const html = items.map(item => {
    const alreadyOwned  = state.purchases?.[item.id];
    const isWingPermit  = WING_PERMIT_IDS.has(item.id);
    const isAchievement = ACHIEVEMENT_IDS.has(item.id);
    const wingHave = isWingPermit ? (state.inventory[item.wingCost?.item] || 0) : 0;
    const wingName = isWingPermit
      ? (item.wingCost?.item === 'silver_wing' ? (lang==='fr' ? "Argent'Aile" : 'Silver Wing') : (lang==='fr' ? "Arcenci'Aile" : 'Rainbow Wing'))
      : '';
    const isSilverPermit = item.id === 'silver_permit';
    const kantoGyms = globalThis.GYM_ORDER ?? [];
    const johtoGyms = globalThis.JOHTO_GYM_ORDER ?? [];
    const allGymsOk = isSilverPermit
      ? [...kantoGyms, ...johtoGyms].every(id => state.zones?.[id]?.gymDefeated)
      : true;
    const btnDisabled = alreadyOwned
      || (isWingPermit && wingHave < (item.wingCost?.qty || 50))
      || isAchievement
      || (isSilverPermit && !allGymsOk);
    const btnLabel = alreadyOwned
      ? _t('market_acquired')
      : isAchievement
        ? _t('market_achievement')
        : isWingPermit
          ? `${item.wingCost?.qty||50}\u00d7 ${wingName}`
          : `${item.cost.toLocaleString()}\u20bd`;
    const desc = lang === 'fr' ? item.desc_fr : item.desc_en;
    let statusHtml;
    if (alreadyOwned) {
      statusHtml = `<div style="font-size:10px;color:var(--green)">${_t('market_zone_unlocked')}</div>`;
    } else if (isAchievement) {
      const stat   = item.achievement?.stat  || 'rocketDefeatedJohto';
      const target = item.achievement?.target || 50;
      const curr   = state.stats?.[stat] || 0;
      const pct    = Math.min(100, Math.round(curr / target * 100));
      statusHtml = `
        <div style="font-size:9px;color:var(--text-dim);margin-top:3px">${_t('market_agents_defeated', { curr, target })}</div>
        <div style="height:3px;background:var(--border);border-radius:2px;margin-top:4px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:var(--red);transition:width .3s"></div></div>`;
    } else if (isWingPermit) {
      statusHtml = `<div style="font-size:10px;color:${wingHave>=(item.wingCost?.qty||50)?'var(--gold)':'var(--red)'}">
            ${wingName} : ${wingHave}/${item.wingCost?.qty||50}</div>`;
    } else if (isSilverPermit) {
      statusHtml = allGymsOk
        ? `<div style="font-size:10px;color:var(--gold)">${_t('market_gyms_ok')}</div>`
        : `<div style="font-size:10px;color:var(--red)">${_t('market_gyms_required')}</div>`;
    } else {
      statusHtml = `<div style="font-size:10px;color:var(--text-dim)">${_t('market_zone_unlock')}</div>`;
    }
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 4px;border-bottom:1px solid var(--border);opacity:${btnDisabled?'0.6':'1'}">
      ${itemSprite(item.id)}
      <div style="flex:1">
        <div style="font-size:12px">${lang==='fr' ? item.fr : item.en}</div>
        <div style="font-size:9px;color:var(--text-dim);margin-top:2px">${desc}</div>
        ${statusHtml}
      </div>
      <button style="font-family:var(--font-pixel);font-size:9px;padding:6px 10px;background:var(--bg);
        border:1px solid ${btnDisabled?'var(--border)':'var(--gold-dim)'};border-radius:var(--radius-sm);
        color:${btnDisabled?'var(--text-dim)':'var(--gold)'};cursor:${btnDisabled?'default':'pointer'};white-space:nowrap"
        data-zone-item-idx="${SHOP_ITEMS.indexOf(item)}" ${btnDisabled?'disabled':''}>${btnLabel}</button>
    </div>`;
  }).join('');

  panel.innerHTML = html || `<div style="color:var(--text-dim);font-size:10px;padding:12px">${_t('market_no_access')}</div>`;

  panel.querySelectorAll('[data-zone-item-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = SHOP_ITEMS[parseInt(btn.dataset.zoneItemIdx)];
      if (!item || btn.disabled) return;
      buyItem(item);
      updateTopBar();
      renderSpecialItemPanel();
      if (activeTab === 'tabZones') renderZoneWindows();
    });
  });
}

let shopMultiplier = 1;

function renderShopPanel() {
  const panel = document.querySelector('#shopPanel .shop-list');
  if (!panel) return;
  const state = globalThis.state;
  const lang  = state?.lang || 'fr';

  const ZONE_UNLOCK_ITEM_IDS = new Set(['map_pallet','casino_ticket','silph_keycard','boat_ticket','tourbillon_permit','carillon_permit','rocket_hq_keycard','rocket_uniform','silver_permit']);
  const ONE_OFF_IDS   = new Set(['mysteryegg','incubator','translator']);
  const WING_PERMIT_IDS = new Set(['tourbillon_permit','carillon_permit']);
  const shopItems = SHOP_ITEMS.filter(item => !ZONE_UNLOCK_ITEM_IDS.has(item.id) && !item.ballSkin);

  const multBar = [1,5,10,100].map(m =>
    `<button class="shop-mult-btn" data-mult="${m}" style="font-family:var(--font-pixel);font-size:9px;padding:4px 10px;border-radius:var(--radius-sm);cursor:pointer;
      background:${shopMultiplier===m?'var(--gold-dim)':'var(--bg)'};
      border:1px solid ${shopMultiplier===m?'var(--gold)':'var(--border)'};
      color:${shopMultiplier===m?'#0a0a0a':'var(--text)'}"
    >\u00d7${m}</button>`
  ).join('');

  const itemsHtml = shopItems.map(item => {
    const ballInfo  = BALLS[item.id];
    const name      = ballInfo ? (lang === 'fr' ? ballInfo.fr : ballInfo.en) : (lang === 'fr' ? (item.fr || item.id) : (item.en || item.id));
    const owned     = state.inventory[item.id] || 0;
    const isOneOff  = ONE_OFF_IDS.has(item.id);
    const mult      = isOneOff ? 1 : shopMultiplier;
    const baseCost  = item.id === 'mysteryegg' ? getMysteryEggCost()
      : item.id === 'incubator' ? Math.round(15000 * Math.pow(2, owned))
      : item.cost;
    const totalCost = baseCost * mult;
    const totalQty  = item.qty * mult;
    const isUnlockItem  = ZONE_UNLOCK_ITEM_IDS.has(item.id);
    const alreadyOwned  = isUnlockItem && state.purchases?.[item.id];
    const incubatorMaxed = item.id === 'incubator' && owned >= 10;
    const desc = item.desc_fr
      ? (lang === 'fr' ? item.desc_fr : item.desc_en)
      : `\u00d7${totalQty}`;
    const isWingPermit = WING_PERMIT_IDS.has(item.id);
    const wingHave = isWingPermit ? (state.inventory[item.wingCost?.item] || 0) : 0;
    const wingName = isWingPermit
      ? (item.wingCost?.item === 'silver_wing' ? (lang==='fr' ? "Argent'Aile" : 'Silver Wing') : (lang==='fr' ? "Arcenci'Aile" : 'Rainbow Wing'))
      : '';
    const extraInfo = item.id === 'mysteryegg'
      ? `<div style="font-size:9px;color:var(--text-dim)">${_t('market_egg_hint', { n: (state.purchases?.mysteryEggCount||0)+1 })}</div>`
      : item.id === 'incubator'
        ? `<div style="font-size:10px;color:var(--text-dim)">${_t('market_incubator_owned', { n: owned })}${incubatorMaxed ? ` <span style="color:var(--red)">${_t('market_incubator_max')}</span>` : ''}</div>`
        : isWingPermit
          ? `<div style="font-size:10px;color:${alreadyOwned?'var(--green)':wingHave>=(item.wingCost?.qty||50)?'var(--gold)':'var(--red)'}">
              ${alreadyOwned ? _t('market_owned') : `${wingName} : ${wingHave}/${item.wingCost?.qty||50}`}
             </div>`
          : isUnlockItem
            ? `<div style="font-size:10px;color:${alreadyOwned?'var(--green)':'var(--text-dim)'}">${alreadyOwned ? _t('market_owned') : _t('market_zone_unlock')}</div>`
            : `<div style="font-size:10px;color:var(--text-dim)">${_t('market_stock', { n: owned })}${!isOneOff && mult>1 ? ` (+${totalQty})` : ''}</div>`;
    const btnDisabled = alreadyOwned || incubatorMaxed || (isWingPermit && wingHave < (item.wingCost?.qty || 50));
    const btnLabel = (alreadyOwned || incubatorMaxed)
      ? (incubatorMaxed ? _t('market_incubator_max') : _t('market_acquired'))
      : isWingPermit
        ? `${item.wingCost?.qty||50}\u00d7 ${wingName}`
        : `${totalCost.toLocaleString()}\u20bd${mult>1&&!isOneOff ? ` \u00d7${mult}` : ''}`;
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 4px;border-bottom:1px solid var(--border);opacity:${btnDisabled?'0.6':'1'}">
      ${itemSprite(item.id)}
      <div style="flex:1">
        <div style="font-size:12px">${name} <span style="color:var(--text-dim)">(${desc})</span></div>
        ${extraInfo}
      </div>
      <button style="font-family:var(--font-pixel);font-size:9px;padding:6px 10px;background:var(--bg);
        border:1px solid ${btnDisabled?'var(--border)':'var(--gold-dim)'};border-radius:var(--radius-sm);
        color:${btnDisabled?'var(--text-dim)':'var(--gold)'};cursor:${btnDisabled?'default':'pointer'};white-space:nowrap"
        data-shop-idx="${SHOP_ITEMS.indexOf(item)}" data-shop-mult="${mult}" ${btnDisabled?'disabled':''}>${btnLabel}</button>
    </div>`;
  }).join('');

  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;padding:6px 4px 8px;border-bottom:1px solid var(--border)">
      <span style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim)">${_t('market_quantity')}</span>
      ${multBar}
    </div>
    ${itemsHtml}`;

  panel.querySelectorAll('.shop-mult-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      shopMultiplier = parseInt(btn.dataset.mult);
      renderShopPanel();
    });
  });
  panel.querySelectorAll('[data-shop-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = SHOP_ITEMS[parseInt(btn.dataset.shopIdx)];
      const mult = parseInt(btn.dataset.shopMult) || 1;
      if (!item || btn.disabled) return;
      buyItemBulk(item, mult);
      updateTopBar();
      renderShopPanel();
      if (activeTab === 'tabZones') renderZoneWindows();
    });
  });
}


Object.assign(globalThis, { renderMarketTab, renderBarterPanel, renderSpecialItemPanel, renderShopPanel });
export { renderMarketTab, renderBarterPanel, renderSpecialItemPanel, renderShopPanel };
