/* ==========================================================================
   EXPRESSÕES — o pet não fala: se expressa com símbolos (balõezinhos de
   ícone: z, ♥, ♪, !, ?, gota, comidinha, estrelinhas…)
   --------------------------------------------------------------------------
   Cada momento do jogo tem uma lista de símbolos; o jogo sorteia um.
   Os símbolos disponíveis estão em src/components/bubble.js → PRESETS.
   Para expressar algo de outro sistema:  G.express.say('hello')  ou
                                          G.express.maybe('hungry', 0.5)
   Nunca exagera: cada expressão respeita uma chance e um intervalo mínimo.
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  // momento → símbolos possíveis
  const MOMENTS = {
    hello:        ['love', 'notes', '!'],
    idle:         ['notes', 'note', 'sparkle', 'dots'],   // cantarolando à toa
    hungry:       ['food'],
    sleepy:       ['z'],
    dirty:        ['drop'],
    petting:      ['love'],
    thrown:       ['!!', 'stars'],
    dizzy:        ['stars'],
    eating:       ['note'],
    favoriteFood: ['love', 'sparkle'],
    clean:        ['sparkle'],
    wakeUp:       ['sparkle', 'note'],
    staring:      ['dots', '?'],
    sillyPose:    ['star', 'sparkle'],
    ignoreToy:    ['dots'],
    plushie:      ['love', '?', 'note'],
    annoyed:      ['anger'],
    startled:     ['!!'],
    night:        ['moon']
  };
  const COOLDOWN = 9000;     // ms mínimos entre expressões "espontâneas" (maybe)
  const CHANCE = 0.55;

  let lastAt = 0;
  const last = {};

  function pick(context) {
    const list = MOMENTS[context];
    if (!list || !list.length) return null;
    let k = U.pick(list);
    if (list.length > 1 && k === last[context]) k = U.pick(list);   // evita repetir
    last[context] = k;
    return k;
  }

  function canShow() {
    const ps = G.petState;
    return !(ps.physical === 'beingDragged');
  }

  const express = {
    init() {
      const b = G.bus;
      b.on('state:condition', ({ condition }) => {
        if (condition === 'hungry' || condition === 'veryHungry') setTimeout(() => this.maybe('hungry', 0.8), 900);
        else if (condition === 'tired') setTimeout(() => this.maybe('sleepy', 0.8), 900);
        else if (condition === 'dirty' || condition === 'veryDirty') setTimeout(() => this.maybe('dirty', 0.8), 900);
      });
      b.on('pet:pettingLong', () => setTimeout(() => this.maybe('petting', 0.7), 1700));
      b.on('physics:settled', (e) => {
        if (e.kind === 'throw' && e.impact > 900) setTimeout(() => this.maybe('thrown', 0.6), 500);
      });
      b.on('state:emotion', (name) => { if (name === 'dizzy') setTimeout(() => this.maybe('dizzy', 0.6), 1500); });
      b.on('food:eaten', ({ food }) => {
        const fav = G.config.foods[food] && G.config.foods[food].favorite;
        setTimeout(() => (fav ? this.say('favoriteFood') : this.maybe('eating', 0.35)), 900);
      });
      b.on('bath:done', () => setTimeout(() => this.maybe('clean', 0.6), 1600));
      b.on('behavior:wake', ({ grumpy }) => setTimeout(() => this.maybe(grumpy ? 'annoyed' : 'wakeUp', 0.6), 1800));
      b.on('time:phase', ({ phase, prev }) => { if (prev && phase === 'night') setTimeout(() => this.maybe('night', 0.7), 2200); });
    },

    /** Mostra um símbolo do momento (respeita só metade do intervalo mínimo) */
    say(context, opts = {}) {
      if (!opts.force && (!canShow() || Date.now() - lastAt < COOLDOWN * 0.5)) return false;
      const kind = pick(context);
      if (!kind) return false;
      lastAt = Date.now();
      G.bubble.show(kind, { duration: opts.duration ?? 1500 });
      G.bus.emit('express', { context, kind });
      return true;
    },

    /** Talvez se expresse (chance + intervalo mínimo) */
    maybe(context, chance) {
      if (Date.now() - lastAt < COOLDOWN) return false;
      if (Math.random() > (chance ?? CHANCE)) return false;
      return this.say(context);
    },

    moments: MOMENTS
  };

  G.express = express;
})(window.Game = window.Game || {});
