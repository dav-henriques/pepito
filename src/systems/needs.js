/* ==========================================================================
   NECESSIDADES — hunger, happiness, energy, cleanliness (0–100)
   Valores numéricos internos; o jogador vê o COMPORTAMENTO, não os números.
   Para adicionar uma necessidade nova: inclua em needs.initial / decayPerHour
   no petConfig e (opcional) um anel no HUD.
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  const values = {};
  let lastTick = Date.now();
  let changeQueued = false;

  function cfg() { return G.config.needs; }

  function emitChange() {
    if (changeQueued) return;
    changeQueued = true;
    requestAnimationFrame(() => {
      changeQueued = false;
      G.bus.emit('needs:change', { ...values });
    });
  }

  const needs = {
    keys: [],

    init() {
      Object.assign(values, cfg().initial);
      this.keys = Object.keys(values);
      G.save.register('needs', {
        get: () => ({ ...values }),
        set: (d) => { for (const k of this.keys) if (typeof d?.[k] === 'number') values[k] = U.clamp(d[k], 0, 100); }
      });
      setInterval(() => this.tick(), 1000);
    },

    get(k) { return values[k]; },
    all() { return { ...values }; },

    set(k, v) {
      values[k] = U.clamp(v, 0, 100);
      emitChange();
    },

    /** Soma deltas: needs.add({ hunger: +30, happiness: +5 }) */
    add(delta, reason) {
      for (const k in delta) {
        if (!(k in values)) continue;
        values[k] = U.clamp(values[k] + delta[k], 0, 100);
      }
      emitChange();
      G.bus.emit('needs:add', { delta, reason });
      G.save.soon();
    },

    /** 'ok' | 'low' | 'critical' */
    level(k) {
      const t = cfg().thresholds;
      const v = values[k];
      const map = { hunger: ['hungry', 'veryHungry'], cleanliness: ['dirty', 'veryDirty'], energy: ['tired', 'exhausted'], happiness: ['sad', 'sad'] };
      const [low, crit] = map[k] || [];
      if (crit && v < t[crit] && k !== 'happiness') return 'critical';
      if (low && v < t[low]) return 'low';
      return 'ok';
    },

    tick() {
      const now = Date.now();
      let dt = (now - lastTick) / 1000;
      lastTick = now;
      if (dt <= 0) return;
      // aba ficou muito tempo em segundo plano → trata como offline
      if (dt > 90) { this.applyOffline(dt * 1000); return; }
      dt = Math.min(dt, 5);

      const c = cfg();
      const h = dt / 3600;
      const sleeping = G.petState?.activity === 'sleeping';
      if (sleeping) {
        const s = c.sleepingPerHour;
        values.energy += s.energy * h;
        values.hunger += s.hunger * h;
        values.happiness += (s.happiness || 0) * h;
        values.cleanliness -= c.decayPerHour.cleanliness * 0.3 * h;
      } else {
        const d = c.decayPerHour;
        const nightMul = G.time?.isNight() ? c.nightEnergyMultiplier : 1;
        let sad = 1;
        if (values.hunger < c.thresholds.hungry) sad += c.sadnessFromHunger - 1;
        if (values.cleanliness < c.thresholds.dirty) sad += c.sadnessFromDirt - 1;
        values.hunger -= d.hunger * h;
        values.cleanliness -= d.cleanliness * h;
        values.energy -= d.energy * nightMul * h;
        values.happiness -= d.happiness * sad * h;
      }
      for (const k of this.keys) values[k] = U.clamp(values[k], 0, 100);
      emitChange();
    },

    /** Progresso enquanto o site esteve fechado (com limites gentis) */
    applyOffline(ms) {
      const o = G.config.offline;
      const d = cfg().decayPerHour;
      const hrs = Math.min(ms / 3600000, o.maxHours);
      if (hrs < 0.01) return { hours: 0 };
      const k = o.rateMultiplier;
      const drop = (key, loss) => {
        const floor = o.floors[key] ?? 0;
        const cur = values[key];
        values[key] = Math.min(cur, Math.max(floor, cur - loss));
      };
      drop('hunger', d.hunger * k * hrs);
      drop('cleanliness', d.cleanliness * k * hrs);
      drop('happiness', d.happiness * k * hrs);
      const e = values.energy + (o.restoreEnergyPerHour - d.energy * k * 0.4) * hrs;
      values.energy = U.clamp(Math.max(e, Math.min(values.energy, o.floors.energy)), 0, 100);
      lastTick = Date.now();
      emitChange();
      return { hours: hrs };
    }
  };

  G.needs = needs;
})(window.Game = window.Game || {});
