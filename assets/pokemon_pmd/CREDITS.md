# Ressources PMD — import suspendu

Audit du 15 octobre 2026. **Aucun PNG de Pokémon Donjon Mystère n'est inclus
dans ce répertoire.** `metadata.js` expose intentionnellement un catalogue vide.
Le vivarium conserve donc les images renvoyées par `pokeSprite()`.

## Sources examinées

- [SpriteCollab](https://github.com/PMDCollab/SpriteCollab/tree/e7868e9a7f6b931d1fb826756a490d4633879d03),
  révision `e7868e9a7f6b931d1fb826756a490d4633879d03`.
- [PokéSurvivor](https://github.com/JPTER78/pokesurvivor/tree/5bbc3b29288d6af4596f21188fb8b54e0e9b739f),
  révision `5bbc3b29288d6af4596f21188fb8b54e0e9b739f` : inspection des chemins,
  `js/data/sprites-meta.js`, `js/core/sprites.js` et `LICENSE`.
  Aucun moteur, fichier de métadonnées ou PNG n'a été copié de ce projet.
- [Politique de soumission et de réutilisation SpriteCollab](https://github.com/PMDCollab/SpriteCollab/blob/e7868e9a7f6b931d1fb826756a490d4633879d03/README.md),
  [licence publiée](https://github.com/PMDCollab/SpriteCollab/blob/e7868e9a7f6b931d1fb826756a490d4633879d03/LICENSE.md)
  et [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/legalcode.en).

## Auteurs relevés pour le prototype

Les crédits ont été lus directement depuis les fichiers publics `credits.txt` ;
les identifiants des contributeurs ont été résolus avec
[`credit_names.txt`](https://github.com/PMDCollab/SpriteCollab/blob/e7868e9a7f6b931d1fb826756a490d4633879d03/credit_names.txt).

| Espèce | Idle / Walk normaux | Crédits de la variante shiny |
| --- | --- | --- |
| Nosferapti #41 | CHUNSOFT, statut de licence `Unspecified` | Tacocoa (`234720295292895232`), `PMDCollab_1` |
| Miaouss #52 | CHUNSOFT, statut de licence `Unspecified` | El_Pangoro_Parse (`200385851069300736`), `PMDCollab_1` |
| Fantominus #92 | CHUNSOFT, statut de licence `Unspecified` | El_Pangoro_Parse puis ShyStarryRain (`576876006636519434`), `PMDCollab_1` |

Crédits normaux :
[#41](https://github.com/PMDCollab/SpriteCollab/blob/e7868e9a7f6b931d1fb826756a490d4633879d03/sprite/0041/credits.txt),
[#52](https://github.com/PMDCollab/SpriteCollab/blob/e7868e9a7f6b931d1fb826756a490d4633879d03/sprite/0052/credits.txt),
[#92](https://github.com/PMDCollab/SpriteCollab/blob/e7868e9a7f6b931d1fb826756a490d4633879d03/sprite/0092/credits.txt).
Crédits shiny : mêmes répertoires suivis de `/0000/0001/credits.txt`.

## Blocage de redistribution

La politique SpriteCollab autorise les contributions soumises avec attribution
et pour un usage non commercial. Elle décrit aussi la conservation de sprites
officiels Chunsoft. Pour les trois espèces ci-dessus, les animations normales
sont précisément créditées à CHUNSOFT avec un statut `Unspecified`.
L'audit n'a trouvé aucune autorisation distincte des ayants droit de ces bases.
Les recolorations shiny ne prouvent pas une autorisation de redistribuer la base.

CC BY-NC ne concède que les droits que le donneur de licence peut accorder
(section 1 et préambule), exclut les marques (2.b.2) et ne garantit pas l'absence
de droits tiers (5.a). La présence des fichiers dans un dépôt public ne résout
donc pas cette incertitude. Cette conclusion est une décision de ne pas importer
en présence de droits non établis, pas une affirmation d'illégalité du projet.

Pokémon et les personnages concernés relèvent également des droits de Nintendo,
Creatures, GAME FREAK et The Pokémon Company ; créditer ces sociétés ne constitue
pas une autorisation. CHUNSOFT : https://www.spike-chunsoft.com/.

## Distribution web, itch.io, dons et publicité

Le dépôt confirme une distribution web et itch.io. Le propriétaire a confirmé
le 15 octobre 2026 : **aucun revenu ni don lié au jeu**. Cette déclaration
répond au point de compatibilité non commerciale de la distribution actuelle ;
elle ne fournit pas l'autorisation manquante sur les bases officielles.
La définition CC BY-NC 1.i porte sur la finalité commerciale et la compensation
financière. En cas de changement futur, dons facultatifs et publicité devront
être examinés dans leur contexte. L'usage par des tiers dans un stream OBS
monétisé n'est pas couvert par la déclaration du propriétaire.

La licence du code PokéSurvivor est distincte de celle des images :
[LICENSE](https://github.com/JPTER78/pokesurvivor/blob/5bbc3b29288d6af4596f21188fb8b54e0e9b739f/LICENSE)
réserve MIT aux versions jusqu'à `b297089` inclus et applique PolyForm
Noncommercial aux versions suivantes. Reprendre un ancien moteur MIT ne
résoudrait pas les droits des PNG. Le renderer PokéGang est une implémentation
originale.

## Pour reprendre l'import

Établir les autorisations nécessaires sur les bases officielles et les
contributions, ainsi que la compatibilité avec la distribution réelle, ou
choisir des ressources dont les droits sont établis pour cet usage. Pour
chaque ressource retenue : conserver la révision, le chemin source, les auteurs,
la licence, ses notices et les modifications ; générer les métadonnées depuis
`AnimData.xml`, les dimensions PNG et les fichiers d'offsets correspondants.
Ne pas déduire l'ancrage de la dernière ligne opaque du sprite, particulièrement
pour les Pokémon volants. Vérifier les formes et variantes individuellement.

Les feuilles géométriques utilisées par les tests sont créées en mémoire pour
ces tests. Elles ne représentent aucun Pokémon et ne sont jamais incluses dans
le catalogue ni dans les assets runtime.
