# PokéGang — Design Alpha : Mécaniques de jeu

> Document de référence issu des sessions de design pré-alpha → alpha.
> Sert de spec avant implémentation. Mettre à jour si décision change.

---

## 1. Architecture de progression — principes fondamentaux

### Zone level ≠ difficulté
- **Zone level** (1–10) → augmente uniquement les **récompenses** (argent, rareté, shiny)
- **Difficulté des dresseurs** → fixe, définie par le **tier de la zone** (tier 1–5)
- Le level n'augmente jamais la résistance ou la fréquence de combats difficiles
- Le joueur est récompensé de travailler une zone, jamais pénalisé

```
Zone level 10 : +50% argent · +25% rare · légère chance shiny
Tier zone     : fixe dans zones-data.js — Route 1 = tier 1, Îles Écume = tier 4
```

### XP — un seul système
- **Zone XP uniquement** — suppression de l'agent XP
- Sources : capture (2–15 pts selon rareté) · combat gagné (3 pts) · coffre (2 pts) · event complété (10 pts)
- L'agent n'a pas de barre de progression propre → sa croissance passe par ses **captures** (voir §3)

---

## 2. Zones — états et contestation

### Les trois états d'une zone
| État | Condition | Comportement |
|---|---|---|
| **Open** | `openZones.has(id)` | Fenêtre visible, spawns visuels, combat interactif |
| **Background** | zone fermée + ≥1 agent | Simulation silencieuse au vrai spawnRate |
| **Inactive** | zone fermée + 0 agent | Rien ne tourne |

### Zone contestée
```
lossStreak++   à chaque défaite agent en background
lossStreak >= 10  →  zone.contested = true

Malus zone contestée :
  - Captures   : -50%
  - Revenus    : -30%
  - Agent continue mais sous-performance

Reclaim :
  5 victoires (joueur ou agent)  →  contested = false · lossStreak = 0
```

**Objectif game design** : forcer le joueur à améliorer son équipe ou à intervenir manuellement. Bloque le farm passif sur une zone trop difficile pour l'agent assigné.

---

## 3. Agents — équipe et énergie

### Taille d'équipe — progression par usage
| Seuil captures | Slots Pokémon débloqués |
|---|---|
| Départ | 1 Pokémon |
| 50 captures | 2 Pokémon |
| 150 captures | 3 Pokémon |

- Progression organique — l'agent "mérite" son équipe par l'usage
- Le **Boss** a toujours **6 slots** — sa distinction principale

### 1 agent = 1 zone (hard cap)
- Un agent ne peut être assigné qu'à une seule zone à la fois
- Recruter un agent = couvrir une zone supplémentaire en background
- Exception envisageable : zones spéciales (légendaires) pourraient nécessiter 2 agents comme condition de déblocage

### Pool d'énergie journalier
```
agent.energy = 10  (reset à minuit)

Pertes :
  Défaite standard      →  -2 énergie
  Zone tier 4–5 + défaite  →  -3 énergie

À 0 énergie :
  agent.resting = true
  restUntil = now + 1h
  Pendant le repos : l'agent ne participe pas aux spawns background
  Retour : energy = 5 (pas full — pénalise l'abus de rush)

Recharge complète : 24h après le dernier combat
```

---

## 4. Combat — le vrai bloquant de progression

### Rôle du Boss
- Participe toujours aux combats de zone ouverte (son équipe s'ajoute)
- Peut **intervenir** sur une zone background : le joueur envoie le Boss manuellement
- Contrainte : le Boss ne peut être sur **une seule zone** à la fois
- UI : badge d'alerte sur la zone si combat détecté → bouton "Intervenir" du Gang Base

### Cascade de défaites
```
Défaites normales     →  lossStreak++, énergie--
Zone contestée        →  malus actifs, agent sous-performe
Agent à 0 énergie    →  repos forcé 1h
Agent 0 énergie + zone contestée  →  RESCUE (voir §5)
```

---

## 5. Rescue Mission — pokémon capturé

### Déclencheur
- Condition **stricte** : `agent.energy === 0` ET `zone.contested === true`
- Probabilité : 1 Pokémon de l'équipe agent est capturé (random, jamais le seul si équipe à 1)

### État
```js
state.zones[zoneId].capturedPokemon = {
  pokemonId,   // id du pokémon retiré de l'équipe agent
  agentId,
  capturedAt,  // timestamp
}
```

### Résolution
| Scénario | Conséquence |
|---|---|
| Joueur gagne le combat spécial dans la zone | Pokémon rendu à l'agent, pleine forme |
| Ignoré < 24h | Mission toujours disponible |
| Ignoré ≥ 24h | Pokémon revient seul, flag `weakened: true` (-20% stats) |
| Soin du weakened | Potion **ou** pension 30 min |

### UI
- Badge "⚔ Pokémon capturé" visible sur la carte de zone
- Combat spécial généré : spawn de type "rival" avec difficulté = tier zone

---

## 6. Events de zone

### Principes
- Events déclenchés par timer (25–90 min selon niveau de zone)
- Uniquement sur zones avec ≥1 agent assigné
- Résolution : auto par agents **ou** intervention joueur pour meilleur résultat

### Types d'events et effets
| Event | Effet |
|---|---|
| `territory_bonus` | +30% revenus pendant 20 min |
| `bounty_hunt` | Pokémon rare garanti sur prochain spawn |
| `rival_invasion` | ×2 spawn dresseurs rivaux (plus forts, meilleures récompenses) pendant 15 min |
| `trainer_tournament` | Série de 3 dresseurs → gros loot si sweep |
| `legendary_sighting` | Spawn légendaire rare possible (10 min) |

### rival_invasion — détail
```
Actif sur la zone  →  spawn rate dresseurs ×2
Ces dresseurs = "rivaux" (Gary, Silver, etc.) → stats supérieures
Victoire → récompenses x1.5
Défaite  →  lossStreak +2 (risque accru de contestation)
```

L'event est donc **risque/récompense** : profitable si l'équipe est forte, dangereux sinon.

---

## 7. Ordre d'implémentation recommandé

| Priorité | Mécanique | Fichiers principaux |
|---|---|---|
| 1 | Zone contestée (lossStreak + malus + reclaim) | `agent.js`, `zoneSystem.js`, `zoneSelector.js` |
| 2 | Agent énergie + repos forcé | `agent.js`, `defaultState.js`, `migrateSave.js` |
| 3 | Taille équipe agent par captures | `agent.js`, `agentSheet.js` |
| 4 | Boss intervention zone background | `gangBase.js`, `agent.js` |
| 5 | Rescue mission | `agent.js`, `zoneWindows.js`, feed |
| 6 | Events visibles en UI | `zoneSelector.js`, `zoneLevels.js` |

---

## 8. Ce qui reste en dehors du scope alpha

- Pokémon perdu définitivement (trop punitif pour early players)
- Système de soin payant (clinique Pokémon)
- Multi-agent sur zones légendaires (décision non prise)
- Région Johto (branche séparée, décision à prendre)
