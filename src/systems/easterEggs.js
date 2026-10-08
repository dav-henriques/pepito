/* ==========================================================================
   EASTER EGGS
   --------------------------------------------------------------------------
   Arquitetura: cada segredo é registrado com um id, um título (que só
   aparece depois de descoberto) e um "listen(found)" que observa eventos
   do jogo e chama found() quando a condição acontece.
   O efeito pode rodar sempre; a descoberta só é anunciada uma vez.

   Para criar um novo:
     G.eggs.register({
       id: 'meuSegredo', title: 'nome bonitinho',
       listen(found) { G.bus.on('algum:evento', (e) => { if (cond) found(); }); },
       effect() { ...opcional... }
     });
   (não há lista de dicas em lugar nenhum — de propósito)
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  const eggs = new Map();
  let found = {};
  const cooldowns = {};

  function announce(egg) {
    const total = eggs.size;
    const n = Object.keys(found).length;
    G.hud.toast(`segredo descoberto · ${n}/${total}`, 'sparkle');
    G.audio.play('chime');
    const p = G.physics.anchorPoint('top');
    G.fx.burst('sparkle', p.x, p.y + 20, 8, { spread: 1.4 });
    G.progress.addXp(5, 'egg:' + egg.id);
  }

  function trigger(id, data) {
    const egg = eggs.get(id);
    if (!egg) return;
    const now = Date.now();
    if (cooldowns[id] && now < cooldowns[id]) return;
    cooldowns[id] = now + (egg.cooldown ?? 4000);
    if (egg.effect) { try { egg.effect(data); } catch (e) { console.warn('[egg]', id, e); } }
    if (!found[id]) {
      found[id] = Date.now();
      announce(egg);
      G.bus.emit('egg:found', { id, count: Object.keys(found).length, total: eggs.size });
      G.save.soon();
    }
  }

  /* ======================================================================
     SEGREDOS
     ====================================================================== */
  const ps = () => G.petState;
  const phys = () => G.physics;

  const LIST = [
    {
      id: 'zoomies', title: 'surto de energia', cooldown: 20000,
      listen(f) {
        let taps = [];
        G.bus.on('pet:tap', () => {
          const now = Date.now();
          taps = taps.filter((t) => now - t < 5000);
          taps.push(now);
          if (taps.length >= 12) { taps = []; f(); }
        });
      },
      async effect() {
        await U.wait(600);
        if (ps().physical || ps().activity) return;
        ps().emote('excited', 6000);
        G.bubble.show('!!', { duration: 900 });
        const geo = G.room.geo;
        for (let i = 0; i < 5; i++) {
          const x = i % 2 ? geo.minX + 10 : geo.maxX - 10;
          const ok = await phys().walkTo(x, U.rand(geo.zMin + 20, geo.zMax - 10), { run: true, speedMul: 1.9, hopMul: 1.3 });
          if (!ok) return;
          G.fx.burst('dust', phys().P.x, phys().P.z - 4, 3, { jitter: 10 });
        }
        phys().setPose('lie');
        G.bubble.show('dots', { duration: 1500 });
        G.needs.add({ energy: -6, happiness: 6 }, 'zoomies');
        setTimeout(() => phys().setPose('stand'), 2500);
      }
    },
    {
      id: 'centrifuge', title: 'centrífuga',
      listen(f) { G.bus.on('physics:shake', ({ count }) => { if (count >= 3) f(); }); }
    },
    {
      id: 'wish', title: 'pedido à estrela', cooldown: 10000,
      listen(f) { G.bus.on('objects:shootingStar', f); },
      effect() { G.needs.add({ happiness: 5 }, 'wish'); }
    },
    {
      id: 'dancer', title: 'pé de valsa',
      listen(f) { G.bus.on('behavior:dance', f); }
    },
    {
      id: 'weirdMenu', title: 'cardápio estranho', cooldown: 15000,
      listen(f) {
        G.bus.on('toy:rest', (t) => {
          const z = G.room.zones.bowl;
          if (Math.abs(t.x - z.cx) < z.w * 0.45 && Math.abs(t.z - z.cz) < 26) f(t);
        });
      },
      async effect(t) {
        if (!ps().can('autonomous')) return;
        const s = G.food.eatSpot();
        const ok = await phys().walkTo(s.x, s.z);
        if (!ok) return;
        phys().faceTo(s.faceX);
        G.bubble.show('?', { duration: 1200 });
        await U.wait(900);
        phys().squash(0.1);
        G.audio.play('munch');
        await U.wait(400);
        G.bubble.show('?!', { duration: 1000 });
        ps().emote('grumpy', 1500);
      }
    },
    {
      id: 'cannonball', title: 'bomba!',
      listen(f) { G.bus.on('bath:cannonball', f); },
      effect() {
        const z = G.room.zones.tub;
        for (let i = 0; i < 16; i++) G.fx.spawn('drop', z.cx + U.rand(-60, 60), z.rimY, { vx: U.rand(-320, 320), vy: U.rand(-600, -300) });
        gsap.fromTo('#room', { y: 4 }, { y: 0, duration: 0.5, ease: 'elastic.out(1, .3)' });
      }
    },
    {
      id: 'astronaut', title: 'astronauta',
      listen(f) { G.bus.on('physics:ceiling', f); }
    },
    {
      id: 'knock', title: 'toc toc',
      listen(f) { G.bus.on('behavior:knock', f); }
    },
    {
      id: 'gardener', title: 'mão verde',
      listen(f) { G.bus.on('objects:plantFrenzy', f); },
      effect() {
        const p = document.querySelector('.plant');
        if (p.classList.contains('bloom')) return;
        p.classList.add('bloom');
        gsap.fromTo(p.querySelector('.plant-flower'), { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.8, ease: 'back.out(2.5)' });
        G.save.soon();
      }
    },
    {
      id: 'whereIsIt', title: 'cadê o pontinho?', cooldown: 8000,
      listen(f) {
        let acc = 0;
        setInterval(() => {
          const L = G.play.laser;
          if (!L || ps().physical) { acc = 0; return; }
          const r = document.getElementById('pet').getBoundingClientRect();
          const p = G.room.toLocal(r.left, r.top);
          const inside = L.x > p.x + r.width * 0.15 && L.x < p.x + r.width * 0.85 && L.y > p.y + r.height * 0.1 && L.y < p.y + r.height * 0.95;
          acc = inside ? acc + 200 : 0;
          if (acc >= 1200) { acc = 0; f(); }
        }, 200);
      },
      async effect() {
        G.play.endSession('interrupted');
        G.bubble.show('?!', { duration: 1000 });
        await phys().spin(2);
        await phys().spin(-1);
        G.bubble.show('dots', { duration: 1000 });
      }
    },
    {
      id: 'timeTraveler', title: 'viajante do tempo',
      listen(f) { G.bus.on('objects:timewarp', f); }
    },
    {
      id: 'chubby', title: 'barriguinha', cooldown: 60000,
      listen(f) { G.bus.on('food:treatCombo', f); },
      effect() {
        setTimeout(() => {
          phys().setPose('chubby');
          G.bubble.show('dots', { duration: 1200 });
          setTimeout(() => { if (phys().isIdle()) phys().setPose('stand'); }, 40000);
        }, 4500);
      }
    },
    {
      id: 'acrobat', title: 'acrobata',
      listen(f) { G.bus.on('physics:flip', () => setTimeout(f, 700)); }
    },
    {
      id: 'thief', title: 'ladrãozinho',
      listen(f) { G.bus.on('play:steal', f); }
    },
    {
      id: 'pinball', title: 'pinball',
      listen(f) {
        let hits = [];
        G.bus.on('physics:wall', (e) => {
          if (e.dragging) return;
          const now = Date.now();
          hits = hits.filter((t) => now - t < 1600);
          hits.push(now);
          if (hits.length >= 3) { hits = []; f(); }
        });
      }
    },
    {
      id: 'lullaby', title: 'dormiu no colo',
      listen(f) { G.bus.on('behavior:sleep', (info) => { if (G.reactions && info && !info.onBed && G.time.isNight()) f(); }); }
    }
  ];

  G.eggs = {
    init() {
      G.save.register('eggs', { get: () => ({ ...found }), set: (d) => { found = d || {}; } });
      for (const e of LIST) this.register(e);
    },
    register(egg) {
      eggs.set(egg.id, egg);
      egg.listen((data) => trigger(egg.id, data));
    },
    trigger,
    get found() { return { ...found }; },
    get total() { return eggs.size; },
    list() { return [...eggs.values()].map((e) => ({ id: e.id, title: e.title, found: !!found[e.id] })); }
  };
})(window.Game = window.Game || {});
