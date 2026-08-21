# PokéGang v0.5.0 — A Real Beginning

**itch.io devlog type:** Major Update

This is one of the biggest PokéGang updates so far.

The previous version gave players a lot of systems very quickly, but not much of a real beginning. For v0.5.0, the entire first session has been rebuilt around one idea: **play first, understand the systems by using them, and reveal the rest gradually.**

## 🎬 A completely new introduction

A new game now starts directly in an **unknown field**, with most of the interface hidden.

No configuration wall. No dozen tabs to understand before doing anything.

Your first Pokémon is placed right in front of you and highlighted so the first interaction is obvious. After that, you are free to catch a few Pokémon and start forming your first team.

Then Team Rocket arrives.

The grunts walk into the field, dialogue appears directly above the characters, and the scene progresses at your pace with a typewriter effect instead of auto-skipping text.

Giovanni eventually appears in person, claims the territory, and turns the opening into the actual origin story of your gang.

## ⚔️ The Rocket ambush

Before the confrontation, a dedicated popup explains what is about to happen and shows the Boss team that was assembled from your first captures.

You can choose which Pokémon leads the team before continuing.

The ambush is a scripted story beat rather than an early-game difficulty wall. It exists to introduce the conflict and lead naturally into the creation of your gang.

## 🕵️ Your first Agent is part of the story

One of the Rocket members involved in the ambush defects.

You choose which one.

That character becomes your **first Agent**, joins for free, and immediately teaches the core idle loop through real actions:

- give the Agent a Pokémon;
- assign them to a zone;
- enable their combat behaviour;
- let them work while you focus on other things.

The guide does not disappear when the onboarding ends. They remain visible as your **advisor**, reacting to your current progression and pointing out useful next steps.

## 🗺️ Progression is revealed gradually

The interface no longer unlocks all at once after the intro.

Tabs now appear when they become useful, with dedicated unlock cards explaining what each new system is for.

The zone map follows the same philosophy. Reputation-based zones are revealed as you approach their requirements instead of showing nearly the entire region as a wall of locked locations from minute one.

Special locations requiring an item or event now appear in their own **To unlock** section.

## 📖 A real Pokédex unlock

The Pokédex is no longer just another tab available immediately.

After progressing through your first zone battles, a small rival encounter introduces its unlock as part of the world.

When opened, already-known Pokémon appear through a cascading reveal animation. Complete evolution families then receive their own visual highlight.

Pokédex tiles can also be resized, and a large performance pass makes big completed collections significantly smoother.

## ✨ Better capture feedback

Captures received a visual overhaul:

- the Pokémon is visibly pulled into the Poké Ball;
- the ball reacts to the point of impact;
- it falls before wobbling;
- successful captures display animated potential stars;
- shiny / critical outcomes have clearer visual feedback.

The underlying capture rules are unchanged. The goal is simply to make each capture feel much more tangible.

## 🎮 Faster first launch on itch.io

On itch.io, if no save exists, PokéGang now automatically starts a first game after a short delay.

Interacting with the save screen cancels this behaviour, so returning or advanced players still keep control. But a brand-new player can now go from the itch page to their first capture almost immediately.

## 🔄 Existing saves remain supported

You **do not need to restart**.

Older saves remain compatible. Players who already progressed past the old introduction can also be offered an optional flashback of the new Rocket / Giovanni scene without resetting their gang or reopening old progression gates.

## 🔧 Other improvements

This release also includes a large amount of polish under the hood and around the rest of the game:

- many onboarding softlocks and edge cases fixed;
- English localization polished again;
- Agents now start with safer behaviour defaults;
- special/non-work zones are excluded from Agent assignment;
- the second Agent is much more realistically priced;
- the advisor can warn when an Agent is repeatedly losing fights;
- the Market and consumables receive clearer introductions;
- several Pokédex rendering/performance problems were removed;
- Johto zones can no longer appear as Agent destinations before the region is actually unlocked;
- telemetry and error tracking were rebuilt so future balancing can rely on real player behaviour rather than guesswork.

The main goal of v0.5.0 is simple:

**PokéGang should feel like a game from the first click — not like a dashboard you have to understand before you can start playing.**

Feedback is extremely useful, especially on the new first-session flow. If something feels confusing, too slow, too fast or simply broken, feel free to send it my way.

Have fun building your gang. 💜

— MutenRock

---

# 🇫🇷 PokéGang v0.5.0 — Une vraie introduction

Cette mise à jour refond entièrement la première session de PokéGang.

Une nouvelle partie commence désormais directement dans une **zone inconnue**, avec une interface volontairement très réduite. Le premier Pokémon est mis en évidence, puis le joueur peut effectuer ses premières captures avant de voir la Team Rocket entrer en scène.

Les sbires et Giovanni apparaissent directement sur le terrain, les dialogues sont affichés en bulles avec effet machine à écrire, et la scène avance au rythme du joueur.

L'un des membres de la Team Rocket finit ensuite par faire défection : le joueur choisit lequel, et ce personnage devient son **premier Agent gratuit**. Il sert de guide pour apprendre concrètement à équiper un Agent, l'affecter à une zone et activer son comportement de combat. Après le tunnel d'introduction, il reste présent comme conseiller contextuel.

Les onglets et les zones sont maintenant révélés progressivement au lieu d'apparaître tous ensemble. Le Pokédex possède également sa propre scène de déblocage et une nouvelle animation de révélation des espèces déjà rencontrées.

Les captures ont reçu une grosse passe visuelle : aspiration du Pokémon dans la Ball, impact, chute, wobble et étoiles de potentiel.

Sur itch.io, une première partie démarre automatiquement après quelques secondes lorsqu'aucune sauvegarde n'existe, afin de faire arriver un nouveau joueur au gameplay le plus vite possible.

**Les anciennes sauvegardes restent compatibles** et peuvent revoir la nouvelle scène d'ouverture via un flashback optionnel sans perdre leur progression.

La mise à jour inclut aussi de nombreux correctifs d'onboarding, de traduction, d'Agents, de zones et de performances Pokédex, ainsi qu'une télémétrie plus propre pour mieux comprendre ce qui fonctionne réellement chez les joueurs.

L'objectif de cette version est simple : **que PokéGang ressemble à un jeu dès le premier clic, et non à une interface qu'il faut apprendre avant de pouvoir jouer.**

Merci à toutes les personnes qui testent le jeu et envoient leurs retours. 💜
