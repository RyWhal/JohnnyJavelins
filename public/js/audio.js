// Tiny procedural sound effects with WebAudio. No asset files needed.
'use strict';

JJ.Audio = (() => {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let enabled = true;
  const last = {}; // rate limiting per sound

  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) {
      ctx = null;
    }
  }

  function resume() {
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function limited(name, gap) {
    const now = performance.now();
    if (last[name] && now - last[name] < gap) return true;
    last[name] = now;
    return false;
  }

  function tone(freq, dur, type = 'square', vol = 0.2, slide = 0, delay = 0) {
    if (!ctx || !enabled) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function noise(dur, freq, vol = 0.2, q = 1, type = 'bandpass') {
    if (!ctx || !enabled) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  const sfx = {
    throw() {
      if (limited('throw', 70)) return;
      noise(0.12, 1800, 0.12, 2, 'highpass');
    },
    hit() {
      if (limited('hit', 45)) return;
      tone(200 + Math.random() * 120, 0.05, 'square', 0.06, -80);
      noise(0.04, 2500 + Math.random() * 1500, 0.05, 3);
    },
    crit() {
      if (limited('crit', 70)) return;
      tone(900 + Math.random() * 200, 0.07, 'square', 0.07, 500);
      noise(0.06, 4000, 0.07, 4);
    },
    kill() {
      if (limited('kill', 55)) return;
      tone(140 + Math.random() * 60, 0.09, 'triangle', 0.11, -100);
      noise(0.07, 600 + Math.random() * 400, 0.06, 1.5);
    },
    bossDie() {
      noise(0.9, 180, 0.45, 0.6, 'lowpass');
      tone(220, 1.0, 'sawtooth', 0.2, -190);
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, 'square', 0.1, 0, 0.35 + i * 0.09));
    },
    combo(level) {
      const base = 392 * Math.pow(1.12, Math.min(level, 8));
      [1, 1.25, 1.5, 2].forEach((m, i) => tone(base * m, 0.16, 'square', 0.11, 0, i * 0.06));
      noise(0.3, 3000, 0.08, 1, 'highpass');
    },
    heartbeat() {
      tone(70, 0.12, 'sine', 0.35, -20);
      tone(62, 0.14, 'sine', 0.28, -20, 0.17);
    },
    boom() {
      if (limited('boom', 90)) return;
      noise(0.35, 300, 0.35, 0.7, 'lowpass');
    },
    zap() {
      if (limited('zap', 80)) return;
      tone(900, 0.08, 'sawtooth', 0.06, -600);
    },
    gem(chain = 0) {
      if (limited('gem', 35)) return;
      // Pitch climbs while gems are collected in quick succession.
      const f = 660 * Math.pow(1.059, Math.min(chain, 24));
      tone(f, 0.07, 'sine', 0.08);
      tone(f * 2, 0.05, 'sine', 0.03, 0, 0.02);
    },
    coin() {
      if (limited('coin', 60)) return;
      tone(1200, 0.05, 'square', 0.06);
      tone(1600, 0.08, 'square', 0.06, 0, 0.05);
    },
    hurt() {
      if (limited('hurt', 150)) return;
      tone(140, 0.2, 'sawtooth', 0.2, -90);
    },
    levelup() {
      noise(0.5, 1200, 0.18, 0.8, 'bandpass');
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, 'square', 0.12, 0, i * 0.06));
      tone(1568, 0.4, 'triangle', 0.08, 0, 0.32);
    },
    legendary() {
      [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, 'triangle', 0.15, 0, i * 0.08));
    },
    chest() {
      [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.18, 'triangle', 0.14, 0, i * 0.09));
    },
    heal() {
      tone(500, 0.2, 'sine', 0.12, 300);
    },
    boss() {
      tone(80, 1.0, 'sawtooth', 0.25, -30);
      tone(60, 1.2, 'square', 0.15, -20, 0.2);
    },
    shoot() {
      if (limited('eshoot', 120)) return;
      tone(400, 0.1, 'triangle', 0.05, -200);
    },
    click() {
      tone(700, 0.04, 'square', 0.06);
    },
    gameover() {
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.15, 0, i * 0.18));
    },
  };

  return {
    resume,
    sfx,
    setEnabled(v) {
      enabled = v;
    },
    get enabled() {
      return enabled;
    },
  };
})();
