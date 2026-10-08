/* ==========================================================================
   ANIMAÇÃO DAS IMAGENS (GSAP)
   --------------------------------------------------------------------------
   • escolhe a imagem certa para o estado (com fallbacks e detecção de falta)
   • crossfade entre imagens
   • "humor": animações idle por estado na camada .pet-mood
     (respirar, quicar, coçar, cochilar…) — sem tocar na imagem original
   • acessórios posicionados pelos anchors do config
   A física (Anime.js) mexe nas camadas de fora; aqui só a camada de humor.
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  let moodEl, imgA, imgB, accEl, bubbleHost, foamEl;
  let front = null, back = null;
  let currentSrc = '';
  let currentMood = null;
  let moodTl = null;
  let moodTimers = [];
  let swapToken = 0;
  const imgStatus = {};          // chave → 'ok' | 'missing' | 'loading'
  let accessoryId = 'none';
  let accImg = null;

  /* ---------------- imagens ---------------- */
  function preload() {
    const imgs = G.config.pet.images;
    const jobs = [];
    for (const key in imgs) {
      imgStatus[key] = 'loading';
      jobs.push(new Promise((resolve) => {
        const im = new Image();
        im.decoding = 'async';
        im.onload = () => { imgStatus[key] = 'ok'; resolve(); };
        im.onerror = () => { imgStatus[key] = 'missing'; console.warn('[pet] imagem não encontrada:', imgs[key]); resolve(); };
        im.src = imgs[key];
      }));
    }
    return Promise.all(jobs);
  }

  function resolveSrc(key) {
    const imgs = G.config.pet.images;
    const fb = G.config.pet.imageFallbacks;
    const tried = new Set();
    const queue = [key, ...(fb[key] || []), ...(fb['*'] || ['normal'])];
    for (const k of queue) {
      if (tried.has(k)) continue;
      tried.add(k);
      if (imgs[k] && imgStatus[k] !== 'missing') return imgs[k];
    }
    return imgs.normal;
  }

  function swapImage(key, quick, pop) {
    const src = resolveSrc(key);
    if (src === currentSrc) return;
    currentSrc = src;
    const token = ++swapToken;
    back.src = src;
    const show = () => {
      if (token !== swapToken) return;
      const d = quick ? 0.08 : 0.18;
      gsap.killTweensOf([front, back], 'opacity');
      gsap.to(back, { opacity: 1, duration: d, ease: 'power1.out' });
      gsap.to(front, { opacity: 0, duration: d, ease: 'power1.in' });
      if (pop) gsap.fromTo(back, { scale: 0.95 }, { scale: 1, duration: 0.4, ease: 'back.out(3)', transformOrigin: '50% 100%' });
      const t = front; front = back; back = t;
    };
    if (back.decode) back.decode().then(show, show); else show();
  }

  /* ---------------- humores (loops GSAP) ---------------- */
  function every(minMs, maxMs, fn) {
    let alive = true;
    const loop = () => {
      if (!alive) return;
      const call = gsap.delayedCall(U.rand(minMs, maxMs) / 1000, () => { if (alive) { fn(); loop(); } });
      moodTimers.push(call);
    };
    loop();
    moodTimers.push({ kill: () => { alive = false; } });
  }

  function headPoint() { return G.physics.anchorPoint('top'); }

  const MOODS = {
    none() { return null; },

    normal(el) {
      return gsap.timeline({ repeat: -1, yoyo: true })
        .to(el, { scaleY: 1.025, scaleX: 0.992, duration: 1.7, ease: 'sine.inOut' });
    },

    happy(el) {
      const tl = gsap.timeline({ repeat: -1 });
      tl.to(el, { scaleY: 1.035, scaleX: 0.99, rotation: 2.2, duration: 0.55, ease: 'sine.inOut' })
        .to(el, { scaleY: 1, scaleX: 1, rotation: 0, duration: 0.55, ease: 'sine.inOut' })
        .to(el, { scaleY: 1.035, scaleX: 0.99, rotation: -2.2, duration: 0.55, ease: 'sine.inOut' })
        .to(el, { scaleY: 1, scaleX: 1, rotation: 0, duration: 0.55, ease: 'sine.inOut' });
      return tl;
    },

    excited(el) {
      return gsap.timeline({ repeat: -1 })
        .to(el, { y: -7, scaleY: 1.05, scaleX: 0.97, duration: 0.17, ease: 'power2.out' })
        .to(el, { y: 0, scaleY: 0.95, scaleX: 1.04, duration: 0.17, ease: 'power2.in' })
        .to(el, { scaleY: 1, scaleX: 1, duration: 0.12, ease: 'power1.out' });
    },

    playful(el) {
      return gsap.timeline({ repeat: -1 })
        .to(el, { rotation: 4, y: -2, duration: 0.42, ease: 'sine.inOut' })
        .to(el, { rotation: -4, y: 0, duration: 0.42, ease: 'sine.inOut' });
    },

    sleeping(el) {
      every(2000, 2800, () => {
        const p = headPoint();
        G.fx.spawn('z', p.x + 10, p.y + 18);
      });
      return gsap.timeline({ repeat: -1, yoyo: true })
        .to(el, { scaleY: 1.045, scaleX: 0.985, duration: 2.4, ease: 'sine.inOut' });
    },

    eating(el) {
      return gsap.timeline({ repeat: -1 })
        .to(el, { y: 2.5, rotation: 1.8, scaleY: 0.985, duration: 0.15, ease: 'power1.inOut' })
        .to(el, { y: 0, rotation: -1.2, scaleY: 1, duration: 0.15, ease: 'power1.inOut' });
    },

    bathing(el) {
      return gsap.timeline({ repeat: -1, yoyo: true })
        .to(el, { rotation: 3, scaleY: 1.02, duration: 0.9, ease: 'sine.inOut' })
        .to(el, { rotation: -3, scaleY: 1, duration: 0.9, ease: 'sine.inOut' });
    },

    tired(el) {
      every(9000, 16000, () => {
        // bocejo: estica e volta
        gsap.timeline()
          .to(el, { scaleY: 1.07, scaleX: 0.97, duration: 0.5, ease: 'sine.out' })
          .to(el, { scaleY: 1, scaleX: 1, duration: 0.7, ease: 'sine.inOut' });
        G.audio.play('yawn');
      });
      return gsap.timeline({ repeat: -1, yoyo: true })
        .to(el, { scaleY: 0.975, scaleX: 1.01, rotation: 1.5, duration: 2.2, ease: 'sine.inOut' });
    },

    weak(el) {
      return gsap.timeline({ repeat: -1, yoyo: true })
        .to(el, { scaleY: 0.965, scaleX: 1.015, rotation: -1.5, duration: 2.4, ease: 'sine.inOut' });
    },

    sad(el) {
      return gsap.timeline({ repeat: -1, yoyo: true })
        .to(el, { scaleY: 0.975, y: 1.5, duration: 2.6, ease: 'sine.inOut' });
    },

    itchy(el) {
      every(2400, 4600, () => {
        gsap.fromTo(el, { x: -2 }, { x: 2, duration: 0.05, repeat: 7, yoyo: true, ease: 'none', onComplete: () => gsap.set(el, { x: 0 }) });
        if (G.petState.condition === 'veryDirty') {
          const p = headPoint();
          G.fx.spawn('fly', p.x + U.rand(-30, 30), p.y + 20);
        }
      });
      return gsap.timeline({ repeat: -1, yoyo: true })
        .to(el, { scaleY: 1.02, scaleX: 0.995, duration: 1.6, ease: 'sine.inOut' });
    },

    held(el) {
      return gsap.timeline({ repeat: -1, yoyo: true })
        .to(el, { scaleX: 1.025, scaleY: 0.985, rotation: 1.2, duration: 0.13, ease: 'sine.inOut' });
    },

    dizzy(el) {
      every(380, 520, () => {
        const p = headPoint();
        G.fx.spawn('star', p.x + U.rand(-24, 24), p.y + 16, { angle: U.rand(-2.6, -0.5) });
      });
      return gsap.timeline({ repeat: -1 })
        .to(el, { rotation: 7, x: 3, duration: 0.45, ease: 'sine.inOut' })
        .to(el, { rotation: -7, x: -3, duration: 0.45, ease: 'sine.inOut' });
    },

    grumpy(el) {
      return gsap.timeline({ repeat: -1, repeatDelay: 0.6 })
        .to(el, { scaleX: 1.05, scaleY: 1.03, duration: 0.5, ease: 'sine.out' })
        .to(el, { scaleX: 1, scaleY: 1, duration: 0.8, ease: 'sine.inOut' });
    }
  };

  function setMood(name) {
    if (name === currentMood) return;
    currentMood = name;
    if (moodTl) { moodTl.kill(); moodTl = null; }
    moodTimers.forEach((t) => t.kill());
    moodTimers = [];
    gsap.killTweensOf(moodEl);
    gsap.to(moodEl, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, duration: 0.25, ease: 'power1.out',
      onComplete: () => {
        if (currentMood !== name) return;
        const fn = MOODS[name] || MOODS.normal;
        moodTl = U.reducedMotion ? null : fn(moodEl);
      }
    });
  }

  /* ---------------- acessórios ---------------- */
  function placeAccessory(stateName) {
    if (!accImg) return;
    const def = G.config.customization.accessories.find((a) => a.id === accessoryId);
    if (!def || !def.anchor) return;
    const a = G.config.pet.anchors[def.anchor];
    const off = G.config.pet.anchorOffsets[stateName] || {};
    gsap.to(accImg, {
      left: ((a.x + (def.dx || 0) + (off.x || 0)) * 100) + '%',
      top: ((a.y + (def.dy || 0) + (off.y || 0)) * 100) + '%',
      duration: 0.25, ease: 'power2.out'
    });
  }

  function placeBubble(stateName) {
    const a = G.config.pet.anchors.top;
    const off = G.config.pet.anchorOffsets[stateName] || {};
    bubbleHost.style.top = ((a.y + (off.y || 0)) * 100) + '%';
  }

  const animation = {
    init() {
      const pet = document.getElementById('pet');
      moodEl = pet.querySelector('.pet-mood');
      imgA = pet.querySelector('.pet-img.a');
      imgB = pet.querySelector('.pet-img.b');
      accEl = pet.querySelector('.pet-accessory');
      foamEl = pet.querySelector('.pet-foam');
      bubbleHost = pet.querySelector('.pet-bubble');
      front = imgA; back = imgB;
      gsap.set(moodEl, { transformOrigin: '50% 100%' });

      G.bus.on('state:display', ({ display, prev }) => {
        const quick = display.state === 'beingDragged' || prev.state === 'beingDragged' || display.state === 'airborne';
        // "pop" sutil ao mudar de expressão
        swapImage(display.image, quick, !quick && !U.reducedMotion);
        if (display.mood) setMood(display.mood);
        placeAccessory(display.state);
        placeBubble(display.state);
      });
    },

    preload,

    /** Mostra a primeira imagem sem transição */
    showInitial() {
      const d = G.petState.display;
      currentSrc = resolveSrc(d.image);
      front.src = currentSrc;
      gsap.set(front, { opacity: 1 });
      gsap.set(back, { opacity: 0 });
      setMood(d.mood || 'normal');
      placeBubble(d.state);
    },

    setAccessory(id) {
      accessoryId = id || 'none';
      accEl.innerHTML = '';
      accImg = null;
      const def = G.config.customization.accessories.find((a) => a.id === accessoryId);
      if (!def || accessoryId === 'none') return;
      accImg = U.h('img', { src: G.asset('accessories.' + def.id), alt: '', draggable: 'false' });
      accImg.style.width = (def.width * 100) + '%';
      if (def.rotate) accImg.style.rotate = def.rotate + 'deg';
      accEl.appendChild(accImg);
      const a = G.config.pet.anchors[def.anchor];
      const off = G.config.pet.anchorOffsets[G.petState.display.state] || {};
      gsap.set(accImg, { xPercent: -50, yPercent: -50, left: ((a.x + (def.dx || 0) + (off.x || 0)) * 100) + '%', top: ((a.y + (def.dy || 0) + (off.y || 0)) * 100) + '%' });
      gsap.fromTo(accImg, { scale: 0, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(2.5)' });
    },

    get accessory() { return accessoryId; },
    get foamLayer() { return foamEl; },
    setMood
  };

  G.anim = animation;
})(window.Game = window.Game || {});
