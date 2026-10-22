# PokéGang v0.6.1 — Eggs, Legends & a Living Hideout

**itch.io devlog type:** Minor Update

Since v0.5.2, PokéGang has grown in three directions: the **legendary quests** now play like real fights, **eggs** finally have a proper life inside your base, and the **Vivarium** (your hideout's living scene) has become something you can actually watch, click and explore.

## 🐣 Eggs, Agents and the Daycare

- Eggs are now **bound to your Agents**: an Agent keeps incubating while you do other things, and finished eggs gather in a **"to hatch" pile** instead of popping open the moment they are ready.
- Hatching goes through **one shared queue**, so opening a pile no longer stacks a dozen animations on top of each other. The shiny reveal now happens *after* the sprite appears.
- The base shows hatching eggs side by side in straw nests, with an Agent standing by each nest.
- **Daycare:** couples are now fixed pairs, and eggs are dropped at your base. Nurse Joy is the one who opens the Daycare, and she asks for a lot less than before (**100,000₽**). Players who already paid the old price got the difference refunded once.
- Owned incubators are refunded at the price actually paid.

## 🏆 Legendary quests, all five regions

The Sinnoh and Deoxys quests now use the same **real turn-based combat** as Kanto, Johto and Hoenn. Along the way we reworked the rewards:

- a quest legendary is **guaranteed to be caught after the victory**; weakening it raises its potential (★3 minimum, ★5 maximum) instead of lowering a catch chance;
- quest shinies appear at a flat **2%**;
- quest items (wings, meteors, feathers, crystals, shards…) now **actually drop** from combats in their zones, with a pity system so nobody is stuck on bad luck;
- a few thresholds were softened (Meteor drop rate, wings needed for the Whirl Permit and Chime).

Shiny bonuses were also fixed: zone bonuses scale properly across regions, and the Shiny Charm applies to the total.

## ⚔️ Combat

- Raid trainers are now **visible on the battlefield**.
- A new **combat speed** button cycles ×1 / ×5 / ×100.
- A result banner closes each fight, and the hit effect no longer replays the sprite's entrance.
- Fights with several Pokémon on one side now switch smoothly.
- Hoenn story unlocks and fight visibility were repaired.
- Clicking a trainer, raid or event NPC whose fight cannot start no longer leaves it stuck as "challenged" and unclickable: it is released with a message.

## 🌿 The Vivarium

The hideout's scene got the biggest overhaul of this release:

- **New sprite style: Pokémon Mystery Dungeon.** Switch between the classic 2D sprites and animated PMD sprites with a persistent toggle, and pick the sprite set you like.
- **True size mode**: Pokémon are displayed at relative sizes, so Rayquaza really towers over everyone else.
- A **static HQ scene** and occupants placed near the activities they are actually doing in your base.
- **Interactive visitors**: Agents and characters drop by, speak with bubbles anchored to them, and give you time to read.
- **Ho-Oh cameo**: catch it passing by and click it to make it drop **Rainbow Wings**. It is quick, and it flies faster each time it drops a wing, so farming them is a matter of timing, not of holding a key.
- An on-demand **guided tour** of the scene.

> **Note for itch.io players:** the PMD sprite sheets are too numerous to fit in an itch.io HTML5 upload, so on itch they are streamed from the PokéGang website the first time they are needed. If you are offline, the Vivarium falls back to the other sprite styles. PMD sprites come from the community *SpriteCollab* project (CC BY-NC 4.0); credits are listed in the Vivarium.

## 🚪 A smoother first minute

The opening got another polish pass: a **unified first paint**, a short **welcome briefing**, and a **starter choice** that happens in the world rather than in a menu. The first zone's English name is now **"Hidden Field"**.

## ⚙️ Under the hood

- Saving is **deferred by 1.5 seconds** instead of freezing the game for a few dozen milliseconds on each save.
- Offline catch-up is processed in batches, and the "while you were away" report is simpler.
- Importing a save no longer wipes your regional gym progress.
- Fixes in raids, the Market, agent names with special characters, sprite fallbacks and a few silent errors.
- The Pokédex, Agents and base screens got a round of audit fixes.
- Music: the soundtrack is trimmed to the 24 tracks the game actually uses.

## 🔄 Your save is safe

You **do not need to restart**. Your existing save is migrated automatically (save schema 21). Cloud saves keep working as before.

Thank you for all the feedback on the previous versions. If an egg gets stuck, a quest item doesn't drop or a Vivarium animation looks wrong, tell me — it helps a lot.

Have fun! 💜

— MutenRock

---

# 🇫🇷 PokéGang v0.6.1 — Œufs, légendaires et repaire vivant

Depuis la v0.5.2, PokéGang a grandi dans trois directions : les **quêtes légendaires** se jouent désormais comme de vrais combats, les **œufs** ont enfin une vraie vie dans la base, et le **Vivarium** (la scène vivante de votre repaire) est devenu quelque chose qu'on peut regarder, cliquer et explorer.

## 🐣 Œufs, Agents et Pension

- Les œufs sont maintenant **rattachés à vos Agents** : un Agent continue de couver pendant que vous faites autre chose, et les œufs terminés s'accumulent dans une **pile « à éclore »** au lieu de s'ouvrir dès qu'ils sont prêts.
- Les éclosions passent par **une file partagée** : ouvrir une pile n'empile plus une douzaine d'animations. Le shiny est révélé *après* l'apparition du sprite.
- La base affiche les œufs en cours d'éclosion côte à côte dans des nids de paille, avec un Agent à côté de chaque nid.
- **Pension :** les couples sont maintenant fixes et les œufs sont déposés à la base. C'est l'infirmière Joëlle qui ouvre la Pension, pour un prix bien plus bas (**100 000₽**). Les joueurs ayant payé l'ancien prix ont été remboursés de la différence, une seule fois.
- Les incubateurs possédés sont remboursés au prix réellement payé.

## 🏆 Quêtes légendaires : les cinq régions

Les quêtes de Sinnoh et de Deoxys utilisent maintenant le **vrai combat au tour par tour**, comme Kanto, Johto et Hoenn. Les récompenses ont été retravaillées au passage :

- un légendaire de quête est **capturé à coup sûr après la victoire** ; l'affaiblir relève son potentiel (★3 minimum, ★5 maximum) au lieu de baisser une chance de capture ;
- le shiny de quête est fixé à **2 %** ;
- les objets de quête (ailes, météores, plumes, cristaux, fragments…) **tombent enfin vraiment** des combats dans leurs zones, avec un système de pitié pour que personne ne reste bloqué par la malchance ;
- quelques seuils ont été assouplis (taux du Météore, ailes nécessaires pour le Permis Tourbillon et le Carillon).

Les bonus shiny ont aussi été corrigés : les bonus de zone suivent l'échelle des régions et le Charme Chroma s'applique sur le total.

## ⚔️ Combat

- Les dresseurs de raid sont maintenant **visibles sur le terrain**.
- Un nouveau bouton de **vitesse de combat** alterne ×1 / ×5 / ×100.
- Une bannière de résultat conclut chaque combat, et l'effet de coup ne rejoue plus l'entrée du sprite.
- Les combats avec plusieurs Pokémon d'un même côté enchaînent proprement les changements.
- Les déblocages de l'histoire de Hoenn et la visibilité des combats ont été réparés.
- Cliquer sur un dresseur, un raid ou un PNJ d'événement dont le combat ne peut pas démarrer ne le laisse plus bloqué en « défié » et inclicable : il est libéré, avec un message.

## 🌿 Le Vivarium

La scène du repaire reçoit la plus grosse refonte de cette version :

- **Nouveau style de sprites : Pokémon Mystery Dungeon.** Basculez entre les sprites 2D classiques et les sprites PMD animés grâce à une option persistante, et choisissez le jeu de sprites que vous préférez.
- **Mode taille réelle** : les Pokémon sont affichés à des tailles relatives, et Rayquaza domine vraiment tout le monde.
- Une **scène de QG statique**, avec des occupants placés près des activités qu'ils font vraiment dans votre base.
- **Visiteurs interactifs** : Agents et personnages passent vous voir, parlent dans des bulles accrochées à eux et vous laissent le temps de lire.
- **Caméo de Ho-Oh** : attrapez-le au passage et cliquez dessus pour lui faire lâcher des **Plumes Arc-en-ciel**. Il est rapide, et il vole de plus en plus vite à chaque plume lâchée : en récolter beaucoup est une affaire de timing, pas de clic maintenu.
- Une **visite guidée** de la scène, à la demande.

> **À noter pour les joueurs itch.io :** les feuilles de sprites PMD sont trop nombreuses pour tenir dans une archive HTML5 itch.io ; sur itch, elles sont donc chargées depuis le site de PokéGang la première fois qu'elles sont nécessaires. Hors ligne, le Vivarium retombe sur les autres styles de sprites. Les sprites PMD viennent du projet communautaire *SpriteCollab* (CC BY-NC 4.0) ; les crédits sont affichés dans le Vivarium.

## 🚪 Une première minute plus fluide

L'ouverture a reçu une nouvelle passe de finition : un **premier affichage unifié**, un court **briefing d'accueil**, et un **choix du starter** qui se fait dans le monde plutôt que dans un menu. La première zone s'appelle maintenant **« Hidden Field »** en anglais.

## ⚙️ Sous le capot

- La sauvegarde est **différée de 1,5 seconde** au lieu de figer le jeu quelques dizaines de millisecondes à chaque sauvegarde.
- Le rattrapage hors ligne est traité par lots et le rapport « pendant votre absence » est simplifié.
- Importer une sauvegarde n'efface plus la progression des arènes régionales.
- Corrections sur les raids, le Marché, les noms d'Agents contenant des caractères spéciaux, les sprites de secours et quelques erreurs silencieuses.
- Une série de corrections issues d'un audit sur le Pokédex, les Agents et l'écran de base.
- Musique : la bande-son est réduite aux 24 pistes réellement utilisées.

## 🔄 Votre sauvegarde est en sécurité

**Pas besoin de recommencer.** Votre sauvegarde est migrée automatiquement (schéma 21). Les sauvegardes cloud continuent de fonctionner comme avant.

Merci pour tous les retours sur les versions précédentes. Si un œuf reste bloqué, qu'un objet de quête ne tombe pas ou qu'une animation du Vivarium vous semble étrange, dites-le-moi : ça aide énormément.

Bon jeu ! 💜

— MutenRock
