'use strict';

// ── Sprites & assets — résolution des sprites Pokémon / dresseurs / œufs ────
//
// Dépendances classiques (bare name — classic <script> globals) :
//   SPECIES_BY_EN (data/species-data.js)
//   getPokemonSprite, getEggSpriteUrl (exposés sur window par data/loaders.js, IIFE)
//
// Dépendances globalThis (ES module imports dans app.js) :
//   state (settings.spriteMode, lang)
//
// Autres globals navigateur utilisés directement : document, window.

import {
  FALLBACK_TRAINER_SVG, FALLBACK_POKEMON_SVG,
  SHOWDOWN_SPRITE_BASE, SHOWDOWN_TRAINER_SPRITE_BASE, POKEOS_EGG_BASE_URL,
  EGG_SPRITE_NB, EGG_SPRITES, CUSTOM_TRAINER_SPRITES,
} from '../../data/assets-data.js';

function sanitizeSpriteName(en) {
  // Showdown sprites use no hyphens for nidoran: nidoranf, nidoranm
  // and some others like mr-mime -> mrmime, farfetchd, etc.
  return en.replace(/[^a-z0-9]/g, '');
}

// ── Pokémon sprite resolution ────────────────────────────────────────────────
// Variants disponibles (depuis pokemon-sprites-kanto.json) :
//   'main'         → FireRed/LeafGreen (défaut)
//   'showdown'     → Animated GIF Showdown
//   'icon'         → Icône miniature Gen 7
//   'artwork'      → Artwork officiel haute résolution
//   'artworkShiny' → Artwork officiel shiny
//   'back'         → Dos face
//   'shiny'        → Version brillante face
//   'backShiny'    → Dos brillant
//   'retroRedBlue' → Sprite Rogue/Bleu
//   'retroYellow'  → Sprite Jaune
// ── Showdown sprite folder resolver ──────────────────────────────
// mode: 'gen1'|'gen2'|'gen3'|'gen4'|'gen5'|'ani'|'dex'|'home'
// back: true = dos, shiny: true = brillant
function _showdownSpriteUrl(en, mode, { shiny = false, back = false } = {}) {
  const name = sanitizeSpriteName(en);
  const sh   = shiny ? '-shiny' : '';
  const bk   = back  ? '-back'  : '';
  // ani & gen5ani → .gif ; tout le reste → .png
  const isGif = mode === 'ani';
  const ext   = isGif ? 'gif' : 'png';
  let folder;
  switch (mode) {
    case 'gen1': folder = back ? `gen1${sh}` : `gen1${sh}`; break; // gen1 has no back-shiny; use gen1
    case 'gen2': folder = `gen2${bk}${sh}`; break;
    case 'gen3': folder = `gen3${bk}${sh}`; break;
    case 'gen4': folder = `gen4${bk}${sh}`; break;
    case 'ani':  folder = `ani${bk}${sh}`;  break;
    case 'dex':  folder = back ? `gen5${bk}${sh}` : `dex${sh}`; break;   // dex has no back → fallback gen5
    case 'home': folder = back ? `gen5${bk}${sh}` : `home-centered${sh}`; break; // home has no back
    default:     folder = `gen5${bk}${sh}`; break; // 'gen5' or unknown
  }
  return `${SHOWDOWN_SPRITE_BASE}${folder}/${name}.${ext}`;
}

function pokeSpriteVariant(en, variant = 'main', shiny = false) {
  const state = globalThis.state;
  const mode = state?.settings?.spriteMode ?? 'local';
  // Mode local (JSON FireRed/LeafGreen) — sauf si variante explicitement Showdown
  if (mode === 'local' && variant !== 'showdown') {
    const sp = SPECIES_BY_EN[en];
    const dexId = sp?.dex;
    if (dexId && typeof getPokemonSprite === 'function') {
      const key = shiny && variant === 'main' ? 'shiny'
                : shiny && variant === 'back'  ? 'backShiny'
                : variant;
      const url = getPokemonSprite(dexId, key);
      if (url) return url;
    }
  }
  // Mode Showdown (gen1→home) ou fallback local
  const sdMode = mode === 'local' ? 'gen5' : mode;
  return _showdownSpriteUrl(en, sdMode, { shiny });
}

function pokeSprite(en, shiny = false) {
  return pokeSpriteVariant(en, 'main', shiny);
}

// Icône miniature BW (~40×30px) — pour les slots d'équipe
function pokeIcon(en) {
  const name = sanitizeSpriteName(en);
  return `${SHOWDOWN_SPRITE_BASE}bwicons/${name}.png`;
}

// ── Egg sprites ──────────────────────────────────────────────────────────────
// EGG_SPRITES et EGG_SPRITE_NB importés depuis data/assets-data.js

// Returns the generic fallback egg sprite URL (rarity-coded).
function eggSprite(egg, ready = false) {
  if (ready) return EGG_SPRITES.ready;
  const rarity = egg?.rarity || 'common';
  return EGG_SPRITES[rarity] || EGG_SPRITES.default;
}

// Returns a full <img> HTML string with PokéOS species egg (if pension/revealed)
// and automatic onerror fallback chain to rarity sprite → BW generic.
// style: optional inline CSS string to add to the img.
function eggImgTag(egg, ready = false, style = '') {
  const fallback   = eggSprite(egg, ready);
  const bwFallback = EGG_SPRITE_NB; // fallback universel NB (pokepedia, toujours dispo)
  const baseStyle = `object-fit:contain;image-rendering:pixelated;${style}`;

  // Pension egg (parents known) or scanned (species revealed) → try PokéOS first
  const isRevealed = (egg?.parentA && egg?.parentB) || (egg?.scanned && egg?.revealedSpecies);
  if (!ready && isRevealed && egg?.species_en) {
    const sp = SPECIES_BY_EN[egg.species_en];
    const dex = sp?.dex;
    if (dex) {
      const pokeos     = `${POKEOS_EGG_BASE_URL}${dex}-animegg.png`;
      const showdown   = window.getEggSpriteUrl?.(egg.species_en) ?? fallback;
      // onerror chain: PokéOS → Showdown/manifest → rarity fallback → BW generic
      return `<img src="${pokeos}" style="${baseStyle}" onerror="if(!this._f1){this._f1=1;this.src='${showdown}'}else if(!this._f2){this._f2=1;this.src='${fallback}'}else if(!this._f3){this._f3=1;this.src='${bwFallback}'}">`;
    }
  }
  // Generic / mystery egg — single fallback to BW generic
  return `<img src="${fallback}" style="${baseStyle}" onerror="if(!this._f1){this._f1=1;this.src='${bwFallback}'}">`;
}

function pokeSpriteBack(en, shiny = false) {
  const state = globalThis.state;
  const mode = state?.settings?.spriteMode ?? 'local';
  if (mode === 'local') {
    const sp = SPECIES_BY_EN[en];
    const dexId = sp?.dex;
    if (dexId && typeof getPokemonSprite === 'function') {
      const url = getPokemonSprite(dexId, shiny ? 'backShiny' : 'back');
      if (url) return url;
    }
  }
  const sdMode = mode === 'local' ? 'gen5' : mode;
  return _showdownSpriteUrl(en, sdMode, { shiny, back: true });
}

const SPRITE_FIX = {
  // ltsurge, rocketgrunt, rocketgruntf exist directly on Showdown — no fix needed
  // Elite Four sprites need suffix
  agatha:          'agatha-gen1',
  lorelei:         'lorelei-gen1',
  phoebe:          'phoebe-gen3',
  drake:           'drake-gen3',
  // Common trainers that 404 without suffix
  channeler:       'channeler-gen1',
  cueball:         'cueball-gen1',
  rocker:          'rocker-gen1',
  tamer:           'tamer-gen1',
  // cooltrainer doesn't exist on Showdown → use acetrainer
  cooltrainer:     'acetrainer',
  cooltrainerf:    'acetrainerf',
  // New trainers — pick the most iconic version
  rocketexecutive: 'rocketexecutive-gen2',
  pokemonrangerf:  'pokemonrangerf-gen3',
  policeman:       'policeman-gen8',
};

// ── Trainer sprite resolution ────────────────────────────────────────────────
// Index à plat construit après chargement de trainer-sprites-grouped.json
const _trainerJsonIndex = {};

function _buildTrainerIndex(data) {
  // `data` = résultat de loadTrainerGroups() — TRAINER_GROUPS n'est plus global (IIFE loaders.js)
  if (!data?.trainers) return;
  const groups = data.trainers;
  for (const [groupName, groupData] of Object.entries(groups)) {
    if (groupName === 'factions') {
      for (const [, arr] of Object.entries(groupData)) {
        if (Array.isArray(arr)) arr.forEach(rel => {
          const slug = rel.replace(/\.png$/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
          _trainerJsonIndex[slug] = SHOWDOWN_TRAINER_SPRITE_BASE + rel;
        });
      }
    } else if (typeof groupData === 'object' && !Array.isArray(groupData)) {
      for (const [key, rel] of Object.entries(groupData)) {
        const slug = rel.replace(/\.png$/, '').toLowerCase();
        const keyNorm = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
        _trainerJsonIndex[slug] = SHOWDOWN_TRAINER_SPRITE_BASE + rel;
        _trainerJsonIndex[keyNorm] = SHOWDOWN_TRAINER_SPRITE_BASE + rel;
      }
    }
  }
  // Rafraîchir les images boss de la page de connexion (rendues AVANT le chargement
  // du JSON trainer-sprites-grouped). Sans ça les sprites tombent sur l'URL Showdown
  // directe qui peut 404 selon la casse, et le fallback affiche la silhouette SVG.
  document.querySelectorAll('img.isc-boss-img[data-boss-key]').forEach(img => {
    const key = img.getAttribute('data-boss-key');
    if (!key) return;
    const url = trainerSprite(key);
    if (url && url !== img.src) img.src = url;
  });
}

function trainerSprite(name) {
  if (CUSTOM_TRAINER_SPRITES[name]) return CUSTOM_TRAINER_SPRITES[name];
  // Chercher dans l'index JSON si disponible
  const norm = (name || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (_trainerJsonIndex[norm]) return _trainerJsonIndex[norm];
  // Fallback Showdown
  const fixed = SPRITE_FIX[name] || name;
  return `${SHOWDOWN_TRAINER_SPRITE_BASE}${fixed}.png`;
}

// Safe image helpers — with automatic fallback on load error
function safeTrainerImg(name, { style = '', cls = '' } = {}) {
  const src = trainerSprite(name);
  return `<img src="${src}" ${cls ? `class="${cls}"` : ''} style="${style}" alt="${name}" onerror="this.src='${FALLBACK_TRAINER_SVG}';this.onerror=null">`;
}
function safePokeImg(species_en, { shiny = false, back = false, variant = 'main', style = '', cls = '' } = {}) {
  const src = back ? pokeSpriteBack(species_en, shiny) : pokeSpriteVariant(species_en, variant, shiny);
  return `<img src="${src}" ${cls ? `class="${cls}"` : ''} style="${style}" alt="${species_en}" onerror="this.src='${FALLBACK_POKEMON_SVG}';this.onerror=null">`;
}

function speciesName(en) {
  if (!SPECIES_BY_EN[en]) return en;
  const state = globalThis.state;
  return state.lang === 'fr' ? SPECIES_BY_EN[en].fr : en.charAt(0).toUpperCase() + en.slice(1);
}

function pokemonDisplayName(p) {
  return p.nick || speciesName(p.species_en);
}

Object.assign(globalThis, {
  sanitizeSpriteName, pokeSpriteVariant, pokeSprite, pokeIcon,
  eggSprite, eggImgTag, pokeSpriteBack,
  _buildTrainerIndex, trainerSprite, safeTrainerImg, safePokeImg,
  speciesName, pokemonDisplayName,
});

export {};
