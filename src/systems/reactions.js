/* ==========================================================================
   REAÇÕES — a personalidade do pet às ações do usuário
   Tocar, cutucar várias vezes, carinho, pegar, chacoalhar, arremessar,
   bater na parede, ser colocado em lugares específicos…
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  let taps = [];
  let sleepPokes = [];
  let petting = null;
  let roomTaps = [];
  let lastWallSound = 0;

  const ps = () => G.petState;
  const phys = () => G.physics;

  /* ---------------- tocar ---------------- */
  function onTap() {
    const now = Date.now();
    if (ps().activity === 'sleeping') return pokeSleeping(now);
    if (ps().activity === 'bathing') return;

    taps = taps.filter((t) => now - t < 4200);
    taps.push(now);
    const n = taps.length;
    G.progress.count('taps');

    if (ps().activity === 'eating') {
      phys().wobble(U.rand(-6, 6));
      G.audio.play('tap');
      if (n >= 3) G.bubble.show('anger', { duration: 900 });
      return;
    }

    if (n >= 7) {
      // chega!
      ps().emote('grumpy', 2400);
      G.bubble.show('anger', { duration: 1400 });
      G.audio.play('hiss');
      phys().hop(10);
      phys().face(-phys().facing);
      G.needs.add({ happiness: -0.8 }, 'annoyed');
      return;
    }
    if (n >= 4) {
      // cócegas
      ps().emote('excited', 1500);
      phys().hop(U.rand(22, 34));
      phys().wobble(U.pick([-14, 14]));
      G.bubble.show(U.pick(['!!', 'note', 'sparkle']), { duration: 900 });
      G.audio.play('meow', { short: true, pitch: 1.3 });
      G.needs.add({ happiness: 0.6 }, 'tickle');
      return;
    }
    // cutucão simples: reação imediata
    phys().hop(U.rand(12, 22));
    G.audio.play('boing', { intensity: 0.6, pitch: U.rand(0.9, 1.2) });
    if (Math.random() < 0.55) G.audio.play('meow', { short: Math.random() < 0.6 });
    if (Math.random() < 0.45) G.bubble.show(U.pick(['!', '?', 'note', 'love']), { duration: 1100 });
    if (Math.random() < 0.3) ps().emote('happy', 1400);
    G.needs.add({ happiness: 0.5 }, 'tap');
  }

  function pokeSleeping(now) {
    sleepPokes = sleepPokes.filter((t) => now - t < 5000);
    sleepPokes.push(now);
    if (sleepPokes.length < 3) {
      phys().wobble(U.rand(-4, 4));
      G.bubble.show(sleepPokes.length === 1 ? 'z' : 'dots', { duration: 1000 });
      G.audio.play('snore');
      return;
    }
    sleepPokes = [];
    G.behavior.wakeUp({ grumpy: G.needs.get('energy') < 45 });
  }

  /* ---------------- carinho (segurar parado) ---------------- */
  function startPetting() {
    const asleep = ps().activity === 'sleeping';
    petting = { start: Date.now(), gained: 0, asleep, timer: 0 };
    phys().purr(true);
    G.audio.purr(true);
    if (!asleep) ps().emote('happy', 60000);
    const tick = () => {
      if (!petting) return;
      const secs = (Date.now() - petting.start) / 1000;
      if (petting.gained < 18) {
        G.needs.add({ happiness: 1.2 }, 'petting');
        petting.gained += 1.2;
      }
      G.progress.addXp(G.config.progress.petXpPerSecond, 'petting');
      const p = phys().anchorPoint('top');
      if (secs > 1.6 && Math.random() < 0.55) G.fx.spawn(U.chance(0.25) ? 'heart' : 'sparkle', p.x + U.rand(-30, 30), p.y + 26, { size: 16 });
      if (secs > 4.5 && !petting.loved) { petting.loved = true; G.bubble.show('love', { duration: 1500 }); G.bus.emit('pet:pettingLong'); }
      // cochilo no carinho
      if (!asleep && secs > 8 && (G.time.isNight() || G.needs.get('energy') < 40) && !petting.sleepy) {
        petting.sleepy = true;
        G.bubble.show('z', { duration: 1500 });
        petting.fallAsleep = true;
      }
      petting.timer = setTimeout(tick, 1000);
    };
    petting.timer = setTimeout(tick, 600);
    G.bus.emit('pet:petting');
  }

  function endPetting(e = {}) {
    if (!petting) return;
    clearTimeout(petting.timer);
    const p = petting;
    petting = null;
    phys().purr(false);
    G.audio.purr(false);
    if (!p.asleep && ps().emotion === 'happy') ps().emote('happy', 1500);
    G.progress.count('pettingSeconds', Math.round((Date.now() - p.start) / 1000));
    if (p.fallAsleep && !e.interrupted) setTimeout(() => G.behavior.sleepNow({ here: true }), 300);
  }

  /* ---------------- pegar / soltar ---------------- */
  function onLift() {
    const a = ps().activity;
    if (a === 'sleeping') {
      ps().setActivity(null);
      ps().emote('grumpy', 2600);
      G.bubble.show('anger', { duration: 1300 });
      G.audio.play('hiss');
      G.needs.add({ happiness: -2 }, 'woken');
    } else if (a === 'eating' || a === 'playing') {
      ps().setActivity(null);
    } else if (Math.random() < 0.35) {
      G.audio.play('meow', { short: true, pitch: 1.35 });
    }
    phys().setPose('stand');
    G.audio.play('pop', { v: 0.6 });
    G.progress.count('lifts');
  }

  function onRelease(r) {
    if (r.speed > 1100) G.audio.play('whoosh', { intensity: U.clamp(r.speed / 2200, 0.4, 1) });
    if (r.thrown) G.progress.count('throws');
  }

  /* ---------------- chacoalhar ---------------- */
  function onShake({ count }) {
    G.progress.count('shakes');
    if (count === 1) {
      G.bubble.show('?!', { duration: 900 });
      G.audio.play('meow', { pitch: 1.4, short: true });
    } else {
      ps().emote('dizzy', 3800);
      G.bubble.show('stars', { duration: 1400 });
      G.needs.add({ happiness: -1 }, 'shaken');
    }
  }

  /* ---------------- impactos ---------------- */
  function onLand({ speed, bounce, kind }) {
    if (speed < 110) return;
    const k = U.clamp(speed / 1300, 0.15, 1.3);
    G.audio.play(bounce > 1 ? 'boing' : 'land', { intensity: k, pitch: bounce > 1 ? 1.2 : 1 });
    if (speed > 420 && bounce === 1) {
      const P = phys().P;
      const n = speed > 900 ? 4 : 2;
      for (let i = 0; i < n; i++) G.fx.spawn('dust', P.x + (i % 2 ? 1 : -1) * G.room.petW * 0.25, P.z - 4, { dir: i % 2 ? 1 : -1 });
    }
  }

  function onWall({ speed, side, x, z, h, axis }) {
    const now = Date.now();
    if (speed < 220 || now - lastWallSound < 160) return;
    lastWallSound = now;
    G.audio.play('thud', { intensity: U.clamp(speed / 1000, 0.3, 1.3) });
    if (axis === 'x') {
      const wx = side < 0 ? 8 : G.room.W - 8;
      const wy = z - h - G.room.petH * 0.5;
      G.fx.burst('star', wx, wy, speed > 700 ? 4 : 2, { angle: side < 0 ? 0 : Math.PI });
    }
    if (speed > 700) {
      G.bubble.show('stars', { duration: 1000 });
      G.needs.add({ happiness: -0.5 }, 'bonk');
      G.progress.count('wallHits');
    }
  }

  function onCeiling({ x }) {
    G.audio.play('thud', { intensity: 1 });
    G.fx.burst('star', x, G.room.geo.top + 6, 4, { angle: Math.PI / 2 });
    G.bubble.show('stars', { duration: 1200 });
    gsap.fromTo('#room', { y: -3 }, { y: 0, duration: 0.35, ease: 'elastic.out(1, .3)' });
  }

  /* ---------------- onde ele foi colocado ---------------- */
  function onSettled(e) {
    if (e.kind !== 'throw' && e.kind !== 'launch') return;
    if (G.bath.active) return;
    const { x, z, impact } = e;
    const Z = G.room.zones;

    // pancada forte: ou adorou, ou ficou tonto
    if (impact > 1000 && !e.ceiling) {
      if (G.needs.get('happiness') > 55 && Math.random() < 0.6) { ps().emote('excited', 1800); G.bubble.show('!!', { duration: 900 }); }
      else { ps().emote('dizzy', 2200); }
    }

    setTimeout(() => {
      if (!phys().isIdle() || ps().physical || ps().activity) return;

      // na caminha
      if (G.room.nearBed(x, z)) {
        G.bus.emit('pet:placed', { where: 'bed' });
        if (G.needs.get('energy') < 55 || G.time.isNight()) { G.behavior.sleepNow({ onBed: true }); return; }
        // se ajeita no meio da caminha e fica feliz
        phys().jumpTo(Z.bed.cx, Z.bed.seatZ, { height: 12, kind: 'jump' }).then((ok) => {
          if (!ok) return;
          phys().setPose('loaf');
          ps().emote('happy', 2200);
          G.bubble.show(U.pick(['love', 'note']), { duration: 1200 });
        });
        return;
      }

      // perto do pote
      const bowlD = Math.hypot(x - Z.bowl.cx, z - Z.bowl.cz);
      if (bowlD < G.room.petW * 0.85) {
        phys().faceTo(Z.bowl.cx);
        if (G.food.hasFood()) { G.food.goEat(); return; }
        G.bubble.show(G.needs.get('hunger') < 60 ? 'food' : '?', { duration: 1400 });
        G.bus.emit('pet:placed', { where: 'bowl' });
        return;
      }

      // perto de um brinquedo
      const nt = G.play.nearestToy(x, z);
      if (nt && nt.dist < G.room.petW * 0.7) {
        phys().faceTo(nt.toy.x);
        G.bubble.show(U.pick(['?', 'ball']), { duration: 1100 });
        if (G.petState.can('play') && Math.random() < 0.55) setTimeout(() => G.play.playAlone(), 700);
        G.bus.emit('pet:placed', { where: 'toy' });
        return;
      }

      // perto do rádio tocando
      if (G.objects.radioOn && Math.abs(x - Z.radio.cx) < G.room.W * 0.28 && z < G.room.geo.zMin + 90) {
        G.behavior.startDancing();
        G.bus.emit('pet:placed', { where: 'radio' });
        return;
      }

      // embaixo da janela
      if (x > Z.window.x0 && x < Z.window.x1 && z < G.room.geo.zMin + 60) {
        G.behavior.lookAtWindow();
        G.bus.emit('pet:placed', { where: 'window' });
        return;
      }

      if (impact < 700 && Math.random() < 0.5) {
        phys().wobble(U.rand(-8, 8));
        if (Math.random() < 0.4) G.bubble.show(U.pick(['note', '!', 'dots']), { duration: 900 });
      }
    }, 260);
  }

  /* ---------------- toque no quarto vazio ---------------- */
  function onRoomTap({ x, y }) {
    const now = Date.now();
    roomTaps = roomTaps.filter((t) => now - t < 3000);
    roomTaps.push(now);
    if (!ps().can('autonomous')) return;
    phys().faceTo(x);
    const geo = G.room.geo;
    if (y >= geo.zMin - 20 && (roomTaps.length >= 2 || Math.random() < 0.4)) {
      const p = G.room.clampFloor(x, y);
      if (!G.room.inFootprint('tub', p.x, p.z, 10)) {
        G.bubble.show('!', { duration: 600 });
        phys().walkTo(p.x, p.z, { run: roomTaps.length >= 3 });
      }
    } else if (Math.random() < 0.35) {
      G.bubble.show('?', { duration: 800 });
    }
  }

  function onFoodServed() {
    if (!ps().can('eat') || ps().activity === 'playing') return;
    setTimeout(async () => {
      if (!ps().can('eat')) return;
      G.bubble.show('!', { duration: 700 });
      phys().faceTo(G.room.zones.bowl.cx);
      await phys().hop(16);
      await U.wait(150);
      G.food.goEat();
    }, 350);
  }

  G.reactions = {
    init() {
      const b = G.bus;
      b.on('pet:tap', onTap);
      b.on('pet:pettingStart', startPetting);
      b.on('pet:pettingEnd', endPetting);
      b.on('pet:lift', onLift);
      b.on('pet:release', onRelease);
      b.on('physics:shake', onShake);
      b.on('physics:land', onLand);
      b.on('physics:wall', onWall);
      b.on('physics:ceiling', onCeiling);
      b.on('physics:settled', onSettled);
      b.on('physics:flip', () => G.audio.play('whoosh', { intensity: 0.8 }));
      b.on('room:tap', onRoomTap);
      b.on('food:served', onFoodServed);
    },
    get petting() { return !!petting; }
  };
})(window.Game = window.Game || {});
