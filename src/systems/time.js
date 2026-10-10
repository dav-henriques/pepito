/* ==========================================================================
   CICLO DE TEMPO — manhã / tarde / noite
   Não muda o visual (o fundo é branco): só o comportamento. À noite ele
   fica mais sonolento, cochila mais e acorda menos.
   Teste rápido: ?hora=22 na URL.
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  let phase = null;
  let override = null;      // hora fixa via ?hora=

  const time = {
    init() {
      const p = U.param('hora') ?? U.param('hour');
      if (p !== null && !isNaN(parseFloat(p))) override = parseFloat(p);
      this.apply();
      setInterval(() => this.apply(), 20000);
    },

    /** Hora atual do jogo (0–24, fracionada) */
    hour() {
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

    /** 0 = dia claro, 1 = madrugada (rampa suave no entardecer e no amanhecer) */
    nightness() {
      const h = this.hour();
      const c = G.config.time;
      if (h >= c.nightStart + 1.5 || h < c.morningStart - 0.5) return 1;
      if (h >= c.nightStart) return U.clamp((h - c.nightStart) / 1.5, 0, 1);
      if (h < c.morningStart + 1) return U.clamp((c.morningStart + 1 - h) / 1.5, 0, 1);
      return 0;
    },

    /** Quanto o momento "dá sono" (0–1) */
    sleepiness() { return U.clamp(this.nightness() * 0.9, 0, 1); },

    apply() {
      const ph = this.phaseOf(this.hour());
      document.getElementById('room').dataset.phase = ph;
      if (ph !== phase) {
        const prev = phase;
        phase = ph;
        G.bus.emit('time:phase', { phase, prev });
      }
    }
  };

  G.time = time;
})(window.Game = window.Game || {});
