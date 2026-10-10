/* ==========================================================================
   MÓVEIS INTERATIVOS (GSAP)
   Cama: toque → ela afunda; se ele estiver cansado (ou for noite) vai dormir.
   (Pote → food.js · Banheira → bath.js · Brinquedos → play.js)
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
      if (G.needs.get('energy') < 60 || G.time.isNight()) G.behavior.sleepNow();
      else if (U.chance(0.5)) G.bubble.show('?', { duration: 800 });
    }
  }

  G.objects = {
    init() {
      G.interaction.register('bed', G.interaction.tap(bed));
    }
  };
})(window.Game = window.Game || {});
