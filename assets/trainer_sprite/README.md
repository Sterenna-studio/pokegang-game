# trainer_sprite

Sprites de dresseurs, personnages et packs voisins.

## Contenu

| Dossier/fichier | Contenu |
|---|---|
| `lysandre_by_muzyun.gif` | GIF anime de Lysandre. |
| `pokemon_128px_by_lancelotxiii_dj8sk6x/` | Pack `128PX` numerote. Le nom indique Pokemon, mais il est actuellement range ici: verifier son usage avant integration. |
| `trainer_ByKyledove/` | Pack de dresseurs par Kyle Dove, avec planche source et variantes numerotees. |
| `trainer_ByPoLIOrOn/` | Pack de dresseurs par PoLIOrOn, avec variantes et image Elite 4. |
| `trainer_giovanni/` | Variantes Giovanni issues de plusieurs generations. |

## Usage prevu

- Selection de sprite du boss.
- Dresseurs adverses et gym leaders.
- Cinematiques ou modales de combat.

## Integration

Avant de brancher un sprite de dresseur:

1. definir une cle stable (`giovanni_hgss`, `trainer_kyledove_01`, etc.);
2. ajouter le mapping dans `modules/ui/sprites.js` ou la source de donnees concernee;
3. verifier la taille en modale, carte agent et combat;
4. noter l'usage dans le README du sous-dossier.

## Credits et droits

Conserver les noms des auteurs dans les dossiers. Verifier les conditions de
credit et redistribution avant publication.
