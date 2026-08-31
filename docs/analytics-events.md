# Schéma des événements analytics (GA4)

Référence de ce que le jeu envoie, et de ce que chaque champ signifie.

`gtag.js` est chargé en `<script>` classique dans `index.html` — l'ID de mesure
est public, donc le même snippet part sur le site **et** sur la build itch, sans
dépendance à `config.js`. [modules/systems/analytics.js](../modules/systems/analytics.js)
décide seulement **quand** appeler `gtag()`.

---

## 1. Paramètres envoyés sur *chaque* événement

| Paramètre | Valeurs | À quoi il sert |
|---|---|---|
| `platform` | `web` \| `itch` \| `dev` | Axe historique de distribution. |
| `runtime_context` | `itch` \| `public_site` \| `lab` \| `localhost` \| `other_dev` | Axe produit à faible cardinalité. Sépare notamment les previews IA/lab des tests locaux sans envoyer le hostname brut. |
| `game_version` | ex. `v0.5 — open beta` | Compare les versions entre elles. |
| `internal_tester` | booléen | **Nos** parties, à exclure des analyses joueurs. Voir §2. |
| `game_instance_id` | ex. `g-mt2y4u1s-lslriuty` | Identifie UNE partie. Voir §3. |
| `slot` | `0` \| `1` \| `2` | Slot de sauvegarde actif. |

`runtime_context` est volontairement plus précis que `platform` :

- `itch` → runtime itch (`*.itch.io`, `itch.zone`, `*.hwcdn.st`) ;
- `public_site` → `pokegang.sterenna.fr` ;
- `lab` → `lab.sterenna.fr` ;
- `localhost` → localhost / loopback ;
- `other_dev` → tout autre host de développement.

> Ne jamais remplacer `runtime_context` par le hostname brut dans GA4 : la
> classification ci-dessus suffit à l'étude produit et évite de créer une
> dimension inutilement cardinale.

> Ne jamais réutiliser un de ces noms comme paramètre d'événement : `...params`
> est appliqué en dernier et l'écraserait **silencieusement**. C'est arrivé avec
> le slot d'équipe de `team_member_set`, renommé `team_slot` pour cette raison.

---

## 2. `internal_tester` — exclure nos propres parties

`platform` / `runtime_context` écartent les environnements de dev, mais **pas**
nos tests joués sur la vraie build web ou itch : ils se confondent avec ceux des
joueurs. Ce marqueur volontaire les distingue, et lève les ambiguïtés du type
« cette ville, c'est probablement nous ».

**Activer** — au choix :

```
https://pokegang.sterenna.fr/?internalTester=1
```

```js
pgSetInternalTester(true);   // console, effet immédiat
```

**Désactiver** : `?internalTester=0`, ou `pgSetInternalTester(false)`.

Le marqueur vit dans `localStorage['pg.internalTester']` : il est **par
navigateur et par appareil**, à reposer sur chaque machine de test. Il survit au
rechargement, pas à un vidage du stockage. Si le stockage est indisponible
(navigation privée, itch en mode restreint), il retombe silencieusement à
`false` — mieux vaut un test compté comme joueur qu'un plantage au boot.

Côté GA4 : filtrer sur `internal_tester = true` pour exclure, ou créer un
segment dédié.

---

## 3. `game_instance_id` — reconnaître une partie

Le `slot` ne suffit pas : il est réutilisé d'une partie à l'autre. Cet
identifiant est propre à **une** partie, stocké dans la save
(`state.gameInstanceId`), donc stable à travers les rechargements.

- **Pseudonyme par construction** : horodatage + tirage aléatoire. Aucune donnée
  personnelle, jamais dérivé d'un email ou d'un nom.
- **Créé à la volée** s'il manque : une save antérieure à ce champ en obtient un
  dès son premier chargement plutôt que de rester non identifiable.
- Complète le client ID GA, qui saute au changement de navigateur ou au vidage
  du cache.

`game_instance_id` n'est volontairement pas enregistré comme custom dimension
GA4/Supabase : il est trop cardinal pour les agrégats quotidiens. Il reste
présent dans les événements envoyés pour un futur besoin raw/BigQuery.

> **Si l'on branche un jour GA4 User-ID** pour les comptes Supabase : n'y
> envoyer que l'UUID Supabase, jamais un email, un nom de gang ou toute autre
> donnée personnelle — c'est une règle GA4, pas seulement une préférence.

---

## 4. Événements

### Cycle de vie

| Événement | Paramètres | Sens |
|---|---|---|
| `game_loaded` | `save_state` | Le boot applicatif a chargé l'état. |
| `play_started` | `save_state` | Le runtime a atteint `window.load` et une surface jouable complète. |

`play_started` est le jalon à utiliser pour le funnel **page itch → vrai
lancement du jeu**. Une simple visite de `sterenna.itch.io` ne déclenche pas cet
événement dans le runtime PokéGang.

### Captures et économie

| Événement | Paramètres |
|---|---|
| `pokemon_captured` | `species`, `shiny`, `zone`, **`capture_source`** |
| `first_capture` | `species`, `capture_source` |
| `pokemon_sold` | `count`, `total_price` |

**`capture_source`** dit *qui* a capturé. Sans lui, 500 captures peuvent aussi
bien signifier beaucoup de jeu actif que de l'automatisation qui tourne seule.

| Valeur | Origine |
|---|---|
| `manual` | Le joueur clique un spawn |
| `onboarding` | Idem, sur le terrain de départ (`spawnCtx.onboarding`) |
| `agent` | Un agent capture un spawn **visible** |
| `background` | Résolution silencieuse d'une zone fermée |
| `quest` | Missions et légendaires |
| `chest` | Coffre |
| `event` | Événement de zone |
| `hatch` | Éclosion (pension) |
| `starter` | Starter de l'intro |
| `cheat` | Codes secrets |
| `unknown` | **Chemin non annoté** — à corriger côté émetteur, pas ici |

L'émission est **centralisée dans `tryCapture()`**
([zoneSystem.js](../modules/systems/zoneSystem.js)) : les appelants décrivent
leur contexte via `spawnCtx.captureSource` / `spawnCtx.capturedByAgentId` plutôt
que de réémettre. `agentCaptureVisibleSpawn` le faisait, et **chaque capture
d'agent partait donc en double** — ce qui faussait l'analytics, mais aussi la
progression des missions et le compteur de déblocage d'onglets.

### Combat

| Événement | Paramètres |
|---|---|
| `battle_started` | `zone`, `trainer`, `mode` |
| `battle_won` | `zone`, `trainer`, `elite`, `mode`, `initiated_by` |
| `battle_lost` | `zone`, `trainer`, `mode`, `initiated_by` |

`mode` / `initiated_by` séparent le combat joué du combat automatisé.

### Agents

| Événement | Paramètres |
|---|---|
| `agent_recruited` | `source`, `cost`, `total_agents` |
| `team_member_set` | `team`, `has_agent`, `team_slot`, `source` |
| `agent_assigned` | `zone`, `previous_zone`, `unassigned`, `source` |
| `agent_flag_changed` | `flag`, `value`, `source` |

Ces trois derniers sont les gestes qui font passer un agent de figurant à
machine à ramener des Pokémon : leur adoption dit si l'automatisation est
comprise, ou si les agents restent inertes après recrutement.

### Navigation

| Événement | Paramètres | Note |
|---|---|---|
| `tab_first_view` | `tab` | **Une fois par onglet et par session**, pas par clic |
| `tab_unlocked` | `tab` | Déblocage effectif |

La déduplication est délibérée : ce qui intéresse est « ce joueur a-t-il jamais
ouvert le Marché », pas ses allers-retours, qui noieraient le signal.

### Onboarding

Le funnel de première session expose maintenant les jalons de présentation **et**
les transitions métier :

| Événement | Paramètres principaux |
|---|---|
| `onboarding_briefing_started` | `onboarding_version` |
| `onboarding_briefing_completed` | `onboarding_version` |
| `onboarding_briefing_skipped` | `onboarding_version` |
| `starter_choice_shown` | `zone` |
| `starter_choice_completed` | `species`, `zone` |
| `first_wild_capture` | `species`, `zone` |
| `free_capture_started` | `zone`, `slot` |
| `ambush_started` | `zone` |
| `ambush_resolved` | `zone`, `won` |
| `identity_started` / `identity_completed` | contexte onboarding commun |
| `guide_recruited` | `source`/sprite selon l'émetteur |
| `guide_team_set` | `source` |
| `guide_zone_assigned` | `zone` |
| `guide_combat_enabled` | `source` |
| `first_battle_won` | `zone`, `trainer` |
| `onboarding_started` | `onboarding_version`, `slot` |
| `onboarding_step_completed` | `step`, `next_step`, `seconds_since_new_game` |
| `onboarding_resumed` | `onboarding_version`, `step`, `seconds_since_new_game` |
| `onboarding_completed` | `onboarding_version`, `seconds_since_new_game` |
| `onboarding_failed` | `onboarding_version`, `step`, `reason` |

Le logigramme du tunnel est dans [onboarding-flow.md](./onboarding-flow.md).

`seconds_since_new_game` rejette désormais les timestamps absents, nuls,
négatifs ou situés dans le futur. Une vieille save contenant `startedAt = 0` ne
peut donc plus produire une durée correspondant à l'époque Unix.

### Erreurs produit

| Événement | Paramètres | Quand |
|---|---|---|
| `save_failed` | `reason`, `fatal` | Quota dépassé, ou écriture impossible |
| `load_failed` | `reason`, `fatal` | Save présente mais illisible |
| `runtime_error` | `reason`, `fatal=false`, `source` | Exception `window.error` ou promesse rejetée non gérée |
| `combat_desync` | `reason`, `fatal`, ... | Watchdog combat lorsqu'il est émis par le pipeline de combat |
| `onboarding_failed` | voir ci-dessus | Tunnel interrompu |

Pour `runtime_error`, seuls un message tronqué et une source technique sont
envoyés : pas de stack, pas de contenu de save, pas d'URL complète.

`fatal: true` = la progression est réellement perdue (pour `save_failed`, le
repli sans historiques a échoué à son tour). Sans ces événements, un joueur qui
disparaît des données est indistinguable d'un joueur qui décroche.

### Segments de jeu

`game_segment_completed` — `segment_index`, `duration_s`, `money_delta`,
`rep_delta`, `captured`, `shinies`, `battles_won`.

> **Ne pas l'utiliser pour compter des sessions.** Il part à chaque passage en
> arrière-plan, pas une fois par session. Il s'appelait `session_completed` et
> se réarmait au retour sur l'onglet : un joueur qui alterne entre fenêtres en
> produisait plusieurs pour une seule session logique, ce qui faussait
> silencieusement tout comptage. Renommé pour dire ce qu'il mesure.
>
> Pour les **sessions**, utiliser `session_start` de GA4, qui applique la
> fenêtre d'inactivité standard.
>
> Les deltas sont cumulatifs **depuis le début de la session**, donc chaque
> segment est un instantané de la progression totale, pas un incrément.
> `segment_index` permet de ne garder que le dernier pour obtenir un point par
> session.

---

## 5. GA4 → Supabase

Le sync Apps Script travaille avec des agrégats quotidiens, pas des événements
raw. Pour rester sous la limite de **9 dimensions** de `runReport`, les rapports
détaillés synchronisent `runtime_context` puis reconstruisent `platform` :

- `itch` → `platform=itch` ;
- `public_site` → `platform=web` ;
- `lab`, `localhost`, `other_dev` → `platform=dev`.

Le `slot` fait partie des dimensions communes des événements synchronisés. Il ne
doit plus retomber massivement à `-1` comme dans les premiers exports.

Certains paramètres très détaillés restent disponibles dans GA4 mais ne sont
pas tous dupliqués dans Supabase lorsque cela ferait dépasser la limite Data API
(ex. `shiny` par capture ou `elite` sur certains rapports). Supabase sert à
l'étude agrégée ; GA4 reste la source complète pour ces dimensions fines.

---

## 6. Vérifier ce qui part réellement

`gtag()` empile dans `window.dataLayer` : on peut donc lire les événements sans
attendre GA4 ni ouvrir le DebugView.

```js
// Les 10 derniers événements, avec leurs paramètres
window.dataLayer.filter(x => x[0] === 'event').slice(-10)
  .map(x => ({ event: x[1], params: x[2] }));
```

Pour un test externe réel, vérifier en particulier :

```js
window.dataLayer.filter(x => x[0] === 'event')
  .map(x => x[1])
  .filter(x => ['game_loaded', 'play_started', 'onboarding_briefing_started'].includes(x));
```

Les previews `lab.sterenna.fr` remontent dans la **vraie** propriété GA4 avec
`platform=dev` et `runtime_context=lab`. C'est voulu : elles restent étudiables,
mais ne doivent jamais être mélangées aux joueurs itch externes.
