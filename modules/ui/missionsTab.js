'use strict';

// ════════════════════════════════════════════════════════════════
// 18c. UI — MISSIONS TAB
// ════════════════════════════════════════════════════════════════

const HOUR_MS = 3600000;

function renderMissionsTab() {
  const el = document.getElementById('tabMissions');
  if (!el) return;
  initMissions();
  initHourlyQuests();

  // ── Helper: regular mission section ──────────────────────────
  const renderSection = (title, missions) => {
    let html = `<div style="margin-bottom:20px">
      <h3 style="font-family:var(--font-pixel);font-size:11px;color:var(--gold);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">${title}</h3>`;
    for (const m of missions) {
      const progress = getMissionProgress(m);
      const complete = isMissionComplete(m);
      const claimed = isMissionClaimed(m);
      const pct = Math.min(100, (progress / m.target) * 100);
      const name = state.lang === 'fr' ? m.fr : m.en;
      const rewardStr = [];
      if (m.reward.money) rewardStr.push(m.reward.money.toLocaleString() + '₽');
      if (m.reward.rep) rewardStr.push('+' + m.reward.rep + ' rep');
      html += `<div style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid var(--border);opacity:${claimed ? '.5' : '1'}">
        <img src="${pokeIcon(m.icon)}" style="width:32px;height:24px;image-rendering:pixelated;flex-shrink:0" onerror="this.style.display='none'">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;${claimed ? 'text-decoration:line-through' : ''}">${name}</div>
          ${m.desc_fr ? `<div style="font-size:9px;color:var(--text-dim);margin-top:2px">${state.lang === 'fr' ? m.desc_fr : m.desc_en}</div>` : ''}
          <div style="background:var(--bg);border-radius:3px;height:6px;margin-top:4px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${complete ? 'var(--green)' : 'var(--red)'};transition:width .3s"></div>
          </div>
          <div style="font-size:9px;color:var(--text-dim);margin-top:2px">${progress}/${m.target} — ${rewardStr.join(', ')}</div>
        </div>
        ${complete && !claimed
          ? `<button class="btn-claim-mission" data-mission-id="${m.id}" style="font-family:var(--font-pixel);font-size:9px;padding:6px 12px;background:var(--green);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--bg);cursor:pointer;white-space:nowrap;animation:glow 1.5s ease-in-out infinite">${state.lang === 'fr' ? 'Récupérer' : 'Claim'}</button>`
          : claimed ? '<span style="font-size:9px;color:var(--green)">✓</span>' : ''}
      </div>`;
    }
    html += '</div>';
    return html;
  };

  // ── Hourly quests section ────────────────────────────────────
  const hourlyRem = Math.max(0, HOUR_MS - (Date.now() - state.missions.hourly.reset));
  const hMin = Math.floor(hourlyRem / 60000);
  const hSec = Math.floor((hourlyRem % 60000) / 1000);
  let hourlyHtml = `<div style="margin-bottom:20px">
    <h3 style="font-family:var(--font-pixel);font-size:11px;color:var(--gold);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
      Quêtes Horaires <span style="font-size:9px;color:var(--text-dim)">${hMin}m${String(hSec).padStart(2,'0')}s</span>
    </h3>`;
  for (let i = 0; i < 5; i++) {
    const q = getHourlyQuest(i);
    if (!q) continue;
    const progress = getHourlyProgress(q);
    const complete  = isHourlyComplete(q);
    const claimed   = isHourlyClaimed(i);
    const pct = Math.min(100, (progress / q.target) * 100);
    const rewardStr = [q.reward.money ? q.reward.money.toLocaleString() + '₽' : '', q.reward.rep ? '+' + q.reward.rep + ' rep' : ''].filter(Boolean).join('  ');
    const diffColor = q.diff === 'hard' ? 'var(--red)' : 'var(--blue)';
    const fillColor = complete ? 'var(--green)' : diffColor;
    hourlyHtml += `<div style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid var(--border);border-left:3px solid ${diffColor};opacity:${claimed?'.5':'1'}">
      <img src="${pokeIcon(q.icon)}" style="width:32px;height:24px;image-rendering:pixelated;flex-shrink:0" onerror="this.style.display='none'">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;${claimed?'text-decoration:line-through':''}">
          ${q.fr} <span style="font-size:7px;padding:1px 4px;border-radius:3px;background:${diffColor};color:#fff;font-family:var(--font-pixel)">${q.diff === 'hard' ? 'HARD' : 'MED'}</span>
        </div>
        <div style="background:var(--bg);border-radius:3px;height:6px;margin-top:4px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${fillColor};transition:width .3s"></div>
        </div>
        <div style="font-size:9px;color:var(--text-dim);margin-top:2px">${progress}/${q.target}  —  ${rewardStr}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
        ${complete && !claimed
          ? `<button class="btn-claim-hourly" data-slot="${i}" style="font-family:var(--font-pixel);font-size:9px;padding:6px 12px;background:var(--green);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--bg);cursor:pointer;white-space:nowrap;animation:glow 1.5s ease-in-out infinite">Récupérer</button>`
          : claimed ? '<span style="font-size:9px;color:var(--green)">✓</span>' : ''}
        ${!claimed ? `<button class="btn-reroll-hourly" data-slot="${i}" style="font-size:7px;padding:3px 6px;background:var(--bg);border:1px solid var(--border);border-radius:3px;color:var(--text-dim);cursor:pointer;font-family:var(--font-pixel)">↻ ${HOURLY_QUEST_REROLL_COST}₽</button>` : ''}
      </div>
    </div>`;
  }
  hourlyHtml += '</div>';

  // ── Timers ────────────────────────────────────────────────────
  const dailyRem = Math.max(0, 86400000 - (Date.now() - state.missions.daily.reset));
  const dailyH = Math.floor(dailyRem / 3600000);
  const dailyM = Math.floor((dailyRem % 3600000) / 60000);
  const weeklyRem = Math.max(0, 604800000 - (Date.now() - state.missions.weekly.reset));
  const weeklyD = Math.floor(weeklyRem / 86400000);
  const weeklyH = Math.floor((weeklyRem % 86400000) / 3600000);

  // Filtrer par région débloquée (les missions sans région sont toujours visibles)
  const _purchases   = state.purchases || {};
  const _regionOk    = m => !m.region
    || (m.region === 'johto'  && _purchases.johtoUnlocked)
    || (m.region === 'hoenn'  && _purchases.hoennUnlocked)
    || (m.region === 'sinnoh' && _purchases.sinnohUnlocked);
  const dailyMissions  = MISSIONS.filter(m => m.type === 'daily'  && _regionOk(m));
  const weeklyMissions = MISSIONS.filter(m => m.type === 'weekly' && _regionOk(m));
  const storyMissions  = MISSIONS.filter(m => m.type === 'story');
  const unclaimedStory = storyMissions.filter(m => !isMissionClaimed(m));
  const claimedStory = storyMissions.filter(m => isMissionClaimed(m));

  let content = hourlyHtml;
  content += renderSection(
    `${state.lang === 'fr' ? 'Missions Quotidiennes' : 'Daily Missions'} (${dailyH}h${String(dailyM).padStart(2,'0')})`,
    dailyMissions
  );
  content += renderSection(
    `${state.lang === 'fr' ? 'Missions Hebdomadaires' : 'Weekly Missions'} (${weeklyD}j ${weeklyH}h)`,
    weeklyMissions
  );
  if (unclaimedStory.length > 0) {
    content += renderSection(
      state.lang === 'fr' ? 'Histoire & Objectifs' : 'Story & Objectives',
      unclaimedStory
    );
  }
  if (claimedStory.length > 0) {
    content += renderSection(
      state.lang === 'fr' ? 'Terminés' : 'Completed',
      claimedStory
    );
  }

  // ── Bouton "Tout réclamer" ──
  const claimableMissions = MISSIONS.filter(m => isMissionComplete(m) && !isMissionClaimed(m));
  const claimAllBtn = claimableMissions.length > 0
    ? `<button id="btnClaimAllMissions" style="font-family:var(--font-pixel);font-size:9px;padding:7px 16px;background:var(--green);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--bg);cursor:pointer;margin-bottom:14px;animation:glow 1.5s ease-in-out infinite">✓ Tout réclamer (${claimableMissions.length})</button>`
    : '';
  el.innerHTML = `<div style="padding:12px">${claimAllBtn}${content}</div>`;

  if (claimableMissions.length > 0) {
    document.getElementById('btnClaimAllMissions')?.addEventListener('click', () => {
      claimableMissions.forEach(m => claimMission(m));
      saveState(); updateTopBar();
      renderMissionsTab();
    });
  }
  el.querySelectorAll('.btn-claim-mission').forEach(btn => {
    btn.addEventListener('click', () => {
      const mission = MISSIONS.find(m => m.id === btn.dataset.missionId);
      if (mission) { claimMission(mission); renderMissionsTab(); }
    });
  });
  el.querySelectorAll('.btn-claim-hourly').forEach(btn => {
    btn.addEventListener('click', () => {
      claimHourlyQuest(parseInt(btn.dataset.slot));
      renderMissionsTab();
    });
  });
  el.querySelectorAll('.btn-reroll-hourly').forEach(btn => {
    btn.addEventListener('click', () => {
      rerollHourlyQuest(parseInt(btn.dataset.slot));
      renderMissionsTab();
    });
  });
}

Object.assign(globalThis, { renderMissionsTab });
export { renderMissionsTab };
