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
//  Présentation (couleurs, tailles, layout) dans css/onboarding.css sous
//  le préfixe `oap-*` — seul le choix conditionnel starter/non-starter reste
//  géré via la classe modificatrice `.oap-slot-starter` déjà présente.
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
  overlay.className = 'oap-overlay';

  const box = document.createElement('div');
  box.className = 'oap-box';
  box.innerHTML = `
    <div class="oap-title">
      ${_t('⚠ LE SBIRE ROCKET TE DÉFIE', '⚠ THE ROCKET GRUNT CHALLENGES YOU')}
    </div>
    <div class="oap-desc">
      ${_t(
        'Ton équipe s\'est formée avec tes meilleures captures. Le slot 1 devient ton starter — clique un autre Pokémon pour le mettre à sa place.',
        'Your team was built from your best catches. Slot 1 becomes your starter — click another Pokémon to put it there instead.'
      )}
    </div>
    <div id="oap-slots" class="oap-slots"></div>
    <button id="oap-fight-btn" class="oap-fight-btn">${_t('⚔ Combattre', '⚔ Fight')}</button>
  `;
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const slotsEl = box.querySelector('#oap-slots');
  function _renderSlots() {
    slotsEl.innerHTML = _bossPokemons().map((pk, i) => `
      <div class="oap-slot${i === 0 ? ' oap-slot-starter' : ''}" data-idx="${i}">
        <div class="oap-slot-sprite-wrap">
          <img src="${_ctx.pokeSprite?.(pk.species_en, pk.shiny) || ''}" alt="${_speciesLabel(pk)}"
            class="oap-slot-img" onerror="this.style.visibility='hidden'">
          ${i === 0 ? `<span class="oap-slot-star">★</span>` : ''}
        </div>
        <div class="oap-slot-label">
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
