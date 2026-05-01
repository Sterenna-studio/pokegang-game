'use strict';

// ============================================================
// modules/sfx.js — SFX Engine (Web Audio API)
// ============================================================
// Dépendances globales (classic-script) : aucune
// Dépendances globalThis : state (pour sfxEnabled / sfxVol / sfxIndividual)
// Expose : SFX (objet avec méthodes play*), playSfx(name)
// ============================================================

const _sfxCtx = (() => {
  let ctx;
  return {
    get() {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      return ctx;
    },
  };
})();

function _playTone(freq, duration, type = 'square', volume = 0.15) {
  const c = _sfxCtx.get();
  if (c.state === 'suspended') { c.resume().catch(() => {}); return; }
  const osc  = c.createOscillator();
  const gain = c.createGain();
  const sfxMult = (globalThis.state?.settings?.sfxVol ?? 80) / 100;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  gain.gain.setValueAtTime(volume * sfxMult, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration + 0.05);
}

function _sfxEnabled(name) {
  const s = globalThis.state?.settings;
  if (!s?.sfxEnabled) return false;
  // Per-sound toggle (sfxIndividual map)
  if (name && s.sfxIndividual && s.sfxIndividual[name] === false) return false;
  return true;
}

export const SFX = {
  ballThrow() {
    if (!_sfxEnabled('ballThrow')) return;
    _playTone(800, 0.15, 'sawtooth', 0.08);
    setTimeout(() => _playTone(400, 0.1, 'sawtooth', 0.06), 80);
  },

  capture(potential, shiny) {
    if (!_sfxEnabled('capture')) return;
    const base = 520;
    _playTone(base, 0.12, 'square', 0.12);
    setTimeout(() => _playTone(base * 1.25, 0.12, 'square', 0.12), 100);
    setTimeout(() => _playTone(base * 1.5,  0.15, 'square', 0.12), 200);
    if (potential >= 4) {
      setTimeout(() => _playTone(base * 2, 0.2, 'square', 0.15), 320);
    }
    if (potential >= 5 || shiny) {
      setTimeout(() => _playTone(base * 2.5, 0.25, 'sine', 0.18), 440);
      setTimeout(() => _playTone(base * 3,   0.3,  'sine', 0.15), 580);
    }
    if (shiny) {
      setTimeout(() => {
        for (let i = 0; i < 5; i++) {
          setTimeout(() => _playTone(1200 + i * 200, 0.08, 'sine', 0.1), i * 60);
        }
      }, 700);
    }
  },

  error() {
    if (!_sfxEnabled('error')) return;
    _playTone(200, 0.2, 'sawtooth', 0.1);
  },

  levelUp() {
    if (!_sfxEnabled('levelUp')) return;
    _playTone(523,  0.1,  'square', 0.1);
    setTimeout(() => _playTone(659,  0.1,  'square', 0.1), 110);
    setTimeout(() => _playTone(784,  0.15, 'square', 0.1), 220);
    setTimeout(() => _playTone(1047, 0.2,  'sine',   0.12), 360);
  },

  coin() {
    if (!_sfxEnabled('coin')) return;
    _playTone(988,  0.06, 'sine', 0.1);
    setTimeout(() => _playTone(1318, 0.1, 'sine', 0.1), 80);
  },

  click() {
    if (!_sfxEnabled('click')) return;
    _playTone(1200, 0.04, 'square', 0.05);
  },

  tabSwitch() {
    if (!_sfxEnabled('tabSwitch')) return;
    _playTone(660, 0.06, 'sine', 0.07);
    setTimeout(() => _playTone(880, 0.05, 'sine', 0.05), 50);
  },

  purchase() {
    if (!_sfxEnabled('purchase')) return;
    _playTone(880,  0.08, 'sine', 0.1);
    setTimeout(() => _playTone(1100, 0.08, 'sine', 0.1), 90);
    setTimeout(() => _playTone(1320, 0.12, 'sine', 0.12), 180);
  },

  fight() {
    if (!_sfxEnabled('fight')) return;
    _playTone(120, 0.15, 'sawtooth', 0.15);
    setTimeout(() => _playTone(90, 0.2, 'sawtooth', 0.12), 120);
  },

  victory() {
    if (!_sfxEnabled('victory')) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      setTimeout(() => _playTone(f, 0.15, 'square', 0.12), i * 100);
    });
  },

  openMenu() {
    if (!_sfxEnabled('openMenu')) return;
    _playTone(440, 0.06, 'sine', 0.08);
    setTimeout(() => _playTone(550, 0.05, 'sine', 0.06), 60);
  },

  closeMenu() {
    if (!_sfxEnabled('closeMenu')) return;
    _playTone(550, 0.05, 'sine', 0.06);
    setTimeout(() => _playTone(440, 0.06, 'sine', 0.08), 60);
  },

  evolve() {
    if (!_sfxEnabled('evolve')) return;
    const notes = [523, 659, 784, 1047, 1319, 1568];
    notes.forEach((f, i) => setTimeout(() => _playTone(f, 0.18, 'sine', 0.13), i * 90));
    setTimeout(() => {
      for (let i = 0; i < 6; i++) {
        setTimeout(() => _playTone(800 + i * 150, 0.07, 'sine', 0.08), i * 50);
      }
    }, 600);
  },

  eggHatch() {
    if (!_sfxEnabled('eggHatch')) return;
    _playTone(300, 0.05, 'square', 0.1);
    setTimeout(() => _playTone(500, 0.05, 'square', 0.1), 80);
    setTimeout(() => _playTone(700, 0.1,  'sine',   0.12), 160);
    setTimeout(() => _playTone(900, 0.15, 'sine',   0.14), 260);
  },

  notification() {
    if (!_sfxEnabled('notification')) return;
    _playTone(880, 0.07, 'sine', 0.09);
    setTimeout(() => _playTone(1100, 0.07, 'sine', 0.09), 100);
  },
};

/**
 * playSfx(name, ...args)
 * Appel unifié depuis app.js et les modules.
 * Equivaut à SFX[name]?.(...args)
 * Vérifie sfxEnabled globalement avant dispatch.
 */
export function playSfx(name, ...args) {
  if (!globalThis.state?.settings?.sfxEnabled) return;
  SFX[name]?.(...args);
}

// Expose sur globalThis pour les modules qui n'importent pas directement
globalThis.SFX     = SFX;
globalThis.playSfx = playSfx;
