/**
 * LLM Module — extracted from app.js section 10
 *
 * Depends on globals set by app.js: state, addLog, t, pick
 * Exposes: detectLLM, FALLBACK_DIALOGUES, getTrainerDialogue
 */

// ════════════════════════════════════════════════════════════════
// 10.  LLM MODULE
// ════════════════════════════════════════════════════════════════

async function detectLLM() {
  const state = globalThis.state;
  if (state.settings.llmProvider === 'none') {
    state.settings.llmEnabled = false;
    return;
  }
  if (state.settings.llmProvider === 'local') {
    try {
      const res = await fetch(`${state.settings.llmUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        state.settings.llmEnabled = true;
        globalThis.addLog(globalThis.t('llm_connected'));
        return;
      }
    } catch { /* ignore */ }
  }
  if ((state.settings.llmProvider === 'openai' || state.settings.llmProvider === 'anthropic') && state.settings.llmApiKey) {
    state.settings.llmEnabled = true;
    globalThis.addLog(globalThis.t('llm_connected'));
    return;
  }
  state.settings.llmEnabled = false;
}

const FALLBACK_DIALOGUES = {
  fr: [
    'Prépare-toi à avoir des problèmes !',
    'Et fais-le double !',
    'Tu oses défier notre gang ?',
    'Tes Pokémon ne font pas le poids !',
    'La Team Rocket va t\'écraser !',
    'Tu n\'as aucune chance contre nous !',
    'Ton gang est une blague !',
    'Je vais te montrer la vraie puissance !',
    'Quoi ? Tu veux te battre ? Très bien !',
    'Je suis un dresseur ! J\'affronte tout ceux que je croise !',
    'Hé ! Ne me sous-estime pas !',
    'Les insectes sont les meilleurs Pokémon !',
    'Je me suis entraîné dur pour ce moment !',
    'Tu as l\'air fort... intéressant !',
    'Mon Pokémon est le plus fort de la route !',
    'Tu vas regretter d\'être venu ici !',
    'J\'ai perdu mon chemin... mais je vais te battre !',
    'Je suis imbattable ! Enfin je crois...',
  ],
  en: [
    'Prepare for trouble!',
    'And make it double!',
    'You dare challenge our gang?',
    'Your Pokémon don\'t stand a chance!',
    'Team Rocket will crush you!',
    'You have no chance against us!',
    'Your gang is a joke!',
    'I\'ll show you real power!',
    'What? You want to fight? Fine by me!',
    'I\'m a trainer! I battle anyone I meet!',
    'Hey! Don\'t you dare underestimate me!',
    'Bug types are the best Pokémon there are!',
    'I\'ve trained hard for this moment!',
    'You look strong... interesting!',
    'My Pokémon is the strongest on this route!',
    'You\'ll regret ever coming here!',
    'I got lost on my way... but I\'m still gonna beat you!',
    'I\'m unbeatable! Well, I think so...',
  ],
};

function getTrainerDialogue() {
  const state = globalThis.state;
  return globalThis.pick(FALLBACK_DIALOGUES[state.lang] || FALLBACK_DIALOGUES.fr);
}

Object.assign(globalThis, { detectLLM, FALLBACK_DIALOGUES, getTrainerDialogue });
export {};
