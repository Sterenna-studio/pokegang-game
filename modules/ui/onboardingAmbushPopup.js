'use strict';

// ════════════════════════════════════════════════════════════════
//  onboardingAmbushPopup.js — écran d'explication avant le combat
//  d'embuscade de l'onboarding V2.
//
//  Le raid des sbires devient cliquable dès la fin de leur marche d'entrée,
//  mais rien n'explique au joueur qu'il doit cliquer dessus, ni que l'équipe
//  Boss a déjà été remplie pour lui (_ensureBossTeamForAmbush) — d'où cette
//  popup : elle explique le défi, affiche l'équipe déjà constituée avec le
//  slot 1 marqué comme le « starter », et laisse promouvoir un autre
//  Pokémon en slot 1 d'un clic. Le bouton Combattre déclenche exactement ce
//  qu'un clic sur le raid aurait fait (_ctx.openCombatPopup).
//
//  Dépendances injectées via configureOnboardingAmbushPopup :
//    getState, pokeSprite, openCombatPopup, saveState, renderAll
// ════════════════════════════════════════════════════════════════

let _ctx = {};
export function configureOnboardingAmbushPopup(ctx = {}) {
  _ctx = { ..._ctx, ...ctx };
}

const _state = () => _ctx.getState?.() ?? globalThis.state;
const _t = (fr, en) => (_state()?.lang === 'en' ? en : fr);

const OVERLAY_ID = 'onboarding-ambush-popup';

function _bossPokemons() {
  const state = _state();
  const ids = state?.gang?.bossTeam || [];
  return ids
    .map(id => globalThis.pokemonById?.(id) ?? state.pokemons.find(p => p.id === id))
    .filter(Boolean);
}

function _speciesLabel(pk) {
  // SPECIES_BY_EN : global posé par le <script> classique data/species-data.js,
  // accessible par nom nu dans un module ES — jamais via globalThis (cf. CLAUDE.md).
  const sp = SPECIES_BY_EN[pk.species_en];
  if (!sp) return pk.species_en;
  return _state()?.lang === 'en' ? sp.en : sp.fr;
}

/**
 * Affiche l'écran de défi. `onConfirm` est appelé après fermeture, une fois
 * le joueur prêt à engager le combat (slot 1 éventuellement réordonné).
 * Renvoie false sans rien afficher si l'équipe Boss est vide (ne devrait pas
 * arriver après _ensureBossTeamForAmbush, mais mieux vaut ne pas bloquer le
 * joueur derrière une popup sans contenu).
 */
export function showAmbushChallengePopup({ zoneId, onConfirm } = {}) {
  if (document.getElementById(OVERLAY_ID)) return false;
  const pokemons = _bossPokemons();
  if (!pokemons.length) return false;

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:7000;
    background:rgba(6,6,10,.75);
    display:flex; align-items:center; justify-content:center;
    padding:16px; animation:fadeIn .2s ease;
  `;

  const box = document.createElement('div');
  box.style.cssText = `
    width:min(420px,92vw);
    background:var(--bg-card); border:2px solid var(--red);
    border-radius:var(--radius); padding:18px;
    box-shadow:0 12px 40px rgba(0,0,0,.6);
    font-family:var(--font-body);
  `;
  box.innerHTML = `
    <div style="font-family:var(--font-pixel);font-size:11px;color:var(--red);margin-bottom:8px;text-align:center">
      ${_t('⚠ LE SBIRE ROCKET TE DÉFIE', '⚠ THE ROCKET GRUNT CHALLENGES YOU')}
    </div>
    <div style="font-size:12px;color:var(--text-dim);line-height:1.5;margin-bottom:14px;text-align:center">
      ${_t(
        'Ton équipe s\'est formée avec tes meilleures captures. Le slot 1 devient ton starter — clique un autre Pokémon pour le mettre à sa place.',
        'Your team was built from your best catches. Slot 1 becomes your starter — click another Pokémon to put it there instead.'
      )}
    </div>
    <div id="oap-slots" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:16px"></div>
    <button id="oap-fight-btn" style="
      display:block; width:100%; padding:10px; border:none; border-radius:6px;
      background:var(--red); color:#fff; font-family:var(--font-pixel); font-size:10px;
      cursor:pointer;
    ">${_t('⚔ Combattre', '⚔ Fight')}</button>
  `;
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const slotsEl = box.querySelector('#oap-slots');
  function _renderSlots() {
    slotsEl.innerHTML = _bossPokemons().map((pk, i) => `
      <div class="oap-slot${i === 0 ? ' oap-slot-starter' : ''}" data-idx="${i}" style="
        cursor:${i === 0 ? 'default' : 'pointer'}; text-align:center; width:56px;
      ">
        <div style="
          position:relative; width:52px; height:52px; border-radius:6px;
          border:2px solid ${i === 0 ? 'var(--gold)' : 'var(--border)'};
          background:rgba(0,0,0,.3); display:flex; align-items:center; justify-content:center;
        ">
          <img src="${_ctx.pokeSprite?.(pk.species_en, pk.shiny) || ''}" alt="${_speciesLabel(pk)}"
            style="width:44px;height:44px;image-rendering:pixelated" onerror="this.style.visibility='hidden'">
          ${i === 0 ? `<span style="position:absolute;top:-8px;left:50%;translate:-50% 0;font-size:9px">★</span>` : ''}
        </div>
        <div style="font-size:7px;font-family:var(--font-pixel);color:${i === 0 ? 'var(--gold)' : 'var(--text-dim)'};margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${i === 0 ? _t('Starter', 'Starter') : _speciesLabel(pk)}
        </div>
      </div>
    `).join('');

    slotsEl.querySelectorAll('.oap-slot').forEach(el => {
      el.addEventListener('click', () => {
        const idx = Number(el.dataset.idx);
        if (idx === 0) return;
        const state = _state();
        const team = state.gang.bossTeam;
        // Fait passer le Pokémon cliqué en tête — c'est lui le nouveau starter.
        [team[0], team[idx]] = [team[idx], team[0]];
        globalThis.invalidateBossTeamPower?.();
        _ctx.saveState?.();
        _renderSlots();
      });
    });
  }
  _renderSlots();

  box.querySelector('#oap-fight-btn').addEventListener('click', () => {
    overlay.remove();
    onConfirm?.();
  });

  return true;
}
