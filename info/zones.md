# Zones — Référence complète

Toutes les zones du jeu. Source : `data/zones-data.js` + `data/zones-visuals-data.js`.

> Pour modifier une zone, éditez directement `data/zones-data.js`.
> En dev, utilisez `tools/zone-editor.html` pour une interface visuelle.

---

## Types de zone

| Type | Description | Particularités |
|---|---|---|
| `route` | Zone nature/grotte | Combat + capture, pas de gym |
| `city` | Ville avec arène | Gym leader, raid dès 10 combats, bonus XP |
| `special` | Lieu unique | Règles propres (safari, casino, légendaire…) |

---

## Zones par réputation requise

### Routes & Nature

| ID | Nom FR | Rep | SpawnRate | Mastery Elite | Invest |
|---|---|---|---|---|---|
| `route1` | Route 1 | 0 | 0.07/s | — | — |
| `pallet_garden` | Jardin de Pallet | 30 | 0.07/s | — | — |
| `route22` | Chenal 22 | 80 | 0.07/s | — | — |
| `viridian_forest` | Forêt de Jade | 100 | 0.08/s | — | — |
| `mt_moon` | Mont Sélénite | 200 | 0.04/s | lorelei | — |
| `diglett_cave` | Grotte Taupiqueur | 300 | 0.05/s | — | — |
| `rock_tunnel` | Grotte | 400 | 0.04/s | — | — |
| `seafoam_islands` | Îles Écume | 800 | 0.06/s | lorelei | 40 000₽ |
| `victory_road` | Route Victoire | 950 | 0.04/s | lance | 50 000₽ |
| `unknown_cave` | Grotte Inconnue | 1 100 | 0.03/s | mewtwo | 80 000₽ |
| `mt_silver` | Mt. Argenté | 1 200 | 0.03/s | red | 100 000₽ |

### Villes (Arènes)

| ID | Nom FR | Rep | SpawnRate | Gym Leader | XP Bonus |
|---|---|---|---|---|---|
| `pewter_gym` | Argenta | 150 | 0.06/s | brock | ×2 |
| `cerulean_gym` | Azuria | 300 | 0.06/s | misty | ×2 |
| `celadon_gym` | Céladopole | 450 | 0.06/s | erika | ×2 |
| `fuchsia_gym` | Parmanie | 650 | 0.06/s | koga | ×3 |
| `saffron_gym` | Safrania | 800 | 0.06/s | sabrina | ×3 |
| `cinnabar_gym` | Cramois'Île | 870 | 0.06/s | blaine | ×3 |
| `indigo_plateau` | Plateau Indigo | 1 000 | 0.06/s | lance | ×5 |

### Lieux Spéciaux

| ID | Nom FR | Rep | SpawnRate | Item requis | Invest |
|---|---|---|---|---|---|
| `ss_anne` | Bateau St. Anne | 350 | 0.06/s | ss_anne_ticket | 15 000₽ |
| `lavender_town` | Lavanville | 480 | 0.05/s | — | 20 000₽ |
| `safari_zone` | Parc Safari | 500 | 0.07/s | safari_pass | 25 000₽ |
| `celadon_casino` | Casino de Céladopole | 600 | 0.07/s | — | 30 000₽ |
| `silph_co` | Sylphe SARL | 900 | 0.07/s | — | 50 000₽ |
| `pokemon_mansion` | Manoir Pokémon | 870 | 0.04/s | — | 40 000₽ |
| `tourbillon` | Îles Tourbillon | 900 | 0.04/s | tourbillon_permit | 45 000₽ |
| `tour_carillon` | Tour Carillon | 950 | 0.04/s | carillon_permit | 45 000₽ |

---

## Backgrounds (`ZONE_BGS`)

| ID | Image Showdown | Fallback |
|---|---|---|
| `route1`, `viridian_forest`, `route22`, `pallet_garden`, `safari_zone` | `meadow.png` | vert |
| `mt_moon`, `diglett_cave`, `rock_tunnel`, `victory_road`, `unknown_cave`, `pewter_gym`, `mt_silver` | `mountain.png` | gris/bleu |
| `seafoam_islands`, `tourbillon` | `deepsea.png` | bleu nuit |
| `ss_anne`, `cerulean_gym` | `beach.png` | bleu clair |
| `power_plant`, `silph_co`, `saffron_gym`, `pokemon_tower`, `lavender_town`, `pokemon_mansion`, `celadon_casino` | `city.png` | sombre |
| `celadon_gym` | `forest.png` | vert |
| `fuchsia_gym` | `river.png` | violet |
| `cinnabar_gym` | `desert.png` | rouge |
| `indigo_plateau` | `mountain.png` | bleu-gris |
| `tour_carillon` | `city.png` | doré sombre |

> Images Showdown : `https://play.pokemonshowdown.com/fx/bg-{name}.png`
> ⚠️ Pas de `crossorigin="anonymous"` sur ces images (pas de CORS).

---

## Champs d'une zone (`zones-data.js`)

```js
{
  id:           'zone_id',       // clé unique snake_case
  fr:           'Nom FR',        // affiché en jeu
  en:           'Name EN',
  rep:          0,               // réputation requise pour débloquer
  spawnRate:    0.07,            // spawns/seconde (recommandé : 0.03–0.08)
  type:         'route',         // 'route' | 'city' | 'special'
  pool:         ['bulbasaur'],   // espèces capturables (nom EN)
  rarePool:     ['mewtwo'],      // pool rare (boost rarescope) — optionnel
  trainers:     ['acetrainer'],  // types de dresseurs
  eliteTrainer: 'lance',         // dresseur élite (mastery ≥ 2) — optionnel
  gymLeader:    'brock',         // leader arène (type city) — optionnel
  xpBonus:      2,               // multiplicateur XP (type city) — optionnel
  investCost:   20000,           // coût investissement — optionnel
  unlockItem:   'item_id',       // item requis — optionnel
  music:        'key',           // clé BGM — optionnel
  zoneIds:      ['zone_id'],     // restriction d'événements — optionnel
}
```

---

## Mastery

| Niveau | Condition | Effets |
|---|---|---|
| 0 | < 10 combats | Base |
| 1 | ≥ 10 combats | Events spéciaux possibles, ennemis plus forts |
| 2 | ≥ 10 combats + élite battu | Elite trainer dispo, scaling +6% raid |
| 3 | ≥ 50 combats | Scaling max, +15% raid chance |

---

## Règles de spawn (`spawnInZone`)

Ordre de priorité (tirage aléatoire `r`) :

1. **Coffre** — `r < chestChance` (base 5%, boosté par `chestBoost`)
2. **Événement spécial** — seulement si zone `idle` (pas d'event actif), mastery ≥ 1
3. **Elite trainer** — `r < chestChance + 0.13`, mastery ≥ 2, bloqué si event actif
4. **Pokémon rare** — `r < rarePoolChance` (10%, 30% si rarescope actif)
5. **Raid** — agents ≥ 2 (ou 1 + boss), `r < 0.40 + diffBonus`, bloqué si event actif
6. **Dresseur normal** — selon `zone.trainers`
7. **Pokémon commun** — pool principal

---

## États d'une zone (3 états)

| État | Condition | Affichage fogmap |
|---|---|---|
| **Open** | `openZones.has(zoneId)` | `[OUVERT]` — bordure rouge |
| **Auto** | agent assigné, zone fermée | `[AUTO]` — bordure bleue |
| **Inactive** | aucun agent | `[ENTRER]` — neutre |

Superposé :

| Modificateur | Condition | Affichage |
|---|---|---|
| `[ÉVÉNEMENT]` | `zoneActivity.mode === 'event'` | bordure or |
| `[COMBAT]` | zone dégradée (rep insuffisante) | bordure rouge atténué |
