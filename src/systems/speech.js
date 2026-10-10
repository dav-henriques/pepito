/* ==========================================================================
   FALAS — o pet "fala" as frases de personal.js → speech.lines
   --------------------------------------------------------------------------
   Nunca fala sem parar: cada fala respeita uma chance e um intervalo
   mínimo. Os momentos (hungry, thrown, petting…) vêm dos eventos do jogo.
   Para falar algo de outro sistema:  G.speech.say('idle')  ou
                                      G.speech.maybe('hungry', 0.5)
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  let lastAt = 0;
  const lastLine = {};

  const S = () => (G.personal && G.personal.speech) || { lines: {} };

  function pickLine(context) {
    const list = (S().lines || {})[context];
    if (!list || !list.length) return null;
    if (list.length === 1) return list[0];
    let line;
    for (let i = 0; i < 4; i++) {          // evita repetir a última
      line = U.pick(list);
      if (line !== lastLine[context]) break;
    }
    lastLine[context] = line;
    return line;
  }

  function canTalk() {
    const ps = G.petState;
    return !(ps.activity === 'sleeping' || ps.physical === 'beingDragged');
  }

  const speech = {
    init() {
      const b = G.bus;
      b.on('state:condition', ({ condition }) => {
        if (condition === 'hungry' || condition === 'veryHungry') setTimeout(() => this.maybe('hungry'), 900);
        else if (condition === 'tired') setTimeout(() => this.maybe('sleepy'), 900);
        else if (condition === 'dirty' || condition === 'veryDirty') setTimeout(() => this.maybe('dirty'), 900);
      });
      b.on('pet:pettingLong', () => setTimeout(() => this.maybe('petting', 0.7), 1700));
      b.on('physics:settled', (e) => {
        if (e.kind === 'throw' && e.impact > 900) setTimeout(() => this.maybe('thrown', 0.6), 700);
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

    /** Fala uma frase do momento (respeita só o intervalo mínimo) */
    say(context, opts = {}) {
      if (!opts.force && (!canTalk() || Date.now() - lastAt < (S().cooldown ?? 22000) * 0.5)) return false;
      const line = typeof opts.text === 'string' ? opts.text : pickLine(context);
      if (!line) return false;
      lastAt = Date.now();
      G.bubble.say(line, opts);
      G.bus.emit('speech:say', { context, line });
      return true;
    },

    /** Talvez fale (chance + intervalo mínimo) */
    maybe(context, chance) {
      const p = chance ?? S().chance ?? 0.4;
      if (Date.now() - lastAt < (S().cooldown ?? 22000)) return false;
      if (Math.random() > p) return false;
      return this.say(context);
    },

    /** Só a frase, sem mostrar (para outros sistemas) */
    line: pickLine
  };

  G.speech = speech;
})(window.Game = window.Game || {});
