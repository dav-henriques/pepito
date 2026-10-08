/* ==========================================================================
   OBJETOS INTERATIVOS DO AMBIENTE (GSAP)
   cama, planta, janela, luminária, relógio, quadro, rádio.
   Objeto novo: adicione o HTML com data-hit="nome" e registre aqui:
       G.interaction.register('nome', G.interaction.tap(() => ...))
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  const STATIONS = [null, 'lofi', 'chip'];
  let stationIdx = 0;
  let notesTimer = 0;
  let plantTaps = [];
  let windowTaps = [];
  let pictureTilt = 4;

  const $ = (s) => document.querySelector(s);

  function bed() {
    const el = $('.bed');
    gsap.fromTo(el, { scaleY: 0.88, scaleX: 1.06 }, { scaleY: 1, scaleX: 1, duration: 0.8, ease: 'elastic.out(1, .35)' });
    const z = G.room.zones.bed;
    G.fx.burst('dust', z.cx, z.y0 + z.h * 0.5, 4, { jitter: 40, color: 'rgba(255,250,242,.9)' });
    G.audio.play('pop', { v: 0.5 });
    if (G.petState.can('autonomous')) {
      G.physics.faceTo(z.cx);
      if (G.needs.get('energy') < 60 || G.time.isNight()) G.behavior.sleepNow();
      else if (U.chance(0.5)) G.bubble.show('?', { duration: 800 });
    }
  }

  function plant() {
    const el = $('.plant');
    gsap.fromTo(el, { rotation: U.pick([-7, 7]) }, { rotation: 0, duration: 1.4, ease: 'elastic.out(1, .25)', transformOrigin: '50% 100%' });
    G.audio.play('whoosh', { intensity: 0.25 });
    const z = G.room.zones.plant;
    G.fx.spawn('dust', z.cx + U.rand(-10, 10), z.y0 + 20, { color: 'rgba(125,184,134,.9)', size: 9 });
    const now = Date.now();
    plantTaps = plantTaps.filter((t) => now - t < 4000);
    plantTaps.push(now);
    if (plantTaps.length >= 5) { plantTaps = []; G.bus.emit('objects:plantFrenzy'); }
    if (G.petState.can('autonomous') && U.chance(0.4)) G.physics.faceTo(z.cx);
  }

  function windowTap() {
    const el = $('.window');
    gsap.fromTo(el, { scale: 0.97 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, .4)' });
    G.audio.play('tap');
    const now = Date.now();
    windowTaps = windowTaps.filter((t) => now - t < 5000);
    windowTaps.push(now);
    if (G.time.isNight()) {
      if (windowTaps.length >= 3 || U.chance(0.25)) { windowTaps = []; shootingStar(); }
    } else {
      // uma nuvem passa rapidinho
      const c = $('.cloud.c2');
      gsap.fromTo(c, { xPercent: -150 }, { xPercent: 260, duration: 2.2, ease: 'power1.inOut' });
    }
    if (G.petState.can('autonomous')) G.physics.faceTo(G.room.zones.window.cx);
  }

  function shootingStar() {
    const s = $('.shooting-star');
    gsap.killTweensOf(s);
    gsap.fromTo(s, { x: '-30%', y: 8, rotation: 18, opacity: 0, left: '0%', top: '10%' },
      { left: '70%', top: '55%', opacity: 1, duration: 0.9, ease: 'power2.in',
        onComplete: () => gsap.to(s, { opacity: 0, duration: 0.25 }) });
    G.audio.play('sparkle');
    G.bus.emit('objects:shootingStar');
    if (G.petState.activity !== 'sleeping') {
      setTimeout(() => {
        if (G.petState.can('autonomous')) { G.physics.faceTo(G.room.zones.window.cx); G.physics.hop(20); }
        G.bubble.show('star', { duration: 1500 });
        G.petState.emote('excited', 1600);
      }, 500);
    }
  }

  function lamp() {
    const on = !G.time.lampOn;
    G.time.setLamp(on);
    const lampEl = $('.lamp');
    gsap.fromTo(lampEl, { rotation: U.pick([-5, 5]) }, { rotation: 0, duration: 2, ease: 'elastic.out(1, .2)', transformOrigin: `50% ${-lampEl.offsetTop}px` });
    G.audio.play('click');
    G.bus.emit('objects:lamp', on);
    if (!on && G.time.isNight() && G.petState.activity !== 'sleeping' && G.petState.can('autonomous')) {
      setTimeout(() => G.bubble.show('moon', { duration: 1200 }), 500);
    }
  }

  function clockTap() {
    const el = $('.clock');
    gsap.fromTo(el, { rotation: -6 }, { rotation: 0, duration: 0.7, ease: 'elastic.out(1, .3)' });
    G.audio.play('tick');
    setTimeout(() => G.audio.play('tick'), 160);
  }

  function clockLong() {
    gsap.fromTo('.clock', { scale: 1.12 }, { scale: 1, duration: 0.6, ease: 'back.out(3)' });
    G.audio.play('chime');
    G.time.warp(7);
    G.bus.emit('objects:timewarp');
  }

  function picture() {
    pictureTilt = pictureTilt === 0 ? U.pick([-6, 6]) : 0;
    const el = $('.picture');
    gsap.to(el, { rotation: pictureTilt - 4, duration: 1.4, ease: 'elastic.out(1, .25)' });
    G.audio.play('tap');
    if (pictureTilt === 0) G.bus.emit('objects:pictureStraight');
  }

  function radio() {
    stationIdx = (stationIdx + 1) % STATIONS.length;
    const st = STATIONS[stationIdx];
    const el = $('.radio');
    gsap.fromTo(el, { scaleY: 0.86, scaleX: 1.08 }, { scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1, .35)' });
    G.audio.play('radio');
    clearInterval(notesTimer);
    if (st) {
      el.classList.add('on');
      G.audio.music.start(st);
      const z = G.room.zones.radio;
      notesTimer = setInterval(() => G.fx.spawn('note', z.cx + U.rand(-14, 14), z.y0 + 6), 1500);
    } else {
      el.classList.remove('on');
      G.audio.music.stop();
    }
    G.bus.emit('objects:radio', !!st);
  }

  G.objects = {
    init() {
      const I = G.interaction;
      I.register('bed', I.tap(bed));
      I.register('plant', I.tap(plant));
      I.register('window', I.tap(windowTap));
      I.register('lamp', I.tap(lamp));
      I.register('clock', I.tap(clockTap, { onLong: clockLong, longMs: 700 }));
      I.register('picture', I.tap(picture));
      I.register('radio', I.tap(radio));

      // nuvens passeando (GSAP)
      gsap.to('.cloud.c1', { xPercent: 340, duration: 70, ease: 'none', repeat: -1 });
      gsap.fromTo('.cloud.c2', { xPercent: -200 }, { xPercent: 200, duration: 95, ease: 'none', repeat: -1 });

      G.bus.on('music:beat', ({ beat }) => {
        gsap.fromTo('.radio', { scaleY: beat === 0 ? 0.93 : 0.96 }, { scaleY: 1, duration: 0.3, ease: 'power2.out', transformOrigin: '50% 100%' });
      });
      G.save.register('plant', {
        get: () => ({ bloom: $('.plant').classList.contains('bloom') }),
        set: (d) => { if (d?.bloom) $('.plant').classList.add('bloom'); }
      });
    },
    get radioOn() { return !!STATIONS[stationIdx]; },
    shootingStar
  };
})(window.Game = window.Game || {});
