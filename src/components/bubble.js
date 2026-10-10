/* ==========================================================================
   BALÃO DE EMOÇÃO (GSAP)
   Pequenos ícones sobre a cabeça do pet: ele não fala, se expressa com
   símbolos (z, ♥, ♪, !, ?…). Os momentos ficam em systems/expressions.js.
   G.bubble.show('!')  |  G.bubble.show('food', { thought: true })
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  // tipo → [ícones, classe de cor, é pensamento?]
  const PRESETS = {
    '!':      { icons: ['excl'], color: 'c-terra' },
    '!!':     { icons: ['excl', 'excl'], color: 'c-terra' },
    '?':      { icons: ['quest'], color: 'c-navy' },
    '?!':     { icons: ['quest', 'excl'], color: 'c-navy' },
    love:     { icons: ['heart'], color: 'c-terra' },
    note:     { icons: ['note'], color: 'c-teal' },
    notes:    { icons: ['note', 'note'], color: 'c-teal' },
    z:        { icons: ['z'], color: 'c-navy', thought: true },
    food:     { icons: ['food'], color: 'c-mustard', thought: true },
    drop:     { icons: ['drop'], color: 'c-sky', thought: true },
    moon:     { icons: ['moon'], color: 'c-navy', thought: true },
    ball:     { icons: ['ball'], color: 'c-terra', thought: true },
    anger:    { icons: ['anger'], color: 'c-terra' },
    sparkle:  { icons: ['sparkle'], color: 'c-mustard' },
    dots:     { icons: ['dots'], color: 'c-navy' },
    star:     { icons: ['star'], color: 'c-mustard' },
    stars:    { icons: ['star', 'star'], color: 'c-mustard' }
  };

  let host = null;
  let current = null;
  let hideCall = null;

  function build(kind, opts) {
    const p = PRESETS[kind] || null;
    const el = U.h('div', { class: 'bubble' + ((opts.thought ?? p?.thought) ? ' thought' : '') });
    if (p) {
      for (const ic of p.icons) {
        const svg = G.icon(ic);
        svg.classList.add(p.color);
        el.appendChild(svg);
      }
    } else {
      el.textContent = String(kind); // texto curto livre
    }
    return el;
  }

  G.bubble = {
    init(el) { host = el; },

    show(kind, opts = {}) {
      if (!host) return;
      this.hide(true);
      const el = build(kind, opts);
      host.appendChild(el);
      current = el;
      const tilt = U.rand(-6, 6);
      gsap.fromTo(el,
        { xPercent: -50, scale: 0, rotation: tilt * 2, y: 10, opacity: 0 },
        { scale: 1, rotation: tilt, y: 0, opacity: 1, duration: 0.42, ease: 'back.out(2.6)' });
      gsap.to(el, { y: -4, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 0.42 });
      const dur = opts.duration ?? 1700;
      if (hideCall) hideCall.kill();
      hideCall = gsap.delayedCall(dur / 1000, () => this.hide());
      return el;
    },

    hide(instant) {
      const el = current;
      if (!el) return;
      current = null;
      if (hideCall) { hideCall.kill(); hideCall = null; }
      gsap.killTweensOf(el);
      if (instant) { el.remove(); return; }
      gsap.to(el, { scale: 0.4, opacity: 0, y: -8, duration: 0.22, ease: 'power2.in', onComplete: () => el.remove() });
    },

    get visible() { return !!current; },
    presets: PRESETS
  };
})(window.Game = window.Game || {});
