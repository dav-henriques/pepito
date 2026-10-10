/* ==========================================================================
   MÓVEIS INTERATIVOS (GSAP)
   Cama: toque → ela afunda e ele vai dormir (cansado ou de noite = sono de
   verdade; descansado = soneca curtinha).
   (Pote → food.js · Banheira → bath.js · Brinquedos → play.js)
   Pedidos: quando falta alguma coisa, o móvel certo dá uma balançadinha de
   vez em quando (pote = fome, banheira = sujeira, caminha = sono) — assim dá
   para entender o jogo sem ler instruções.
   Objeto novo: adicione o HTML com data-hit="nome" e registre aqui:
       G.interaction.register('nome', G.interaction.tap(() => ...))
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  function bed() {
    // a mesma imagem é usada atrás e na frente do pet: as duas afundam juntas
    gsap.fromTo('.bed', { scaleY: 0.88, scaleX: 1.06 }, { scaleY: 1, scaleX: 1, duration: 0.8, ease: 'elastic.out(1, .35)' });
    const z = G.room.zones.bed;
    G.fx.burst('dust', z.cx, z.y0 + z.h * 0.5, 4, { jitter: 40 });
    G.audio.play('pop', { v: 0.5 });
    if (G.petState.can('autonomous')) {
      G.physics.faceTo(z.cx);
      G.bubble.show('moon', { duration: 900 });
      // a caminha sempre chama para dormir: cansado (ou de noite) = sono de
      // verdade; descansado = só uma soneca curtinha
      G.behavior.sleepNow({ nap: !G.behavior.sleepyEnough() });
    }
  }

  /* ---------------- pedidos dos móveis ---------------- */
  const th = () => G.config.needs.thresholds;
  const NEEDS = {
    bowl: {
      due: () => G.needs.get('hunger') < th().hungry && !G.food.hasFood() && G.petState.activity !== 'eating',
      sel: '.bowl', icon: 'food', color: 'c-mustard',
      hint: () => 'fome! toque no pote para dar comida'
    },
    tub: {
      due: () => G.needs.get('cleanliness') < th().dirty && !G.bath.active,
      sel: '.tub-back, .tub-front', icon: 'drop', color: 'c-sky',
      hint: () => `${G.config.pet.name} está sujinho: toque na banheira`
    },
    bed: {
      due: () => G.needs.get('energy') < th().tired && G.petState.activity !== 'sleeping',
      sel: '.bed', icon: 'moon', color: 'c-navy',
      hint: () => `${G.config.pet.name} está com sono: toque na caminha`
    }
  };
  let lastNudge = 0;
  let turn = 0;

  function nudge() {
    if (document.hidden || G.interaction.isActive || G.bath.active) return;
    if (document.querySelector('.sheet, .food-menu')) return;
    const now = Date.now();
    if (now - lastNudge < 10000) return;
    const due = Object.keys(NEEDS).filter((k) => NEEDS[k].due());
    if (!due.length) return;
    const k = due[turn++ % due.length];      // se faltar mais de uma coisa, alterna
    const n = NEEDS[k];
    lastNudge = now;

    // balançadinha (a cama e a banheira têm duas camadas: as duas juntas)
    if (!U.reducedMotion) {
      gsap.timeline()
        .to(n.sel, { rotation: -3, scaleY: 1.04, duration: 0.1, ease: 'power1.out' })
        .to(n.sel, { rotation: 3, duration: 0.12, ease: 'power1.inOut' })
        .to(n.sel, { rotation: -2, duration: 0.1, ease: 'power1.inOut' })
        .to(n.sel, { rotation: 0, scaleY: 1, duration: 0.35, ease: 'elastic.out(1, .4)' });
    }
    // adesivinho com o ícone do que falta, em cima do móvel
    const zone = G.room.zones[k];
    const ping = U.h('div', { class: 'need-ping' }, [G.icon(n.icon, n.color)]);
    document.getElementById('ui').appendChild(ping);
    const x = zone.cx - 17, y = Math.max(104, zone.y0 - 40);
    gsap.timeline({ onComplete: () => ping.remove() })
      .fromTo(ping, { x, y: y + 12, scale: 0, rotation: -25 }, { y, scale: 1, rotation: U.rand(-8, 8), duration: 0.4, ease: 'back.out(2.6)' })
      .to(ping, { y: y - 6, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: 1 })
      .to(ping, { scale: 0, opacity: 0, duration: 0.25, ease: 'back.in(2)' });
    G.audio.play('tap');
    G.hud.hintOnce('need-' + k, n.hint(), 4200);
  }

  /* ---------------- carregando o gato por cima da caminha ----------------
     (como a banheira em bath.js): a caminha "afunda" de leve avisando que dá
     para soltar ali — soltar = ele se ajeita ou dorme (reactions.js) */
  let bedHover = false, hoverTick = null;
  function bedHoverCheck() {
    const P = G.physics.P;
    const over = P.h < 150 && G.room.nearBed(P.x, P.z);
    if (over === bedHover) return;
    bedHover = over;
    gsap.to('.bed', { scaleY: over ? 0.95 : 1, scaleX: over ? 1.03 : 1, duration: 0.3, ease: over ? 'back.out(3)' : 'power2.out', overwrite: 'auto' });
    if (over) { G.audio.play('pop', { v: 0.35, pitch: 0.8 }); G.haptic(5); }
  }

  G.objects = {
    init() {
      G.interaction.register('bed', G.interaction.tap(bed));
      setInterval(nudge, 1500);
      G.bus.on('pet:lift', () => {
        if (hoverTick) gsap.ticker.remove(hoverTick);
        hoverTick = bedHoverCheck;
        gsap.ticker.add(hoverTick);
      });
      G.bus.on('pet:release', () => {
        if (hoverTick) { gsap.ticker.remove(hoverTick); hoverTick = null; }
        if (bedHover) { bedHover = false; gsap.to('.bed', { scaleX: 1, scaleY: 1, duration: 0.35, ease: 'elastic.out(1, .4)', overwrite: 'auto' }); }
      });
    }
  };
})(window.Game = window.Game || {});
