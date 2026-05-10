# Egg sprites integration plan

Ce document pose la base d'intégration des sprites d'œufs dans PokéGang pour le futur système d'œufs.

## Objectif

- gérer des sprites d'œufs par espèce
- éviter les hotlinks externes en runtime
- servir les assets depuis le projet et le domaine du jeu
- garder un mapping simple `species_en -> sprite egg`
- prévoir des fallbacks pour les espèces manquantes, les raretés et les events

## Structure recommandée

```text
assets/
  eggs/
    species/
      bulbasaur.png
      pikachu.png
      chewtle.png
    fallback/
      common.png
      rare.png
      event.png

data/
  egg-sprites.json
```

## Manifest JSON

Le manifeste doit rester simple, compatible avec le projet actuel sans build step.

```json
{
  "meta": {
    "source": "RPA_sprites",
    "version": 1,
    "basePath": "assets/eggs/species/"
  },
  "species": {
    "bulbasaur": "bulbasaur.png",
    "pikachu": "pikachu.png",
    "chewtle": "chewtle.png"
  },
  "fallbacks": {
    "default": "assets/eggs/fallback/common.png",
    "rare": "assets/eggs/fallback/rare.png",
    "event": "assets/eggs/fallback/event.png"
  }
}
```

## Loader JS recommandé

```js
let EGG_SPRITES = null;

async function loadEggSprites() {
  if (EGG_SPRITES) return EGG_SPRITES;
  const res = await fetch('data/egg-sprites.json');
  if (!res.ok) throw new Error('Impossible de charger egg-sprites.json');
  EGG_SPRITES = await res.json();
  return EGG_SPRITES;
}

function getEggSprite(speciesEn, fallback = 'default') {
  const file = EGG_SPRITES?.species?.[speciesEn];
  if (file) return `${EGG_SPRITES.meta.basePath}${file}`;
  return EGG_SPRITES?.fallbacks?.[fallback] || null;
}
```

## Pipeline d'import conseillé

Le repo de jeu ne doit contenir que les assets nécessaires au runtime.

Étapes recommandées :

1. importer les sprites retenus depuis la source validée
2. copier localement dans `assets/eggs/species/`
3. générer `data/egg-sprites.json`
4. ajouter des fallbacks locaux
5. brancher le loader dans le futur système d'œufs

## Règles de nommage

- utiliser `species_en` comme clé unique
- tout en minuscules
- utiliser des tirets pour les espèces composées si besoin
- rester cohérent avec les autres fichiers de data du projet

Exemples :
- `mr-mime`
- `farfetchd`
- `nidoran-f`
- `nidoran-m`

## Intégration gameplay future

Cas à couvrir plus tard :

- œuf d'espèce connue
- œuf fallback standard
- œuf rare
- œuf event
- éventuelle variante shiny / corrompue / spéciale

## Tâches futures

- créer `assets/eggs/species/`
- créer `assets/eggs/fallback/`
- ajouter `data/egg-sprites.json`
- écrire un script d'import local si nécessaire
- brancher l'affichage des œufs dans la pension / incubateur / scanner
