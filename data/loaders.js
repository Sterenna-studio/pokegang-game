// ════════════════════════════════════════════════════════════════
//  PokéForge — Sprite Data Loaders
//  Toutes les variables internes sont encapsulées dans un IIFE pour
//  ne PAS polluer le scope global (évite les collisions avec app.js).
//  Seules les fonctions publiques sont exposées sur window.
// ════════════════════════════════════════════════════════════════
(function () {
  const POKEMON_SPRITES_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/";
  const ITEM_SPRITES_BASE    = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/";
  const TRAINER_SPRITES_BASE = "https://play.pokemonshowdown.com/sprites/trainers/";

  let _pokemonSprites   = null;
  let _itemSprites      = null;
  let _trainerGroups    = null;
  let _zoneTrainerPools = null;
  let _eggSprites       = null;

  async function loadPokemonSprites() {
    if (_pokemonSprites) return _pokemonSprites;
    const res = await fetch("data/pokemon-sprites-kanto.json");
    if (!res.ok) throw new Error("Impossible de charger pokemon-sprites-kanto.json");
    _pokemonSprites = await res.json();
    return _pokemonSprites;
  }

  async function loadItemSprites() {
    if (_itemSprites) return _itemSprites;
    const res = await fetch("data/item-sprites.json");
    if (!res.ok) throw new Error("Impossible de charger item-sprites.json");
    _itemSprites = await res.json();
    return _itemSprites;
  }

  async function loadTrainerGroups() {
    if (_trainerGroups) return _trainerGroups;
    const res = await fetch("data/trainer-sprites-grouped.json");
    if (!res.ok) throw new Error("Impossible de charger trainer-sprites-grouped.json");
    _trainerGroups = await res.json();
    return _trainerGroups;
  }

  async function loadZoneTrainerPools() {
    if (_zoneTrainerPools) return _zoneTrainerPools;
    const res = await fetch("data/zone-trainer-pools.json");
    if (!res.ok) throw new Error("Impossible de charger zone-trainer-pools.json");
    _zoneTrainerPools = await res.json();
    return _zoneTrainerPools;
  }

  async function loadEggSprites() {
    if (_eggSprites) return _eggSprites;
    const res = await fetch("data/egg-sprites.json");
    if (!res.ok) throw new Error("Impossible de charger egg-sprites.json");
    _eggSprites = await res.json();
    return _eggSprites;
  }

  // Retourne l'URL du sprite d'œuf pour une espèce donnée.
  // Format Showdown : basePath + species[en] + ".png"
  function getEggSpriteUrl(speciesEn) {
    if (!_eggSprites) return null;
    const base    = _eggSprites.meta?.basePath ?? 'https://play.pokemonshowdown.com/sprites/';
    const path    = _eggSprites.species?.[speciesEn] ?? _eggSprites.fallback ?? 'gen5/eggs/egg';
    return base + path + '.png';
  }

  function getPokemonEntry(id) {
    return _pokemonSprites?.pokemon?.find(p => p.id === Number(id)) || null;
  }

  function getPokemonSprite(id, key = "main") {
    const entry = getPokemonEntry(id);
    const rel = entry?.sprites?.[key];
    return rel ? POKEMON_SPRITES_BASE + rel : null;
  }

  function getItemSprite(key) {
    const rel = _itemSprites?.items?.[key];
    return rel ? ITEM_SPRITES_BASE + rel : null;
  }

  function getTrainerSprite(groupName, key) {
    const group = _trainerGroups?.trainers?.[groupName];
    if (!group || Array.isArray(group)) return null;
    const rel = group[key];
    return rel ? TRAINER_SPRITES_BASE + rel : null;
  }

  function getFactionSpriteList(factionName) {
    const arr = _trainerGroups?.trainers?.factions?.[factionName];
    if (!Array.isArray(arr)) return [];
    return arr.map(rel => TRAINER_SPRITES_BASE + rel);
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function pickTrainerForZone(zoneId) {
    const zone = _zoneTrainerPools?.zones?.[zoneId];
    if (!zone) return null;
    const commonKey = zone.commons?.length ? pickRandom(zone.commons) : null;
    if (commonKey) {
      const rel = _trainerGroups?.trainers?.common?.[commonKey];
      if (rel) return TRAINER_SPRITES_BASE + rel;
    }
    return null;
  }

  // ── API publique exposée sur window ──────────────────────────────────────
  window.loadPokemonSprites   = loadPokemonSprites;
  window.loadItemSprites      = loadItemSprites;
  window.loadTrainerGroups    = loadTrainerGroups;
  window.loadZoneTrainerPools = loadZoneTrainerPools;
  window.loadEggSprites       = loadEggSprites;
  window.getPokemonEntry      = getPokemonEntry;
  window.getPokemonSprite     = getPokemonSprite;
  window.getItemSprite        = getItemSprite;
  window.getTrainerSprite     = getTrainerSprite;
  window.getFactionSpriteList = getFactionSpriteList;
  window.getEggSpriteUrl      = getEggSpriteUrl;
  window.pickRandom           = pickRandom;
  window.pickTrainerForZone   = pickTrainerForZone;
})();
