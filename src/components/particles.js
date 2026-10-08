/* ==========================================================================
   PARTÍCULAS (GSAP)
   Pool de elementos reaproveitados → sem criar/destruir DOM a cada efeito.
   Uso: G.fx.burst('sparkle', x, y, 6)  |  G.fx.spawn('note', x, y, {color})
   Para criar um tipo novo, adicione uma entrada em TYPES.
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;
  const MAX_ACTIVE = 90;

  let layer = null;
  let active = 0;
  const pool = new Map();

  function svgIcon(name) { return G.icon(name); }

  /* Cada tipo define como criar o elemento e como animá-lo (sempre GSAP). */
  const TYPES = {
    crumb: {
      make: (el) => { el.className = 'p p-dot'; },
      size: () => U.rand(4, 7),
      color: () => U.pick(['#a5683b', '#c4864f', '#8a5530', '#e9b44c']),
      play(el, x, y, o, done) {
        const dx = U.rand(-38, 38) * (o.spread || 1);
        const up = U.rand(14, 34);
        const fall = o.fall ?? U.rand(26, 44);
        gsap.set(el, { x, y, scale: 1, opacity: 1, rotation: 0 });
        gsap.to(el, { x: x + dx, duration: 0.7, ease: 'power1.out' });
        gsap.to(el, {
          keyframes: [
            { y: y - up, duration: 0.24, ease: 'power2.out' },
            { y: y + fall, duration: 0.42, ease: 'power2.in' }
          ]
        });
        gsap.to(el, { opacity: 0, duration: 0.2, delay: 0.55, onComplete: done });
      }
    },

    sparkle: {
      make: (el) => { el.className = 'p'; el.appendChild(svgIcon('sparkle')); },
      size: () => U.rand(14, 24),
      color: () => U.pick(['#ffe08a', '#fff4c2', '#ffffff', '#ffd35c']),
      play(el, x, y, o, done) {
        const a = U.rand(0, Math.PI * 2), r = U.rand(16, 46) * (o.spread || 1);
        gsap.set(el, { x, y, scale: 0, opacity: 1, rotation: U.rand(-40, 40) });
        gsap.to(el, { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r - 10, rotation: '+=90', duration: 0.9, ease: 'power2.out' });
        gsap.to(el, { keyframes: [{ scale: U.rand(0.8, 1.15), duration: 0.22, ease: 'back.out(3)' }, { scale: 0, duration: 0.5, delay: 0.15, ease: 'power2.in' }], onComplete: done });
      }
    },

    star: {
      make: (el) => { el.className = 'p'; el.appendChild(svgIcon('star')); },
      size: () => U.rand(12, 20),
      color: () => U.pick(['#ffd35c', '#ffe08a', '#fff4c2']),
      play(el, x, y, o, done) {
        const a = o.angle ?? U.rand(-Math.PI, 0), r = U.rand(30, 60);
        gsap.set(el, { x, y, scale: 0.4, opacity: 1, rotation: 0 });
        gsap.to(el, { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, rotation: U.rand(-200, 200), scale: 1, duration: 0.6, ease: 'power3.out' });
        gsap.to(el, { opacity: 0, duration: 0.3, delay: 0.45, onComplete: done });
      }
    },

    dust: {
      make: (el) => { el.className = 'p p-dot'; },
      size: () => U.rand(10, 18),
      color: () => 'rgba(235, 220, 200, 0.85)',
      play(el, x, y, o, done) {
        const dir = o.dir ?? U.sign(U.rand(-1, 1));
        gsap.set(el, { x, y, scale: 0.4, opacity: 0.9 });
        gsap.to(el, { x: x + dir * U.rand(18, 42), y: y - U.rand(2, 12), scale: U.rand(1.1, 1.6), opacity: 0, duration: U.rand(0.45, 0.7), ease: 'power2.out', onComplete: done });
      }
    },

    bubble: {
      make: (el) => { el.className = 'p p-bubble'; el.dataset.hit = 'bubble'; },
      size: () => U.rand(12, 26),
      color: () => null,
      play(el, x, y, o, done) {
        const rise = o.rise ?? U.rand(90, 200);
        const t = U.rand(2.2, 3.6);
        el._done = done;
        gsap.set(el, { x, y, scale: 0, opacity: 1 });
        gsap.to(el, { scale: 1, duration: 0.3, ease: 'back.out(2.5)' });
        gsap.to(el, { y: y - rise, duration: t, ease: 'sine.out' });
        gsap.to(el, { x: x + U.rand(-14, 14), duration: t / 4, ease: 'sine.inOut', yoyo: true, repeat: 3 });
        gsap.to(el, { scale: 1.3, opacity: 0, duration: 0.18, delay: t - 0.18, onComplete: done });
      }
    },

    drop: {
      make: (el) => { el.className = 'p p-drop'; },
      size: () => U.rand(5, 9),
      color: () => null,
      play(el, x, y, o, done) {
        const vx = (o.vx ?? U.rand(-120, 120)), vy = (o.vy ?? U.rand(-220, -80));
        const t = U.rand(0.5, 0.8);
        gsap.set(el, { x, y, scale: 1, opacity: 1, rotation: 0 });
        gsap.to(el, { x: x + vx * t, duration: t, ease: 'none' });
        gsap.to(el, { keyframes: [{ y: y + vy * 0.35, duration: t * 0.35, ease: 'power2.out' }, { y: y + 70, duration: t * 0.65, ease: 'power2.in' }] });
        gsap.to(el, { opacity: 0, duration: 0.15, delay: t - 0.15, onComplete: done });
      }
    },

    note: {
      make: (el) => { el.className = 'p'; el.appendChild(svgIcon('note')); },
      size: () => U.rand(16, 24),
      color: () => U.pick(['#d8694a', '#3f7f7a', '#e9b44c', '#2f3d55']),
      play(el, x, y, o, done) {
        gsap.set(el, { x, y, scale: 0, opacity: 1, rotation: U.rand(-20, 20) });
        gsap.to(el, { scale: 1, duration: 0.3, ease: 'back.out(3)' });
        gsap.to(el, { y: y - U.rand(50, 90), duration: 1.8, ease: 'power1.out' });
        gsap.to(el, { x: x + U.rand(-26, 26), rotation: U.rand(-30, 30), duration: 1.8, ease: 'sine.inOut' });
        gsap.to(el, { opacity: 0, duration: 0.5, delay: 1.3, onComplete: done });
      }
    },

    z: {
      make: (el) => { el.className = 'p'; el.appendChild(svgIcon('z')); },
      size: () => U.rand(12, 20),
      color: () => '#2f3d55',
      play(el, x, y, o, done) {
        gsap.set(el, { x, y, scale: 0.3, opacity: 0, rotation: -10 });
        gsap.to(el, { x: x + U.rand(20, 40), y: y - U.rand(40, 60), scale: 1.1, rotation: 10, duration: 2, ease: 'sine.out' });
        gsap.to(el, { keyframes: [{ opacity: 0.85, duration: 0.4 }, { opacity: 0, duration: 0.6, delay: 1 }], onComplete: done });
      }
    },

    heart: {
      make: (el) => { el.className = 'p'; el.appendChild(svgIcon('heart')); },
      size: () => U.rand(14, 20),
      color: () => U.pick(['#d8694a', '#e47e5f']),
      play(el, x, y, o, done) {
        gsap.set(el, { x, y, scale: 0, opacity: 1 });
        gsap.to(el, { scale: 1, duration: 0.3, ease: 'back.out(3)' });
        gsap.to(el, { y: y - U.rand(40, 70), x: x + U.rand(-16, 16), duration: 1.3, ease: 'power1.out' });
        gsap.to(el, { opacity: 0, duration: 0.4, delay: 0.9, onComplete: done });
      }
    },

    ring: {
      make: (el) => { el.className = 'p p-dot'; },
      size: () => 34,
      color: () => null,
      play(el, x, y, o, done) {
        el.style.background = 'transparent';
        el.style.border = '3px solid ' + (o.color || 'rgba(255,250,242,.9)');
        gsap.set(el, { x, y, scale: 0.3, opacity: 0.9 });
        gsap.to(el, { scale: o.scale || 1.8, opacity: 0, duration: 0.55, ease: 'power2.out', onComplete: done });
      }
    },

    fly: {
      make: (el) => { el.className = 'p p-dot'; },
      size: () => 4,
      color: () => '#2b2a33',
      play(el, x, y, o, done) {
        // mosquinha orbitando (pet muito sujo)
        gsap.set(el, { x, y, opacity: 0.8 });
        const tl = gsap.timeline({ onComplete: done });
        for (let i = 0; i < 6; i++) tl.to(el, { x: x + U.rand(-30, 30), y: y + U.rand(-24, 10), duration: U.rand(0.25, 0.45), ease: 'sine.inOut' });
        tl.to(el, { opacity: 0, duration: 0.2 });
      }
    }
  };

  function take(type) {
    const list = pool.get(type) || [];
    let el = list.pop();
    if (!el) {
      el = document.createElement('div');
      TYPES[type].make(el);
      el._type = type;
    }
    return el;
  }

  function release(el) {
    gsap.killTweensOf(el);
    el.remove();
    active = Math.max(0, active - 1);
    const list = pool.get(el._type) || [];
    if (list.length < 30) list.push(el);
    pool.set(el._type, list);
  }

  G.fx = {
    init(el) { layer = el; },

    spawn(type, x, y, opts = {}) {
      const T = TYPES[type];
      if (!T || !layer || active >= MAX_ACTIVE) return null;
      const el = take(type);
      const s = opts.size || T.size();
      el.style.width = el.style.height = s + 'px';
      el.style.marginLeft = el.style.marginTop = -s / 2 + 'px';
      const c = opts.color || T.color();
      if (c) {
        if (el.classList.contains('p-dot')) el.style.background = c;
        el.style.color = c;
      }
      layer.appendChild(el);
      active++;
      let finished = false;
      const done = () => { if (!finished) { finished = true; release(el); } };
      T.play(el, x, y, opts, done);
      return el;
    },

    burst(type, x, y, count, opts = {}) {
      if (U.reducedMotion) count = Math.ceil(count / 2);
      for (let i = 0; i < count; i++) {
        const d = opts.stagger ? i * opts.stagger : 0;
        if (d) setTimeout(() => this.spawn(type, x + U.rand(-(opts.jitter || 0), opts.jitter || 0), y, opts), d * 1000);
        else this.spawn(type, x + U.rand(-(opts.jitter || 0), opts.jitter || 0), y + U.rand(-(opts.jitterY || 0), opts.jitterY || 0), opts);
      }
    },

    /** Estoura uma bolha tocada pelo usuário */
    pop(el) {
      if (!el || !el._done) return;
      gsap.killTweensOf(el);
      const done = el._done;
      el._done = null;
      gsap.to(el, { scale: 1.6, opacity: 0, duration: 0.14, ease: 'power2.out', onComplete: done });
      G.audio?.play('bubble');
      G.bus.emit('fx:bubblePop');
    },

    types: TYPES
  };
})(window.Game = window.Game || {});
