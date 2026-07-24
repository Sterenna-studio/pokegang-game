# PokéGang — v0.2 pre-alpha

Jeu idle/management Pokémon en page unique. Tu incarnes le boss d'un gang qui prend le contrôle des zones de Kanto, capture des Pokémon, recrute des agents et monte en réputation pour devenir la force dominante de la région.

Pas de bundler, pas de framework, pas de `package.json` : HTML + CSS + JavaScript vanilla pur.

---

## Lancer le jeu

```bash
py -m http.server 8080
# ou : npx serve . / php -S localhost:8080
```

Ouvre ensuite `http://localhost:8080/` dans Chrome ou Firefox. Toute modification de fichier est visible à la prochaine actualisation.

---

## Mécaniques principales

### Zones

Kanto est découpé en zones de trois types :

| Type | Description |
|---|---|
| `route` | Captures + investissements passifs (Route 1, Forêt de Jade, Mont Sélénite…) |
| `city` | Ville avec arène, gym leader et raids automatiques (Argenta, Azuria, Parmanie…) |
| `special` | Hybride : Casino, Safari, Sylphe SARL, S.S. Anne, Plateau Indigo… |

Les zones se débloquent par seuil de **réputation**. Une zone peut être dans trois états :

| État | Condition | Comportement |
|---|---|---|
| **Ouverte** | Fenêtre active | Spawns visuels, combat interactif, timer |
| **Silencieuse** | Fermée + ≥1 agent assigné | Simulation en arrière-plan au vrai `spawnRate` |
| **Inactive** | Fermée + 0 agent | Rien ne tourne |

Chaque tick de zone silencieuse résout un spawn (Pokémon capturé, dresseur battu ou coffre pillé) via les agents assignés — sans interaction du joueur.

Chaque zone peut être investie pour augmenter son nombre de slots d'agents et d'autres bonus passifs.

---

### Captures

- **5 types de balls** : Poké Ball, Super Ball, Hyper Ball, Sombre Ball, Master Ball — chacune avec une distribution de **potentiel (1–5 ★)** différente.
- **Potentiel** : qualité permanente du Pokémon (1–5 étoiles). Influence sa valeur marchande et sa puissance au combat.
- **Raretés** : `common` · `uncommon` · `rare` · `very_rare` · `legendary` — distribuées par zone et par spawn pool.
- **Shiny** : probabilité de base très faible, boostable par items et Chroma Charm.
- **Boosts temporaires (90 s)** :
  - Leurre / Super Leurre — ×2 ou ×3 spawns
  - Encens Chance — +1 potentiel sur la prochaine capture
  - Rarioscope — ×3 spawns rares
  - Aura Shiny — ×5 chance shiny
- **Modes sprite** : local FireRed/LeafGreen HD, Showdown gen1–5, GIF animé, Home, Pokédex officiel.

---

### Agents

Les agents sont le cœur de l'automatisation. Ils agissent dans les zones ouvertes et tournent en arrière-plan dans les zones fermées.

#### Recrutement

3 candidats aléatoires sont proposés à chaque recrutement (sprite + personnalité). Le joueur choisit celui qu'il veut garder.

Courbe de coût progressive :

| Agent | Coût |
|---|---|
| 1 | 5 000₽ |
| 2 | 50 000₽ |
| 3 | 100 000₽ |
| 4 | 250 000₽ |
| 5 | 500 000₽ |
| 6 | 1 000 000₽ |
| 7 | 2 000 000₽ |
| 8–15 | 3M → 10M (+1M/agent) |
| 16+ | 20M, 30M, 40M… (+10M/agent) |

#### Progression et grades

Les agents gagnent de l'XP à chaque action (capture, combat, coffre). Formule de level-up : `XP nécessaire = level × 30`.

| Grade | Niveau requis | Slots d'équipe |
|---|---|---|
| Grunt | — | 1 |
| Sergent | 25 | 2 |
| Lieutenant | 50 | 3 |
| Commandant | 75 | 4 |
| Élite [gang] *(4 premiers)* | 100 | 5 |
| Général [gang] | 100 | 6 |

La **puissance de combat** d'un agent = `level × 15 + puissance de son équipe Pokémon`.

#### Comportements automatiques

Chaque agent a 3 flags indépendants activables : **Combat · Raid · Capture**. Ball préférée configurable par agent. Notifications de captures activables/désactivables par agent.

---

### Combat

- **Combat interactif** dans les zones ouvertes : le joueur sélectionne un spawn dresseur, le combat se résout tour par tour avec animations HP.
- **Combat automatique agents** : les agents assignés à une zone ouverte interceptent les spawns dresseurs.
- **Raids d'arène** : une fois le gym leader battu manuellement, les agents peuvent lancer des raids automatiques (cooldown 5 min) pour du butin et de la réputation.
- **Raids hostiles** : probabilité de 1%/tick — un gang adverse attaque une zone tenue par tes agents. Victoire = réputation + argent ; défaite = perte d'argent modérée.
- **Salle de formation** : jusqu'à 7 Pokémon peuvent s'entraîner contre des adversaires générés — XP passive et progression.

---

### Gang & compétition

- **Boss** personnalisable : nom, sprite dresseur (200+ dresseurs disponibles), titre composé de 4 parties configurables.
- **Vitrine** : 6 slots pour exposer tes meilleurs Pokémon, gérée depuis la page cosmétique séparée (voir [Page cosmétique séparée](#page-cosmétique-séparée-gang)) — les Pokémon exposés s'y baladent dans une zone d'environnement dédiée aux côtés de l'équipe active du boss.
- **Équipe boss** : 3 loadouts sauvegardables (3 × 6 Pokémon), utilisés en combat de zone et en défense compétitive.
- **Compétition inter-gangs** :
  - Publie une équipe de défense (6 Pokémon + 3 agents + zone)
  - Attaque les défenses des autres joueurs
  - Suivi des victoires/défaites en attaque et en défense

---

### Économie & ressources

| Ressource | Obtention |
|---|---|
| ₽ (argent) | Combats, ventes, coffres, revenus passifs agents |
| Réputation | Défaite de dresseurs, raids, progression de zone |
| Poké Balls | Boutique, coffres |
| Items boost | Boutique (Leurre, Rarioscope, Aura Shiny…) |
| Pierre Évol. | Boutique — déclenche une évolution manuelle |
| Super Bonbon | Boutique — +1 niveau immédiat |
| Œufs | Pension (2 Pokémon compatibles) + incubateur |

---

### Système de progression discovery

Les onglets se débloquent progressivement selon les actions du joueur (premier combat, première capture, première mission…). Ce mode peut être désactivé dans les paramètres.

---

### Automatisations débloquables

| Service | Effet |
|---|---|
| Auto-vente (agents) | Vend automatiquement les captures selon potentiel ou mode "tout" |
| Auto-vente (œufs) | Vend les œufs non désirés |
| Auto-incubateur | Lance automatiquement l'incubation des nouveaux œufs |
| Auto-collecte | Ramasse les gains de zone automatiquement |
| Chroma Charm | Augmente la chance shiny globale |
| Scientifique | Bonus laboratoire (détection de species rares) |
| Traducteur | Descriptions Pokédex en langue étrangère via LLM |

---

## Navigation

| Onglet | Contenu |
|---|---|
| **Zones** | Carte de Kanto (fogmap), fenêtres de jeu actif, spawns en temps réel |
| **PC** | Grille Pokémon (filtres, tri, détails), pension, salle de formation, laboratoire, Pokédex |
| **Agents** | Recrutement, gestion, assignation aux zones, grades |
| **Marché** | Boutique items & balls, vente auto, boosts, incubateur |
| **Gang** | Boss, équipe, compétition, stats, services — le cosmétique (musique/apparence/titre/vitrine) est sur la page séparée `/gang/` |
| **Missions** | Objectifs horaires / journaliers / hebdomadaires |
| **📋 BattleLog** | Journal de combats, captures et événements agents |
| **🏆 Leaderboard** | Classement inter-joueurs (Supabase requis) |
| **☁ Compte** | Auth et cloud save (Supabase optionnel) |

---

## Structure du repo

```
index.html                  Shell HTML, onglets, ancres DOM, chargement des scripts
app.js                      Moteur principal : état, boucle de jeu, rendu, migrations

gang/                       Page cosmétique séparée (pokegang.sterenna.fr/gang/)
  index.html                 Shell HTML dédié, même design tokens que le jeu principal
  gang-app.js                Boot minimal : charge/sauve le même save, sans boucle de jeu
  panels.js                  Panneaux Musique / Apparence / Titre / Vitrine
  environment.js             Zone d'environnement animée (vitrine + équipe boss qui se baladent)
  gang.css                   Styles propres à cette page

css/
  base.css                  Design tokens (custom properties) + reset
  game-ui.css               Styles de tous les composants
  intro.css                 Écran d'introduction/onboarding

data/
  zones-data.js             Définitions des zones (pool de spawns, musique, type)
  species-data.js           POKEMON_GEN1, SPECIES_BY_EN (Kanto + Johto)
  evolutions-data.js        Chaînes d'évolution
  game-config-data.js       Grades, natures, config agents
  economy-data.js           Prix balls, items boutique, œufs
  combat-config-data.js     Dresseurs spéciaux, récompenses combat max
  gameplay-config-data.js   Durées boosts, coûts de reroll
  titles-data.js            Définitions des titres de boss
  assets-data.js            URLs sprites balls, SVG fallback

modules/systems/
  agent.js                  Recrutement, progression, grades, background zones
  zoneCombat.js             Résolution combat (tour par tour, type coverage)
  gangCompetition.js        Attaque/défense inter-gangs
  market.js                 Boutique, vente auto, boosts
  missions.js               Quêtes horaires/journalières/hebdomadaires
  pension.js                Pension (reproduction), incubation d'œufs
  trainingRoom.js           Salle de formation (XP passive Pokémon)
  sessionObjectives.js      Objectifs de session
  offlineCatchup.js         Rattrapage XP/captures pendant l'absence
  cloudAccount.js           Auth Supabase, cloud save, leaderboard
  llm.js                    Intégration Ollama / OpenAI / Anthropic
  sfx.js                    Effets sonores
  zoneSystem.js             Timers de spawn, investissements de zone

modules/ui/
  agentsTab.js              Onglet Agents (cartes, assignation, grades)
  zoneSelector.js           Fogmap Kanto (carte des zones)
  zoneWindows.js            Fenêtres de zone actives
  gangTab.js                Onglet Gang (boss, équipe, services, stats — cosmétique déplacé vers gang/)
  gangBase.js               Boss, vitrine, équipe
  gangCompetitionTab.js     Onglet compétition
  marketTab.js              Onglet Marché
  missionsTab.js            Onglet Missions
  battleLogTab.js           Onglet BattleLog
  pcPokedex.js              Onglet PC + Pokédex intégré
  labTab.js                 Laboratoire (tracking espèces)
  settingsModal.js          Modale paramètres
  modals.js                 Modales info, confirmation, nommage, sprites
  sprites.js                Helpers sprite (pokeIcon, pokeSprite, trainerSprite)
  intro.js                  Onboarding Giovanni
  audio.js                  Jukebox + musiques de zone
  tabRouter.js              Routage des onglets

state/
  defaultState.js           DEFAULT_STATE, APP_VERSION, SAVE_SCHEMA_VERSION
  migrateSave.js            Migrations de schéma
  store.js                  (Refactor en cours — futur store centralisé)

tools/
  zone-editor.html          Outil visuel d'inspection/modification des zones
```

---

## Sauvegarde

Stockage dans `localStorage` sur 3 slots :

```
pokeforge.v6        slot 1 (actif par défaut)
pokeforge.v6.s2     slot 2
pokeforge.v6.s3     slot 3
pokeforge.activeSlot index du slot actif
```

- `SAVE_SCHEMA_VERSION = 12` — une migration se déclenche automatiquement au boot si le schéma est inférieur.
- Même `localStorage['pokeforge.v6']` (et slots 2/3) partagé nativement avec la page cosmétique séparée `gang/` (même origine) — pas de synchro réseau nécessaire, juste un rechargement à froid avant chaque écriture côté `gang/` pour limiter le risque d'écraser une progression faite entre-temps dans l'autre onglet.
- Les Pokémon sont "slimifiés" avant sérialisation (champs dérivés supprimés) pour réduire la taille.
- Cloud save optionnel via Supabase (throttle 1 save/30s, mutex anti-deadlock GoTrue intégré).

---

## Supabase (optionnel)

`index.html` tente de charger `config.js` — le jeu fonctionne sans ce fichier (404 ignoré).

Pour activer compte cloud, cloud save, leaderboard et raids en ligne :

```js
// config.js (ne pas committer)
const SUPABASE_URL     = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

Voir :
- [`docs/supabase-setup.md`](docs/supabase-setup.md)
- [`docs/supabase-schema.sql`](docs/supabase-schema.sql)

---

## Intégration Nitro / Gwen Ha Star

PokéGang peut reconnaître une identité **Nitro** (`nitro.sterenna.fr`), le hub d'auth commun aux applications Sterenna. L'intégration est progressive et ne remet pas en cause le fonctionnement local.

### Principes

- PokéGang **fonctionne seul** sans Nitro (localStorage, 3 slots, export/import JSON).
- Nitro peut servir d'**identité commune** entre PokéGang, Gwen Ha Star et d'autres apps.
- La **liaison de compte** est optionnelle et additive — elle n'écrase pas les saves locales.
- L'intégration cloud se fera **sans casser l'existant**.

### Limitation technique

PokéGang est sur `pokegang.sterenna.fr`, Nitro sur `nitro.sterenna.fr`. Ces deux origines ont des `localStorage` séparés — la session Supabase ne se partage pas automatiquement. Le module Nitro l'indique clairement dans l'UI et propose une redirection vers la connexion Nitro.

### Architecture

```
modules/nitro/
  nitro-supabase.js   — charge le client Supabase Nitro via import() dynamique
  nitro-auth.js       — session, user, redirect login
  nitro-profile.js    — profil (shared module ou token metadata en fallback)
  nitro-bridge.js     — état centralisé, fonctions de liaison de compte
```

### UI

L'onglet **☁ Compte** affiche une section "🌐 IDENTITÉ NITRO" :

- Si le module Nitro est inaccessible : message discret, jeu non affecté.
- Si l'utilisateur n'est pas connecté à Nitro : bouton "Se connecter via Nitro" → redirige vers `nitro.sterenna.fr/login.html?next=...`
- Si une session Nitro est détectée : pseudo, email, lien vers l'espace Star.

### Documentation

Voir [`docs/nitro-integration.md`](docs/nitro-integration.md) pour :
- les tables Supabase à créer (`pokegang_account_links`, `pokegang_cloud_saves`, `pokegang_rewards`)
- les prochaines étapes (SSO token, liaison DB, récompenses cross-app)
- les contraintes de sécurité

---

## LLM (optionnel)

Dialogues de dresseurs générés à la volée. Providers supportés : **Ollama** (local), **OpenAI**, **Anthropic**. Configuration dans l'onglet Paramètres.

---

## Modifications récentes (juillet 2026)

### Page cosmétique séparée (`gang/`)

La partie purement cosmétique du Gang — musique, fonds d'écran/tissus/pins, skins de ball, titre, vitrine — a été extraite vers une page statique indépendante, servie à `pokegang.sterenna.fr/gang/` (dossier [`gang/`](gang/)). Objectif : ne plus faire tourner ces panneaux pendant que la boucle de jeu principale (TickManager/Scheduler) tourne en fond, source de rafraîchissements concurrents. Cette page partage le même `localStorage['pokeforge.v6']` que le jeu principal (même origine, `state/store.js` réutilisé tel quel) mais ne démarre jamais la boucle de jeu.

La vitrine devient une zone d'environnement animée : les Pokémon exposés et l'équipe active du boss s'y baladent (déplacement simple par transitions CSS, pas de moteur d'animation), avec apparition occasionnelle d'un agent ou d'un Pokémon favori du Pokédex. Le fond de cette zone est indépendant du fond de page principal (`state.cosmetics.bossBg`, distinct de `gameBg`, même catalogue d'achat).

L'onglet Gang du jeu principal ne garde que la partie non-cosmétique (stats, services, équipe boss, titre) et pointe vers `/gang/` pour le reste.

### Quêtes légendaires (Johto / Kanto / Hoenn)

- Parité visuelle Hoenn ↔ Johto/Kanto : bouton fermer toujours accessible (position fixe), retour automatique au tracker après un combat (plus besoin de cliquer), z-index unifié.
- Correction d'un bug bloquant découvert pendant les tests : la navigation entre écrans (bouton "Suite"/"Réessayer") pouvait fermer tout le tracker Hoenn sans jamais rouvrir l'écran suivant.
- Une capture de légendaire ratée à Johto ne marque plus la quête comme "terminée".
- Notifications de drop cohérentes (dorées comme les autres objets de quête), doublon de drop de Météore retiré.

### Agents

- Le repos forcé (1h à 0 énergie) devient une "prison", rachetable en pokédollars (`200₽ × niveau de l'agent`) directement depuis la carte agent.
- Arbre hiérarchique (onglet Agents, bouton "🌳 Afficher l'arbre") réorganisé en paliers verticaux par grade au lieu de colonnes qui débordaient horizontalement.

### Combat & zones

- Verrou de combat unifié par zone : l'auto-combat visuel et les combats d'événement ne se marchent plus dessus.
- Suivi `captureCount`/`shinyCount` par espèce complété sur tous les points de capture du jeu (légendaires régionaux, starters, codes secrets — plusieurs n'avaient auparavant aucun suivi Pokédex).
- Sprites réels affichés pour les raids et combats automatiques en zone visible (le log de combat en texte a été retiré des fenêtres de zone).
- Coût de l'œuf mystère : courbe logarithmique au lieu de linéaire (plafond ~1 000 000₽).
- Taux de chroma unifiés sous des constantes partagées (`data/gameplay-config-data.js`) au lieu d'être dispersés en plusieurs nombres magiques.

---

## Notes de développement

### Convention scripts classiques vs ES modules

`index.html` charge les fichiers `data/` en `<script>` classiques (sans `type="module"`). Leurs `const` sont dans le scope lexical global partagé — accessibles par **nom nu** (`ZONES`, `SPECIES_BY_EN`) depuis les modules ES, **pas** via `globalThis.X`.

`app.js` et `modules/` sont des **ES modules**. Ils communiquent via `globalThis` :

```js
// app.js expose ses fonctions aux modules
Object.assign(globalThis, { saveState, notify, state, pokeSprite, ... });

// Les modules enregistrent les leurs
Object.assign(globalThis, { renderAgentsTab, renderGangTab, ... });
```

### Ajouter un champ d'état

1. `DEFAULT_STATE` dans `app.js` **et** `state/defaultState.js`
2. Garde de migration dans `migrate()` de `app.js` **et** `state/migrateSave.js`
3. Incrémenter `SAVE_SCHEMA_VERSION` si le champ est requis pour les saves existantes

### Ajouter une fonction accessible aux modules

```js
// Après définition dans app.js :
Object.assign(globalThis, { maNouvelleFonction });
```

### Pièges courants

- Ne jamais ajouter `crossorigin="anonymous"` sur les images Showdown ou Original Stitch (pas de headers CORS — casse l'affichage).
- Pour le rendu, préférer les mises à jour ciblées (`_refreshZoneTile()`) aux re-renders complets.
- Les `backgroundZoneTimers` tournent au vrai `spawnRate` de la zone — ne pas les confondre avec les timers de l'UI.
