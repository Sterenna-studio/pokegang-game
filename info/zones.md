# Zones - référence complète

Source principale : `data/zones-data.js`.

Sources liées :

- `data/zones-visuals-data.js` pour les backgrounds.
- `modules/systems/zoneSystem.js` pour les règles de déblocage, mastery, spawn et raids.
- `tools/zone-editor.html` pour une inspection/modification visuelle en dev.

Pour modifier une zone, éditez d'abord `data/zones-data.js`, puis vérifiez cette référence.

---

## Types de zone

| Type | Description | Particularités |
|---|---|---|
| `gang_park` | Quartier Général du joueur | Toujours accessible, pas de spawn, zone de gestion |
| `route` | Route, grotte ou zone sauvage | Capture + dresseurs |
| `city` | Ville ou zone urbaine | Dresseurs plus fréquents, arène si `gymLeader` existe |
| `special` | Lieu unique | Règles propres, unlock item ou rare pool selon la zone |

---

## Zone joueur

| ID | Nom FR | Rep | SpawnRate | Type | Invest |
|---|---|---:|---:|---|---:|
| `gang_park` | Quartier Général | 0 | 0/s | `gang_park` | 0 |

---

## Zones par réputation requise

### Routes & nature

| ID | Nom FR | Rep | SpawnRate | Elite | Invest |
|---|---|---:|---:|---|---:|
| `route1` | Route 1 | 0 | 0.07/s | acetrainer | 0 |
| `viridian_forest` | Forêt de Jade | 15 | 0.08/s | acetrainer | 3 000 |
| `route22` | Chenal 22 | 50 | 0.07/s | blue | 2 000 |
| `mt_moon` | Mont Sélénite | 200 | 0.04/s | ariana | 5 000 |
| `diglett_cave` | Grotte Taupiqueur | 250 | 0.04/s | hiker | 5 000 |
| `rock_tunnel` | Grotte | 400 | 0.04/s | blackbelt | 8 000 |
| `pokemon_tower` | Tour Pokémon | 550 | 0.03/s | agatha | 15 000 |
| `power_plant` | Centrale | 700 | 0.03/s | ltsurge | 20 000 |
| `seafoam_islands` | Îles Écume | 800 | 0.06/s | lorelei | 22 000 |
| `victory_road` | Route Victoire | 950 | 0.04/s | lance | 35 000 |
| `unknown_cave` | Grotte Inconnue | 1 100 | 0.03/s | red | 60 000 |
| `mt_silver` | Mt. Argenté | 1 200 | 0.03/s | red | 0 |

### Villes

| ID | Nom FR | Rep | SpawnRate | Gym Leader | XP Bonus | Unlock item | Invest |
|---|---|---:|---:|---|---:|---|---:|
| `pallet_garden` | Jardin de Pallet | 30 | 0.07/s | - | - | `map_pallet` | 0 |
| `pewter_gym` | Argenta | 150 | 0.06/s | brock | x1.5 | - | 3 000 |
| `cerulean_gym` | Azuria | 300 | 0.06/s | misty | x1.5 | - | 5 000 |
| `celadon_gym` | Céladopole | 450 | 0.06/s | erika | x1.8 | - | 8 000 |
| `lavender_town` | Lavanville | 480 | 0.05/s | - | - | - | 12 000 |
| `fuchsia_gym` | Parmanie | 650 | 0.06/s | koga | x2.0 | - | 12 000 |
| `saffron_gym` | Safrania | 800 | 0.06/s | sabrina | x2.2 | - | 20 000 |
| `cinnabar_gym` | Cramois'île | 850 | 0.06/s | blaine | x2.5 | - | 25 000 |
| `indigo_plateau` | Plateau Indigo | 1 000 | 0.06/s | blue | x3.0 | - | 50 000 |

Les zones `city` avec `gymLeader` suivent l'ordre de `GYM_ORDER` : une ville d'arène non visitée demande que l'arène précédente soit vaincue.

### Lieux spéciaux

| ID | Nom FR | Rep | SpawnRate | Unlock item | Rare pool | Invest |
|---|---|---:|---:|---|---|---:|
| `ss_anne` | Bateau St. Anne | 350 | 0.06/s | `boat_ticket` | non | 8 000 |
| `safari_zone` | Parc Safari | 500 | 0.07/s | - | oui | 12 000 |
| `celadon_casino` | Casino de Céladopole | 600 | 0.07/s | `casino_ticket` | non | 15 000 |
| `pokemon_mansion` | Manoir Pokémon | 870 | 0.04/s | - | oui | 25 000 |
| `silph_co` | Sylphe SARL | 900 | 0.07/s | `silph_keycard` | non | 30 000 |
| `tourbillon` | Îles Tourbillon | 900 | 0.04/s | `tourbillon_permit` | non | 45 000 |
| `tour_carillon` | Tour Carillon | 950 | 0.04/s | `carillon_permit` | non | 45 000 |

---

## Backgrounds (`ZONE_BGS`)

| Image Showdown | Zones |
|---|---|
| `meadow.png` | `route1`, `route22`, `pallet_garden`, `safari_zone` |
| `forest.png` | `viridian_forest`, `celadon_gym` |
| `mountain.png` | `mt_moon`, `diglett_cave`, `rock_tunnel`, `victory_road`, `unknown_cave`, `mt_silver`, `pewter_gym`, `indigo_plateau` |
| `city.png` | `power_plant`, `silph_co`, `pokemon_tower`, `lavender_town`, `pokemon_mansion`, `tour_carillon`, `saffron_gym`, `celadon_casino` |
| `deepsea.png` | `seafoam_islands`, `tourbillon` |
| `beach.png` | `ss_anne`, `cerulean_gym` |
| `river.png` | `fuchsia_gym` |
| `desert.png` | `cinnabar_gym` |

Images Showdown : `https://play.pokemonshowdown.com/fx/bg-{name}.png`

Important : Showdown ne fournit pas d'en-têtes CORS. Ne pas ajouter `crossorigin="anonymous"` sur ces images.

---

## Champs d'une zone (`ZONES`)

```js
{
  id:           'zone_id',       // clé unique snake_case
  fr:           'Nom FR',        // libellé FR
  en:           'Name EN',       // libellé EN
  rep:          0,               // réputation requise
  spawnRate:    0.07,            // spawns/seconde
  type:         'route',         // 'gang_park' | 'route' | 'city' | 'special'
  pool:         ['bulbasaur'],   // espèces capturables
  rarePool:     [{ en:'mew', w:1 }], // tirage rare pondéré, optionnel
  trainers:     ['acetrainer'],  // types de dresseurs
  eliteTrainer: 'lance',         // dresseur élite, optionnel
  gymLeader:    'brock',         // leader arène, optionnel
  gymType:      'rock',          // type d'arène, optionnel
  xpBonus:      1.5,             // multiplicateur XP, optionnel
  investCost:   20000,           // coût investissement
  unlockItem:   'item_id',       // achat/item requis, optionnel
  ghostZone:    true,            // règle thématique spéciale, optionnel
  desc_fr:      'Description',   // description UI, optionnel
  desc_en:      'Description',   // description UI, optionnel
}
```

La musique n'est pas un champ de zone : elle est mappée dans `ZONE_MUSIC_MAP`.

---

## Mastery

`getZoneMastery(zoneId)` lit `state.zones[zoneId].combatsWon`.

| Niveau | Condition | Effets principaux |
|---|---|---|
| 0 | Zone non initialisée | Zone absente de `state.zones` |
| 1 | 0 à 9 combats gagnés | Base, événements possibles si les conditions de réputation sont remplies |
| 2 | 10 à 49 combats gagnés | Elite trainer disponible, +4 niveaux ennemis, stats x1.15, +6% raid |
| 3 | 50+ combats gagnés | +10 niveaux ennemis, stats x1.35, potentiel ennemi +1, +15% raid, 12% de raid triple |

Les raids d'arène demandent aussi 10 combats gagnés dans la zone. En auto, l'arène doit déjà avoir été vaincue une fois manuellement.

---

## Slots agents

`initZone(zoneId)` initialise `state.zones[zoneId].slots` à `1`.

Les slots agents se débloquent ensuite par achat :

```js
const ZONE_SLOT_COSTS = [2000, 6000, 15000, 50000, 150000];
```

`getZoneSlotCost(zoneId, slotIndex)` applique un multiplicateur selon la réputation requise de la zone. La limite actuelle est donc 6 slots par zone : 1 slot de base + 5 achats.

---

## Règles de déblocage

Une zone jamais visitée demande :

1. `state.gang.reputation >= zone.rep`
2. `state.purchases[zone.unlockItem]` si `unlockItem` existe
3. pour une `city` dans `GYM_ORDER`, l'arène précédente vaincue

Une zone déjà accédée reste visible même si la réputation baisse, mais passe en mode dégradé si la réputation courante est sous `zone.rep`.

Mode dégradé : uniquement des combats contre dresseurs, pas de Pokémon, coffres, raids ou événements.

---

## Règles de spawn (`spawnInZone`)

Ordre de priorité :

1. **Mode dégradé** : dresseur uniquement, puis fin.
2. **Coffre** : `r < chestChance`, avec 5% de base ou 25% pendant `chestBoost`.
3. **Événement spécial** : zone `idle`, mastery >= 1, réputation suffisante, `r < chestChance + 0.08`.
4. **Elite trainer** : pas d'événement actif, mastery >= 2, `zone.eliteTrainer`, `r < chestChance + 0.13`.
5. **Raid** : pas d'événement actif, au moins 2 agents dans la zone ou 1 agent + boss, `r < 0.40 + raidChanceBonus`.
6. **Dresseur normal** : `r < 0.30`.
7. **Dresseur city extra** : pour `type: 'city'`, `r < 0.55`.
8. **Pokémon** : pool principal, `rarePool` si présent, bonus `rarescope`, puis tirage légendaire pondéré.

`rarePool` a 10% de chance de base, 30% si `rarescope` est actif. Le `rarescope` peut aussi forcer un choix parmi les espèces `rare` ou `very_rare` du pool principal.

---

## États runtime d'une zone

| État | Condition | Comportement |
|---|---|---|
| Open | `openZones.has(zoneId)` | Fenêtre visible, spawns visuels, interactions directes |
| Active background | zone fermée + au moins 1 agent assigné | Simulation silencieuse au `spawnRate` de la zone |
| Inactive | zone fermée + aucun agent | Aucun timer de zone |
| Event | `zoneActivity[zoneId].mode === 'event'` | Bloque temporairement elite trainer et raids dans cette zone |
| Degraded | réputation actuelle sous `zone.rep` | Combat uniquement |

`syncActiveZones()` recalcule les timers quand une zone est ouverte/fermée ou quand un agent est assigné/désassigné.
