// Vivarium only: trainer portraits elsewhere in the game remain unchanged.
import { CHARACTER_METADATA } from '../assets/vivarium_characters/metadata.js';
import { attachVivariumAnimation } from './pmdSprites.js';

const TYPES = new Set(['agent', 'boss', 'rival', 'nurse', 'scientist', 'fan']);
const ALIASES = { cooltrainer: 'acetrainer', cooltrainerf: 'acetrainerf', nursejoy: 'nurse',
  sprite_giovanni_hgss: 'giovanni' };
const baseUrl = new URL('../assets/vivarium_characters/', import.meta.url);

export function resolveCharacterKey(entry) {
  if (!entry || !TYPES.has(entry.type)) return null;
  // Explicit identity in new snapshots; filename inference keeps old OBS blobs.
  let key = entry.trainerKey;
  if (!key && typeof entry.spriteUrl === 'string') {
    try {
      key = new URL(entry.spriteUrl, 'https://local.invalid/').pathname.split('/').pop()
        .replace(/\.(?:png|gif|webp)$/i, '');
    } catch { /* Unsupported portrait: keep the existing image. */ }
  }
  key = typeof key === 'string' ? key.toLowerCase().replace(/gen[1-4]$/, '') : '';
  key = ALIASES[key] || key;
  return Object.hasOwn(CHARACTER_METADATA, key) ? key : null;
}

export function attachCharacterSprite(host, entry) {
  const key = resolveCharacterKey(entry);
  return key ? attachVivariumAnimation(host, CHARACTER_METADATA[key], baseUrl) : null;
}
