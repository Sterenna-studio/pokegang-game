# pokegang_logo

Logos et variantes de marque pour PokeGang.

## Contenu

| Fichier | Usage recommande |
|---|---|
| `pokegang_logo_full_A.png` | Variante complete, a comparer visuellement avant integration. |
| `pokegang_logo_full_B.png` | Variante complete principale. Deja referencee dans l'intro et le prototype Gang Base via l'hebergement public. |
| `pokegang_logo_medium.png` | Variante compacte pour en-tetes, modales ou vues secondaires. |
| `pokegang_logo_little.png` | Petite variante pour favicon, icones et labels compacts. |
| `ChatGPT Image ... .png` | Generations sources ou variantes de travail. A conserver comme references, pas comme noms runtime stables. |

## Usage dans le jeu

Le code reference actuellement des URLs du type:

- `https://lab.sterenna.fr/PG/pokegang_logo/pokegang_logo_little.png`
- `https://lab.sterenna.fr/PG/pokegang_logo/pokegang_logo_full_B.png`
- `https://lab.sterenna.fr/PG/pokegang_logo/pokegang_logo_medium.png`

Si ces fichiers sont servis localement au lieu de l'hebergement public, mettre a
jour les chemins dans `index.html` et dans les modules UI concernes.

## Notes

- Garder les variantes finales sous des noms courts et stables.
- Eviter d'utiliser directement les fichiers `ChatGPT Image ...` dans le code:
  les espaces, la date et la ponctuation rendent les chemins fragiles.
- Verifier les tailles affichees apres toute compression ou export.
