# Showdown trainers — Gen 3 / Gen 4 pour Pokegang

Cette note documente l'ajout des sprites de trainers Pokémon Showdown orientés simulation de gang.

Base URL :

```txt
https://play.pokemonshowdown.com/sprites/trainers/
```

## Objectif

Ajouter une base exploitable de trainers Gen 3 et Gen 4 pour :

- diversifier les agents recrutables ;
- préparer des factions rivales Hoenn et Sinnoh ;
- enrichir la simulation avec des rôles non-combat : économie, police, logistique, médias, labo ;
- garder une structure compatible avec le loader existant `trainer-sprites-grouped.json`.

## Points d'intégration projet

Le projet utilise déjà :

- `data/trainer-sprites-grouped.json` pour construire l'index local des sprites trainers ;
- `trainerSprite(name)` dans `app.js`, qui résout une clé vers l'URL Showdown ;
- `AGENT_SPRITES` dans `data/game-config-data.js`, utilisé par `rollNewAgent()` au recrutement.

Les nouveaux sprites sont donc ajoutés à deux niveaux :

1. catalogue complet dans `data/trainer-sprites-grouped.json` ;
2. sélection réellement utilisée au recrutement dans `AGENT_SPRITES`.

## Gen 3 — Hoenn

### Factions criminelles / rivales

| Clé | Fichier Showdown | Rôle Pokegang |
|---|---|---|
| `aquaGruntM` | `aqua-grunt.png` | sbire Aqua, contrebande maritime |
| `aquaGruntF` | `aqua-grunt-f.png` | sbire Aqua féminine |
| `magmaGruntM` | `magma-grunt.png` | sbire Magma, mine/volcan/énergie |
| `magmaGruntF` | `magma-grunt-f.png` | sbire Magma féminine |
| `aquaGruntMGen3` | `teamaquagruntm-gen3.png` | variante rétro Aqua |
| `aquaGruntFGen3` | `teamaquagruntf-gen3.png` | variante rétro Aqua féminine |
| `magmaGruntMGen3` | `teammagmagruntm-gen3.png` | variante rétro Magma |
| `magmaGruntFGen3` | `teammagmagruntf-gen3.png` | variante rétro Magma féminine |
| `archieGen3` | `archie-gen3.png` | boss Aqua rétro |
| `archieGen6` | `archie-gen6.png` | boss Aqua modernisé |
| `maxieGen3` | `maxie-gen3.png` | boss Magma rétro |
| `maxieGen6` | `maxie-gen6.png` | boss Magma modernisé |
| `matt` | `matt.png` | lieutenant Aqua / brute |
| `shelly` | `shelly.png` | lieutenante Aqua |
| `courtney` | `courtney.png` | lieutenante Magma |
| `tabitha` | `tabitha.png` | lieutenant Magma |

### Rôles simulation utiles

| Clé | Fichier Showdown | Rôle Pokegang |
|---|---|---|
| `collectorGen3` | `collector-gen3.png` | marchand rare / collectionneur |
| `interviewersGen3` | `interviewers-gen3.png` | médias / réputation |
| `richBoyGen3` | `richboy-gen3.png` | cible riche / investisseur |
| `scientistGen3` | `scientist-gen3.png` | labo / capture / expérimentation |
| `engineerGen3` | `engineer-gen3.png` | machines / base / gadgets |
| `burglarGen3` | `burglar-gen3.png` | infiltration / vol |
| `pokemonRangerGen3` | `pokemonranger-gen3.png` | opposition nature / anti-braconnage |
| `pokemonRangerFGen3` | `pokemonrangerf-gen3.png` | opposition nature / anti-braconnage |
| `triathleteBikerMGen3` | `triathletebikerm-gen3.png` | coursier rapide |
| `triathleteRunnerMGen3` | `triathleterunnerm-gen3.png` | éclaireur |
| `triathleteSwimmerMGen3` | `triathleteswimmerm-gen3.png` | route maritime / infiltration eau |

## Gen 4 — Sinnoh

### Faction Galactic

| Clé | Fichier Showdown | Rôle Pokegang |
|---|---|---|
| `galacticGruntM` | `galacticgrunt.png` | sbire Galactic |
| `galacticGruntF` | `galacticgruntf.png` | sbire Galactic féminine |
| `cyrus` | `cyrus.png` | boss froid / idéologue scientifique |
| `mars` | `mars.png` | commandante Galactic |
| `jupiter` | `jupiter.png` | commandante Galactic |
| `saturn` | `saturn.png` | commandant Galactic |
| `charon` | `charon.png` | scientifique fou / labo |

### Rôles simulation utiles

| Clé | Fichier Showdown | Rôle Pokegang |
|---|---|---|
| `policemanGen4` | `policeman-gen4.png` | police / raid / pression légale |
| `workerGen4` | `worker-gen4.png` | chantier / mine / base |
| `scientistGen4` | `scientist-gen4.png` | labo / upgrades |
| `collectorGen4` | `collector-gen4.png` | marché rare |
| `cyclistGen4` | `cyclist-gen4.png` | coursier |
| `cyclistFGen4` | `cyclistf-gen4.png` | coursière |
| `burglarGen4` | `burglar-gen4.png` | cambriolage / infiltration |
| `richBoyGen4` | `richboy-gen4.png` | cible riche |
| `socialiteGen4` | `socialite-gen4.png` | influence / haute société |
| `veteranGen4` | `veteran-gen4.png` | agent expérimenté |
| `veteranFGen4` | `veteranf-gen4.png` | agente expérimentée |
| `battleGirlGen4` | `battlegirl-gen4.png` | garde / combattante |
| `reporterGen4` | `reporter-gen4.png` | réputation / scandale |

## Proposition gameplay

### Hoenn

Hoenn peut devenir une région de factions rivales :

- Aqua : ports, routes maritimes, contrebande, capture aquatique ;
- Magma : mines, volcans, énergie, souterrains ;
- le joueur peut recruter des transfuges ou affronter les deux camps.

### Sinnoh

Sinnoh peut devenir une région plus froide et technologique :

- Galactic : labo, extraction d'énergie, expérimentation ;
- police Gen 4 : pression régulière sur les zones ;
- workers/scientists : amélioration de base, machines, automation.

## Notes de licence / usage

Les sprites proviennent de Pokémon Showdown. Pour une version publique durable de Pokegang, il vaut mieux les considérer comme :

- assets de prototype ;
- placeholders ;
- références de direction artistique.

Pour une release propre, prévoir des sprites originaux inspirés des rôles, sans reprendre directement les personnages officiels.
