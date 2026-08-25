# Audit — accès narratifs Hoenn et opacité des combats

Date : 25 août 2026
Périmètre : zones Hoenn spéciales, quêtes Groudon/Kyogre, migration des saves,
sélecteur de zones, replay des combats standards et raids.

## Résultat

Quatre zones Hoenn existaient avec un `unlockItem`, mais les quatre objets
n'avaient ni définition localisée ni source d'obtention :

| Zone | Verrou orphelin avant correctif | Source désormais appliquée |
|---|---|---|
| QG Team Magma | `magma_hideout_key` | étape 1 Magma terminée (20 combats) |
| QG Team Aqua | `aqua_hideout_key` | étape 1 Aqua terminée (20 combats) |
| Caverne Originelle | `cave_origin_pass` | Maxie ou Archie vaincu |
| Grottes des Régis | `regi_seal` | Groudon et Kyogre capturés |

`isZoneUnlocked()` exigeait correctement `state.purchases[unlockItem]`. Le
défaut était en amont : aucun producteur n'écrivait ces droits. Le sélecteur
ne trouvait aucune entrée correspondante dans `SHOP_ITEMS` et affichait donc
les identifiants techniques bruts.

## Correction

- règles pures et idempotentes dans `modules/systems/hoennUnlocks.js` ;
- attribution aux jalons réels dans `legendaryMissions.js` ;
- migration schéma 17 pour réparer les anciennes saves déjà avancées ;
- définitions bilingues cachées du marché dans `data/economy-data.js` ;
- exclusion générique des objets `hidden` du magasin standard ;
- documentation des conditions dans `info/zones.md` et la checklist QA.

Le Sceau des Régis est placé après les deux captures légendaires : cela suit
l'ordre de difficulté existant Caverne Originelle (réputation 3300), Grottes
des Régis (3400), puis Ligue Hoenn (3700), sans introduire un achat arbitraire.

## Opacité des combats

Le résultat du combat est calculé avant son replay. `zoneWindows.js` appliquait
immédiatement une opacité de `0.45` en cas de victoire ou `0.75` en cas de
défaite sur le spawn adverse entier. Le Pokémon, le dresseur et toute la rangée
du raid paraissaient donc déjà grisés pendant les tours encore affichés.

Ces affectations ont été supprimées pour les combats manuels et automatiques.
Le spawn est explicitement rendu à opacité normale pendant le replay et son
style inline est nettoyé au teardown. L'animation locale `fainted` reste
réservée au seul Pokémon K.O.

## Issues GitHub

- Issue #77, ouverte : couvre le pipeline commun de combat, les transitions de
  sprites et les raids. Le commit publié et ses validations sont référencés dans
  un commentaire de suivi sur cette issue.
- Aucun ticket existant ne mentionnait les quatre verrous Hoenn lors de l'audit.
  Aucun commentaire hors sujet n'a été ajouté aux issues #76 ou #58.

## Constat adjacent hors périmètre

L'inventaire exhaustif des `unlockItem` a également trouvé trois identifiants
Sinnoh sans définition ni producteur : `galactic_hq_key`, `turnback_seal` et
`azure_flute`. Leur intention dépend des quêtes Sinnoh et n'a pas été déduite
ni modifiée dans ce correctif Hoenn. Aucun ticket ouvert ne les couvre au
moment de l'audit ; ils restent à traiter séparément avec leur progression
narrative propre.

Le contrôle de build itch a aussi révélé que `tools/build-itch.js` recherchait
le point de rendu Nitro avec un bloc LF littéral. Les sources étant en CRLF sur
ce checkout Windows, le build annonçait à tort zéro occurrence. La détection
accepte désormais LF et CRLF tout en conservant l'exigence stricte d'une seule
occurrence ; l'artefact complet est construit pendant la validation finale.
Le build validé produit `pokegang-v0.5.2-itch.zip` (532 entrées, 6,58 Mo), avec
les variantes française du site et anglaise d'itch contrôlées.

## Régressions automatisées

`tools/test-hoenn-unlocks.mjs` vérifie :

- chaque définition d'objet bilingue et non vendable ;
- les deux clés de QG indépendamment ;
- le laissez-passer partagé après l'un ou l'autre chef ;
- le Sceau des Régis après les deux captures ;
- l'idempotence ;
- le rattrapage d'une sauvegarde schéma 16 ;
- l'absence des anciennes affectations d'opacité.

`tools/test-combat-multi-pokemon.mjs` conserve en parallèle la couverture des
transitions standard/raid, du fallback de sprite et des gardes de génération.
