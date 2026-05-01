// ════════════════════════════════════════════════════════════════
//  GANG BASE MODULE
//  Extracted from app.js — gang base window, codex, export card
// ════════════════════════════════════════════════════════════════
//
//  Globals read from app.js via globalThis:
//    state, notify, saveState, renderZoneWindows
//    speciesName, pokeSprite, trainerSprite, itemSprite, pokemonDisplayName
//    getPokemonPower, calculateStats, calculatePrice
//    isBoostActive, boostRemaining, activateBoost
//    openTeamPicker, openRareCandyPicker, switchTab
//    getBossFullTitle, getTitleLabel
//    getDexKantoCaught, getDexNationalCaught, getShinySpeciesCount
//    sanitizeSpriteName
//    BASE_PRICE, POTENTIAL_MULT, COSMETIC_BGS, ZONE_BGS
//    KANTO_DEX_SIZE, NATIONAL_DEX_SIZE
//
//  Classic-script globals accessed by bare name:
//    ZONES, ZONE_BY_ID, SPECIES_BY_EN
//
//  ES module imports:
//    FALLBACK_TRAINER_SVG (from data/assets-data.js)
//    MUSIC_TRACKS         (from data/music-data.js — if present)
// ════════════════════════════════════════════════════════════════

import { FALLBACK_TRAINER_SVG } from '../../data/assets-data.js';

/* globals ZONES, ZONE_BY_ID, SPECIES_BY_EN */

// ── Gang Base Window ──────────────────────────────────────────

let _boostMult = 1; // multiplicateur actif pour les boosts (x1/x5/x10)

function renderGangBasePanel() {
  const gangContainer = document.getElementById('gangBaseContainer');
  if (!gangContainer) return;
  const gangHtml = renderGangBaseWindow();
  const existingBase = gangContainer.querySelector('#gangBaseWin');
  if (existingBase) {
    const tmp = document.createElement('div');
    tmp.innerHTML = gangHtml;
    gangContainer.replaceChild(tmp.firstElementChild, existingBase);
  } else {
    gangContainer.innerHTML = gangHtml;
  }
  bindGangBase(gangContainer);
}

function renderGangBaseWindow() {
  const state = globalThis.state;
  const pokeSprite    = globalThis.pokeSprite;
  const trainerSprite = globalThis.trainerSprite;
  const speciesName   = globalThis.speciesName;
  const itemSprite    = globalThis.itemSprite;
  const isBoostActive = globalThis.isBoostActive;
  const boostRemaining= globalThis.boostRemaining;
  const getPokemonPower = globalThis.getPokemonPower;

  // ── Boss team slots
  const bossTeamHtml = [0, 1, 2].map(i => {
    const pkId = state.gang.bossTeam[i];
    const pk = pkId ? state.pokemons.find(p => p.id === pkId) : null;
    if (pk) {
      return `<div class="base-team-slot filled" data-boss-slot="${i}" title="${speciesName(pk.species_en)} Lv.${pk.level}">
        <img src="${pokeSprite(pk.species_en, pk.shiny)}" alt="${speciesName(pk.species_en)}">
      </div>`;
    }
    return `<div class="base-team-slot" data-boss-slot="${i}" title="${state.lang === 'fr' ? 'Assigner un Pokémon' : 'Assign a Pokémon'}">+</div>`;
  }).join('');

  // ── Glass background: top Pokémon + agents floutés
  const _BG_POSITIONS = [
    {left:'6%',bottom:'28%'},{left:'18%',bottom:'58%'},{left:'32%',bottom:'18%'},
    {left:'48%',bottom:'50%'},{left:'62%',bottom:'68%'},{left:'76%',bottom:'26%'},
    {left:'86%',bottom:'46%'},{left:'12%',bottom:'78%'},{left:'42%',bottom:'74%'},
    {left:'58%',bottom:'12%'},{left:'28%',bottom:'44%'},{left:'70%',bottom:'82%'},
  ];
  const _bgPokes = [...state.pokemons].sort((a, b) => getPokemonPower(b) - getPokemonPower(a)).slice(0, 12);
  const _bgPokeHtml = _bgPokes.map((p, i) => {
    const pos = _BG_POSITIONS[i % _BG_POSITIONS.length];
    const sz = i < 3 ? 48 : i < 6 ? 36 : 28;
    return `<img src="${pokeSprite(p.species_en, p.shiny)}" style="position:absolute;left:${pos.left};bottom:${pos.bottom};width:${sz}px;height:${sz}px;image-rendering:pixelated;opacity:.35;filter:brightness(.5)" alt="">`;
  }).join('');
  const _agentPositions = [{left:'4%',bottom:'4%'},{left:'72%',bottom:'4%'},{left:'22%',bottom:'4%'},{left:'50%',bottom:'4%'},{left:'88%',bottom:'4%'}];
  const _bgAgentHtml = state.agents.slice(0, 5).map((a, i) => {
    const pos = _agentPositions[i];
    return `<img src="${a.sprite}" style="position:absolute;left:${pos.left};bottom:${pos.bottom};width:30px;height:30px;image-rendering:pixelated;opacity:.28;filter:brightness(.45)" onerror="this.src='${trainerSprite('acetrainer')}'" alt="">`;
  }).join('');

  // ── Item tiles
  const BALL_IDS  = ['pokeball','greatball','ultraball','duskball','masterball'];
  const BOOST_IDS = ['lure','superlure','incense','rarescope','aura'];
  const CRAFT_IDS = ['rarecandy','evostone'];
  const KEY_IDS   = ['incubator','map_pallet','casino_ticket','silph_keycard','boat_ticket'];

  function makeItemTile(id) {
    const qty      = state.inventory?.[id] || 0;
    const isBall   = BALL_IDS.includes(id);
    const isBoost  = BOOST_IDS.includes(id);
    const isActive = isBall && state.activeBall === id;
    const isBoosted= isBoost && isBoostActive(id);
    const owned    = qty > 0;
    const remStr   = isBoosted ? `<span class="base-item-rem">${Math.ceil(boostRemaining(id))}s</span>` : '';
    const qtyBadge = owned
      ? `<span class="base-item-qty">${qty > 99 ? '99+' : '×'+qty}</span>`
      : `<span class="base-item-qty" style="color:var(--text-dim);opacity:.4">0</span>`;
    return `<div class="base-item-tile${isActive ? ' active' : ''}${isBoosted ? ' boosted' : ''}" data-bag-item="${id}" title="${id} ×${qty}">
      <div class="base-item-sprite${owned ? '' : ' locked'}">${itemSprite(id)}</div>
      ${qtyBadge}${remStr}
    </div>`;
  }

  function makeKeyTile(id) {
    const qty   = state.inventory?.[id] || 0;
    const owned = qty > 0;
    const badge = owned
      ? `<span class="base-item-qty" style="color:var(--green)">✓</span>`
      : `<span class="base-item-qty" style="color:var(--text-dim);opacity:.35">✗</span>`;
    return `<div class="base-item-tile${owned ? '' : ' locked-key'}" data-bag-item="${id}" title="${id}${owned ? ' — Obtenu' : ' — Non obtenu'}">
      <div class="base-item-sprite${owned ? '' : ' locked'}">${itemSprite(id)}</div>
      ${badge}
    </div>`;
  }

  const ballsHtml  = BALL_IDS.map(makeItemTile).join('');
  const boostsHtml = BOOST_IDS.map(makeItemTile).join('');
  const craftHtml  = CRAFT_IDS.map(makeItemTile).join('');
  const keysHtml   = KEY_IDS.map(makeKeyTile).join('');

  // ── Incubator slots
  const incCount       = state.inventory?.incubator || 0;
  const eggs           = state.eggs || [];
  const incubatingEggs = eggs.filter(e => e.incubating);
  const waitingEggs    = eggs.filter(e => !e.incubating);
  const now            = Date.now();

  let incSlotsHtml = '';
  if (incCount > 0) {
    for (let i = 0; i < incCount; i++) {
      const egg = incubatingEggs[i];
      if (egg) {
        const isReady   = egg.status === 'ready';
        const progress  = (egg.hatchAt && egg.incubatedAt)
          ? Math.min(100, Math.round((now - egg.incubatedAt) / (egg.hatchAt - egg.incubatedAt) * 100))
          : 0;
        const timeLeftMin = (!isReady && egg.hatchAt) ? Math.max(0, Math.ceil((egg.hatchAt - now) / 60000)) : null;
        const eggSrc = globalThis.eggSprite?.(egg, isReady) || '';
        incSlotsHtml += `
          <div class="base-inc-slot ${isReady ? 'ready' : 'active'}" data-egg-id="${egg.id}"
            title="${egg.species_en}${isReady ? ' — PRÊT !' : timeLeftMin !== null ? ' — '+timeLeftMin+'min' : ''}"
            style="${isReady ? 'cursor:pointer;' : ''}">
            <img src="${eggSrc}" class="base-inc-egg" alt="">
            <div class="base-inc-bar">
              <div class="base-inc-fill" style="width:${isReady ? 100 : progress}%;background:${isReady ? 'var(--green)' : 'var(--gold)'}"></div>
            </div>
            ${isReady
              ? `<span class="base-inc-ready">!</span>`
              : timeLeftMin !== null ? `<span class="base-inc-time">${timeLeftMin}m</span>` : ''}
          </div>`;
      } else {
        incSlotsHtml += `<div class="base-inc-slot empty"><span style="font-size:18px;opacity:.25">🥚</span></div>`;
      }
    }
  }

  return `<div class="gang-base-window" id="gangBaseWin">

    <!-- ── Header ── -->
    <div class="base-window-header">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:12px">🏠</span>
        <span style="font-family:var(--font-pixel);font-size:8px;color:var(--red);letter-spacing:1px">${state.gang.name}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-family:var(--font-pixel);font-size:8px;color:var(--gold)">₽${state.gang.money.toLocaleString()}</span>
        <button class="base-export-btn" title="${state.lang === 'fr' ? 'Exporter mon gang' : 'Export my gang'}"
          style="font-size:11px;background:none;border:none;cursor:pointer;color:var(--text-dim);padding:0;line-height:1;transition:color .2s"
          onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--text-dim)'">📷</button>
      </div>
    </div>

    <!-- ── Viewport environnement ── -->
    <div class="base-env-viewport">
      <div style="position:absolute;inset:0;overflow:hidden;pointer-events:none">
        ${_bgPokeHtml}${_bgAgentHtml}
        <div style="position:absolute;inset:0;background:rgba(12,4,4,.55);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)"></div>
      </div>
      <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 8px 10px">
        ${state.gang.bossSprite
          ? `<img class="base-boss-sprite" src="${trainerSprite(state.gang.bossSprite)}" alt="Boss" onerror="this.src='${FALLBACK_TRAINER_SVG}';this.onerror=null">`
          : '<div style="width:72px;height:72px;background:rgba(0,0,0,.5);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;font-size:28px">💀</div>'}
        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text)">${state.gang.bossName}</div>
        <div class="base-team-slots">${bossTeamHtml}</div>
      </div>
    </div>

    <!-- ── Balls ── -->
    <div class="base-inv-section">
      <div class="base-inv-label">🎯 BALLS</div>
      <div class="base-inv-row">${ballsHtml}</div>
    </div>

    <!-- ── Boosts ── -->
    <div class="base-inv-section">
      <div class="base-inv-label" style="display:flex;align-items:center;gap:6px">
        <span>⚡ BOOSTS</span>
        <div style="display:flex;gap:3px;margin-left:auto">
          ${[1,5,10].map(n => `<button data-boost-mult="${n}" style="font-family:var(--font-pixel);font-size:7px;padding:1px 5px;border-radius:3px;cursor:pointer;
            background:${_boostMult===n?'var(--red-dark)':'var(--bg)'};
            border:1px solid ${_boostMult===n?'var(--red)':'var(--border)'};
            color:${_boostMult===n?'#fff':'var(--text-dim)'};line-height:1.6">×${n}</button>`).join('')}
        </div>
      </div>
      <div class="base-inv-row">${boostsHtml}</div>
    </div>

    <!-- ── Objets ── -->
    <div class="base-inv-section">
      <div class="base-inv-label">🔧 OBJETS</div>
      <div class="base-inv-row">${craftHtml}${keysHtml}</div>
    </div>

    <!-- ── Incubateurs ── -->
    <div class="base-inv-section"${incCount > 0 ? ' data-base-action="pension" style="cursor:pointer"' : ''}>
      <div class="base-inv-label">🥚 INCUBATEURS${waitingEggs.length > 0 ? ` <span style="color:var(--text-dim);font-weight:normal">+${waitingEggs.length} en attente</span>` : ''}</div>
      ${incCount > 0
        ? `<div class="base-inc-slots">${incSlotsHtml}</div>`
        : `<div style="font-size:8px;color:var(--text-dim);padding:2px 0 3px;opacity:.5">${state.lang === 'fr' ? 'Aucun incubateur — achetez-en au Marché' : 'No incubators — buy some at the Market'}</div>`}
    </div>

  </div>`;
}

function bindGangBase(container) {
  const state = globalThis.state;
  const BALL_IDS  = ['pokeball','greatball','ultraball','duskball','masterball'];
  const BOOST_IDS = ['lure','superlure','incense','rarescope','aura'];

  // Boss team slot clicks
  container.querySelectorAll('[data-boss-slot]').forEach(slot => {
    slot.addEventListener('click', () => {
      const idx = parseInt(slot.dataset.bossSlot);
      const pkId = state.gang.bossTeam[idx];
      if (pkId) {
        state.gang.bossTeam.splice(idx, 1);
        globalThis.saveState();
        globalThis.renderZoneWindows();
      } else {
        globalThis.openTeamPicker('boss', null, () => globalThis.renderZoneWindows());
      }
    });
  });

  // Incubator section background → pension tab
  container.querySelector('[data-base-action="pension"]')?.addEventListener('click', e => {
    // Don't navigate if clicked directly on a ready egg slot
    if (e.target.closest('[data-egg-id]')) return;
    globalThis.pcView = 'pension';
    globalThis.switchTab('tabPC');
  });

  // Ready egg slots in gang base → hatch animation directly
  container.querySelectorAll('.base-inc-slot.ready[data-egg-id]').forEach(slot => {
    slot.addEventListener('click', e => {
      e.stopPropagation();
      const eggId = slot.dataset.eggId;
      const egg = state.eggs.find(egg => egg.id === eggId);
      if (!egg) return;
      globalThis.openHatchAnimation?.(egg, () => {
        renderGangBasePanel();
      });
    });
  });

  // Boost multiplier buttons
  container.querySelectorAll('[data-boost-mult]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _boostMult = parseInt(btn.dataset.boostMult);
      renderGangBasePanel();
    });
  });

  // Item tiles
  container.querySelectorAll('.base-item-tile[data-bag-item]').forEach(el => {
    el.addEventListener('click', () => {
      const id  = el.dataset.bagItem;
      const qty = state.inventory?.[id] || 0;

      if (BALL_IDS.includes(id)) {
        state.activeBall = id;
        globalThis.saveState();
        globalThis.renderZoneWindows();
        renderGangBasePanel();
        return;
      }
      if (id === 'rarecandy') { globalThis.openRareCandyPicker(); return; }
      if (BOOST_IDS.includes(id)) {
        const uses = Math.min(_boostMult, qty);
        if (uses > 0) {
          for (let i = 0; i < uses; i++) globalThis.activateBoost(id);
          const rem = Math.ceil(globalThis.boostRemaining(id));
          globalThis.notify(`Boost ×${uses} activé — ${rem}s`, 'success');
        }
        globalThis.renderZoneWindows();
        renderGangBasePanel();
        return;
      }
    });
  });

  // Auto-buy ball toggle
  container.querySelectorAll('[data-auto-ball]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const ballId = btn.dataset.autoBall;
      state.settings.autoBuyBall = (state.settings.autoBuyBall === ballId) ? null : ballId;
      globalThis.saveState();
      renderGangBasePanel();
    });
  });

  // Export button
  container.querySelector('.base-export-btn')?.addEventListener('click', openExportModal);
}

// ── Codex Modal ───────────────────────────────────────────────

function openCodexModal() {
  const state         = globalThis.state;
  const BASE_PRICE    = globalThis.BASE_PRICE;
  const POTENTIAL_MULT= globalThis.POTENTIAL_MULT;
  const ZONE_BGS      = globalThis.ZONE_BGS;
  const pokeSprite    = globalThis.pokeSprite;
  const trainerSprite = globalThis.trainerSprite;

  const RARITY_ORDER = ['common','uncommon','rare','very_rare','legendary'];
  const RARITY_FR = { common:'Commun', uncommon:'Peu commun', rare:'Rare', very_rare:'Très rare', legendary:'Légendaire' };
  const RARITY_COLOR = { common:'#aaa', uncommon:'#5be06c', rare:'#5b9be0', very_rare:'#c05be0', legendary:'#ffcc5a' };
  const POTENTIALS = [1,2,3,4,5];
  const POT_MULT   = POTENTIAL_MULT;

  function buildPrixTab() {
    const headCells = POTENTIALS.map(p =>
      `<th style="padding:6px 10px;color:#ccc">★${p}<br><span style="font-size:8px;color:#666">×${POT_MULT[p-1]}</span></th>`
    ).join('');
    const shinyHeadCells = POTENTIALS.map(p =>
      `<th style="padding:6px 10px;color:#ffcc5a">★${p} ✨<br><span style="font-size:8px;color:#888">×${POT_MULT[p-1]*10}</span></th>`
    ).join('');

    const rows = RARITY_ORDER.map(r => {
      const base = BASE_PRICE[r];
      const cells = POTENTIALS.map(p => {
        const v = Math.round(base * POT_MULT[p-1]);
        return `<td style="padding:5px 10px;text-align:right;color:#e0e0e0">${v.toLocaleString()}₽</td>`;
      }).join('');
      const shinyCells = POTENTIALS.map(p => {
        const v = Math.round(base * POT_MULT[p-1] * 10);
        return `<td style="padding:5px 10px;text-align:right;color:#ffcc5a">${v.toLocaleString()}₽</td>`;
      }).join('');
      return `
        <tr>
          <td style="padding:5px 10px;font-weight:bold;color:${RARITY_COLOR[r]};white-space:nowrap">${RARITY_FR[r]}</td>
          <td style="padding:5px 10px;text-align:right;color:#888">${base.toLocaleString()}₽</td>
          ${cells}
        </tr>
        <tr style="background:rgba(255,204,90,0.04)">
          <td style="padding:5px 10px;font-size:9px;color:#ffcc5a;white-space:nowrap">✨ Shiny</td>
          <td style="padding:5px 10px;text-align:right;color:#ffcc5a;font-size:9px">${(base*10).toLocaleString()}₽</td>
          ${shinyCells}
        </tr>`;
    }).join('');

    return `
      <div style="overflow-x:auto">
        <table style="border-collapse:collapse;font-family:'Courier New',monospace;font-size:11px;width:100%">
          <thead>
            <tr style="border-bottom:1px solid #333">
              <th style="padding:6px 10px;text-align:left;color:#888">Rareté</th>
              <th style="padding:6px 10px;color:#888">Base</th>
              ${headCells}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="margin-top:10px;font-size:9px;color:#555;font-family:'Courier New',monospace">
        Nature : toutes les natures ont un multiplicateur moyen de ×1.0 — aucun impact sur le prix final.
      </div>`;
  }

  function buildSpawnsTab() {
    const TYPE_LABEL = { route:'🌿 Routes & Grottes', city:'⚔ Arènes', special:'⭐ Lieux Spéciaux' };
    const TYPE_COLOR = { route:'#5be06c', city:'#e05b5b', special:'#e0c05b' };
    const RARITY_C   = { common:'#aaa', uncommon:'#5be06c', rare:'#5b9be0', very_rare:'#c05be0', legendary:'#ffcc5a' };
    const GYM_LEADER_FR = {
      brock:'Pierre', misty:'Ondine', ltsurge:'Maj. Bob', erika:'Érika',
      koga:'Koga', sabrina:'Morgane', blaine:'Auguste', blue:'Blue',
    };

    const sections = { route:[], city:[], special:[] };
    for (const zone of ZONES) sections[zone.type || 'route']?.push(zone);

    let html = '';
    for (const [type, zones] of Object.entries(sections)) {
      if (!zones.length) continue;
      html += `<div style="margin-bottom:20px">
        <div style="font-family:var(--font-pixel);font-size:9px;color:${TYPE_COLOR[type]};margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,.08)">
          ${TYPE_LABEL[type]} — ${zones.length} zones
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">`;

      for (const zone of zones) {
        const bg     = ZONE_BGS[zone.id];
        const bgImg  = bg ? `url('${bg.url}'),linear-gradient(180deg,${bg.fb})` : `linear-gradient(180deg,#1a1a1a,#0d0d0d)`;

        const poolHtml = (zone.pool || []).map(en => {
          const sp  = SPECIES_BY_EN[en];
          const col = RARITY_C[sp?.rarity] || '#aaa';
          return `<div style="display:flex;flex-direction:column;align-items:center;gap:1px" title="${sp?.fr || en}">
            <img src="${pokeSprite(en)}" style="width:26px;height:26px;image-rendering:pixelated;filter:drop-shadow(0 1px 3px rgba(0,0,0,.9))">
            <div style="width:4px;height:4px;border-radius:50%;background:${col};opacity:.8"></div>
          </div>`;
        }).join('');

        const rareHtml = zone.rarePool ? `
          <div style="margin-top:6px;padding-top:5px;border-top:1px solid rgba(255,255,255,.06)">
            <span style="font-size:7px;font-family:var(--font-pixel);color:#888">✨ Rare (10%) : </span>
            ${zone.rarePool.slice(0,6).map(e => {
              const sp = SPECIES_BY_EN[e.en];
              return `<img src="${pokeSprite(e.en)}" style="width:20px;height:20px;image-rendering:pixelated;opacity:.7" title="${sp?.fr || e.en} (w:${e.w})">`;
            }).join('')}
          </div>` : '';

        const gymHtml = zone.gymLeader ? (() => {
          const lFr = GYM_LEADER_FR[zone.gymLeader] || zone.gymLeader;
          return `<div style="display:flex;align-items:center;gap:6px;margin-top:6px;padding-top:5px;border-top:1px solid rgba(255,255,255,.06)">
            <img src="${trainerSprite(zone.gymLeader)}" style="width:28px;height:28px;image-rendering:pixelated">
            <div>
              <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold)">${lFr}</div>
              <div style="font-size:8px;color:var(--text-dim)">XP ×${zone.xpBonus}</div>
            </div>
          </div>`;
        })() : '';

        html += `<div style="border-radius:6px;overflow:hidden;border:1px solid rgba(255,255,255,.08)">
          <div style="position:relative;height:44px;background-image:${bgImg};background-size:cover;background-position:center">
            <div style="position:absolute;inset:0;background:rgba(0,0,0,.55)"></div>
            <div style="position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;padding:4px 8px;height:100%">
              <div>
                <div style="font-family:var(--font-pixel);font-size:8px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.9)">${zone.fr}</div>
                <div style="font-size:7px;color:rgba(255,255,255,.5)">Rep ≥ ${zone.rep}${zone.unlockItem ? ' · 🔑' : ''}</div>
              </div>
              <div style="text-align:right;font-size:7px;color:rgba(255,255,255,.5)">
                ${zone.spawnRate ? `Spawn ×${zone.spawnRate}` : ''}
              </div>
            </div>
          </div>
          <div style="background:rgba(0,0,0,.6);padding:6px 8px">
            <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:flex-end">${poolHtml}</div>
            ${rareHtml}
            ${gymHtml}
          </div>
        </div>`;
      }
      html += '</div></div>';
    }
    return html;
  }

  const existing = document.getElementById('codexModal');
  if (existing) { existing.remove(); return; }

  const modal = document.createElement('div');
  modal.id = 'codexModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9300;background:rgba(0,0,0,.88);display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow-y:auto';

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--border);border-radius:var(--radius);width:100%;max-width:800px;display:flex;flex-direction:column;gap:0">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border)">
        <span style="font-family:var(--font-pixel);font-size:11px;color:var(--gold)">📖 Codex — Référence</span>
        <button id="codexClose" style="background:transparent;border:none;color:#aaa;font-size:18px;cursor:pointer;line-height:1">×</button>
      </div>
      <div style="display:flex;gap:0;border-bottom:1px solid var(--border)">
        <button class="codex-tab active" data-ct="prix" style="font-family:var(--font-pixel);font-size:9px;padding:10px 18px;background:transparent;border:none;border-bottom:2px solid var(--gold);color:var(--gold);cursor:pointer">💰 Prix</button>
        <button class="codex-tab" data-ct="spawns" style="font-family:var(--font-pixel);font-size:9px;padding:10px 18px;background:transparent;border:none;border-bottom:2px solid transparent;color:#888;cursor:pointer">🗺 Spawns</button>
      </div>
      <div id="codexBody" style="padding:18px;overflow-y:auto;max-height:calc(100vh - 160px)">
        ${buildPrixTab()}
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.querySelector('#codexClose').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelectorAll('.codex-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.codex-tab').forEach(b => {
        b.style.borderBottom = '2px solid transparent';
        b.style.color = '#888';
      });
      btn.style.borderBottom = '2px solid var(--gold)';
      btn.style.color = 'var(--gold)';
      const body = modal.querySelector('#codexBody');
      body.innerHTML = btn.dataset.ct === 'prix' ? buildPrixTab() : buildSpawnsTab();
    });
  });
}

// ── Gang Export ───────────────────────────────────────────────

function openExportModal() {
  const opts = {
    showVitrine:  true,
    showTitres:   true,
    showBossTeam: true,
    showStats:    true,
    showBadges:   true,
    showAgents:   true,
    spriteGen:    'game',
  };

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center';

  const toggleDefs = [
    ['showVitrine',  '🎭', 'Vitrine'],
    ['showTitres',   '🏆', 'Titres'],
    ['showBossTeam', '⚔',  'Équipe Boss'],
    ['showStats',    '📊', 'Statistiques'],
    ['showBadges',   '🎖',  'Badges Pokédex'],
    ['showAgents',   '👥', 'Agents'],
  ];

  const chkStyle   = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-size:9px;color:var(--text);user-select:none';
  const chkInputStyle = 'width:14px;height:14px;accent-color:var(--gold);cursor:pointer';
  const radioStyle = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-size:9px;color:var(--text);user-select:none';

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--red);border-radius:var(--radius);
      padding:24px;max-width:480px;width:95%;display:flex;flex-direction:column;gap:16px;max-height:90vh;overflow-y:auto">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">📋 EXPORTER MON GANG</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="font-size:8px;color:var(--text-dim);font-family:var(--font-pixel);border-bottom:1px solid var(--border);padding-bottom:4px">SECTIONS À INCLURE</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px">
          ${toggleDefs.map(([key, icon, label]) => `
            <label style="${chkStyle}">
              <input type="checkbox" data-opt="${key}" ${opts[key] ? 'checked' : ''} style="${chkInputStyle}">
              ${icon} ${label}
            </label>`).join('')}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="font-size:8px;color:var(--text-dim);font-family:var(--font-pixel);border-bottom:1px solid var(--border);padding-bottom:4px">STYLE DE SPRITES</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <label style="${radioStyle}"><input type="radio" name="xpSprite" value="game" checked style="accent-color:var(--gold);cursor:pointer"> 🎮 Sprites du jeu</label>
          <label style="${radioStyle}"><input type="radio" name="xpSprite" value="gen5" style="accent-color:var(--gold);cursor:pointer"> 🖼 Showdown Gen 5 (BW)</label>
          <label style="${radioStyle}"><input type="radio" name="xpSprite" value="gen1" style="accent-color:var(--gold);cursor:pointer"> 👾 Rétro Gen 1</label>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button id="xpOpen" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:12px;background:var(--red);border:2px solid var(--red);border-radius:var(--radius-sm);color:#fff;cursor:pointer;min-width:140px">↗ Ouvrir la fiche</button>
        <button id="xpCancel" style="font-family:var(--font-pixel);font-size:8px;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">✕ Annuler</button>
      </div>
      <div style="font-size:8px;color:var(--text-dim);line-height:1.6">💡 Ctrl+P → PDF · Clic droit → Enregistrer pour PNG</div>
    </div>`;

  document.body.appendChild(modal);
  modal.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => { opts[cb.dataset.opt] = cb.checked; });
  });
  modal.querySelectorAll('input[type=radio]').forEach(r => {
    r.addEventListener('change', () => { if (r.checked) opts.spriteGen = r.value; });
  });
  modal.querySelector('#xpOpen').addEventListener('click', () => { modal.remove(); _exportAsPDF(opts); });
  modal.querySelector('#xpCancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function _exportAsPDF(opts) {
  const state = globalThis.state;
  const g    = state.gang;
  const card = buildExportCard(opts);
  const spriteLabel = { game: 'Jeu', gen5: 'Gen 5', gen1: 'Gen 1' }[opts.spriteGen] || 'Jeu';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>PokéGang — ${g.name}</title>
  <link rel="icon" href="https://lab.sterenna.fr/PG/pokegang_logo/pokegang_logo_little.png">
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{background:#0a0404;display:flex;flex-direction:column;align-items:center;padding:54px 16px 40px;min-height:100vh}
    .toolbar{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(14,4,4,.97);border-bottom:2px solid #cc3333;display:flex;align-items:center;justify-content:space-between;padding:10px 20px;gap:12px;flex-wrap:wrap}
    .toolbar-title{font-family:'Press Start 2P',monospace;font-size:9px;color:#cc3333;white-space:nowrap}
    .toolbar-hint{font-size:9px;color:#555;flex:1;text-align:center}
    .btns{display:flex;gap:8px;flex-shrink:0}
    .btn{font-family:'Press Start 2P',monospace;font-size:8px;padding:8px 12px;border-radius:4px;cursor:pointer;border:1px solid;background:transparent;transition:all .15s}
    .btn-pdf{border-color:#aaa;color:#aaa}.btn-pdf:hover{background:rgba(255,255,255,.1)}
    .btn-png{border-color:#4fc3f7;color:#4fc3f7}.btn-png:hover{background:rgba(79,195,247,.1)}
    @media print{.toolbar{display:none!important}body{padding:0;background:#0a0404!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:5mm;size:A4 portrait;background:#0a0404}}
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="toolbar-title">PokéGang — ${g.name}</span>
    <span class="toolbar-hint">Sprites : ${spriteLabel}</span>
    <div class="btns">
      <button class="btn btn-pdf" onclick="window.print()">🖨 Imprimer / PDF</button>
      <button class="btn btn-png" onclick="const el=document.querySelector('#export-card-root');if(el){el.style.outline='3px solid #4fc3f7';setTimeout(()=>el.style.outline='',2000);}alert('Clic droit sur la carte → Enregistrer l\\'image')">🖼 Aide PNG</button>
    </div>
  </div>
  ${card.outerHTML}
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { globalThis.notify('Autorise les popups pour l\'export PDF', 'error'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
  globalThis.notify('📄 PDF prêt dans un nouvel onglet', 'success');
}

function buildExportCard(opts = {}) {
  const state           = globalThis.state;
  const pokeSprite      = globalThis.pokeSprite;
  const trainerSprite   = globalThis.trainerSprite;
  const speciesName     = globalThis.speciesName;
  const calculateStats  = globalThis.calculateStats;
  const calculatePrice  = globalThis.calculatePrice;
  const pokemonDisplayName = globalThis.pokemonDisplayName;
  const sanitizeSpriteName = globalThis.sanitizeSpriteName;
  const COSMETIC_BGS    = globalThis.COSMETIC_BGS;

  const g = state.gang;
  const s = state.stats;

  const LOGO_FULL  = 'https://lab.sterenna.fr/PG/pokegang_logo/pokegang_logo_full_B.png';
  const LOGO_SMALL = 'https://lab.sterenna.fr/PG/pokegang_logo/pokegang_logo_medium.png';

  const gen = opts.spriteGen || 'game';
  function _pkSprite(species_en, shiny) {
    if (gen === 'gen5') {
      const base = shiny ? 'gen5-shiny' : 'gen5';
      return `https://play.pokemonshowdown.com/sprites/${base}/${sanitizeSpriteName(species_en)}.png`;
    }
    if (gen === 'gen1') {
      const base = shiny ? 'gen2-shiny' : 'gen1';
      return `https://play.pokemonshowdown.com/sprites/${base}/${sanitizeSpriteName(species_en)}.png`;
    }
    return pokeSprite(species_en, shiny);
  }

  const img = (src, w, h) =>
    `<img src="${src}" width="${w}" height="${h}" style="image-rendering:pixelated;display:block;object-fit:contain" onerror="this.style.visibility='hidden'">`;
  const sec = label =>
    `<div style="font-family:'Press Start 2P',monospace;font-size:7px;color:#555;text-align:center;padding:8px 0 6px;letter-spacing:.12em">— ${label} —</div>`;
  const hr = () =>
    `<div style="height:1px;background:rgba(204,51,51,.35);margin:0 20px"></div>`;

  const bgKey   = state.cosmetics?.gameBg;
  const bgUrl   = bgKey ? COSMETIC_BGS[bgKey]?.url : null;
  const bgStyle = bgUrl
    ? `background-image:url('${bgUrl}');background-size:cover;background-position:center`
    : 'background:linear-gradient(180deg,#180606 0%,#200d0d 45%,#160808 80%,#0e0404 100%)';

  const teamPks      = g.bossTeam.map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
  const mvp          = state.pokemons.length > 0
    ? state.pokemons.reduce((best, p) => calculatePrice(p) > calculatePrice(best) ? p : best)
    : null;
  const showcaseIds  = (g.showcase || [null, null, null]).slice(0, 3);
  const showcasePks  = showcaseIds.map(id => (id ? state.pokemons.find(p => p.id === id) : null) || null);
  const kantoCaught  = globalThis.getDexKantoCaught();
  const kantoTotal   = globalThis.KANTO_DEX_SIZE;
  const natCaught    = globalThis.getDexNationalCaught();
  const natTotal     = globalThis.NATIONAL_DEX_SIZE;
  const shinySpecies = globalThis.getShinySpeciesCount();
  const mainTitle    = globalThis.getBossFullTitle();
  const tC           = globalThis.getTitleLabel(g.titleC);
  const tD           = globalThis.getTitleLabel(g.titleD);
  const agents       = state.agents.slice(0, 16);
  const col1         = agents.slice(0, 8);
  const col2         = agents.slice(8, 16);

  const badges = [];
  if (kantoCaught >= kantoTotal)          badges.push({ label:'Kanto Complet',   color:'#ffcc5a', icon:'🏅' });
  if (natCaught >= natTotal)              badges.push({ label:'National Complet', color:'#4fc3f7', icon:'🌐' });
  if (shinySpecies >= 30)                 badges.push({ label:'Chasseur Shiny',   color:'#e879f9', icon:'✨' });
  if ((s.totalFightsWon||0) >= 100)       badges.push({ label:'Vétéran',          color:'#f97316', icon:'⚔' });
  if ((s.totalCaught||0) >= 500)          badges.push({ label:'Grand Chasseur',   color:'#22c55e', icon:'🎯' });

  function _agentRow(ag) {
    const agPks    = ag.team.map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
    const zoneName = ag.assignedZone ? (ZONE_BY_ID[ag.assignedZone]?.fr || ag.assignedZone) : 'Sans zone';
    const miniPks  = agPks.slice(0, 6).map(pk =>
      `<div style="display:flex;flex-direction:column;align-items:center">
        ${img(_pkSprite(pk.species_en, pk.shiny), 30, 30)}
        <span style="font-size:6px;color:${pk.shiny ? '#ffcc5a' : '#555'}">${pk.level}</span>
      </div>`
    ).join('');
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:5px 10px;border-bottom:1px solid rgba(255,255,255,.06)">
        ${img(ag.sprite || trainerSprite('acetrainer'), 38, 38)}
        <div style="flex:0 0 105px;overflow:hidden">
          <div style="font-size:9px;color:#e0e0e0;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ag.name}</div>
          <div style="font-size:7px;color:#888">Lv.${ag.level} · ${zoneName.slice(0,14)}</div>
          <div style="font-size:6px;color:#555">ATK:${ag.stats?.combat||0} CAP:${ag.stats?.capture||0} LCK:${ag.stats?.luck||0}</div>
        </div>
        <div style="display:flex;gap:2px;flex-wrap:wrap;flex:1">${miniPks}</div>
      </div>`;
  }
  function _agentCol(list) {
    if (!list.length) return '';
    return `<div style="flex:1;min-width:0;border:1px solid rgba(255,255,255,.1);border-radius:4px;overflow:hidden">${list.map(_agentRow).join('')}</div>`;
  }

  let sections = '';

  sections += `
    <div style="text-align:center;padding:18px 0 12px;background:rgba(0,0,0,.45)">
      <img src="${LOGO_FULL}" style="height:44px;width:auto;max-width:320px" onerror="this.style.display='none'" alt="PokéGang">
    </div>${hr()}`;

  const titlesBlock = opts.showTitres ? `
    <div style="font-family:'Press Start 2P',monospace;font-size:9px;color:#ffcc5a;margin-top:2px">${mainTitle}</div>
    ${(tC||tD) ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:3px">
      ${tC ? `<span style="font-size:7px;padding:2px 8px;border-radius:10px;border:1px solid #4fc3f7;color:#4fc3f7">${tC}</span>` : ''}
      ${tD ? `<span style="font-size:7px;padding:2px 8px;border-radius:10px;border:1px solid #ce93d8;color:#ce93d8">${tD}</span>` : ''}
    </div>` : ''}` : '';

  sections += `
    <div style="display:flex;align-items:flex-start;gap:16px;padding:16px 20px 14px">
      ${g.bossSprite ? img(trainerSprite(g.bossSprite), 96, 96) : '<div style="width:96px;height:96px;flex-shrink:0"></div>'}
      <div style="flex:1;display:flex;flex-direction:column;gap:5px">
        <div style="font-family:'Press Start 2P',monospace;font-size:18px;color:#cc3333;line-height:1.2">${g.name}</div>
        <div style="font-size:10px;color:#aaa">Boss : <strong style="color:#e0e0e0">${g.bossName}</strong></div>
        ${titlesBlock}
        <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:4px">
          <span style="font-size:9px;color:#ffcc5a">⭐ ${g.reputation.toLocaleString()} rep</span>
          <span style="font-size:9px;color:#e0e0e0">₽ ${g.money.toLocaleString()}</span>
          <span style="font-size:9px;color:#888">🐾 ${state.pokemons.length} Pokémon</span>
        </div>
      </div>
    </div>${hr()}`;

  if (opts.showVitrine) {
    const showcaseHtml = showcasePks.map((pk, i) => {
      if (!pk) return `<div style="width:130px;text-align:center;opacity:.3"><div style="width:80px;height:80px;border:2px dashed rgba(255,255,255,.2);border-radius:6px;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:24px">?</div><div style="font-size:8px;color:#555;margin-top:6px">Slot ${i+1}</div></div>`;
      return `<div style="width:130px;text-align:center"><div style="display:flex;justify-content:center">${img(_pkSprite(pk.species_en,pk.shiny),80,80)}</div><div style="font-size:9px;color:${pk.shiny?'#ffcc5a':'#e0e0e0'};margin-top:6px">${pokemonDisplayName(pk)}${pk.shiny?' ✨':''}</div><div style="font-size:7px;color:#888">Lv.${pk.level} · ${'★'.repeat(pk.potential)}</div><div style="font-size:8px;color:#ffcc5a">${calculatePrice(pk).toLocaleString()}₽</div></div>`;
    }).join('');
    sections += `${sec('VITRINE')}<div style="display:flex;justify-content:center;gap:24px;padding:10px 20px 16px;flex-wrap:wrap">${showcaseHtml}</div>${hr()}`;
  }

  if (opts.showBossTeam) {
    const teamHtml = teamPks.map(pk => `
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
        <div style="display:flex;justify-content:center">${img(_pkSprite(pk.species_en,pk.shiny),72,72)}</div>
        <span style="font-size:8px;color:${pk.shiny?'#ffcc5a':'#aaa'}">${speciesName(pk.species_en)}</span>
        <span style="font-size:7px;color:#666">${'★'.repeat(pk.potential)} Lv.${pk.level}</span>
      </div>`).join('');
    const mvpHtml = mvp ? `<div style="border:2px solid #ffcc5a;border-radius:6px;padding:10px 14px;background:rgba(255,204,90,.08);text-align:center;flex-shrink:0;min-width:110px"><div style="font-size:7px;color:#ffcc5a;margin-bottom:6px;font-family:'Press Start 2P',monospace">💰 POKÉMON MVP</div><div style="display:flex;justify-content:center">${img(_pkSprite(mvp.species_en,mvp.shiny),72,72)}</div><div style="font-size:9px;color:#e0e0e0;margin-top:6px">${speciesName(mvp.species_en)}${mvp.shiny?' ✨':''}</div><div style="font-size:10px;color:#ffcc5a;font-weight:bold">${calculatePrice(mvp).toLocaleString()}₽</div></div>` : '';
    sections += `${sec('ÉQUIPE BOSS')}<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:10px 20px 16px;flex-wrap:wrap"><div style="display:flex;gap:10px;flex-wrap:wrap;flex:1">${teamHtml}</div>${mvpHtml}</div>${hr()}`;
  }

  if (opts.showStats || opts.showBadges) {
    const statRows = [
      ['⚔ Victoires', s.totalFightsWon||0, '🎯 Captures', s.totalCaught||0],
      ['✨ Chromas cap.', s.shinyCaught||0, '🌈 Espèces shiny', shinySpecies],
      ['📦 Coffres', s.chestsOpened||0, '👥 Agents', state.agents.length],
      ['₽ Actuels', `${g.money.toLocaleString()}₽`, '₽ Gagné', `${(s.totalMoneyEarned||0).toLocaleString()}₽`],
      ['📖 Kanto', `${kantoCaught}/${kantoTotal}`, '🌐 National', `${natCaught}/${natTotal}`],
    ].map(([l1,v1,l2,v2]) => `<div style="display:flex;gap:6px;padding:3px 0;font-size:9px"><span style="flex:1;color:#aaa">${l1} : <strong style="color:#e0e0e0">${v1}</strong></span><span style="flex:1;color:#aaa">${l2} : <strong style="color:#e0e0e0">${v2}</strong></span></div>`).join('');
    const badgesHtml = badges.map(b => `<div style="display:flex;align-items:center;gap:6px;padding:5px 10px;border:1px solid ${b.color};border-radius:4px;background:rgba(0,0,0,.35)"><span style="font-size:14px">${b.icon}</span><span style="font-size:7px;color:${b.color};font-family:'Press Start 2P',monospace">${b.label}</span></div>`).join('');
    sections += `${sec('STATISTIQUES & BADGES')}<div style="display:flex;gap:20px;padding:10px 20px 16px;align-items:flex-start">${opts.showStats?`<div style="flex:1">${statRows}</div>`:''}${opts.showBadges&&badges.length?`<div style="flex:0 0 210px;display:flex;flex-direction:column;gap:6px">${badgesHtml}</div>`:''}</div>${hr()}`;
  }

  if (opts.showAgents && agents.length > 0) {
    sections += `${sec('AGENTS')}<div style="display:flex;gap:10px;padding:10px 16px 16px">${_agentCol(col1)}${col2.length?_agentCol(col2):(col1.length?'<div style="flex:1"></div>':'')}</div>${hr()}`;
  }

  sections += `<div style="display:flex;align-items:center;justify-content:center;padding:14px 0 16px;background:rgba(0,0,0,.45)"><img src="${LOGO_SMALL}" style="height:22px;width:auto;opacity:.35" onerror="this.style.display='none'" alt="PokéGang"></div>`;

  const card = document.createElement('div');
  card.id = 'export-card-root';
  card.style.cssText = ['width:794px;min-width:794px','font-family:Courier New,monospace;color:#e0e0e0','border:2px solid #cc3333;border-radius:6px;overflow:hidden','box-shadow:0 0 48px rgba(204,51,51,.28)',bgStyle,'position:relative'].join(';');
  const darkLayer = document.createElement('div');
  darkLayer.style.cssText = 'position:absolute;inset:0;background:rgba(10,4,4,.84);pointer-events:none;z-index:0';
  card.appendChild(darkLayer);
  const content = document.createElement('div');
  content.style.cssText = 'position:relative;z-index:1';
  content.innerHTML = sections;
  card.appendChild(content);
  return card;
}

// Legacy stub
function exportGangImage() { openExportModal(); }

// ── Expose ────────────────────────────────────────────────────
Object.assign(globalThis, {
  _gbase_renderGangBasePanel:  renderGangBasePanel,
  _gbase_renderGangBaseWindow: renderGangBaseWindow,
  _gbase_bindGangBase:         bindGangBase,
  _gbase_openCodexModal:       openCodexModal,
  _gbase_openExportModal:      openExportModal,
  _gbase_exportAsPDF:          _exportAsPDF,
  _gbase_exportGangImage:      exportGangImage,
  _gbase_buildExportCard:      buildExportCard,
});

export {};
