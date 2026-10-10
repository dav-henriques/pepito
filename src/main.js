/* ==========================================================================
   MAIN — inicialização
   Ordem: medir o quarto → carregar save → iniciar sistemas → progresso
   offline → carregar imagens → entrada do pet.
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  function fail(msg) {
    const l = document.getElementById('loader');
    l.innerHTML = '';
    l.appendChild(U.h('p', { class: 'boot-error', text: msg }));
  }

  async function boot() {
    if (!window.gsap || !window.anime || !window.anime.animate) {
      fail('Não consegui carregar as animações (GSAP / Anime.js). Verifique a conexão e recarregue.');
      return;
    }
    if (U.reducedMotion) gsap.globalTimeline.timeScale(0.9);

    const $ = (id) => document.getElementById(id);
    const petEl = $('pet');

    // ---------- componentes base ----------
    G.fx.init($('fx'));
    G.bubble.init(petEl.querySelector('.pet-bubble'));
    G.room.init();

    // ---------- save ----------
    const saved = G.save.load();
    let savedPos = null;

    // ---------- sistemas ----------
    G.audio.init();
    G.time.init();
    G.needs.init();
    G.progress.init();
    G.petState.init();
    G.cutout.init();
    G.physics.init({
      root: petEl,
      rot: petEl.querySelector('.pet-rot'),
      squash: petEl.querySelector('.pet-squash'),
      face: petEl.querySelector('.pet-face'),
      shadow: $('pet-shadow')
    });
    G.save.register('pet', {
      get: () => ({ x: G.physics.P.x / G.room.W, z: G.physics.P.z / G.room.H, face: G.physics.facing }),
      set: (d) => { savedPos = d; }
    });
    G.anim.init();
    G.interaction.init();
    G.food.init();
    G.bath.init();
    G.play.init();
    G.reactions.init();
    G.express.init();
    G.behavior.init();
    G.objects.init();
    G.hud.init();
    G.customize.init();

    // ---------- progresso offline ----------
    const hoursAway = saved.elapsedMs / 3600000;
    let startAsleep = G.petState.activity === 'sleeping';
    if (!saved.isNew && saved.elapsedMs > 60000) {
      G.needs.applyOffline(saved.elapsedMs);
      const o = G.config.offline;
      if (hoursAway > o.sleepAfterHours && (G.time.isNight() || G.needs.get('energy') < 60 || Math.random() < 0.5)) startAsleep = true;
      if (G.time.isNight() && hoursAway > 0.75 && G.needs.get('energy') < 70) startAsleep = true;
    }
    G.petState.refreshCondition();

    // ---------- posição inicial ----------
    const geo = G.room.geo;
    const Z = G.room.zones;
    let dropIn = false;
    if (startAsleep) {
      G.physics.place(Z.bed.cx, Z.bed.seatZ);
      G.physics.setPose('loaf');
      if (G.petState.activity !== 'sleeping') G.petState.setActivity('sleeping');
    } else {
      if (G.petState.activity === 'sleeping') G.petState.setActivity(null);
      if (savedPos && typeof savedPos.x === 'number') {
        const p = G.room.clampFloor(savedPos.x * G.room.W, savedPos.z * G.room.H);
        const inTub = G.room.inFootprint('tub', p.x, p.z, 10);
        G.physics.place(inTub ? G.room.W * 0.5 : p.x, inTub ? (geo.zMin + geo.zMax) / 2 : p.z);
        if (savedPos.face) G.physics.face(savedPos.face, true);
      } else {
        dropIn = true;
        G.physics.place(G.room.W * 0.5, (geo.zMin + geo.zMax) / 2 + 20, G.room.H * 0.62);
      }
    }

    // ---------- imagens ----------
    // não segura o jogo esperando todas as imagens: as que faltarem carregam em segundo plano
    await Promise.race([G.anim.preload(), U.wait(2000)]);
    await G.anim.showInitial();
    G.physics.render();
    G.save.start();
    G.save.soon(500);

    // ---------- entrada ----------
    const loader = $('loader');
    gsap.to(loader, { opacity: 0, duration: 0.45, ease: 'power2.out', onComplete: () => loader.remove() });
    // os móveis "caem" no lugar (as duas camadas de cama/banheira juntas)
    const order = (el) => (el.classList.contains('bed') ? 0 : el.classList.contains('bowl') ? 1 : 2);
    gsap.from('.bed, .bowl, .tub-back, .tub-front', {
      y: -18, opacity: 0, duration: 0.6, ease: 'back.out(2)', delay: 0.05, stagger: (i, el) => order(el) * 0.07
    });
    G.hud.intro();

    if (dropIn) {
      // primeira vez: ele "cai" no quarto — física desde o primeiro segundo
      gsap.set('#pet, #pet-shadow', { opacity: 0 });
      setTimeout(() => {
        gsap.to('#pet, #pet-shadow', { opacity: 1, duration: 0.15 });
        G.physics.launch(0, 0, 0, { kind: 'intro' }).then(() => {
          G.bubble.show('!', { duration: 1200 });
          G.audio.play('meow');
          G.petState.emote('excited', 1600);
          setTimeout(() => G.express.say('hello'), 1500);
        });
      }, 650);
      setTimeout(() => {
        if (!G.progress.stats.taps) G.hud.hintOnce('tap', `toque no ${G.config.pet.name}`);
      }, 6500);
    } else if (!startAsleep) {
      setTimeout(() => {
        G.physics.hop(hoursAway > 1 ? 26 : 14);
        if (hoursAway > 1) {
          G.petState.emote('excited', 1800);
          G.bubble.show('love', { duration: 1500 });
          G.audio.play('meow', { pitch: 1.1 });
          setTimeout(() => G.express.say('hello'), 2000);
        } else if (Math.random() < 0.5) {
          G.bubble.show(U.pick(['!', 'note']), { duration: 1000 });
        }
      }, 900);
    }

    // dica (uma vez) de que dá pra pegar no colo
    G.bus.once('pet:tap', () => {
      setTimeout(() => {
        if (!G.progress.stats.lifts) G.hud.hintOnce('lift', 'dá pra pegar ele no colo…');
      }, 9000);
    });

    // pequeno "bom dia / boa noite" ao mudar de período com o jogo aberto
    G.bus.on('time:phase', ({ phase, prev }) => {
      if (!prev) return;
      if (phase === 'night' && G.petState.activity !== 'sleeping') G.bubble.show('moon', { duration: 1500 });
      if (phase === 'morning' && G.petState.activity === 'sleeping' && G.needs.get('energy') > 60) G.behavior.wakeUp();
    });

    // atalho para testes: window.Game no console
    if (U.param('debug') === '1') console.info('[Pepito] modo debug — use window.Game no console');
  }

  try {
    boot().catch((e) => { console.error(e); fail('Algo deu errado ao iniciar. Recarregue a página.'); });
  } catch (e) {
    console.error(e);
    fail('Algo deu errado ao iniciar. Recarregue a página.');
  }
})(window.Game = window.Game || {});
