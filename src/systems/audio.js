/* ==========================================================================
   SOM
   --------------------------------------------------------------------------
   • Efeitos sintetizados com WebAudio (funcionam sem nenhum arquivo).
     G.audio.play('boing', { intensity: .8 })
   • Arquivos opcionais substituem os sintetizados (assets.js → sfx).
     Ex.: coloque assets/sounds/meow.mp3 e todos os miados viram o seu.
   • Volume geral e mute (salvos no save). Nada toca antes de um toque.
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  let ctx = null, master = null, sfxBus = null, noiseBuf = null;
  let enabled = true;
  let purrNode = null;
  let userVol = 1;          // 0–1 (controle do jogador)

  const A = () => G.config.audio;
  const masterLevel = () => (enabled ? A().volume * userVol : 0);

  function ensure() {
    if (!enabled) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = masterLevel();
      master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.connect(master);
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
    o.connect(g); out.connect(sfxBus);
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
    src.connect(f); f.connect(g); g.connect(sfxBus);
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
    squish: (o) => { tone(260 * (o.pitch || 1), 140, 0.16, 'sine', 0.22, { mid: 420, midAt: 0.25 }); noise(0.1, 'lowpass', 900, 300, 0.06); },
    shutter: () => { noise(0.03, 'highpass', 3000, 5000, 0.18); noise(0.05, 'bandpass', 1800, 1200, 0.14, { delay: 0.07, Q: 2 }); tone(5200, 4800, 0.04, 'square', 0.02, { delay: 0.02 }); },
    tada: () => { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, f, 0.32 + i * 0.05, 'triangle', 0.1, { delay: i * 0.07 })); },
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

  /* ======================================================================
     ARQUIVOS DE ÁUDIO (opcionais)
     ====================================================================== */
  const probeCache = new Map();     // src → Promise<boolean>
  const sfxFiles = {};              // nome → [src que existem]
  const buffers = new Map();        // src → 'loading' | AudioBuffer | false
  const voiceBusy = {};             // nome → até quando está tocando
  const lastAt = {};
  let filesPrepared = false;

  /** O arquivo existe? (HEAD no servidor; em file:// testa com <audio>) */
  function probe(src) {
    if (!src) return Promise.resolve(false);
    if (!probeCache.has(src)) {
      probeCache.set(src, (async () => {
        if (G.media.isHttp) {
          try {
            const r = await fetch(src, { method: 'HEAD', cache: 'no-cache' });
            if (r.ok) return true;
            if (r.status !== 405 && r.status !== 501) return false;
          } catch (e) { /* tenta com <audio> */ }
        }
        return new Promise((res) => {
          const a = new Audio();
          let done = false;
          const fin = (v) => { if (done) return; done = true; res(v); };
          a.preload = 'metadata';
          a.addEventListener('loadedmetadata', () => fin(true), { once: true });
          a.addEventListener('error', () => fin(false), { once: true });
          setTimeout(() => fin(false), 6000);
          a.src = src;
        });
      })());
    }
    return probeCache.get(src);
  }

  function loadBuffer(src) {
    if (buffers.has(src) || !ctx) return;
    buffers.set(src, 'loading');
    fetch(src)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
      .then((b) => buffers.set(src, b))
      .catch(() => buffers.set(src, false));
  }

  /** Na primeira interação: descobre quais arquivos existem e pré-carrega */
  async function prepareFiles() {
    if (filesPrepared) return;
    filesPrepared = true;
    const S = G.assets.sfx || {};
    for (const name in S) {
      const ok = [];
      for (const src of G.assetList(S[name])) if (await probe(src)) ok.push(src);
      if (ok.length) {
        sfxFiles[name] = ok;
        if (G.media.isHttp && ctx) ok.forEach(loadBuffer);
      }
    }
  }

  /** Toca a versão em arquivo de um efeito. false = não tem arquivo (usa o sintetizado) */
  function playFile(name, o) {
    const list = sfxFiles[name];
    if (!list) return false;
    const now = U.now();
    if (voiceBusy[name] && now < voiceBusy[name]) return true;      // não empilha o mesmo som
    const src = U.pick(list);
    const rate = U.clamp((o.pitch || 1) * (o.short ? 1.1 : 1), 0.5, 2);
    const vol = U.clamp(o.v ?? o.intensity ?? 1, 0.05, 1.4);
    if (G.media.isHttp && ctx) {
      const buf = buffers.get(src);
      if (!buf || buf === 'loading') { loadBuffer(src); return false; }   // ainda carregando → sintetizado
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.playbackRate.value = rate;
      const g = ctx.createGain();
      g.gain.value = vol;
      s.connect(g); g.connect(sfxBus);
      s.start();
      voiceBusy[name] = now + (buf.duration / rate) * 850;
      return true;
    }
    const a = new Audio(src);
    a.volume = U.clamp(vol * masterLevel(), 0, 1);
    a.preservesPitch = false; a.mozPreservesPitch = false; a.webkitPreservesPitch = false;
    a.playbackRate = rate;
    a.play().catch(() => {});
    voiceBusy[name] = now + 500;
    return true;
  }

  G.audio = {
    init() {
      const settings = { sound: G.config.audio.enabledByDefault, volume: 1 };
      G.save.register('settings', {
        get: () => ({ sound: enabled, volume: userVol }),
        set: (d) => {
          if (!d) return;
          if (typeof d.sound === 'boolean') settings.sound = d.sound;
          if (typeof d.volume === 'number') settings.volume = U.clamp(d.volume, 0, 1);
        }
      });
      enabled = settings.sound;
      userVol = settings.volume;
      // Navegadores só liberam áudio após um gesto do usuário
      const unlock = () => { if (enabled) ensure(); prepareFiles(); };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock);
    },

    play(name, opts = {}) {
      if (!enabled) return;
      const now = U.now();
      if (lastAt[name] && now - lastAt[name] < 45) return;   // evita rajadas do mesmo som
      lastAt[name] = now;
      try {
        if (ensure() && playFile(name, opts)) return;
        const fn = SFX[name];
        if (fn && ctx) fn(opts);
      } catch (e) { /* áudio nunca deve quebrar o jogo */ }
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
      if (!enabled) this.purr(false);
      else ensure();
      if (master) master.gain.value = masterLevel();
      G.bus.emit('audio:toggle', enabled);
      G.save.soon();
    },

    /** Volume geral (0–1) */
    setVolume(v) {
      userVol = U.clamp(+v || 0, 0, 1);
      if (master) master.gain.value = masterLevel();
      G.bus.emit('audio:volume', this.levels);
      G.save.soon();
    },
    get levels() { return { volume: userVol }; },

    /** Existe um arquivo nesse caminho? */
    probe,

    get enabled() { return enabled; }
  };
})(window.Game = window.Game || {});
