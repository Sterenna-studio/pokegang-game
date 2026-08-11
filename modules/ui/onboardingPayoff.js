'use strict';

import {
  releaseStoryLock,
  requestStory,
  STORY_PRIORITIES,
} from '../core/storyLock.js';

const STORY_OWNER = 'onboarding-idle-payoff';

export function getOperationEstimateSeconds(zone) {
  const spawnRate = Number(zone?.spawnRate);
  if (!Number.isFinite(spawnRate) || spawnRate <= 0) return null;
  return Math.max(1, Math.round(1 / spawnRate));
}

export function formatOperationCountdown(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function getOnboardingIdlePayoffCopy(lang = 'fr', nextUnlock = 'market') {
  const en = lang === 'en';
  return {
    kicker: en ? 'FIRST OPERATION' : 'PREMIÈRE OPÉRATION',
    title: en ? 'AGENT ON MISSION' : 'AGENT EN MISSION',
    timerLabel: en ? 'Next operation ~' : 'Prochaine opération ~',
    offline: en
      ? 'Agents keep running operations and bringing back rewards while you are away.'
      : 'Les agents poursuivent leurs opérations et rapportent des récompenses pendant ton absence.',
    unlockLabel: en ? 'NOW UNLOCKED' : 'NOUVEAU DÉBLOCAGE',
    unlockName: nextUnlock === 'market' ? (en ? 'Market' : 'Marché') : nextUnlock,
    returnReason: en
      ? 'Come back after the next operation to collect the results and grow your gang.'
      : 'Reviens après la prochaine opération pour récupérer les résultats et développer ton gang.',
    fallbackAgent: en ? 'Your agent' : 'Ton agent',
    close: en ? 'GOT IT — CONTINUE' : 'COMPRIS — CONTINUER',
  };
}

function _openPayoff({ agent, zone, lang = 'fr', nextUnlock = 'market' } = {}) {
  if (typeof document === 'undefined' || !agent || !zone) return false;

  document.getElementById('onboardingIdlePayoff')?.remove();
  const en = lang === 'en';
  const copy = getOnboardingIdlePayoffCopy(lang, nextUnlock);
  const intervalSeconds = getOperationEstimateSeconds(zone);
  const zoneName = (en ? zone.en : zone.fr) || zone.en || zone.fr || zone.id;

  const overlay = document.createElement('div');
  overlay.id = 'onboardingIdlePayoff';
  overlay.className = 'onboarding-payoff-overlay';
  overlay.innerHTML = `
    <section class="onboarding-payoff-card" role="dialog" aria-modal="true" aria-labelledby="onboardingPayoffTitle">
      <div class="onboarding-payoff-kicker">${copy.kicker}</div>
      <h2 id="onboardingPayoffTitle">${copy.title}</h2>
      <div class="onboarding-payoff-assignment">
        <strong data-payoff-agent></strong>
        <span aria-hidden="true">→</span>
        <strong data-payoff-zone></strong>
      </div>
      <div class="onboarding-payoff-timer">
        <span>${copy.timerLabel}</span>
        <strong data-payoff-countdown></strong>
      </div>
      <p>${copy.offline}</p>
      <div class="onboarding-payoff-unlock">
        <span>${copy.unlockLabel}</span>
        <strong data-payoff-unlock></strong>
      </div>
      <p class="onboarding-payoff-return">${copy.returnReason}</p>
      <button type="button" class="onboarding-payoff-close">${copy.close}</button>
    </section>`;

  overlay.querySelector('[data-payoff-agent]').textContent = agent.name || copy.fallbackAgent;
  overlay.querySelector('[data-payoff-zone]').textContent = zoneName;
  overlay.querySelector('[data-payoff-unlock]').textContent = copy.unlockName;
  const countdown = overlay.querySelector('[data-payoff-countdown]');
  let remaining = intervalSeconds;
  const renderCountdown = () => {
    countdown.textContent = remaining === null ? '—' : formatOperationCountdown(remaining);
  };
  renderCountdown();

  let timerId = null;
  if (remaining !== null) {
    timerId = setInterval(() => {
      remaining = remaining <= 1 ? intervalSeconds : remaining - 1;
      renderCountdown();
    }, 1_000);
  }

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (timerId !== null) clearInterval(timerId);
    document.removeEventListener('keydown', onKeyDown);
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.remove();
      releaseStoryLock(STORY_OWNER);
    }, 180);
  };
  const onKeyDown = event => {
    if (event.key === 'Escape' || event.key === 'Enter') close();
  };

  overlay.querySelector('.onboarding-payoff-close').addEventListener('click', close);
  document.addEventListener('keydown', onKeyDown);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));
  overlay.querySelector('.onboarding-payoff-close').focus();
  return true;
}

/** Show the one-time idle-loop payoff without competing with another narrative overlay. */
export function showOnboardingIdlePayoff(options = {}) {
  if (!options.agent || !options.zone) return false;
  return requestStory(
    STORY_OWNER,
    () => _openPayoff(options),
    { priority: STORY_PRIORITIES.ONBOARDING },
  );
}
