/* ==========================================================================
   REAÇÕES — a personalidade do pet às ações do usuário
   Tocar, cutucar várias vezes, carinho, pegar, chacoalhar, arremessar,
   bater na parede, ser colocado em lugares específicos, pelúcia…
   Reação nova à pelúcia: adicione uma função em PLUSH e um peso em
   personal.js → plushieReactions.
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  let taps = [];
  let sleepPokes = [];
  let petting = null;
  let roomTaps = [];
  let lastWallSound = 0;
  let lastStartle = 0;
  let plushBusy = false;
  let lastPlush = 0;

  const ps = () => G.petState;
  const phys = () => G.physics;

  /* ---------------- susto exagerado ---------------- */
  function startle() {
    lastStartle = Date.now();
    ps().emote('startled', 1400);
    G.anim.flash();
    phys().launch(U.rand(-90, 90), 0, Math.sqrt(2 * G.config.physics.gravity * 78), { kind: 'startle' });
    G.bubble.show('!!', { duration: 1000 });
    G.audio.play('meow', { pitch: 1.5, short: true });
    G.audio.play('boing', { intensity: 1, pitch: 1.35 });
    gsap.fromTo('#room', { x: -4 }, { x: 0, duration: 0.45, ease: 'elastic.out(1, .3)' });
    const p = phys().anchorPoint('eyes');
    G.fx.spawn('impact', p.x, p.y, { size: 96 });
    G.bus.emit('pet:startled');
  }

  /* ---------------- tocar ---------------- */
  function onTap() {
    const now = Date.now();
    if (ps().activity === 'sleeping') return pokeSleeping(now);
    if (ps().activity === 'bathing') return;

    // estava encarando você → levou um susto ("você piscou primeiro")
    if (G.behavior.staring) { G.behavior.breakStare(); return; }

    taps = taps.filter((t) => now - t < 4200);
    taps.push(now);
    const n = taps.length;
    G.progress.count('taps');

    const B = G.config.behavior;
    if (n === 1 && !ps().activity && phys().isIdle() && now - lastStartle > (B.startleCooldown || 45000) && U.chance(B.startleChance ?? 0.08)) {
      startle();
      return;
    }

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
    const secs = (Date.now() - p.start) / 1000;
    G.progress.count('pettingSeconds', Math.round(secs));
    if (p.fallAsleep && !e.interrupted) { setTimeout(() => G.behavior.sleepNow({ here: true }), 300); return; }
    // gostou do carinho: pulinho de agradecimento + coraçãozinho
    if (!p.asleep && !e.interrupted && secs > 1.2) {
      setTimeout(() => {
        if (!phys().isIdle() || ps().physical) return;
        phys().hop(U.rand(12, 18));
        const h = phys().anchorPoint('top');
        G.fx.spawn('heart', h.x + U.rand(-12, 12), h.y + 22, { size: 20 });
        if (secs > 4 && Math.random() < 0.5) G.audio.play('meow', { short: true, pitch: 1.15 });
      }, 120);
    }
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
    G.audio.play('peel');            // som de adesivo descolando do papel
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
    if (bounce === 1 && speed > 700) G.haptic(speed > 1250 ? 22 : 12);
    if (speed > 420 && bounce === 1) {
      const P = phys().P;
      const n = speed > 900 ? 4 : 2;
      for (let i = 0; i < n; i++) G.fx.spawn('dust', P.x + (i % 2 ? 1 : -1) * G.room.petW * 0.25, P.z - 4, { dir: i % 2 ? 1 : -1 });
      // pancada forte: estrela de HQ + tremidinha do quarto
      if (speed > 1250 && kind !== 'startle') {
        G.fx.spawn('impact', P.x, P.z - G.room.petH * 0.18, { size: U.clamp(speed / 18, 70, 120) });
        gsap.fromTo('#room', { y: 3 }, { y: 0, duration: 0.35, ease: 'elastic.out(1, .3)' });
      }
    }
  }

  function onWall({ speed, side, x, z, h, axis }) {
    const now = Date.now();
    if (speed < 220 || now - lastWallSound < 160) return;
    lastWallSound = now;
    G.audio.play('thud', { intensity: U.clamp(speed / 1000, 0.3, 1.3) });
    if (speed > 400) G.haptic(speed > 800 ? 18 : 10);
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
    G.haptic(16);
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
        // colocou na caminha = hora de dormir (descansado: só uma soneca)
        G.bubble.show('moon', { duration: 900 });
        G.behavior.sleepNow({ onBed: true, nap: !G.behavior.sleepyEnough() });
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

      // perto da pelúcia
      const plush = G.play.toys.plush;
      if (plush && !plush.dragging && Math.hypot(x - plush.x, z - plush.z) < G.room.petW * 0.75) {
        plushReaction(plush, 'placed');
        return;
      }

      // perto de um brinquedo
      const nt = G.play.nearestToy(x, z, (t) => t.def.chase !== false);
      if (nt && nt.dist < G.room.petW * 0.7) {
        phys().faceTo(nt.toy.x);
        G.bubble.show(U.pick(['?', 'ball']), { duration: 1100 });
        if (G.petState.can('play') && Math.random() < 0.55) setTimeout(() => G.play.playAlone(), 700);
        G.bus.emit('pet:placed', { where: 'toy' });
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

  /* ---------------- pelúcia ---------------- */
  const PLUSH = {
    /** cheira desconfiado… e decide se gostou */
    async sniff(t) {
      phys().faceTo(t.x);
      if (!t.dragging && Math.abs(t.x - phys().P.x) > G.room.petW * 0.55) {
        const side = Math.sign(phys().P.x - t.x) || 1;
        if (!(await phys().walkTo(t.x + side * G.room.petW * 0.42, t.z))) return;
        phys().faceTo(t.x);
      }
      phys().setPose('crouch');
      ps().emote('confused', 2400);
      G.bubble.show('?', { duration: 900 });
      for (let i = 0; i < 3; i++) { phys().wobble((i % 2 ? 1 : -1) * U.rand(2, 4)); await U.wait(280); }
      phys().setPose('stand');
      if (U.chance(0.55)) { ps().emote('happy', 1800); G.bubble.show('note', { duration: 1000 }); }
      else { ps().emote('grumpy', 1600); G.bubble.show('?!', { duration: 1000 }); }
      setTimeout(() => G.express.maybe('plushie', 0.6), 1100);
    },
    /** olha… e vira a cara com o nariz empinado */
    async ignore(t) {
      phys().faceTo(t.x);
      ps().emote('staring', 1300);
      await U.wait(1000);
      phys().face(-(Math.sign(t.x - phys().P.x) || 1));
      phys().setPose('tall');
      phys().hop(8);
      G.bubble.show('dots', { duration: 1200 });
      setTimeout(() => G.express.maybe('ignoreToy', 0.7), 900);
      await U.wait(1700);
      if (phys().isIdle()) phys().setPose('stand');
    },
    /** abraça e ronrona */
    async hug(t) {
      const side = Math.sign(phys().P.x - t.x) || 1;
      if (!(await phys().walkTo(t.x + side * G.room.petW * 0.32, t.z))) return;
      phys().faceTo(t.x);
      await phys().jumpTo(t.x + side * G.room.petW * 0.14, t.z + 2, { height: 16, kind: 'jump' });
      phys().setPose('loaf');
      ps().emote('happy', 3400);
      phys().purr(true); G.audio.purr(true);
      const p = phys().anchorPoint('top');
      G.fx.burst('sparkle', p.x, p.y + 24, 5);
      await U.wait(2600);
      phys().purr(false); G.audio.purr(false);
      if (phys().isIdle()) phys().setPose('stand');
      setTimeout(() => G.express.maybe('plushie', 0.6), 300);
    },
    /** dá o bote e chuta longe */
    async attack(t) {
      phys().faceTo(t.x);
      phys().setPose('crouch');
      G.bubble.show('!', { duration: 600 });
      await U.wait(340);
      phys().setPose('stand');
      ps().emote('excited', 1700);
      if (t.dragging) {
        await phys().hop(34);
        G.play.steal(t);
      } else {
        const side = Math.sign(t.x - phys().P.x) || 1;
        await phys().jumpTo(t.x - side * G.room.petW * 0.16, t.z, { height: 30, kind: 'pounce' });
        G.play.kick(t, side, 1.1);
      }
      G.bubble.show('!!', { duration: 900 });
    }
  };

  async function plushReaction(t, how) {
    const now = Date.now();
    if (plushBusy || now - lastPlush < 5000) return false;
    const a = ps().activity;
    if (a === 'sleeping' || a === 'bathing' || a === 'eating' || ps().physical || G.bath.active) return false;
    if (G.play.session) G.play.endSession('interrupted');
    plushBusy = true;
    lastPlush = now;
    try {
      const w = { ...((G.personal && G.personal.plushieReactions) || { sniff: 4, ignore: 3, hug: 2, attack: 2 }) };
      if (G.needs.get('energy') < 30) { w.attack = 0; w.hug = (w.hug || 0) * 2; }
      if (t.dragging) w.hug = 0;
      const kind = U.weighted(w);
      G.bus.emit('plush:reaction', { kind, how });
      if (PLUSH[kind]) await PLUSH[kind](t);
    } catch (e) { console.warn('[plush]', e); }
    finally { plushBusy = false; }
    return true;
  }

  G.reactions = {
    plush: plushReaction,
    PLUSH,
    startle,

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
