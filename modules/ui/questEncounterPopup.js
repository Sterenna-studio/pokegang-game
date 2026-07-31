'use strict';

// ════════════════════════════════════════════════════════════════
//  QUEST ENCOUNTER POPUP — combat de quête (dresseur/légendaire)
//
//  Générique : ne connaît rien de la structure state.*Mission — le fichier
//  de mission appelant fournit une config normalisée et un callback
//  onResolved(result) chargé de mettre à jour son propre state (step,
//  bossDefeated, owned, etc.), exactement comme avant cette refonte.
//
//  Dépendances globalThis : state, saveState, getAgentCombatPower, notify
//    (via EventBus) — pokeSprite/trainerSprite sont résolus par l'appelant
//    dans spriteUrl, pas lus ici directement.
//  Dépendances import : modules/systems/questCombat.js
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';
import { esc as _esc } from '../core/escape.js';
import {
  runAgentWeakenAttempt, runFinalConfrontation, rollQuestCapture, defaultEncounterState,
} from '../systems/questCombat.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY,        { msg, type });
const _dirty  = ()               => EventBus.emit(EVENTS.STATE_DIRTY);
const _save   = ()               => globalThis.saveState?.();
const _t      = (fr, en)         => (globalThis.state?.lang === 'en' ? en : fr);

/**
 * @param {object} cfg
 * @param {string}   cfg.id            clé unique (dédup DOM)
 * @param {'legendary'|'trainer'} cfg.kind
 * @param {string}   cfg.name          nom affiché
 * @param {string}   [cfg.icon]        emoji
 * @param {string}   [cfg.spriteUrl]   sprite déjà résolu par l'appelant
 * @param {string}   [cfg.lore]        texte d'ambiance court
 * @param {Array}    cfg.team          [{species_en, level, potential?}]
 * @param {number}   [cfg.statMult=1]  buff de difficulté (combat spécial)
 * @param {number}   [cfg.catchBase]   requis si kind==='legendary'
 * @param {object}   [cfg.encounterState] état d'affaiblissement persistant, muté en place
 * @param {(result: object) => void} cfg.onResolved
 */
export function openQuestEncounterPopup(cfg) {
  document.getElementById('quest-encounter-modal')?.remove();

  const state = globalThis.state;
  cfg.encounterState = cfg.encounterState || defaultEncounterState();

  let phase = 'overview'; // 'overview' | 'result'
  let lastBattle = null;
  let lastAgentName = null;
  let lastOutcome = null; // { won, captured?, weakenPctAtStart, isFinal }

  const modal = document.createElement('div');
  modal.id = 'quest-encounter-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9400;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;padding:16px';

  function availableAgents() {
    return (state.agents || []).filter(a => !a.resting);
  }

  function weakenPct() {
    return Math.round((cfg.encounterState.weakenPct || 0) * 100);
  }

  function render() {
    modal.innerHTML = phase === 'result' ? _resultScreen() : _overviewScreen();
    bind();
  }

  function _headerHtml() {
    return `
      <div style="display:flex;align-items:center;gap:12px">
        ${cfg.spriteUrl ? `<img src="${_esc(cfg.spriteUrl)}" style="width:72px;height:72px;image-rendering:pixelated;filter:drop-shadow(0 0 8px rgba(255,204,90,.35))" onerror="this.style.visibility='hidden'">` : ''}
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold)">${cfg.icon ? cfg.icon + ' ' : ''}${_esc(cfg.name)}</div>
          ${cfg.lore ? `<div style="font-size:9px;color:var(--text-dim);margin-top:4px;line-height:1.5">${_esc(cfg.lore)}</div>` : ''}
        </div>
      </div>`;
  }

  function _overviewScreen() {
    const agents = availableAgents();
    const wPct = weakenPct();
    const agentRows = agents.length
      ? agents.map(a => {
          const power = globalThis.getAgentCombatPower?.(a) ?? 0;
          return `<button data-send-agent="${a.id}" style="display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:7px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);cursor:pointer;margin-bottom:6px">
            <img src="${_esc(a.sprite || '')}" style="width:26px;height:26px;image-rendering:pixelated" onerror="this.style.visibility='hidden'">
            <div style="flex:1;min-width:0">
              <div style="font-size:9px">${_esc(a.name)}</div>
              <div style="font-size:8px;color:var(--text-dim)">Lv.${a.level} · ${_esc(a.title)} · ⚡${power}</div>
            </div>
            <span style="font-size:9px;color:var(--gold)">${_t('Envoyer', 'Send')} →</span>
          </button>`;
        }).join('')
      : `<div style="font-size:9px;color:var(--text-dim);padding:8px 0">${_t('Aucun agent disponible.', 'No agent available.')}</div>`;

    return `
      <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:420px;width:100%;display:flex;flex-direction:column;gap:14px;max-height:90vh;overflow-y:auto">
        ${_headerHtml()}
        ${wPct > 0
          ? `<div style="font-size:9px;color:var(--red);background:rgba(230,53,53,.1);border:1px solid rgba(230,53,53,.3);border-radius:var(--radius-sm);padding:6px 10px">🩸 ${_t('Affaibli de', 'Weakened by')} ${wPct}% (${cfg.encounterState.attempts} ${_t('tentative(s)', 'attempt(s)')})</div>`
          : ''}
        <div>
          <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">${_t('ENVOYER UN AGENT POUR L’AFFAIBLIR (jusqu’à 3)', 'SEND AN AGENT TO WEAKEN IT (up to 3)').toUpperCase()}</div>
          ${agentRows}
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;border-top:1px solid var(--border);padding-top:12px">
          <button id="qepClose" style="font-size:9px;padding:8px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">${_t('Fermer', 'Close')}</button>
          <button id="qepConfront" style="font-size:9px;padding:8px 18px;background:var(--red);border:none;border-radius:var(--radius-sm);color:#fff;cursor:pointer">⚔️ ${_t('Affronter directement', 'Confront directly')}</button>
        </div>
      </div>`;
  }

  function _battleLogHtml(battle) {
    const lines = battle.turns.filter(t => t.type !== 'switch').map(t => {
      if (t.type === 'attack') {
        const side = t.side === 'player' ? _t('Vous', 'You') : cfg.name;
        return `${side} — ${_esc(t.attackerSpecies)} utilise ${_esc(t.move)} (${t.damage} dmg)`;
      }
      if (t.type === 'faint') return `💥 ${_esc(t.species_en)} ${_t('est mis K.O.', 'fainted')}`;
      if (t.type === 'result') return t.win ? `🏆 ${_t('Victoire !', 'Victory!')}` : `☠ ${_t('Défaite...', 'Defeat...')}`;
      return '';
    }).filter(Boolean);
    return `<div style="max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:3px;font-size:8px;color:var(--text-dim);background:var(--bg);border-radius:var(--radius-sm);padding:8px;border:1px solid var(--border)">
      ${lines.map(l => `<div>${l}</div>`).join('')}
    </div>`;
  }

  function _resultScreen() {
    const battle = lastBattle;
    const outcome = lastOutcome;
    const won = outcome.won;
    let title, color;
    if (outcome.isFinal) {
      if (cfg.kind === 'legendary') {
        title = !won ? _t('Combat perdu — renforcez votre équipe.', 'Battle lost — strengthen your team.')
          : outcome.captured ? _t(`${cfg.name} capturé !`, `${cfg.name} caught!`)
          : _t(`${cfg.name} s'échappe... (${Math.round(outcome.chance * 100)}% de chances)`, `${cfg.name} escapes... (${Math.round(outcome.chance * 100)}% chance)`);
        color = !won ? 'var(--red)' : outcome.captured ? 'var(--gold)' : 'var(--text-dim)';
      } else {
        title = won ? _t(`${cfg.name} est vaincu !`, `${cfg.name} is defeated!`) : _t('Combat perdu — renforcez votre équipe.', 'Battle lost — strengthen your team.');
        color = won ? 'var(--gold)' : 'var(--red)';
      }
    } else {
      title = won
        ? _t(`${lastAgentName} affaiblit ${cfg.name} !`, `${lastAgentName} weakens ${cfg.name}!`)
        : _t(`${lastAgentName} est repoussé, mais a mordu dedans.`, `${lastAgentName} was pushed back, but landed some damage.`);
      color = won ? 'var(--gold)' : 'var(--text-dim)';
    }

    return `
      <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:420px;width:100%;display:flex;flex-direction:column;gap:12px;max-height:90vh;overflow-y:auto">
        ${_headerHtml()}
        <div style="font-family:var(--font-pixel);font-size:10px;color:${color};text-align:center;padding:6px 0">${title}</div>
        ${_battleLogHtml(battle)}
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="qepDone" style="font-size:9px;padding:8px 18px;background:var(--gold);border:none;border-radius:var(--radius-sm);color:#1a1206;cursor:pointer">${outcome.isFinal && won ? _t('Continuer', 'Continue') : _t('OK', 'OK')}</button>
        </div>
      </div>`;
  }

  function bind() {
    modal.querySelector('#qepClose')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#qepDone')?.addEventListener('click', () => {
      if (lastOutcome?.isFinal && lastOutcome.won) { modal.remove(); return; }
      phase = 'overview';
      render();
    });
    modal.querySelector('#qepConfront')?.addEventListener('click', _confront);
    modal.querySelectorAll('[data-send-agent]').forEach(btn => {
      btn.addEventListener('click', () => _sendAgent(btn.dataset.sendAgent));
    });
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  function _sendAgent(agentId) {
    const agent = state.agents.find(a => a.id === agentId);
    if (!agent) return;
    const result = runAgentWeakenAttempt({
      agent, opponentTeam: cfg.team, baseStatMult: cfg.statMult ?? 1,
      encounterState: cfg.encounterState, state,
    });
    if (result.error) { _notify(_t('Action impossible.', 'Cannot do that.'), 'error'); return; }

    lastBattle = result.battle;
    lastAgentName = agent.name;
    lastOutcome = { won: result.agentWon, isFinal: false };
    if (result.imprisoned) {
      _notify(_t(`${agent.name} est épuisé — en prison 1h.`, `${agent.name} is exhausted — imprisoned for 1h.`), 'error');
    }
    _dirty(); _save();
    phase = 'result';
    render();
  }

  function _confront() {
    const result = runFinalConfrontation({
      opponentTeam: cfg.team, baseStatMult: cfg.statMult ?? 1,
      encounterState: cfg.encounterState, state,
    });
    if (result.error) { _notify(_t('Aucune équipe boss disponible.', 'No boss team available.'), 'error'); return; }

    lastBattle = result.battle;
    lastAgentName = null;

    if (!result.win) {
      lastOutcome = { won: false, isFinal: true };
      cfg.onResolved?.({ won: false, isFinal: true });
    } else if (cfg.kind === 'legendary') {
      const cap = rollQuestCapture({ catchBase: cfg.catchBase ?? 0.5, weakenPctAtStart: result.weakenPctAtStart });
      lastOutcome = { won: true, isFinal: true, captured: cap.caught, chance: cap.chance, weakenPctAtStart: result.weakenPctAtStart };
      cfg.onResolved?.({ won: true, isFinal: true, captured: cap.caught, weakenPctAtStart: result.weakenPctAtStart });
    } else {
      lastOutcome = { won: true, isFinal: true };
      cfg.onResolved?.({ won: true, isFinal: true });
    }
    _dirty(); _save();
    phase = 'result';
    render();
  }

  document.body.appendChild(modal);
  render();
}

Object.assign(globalThis, { openQuestEncounterPopup });

export {};
