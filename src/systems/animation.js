/* ==========================================================================
   ANIMAÇÃO DAS IMAGENS (GSAP)
   --------------------------------------------------------------------------
   • escolhe a imagem certa para o estado (com fallbacks e detecção de falta)
   • usa a versão "recortada" (contorno/sombra/tamanho igualado) do cutout.js
   • crossfade entre imagens com um "squash" de troca de expressão
   • ajustes por imagem (petConfig → pet.imageTweaks)
   • "humor": animações idle por estado na camada .pet-mood
     (respirar, quicar, coçar, cochilar, encarar…) — sem tocar na imagem
   A física (Anime.js) mexe nas camadas de fora; aqui só a camada de humor.
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  let petEl, moodEl, imgA, imgB, bubbleHost, foamEl;
  let front = null, back = null;
  let currentSrc = '';
  let currentKey = null;
  let currentMood = null;
  let moodTl = null;
  let moodTimers = [];
  let swapToken = 0;
  const imgStatus = {};          // chave → 'ok' | 'missing' | 'loading'

  /* ---------------- imagens ---------------- */
  function preload() {
    const imgs = G.config.pet.images;
    const first = G.petState.display.image;
    const jobs = [];
    for (const key in imgs) {
      if (!imgs[key]) { imgStatus[key] = 'missing'; continue; }
      imgStatus[key] = 'loading';
      jobs.push(new Promise((resolve) => {
        const im = new Image();
        im.decoding = 'async';
        im.onload = () => {
          imgStatus[key] = 'ok';
          G.cutout.enqueue(key, im, key === 'normal' || key === first);
          resolve();
        };
        im.onerror = () => { imgStatus[key] = 'missing'; console.warn('[pet] imagem não encontrada:', imgs[key]); resolve(); };
        im.src = imgs[key];
      }));
    }
    return Promise.all(jobs);
  }

  /** Chave de imagem que vai aparecer de fato (segue os fallbacks) */
  function resolveKey(key) {
    const imgs = G.config.pet.images;
    const fb = G.config.pet.imageFallbacks;
    const tried = new Set();
    const queue = [key];
    while (queue.length) {
      const k = queue.shift();
      if (tried.has(k)) continue;
      tried.add(k);
      if (imgs[k] && imgStatus[k] !== 'missing') return k;
      queue.push(...(fb[k] || []));
    }
    for (const k of fb['*'] || ['normal']) if (imgs[k] && imgStatus[k] !== 'missing') return k;
    return 'normal';
  }

  function srcFor(key) {
    const r = G.cutout.result(key);
    return r && r.url ? r.url : G.config.pet.images[key];
  }

  /** Esta imagem é uma foto sem recorte (vira "cartão de foto")? */
  function isCardKey(key) {
    const r = G.cutout.result(key);
    if (r) return !!r.opaque;
    return /\.jpe?g($|\?)/i.test(G.config.pet.images[key] || '');
  }

  /** Os "humores" são pensados para a FOTO (figurinha): giros pequenos e escala
      uniforme (foto esticada num eixo parece imagem distorcida). Num gato
      recortado (PNG) dá para exagerar mais. */
  const isCard = () => isCardKey(currentKey || G.petState.display.image);
  const R = (deg) => deg * (isCard() ? 1 : 2.2);          // graus
  const S = (amt) => 1 + amt * (isCard() ? 1 : 1.8);      // escala uniforme

  /** Classes de visual + ajuste fino da imagem (escala, posição, giro, espelho) */
  function applyLook(img, key) {
    const tw = (G.config.pet.imageTweaks || {})[key] || {};
    const raw = !G.cutout.result(key);
    const path = G.config.pet.images[key] || '';
    const L = G.config.pet.look || {};
    img.classList.toggle('raw', raw);
    img.classList.toggle('framed', raw && L.frameOpaque !== false && /\.jpe?g($|\?)/i.test(path));
    const s = tw.scale || 1;
    img._look = { s, sx: (tw.flip ? -1 : 1) * s, rot: tw.rotate || 0 };
    gsap.set(img, {
      xPercent: (tw.x || 0) * 100, yPercent: (tw.y || 0) * 100,
      rotation: tw.rotate || 0, scaleX: img._look.sx, scaleY: s, transformOrigin: '50% 100%'
    });
  }

  async function swapImage(key, quick, pop) {
    const k = resolveKey(key);
    const token = ++swapToken;
    if (G.cutout.isPending(k)) {
      await G.cutout.whenReady(k, quick ? 140 : 380);
      if (token !== swapToken) return;
    }
    const src = srcFor(k);
    if (src === currentSrc) return;
    currentSrc = src;
    currentKey = k;
    const target = back;
    target.src = src;
    applyLook(target, k);
    const show = () => {
      if (token !== swapToken) return;
      const d = quick ? 0.08 : 0.22;
      gsap.killTweensOf([front, back], 'opacity');
      gsap.to(back, { opacity: 1, duration: d, ease: 'sine.out' });
      gsap.to(front, { opacity: 0, duration: d, ease: 'sine.in' });
      if (pop) {
        // figurinha nova "colada" por cima: cresce um tiquinho por igual, com uma
        // giradinha, e assenta — sem achatar a foto
        const L = back._look || { s: 1, sx: 1, rot: 0 };
        gsap.fromTo(back, { scaleX: L.sx * 1.045, scaleY: L.s * 1.045, rotation: L.rot + U.rand(-1.6, 1.6) },
          { scaleX: L.sx, scaleY: L.s, rotation: L.rot, duration: 0.5, ease: 'back.out(1.6)' });
      }
      const t = front; front = back; back = t;
      if (isCardKey(k)) G.physics.straighten();     // foto nunca fica espelhada
      G.bus.emit('pet:image', { key: k, src: G.config.pet.images[k] });
    };
    if (target.decode) target.decode().then(show, show); else show();
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

  /** Auréola de estrelinhas girando em volta da cabeça (tontura).
      Fica dentro do pet (anda junto com ele) e some quando o humor muda. */
  function dizzyHalo() {
    const host = U.h('div', { class: 'dizzy-halo' });
    const stars = [0, 1, 2].map(() => host.appendChild(U.h('i', {}, [G.icon('star')])));
    host.style.top = ((G.config.pet.anchors.top.y + 0.06) * 100) + '%';
    petEl.appendChild(host);
    const W = G.room.petW;
    const rx = W * 0.27, ry = W * 0.07;
    const st = { a: 0 };
    const place = () => {
      stars.forEach((s, i) => {
        const t = st.a + (i * Math.PI * 2) / 3;
        const front = (Math.sin(t) + 1) / 2;          // 0 = atrás da cabeça … 1 = na frente
        gsap.set(s, { x: Math.cos(t) * rx, y: Math.sin(t) * ry, scale: 0.62 + 0.38 * front, opacity: 0.35 + 0.65 * front, rotation: t * 57.3 });
      });
    };
    place();
    const spin = gsap.to(st, { a: Math.PI * 2, duration: 1.4, ease: 'none', repeat: -1, onUpdate: place });
    gsap.fromTo(host, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)' });
    return {
      kill: () => {
        gsap.to(host, { scale: 0.5, opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: () => { spin.kill(); host.remove(); } });
      }
    };
  }

  /** Tremidinha suave (coçar, esforço): vai e volta em curva, morrendo no fim */
  function shimmy(el, amp, cycles = 3, half = 0.07) {
    const tl = gsap.timeline();
    for (let i = 0; i < cycles * 2; i++) {
      const a = amp * (1 - i / (cycles * 2)) * (i % 2 ? -1 : 1);
      tl.to(el, { x: a, duration: half, ease: 'sine.inOut' });
    }
    tl.to(el, { x: 0, duration: half * 1.4, ease: 'sine.out' });
    return tl;
  }

  /* Todos em curva senoidal (sem trancos), ritmos de gente calma (≥ 0,3 s por
     movimento), escala sempre por igual e giros de 1–3°. */
  const MOODS = {
    none() { return null; },

    /* respirando */
    normal(el) {
      return gsap.timeline({ repeat: -1, yoyo: true })
        .to(el, { scale: S(0.012), y: -1, duration: 2.2, ease: 'sine.inOut' });
    },

    /* contente: balança de leve de um lado pro outro, subindo um pouquinho */
    happy(el) {
      return gsap.timeline({ repeat: -1 })
        .to(el, { rotation: R(1.6), y: -2.5, scale: S(0.01), duration: 0.75, ease: 'sine.inOut' })
        .to(el, { rotation: 0, y: 0, scale: 1, duration: 0.75, ease: 'sine.inOut' })
        .to(el, { rotation: R(-1.6), y: -2.5, scale: S(0.01), duration: 0.75, ease: 'sine.inOut' })
        .to(el, { rotation: 0, y: 0, scale: 1, duration: 0.75, ease: 'sine.inOut' });
    },

    /* animado: pulinhos no lugar, alternando o lado */
    excited(el) {
      return gsap.timeline({ repeat: -1 })
        .to(el, { y: -7, rotation: R(1.4), duration: 0.26, ease: 'sine.out' })
        .to(el, { y: 0, rotation: 0, duration: 0.22, ease: 'sine.in' })
        .to(el, { y: -7, rotation: R(-1.4), duration: 0.26, ease: 'sine.out' })
        .to(el, { y: 0, rotation: 0, duration: 0.22, ease: 'sine.in' });
    },

    /* brincalhão: rebola */
    playful(el) {
      return gsap.timeline({ repeat: -1 })
        .to(el, { rotation: R(2.2), y: -2, duration: 0.55, ease: 'sine.inOut' })
        .to(el, { rotation: R(-2.2), y: 0, duration: 0.55, ease: 'sine.inOut' });
    },

    /* dormindo: respiração lenta e funda + "z" */
    sleeping(el) {
      every(2000, 2800, () => {
        const p = headPoint();
        G.fx.spawn('z', p.x + 10, p.y + 18);
      });
      return gsap.timeline({ repeat: -1, yoyo: true })
        .to(el, { scale: S(0.018), y: -1, duration: 2.6, ease: 'sine.inOut' });
    },

    /* comendo: acena com a cabeça, mastigando */
    eating(el) {
      return gsap.timeline({ repeat: -1, yoyo: true })
        .to(el, { y: 2, rotation: R(1.2), duration: 0.34, ease: 'sine.inOut' });
    },

    /* no banho: balança devagar na água */
    bathing(el) {
      return gsap.timeline({ repeat: -1 })
        .to(el, { rotation: R(1.8), y: -1, duration: 1.1, ease: 'sine.inOut' })
        .to(el, { rotation: R(-1.8), y: 0, duration: 1.1, ease: 'sine.inOut' });
    },

    /* cansado: vai murchando devagar; de vez em quando boceja (cresce e volta) */
    tired(el) {
      every(9000, 16000, () => {
        gsap.timeline()
          .to(el, { scale: S(0.03), y: -2, duration: 0.7, ease: 'sine.out' })
          .to(el, { scale: 1, y: 0, duration: 0.9, ease: 'sine.inOut' });
        G.audio.play('yawn');
      });
      return gsap.timeline({ repeat: -1, yoyo: true })
        .to(el, { y: 2, rotation: R(1.2), duration: 2.4, ease: 'sine.inOut' });
    },

    /* fraquinho (fome demais) */
    weak(el) {
      return gsap.timeline({ repeat: -1, yoyo: true })
        .to(el, { y: 3, scale: S(-0.01), rotation: R(-1), duration: 2.6, ease: 'sine.inOut' });
    },

    /* triste: murcha devagar */
    sad(el) {
      return gsap.timeline({ repeat: -1, yoyo: true })
        .to(el, { y: 3, rotation: R(-0.8), duration: 2.8, ease: 'sine.inOut' });
    },

    /* sujinho: coça de vez em quando (tremidinha macia) */
    itchy(el) {
      every(2600, 4800, () => {
        shimmy(el, 1.8, 3, 0.07);
        if (G.petState.condition === 'veryDirty') {
          const p = headPoint();
          G.fx.spawn('fly', p.x + U.rand(-30, 30), p.y + 20);
        }
      });
      return gsap.timeline({ repeat: -1, yoyo: true })
        .to(el, { scale: S(0.01), duration: 1.8, ease: 'sine.inOut' });
    },

    /* susto: tremendo um pouquinho */
    held(el) {
      return gsap.timeline({ repeat: -1, yoyo: true })
        .to(el, { scale: S(0.012), rotation: R(0.8), duration: 0.2, ease: 'sine.inOut' });
    },

    /* tonto: o corpo "roda" num círculo lento, sem paradas (como quem está
       zonzo), e três estrelinhas giram em volta da cabeça (as de trás menores
       e apagadinhas, as da frente maiores) — presas ao gato, nada solto pela tela */
    dizzy(el) {
      moodTimers.push(dizzyHalo());
      const o = { a: 0 };
      return gsap.to(o, {
        a: Math.PI * 2, duration: 1.6, ease: 'none', repeat: -1,
        onUpdate: () => gsap.set(el, { x: Math.cos(o.a) * 2.6, y: Math.sin(o.a) * 1.4, rotation: R(2.2) * Math.sin(o.a + 0.7) })
      });
    },

    /* emburrado: "bufa" (cresce por igual e solta) */
    grumpy(el) {
      return gsap.timeline({ repeat: -1, repeatDelay: 0.7 })
        .to(el, { scale: S(0.025), duration: 0.6, ease: 'sine.out' })
        .to(el, { scale: 1, duration: 0.9, ease: 'sine.inOut' });
    },

    /* encarando: totalmente imóvel… e se aproximando da tela bem devagar */
    staring(el) {
      return gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.8 })
        .to(el, { scale: S(0.035), duration: 3.2, ease: 'sine.inOut' });
    },

    /* confuso: inclina a "cabeça" para um lado, segura, inclina pro outro */
    confused(el) {
      return gsap.timeline({ repeat: -1, repeatDelay: 0.3 })
        .to(el, { rotation: R(3.5), duration: 0.55, ease: 'sine.inOut' })
        .to(el, { rotation: R(3.5), duration: 0.9 })
        .to(el, { rotation: R(-2.5), duration: 0.6, ease: 'sine.inOut' })
        .to(el, { rotation: R(-2.5), duration: 0.9 });
    },

    /* pose absurda: travado na pose, com tremidinhas de esforço de vez em quando */
    silly(el) {
      every(1600, 2800, () => shimmy(el, 1.2, 3, 0.05));
      return gsap.timeline({ repeat: -1, yoyo: true })
        .to(el, { scale: S(0.015), rotation: R(-0.8), duration: 1.2, ease: 'sine.inOut' });
    }
  };

  /** Humor que vale agora: no colo ou voando quem mexe no corpo é a física —
      nenhum humor (ex.: a tontura) roda por cima, só depois de pousar */
  function moodFor(display) {
    const p = G.petState.physical;
    if (p === 'beingDragged' || p === 'airborne') return 'none';
    return display.mood || 'normal';
  }

  function setMood(name) {
    if (name === currentMood) return;
    currentMood = name;
    if (moodTl) { moodTl.kill(); moodTl = null; }
    moodTimers.forEach((t) => t.kill());
    moodTimers = [];
    gsap.killTweensOf(moodEl);
    // volta ao neutro com calma e só então começa o humor novo (sem tranco)
    gsap.to(moodEl, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, duration: 0.35, ease: 'sine.inOut',
      onComplete: () => {
        if (currentMood !== name) return;
        const fn = MOODS[name] || MOODS.normal;
        moodTl = U.reducedMotion ? null : fn(moodEl);
      }
    });
  }

  function placeBubble(stateName) {
    const a = G.config.pet.anchors.top;
    const off = G.config.pet.anchorOffsets[stateName] || {};
    bubbleHost.style.top = ((a.y + (off.y || 0)) * 100) + '%';
  }

  const animation = {
    init() {
      petEl = document.getElementById('pet');
      moodEl = petEl.querySelector('.pet-mood');
      imgA = petEl.querySelector('.pet-img.a');
      imgB = petEl.querySelector('.pet-img.b');
      foamEl = petEl.querySelector('.pet-foam');
      bubbleHost = petEl.querySelector('.pet-bubble');
      front = imgA; back = imgB;
      gsap.set(moodEl, { transformOrigin: '50% 100%' });
      petEl.classList.toggle('css-cutout', G.cutout.mode === 'css');
      G.bus.on('cutout:mode', (m) => petEl.classList.toggle('css-cutout', m === 'css'));

      G.bus.on('state:display', ({ display, prev }) => {
        const quick = display.state === 'beingDragged' || prev.state === 'beingDragged' || display.state === 'airborne';
        // "pop" sutil ao mudar de expressão
        swapImage(display.image, quick, !quick && !U.reducedMotion);
        setMood(moodFor(display));
        placeBubble(display.state);
      });
      // largou / pousou: o humor do estado atual volta a valer (ex.: tontura)
      G.bus.on('state:physical', () => setMood(moodFor(G.petState.display)));

      // a versão recortada da imagem atual ficou pronta depois → troca sem pulo
      G.bus.on('cutout:ready', ({ key }) => {
        if (key === currentKey) { currentSrc = ''; swapImage(G.petState.display.image, true, false); }
      });
    },

    preload,

    /** Mostra a primeira imagem sem transição */
    async showInitial() {
      const d = G.petState.display;
      const k = resolveKey(d.image);
      await G.cutout.whenReady(k, 900);
      currentKey = k;
      currentSrc = srcFor(k);
      front.src = currentSrc;
      applyLook(front, k);
      gsap.set(front, { opacity: 1 });
      gsap.set(back, { opacity: 0 });
      if (isCardKey(k)) G.physics.face(G.physics.facing, true);   // foto: sem espelho desde o início
      setMood(d.mood || 'normal');
      placeBubble(d.state);
      G.bus.emit('pet:image', { key: k, src: G.config.pet.images[k] });
    },

    /** "Flash" no pet (foto tirada, susto) */
    flash() {
      if (U.reducedMotion) return;
      gsap.fromTo(moodEl, { filter: 'brightness(2.1) saturate(0.6)' }, { filter: 'brightness(1) saturate(1)', duration: 0.5, ease: 'power2.out', clearProps: 'filter' });
    },

    /** Chave e arquivo da imagem que está aparecendo agora */
    get current() { return { key: currentKey, file: G.config.pet.images[currentKey] }; },

    /** A imagem que está aparecendo é uma foto (cartão)? */
    get isCard() { return isCardKey(currentKey || G.petState.display.image); },

    get foamLayer() { return foamEl; },
    setMood
  };

  G.anim = animation;
})(window.Game = window.Game || {});
