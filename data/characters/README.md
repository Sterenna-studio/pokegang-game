# data/characters

Fiches JSON de personnages pour PokeGang.

Ces donnees servent de reserve structuree pour des PNJ coherents: rivaux,
membres de teams, personnages de soutien, dialogues ou futurs generateurs
d'evenements.

## Contenu

| Dossier | Contenu |
|---|---|
| `rocket/` | Membres et cadres de la Team Rocket. |
| `rivals/` | Rivaux recurrents ou dresseurs concurrents. |
| `civilians/` | Personnages neutres, de soin ou de support. |

## Fiches actuelles

| Fichier | Personnage | Role |
|---|---|---|
| `rocket/giovanni.json` | Giovanni | Boss Rocket. |
| `rocket/archer.json` | Archer | Cadre Rocket. |
| `rivals/blue.json` | Blue | Rival champion. |
| `rivals/silver.json` | Silver | Rival solitaire. |
| `civilians/nurse-joy.json` | Nurse Joy | Support et soin. |

## Schema minimal

Chaque fiche doit rester en JSON valide et inclure:

- `id`, `name`, `role`, `faction`
- `age`, `gender`
- `personality` (liste)
- `goals.shortTerm`, `goals.longTerm`
- `values` (liste)
- `orientation` (`ally`, `neutral`, `villain`, `rival`)
- `trustLevel` (`0` a `10`)
- `catchPhrases` (liste)
- `speechStyle.tone`, `speechStyle.verbosity`, `speechStyle.formality`
- `pokemonPreferences` (liste)
- `possiblePokemon` (liste d'identifiants d'especes)
- `sprite` (URL ou futur chemin local)

## Convention d'ajout

- Garder un sous-dossier par faction ou famille de personnages.
- Utiliser un `id` stable prefixe par `npc_`.
- Nommer les fichiers en minuscules avec `-` si besoin (`nurse-joy.json`).
- Preferer des valeurs simples et deterministes, faciles a mapper dans le jeu.
- Ne pas brancher une fiche dans le runtime sans verifier le chargement JSON et
  le rendu du sprite.

## Integration

Ces fiches ne sont pas encore referencees directement par le code runtime.

Quand une fiche devient utilisee:

1. ajouter un loader ou un mapping explicite cote donnees;
2. verifier que les identifiants `possiblePokemon` correspondent aux especes du
   jeu;
3. remplacer les URLs externes de sprites par des assets locaux si necessaire;
4. documenter ici le module ou l'ecran qui consomme la fiche.
