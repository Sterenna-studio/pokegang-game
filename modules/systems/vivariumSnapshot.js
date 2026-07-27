'use strict';

// ════════════════════════════════════════════════════════════════
//  vivariumSnapshot.js — construit, à partir d'un `state` donné, les
//  données d'affichage du vivarium (résidents qui se baladent, pool de
//  cameos éligibles, fond de zone) sous une forme déjà résolue (URLs de
//  sprites, libellés, lignes de dialogue) et indépendante du DOM.
//
//  Extrait de gang/environment.js pour être partagé par deux
//  consommateurs :
//  - gang/environment.js (rendu local live, lit `globalThis.state`)
//  - modules/systems/cloudAccount.js (snapshot poussé périodiquement
//    vers Supabase pour affichage distant en lecture seule, OBS)
//
//  Fonctions pures de `state` (aucun accès direct à `globalThis.state`
//  ici) — seuls les helpers de rendu (sprites/noms/traductions) sont lus
//  sur `globalThis`/bare-name, mêmes conventions que le reste du repo.
//
//  Dépendances globalThis : pokeSprite, pokemonDisplayName, trainerSprite,
//    NATURES, TRAINER_TYPES, EGG_SPRITES, getBossTeamPower, COSMETIC_BGS,
//    fabricBgUrl
//  Dépendances classiques (bare-name) : ZONE_BY_ID, TITLES
// ════════════════════════════════════════════════════════════════

// ── Sources de résidents — chacune est juste "un endroit où lire une liste
// d'ids de Pokémon" ; state.cosmetics.vivariumSources (persisté, whitelist
// cosmétique déjà couverte par saveState()) choisit lesquelles alimentent le
// vivarium. Lecture seule : aucune de ces sources n'est jamais mutée d'ici.
export const VIVARIUM_SOURCES = [
  { key: 'showcase', icon: '🏠', label: 'Vitrine',        ids: state => (state.gang.showcase || []).filter(Boolean) },
  { key: 'team',     icon: '⚔️', label: 'Équipe active',  ids: state => state.gang.bossTeamSlots?.[state.gang.activeBossTeamSlot || 0] || [] },
  { key: 'pension',  icon: '🏥', label: 'Pension',         ids: state => state.pension?.slots || [] },
  { key: 'training', icon: '💪', label: 'Formation',       ids: state => state.trainingRoom?.pokemon || [] },
];

// Petits événements narratifs — un agent en patrouille (ou tout juste sorti
// de prison), l'infirmière qui passe pour la pension, un chercheur qui
// observe — chaque passage porte une bulle de dialogue contextuelle.
const AGENT_RELEASED_WINDOW_MS = 2 * 60 * 60_000; // "tout juste sorti" si restUntil < 2h
const AGENT_LINES = [
  'En patrouille, boss !',
  "Tout est calme dans le secteur.",
  'On tient la position !',
  'Prêt pour la prochaine mission.',
  "Content de faire partie du gang, boss.",
];
const AGENT_RELEASED_LINES = [
  "Merci boss de m'avoir sorti de là !",
  'Je vous revaudrai ça, boss.',
  "La prison, plus jamais... merci boss.",
];
const NURSE_LINES = [
  'Un œuf tout frais pour la pension !',
  'Je passais vérifier vos œufs, tout va bien.',
  'Prenez soin d’eux, ils grandissent vite !',
];
const SCIENTIST_LINES = [
  'Fascinant... ces données vont enrichir le Pokédex.',
  'Vos Pokémon montrent des statistiques intéressantes.',
  'Je termine juste quelques relevés, ne faites pas attention à moi.',
];

// Rival de gang — la Team Rocket est déjà la faction antagoniste établie
// dans ce jeu (pool de dresseurs de plusieurs zones) ; n'apparaît que si le
// gang a assez de réputation pour attirer ce genre d'attention.
const RIVAL_REP_THRESHOLD = 300;
const RIVAL_SPRITES = ['rocketgrunt', 'rocketgruntf'];
const RIVAL_LINES = [
  'Votre territoire ne durera pas.',
  'La Team Rocket a l’œil sur vous.',
  'On se reverra, boss.',
  'Ne baissez pas votre garde.',
];

const FAN_LINES = [
  'Votre équipe est incroyable, j’aimerais tant vous ressembler !',
  'Je peux avoir un autographe, boss ?',
  'On parle de vous dans tout le quartier !',
];

const BOSS_LINES = [
  'Je viens juste vérifier que tout va bien.',
  'Belle équipe que j’ai là, si je puis dire.',
  'Le quartier est calme aujourd’hui.',
];

// Même logique que gang/panels.js:_getBossFullTitle() (copie volontaire —
// même duplication déjà présente dans modules/systems/titles.js ; TITLES
// est un bare-name classic script chargé par les deux consommateurs de ce
// module : gang/index.html et index.html).
function _getBossFullTitle(state) {
  const label = id => {
    const t = TITLES.find(t => t.id === id);
    if (!t) return '';
    return state.lang === 'en' ? (t.label_en || t.label) : t.label;
  };
  const t1 = label(state.gang.titleA);
  const t2 = label(state.gang.titleB);
  const lia = state.gang.titleLiaison || '';
  if (!t1 && !t2) return state.lang === 'en' ? 'Recruit' : 'Recrue';
  if (t1 && !t2) return t1;
  if (!t1 && t2) return t2;
  return `${t1}${lia ? ' ' + lia : ''} ${t2}`;
}

// Bassin de répliques éligibles pour un agent donné — la ligne générique
// (patrouille/sorti de prison) est toujours présente, complétée par des
// répliques contextuelles quand les données réelles le permettent : un
// Pokémon confié (nickname pris en compte via pokemonDisplayName), un
// bilan de combats sur sa zone assignée (type de dresseur réellement
// présent dans le pool de cette zone, cf. data/zones-data.js:trainers), et
// le titre complet du boss.
function _buildAgentLines(agent, state) {
  const now = Date.now();
  const recentlyFreed = !agent.resting && agent.restUntil
    && (now - agent.restUntil) >= 0 && (now - agent.restUntil) < AGENT_RELEASED_WINDOW_MS;

  const lines = [...(recentlyFreed ? AGENT_RELEASED_LINES : AGENT_LINES)];

  if (agent.team?.length > 0) {
    const pkId = agent.team[Math.floor(Math.random() * agent.team.length)];
    const pk = state.pokemons.find(p => p.id === pkId);
    if (pk) {
      const name = globalThis.pokemonDisplayName?.(pk) || pk.species_en;
      lines.push(`Merci de m'avoir confié ${name}, boss.`);
    }
  }

  if (agent.assignedZone) {
    const zone = ZONE_BY_ID[agent.assignedZone];
    const combats = state.zones?.[agent.assignedZone]?.combatsWon || 0;
    if (zone?.trainers?.length > 0 && combats > 0) {
      const trainerKey = zone.trainers[Math.floor(Math.random() * zone.trainers.length)];
      const label = globalThis.TRAINER_TYPES?.[trainerKey]?.fr;
      if (label) lines.push(`J'ai battu ${combats} ${label}${combats > 1 ? 's' : ''} sur ${zone.fr}.`);
    }
  }

  lines.push(`Fier de servir sous ${_getBossFullTitle(state)}, boss !`);

  return lines;
}

function _buildNurseLines(state) {
  const lines = [...NURSE_LINES];
  const pensionCount = state.pension?.slots?.filter(Boolean).length || 0;
  if (pensionCount > 0) {
    const max = 2 + (state.pension?.extraSlotsPurchased || 0);
    lines.push(`La pension compte ${pensionCount}/${max} pokémon en ce moment.`);
  }
  return lines;
}

function _buildScientistLines(state) {
  const lines = [...SCIENTIST_LINES];
  const shinyCount = state.stats?.shinyCaught || 0;
  if (shinyCount > 0) {
    lines.push(`Vous avez déjà repéré ${shinyCount} chromatique${shinyCount > 1 ? 's' : ''}, un vrai record !`);
  }
  return lines;
}

// ── Résidents (Pokémon qui se baladent en permanence) ────────────────────
// Résout state.cosmetics.vivariumSources (toggle des zones affichées) vers
// une liste déjà résolue pour l'affichage : plus besoin de `state.pokemons`
// côté consommateur (utile pour un blob distant, où seule cette forme
// aplatie voyage).
export function buildVivariumResidents(state) {
  const enabledSources = new Set(state.cosmetics?.vivariumSources || ['showcase', 'team']);
  const seenIds = new Set(); // dédoublonne un pokémon présent dans plusieurs sources actives à la fois
  const NATURES = globalThis.NATURES;
  const residents = [];

  for (const src of VIVARIUM_SOURCES) {
    if (!enabledSources.has(src.key)) continue;
    for (const id of src.ids(state)) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const pk = state.pokemons.find(p => p.id === id);
      if (!pk) continue;
      residents.push({
        spriteUrl:   globalThis.pokeSprite(pk.species_en, pk.shiny),
        label:       globalThis.pokemonDisplayName?.(pk) || pk.species_en,
        level:       pk.level,
        natureLabel: pk.nature && NATURES?.[pk.nature] ? NATURES[pk.nature].fr : null,
      });
    }
  }
  return residents;
}

// ── Pool de cameos — un représentant par type ACTUELLEMENT éligible (pas un
// tirage unique : le tirage aléatoire final reste côté renderer, comme
// avant l'extraction — cf. gang/environment.js:_fireCameoEvent). ─────────
export function buildVivariumCameoPool(state) {
  const pool = [];

  if (state.agents.length > 0) {
    const agent = state.agents[Math.floor(Math.random() * state.agents.length)];
    const hasTeam = agent.team && agent.team.length > 0;
    const followIconUrl = hasTeam && Math.random() < 0.6
      ? (() => {
          const pk = state.pokemons.find(p => p.id === agent.team[0]);
          return pk ? globalThis.pokeSprite(pk.species_en, pk.shiny) : null;
        })()
      : null;
    // agent.sprite est déjà une URL résolue (trainerSprite(agent.spriteKey)
    // appliqué à la création, cf. modules/systems/agent.js:72-73) — la
    // re-passer à trainerSprite() ici la traiterait à tort comme une clé brute.
    const spriteUrl = agent.spriteKey ? globalThis.trainerSprite(agent.spriteKey) : agent.sprite;
    pool.push({ type: 'agent', spriteUrl, label: agent.name, followIconUrl, lines: _buildAgentLines(agent, state) });
  }

  const favs = state.pokemons.filter(p => p.favorite);
  if (favs.length > 0) {
    const pk = favs[Math.floor(Math.random() * favs.length)];
    pool.push({
      type: 'favorite',
      spriteUrl: globalThis.pokeSprite(pk.species_en, pk.shiny),
      label: globalThis.pokemonDisplayName?.(pk) || pk.species_en,
      lines: [],
    });
  }

  if ((state.eggs?.length || 0) > 0 || state.pension?.eggAt) {
    pool.push({
      type: 'nurse',
      spriteUrl: globalThis.trainerSprite('nurse'),
      label: 'Infirmière Joy',
      followIconUrl: globalThis.EGG_SPRITES?.default,
      lines: _buildNurseLines(state),
    });
  }

  pool.push({ type: 'scientist', spriteUrl: globalThis.trainerSprite('scientist'), label: 'Chercheur', lines: _buildScientistLines(state) });
  pool.push({ type: 'fan', spriteUrl: globalThis.trainerSprite('pokefan'), label: 'Fan Pokémon', lines: [...FAN_LINES] });

  if ((state.gang.reputation || 0) >= RIVAL_REP_THRESHOLD) {
    const sprite = RIVAL_SPRITES[Math.floor(Math.random() * RIVAL_SPRITES.length)];
    pool.push({ type: 'rival', spriteUrl: globalThis.trainerSprite(sprite), label: 'Rival', lines: [...RIVAL_LINES], hostile: true });
  }

  if (state.gang.bossSprite) {
    const power = globalThis.getBossTeamPower?.() ?? null;
    const lines = [...BOSS_LINES];
    if (power !== null) lines.push(`Puissance de l'équipe : ${power.toLocaleString()}. On progresse.`);
    pool.push({ type: 'boss', spriteUrl: globalThis.trainerSprite(state.gang.bossSprite), label: state.gang.bossName || 'Boss', lines });
  }

  return pool;
}

// ── Fond de la zone (state.cosmetics.bossBg) — retourne un descripteur
// {type, url|value} plutôt qu'une simple URL : les trois catégories de fond
// (image plein cadre, gradient CSS, tissu carrelé) ont chacune une façon
// différente d'être appliquées en CSS (cf. gang/environment.js:_applyBackgroundData).
export function buildVivariumBackgroundData(state) {
  const key = state.cosmetics?.bossBg || null;
  if (!key) return null;
  const COSMETIC_BGS = globalThis.COSMETIC_BGS;
  const bg = COSMETIC_BGS?.[key];

  if (bg?.type === 'image') return { type: 'image', url: bg.url };
  if (bg?.type === 'gradient') return { type: 'gradient', value: bg.gradient };
  if (key.startsWith('fabric_')) {
    const m = key.match(/^fabric_(\d+)(?:_v(\d+))?$/);
    const url = m ? globalThis.fabricBgUrl(parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) : 1) : null;
    return url ? { type: 'fabric', url } : null;
  }
  return null;
}
