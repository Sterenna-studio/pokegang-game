// ════════════════════════════════════════════════════════════════
//  PC TOP POWER — Leaderboard des Pokémon par puissance Lv.100
//
//  Affiche un classement triable des Pokémon du joueur selon leur
//  puissance MAXIMALE (au Lv.100), pour faciliter l'optimisation
//  d'équipe et identifier les Pokémon sous-exploités.
//
//  Activé via le switcher PC : bouton [TOP].
//
//  Dépendances globalThis :
//    state, pokeSprite, speciesName, switchTab, openAssignToPicker
// ════════════════════════════════════════════════════════════════

import { getLv100Data, getPokemonLocation, getProgressionRatio } from '../systems/pokemonRating.js';
import { esc as _esc } from '../core/escape.js';

// ── État local de la vue ──────────────────────────────────────────
let _topState = {
  sortBy:  'lv100PC',  // 'lv100PC' | 'currentPC' | 'grade' | 'level' | 'progress' | 'name'
  sortDir: 'desc',     // 'asc' | 'desc'
  filter:  'all',      // 'all' | 'team' | 'free' | 'underused' | 'shiny'
  limit:   50,         // top N affichés
};

// ── API publique ──────────────────────────────────────────────────

export function renderTopPowerView(container) {
  if (!container) return;
  const state = globalThis.state;
  const pokemons = state?.pokemons || [];

  // 1. Calcul des projections Lv.100 pour tous les Pokémon
  const rows = pokemons.map(p => {
    const rating  = getLv100Data(p);
    const loc     = getPokemonLocation(p, state);
    const currPC  = globalThis.getPokemonPower(p);
    const progress = rating.lv100PC > 0 ? currPC / rating.lv100PC : 0;
    return { p, rating, loc, currPC, progress };
  });

  // 2. Filtrage
  let filtered = rows;
  if (_topState.filter === 'team')       filtered = rows.filter(r => r.loc.slot === 'team');
  else if (_topState.filter === 'free')  filtered = rows.filter(r => r.loc.slot === 'free');
  else if (_topState.filter === 'underused') filtered = rows.filter(r => r.loc.slot === 'free' && r.rating.grade.startsWith('A') || r.rating.grade === 'S');
  else if (_topState.filter === 'shiny') filtered = rows.filter(r => r.p.shiny);

  // 3. Tri
  const sortKey = _topState.sortBy;
  const dir = _topState.sortDir === 'asc' ? 1 : -1;
  filtered.sort((a, b) => {
    let av, bv;
    switch (sortKey) {
      case 'lv100PC':  av = a.rating.lv100PC; bv = b.rating.lv100PC; break;
      case 'currentPC': av = a.currPC; bv = b.currPC; break;
      case 'grade':    av = a.rating.gradePct; bv = b.rating.gradePct; break;
      case 'level':    av = a.p.level; bv = b.p.level; break;
      case 'progress': av = a.progress; bv = b.progress; break;
      case 'name':     av = globalThis.speciesName(a.p.species_en); bv = globalThis.speciesName(b.p.species_en);
                       return av.localeCompare(bv) * dir;
      default:         av = a.rating.lv100PC; bv = b.rating.lv100PC;
    }
    return (av - bv) * dir;
  });

  // 4. Limit
  const displayed = filtered.slice(0, _topState.limit);
  const totalCount = pokemons.length;

  // 5. Stats globales
  const teamCount     = rows.filter(r => r.loc.slot === 'team').length;
  const grades        = rows.reduce((acc, r) => { acc[r.rating.grade] = (acc[r.rating.grade] || 0) + 1; return acc; }, {});
  const avgLv100PC    = rows.length ? Math.round(rows.reduce((s, r) => s + r.rating.lv100PC, 0) / rows.length) : 0;
  const maxLv100PC    = rows.length ? Math.max(...rows.map(r => r.rating.lv100PC)) : 0;

  // ── Render ──────────────────────────────────────────────────────
  container.innerHTML = `
    <div class="top-power-view">
      <div class="top-power-header">
        <div class="top-power-title">
          🏆 <strong>TOP PUISSANCE</strong>
          <span class="top-power-subtitle">Classement par PC max au niveau 100</span>
        </div>
        <div class="top-power-stats">
          <span class="tp-stat"><strong>${totalCount}</strong> Pokémon</span>
          <span class="tp-stat">Équipe : <strong>${teamCount}</strong></span>
          <span class="tp-stat">Moy. Lv.100 : <strong>${avgLv100PC.toLocaleString()}</strong> PC</span>
          <span class="tp-stat" style="color:var(--gold)">Max : <strong>${maxLv100PC.toLocaleString()}</strong> PC</span>
        </div>
      </div>

      <div class="top-power-grade-bar">
        ${['S', 'A+', 'A', 'B+', 'B', 'C'].map(g => {
          const n = grades[g] || 0;
          const colors = { S: 'var(--gold)', 'A+': '#4caf50', A: '#81c784', 'B+': '#64b5f6', B: '#90caf9', C: '#aaa' };
          return `<span class="tp-grade-chip" style="color:${colors[g]};border-color:${colors[g]}"><strong>${g}</strong> ${n}</span>`;
        }).join('')}
      </div>

      <div class="top-power-filters">
        <div class="tp-filter-group">
          ${[
            ['all',       'Tous'],
            ['team',      '⚔ En équipe'],
            ['free',      '🆓 Libres'],
            ['underused', '⚠️ Sous-exploités (A+ libres)'],
            ['shiny',     '✨ Shiny'],
          ].map(([key, label]) => `
            <button class="tp-filter-btn ${_topState.filter === key ? 'active' : ''}" data-filter="${key}">${label}</button>
          `).join('')}
        </div>
        <div class="tp-limit-group">
          <span class="tp-limit-label">Afficher :</span>
          ${[25, 50, 100, 999].map(n => `
            <button class="tp-limit-btn ${_topState.limit === n ? 'active' : ''}" data-limit="${n}">${n === 999 ? 'TOUS' : n}</button>
          `).join('')}
        </div>
      </div>

      <div class="top-power-table-wrap">
        <table class="top-power-table">
          <thead>
            <tr>
              <th class="tp-col-rank">#</th>
              <th class="tp-col-sprite"></th>
              <th class="tp-col-name tp-sortable" data-sort="name">Nom ${_sortIcon('name')}</th>
              <th class="tp-col-grade tp-sortable" data-sort="grade">Grade ${_sortIcon('grade')}</th>
              <th class="tp-col-role">Rôle</th>
              <th class="tp-col-pc tp-sortable" data-sort="lv100PC">PC Lv.100 ${_sortIcon('lv100PC')}</th>
              <th class="tp-col-pc tp-sortable" data-sort="currentPC">PC actuel ${_sortIcon('currentPC')}</th>
              <th class="tp-col-progress tp-sortable" data-sort="progress">Progression ${_sortIcon('progress')}</th>
              <th class="tp-col-stats">Stats Lv.100</th>
              <th class="tp-col-meta tp-sortable" data-sort="level">Niveau ${_sortIcon('level')}</th>
              <th class="tp-col-loc">Affectation</th>
              <th class="tp-col-actions"></th>
            </tr>
          </thead>
          <tbody>
            ${displayed.map((r, i) => _renderRow(r, i)).join('')}
          </tbody>
        </table>
        ${displayed.length === 0 ? `
          <div class="tp-empty">Aucun Pokémon ne correspond au filtre actuel.</div>
        ` : ''}
        ${filtered.length > _topState.limit ? `
          <div class="tp-overflow">… ${filtered.length - _topState.limit} Pokémon supplémentaires masqués. Augmente la limite ci-dessus.</div>
        ` : ''}
      </div>
    </div>`;

  // ── Listeners ───────────────────────────────────────────────────
  container.querySelectorAll('.tp-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _topState.filter = btn.dataset.filter;
      renderTopPowerView(container);
    });
  });
  container.querySelectorAll('.tp-limit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _topState.limit = parseInt(btn.dataset.limit);
      renderTopPowerView(container);
    });
  });
  container.querySelectorAll('.tp-sortable').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (_topState.sortBy === key) {
        _topState.sortDir = _topState.sortDir === 'desc' ? 'asc' : 'desc';
      } else {
        _topState.sortBy = key;
        _topState.sortDir = key === 'name' ? 'asc' : 'desc';
      }
      renderTopPowerView(container);
    });
  });
  container.querySelectorAll('.tp-row-assign').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.pid;
      globalThis.openAssignToPicker?.(id);
    });
  });
  container.querySelectorAll('.tp-row').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.dataset.pid;
      const pk = (globalThis.state.pokemons || []).find(p => p.id === id);
      if (!pk) return;
      // Sélectionner le pokémon dans le PC + basculer vers la vue grille pour voir la fiche détail
      globalThis._pcSetSelectedIds?.([id]);
      globalThis.setPcView?.('grid');
      globalThis.renderPCTab?.();
    });
  });
}

// ── Helpers de rendu ──────────────────────────────────────────────

function _sortIcon(key) {
  if (_topState.sortBy !== key) return '<span class="tp-sort-icon-dim">⇅</span>';
  return _topState.sortDir === 'desc' ? '▼' : '▲';
}

function _renderRow(r, idx) {
  const { p, rating, loc, currPC, progress } = r;
  const rank = idx + 1;
  const name = globalThis.speciesName?.(p.species_en) ?? p.species_en;
  const sprite = globalThis.pokeSprite?.(p.species_en, p.shiny) ?? '';
  const shinyTag = p.shiny ? '<span class="tp-shiny">✨</span>' : '';
  const pctProgress = Math.round(progress * 100);
  const progressColor = progress >= 0.95 ? 'var(--green)'
                      : progress >= 0.7  ? 'var(--gold)'
                      : progress >= 0.4  ? '#ffa726'
                      : '#e57373';
  const stars = '★'.repeat(p.potential) + '☆'.repeat(5 - p.potential);
  const isMax = p.level >= 100;

  return `
    <tr class="tp-row ${rank <= 3 ? 'tp-row-top' : ''}" data-pid="${p.id}">
      <td class="tp-col-rank">
        ${rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `<span class="tp-rank-num">#${rank}</span>`}
      </td>
      <td class="tp-col-sprite">
        <img src="${sprite}" alt="" class="tp-sprite" onerror="this.style.opacity='.2'">
      </td>
      <td class="tp-col-name">
        <div class="tp-name">${_esc(name)}${shinyTag}</div>
        <div class="tp-stars">${stars}</div>
      </td>
      <td class="tp-col-grade">
        <span class="tp-grade-badge" style="color:${rating.gradeColor};border-color:${rating.gradeColor}">${rating.grade}</span>
        <div class="tp-grade-pct">${rating.gradePct}%</div>
      </td>
      <td class="tp-col-role">
        <span class="tp-role-icon" title="${rating.roleKey}">${rating.roleIcon}</span>
        <div class="tp-role-label">${rating.roleKey}</div>
      </td>
      <td class="tp-col-pc tp-pc-lv100" style="color:${rating.gradeColor}">
        <strong>${rating.lv100PC.toLocaleString()}</strong>
      </td>
      <td class="tp-col-pc tp-pc-current">
        ${currPC.toLocaleString()}
      </td>
      <td class="tp-col-progress">
        <div class="tp-progress-bar">
          <div class="tp-progress-fill" style="width:${pctProgress}%;background:${progressColor}"></div>
        </div>
        <div class="tp-progress-label">${pctProgress}%${isMax ? ' ✓' : ''}</div>
      </td>
      <td class="tp-col-stats">
        <span class="tp-stat-atk">ATK ${rating.s100.atk}</span>
        <span class="tp-stat-def">DEF ${rating.s100.def}</span>
        <span class="tp-stat-spd">VIT ${rating.s100.spd}</span>
      </td>
      <td class="tp-col-meta">
        <span class="${isMax ? 'tp-level-max' : 'tp-level'}">Lv.${p.level}</span>
        ${rating.natBonus ? `<span class="tp-nat-bonus">${rating.natBonus}</span>` : ''}
        ${rating.natMalus ? `<span class="tp-nat-malus">${rating.natMalus}</span>` : ''}
      </td>
      <td class="tp-col-loc">
        <span class="tp-loc" style="color:${loc.color}">${loc.label}</span>
      </td>
      <td class="tp-col-actions">
        <button class="tp-row-assign" data-pid="${p.id}" title="Assigner">→</button>
      </td>
    </tr>`;
}
