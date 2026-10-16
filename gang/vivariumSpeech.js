// Reading time only; no timer, renderer or game state in this helper.
export function vivariumSpeechDuration(text) {
  return Math.max(6500, Math.min(14000, 2200 + String(text || '').length * 55));
}
