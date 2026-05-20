# poke_pixel_pp_16x16

Mini sprites Pokemon en pixel art, probablement exportes en 16x16 d'apres le nom
du dossier.

## Contenu

| Fichier | Note |
|---|---|
| `artikodin.png` | Articuno/Artikodin. |
| `celebi.png` | Celebi. |
| `electhor.png` | Zapdos/Electhor. |
| `groudon.png` | Groudon. |
| `hoho.png` | Ho-Oh, nom simplifie. |
| `kyogre.png` | Kyogre. |
| `luigia.png` | Lugia, nom a conserver tant que les mappings ne sont pas verifies. |
| `mew.png` | Mew. |
| `mewtowo.png` | Mewtwo, nom a conserver tant que les mappings ne sont pas verifies. |
| `qsdqd.png` | Sprite non identifie, a verifier visuellement avant integration. |
| `rayq.png` | Rayquaza, nom abrege a conserver tant que les mappings ne sont pas verifies. |
| `surlfura.png` | Moltres/Sulfura, nom a conserver tant que les mappings ne sont pas verifies. |

## Usage possible

- Icones compactes dans le PC, le Pokedex ou les listes de raid.
- Marqueurs de boss ou recompenses speciales.
- Sprite local de secours si les helpers distants ne chargent pas.

## Integration

- Creer un mapping explicite entre nom de fichier et espece avant usage runtime.
- Ne pas renommer les fichiers aux noms approximatifs sans mettre a jour le
  mapping correspondant.
- Verifier la lisibilite sur les fonds sombres et clairs de l'interface.
- Tester le rendu avec `image-rendering: pixelated` si ces sprites sont agrandis.

## Droits

Conserver les credits du pack si la source est retrouvee, et verifier les
conditions de redistribution avant publication publique.
