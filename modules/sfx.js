'use strict';

// ============================================================
// modules/sfx.js — SFX Engine + Music / Jingle / SE
// ============================================================
// Canonical file. modules/systems/sfx.js and any old importer
// should re-export from here.
// ============================================================

// ── Internal Audio context ──────────────────────────────────────────────────────
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
  if (name && s.sfxIndividual && s.sfxIndividual[name] === false) return false;
  return true;
}

// ── SFX (Web Audio synthèse) ─────────────────────────────────────────────────
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
    if (potential >= 4) setTimeout(() => _playTone(base * 2, 0.2, 'square', 0.15), 320);
    if (potential >= 5 || shiny) {
      setTimeout(() => _playTone(base * 2.5, 0.25, 'sine', 0.18), 440);
      setTimeout(() => _playTone(base * 3,   0.3,  'sine', 0.15), 580);
    }
    if (shiny) {
      setTimeout(() => {
        for (let i = 0; i < 5; i++)
          setTimeout(() => _playTone(1200 + i * 200, 0.08, 'sine', 0.1), i * 60);
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
    setTimeout(() => _playTone(659,  0.1,  'square', 0.1),  110);
    setTimeout(() => _playTone(784,  0.15, 'square', 0.1),  220);
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
  buy() {
    if (!_sfxEnabled('buy')) return;
    _playTone(659, 0.08, 'sine', 0.1);
    setTimeout(() => _playTone(880, 0.12, 'sine', 0.12), 80);
  },
  purchase() {
    if (!_sfxEnabled('purchase')) return;
    _playTone(880,  0.08, 'sine', 0.1);
    setTimeout(() => _playTone(1100, 0.08, 'sine', 0.1),  90);
    setTimeout(() => _playTone(1320, 0.12, 'sine', 0.12), 180);
  },
  unlock() {
    if (!_sfxEnabled('unlock')) return;
    _playTone(440,  0.08, 'square', 0.1);
    setTimeout(() => _playTone(554,  0.08, 'square', 0.1),  100);
    setTimeout(() => _playTone(659,  0.08, 'square', 0.1),  200);
    setTimeout(() => _playTone(880,  0.16, 'sine',   0.12), 310);
    setTimeout(() => _playTone(1108, 0.2,  'sine',   0.1),  450);
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
  menuOpen() {
    if (!_sfxEnabled('menuOpen')) return;
    _playTone(880, 0.08, 'sine', 0.07);
    setTimeout(() => _playTone(1100, 0.1, 'sine', 0.06), 80);
  },
  menuClose() {
    if (!_sfxEnabled('menuClose')) return;
    _playTone(660, 0.07, 'sine', 0.06);
    setTimeout(() => _playTone(440, 0.09, 'sine', 0.05), 70);
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
  chest() {
    if (!_sfxEnabled('chest')) return;
    _playTone(660,  0.08, 'square', 0.08);
    setTimeout(() => _playTone(880,  0.08, 'square', 0.09), 80);
    setTimeout(() => _playTone(1100, 0.08, 'square', 0.1),  160);
    setTimeout(() => {
      for (let i = 0; i < 4; i++)
        setTimeout(() => _playTone(1200 + i * 180, 0.07, 'sine', 0.07), i * 55);
    }, 260);
  },
  notify() {
    if (!_sfxEnabled('notify')) return;
    _playTone(880, 0.07, 'sine', 0.08);
    setTimeout(() => _playTone(1108, 0.1, 'sine', 0.07), 90);
  },
  notification() {
    if (!_sfxEnabled('notification')) return;
    _playTone(880, 0.07, 'sine', 0.09);
    setTimeout(() => _playTone(1100, 0.07, 'sine', 0.09), 100);
  },
  sell() {
    if (!_sfxEnabled('sell')) return;
    _playTone(660, 0.05, 'sine', 0.08);
    setTimeout(() => _playTone(440, 0.08, 'sawtooth', 0.06), 70);
  },
  evolve() {
    if (!_sfxEnabled('evolve')) return;
    const notes = [523, 659, 784, 1047, 1319, 1568];
    notes.forEach((f, i) => setTimeout(() => _playTone(f, 0.18, 'sine', 0.13), i * 90));
    setTimeout(() => {
      for (let i = 0; i < 6; i++)
        setTimeout(() => _playTone(800 + i * 150, 0.07, 'sine', 0.08), i * 50);
    }, 600);
  },
  eggHatch() {
    if (!_sfxEnabled('eggHatch')) return;
    _playTone(300, 0.05, 'square', 0.1);
    setTimeout(() => _playTone(500, 0.05, 'square', 0.1),  80);
    setTimeout(() => _playTone(700, 0.1,  'sine',   0.12), 160);
    setTimeout(() => _playTone(900, 0.15, 'sine',   0.14), 260);
  },
};

export function playSfx(name, ...args) {
  if (!globalThis.state?.settings?.sfxEnabled) return;
  SFX[name]?.(...args);
}

// ── Music tracks catalogue ────────────────────────────────────────────────────
export const MUSIC_TRACKS = {
  base:       { file: 'music/BGM/First Town.mp3',  loop: true,  vol: 0.45, fr: 'Base du Gang'      },
  forest:     { file: 'music/BGM/Route 1.mp3',     loop: true,  vol: 0.50, fr: 'Route'              },
  cave:       { file: 'music/BGM/Cave.mp3',         loop: true,  vol: 0.45, fr: 'Caverne'            },
  city:       { file: 'music/BGM/Lab.mp3',          loop: true,  vol: 0.50, fr: 'Ville'              },
  sea:        { file: 'music/BGM/Introduction.mp3', loop: true,  vol: 0.45, fr: 'Mer / Bateau'       },
  safari:     { file: 'music/BGM/Route 1.mp3',      loop: true,  vol: 0.45, fr: 'Parc Safari'        },
  lavender:   { file: 'music/BGM/Cave.mp3',         loop: true,  vol: 0.30, fr: 'Lavanville'         },
  tower:      { file: 'music/BGM/Cave.mp3',         loop: true,  vol: 0.28, fr: 'Tour Pokémon'       },
  mansion:    { file: 'music/BGM/Cave.mp3',         loop: true,  vol: 0.35, fr: 'Manoir Pokémon'     },
  gym:        { file: 'music/BGM/VSTrainer.mp3',    loop: true,  vol: 0.55, fr: 'Arène'              },
  rocket:     { file: 'music/BGM/VSRival.mp3',      loop: true,  vol: 0.55, fr: 'Team Rocket'        },
  silph:      { file: 'music/BGM/Lab.mp3',          loop: true,  vol: 0.50, fr: 'Sylphe SARL'        },
  elite4:     { file: 'music/BGM/VSLegend.mp3',     loop: true,  vol: 0.60, fr: 'Élite 4 / Sommet'   },
  casino:     { file: 'music/BGM/MysteryGift.mp3',  loop: true,  vol: 0.55, fr: 'Casino'             },
  halloffame: { file: 'music/BGM/Hall of Fame.mp3', loop: false, vol: 0.60, fr: "Tableau d'Honneur"  },
  title:      { file: 'music/BGM/Title.mp3',        loop: true,  vol: 0.50, fr: 'Titre'              },
};

// ── MusicPlayer — crossfade ──────────────────────────────────────────────────────
export const MusicPlayer = (() => {
  let _trackA = null, _trackB = null, _current = null;
  const FADE = 2000;
  function _audio(src, vol, loop) {
    const a = new Audio(src); a.loop = loop; a.volume = 0;
    a.preload = 'auto'; a.dataset.targetVol = vol; return a;
  }
  function _ok()  { return globalThis.state?.settings?.musicEnabled === true; }
  function _v(el, v) { if (el) el.volume = Math.max(0, Math.min(1, v)); }
  function _fade(el, from, to, ms, cb) {
    const steps = 30, dt = ms / steps, delta = (to - from) / steps;
    let s = 0;
    const id = setInterval(() => {
      s++; _v(el, from + delta * s);
      if (s >= steps) { clearInterval(id); _v(el, to); cb?.(); }
    }, dt);
    return id;
  }
  return {
    play(trackId) {
      if (!_ok() || !trackId || !MUSIC_TRACKS[trackId] || _current === trackId) return;
      const def = MUSIC_TRACKS[trackId]; _current = trackId;
      const na = _audio(def.file, def.vol, def.loop);
      if (_trackA && !_trackA.paused) {
        const old = _trackA; _trackB = na;
        _trackB.play().catch(() => {});
        _fade(_trackB, 0, def.vol, FADE);
        _fade(old, old.volume, 0, FADE, () => { old.pause(); old.src = ''; _trackA = _trackB; _trackB = null; });
      } else {
        if (_trackA) { _trackA.pause(); _trackA.src = ''; }
        _trackA = na; _trackA.play().catch(() => {});
        _fade(_trackA, 0, def.vol, FADE);
      }
    },
    stop() {
      if (!_trackA) return;
      const old = _trackA; _trackA = null; _current = null;
      _fade(old, old.volume, 0, FADE / 2, () => { old.pause(); old.src = ''; });
    },
    updateFromContext() {
      if (!_ok()) { this.stop(); return; }
      if (globalThis.state?.settings?.jukeboxTrack) { this.play(globalThis.state.settings.jukeboxTrack); return; }
      for (const zId of (globalThis.state?.openZoneOrder || [])) {
        const zone = globalThis.ZONE_BY_ID?.[zId];
        if (zone?.music) { this.play(zone.music); return; }
      }
      if (globalThis.activeTab === 'tabGang' || globalThis.activeTab === 'tabZones') this.play('base');
      else this.stop();
    },
    setVolume(v) {
      if (_trackA) _v(_trackA, Math.max(0, Math.min(1, v)) * (parseFloat(_trackA.dataset.targetVol) || 0.5));
    },
    get current() { return _current; },
  };
})();

// ── JinglePlayer — one-shot ME ────────────────────────────────────────────────────
export const JINGLES = {
  trainer_encounter: 'music/ME/VSTrainer_Intro.mp3',
  wild_encounter:    'music/ME/VSWildPoke_Intro.mp3',
  legend_encounter:  'music/ME/VSLegend_Intro.mp3',
  rival_encounter:   'music/ME/VSRival_Intro.mp3',
  youngster:         'music/ME/Encounter_Youngster.mp3',
  mystery_gift:      'music/BGM/MysteryGift.mp3',
  low_hp:            'music/ME/lowhp.mp3',
  slots_win:         'music/ME/SlotsWin.mp3',
  slots_big:         'music/ME/SlotsBigWin.mp3',
};

export const JinglePlayer = (() => {
  let _cur = null;
  function _ok() { return globalThis.state?.settings?.musicEnabled === true; }
  return {
    play(key) {
      if (!_ok()) return;
      const src = JINGLES[key]; if (!src) return;
      if (_cur) { _cur.pause(); _cur = null; }
      const a = new Audio(src); a.volume = 0.7;
      a.play().catch(() => {}); _cur = a;
      a.addEventListener('ended', () => { _cur = null; });
    },
    stop() { if (_cur) { _cur.pause(); _cur = null; } },
  };
})();

// ── SE (fichiers audio) ─────────────────────────────────────────────────────────
export const SE_SOUNDS = {
  buy:       'music/SE/Charm.mp3',
  level_up:  'music/SE/BW2Summary.mp3',
  slash:     'music/SE/Slash.mp3',
  metronome: 'music/SE/Metronome.mp3',
  explosion: 'music/SE/Explosion.mp3',
  protect:   'music/SE/Protect.mp3',
  flash:     'music/SE/Flash.mp3',
};

export function playSE(key, vol = 0.6) {
  if (globalThis.state?.settings?.sfxEnabled === false) return;
  const src = SE_SOUNDS[key]; if (!src) return;
  const a = new Audio(src); a.volume = vol;
  a.play().catch(() => {});
}

// ── globalThis backward-compat ────────────────────────────────────────────────────
globalThis.SFX          = SFX;
globalThis.playSfx      = playSfx;
globalThis.MusicPlayer  = MusicPlayer;
globalThis.JinglePlayer = JinglePlayer;
globalThis.playSE       = playSE;
globalThis.MUSIC_TRACKS = MUSIC_TRACKS;
globalThis.JINGLES      = JINGLES;
globalThis.SE_SOUNDS    = SE_SOUNDS;
