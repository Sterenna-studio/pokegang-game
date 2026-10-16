# Pokémon HGSS du vivarium

**PurpleZaffre**, ULTIMATE Gen 4 Overworlds Pack, publication du 29 mars 2021 :
https://eeveeexpo.com/resources/609/. Graphismes originaux : Game Freak,
Nintendo, Creatures / The Pokémon Company. Usage dans ce jeu non commercial
avec crédit, suivant le même périmètre que les personnages du vivarium.
Conditions originales dans `SOURCE-CONDITIONS.txt`. Le crédit du compilateur
ne transfère pas les droits des graphismes originaux. Aucun pack autonome
ni archive source n’est publié ; seuls les fichiers nécessaires au jeu le sont.
Voir également `../vivarium_characters/CREDITS.md` pour les conditions retenues.

Catalogue volontairement partiel : 23 espèces normales et Léviator shiny.
Une variante shiny manquante reprend le sprite shiny classique, jamais sa
version normale. Les autres Pokémon conservent leur sprite 2D existant.

Exclusions vérifiées : planches composites Various et HoohLugia ; Giratina
Origin (forme différente) ; Machoc avec charbon, Ramoloss sans queue et
Simularbre barrage (poses particulières) ; Regigigas et Ronflex (repos sans
marche directionnelle) ; Étourmi (pas de poses de marche distinctes) ; formes
Greninja/Zygarde (hors des générations actuellement prises en charge).

Réduction exacte ×2 quand possible ; Psykokwak conserve sa résolution source
car il contient des détails d’un pixel. Lignes bas/droite/haut/gauche. Repos = pose fixe.
Marche = 150 ms par pose, cadence choisie pour le vivarium, pas extraite du
moteur HGSS. SHA-256 sources et sorties dans `provenance.json`.
Régénération : `python tools/import-vivarium-hgss-pokemon.py chemin/pack.zip`.
