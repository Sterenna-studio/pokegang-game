# gang_logo

Logos de gangs, teams et factions pour les interfaces de PokeGang.

## Sous-dossiers

| Dossier | Contenu |
|---|---|
| `hd/` | Logos HD nommes par equipe officielle ou variante de team. |
| `pixel/` | Logos carres pixel art numerotes, utiles pour badges et icones compactes. |

## Usage possible

- Identite visuelle des gangs dans `tabCompetition`.
- Badges de bases, raids ou classements.
- Variante graphique pour les cartes de gang ou l'ecran Gang Base.

## Integration

Avant de brancher un logo dans le runtime:

1. definir une cle stable (`team_rocket`, `logo_skull_pixel`, etc.);
2. ajouter le mapping dans la source de donnees ou le helper UI concerne;
3. verifier le rendu en petit format, sur fond sombre et sur fond clair;
4. documenter l'usage exact dans le README du sous-dossier.

## Notes

- Les fichiers ne semblent pas encore references directement par le code.
- Garder les sous-dossiers `hd` et `pixel` separes: ils ne servent pas aux memes
  tailles d'affichage.
- Verifier les credits et les droits avant une publication publique.
