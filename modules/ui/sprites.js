// ============================================================
//  modules/ui/sprites.js
//  Pokémon & trainer sprite resolution, egg sprites, safe img helpers
//  Exported symbols exposed on globalThis for backward-compat.
// ============================================================

'use strict';

import { FALLBACK_TRAINER_SVG, FALLBACK_POKEMON_SVG } from '../../data/assets-data.js';

// ── Name sanitisation ─────────────────────────────────────────────────────────

export function sanitizeSpriteName(en) {
  // Showdown: no hyphens for nidoran (nidoranf/m), mr-mime → mrmime, etc.
  return en.replace(/[^a-z0-9]/g, '');
}

// ── Showdown sprite URL resolver ─────────────────────────────────────────────
// mode: 'gen1'|'gen2'|'gen3'|'gen4'|'gen5'|'ani'|'dex'|'home'

export function _showdownSpriteUrl(en, mode, { shiny = false, back = false } = {}) {
  const name = sanitizeSpriteName(en);
  const sh   = shiny ? '-shiny' : '';
  const bk   = back  ? '-back'  : '';
  const isGif = mode === 'ani';
  const ext   = isGif ? 'gif' : 'png';
  let folder;
  switch (mode) {
    case 'gen1': folder = `gen1${sh}`;             break; // no back-shiny in gen1
    case 'gen2': folder = `gen2${bk}${sh}`;        break;
    case 'gen3': folder = `gen3${bk}${sh}`;        break;
    case 'gen4': folder = `gen4${bk}${sh}`;        break;
    case 'ani':  folder = `ani${bk}${sh}`;         break;
    case 'dex':  folder = back ? `gen5${bk}${sh}` : `dex${sh}`; break;
    case 'home': folder = back ? `gen5${bk}${sh}` : `home-centered${sh}`; break;
    default:     folder = `gen5${bk}${sh}`;        break;
  }
  return `https://play.pokemonshowdown.com/sprites/${folder}/${name}.${ext}`;
}

// ── Pokémon sprite helpers ────────────────────────────────────────────────────

export function pokeSpriteVariant(en, variant = 'main', shiny = false) {
  const mode = globalThis.state?.settings?.spriteMode ?? 'local';
  if (mode === 'local' && variant !== 'showdown') {
    const sp    = globalThis.SPECIES_BY_EN?.[en];
    const dexId = sp?.dex;
    if (dexId && typeof globalThis.getPokemonSprite === 'function') {
      const key = shiny && variant === 'main' ? 'shiny'
                : shiny && variant === 'back'  ? 'backShiny'
                : variant;
      const url = globalThis.getPokemonSprite(dexId, key);
      if (url) return url;
    }
  }
  const sdMode = mode === 'local' ? 'gen5' : mode;
  return _showdownSpriteUrl(en, sdMode, { shiny });
}

export function pokeSprite(en, shiny = false) {
  return pokeSpriteVariant(en, 'main', shiny);
}

export function pokeSpriteBack(en, shiny = false) {
  const mode = globalThis.state?.settings?.spriteMode ?? 'local';
  if (mode === 'local') {
    const sp    = globalThis.SPECIES_BY_EN?.[en];
    const dexId = sp?.dex;
    if (dexId && typeof globalThis.getPokemonSprite === 'function') {
      const url = globalThis.getPokemonSprite(dexId, shiny ? 'backShiny' : 'back');
      if (url) return url;
    }
  }
  const sdMode = mode === 'local' ? 'gen5' : mode;
  return _showdownSpriteUrl(en, sdMode, { shiny, back: true });
}

// Icône miniature BW (~40×30 px)
export function pokeIcon(en) {
  const name = sanitizeSpriteName(en);
  return `https://play.pokemonshowdown.com/sprites/bwicons/${name}.png`;
}

// ── Egg sprites ───────────────────────────────────────────────────────────────

const _EGG_NB = 'https://www.pokepedia.fr/images/f/f5/Sprite_%C5%92uf_NB.png?20190202195308';

export const EGG_SPRITES = {
  common:    _EGG_NB,
  uncommon:  'https://www.pokepedia.fr/images/a/ab/Sprite_%C5%92uf_5_km_GO.png',
  rare:      'https://www.pokepedia.fr/images/7/70/Sprite_%C5%92uf_10_km_GO.png',
  very_rare: 'https://www.pokepedia.fr/images/a/a8/Sprite_%C5%92uf_12_km_GO.png',
  legendary: 'https://www.pokepedia.fr/images/a/a8/Sprite_%C5%92uf_12_km_GO.png',
  ready:     'https://www.pokepedia.fr/images/f/f5/Sprite_%C5%92uf_NB.png?20190202195308',
  default:   _EGG_NB,
};

export function eggSprite(egg, ready = false) {
  if (ready) return EGG_SPRITES.ready;
  const rarity = egg?.rarity || 'common';
  return EGG_SPRITES[rarity] || EGG_SPRITES.default;
}

/**
 * Retourne un string `<img>` avec PokéOS (espèce connue) ou fallback rareté → NB.
 * @param {object}  egg
 * @param {boolean} ready  – true = prêt à éclore
 * @param {string}  style  – CSS inline supplémentaire
 */
export function eggImgTag(egg, ready = false, style = '') {
  const fallback   = eggSprite(egg, ready);
  const bwFallback = _EGG_NB;
  const baseStyle  = `object-fit:contain;image-rendering:pixelated;${style}`;

  const isRevealed = (egg?.parentA && egg?.parentB) || (egg?.scanned && egg?.revealedSpecies);
  if (!ready && isRevealed && egg?.species_en) {
    const sp  = globalThis.SPECIES_BY_EN?.[egg.species_en];
    const dex = sp?.dex;
    if (dex) {
      const pokeos = `https://s3.pokeos.com/pokeos-uploads/forgotten-dex/eggs/${dex}-animegg.png`;
      return `<img src="${pokeos}" style="${baseStyle}" onerror="if(!this._f1){this._f1=1;this.src='${fallback}'}else if(!this._f2){this._f2=1;this.src='${bwFallback}'}">`;
    }
  }
  return `<img src="${fallback}" style="${baseStyle}" onerror="if(!this._f1){this._f1=1;this.src='${bwFallback}'}">`;
}

// ── Trainer sprite resolution ─────────────────────────────────────────────────

export const SPRITE_FIX = {
  agatha:          'agatha-gen1',
  lorelei:         'lorelei-gen1',
  phoebe:          'phoebe-gen3',
  drake:           'drake-gen3',
  channeler:       'channeler-gen1',
  cueball:         'cueball-gen1',
  rocker:          'rocker-gen1',
  tamer:           'tamer-gen1',
  cooltrainer:     'acetrainer',
  cooltrainerf:    'acetrainerf',
  rocketexecutive: 'rocketexecutive-gen2',
  pokemonrangerf:  'pokemonrangerf-gen3',
  policeman:       'policeman-gen8',
};

export const CUSTOM_TRAINER_SPRITES = {
  giovanni: 'https://www.pokepedia.fr/images/archive/7/73/20230124191924%21Sprite_Giovanni_RB.png',
};

// Index à plat construit après chargement de trainer-sprites-grouped.json
export const _trainerJsonIndex = {};

export function _buildTrainerIndex(data) {
  if (!data?.trainers) return;
  const base   = 'https://play.pokemonshowdown.com/sprites/trainers/';
  const groups = data.trainers;
  for (const [groupName, groupData] of Object.entries(groups)) {
    if (groupName === 'factions') {
      for (const [, arr] of Object.entries(groupData)) {
        if (Array.isArray(arr)) arr.forEach(rel => {
          const slug = rel.replace(/\.png$/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
          _trainerJsonIndex[slug] = base + rel;
        });
      }
    } else if (typeof groupData === 'object' && !Array.isArray(groupData)) {
      for (const [key, rel] of Object.entries(groupData)) {
        const slug    = rel.replace(/\.png$/, '').toLowerCase();
        const keyNorm = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
        _trainerJsonIndex[slug]    = base + rel;
        _trainerJsonIndex[keyNorm] = base + rel;
      }
    }
  }
}

export function trainerSprite(name) {
  if (CUSTOM_TRAINER_SPRITES[name]) return CUSTOM_TRAINER_SPRITES[name];
  const norm = (name || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (_trainerJsonIndex[norm]) return _trainerJsonIndex[norm];
  const fixed = SPRITE_FIX[name] || name;
  return `https://play.pokemonshowdown.com/sprites/trainers/${fixed}.png`;
}

// ── Safe img helpers (avec fallback sur erreur) ───────────────────────────────

export function safeTrainerImg(name, { style = '', cls = '' } = {}) {
  const src = trainerSprite(name);
  return `<img src="${src}" ${cls ? `class="${cls}"` : ''} style="${style}" alt="${name}" onerror="this.src='${FALLBACK_TRAINER_SVG}';this.onerror=null">`;
}

export function safePokeImg(species_en, { shiny = false, back = false, variant = 'main', style = '', cls = '' } = {}) {
  const src = back ? pokeSpriteBack(species_en, shiny) : pokeSpriteVariant(species_en, variant, shiny);
  return `<img src="${src}" ${cls ? `class="${cls}"` : ''} style="${style}" alt="${species_en}" onerror="this.src='${FALLBACK_POKEMON_SVG}';this.onerror=null">`;
}

// ── Backward-compat: expose on globalThis ─────────────────────────────────────
globalThis.sanitizeSpriteName   = sanitizeSpriteName;
globalThis._showdownSpriteUrl   = _showdownSpriteUrl;
globalThis.pokeSpriteVariant    = pokeSpriteVariant;
globalThis.pokeSprite           = pokeSprite;
globalThis.pokeSpriteBack       = pokeSpriteBack;
globalThis.pokeIcon             = pokeIcon;
globalThis.eggSprite            = eggSprite;
globalThis.eggImgTag            = eggImgTag;
globalThis.EGG_SPRITES          = EGG_SPRITES;
globalThis.SPRITE_FIX           = SPRITE_FIX;
globalThis.CUSTOM_TRAINER_SPRITES = CUSTOM_TRAINER_SPRITES;
globalThis._trainerJsonIndex    = _trainerJsonIndex;
globalThis._buildTrainerIndex   = _buildTrainerIndex;
globalThis.trainerSprite        = trainerSprite;
globalThis.safeTrainerImg       = safeTrainerImg;
globalThis.safePokeImg          = safePokeImg;
