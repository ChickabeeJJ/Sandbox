'use strict';
/* =========================================================================
   Procedural audio: every sound is synthesized with WebAudio, so the game
   ships with zero audio files. Includes a soft generative music loop.
   ========================================================================= */

const Sfx = (() => {
  let ac = null, master, sfxBus, musicBus, noiseBuf, comp;
  let sfxVol = 0.8, musicVol = 0.35, muted = false, adMuted = false;
  const last = {};

  function ensure() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    master = ac.createGain();
    sfxBus = ac.createGain(); musicBus = ac.createGain();
    sfxBus.connect(master); musicBus.connect(master);
    master.connect(comp); comp.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    apply();
    Music.start();
    return true;
  }

  function apply() {
    if (!ac) return;
    const m = muted || adMuted ? 0 : 1;
    master.gain.setTargetAtTime(m, ac.currentTime, 0.05);
    sfxBus.gain.value = sfxVol;
    musicBus.gain.value = musicVol * 0.5;
  }

  function throttle(key, ms) {
    const now = performance.now();
    if (last[key] && now - last[key] < ms) return true;
    last[key] = now; return false;
  }

  function env(g, t, a, peak, dcy) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
  }

  function tone(freq, dur, typ, vol, when, slideTo) {
    if (!ac) return;
    const t = ac.currentTime + (when || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = typ || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    env(g, t, 0.005, vol, dur);
    o.connect(g); g.connect(sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, vol, filterType, f0, f1, q, when) {
    if (!ac) return;
    const t = ac.currentTime + (when || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    s.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ac.createBiquadFilter(); f.type = filterType; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain();
    env(g, t, 0.004, vol, dur);
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  const api = {
    unlock: ensure,
    place(state) {
      if (!ac || throttle('place', 55)) return;
      if (state === ST.LIQUID) tone(380 + Math.random() * 260, 0.07, 'sine', 0.08, 0, 180);
      else if (state === ST.GAS) noise(0.08, 0.05, 'highpass', 2500);
      else if (state === ST.ENERGY) noise(0.07, 0.07, 'bandpass', 3500, 1200, 2);
      else if (state === ST.SOLID) tone(140 + Math.random() * 40, 0.05, 'triangle', 0.08);
      else noise(0.05, 0.09, 'bandpass', 1800 + Math.random() * 1200, 0, 1.5);
    },
    erase() { if (!ac || throttle('erase', 70)) return; noise(0.06, 0.06, 'lowpass', 900, 300); },
    boom(r) {
      if (!ac || throttle('boom', r > 20 ? 30 : 90)) return;
      const big = Math.min(1, r / 30);
      noise(0.35 + big * 1.6, 0.35 + big * 0.5, 'lowpass', 1600 + big * 2000, 60, 0.8);
      tone(110 - big * 60, 0.3 + big * 0.9, 'sine', 0.5 + big * 0.3, 0, 30);
      if (r >= 40) { noise(3, 0.5, 'lowpass', 500, 40, 0.5, 0.05); tone(45, 2.5, 'sawtooth', 0.15, 0.02, 25); }
    },
    zap() {
      if (!ac || throttle('zap', 120)) return;
      for (let k = 0; k < 4; k++) tone(800 + Math.random() * 1400, 0.05, 'square', 0.05, k * 0.03);
      noise(0.25, 0.18, 'highpass', 3000, 0, 1);
    },
    thunder() { if (!ac || throttle('thunder', 300)) return; noise(1.4, 0.45, 'lowpass', 900, 50); noise(0.15, 0.3, 'highpass', 4000); },
    sizzle() { if (!ac || throttle('sizzle', 260)) return; noise(0.35, 0.07, 'highpass', 5000, 7000, 1); },
    firework() {
      if (!ac || throttle('fw', 80)) return;
      noise(0.5, 0.25, 'lowpass', 2500, 200);
      for (let k = 0; k < 6; k++) noise(0.05, 0.06, 'highpass', 6000, 0, 1, 0.12 + Math.random() * 0.5);
    },
    launch() { if (!ac || throttle('launch', 150)) return; noise(0.4, 0.08, 'bandpass', 800, 4000, 3); },
    click() { if (!ac) return; tone(900, 0.04, 'triangle', 0.08); },
    tab() { if (!ac) return; tone(620, 0.05, 'sine', 0.08, 0, 820); },
    discover() {
      if (!ac) return;
      [523, 659, 784, 1047, 1319].forEach((f, k) => { tone(f, 0.35, 'triangle', 0.13, k * 0.07); tone(f * 2, 0.2, 'sine', 0.04, k * 0.07); });
    },
    mission() { if (!ac) return; [784, 988, 1175].forEach((f, k) => tone(f, 0.25, 'square', 0.05, k * 0.09)); tone(1568, 0.5, 'triangle', 0.1, 0.27); },
    levelup() {
      if (!ac) return;
      [392, 523, 659, 784, 659, 784, 1047].forEach((f, k) => { tone(f, 0.3, 'square', 0.06, k * 0.09); tone(f / 2, 0.3, 'triangle', 0.08, k * 0.09); });
      noise(1.2, 0.08, 'highpass', 8000, 0, 1, 0.6);
    },
    denied() { if (!ac) return; tone(220, 0.12, 'square', 0.06, 0, 160); },
    combo(n) { if (!ac || throttle('combo', 100)) return; tone(400 + Math.min(n, 30) * 40, 0.08, 'triangle', 0.08); },
    setSfx(v) { sfxVol = v; apply(); },
    setMusic(v) { musicVol = v; apply(); },
    setMuted(m) { muted = m; apply(); },
    setAdMuted(m) { adMuted = m; apply(); },
    get muted() { return muted; },
    get ctx() { return ac; },
    get musicBus() { return musicBus; },
  };
  return api;
})();

/* Gentle generative lo-fi: pentatonic plucks over a slow pad. */
const Music = (() => {
  let started = false, timer = null, step = 0, nextT = 0;
  const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
  const chords = [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 7]];
  let chord = 0;
  const root = 220 * Math.pow(2, 3 / 12); // C3-ish
  const hz = st => root * Math.pow(2, st / 12);

  function pluck(f, t, vol, dur) {
    const ac = Sfx.ctx, bus = Sfx.musicBus;
    const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.value = 1800;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function pad(notes, t, dur) {
    const ac = Sfx.ctx, bus = Sfx.musicBus;
    notes.forEach(n => {
      const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = hz(n - 12); o.detune.value = (Math.random() - 0.5) * 14;
      lp.type = 'lowpass'; lp.frequency.value = 520;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.022, t + dur * 0.3);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(lp); lp.connect(g); g.connect(bus);
      o.start(t); o.stop(t + dur + 0.1);
    });
  }
  function schedule() {
    const ac = Sfx.ctx;
    if (!ac) return;
    const spb = 0.28;
    while (nextT < ac.currentTime + 0.6) {
      if (step % 16 === 0) { chord = (chord + (Math.random() < 0.7 ? 1 : 2)) % chords.length; pad(chords[chord], nextT, spb * 16.5); }
      if (Math.random() < (step % 2 === 0 ? 0.55 : 0.22)) {
        const n = scale[(Math.random() * scale.length) | 0] + chords[chord][0];
        pluck(hz(n + 12), nextT, 0.05 + Math.random() * 0.03, 0.9);
      }
      if (step % 8 === 0) pluck(hz(chords[chord][0] - 12), nextT, 0.07, 1.6);
      nextT += spb; step++;
    }
  }
  return {
    start() {
      if (started || !Sfx.ctx) return;
      started = true; nextT = Sfx.ctx.currentTime + 0.3;
      timer = setInterval(schedule, 150);
    },
  };
})();
