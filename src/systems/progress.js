/* ==========================================================================
   PROGRESSO — amizade (XP/nível) e estatísticas
   ========================================================================== */
(function (G) {
  'use strict';

  const state = { xp: 0, stats: {}, firstSeen: Date.now() };

  G.progress = {
    init() {
      G.save.register('progress', {
        get: () => ({ ...state, stats: { ...state.stats } }),
        set: (d) => {
          if (!d) return;
          state.xp = +d.xp || 0;
          state.stats = d.stats || {};
          state.firstSeen = d.firstSeen || Date.now();
        }
      });
    },

    get xp() { return state.xp; },
    get stats() { return state.stats; },
    get firstSeen() { return state.firstSeen; },

    level() {
      const L = G.config.progress.levels;
      let lv = 0;
      for (let i = 0; i < L.length; i++) if (state.xp >= L[i]) lv = i;
      return lv;
    },

    maxLevel() { return G.config.progress.levels.length - 1; },

    /** 0–1 até o próximo nível */
    levelProgress() {
      const L = G.config.progress.levels;
      const lv = this.level();
      if (lv >= L.length - 1) return 1;
      return (state.xp - L[lv]) / (L[lv + 1] - L[lv]);
    },

    addXp(n, reason) {
      if (!n) return;
      const before = this.level();
      state.xp += n;
      const after = this.level();
      G.bus.emit('progress:xp', { xp: state.xp, reason });
      if (after > before) G.bus.emit('progress:level', { level: after });
      G.save.soon();
    },

    count(stat, n = 1) {
      state.stats[stat] = (state.stats[stat] || 0) + n;
      G.save.soon(3000);
      return state.stats[stat];
    }
  };
})(window.Game = window.Game || {});
