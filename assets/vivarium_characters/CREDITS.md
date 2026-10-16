# Personnages du vivarium — crédits et provenance

**Gen 4 Overworlds : PurpleZaffre** (extraction, compilation et alignement du pack).

Source : [ULTIMATE Gen 4 Overworlds Pack](https://eeveeexpo.com/resources/609/),
version publiée le 29 mars 2021. Graphismes Pokémon originaux : Game Freak,
Nintendo, Creatures / The Pokémon Company. PurpleZaffre n'est pas présenté
comme le titulaire des graphismes des jeux originaux.

Seules 33 planches de personnages utilisées par les archétypes de PokéGang
sont intégrées. Aucun Pokémon, contenu bêta ou pack complet n'est redistribué.
Les conditions originales sont conservées dans `SOURCE-CONDITIONS.txt`.
Le ZIP source reste un fichier de travail privé, hors Git et hors build.

La publication propose l'utilisation dans les jeux avec crédit PurpleZaffre
et demande de ne pas redistribuer la ressource. Lecture retenue pour cette
intégration : usage crédité dans le jeu, sans miroir ni redistribution du
pack autonome. Ce contexte ne constitue pas une licence générale des ayants
droit des graphismes originaux. Le projet est déclaré sans revenus ni dons.

Transformations techniques : réduction exacte ×2 par voisin le plus proche
(les pixels d'origine sont conservés), réorganisation des lignes en
bas/droite/haut/gauche. Une seule planche PNG par personnage contient les
quatre poses de chaque direction. Le repos utilise la première pose.
La cadence choisie pour la scène est de 150 ms par pose de marche ; ce n'est
pas une durée extraite du moteur HGSS.

`provenance.json` conserve les chemins sources et SHA-256 des fichiers
originaux, de l'archive et des PNG générés. Régénération :

```sh
python tools/import-vivarium-characters.py chemin/Ultimate_Gen_4_Overworlds_Pack.zip
```

Le crédit est affiché dans le vivarium local et renvoie à la publication
originale. Les portraits de face et leurs crédits préexistants sont conservés.
