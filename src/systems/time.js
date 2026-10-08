/* ==========================================================================
   CICLO DE TEMPO — manhã / tarde / noite
   Interpola cores do céu e da luz do quarto por hora do dia (variáveis CSS).
   Transições grandes (ex.: "viagem no tempo") usam GSAP.
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  // hora → visual. Cores interpoladas suavemente entre os pontos.
  const KEYS = [
    { h: 0,    top: '#0f1b3a', bot: '#24345e', sun: 1.45, moon: 0.30, stars: 1,    tint: 0.46, warm: 0 },
    { h: 5,    top: '#1b2a52', bot: '#4a5a8a', sun: 1.35, moon: 0.55, stars: 0.8,  tint: 0.38, warm: 0 },
    { h: 6.5,  top: '#f2a882', bot: '#ffe0b5', sun: 0.85, moon: 1.25, stars: 0.08, tint: 0.12, warm: 0.10 },
    { h: 8,    top: '#8ccbe8', bot: '#d6eef5', sun: 0.48, moon: 1.4,  stars: 0,    tint: 0,    warm: 0.02 },
    { h: 12,   top: '#6fbde6', bot: '#cdeaf6', sun: 0.24, moon: 1.4,  stars: 0,    tint: 0,    warm: 0 },
    { h: 15.5, top: '#7fbfe0', bot: '#f0dcb4', sun: 0.42, moon: 1.4,  stars: 0,    tint: 0,    warm: 0.07 },
    { h: 18,   top: '#f0956a', bot: '#ffd39a', sun: 0.86, moon: 1.25, stars: 0.05, tint: 0.07, warm: 0.17 },
    { h: 19.5, top: '#4b4f86', bot: '#c27a7a', sun: 1.25, moon: 0.75, stars: 0.45, tint: 0.27, warm: 0.06 },
    { h: 21,   top: '#16234a', bot: '#2c3d6b', sun: 1.45, moon: 0.38, stars: 1,    tint: 0.42, warm: 0 },
    { h: 24,   top: '#0f1b3a', bot: '#24345e', sun: 1.45, moon: 0.30, stars: 1,    tint: 0.46, warm: 0 }
  ];

  let roomStyle = null;
  let phase = null;
  let override = null;      // hora fixa via ?hora=
  let warpHour = null;      // hora "virtual" durante a viagem no tempo
  let lampOn = true;
  let clockHands = null;

  function sample(h) {
    h = ((h % 24) + 24) % 24;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = U.clamp((h - a.h) / (b.h - a.h), 0, 1);
    const s = t * t * (3 - 2 * t); // smoothstep
    return {
      top: U.mixColor(a.top, b.top, s),
      bot: U.mixColor(a.bot, b.bot, s),
      sun: U.lerp(a.sun, b.sun, s),
      moon: U.lerp(a.moon, b.moon, s),
      stars: U.lerp(a.stars, b.stars, s),
      tint: U.lerp(a.tint, b.tint, s),
      warm: U.lerp(a.warm, b.warm, s)
    };
  }

  const time = {
    init() {
      roomStyle = document.getElementById('room').style;
      clockHands = { h: document.querySelector('.clock .hour'), m: document.querySelector('.clock .min') };
      const p = U.param('hora') ?? U.param('hour');
      if (p !== null && !isNaN(parseFloat(p))) override = parseFloat(p);
      G.save.register('lamp', { get: () => lampOn, set: (v) => { lampOn = v !== false; } });
      this.apply();
      setInterval(() => this.apply(), 20000);
    },

    /** Hora atual do jogo (0–24, fracionada) */
    hour() {
      if (warpHour !== null) return warpHour;
      if (override !== null) return override;
      const cfg = G.config.time;
      if (cfg.mode === 'cycle') {
        const t = (Date.now() / 60000) % cfg.cycleMinutes;
        return (t / cfg.cycleMinutes) * 24;
      }
      const d = new Date();
      return d.getHours() + d.getMinutes() / 60;
    },

    phaseOf(h) {
      const c = G.config.time;
      if (h >= c.morningStart && h < c.afternoonStart) return 'morning';
      if (h >= c.afternoonStart && h < c.nightStart) return 'afternoon';
      return 'night';
    },

    get phase() { return phase; },
    isNight() { return phase === 'night'; },

    /** 0 = dia claro, 1 = noite fechada */
    nightness() { return U.clamp(sample(this.hour()).tint / 0.46, 0, 1); },

    /** Quanto o ambiente "dá sono" (noite + luz apagada) */
    sleepiness() {
      const n = this.nightness();
      return U.clamp(n * (lampOn ? 0.75 : 1.15), 0, 1);
    },

    get lampOn() { return lampOn; },
    setLamp(on) {
      lampOn = !!on;
      this.apply();
      G.bus.emit('time:lamp', lampOn);
      G.save.soon();
    },

    apply() {
      const h = this.hour();
      const v = sample(h);
      const night = U.clamp(v.tint / 0.46, 0, 1);
      roomStyle.setProperty('--sky-top', v.top);
      roomStyle.setProperty('--sky-bottom', v.bot);
      roomStyle.setProperty('--sun-y', v.sun.toFixed(3));
      roomStyle.setProperty('--moon-y', v.moon.toFixed(3));
      roomStyle.setProperty('--stars', v.stars.toFixed(3));
      roomStyle.setProperty('--tint-a', Math.min(0.92, v.tint * (lampOn ? 1.45 : 1.95)).toFixed(3));
      roomStyle.setProperty('--warm-a', v.warm.toFixed(3));
      roomStyle.setProperty('--lamp', lampOn ? (0.15 + night * 0.85).toFixed(3) : '0');
      roomStyle.setProperty('--lamp-hole', lampOn ? (night * 52).toFixed(1) + '%' : '0%');
      document.getElementById('room').dataset.phase = this.phaseOf(h);

      if (clockHands.h) {
        clockHands.h.style.transform = `rotate(${(h % 12) * 30}deg)`;
        clockHands.m.style.transform = `rotate(${((h * 60) % 60) * 6}deg)`;
      }

      const ph = this.phaseOf(h);
      if (ph !== phase) {
        const prev = phase;
        phase = ph;
        G.bus.emit('time:phase', { phase, prev });
      }
    },

    /** "Viagem no tempo": passa o dia inteiro em alguns segundos (GSAP) */
    warp(seconds = 7) {
      if (warpHour !== null) return;
      const start = this.hour();
      const proxy = { h: start };
      warpHour = start;
      G.bus.emit('time:warp', true);
      gsap.to(proxy, {
        h: start + 24,
        duration: seconds,
        ease: 'power1.inOut',
        onUpdate: () => { warpHour = proxy.h % 24; this.apply(); },
        onComplete: () => { warpHour = null; this.apply(); G.bus.emit('time:warp', false); }
      });
    }
  };

  G.time = time;
})(window.Game = window.Game || {});
