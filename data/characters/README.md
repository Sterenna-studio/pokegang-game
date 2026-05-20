# Character Sheets - POKEGANG

This folder contains structured character sheets used to drive coherent NPC.

## Design goals

- Deterministic, game-usable metadata (`faction`, `goals`, `possiblePokemon`).
- Prompt-ready roleplay metadata (`personality`, `speechStyle`, `catchPhrases`).
- JSON-only data so sheets can be loaded by both browser and Node tools.

## Folder layout

- `rocket/`: Team Rocket members and executives.
- `rivals/`: recurring rivals.
- `civilians/`: neutral/support characters.

## Minimal schema (v1)

Each sheet should include:

- `id`, `name`, `role`, `faction`
- `age`, `gender`
- `personality` (array)
- `goals` (`shortTerm`, `longTerm`)
- `values` (array)
- `orientation` (`ally`, `neutral`, `villain`, `rival`)
- `trustLevel` (`0..10`)
- `catchPhrases` (array)
- `speechStyle` (`tone`, `verbosity`, `formality`)
- `pokemonPreferences` (array)
- `possiblePokemon` (array)
- `sprite`
