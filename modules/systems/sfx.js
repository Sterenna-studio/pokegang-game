// ============================================================
//  modules/systems/sfx.js
//  SFX engine (Web Audio API) + Music / Jingle / SE players
//  Exported symbols exposed on globalThis for backward-compat.
// ============================================================

'use strict';

// ── SFX Engine (Web Audio API) ────────────────────────────────────────────────

export const SFX = (() => {
  let ctx;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function playTone(freq, duration, type = 'square', volume = 0.15) {
    const c = getCtx();
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

  return {
    ballThrow() {
      playTone(800, 0.15, 'sawtooth', 0.08);
      setTimeout(() => playTone(400, 0.1, 'sawtooth', 0.06), 80);
    },
    capture(potential, shiny) {
      const base = 520;
      playTone(base,        0.12, 'square', 0.12);
      setTimeout(() => playTone(base * 1.25, 0.12, 'square', 0.12), 100);
      setTimeout(() => playTone(base * 1.5,  0.15, 'square', 0.12), 200);
      if (potential >= 4) setTimeout(() => playTone(base * 2,   0.2,  'square', 0.15), 320);
      if (potential >= 5 || shiny) {
        setTimeout(() => playTone(base * 2.5, 0.25, 'sine', 0.18), 440);
        setTimeout(() => playTone(base * 3,   0.3,  'sine', 0.15), 580);
      }
      if (shiny) {
        setTimeout(() => {
          for (let i = 0; i < 5; i++)
            setTimeout(() => playTone(1200 + i * 200, 0.08, 'sine', 0.1), i * 60);
        }, 700);
      }
    },
    error()    { playTone(200, 0.2, 'sawtooth', 0.1); },
    levelUp() {
      playTone(523,  0.1,  'square', 0.1);
      setTimeout(() => playTone(659,  0.1,  'square', 0.1),  110);
      setTimeout(() => playTone(784,  0.15, 'square', 0.1),  220);
      setTimeout(() => playTone(1047, 0.2,  'sine',   0.12), 360);
    },
    coin() {
      playTone(988, 0.06, 'sine', 0.1);
      setTimeout(() => playTone(1318, 0.1, 'sine', 0.1), 80);
    },
    click()     { playTone(1200, 0.04, 'square', 0.05); },
    tabSwitch() {
      playTone(660, 0.06, 'sine', 0.07);
      setTimeout(() => playTone(880, 0.05, 'sine', 0.05), 50);
    },
    buy() {
      playTone(659, 0.08, 'sine', 0.1);
      setTimeout(() => playTone(880, 0.12, 'sine', 0.12), 80);
    },
    unlock() {
      playTone(440,  0.08, 'square', 0.1);
      setTimeout(() => playTone(554,  0.08, 'square', 0.1),  100);
      setTimeout(() => playTone(659,  0.08, 'square', 0.1),  200);
      setTimeout(() => playTone(880,  0.16, 'sine',   0.12), 310);
      setTimeout(() => playTone(1108, 0.2,  'sine',   0.1),  450);
    },
    menuOpen() {
      playTone(880, 0.08, 'sine', 0.07);
      setTimeout(() => playTone(1100, 0.1, 'sine', 0.06), 80);
    },
    menuClose() {
      playTone(660, 0.07, 'sine', 0.06);
      setTimeout(() => playTone(440, 0.09, 'sine', 0.05), 70);
    },
    chest() {
      playTone(660,  0.08, 'square', 0.08);
      setTimeout(() => playTone(880,  0.08, 'square', 0.09), 80);
      setTimeout(() => playTone(1100, 0.08, 'square', 0.1),  160);
      setTimeout(() => {
        for (let i = 0; i < 4; i++)
          setTimeout(() => playTone(1200 + i * 180, 0.07, 'sine', 0.07), i * 55);
      }, 260);
    },
    notify() {
      playTone(880, 0.07, 'sine', 0.08);
      setTimeout(() => playTone(1108, 0.1, 'sine', 0.07), 90);
    },
    sell() {
      playTone(660, 0.05, 'sine', 0.08);
      setTimeout(() => playTone(440, 0.08, 'sawtooth', 0.06), 70);
    },
    evolve() {
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((f, i) => setTimeout(() => playTone(f, 0.15, 'square', 0.12), i * 120));
      setTimeout(() => {
        for (let i = 0; i < 6; i++)
          setTimeout(() => playTone(1200 + i * 150, 0.1, 'sine', 0.1), i * 60);
      }, notes.length * 120 + 100);
    },
    _enabled() { return globalThis.state?.settings?.sfxEnabled !== false; },
    play(name, ...args) {
      if (!this._enabled()) return;
      if (globalThis.state?.settings?.sfxIndividual?.[name] === false) return;
      try { this[name]?.(...args); } catch {}
    },
  };
})();

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

// ── MusicPlayer — crossfade entre pistes ─────────────────────────────────────

export const MusicPlayer = (() => {
  let _trackA  = null;
  let _trackB  = null;
  let _current = null;

  const FADE_DURATION = 2000;

  function _createAudio(src, vol, loop) {
    const a = new Audio(src);
    a.loop = loop;
    a.volume = 0;
    a.preload = 'auto';
    a.dataset.targetVol = vol;
    return a;
  }

  function _isEnabled() { return globalThis.state?.settings?.musicEnabled === true; }
  function _setVol(el, v) { if (el) el.volume = Math.max(0, Math.min(1, v)); }

  function _fade(el, fromVol, toVol, durationMs, onDone) {
    const steps = 30;
    const dt    = durationMs / steps;
    const delta = (toVol - fromVol) / steps;
    let step = 0;
    const id = setInterval(() => {
      step++;
      _setVol(el, fromVol + delta * step);
      if (step >= steps) { clearInterval(id); _setVol(el, toVol); if (onDone) onDone(); }
    }, dt);
    return id;
  }

  return {
    play(trackId) {
      if (!_isEnabled()) return;
      if (!trackId || !MUSIC_TRACKS[trackId]) return;
      if (_current === trackId) return;

      const def      = MUSIC_TRACKS[trackId];
      const newAudio = _createAudio(def.file, def.vol, def.loop);
      const targetVol = def.vol;
      _current = trackId;

      if (_trackA && !_trackA.paused) {
        const oldA = _trackA;
        _trackB = newAudio;
        _trackB.play().catch(() => {});
        _fade(_trackB, 0, targetVol, FADE_DURATION);
        _fade(oldA, oldA.volume, 0, FADE_DURATION, () => {
          oldA.pause(); oldA.src = '';
          _trackA = _trackB; _trackB = null;
        });
      } else {
        if (_trackA) { _trackA.pause(); _trackA.src = ''; }
        _trackA = newAudio;
        _trackA.play().catch(() => {});
        _fade(_trackA, 0, targetVol, FADE_DURATION);
      }
    },

    stop() {
      if (_trackA) {
        const old = _trackA;
        _trackA = null; _current = null;
        _fade(old, old.volume, 0, FADE_DURATION / 2, () => { old.pause(); old.src = ''; });
      }
    },

    updateFromContext() {
      if (!_isEnabled()) { this.stop(); return; }
      if (globalThis.state?.settings?.jukeboxTrack) {
        this.play(globalThis.state.settings.jukeboxTrack); return;
      }
      for (const zId of (globalThis.state?.openZoneOrder || [])) {
        const zone = globalThis.ZONE_BY_ID?.[zId];
        if (zone?.music) { this.play(zone.music); return; }
      }
      if (globalThis.activeTab === 'tabGang' || globalThis.activeTab === 'tabZones') {
        this.play('base');
      } else {
        this.stop();
      }
    },

    setVolume(v) {
      if (_trackA)
        _setVol(_trackA, Math.max(0, Math.min(1, v)) * (parseFloat(_trackA.dataset.targetVol) || 0.5));
    },

    get current() { return _current; },
  };
})();

// ── JinglePlayer — one-shot ME, coexiste avec la musique de fond ──────────────

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
  let _current = null;
  function _enabled() { return globalThis.state?.settings?.musicEnabled === true; }
  return {
    play(key) {
      if (!_enabled()) return;
      const src = JINGLES[key];
      if (!src) return;
      if (_current) { _current.pause(); _current = null; }
      const a = new Audio(src);
      a.volume = 0.7;
      a.play().catch(() => {});
      _current = a;
      a.addEventListener('ended', () => { _current = null; });
    },
    stop() { if (_current) { _current.pause(); _current = null; } },
  };
})();

// ── SE (Sound Effects fichiers audio) ────────────────────────────────────────

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
  const src = SE_SOUNDS[key];
  if (!src) return;
  const a = new Audio(src);
  a.volume = vol;
  a.play().catch(() => {});
}

// ── Backward-compat: expose on globalThis ─────────────────────────────────────
globalThis.SFX          = SFX;
globalThis.MusicPlayer  = MusicPlayer;
globalThis.JinglePlayer = JinglePlayer;
globalThis.playSE       = playSE;
globalThis.MUSIC_TRACKS = MUSIC_TRACKS;
globalThis.JINGLES      = JINGLES;
globalThis.SE_SOUNDS    = SE_SOUNDS;
