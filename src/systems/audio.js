/* ==========================================================================
   SOM — tudo sintetizado com WebAudio (zero arquivos de áudio).
   G.audio.play('boing', { intensity: .8 })
   Músicas do rádio: G.audio.music.start('lofi' | 'chip')
   Para usar arquivos reais no futuro, troque a implementação de play().
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  let enabled = true;
  let purrNode = null;

  function ensure() {
    if (!enabled) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = G.config.audio.volume;
      master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = G.config.audio.musicVolume; musicBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* ---------- blocos básicos ---------- */
  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  function tone(f0, f1, dur, type = 'sine', peak = 0.3, opts = {}) {
    const c = ensure(); if (!c) return;
    const t = c.currentTime + (opts.delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (opts.mid) {
      o.frequency.exponentialRampToValueAtTime(opts.mid, t + dur * (opts.midAt || 0.35));
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    } else o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, opts.attack || 0.006, peak, dur);
    let out = g;
    if (opts.filter) {
      const f = c.createBiquadFilter();
      f.type = opts.filter.type || 'lowpass';
      f.frequency.value = opts.filter.freq || 1200;
      f.Q.value = opts.filter.Q || 1;
      g.connect(f); out = f;
    }
    o.connect(g); out.connect(opts.bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, filterType, f0, f1, peak = 0.25, opts = {}) {
    const c = ensure(); if (!c) return;
    const t = c.currentTime + (opts.delay || 0);
    const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = filterType; f.Q.value = opts.Q || 1;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); env(g, t, opts.attack || 0.005, peak, dur);
    src.connect(f); f.connect(g); g.connect(opts.bus || sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  /* ---------- receitas ---------- */
  const SFX = {
    pop: (o) => tone(480, 1100, 0.09, 'sine', 0.3 * (o.v ?? 1)),
    tap: () => tone(760, 980, 0.05, 'triangle', 0.16),
    click: () => tone(1300, 1100, 0.03, 'square', 0.05),
    boing: (o) => { const k = o.intensity ?? 1; tone(170 * (o.pitch || 1), 300 * (o.pitch || 1), 0.32, 'sine', 0.32 * k, { mid: 460 * (o.pitch || 1), midAt: 0.3 }); },
    land: (o) => { const k = U.clamp(o.intensity ?? 1, 0.2, 1.4); tone(150, 55, 0.13, 'sine', 0.42 * k); noise(0.07, 'lowpass', 900, 300, 0.12 * k); },
    thud: (o) => { const k = U.clamp(o.intensity ?? 1, 0.3, 1.4); tone(120, 42, 0.17, 'sine', 0.55 * k); noise(0.06, 'lowpass', 1200, 300, 0.2 * k); },
    whoosh: (o) => noise(0.28, 'bandpass', 380, 2200, 0.16 * (o.intensity ?? 1), { Q: 1.4, attack: 0.06 }),
    squeak: (o) => tone(1250 * (o.pitch || 1), 1500 * (o.pitch || 1), 0.13, 'square', 0.06, { mid: 1900 * (o.pitch || 1), filter: { type: 'bandpass', freq: 1900, Q: 3 } }),
    munch: () => { noise(0.05, 'bandpass', 1400, 900, 0.22, { Q: 2 }); noise(0.05, 'bandpass', 1200, 800, 0.18, { Q: 2, delay: 0.09 }); },
    bubble: () => tone(320, 1300, 0.08, 'sine', 0.16),
    splash: (o) => { const k = o.intensity ?? 1; noise(0.5, 'bandpass', 1800, 420, 0.32 * k, { Q: 0.8 }); for (let i = 0; i < 3; i++) tone(300 + i * 120, 1200, 0.07, 'sine', 0.08, { delay: 0.12 + i * 0.07 }); },
    water: () => noise(0.35, 'bandpass', 2600, 1600, 0.1, { Q: 0.7, attack: 0.04 }),
    scrub: () => noise(0.09, 'bandpass', U.rand(2200, 3200), U.rand(1600, 2400), 0.07, { Q: 2 }),
    sparkle: () => { [1318.5, 1760, 2093].forEach((f, i) => tone(f, f * 1.01, 0.28, 'sine', 0.09, { delay: i * 0.06 })); },
    chime: () => { [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone(f, f, 0.5, 'triangle', 0.11, { delay: i * 0.085 })); },
    pour: () => { for (let i = 0; i < 7; i++) tone(U.rand(1500, 2600), U.rand(900, 1400), 0.03, 'square', 0.03, { delay: i * 0.045 + U.rand(0, 0.02) }); },
    hiss: () => noise(0.32, 'highpass', 3200, 5200, 0.12, { attack: 0.03 }),
    yawn: () => tone(430, 230, 0.75, 'sine', 0.13, { mid: 520, midAt: 0.25, attack: 0.12, filter: { type: 'lowpass', freq: 900 } }),
    snore: () => noise(0.9, 'lowpass', 260, 420, 0.07, { attack: 0.35 }),
    tick: () => tone(2400, 2200, 0.02, 'square', 0.03),
    radio: () => noise(0.18, 'bandpass', 1500, 3000, 0.08, { Q: 0.6 }),
    zap: () => tone(1800, 600, 0.12, 'sawtooth', 0.04, { filter: { type: 'lowpass', freq: 3000 } }),
    meow(o) {
      const c = ensure(); if (!c) return;
      const p = (o.pitch || 1) * U.rand(0.94, 1.08);
      const t = c.currentTime, dur = o.short ? 0.28 : U.rand(0.42, 0.55);
      const osc = c.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(480 * p, t);
      osc.frequency.exponentialRampToValueAtTime(780 * p, t + dur * 0.32);
      osc.frequency.exponentialRampToValueAtTime(560 * p, t + dur);
      const vib = c.createOscillator(), vibG = c.createGain();
      vib.frequency.value = 7; vibG.gain.value = 9; vib.connect(vibG); vibG.connect(osc.frequency);
      const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 4;
      f1.frequency.setValueAtTime(800, t); f1.frequency.linearRampToValueAtTime(1600, t + dur * 0.35); f1.frequency.linearRampToValueAtTime(1000, t + dur);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
      const g = c.createGain(); env(g, t, 0.05, 0.22, dur);
      osc.connect(f1); f1.connect(lp); lp.connect(g); g.connect(sfxBus);
      osc.start(t); vib.start(t); osc.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
    }
  };

  /* ---------- música do rádio (gerativa) ---------- */
  const STATIONS = {
    lofi: {
      bpm: 76, swing: 0.12,
      chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
      scale: [60, 62, 64, 67, 69, 72, 74, 76],
      pad: 'triangle', lead: 'sine', drums: true
    },
    chip: {
      bpm: 128, swing: 0,
      chords: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 60], [55, 59, 62, 67]],
      scale: [69, 72, 74, 76, 79, 81, 84],
      pad: 'square', lead: 'square', drums: true, arp: true
    }
  };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  const music = {
    station: null, timer: 0, step: 0, nextTime: 0,

    start(name) {
      const c = ensure(); if (!c) { this.station = name; return; }
      this.stop(true);
      this.station = name;
      this.step = 0;
      this.nextTime = c.currentTime + 0.1;
      musicBus.gain.cancelScheduledValues(c.currentTime);
      musicBus.gain.setValueAtTime(0.0001, c.currentTime);
      musicBus.gain.exponentialRampToValueAtTime(G.config.audio.musicVolume, c.currentTime + 0.6);
      this.timer = setInterval(() => this.schedule(), 30);
    },

    stop(instant) {
      clearInterval(this.timer); this.timer = 0;
      this.station = null;
      if (ctx && musicBus && !instant) {
        musicBus.gain.cancelScheduledValues(ctx.currentTime);
        musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime);
        musicBus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
      }
    },

    schedule() {
      if (!ctx || !this.station) return;
      const S = STATIONS[this.station];
      const sixteenth = 60 / S.bpm / 4;
      while (this.nextTime < ctx.currentTime + 0.15) {
        const st = this.step % 64;
        const swingOffset = (st % 2 === 1) ? sixteenth * S.swing : 0;
        this.playStep(S, st, this.nextTime + swingOffset, sixteenth);
        this.nextTime += sixteenth;
        this.step++;
      }
    },

    playStep(S, st, t, sx) {
      const bar = Math.floor(st / 16), beatPos = st % 16;
      const chord = S.chords[bar % S.chords.length];
      const B = musicBus;
      const delay = Math.max(0, t - ctx.currentTime);
      if (beatPos % 4 === 0) {
        const beat = beatPos / 4;
        setTimeout(() => G.bus.emit('music:beat', { beat, station: this.station }), delay * 1000);
      }
      if (beatPos === 0) {
        chord.forEach((m) => tone(mtof(m), mtof(m), sx * 15, S.pad, S.arp ? 0.025 : 0.045, { delay, attack: 0.08, filter: { type: 'lowpass', freq: S.arp ? 1800 : 900 }, bus: B }));
      }
      if (beatPos === 0 || beatPos === 8 || (S.arp && beatPos % 4 === 0)) {
        tone(mtof(chord[0] - 12), mtof(chord[0] - 12), sx * 3.5, 'sine', 0.16, { delay, attack: 0.01, bus: B });
      }
      if (S.arp && beatPos % 2 === 0) {
        const m = chord[(beatPos / 2) % chord.length] + 12;
        tone(mtof(m), mtof(m), sx * 1.5, 'square', 0.025, { delay, filter: { type: 'lowpass', freq: 2400 }, bus: B });
      }
      if (S.drums) {
        if (beatPos === 0 || beatPos === 10) tone(120, 40, 0.18, 'sine', 0.28, { delay, bus: B });
        if (beatPos === 4 || beatPos === 12) noise(0.12, 'bandpass', 1900, 1200, 0.07, { delay, Q: 0.8, bus: B });
        if (beatPos % 2 === 0) noise(0.03, 'highpass', 7500, 9000, 0.025, { delay, bus: B });
      }
      if (!S.arp && (beatPos === 6 || beatPos === 14 || beatPos === 3) && Math.random() < 0.55) {
        const m = U.pick(S.scale);
        tone(mtof(m), mtof(m), sx * 3, S.lead, 0.05, { delay, attack: 0.02, filter: { type: 'lowpass', freq: 2200 }, bus: B });
      }
    }
  };

  G.audio = {
    init() {
      const settings = { sound: G.config.audio.enabledByDefault };
      G.save.register('settings', {
        get: () => ({ sound: enabled }),
        set: (d) => { if (d && typeof d.sound === 'boolean') settings.sound = d.sound; }
      });
      enabled = settings.sound;
      // Navegadores só liberam áudio após um gesto do usuário
      const unlock = () => { if (enabled) ensure(); };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock);
    },

    play(name, opts = {}) {
      if (!enabled) return;
      const fn = SFX[name];
      if (!fn) return;
      try { if (ensure()) fn(opts); } catch (e) { /* áudio nunca deve quebrar o jogo */ }
    },

    purr(on) {
      if (!enabled && on) return;
      const c = on ? ensure() : ctx;
      if (!c) return;
      if (on && !purrNode) {
        const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240;
        const g = c.createGain(); g.gain.value = 0;
        const am = c.createGain(); am.gain.value = 0.5;
        const lfo = c.createOscillator(); lfo.frequency.value = 23;
        const lfoG = c.createGain(); lfoG.gain.value = 0.5;
        lfo.connect(lfoG); lfoG.connect(am.gain);
        src.connect(lp); lp.connect(am); am.connect(g); g.connect(sfxBus);
        g.gain.linearRampToValueAtTime(0.5, c.currentTime + 0.4);
        src.start(); lfo.start();
        purrNode = { src, lfo, g };
      } else if (!on && purrNode) {
        const n = purrNode; purrNode = null;
        n.g.gain.cancelScheduledValues(c.currentTime);
        n.g.gain.setValueAtTime(n.g.gain.value, c.currentTime);
        n.g.gain.linearRampToValueAtTime(0, c.currentTime + 0.3);
        setTimeout(() => { try { n.src.stop(); n.lfo.stop(); } catch (e) { /* ok */ } }, 400);
      }
    },

    setEnabled(v) {
      enabled = !!v;
      if (!enabled) {
        this.purr(false);
        if (ctx) master.gain.value = 0;
      } else {
        ensure();
        if (master) master.gain.value = G.config.audio.volume;
        if (music.station) music.start(music.station);
      }
      G.bus.emit('audio:toggle', enabled);
      G.save.soon();
    },

    get enabled() { return enabled; },
    music
  };
})(window.Game = window.Game || {});
