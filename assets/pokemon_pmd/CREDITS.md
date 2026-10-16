# Ressources PMD — vivarium

Audit initial du 15 octobre 2026, étendu le 16 octobre 2026 à la demande du
propriétaire. Après validation du prototype Lab et demande de publication en
production, le propriétaire a demandé le catalogue complet du jeu : **494
entrées (#0 à #493), normales et shiny, Idle et Walk**, soit 1 976 PNG et
21 524 146 octets de PNG, copiés sans recompression depuis la révision ci-dessous.
`coverage.json` recense toutes les espèces couvertes (aucune variante manquante).
`provenance.json` conserve les sources et SHA-256 des PNG, XML, ombres et crédits.
`credits.json` préserve le texte intégral des crédits originaux de chaque variante.
Les XML et ombres nécessaires à la régénération sont dans le cache local ignoré
du générateur ; leurs URL et empreintes sont conservées dans le manifeste.
La licence publiée est dans
`SPRITECOLLAB-LICENSE.md`, les noms des contributeurs dans `credit_names.txt`.
Cette décision du propriétaire ne constitue pas une autorisation supplémentaire
des ayants droit et ne modifie pas les incertitudes relevées dans cet audit.

## Sources examinées

- [SpriteCollab](https://github.com/PMDCollab/SpriteCollab/tree/e7868e9a7f6b931d1fb826756a490d4633879d03),
  révision `e7868e9a7f6b931d1fb826756a490d4633879d03`.
- [PokéSurvivor](https://github.com/JPTER78/pokesurvivor/tree/5bbc3b29288d6af4596f21188fb8b54e0e9b739f),
  révision `5bbc3b29288d6af4596f21188fb8b54e0e9b739f` : inspection des chemins,
  `js/data/sprites-meta.js`, `js/core/sprites.js` et `LICENSE`.
  Aucun moteur, fichier de métadonnées ou PNG n'a été copié de PokéSurvivor.
- [Politique de soumission et de réutilisation SpriteCollab](https://github.com/PMDCollab/SpriteCollab/blob/e7868e9a7f6b931d1fb826756a490d4633879d03/README.md),
  [licence publiée](https://github.com/PMDCollab/SpriteCollab/blob/e7868e9a7f6b931d1fb826756a490d4633879d03/LICENSE.md)
  et [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/legalcode.en).

## Auteurs relevés pour le prototype

Le tableau ci-dessous conserve l'audit initial des trois espèces du prototype.
Pour le catalogue complet, consulter les crédits par espèce et variante dans
[`credits.json`](credits.json), et la correspondance des noms dans
[`credit_names.txt`](credit_names.txt). Chaque entrée du manifeste indique aussi
l'URL épinglée de son fichier `credits.txt` original et son empreinte SHA-256.

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

## Droits examinés et décision de diffusion

La politique SpriteCollab autorise les contributions soumises avec attribution
et pour un usage non commercial. Elle décrit aussi la conservation de sprites
officiels Chunsoft. Pour les trois espèces ci-dessus, les animations normales
sont précisément créditées à CHUNSOFT avec un statut `Unspecified`.
L'audit n'a trouvé aucune autorisation distincte des ayants droit de ces bases.
Les recolorations shiny ne prouvent pas une autorisation de redistribuer la base.

CC BY-NC ne concède que les droits que le donneur de licence peut accorder
(section 1 et préambule), exclut les marques (2.b.2) et ne garantit pas l'absence
de droits tiers (5.a). La présence des fichiers dans un dépôt public ne résout
donc pas cette incertitude. L'import a d'abord été suspendu, puis le propriétaire
a confirmé la diffusion de test et, après validation visuelle, l'activation
en production dans le seul vivarium, puis l'extension au catalogue du jeu.
Les autres parties du jeu conservent leurs
sprites. Cette décision ne prétend pas établir des droits absents des sources.

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

## Pour étendre l'import

`python tools/import-pmd-catalog.py` régénère le catalogue depuis la liste réelle
de `data/species-data.js`. Douze alias d'animations `CopyOf` sont résolus vers
leur source originale ; les PNG restent inchangés. Seuls Idle et Walk, des
espèces prises en charge, sont distribués ; les autres animations et formes
inutilisées ne sont pas importées.

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
