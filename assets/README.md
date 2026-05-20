# Assets

Ce dossier regroupe les assets image ajoutes localement pour PokeGang.

Le jeu utilise encore surtout des URLs publiques et des helpers de sprites dans
`data/assets-data.js` et `modules/ui/sprites.js`. Les fichiers ici servent donc
de reserve locale, de source de publication ou de base pour de futures
integrations.

## Dossiers

| Dossier | Contenu | Notes |
|---|---|---|
| `pokegang_logo/` | Logos et variantes de marque | Assets PokeGang principaux, dont les variantes deja referencees cote app via l'hebergement `lab.sterenna.fr/PG`. |
| `pokemon_sprite/` | Sprites Pokemon et packs thematiques | Packs separes par source ou auteur. A mapper explicitement avant usage dans le runtime. |
| `trainer_sprite/` | Sprites de dresseurs et packs de personnages | Packs de dresseurs, variantes Giovanni, GIF Lysandre et un pack `128PX` a verifier avant classement definitif. |

## Convention d'ajout

- Garder un sous-dossier par source, auteur ou pack.
- Ajouter un `README.md` dans tout nouveau dossier d'assets.
- Documenter au minimum: origine, usage prevu, format, contraintes de credit et etat d'integration.
- Pour les fichiers branches dans le jeu, preferer des noms stables en minuscules avec `_`.
- Ne pas renommer un pack externe sans verifier que le code ou les mappings ne dependent pas deja du nom.

## Integration

Quand un asset devient utilise par le jeu:

1. ajouter son mapping dans `data/assets-data.js` ou le helper UI concerne;
2. verifier le chemin local ou l'URL publiee;
3. tester l'affichage dans le navigateur;
4. mettre a jour le `README.md` du dossier source.

## Droits

Ces assets peuvent inclure du fan art ou des elements lies a une licence tierce.
Verifier les droits de redistribution, les credits obligatoires et les limites
d'usage public avant publication.
