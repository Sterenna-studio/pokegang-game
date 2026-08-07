# Overlays PokéGang sur OBS

Deux incrustations sont disponibles, toutes deux alimentées par l'API publique Supabase et identifiées par le même `?token=` :

| Overlay | Page | Contenu |
|---|---|---|
| **Vivarium** | `gang/live.html` | Pokémon qui se baladent, caméos avec bulles de dialogue — fond transparent |
| **Carte du gang** | `gang/card.html` | Nom, boss, titre, réputation, stats, Pokédex, badges, régions — panneau opaque |

Ce guide détaille d'abord le Vivarium ; la Carte du gang est décrite [en fin de page](#carte-du-gang-gangcardhtml).

## Vivarium

Affiche le vivarium (Pokémon de la vitrine/équipe/pension/formation qui se baladent, cameos avec bulles de dialogue) en incrustation sur un stream OBS, via `gang/live.html`.

Prérequis côté backend (à faire une seule fois) : voir [supabase-setup.md § 6](./supabase-setup.md#6-vivarium-live-overlay-obs) — déploiement de l'Edge Function `pokegang-api` et mise à jour du schéma SQL (`vivarium_data`).

## 1. Récupérer ton URL

1. Ouvre le **jeu principal** (pas `/gang/` — cette page ne fait tourner ni la boucle de jeu ni la synchro cloud) et connecte-toi.
2. Onglet **Compte** → section **🔗 Profil public / API** → coche **« Profil public activé »**.
3. Une URL apparaît, du genre `https://pokegang.sterenna.fr/api/gang?token=team-xxxx-a1b2c3` — clique **📋 Copier**, puis remplace juste le chemin :

   ```
   https://pokegang.sterenna.fr/gang/live.html?token=team-xxxx-a1b2c3
   ```

4. Laisse le jeu principal ouvert au moins une minute — c'est le tick de synchro (`vivariumSync`, toutes les ~60s) qui pousse les données ; sans onglet principal ouvert, rien n'est poussé (`/gang/` seul ne suffit pas).

## 2. Tester avant d'ajouter la source OBS

Ouvre l'URL dans un onglet de navigateur classique d'abord. Tu dois voir tes Pokémon se balader sur fond transparent (donc noir/blanc uni selon ton thème navigateur — normal, il n'y a pas de flux vidéo derrière dans un onglet). Si rien n'apparaît après une minute, voir Dépannage plus bas avant de perdre du temps côté OBS.

## 3. Ajouter la source dans OBS

Dans la scène voulue : **Sources → + → Navigateur**. Crée une nouvelle source (nom libre, ex. « Vivarium PokéGang »), puis renseigne :

| Champ | Valeur |
|---|---|
| URL | ton lien `gang/live.html?token=...` de l'étape 1 |
| Largeur | voir tableau des dimensions ci-dessous |
| Hauteur | voir tableau des dimensions ci-dessous |
| FPS personnalisé | pas nécessaire — laisser la valeur par défaut (30). Les déplacements sont animés en CSS (transitions), pas en rendu image par image, donc un FPS élevé n'apporte rien ici |
| Contrôler l'audio via OBS | sans importance, la page n'émet aucun son |
| CSS personnalisé | laisser vide — le fond transparent est déjà géré par la page elle-même |

Deux cases à **décocher** dans les propriétés (sinon la position des résidents et la météo se réinitialisent à chaque fois que tu reviens sur la scène) :

- ☐ *Arrêter la source quand elle n'est pas visible*
- ☐ *Actualiser le navigateur quand la scène devient active*

## Dimensions recommandées

Le vivarium est une bande « au sol » : les résidents se baladent dans la moitié basse de la zone, les cameos traversent tout l'écran horizontalement. Deux presets courants :

- **Bandeau bas d'écran** (le plus courant pour un overlay permanent) : ~1600×400
- **Coin façon webcam** : ~480×360

Un détail à connaître si tu choisis une largeur inhabituelle : la vitesse de traversée des cameos est fixe (~45 px/s), donc plus la source est large, plus une traversée prend de temps (ex. 1600px de large ≈ 35s pour traverser). Rien à corriger, juste un effet à anticiper si tu vises un format très large.

La zone est redimensionnable/déplaçable ensuite comme n'importe quelle source OBS (poignées classiques) — les valeurs ci-dessus ne sont que le point de départ dans le dialogue de création.

## Dépannage

- **Rien ne s'affiche du tout** : vérifie dans l'ordre — profil public bien activé, token bien copié en entier dans l'URL, jeu principal resté ouvert au moins une minute après le toggle, déploiement backend fait (§1-2 de supabase-setup.md).
- **Ça marchait puis plus rien** : le jeu principal a probablement été fermé ou mis en veille — la synchro s'arrête dès que ce tick n'a plus rien à pousser. L'overlay garde le dernier snapshot reçu, il ne se vide pas tout seul, mais il devient figé.
- **Les résidents « sautent » de position toutes les 30-40s** : normal, c'est le rafraîchissement périodique du snapshot (léger, ne touche pas à la météo/ambiance en cours). Rien de cassé.
- **Le fond n'est pas transparent** : vérifie si un fond de zone a été équipé dans `/gang/` (panneau Vitrine, bouton 🎨) — dans ce cas c'est voulu, c'est le fond choisi qui s'affiche aussi côté OBS. Sans fond équipé, la zone doit rester transparente.
- Pour un diagnostic plus fin, l'API peut être interrogée directement (voir supabase-setup.md) pour vérifier si le backend renvoie bien des données avant de blâmer OBS.

---

## Carte du gang (`gang/card.html`)

Panneau d'identité : nom du gang, sprite et nom du boss, titre, réputation, stats clés (captures, chromatiques, victoires, agents), progression Pokédex, badges obtenus et régions débloquées. Pensé pour un écran de pause / « démarrage imminent », mais utilisable en coin d'écran.

### URL

Même token que le Vivarium, seul le nom de page change :

```
https://pokegang.sterenna.fr/gang/card.html?token=team-xxxx-a1b2c3
```

Ajouter `&lang=en` pour afficher les libellés en anglais.

### Source OBS

Mêmes réglages que le Vivarium (**Sources → + → Navigateur**, et décocher *Arrêter la source quand elle n'est pas visible* / *Actualiser le navigateur quand la scène devient active*), avec ces dimensions :

| Champ | Valeur |
|---|---|
| Largeur | **520** (la carte fait 460 px de large, ça laisse une marge) |
| Hauteur | **380** |

La carte est centrée dans la source et le reste de la page est transparent — donc redimensionner la source plus grand ne fait qu'ajouter du vide autour, ça ne déforme rien.

### Différence importante avec le Vivarium

Le fond de la **page** est transparent, mais la **carte** est volontairement opaque (dégradé sombre bordé d'or) : contrairement aux sprites du vivarium, un panneau de texte est illisible posé directement sur une vidéo. Ce n'est pas un bug de transparence.

### Fraîcheur des données

La carte lit la route `/gang` de l'API (et non `/vivarium`), rafraîchie toutes les 35 s côté overlay, elle-même alimentée par le tick de synchro du jeu principal toutes les 60 s. Comme pour le Vivarium, **le jeu principal doit rester ouvert** ; sinon la carte se fige sur le dernier état reçu au lieu de se vider.

C'est de l'**état**, pas de l'événement : une alerte instantanée (« SHINY ! » au moment de la capture) ne peut pas passer par ce mécanisme, il faudrait un canal temps réel (Supabase Realtime).
