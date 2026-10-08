/* ==========================================================================
   COMPORTAMENTO AUTÔNOMO — o "cérebro"
   O pet não fica parado esperando: de tempos em tempos escolhe uma ação
   (pesos no petConfig.behavior.weights), reage às necessidades, dorme,
   pede comida, olha a janela, dança com o rádio…
   Ação nova: crie uma função em ACTIONS e dê um peso no config.
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  let busy = false;
  let nextIdleAt = Date.now() + 3500;
  let pauseUntil = 0;
  let sleepInfo = null;
  let dancing = false;
  let lastBeg = 0;
  let lastPatience = 0;
  let lastNeedHint = 0;

  const ps = () => G.petState;
  const phys = () => G.physics;
  const cfg = () => G.config.behavior;

  /** Executa uma ação assíncrona marcando o cérebro como ocupado */
  async function run(fn) {
    if (busy) return false;
    busy = true;
    try { return await fn(); }
    catch (e) { console.warn('[behavior]', e); return false; }
    finally { busy = false; }
  }

  function free() {
    return !busy && ps().can('autonomous') && !G.bath.active && !G.interaction.isActive;
  }

  function scheduleIdle(mult = 1) {
    nextIdleAt = Date.now() + U.rand(cfg().idleMin, cfg().idleMax) * mult;
  }

  /* ======================================================================
     AÇÕES ESPONTÂNEAS
     ====================================================================== */
  const ACTIONS = {
    async wander() {
      const P = phys().P;
      const span = G.room.W * 0.45;
      const p = G.room.randomFloorPoint({ x0: Math.max(G.room.geo.minX, P.x - span), x1: Math.min(G.room.geo.maxX, P.x + span) });
      const ok = await phys().walkTo(p.x, p.z, { run: ps().condition === 'playful' && U.chance(0.3) });
      if (ok && U.chance(0.35)) { phys().setPose('sit'); await U.wait(U.rand(1800, 3800)); if (free()) phys().setPose('stand'); }
      return ok;
    },

    async lookAround() {
      const f = phys().facing;
      phys().face(-f);
      await U.wait(U.rand(700, 1300));
      if (!free()) return false;
      phys().wobble(U.rand(-5, 5));
      await U.wait(U.rand(500, 1000));
      if (!free()) return false;
      phys().face(f);
      return true;
    },

    async sit() {
      phys().setPose(U.chance(0.3) ? 'loaf' : 'sit');
      await U.wait(U.rand(3000, 7000));
      if (free()) phys().setPose('stand');
      return true;
    },

    async stretch() {
      if (G.needs.get('energy') < 50) G.audio.play('yawn');
      await phys().stretchPose();
      return true;
    },

    async lookAtObject() {
      const Z = G.room.zones;
      const toys = Object.values(G.play.toys);
      const targets = [
        { x: Z.window.cx, tag: 'window' }, { x: Z.radio.cx, tag: 'radio' }, { x: Z.plant.cx, tag: 'plant' },
        { x: Z.lamp.cx, tag: 'lamp' }, ...toys.map((t) => ({ x: t.x, tag: 'toy' }))
      ];
      const t = U.pick(targets);
      phys().faceTo(t.x);
      await U.wait(300);
      phys().wobble(U.rand(-7, 7));
      if (U.chance(0.4)) G.bubble.show(t.tag === 'toy' ? 'ball' : '?', { duration: 1100 });
      await U.wait(U.rand(900, 1600));
      return true;
    },

    async playAlone() {
      if (!ps().can('play') || G.needs.get('energy') < 40) return false;
      return G.play.playAlone();
    },

    async lookAtUser() {
      const geo = G.room.geo;
      const p = G.room.randomFloorPoint({ x0: G.room.W * 0.3, x1: G.room.W * 0.7, z0: geo.zMax - 40, z1: geo.zMax - 4 });
      const ok = await phys().walkTo(p.x, p.z);
      if (!ok) return false;
      phys().setPose('sit');
      await U.wait(400);
      phys().hop(12);
      G.bubble.show(U.pick(['note', '!', 'love', 'dots']), { duration: 1300 });
      if (U.chance(0.5)) G.audio.play('meow');
      await U.wait(2400);
      if (free()) phys().setPose('stand');
      return true;
    },

    async chaseTail() {
      if (G.needs.get('energy') < 45) return false;
      G.bubble.show('?', { duration: 700 });
      await U.wait(500);
      await phys().spin(U.pick([-2, 2]));
      if (U.chance(0.5)) await phys().spin(U.pick([-1, 1]));
      G.bubble.show(U.pick(['stars', 'dots']), { duration: 1000 });
      G.bus.emit('behavior:chaseTail');
      return true;
    },

    async windowWatch() { return lookAtWindow(); },

    async groomShake() {
      phys().wobble(6);
      await U.wait(300);
      await phys().shakeOff();
      return true;
    },

    async nap() {
      if (G.needs.get('energy') > 60 && !G.time.isNight()) return false;
      return sleepNow({ nap: true });
    },

    async dance() {
      if (!G.objects.radioOn) return false;
      return goDance();
    }
  };

  /* ======================================================================
     SONO
     ====================================================================== */
  async function sleepNow(opts = {}) {
    if (ps().activity === 'sleeping' || ps().physical || G.bath.active) return false;
    {
      const Z = G.room.zones;
      const P = phys().P;
      let onBed = G.room.inFootprint('bed', P.x, P.z, 4);
      if (!onBed && !opts.here && G.room.nearBed(P.x, P.z)) {
        const ok = await phys().jumpTo(Z.bed.cx, Z.bed.seatZ, { height: 14, kind: 'jump' });
        if (!ok) return false;
        onBed = true;
      }
      if (!opts.here && !onBed) {
        const front = G.room.clampFloor(Z.bed.cx + G.room.petW * 0.35, Z.bed.y1 + 8);
        G.bubble.show('moon', { duration: 1100 });
        const ok = await phys().walkTo(front.x, front.z);
        if (!ok) return false;
        const ok2 = await phys().jumpTo(Z.bed.cx, Z.bed.seatZ, { height: 26, kind: 'jump' });
        if (!ok2) return false;
        onBed = true;
      } else if (onBed && !opts.here) {
        const ok = await phys().jumpTo(Z.bed.cx, Z.bed.seatZ, { height: 14, kind: 'jump' });
        if (!ok) return false;
      }
      if (ps().physical || ps().activity === 'bathing') return false;
      phys().face(U.pick([-1, 1]));
      G.audio.play('yawn');
      await phys().stretchPose();
      if (ps().physical) return false;
      phys().setPose('loaf');
      ps().setActivity('sleeping');
      sleepInfo = { since: Date.now(), nap: !!opts.nap, onBed };
      G.bus.emit('behavior:sleep', sleepInfo);
      return true;
    }
  }

  function wakeUp(opts = {}) {
    if (ps().activity !== 'sleeping') return;
    const info = sleepInfo;
    sleepInfo = null;
    ps().setActivity(null);
    phys().setPose('stand');
    if (opts.grumpy) {
      ps().emote('grumpy', 2600);
      G.bubble.show('anger', { duration: 1300 });
      G.audio.play('hiss');
    } else {
      G.audio.play('yawn');
      phys().stretchPose().then(() => {
        ps().emote('happy', 1800);
        if (U.chance(0.6)) G.bubble.show(U.pick(['note', 'sparkle', '!']), { duration: 1000 });
      });
    }
    pauseUntil = Date.now() + 2500;
    G.bus.emit('behavior:wake', { grumpy: !!opts.grumpy, info });
  }

  function maybeWake() {
    if (!sleepInfo) sleepInfo = { since: Date.now(), nap: false, onBed: true };
    const e = G.needs.get('energy');
    const age = Date.now() - sleepInfo.since;
    const night = G.time.isNight();
    if (e >= 99) return wakeUp();
    if (sleepInfo.nap && age > 22000) return wakeUp();
    if (!night && e > 70 && age > 45000) return wakeUp();
    if (G.needs.get('hunger') < G.config.needs.thresholds.veryHungry && age > 30000 && G.food.hasFood()) return wakeUp();
  }

  /* ======================================================================
     OUTROS
     ====================================================================== */
  async function lookAtWindow() {
    const Z = G.room.zones;
    const geo = G.room.geo;
    const ok = await phys().walkTo(U.clamp(Z.window.cx + U.rand(-30, 30), geo.minX, geo.maxX), geo.zMin + 10);
    if (!ok) return false;
    phys().setPose('tall');
    phys().wobble(-4);
    await U.wait(600);
    const night = G.time.isNight();
    G.bubble.show(night ? U.pick(['moon', 'star', 'sparkle']) : U.pick(['sparkle', '?', 'note']), { duration: 1400 });
    await U.wait(U.rand(2200, 3600));
    if (free() || phys().isIdle()) phys().setPose('stand');
    G.bus.emit('behavior:window', { night });
    return true;
  }

  async function goDance() {
    const Z = G.room.zones;
    const geo = G.room.geo;
    const x = U.clamp(Z.radio.cx + U.rand(-40, 20), geo.minX, geo.maxX);
    const ok = await phys().walkTo(x, geo.zMin + U.rand(14, 40));
    if (!ok) return false;
    startDancing();
    return true;
  }

  function startDancing() {
    if (!G.objects.radioOn) return;
    dancing = true;
    phys().setPose('stand');
    G.bubble.show('notes', { duration: 1300 });
    G.bus.emit('behavior:dance');
  }

  async function beg() {
    lastBeg = Date.now();
    const s = G.food.eatSpot();
    const ok = await phys().walkTo(s.x, s.z);
    if (!ok) return false;
    phys().faceTo(s.faceX);
    phys().setPose('sit');
    await U.wait(500);
    G.bubble.show('food', { duration: 2200 });
    G.audio.play('meow', { pitch: 0.95 });
    await U.wait(2600);
    if (phys().isIdle()) phys().setPose('stand');
    return true;
  }

  async function patience() {
    lastPatience = Date.now();
    const geo = G.room.geo;
    const ok = await phys().walkTo(G.room.W / 2 + U.rand(-30, 30), geo.zMax - 6);
    if (!ok) return false;
    phys().setPose('tall');
    await U.wait(500);
    G.bubble.show('?', { duration: 1200 });
    await U.wait(900);
    // bate na "tela" (quarta parede)
    for (let i = 0; i < 2; i++) {
      G.audio.play('tap');
      gsap.fromTo('#room', { scale: 1.006 }, { scale: 1, duration: 0.18, ease: 'power2.out' });
      phys().squash(0.06);
      await U.wait(260);
    }
    G.bus.emit('behavior:knock');
    await U.wait(1200);
    phys().setPose('stand');
    return true;
  }

  /* ======================================================================
     LOOP PRINCIPAL
     ====================================================================== */
  function think() {
    const now = Date.now();
    if (ps().activity === 'sleeping') { maybeWake(); return; }
    if (!free()) return;
    if (G.reactions.petting) return;
    if (now < pauseUntil) return;

    const n = G.needs.all();
    const th = G.config.needs.thresholds;

    // dançando? continua até o rádio desligar
    if (dancing) {
      if (!G.objects.radioOn) dancing = false;
      else if (U.chance(0.012)) { dancing = false; } // cansou de dançar
      else return;
    }

    // energia acabou → dorme onde estiver
    if (n.energy < th.exhausted) { run(() => sleepNow({ here: true })); return; }
    // cansado → vai pra caminha (mais provável à noite e com a luz apagada)
    if (n.energy < th.tired && U.chance(0.05 + G.time.sleepiness() * 0.15)) { run(() => sleepNow()); return; }
    if (G.time.isNight() && n.energy < 55 && U.chance(0.01 + G.time.sleepiness() * 0.02)) { run(() => sleepNow()); return; }

    // comida no pote e com fome
    if (G.food.hasFood() && n.hunger < 82) { run(() => G.food.goEat()); return; }

    // muito faminto e pote vazio → pede comida
    if (n.hunger < th.hungry && now - lastBeg > (n.hunger < th.veryHungry ? 20000 : 45000) && U.chance(0.2)) { run(beg); return; }

    // sujo → pensa em banho de vez em quando
    if (n.cleanliness < th.dirty && now - lastNeedHint > 30000 && U.chance(0.06)) {
      lastNeedHint = now;
      G.bubble.show('drop', { duration: 1600 });
      return;
    }

    // ninguém mexe nele faz tempo → vem "chamar" você
    if (G.interaction.idleMs > cfg().patienceSeconds * 1000 && now - lastPatience > 300000 && n.energy > 25) {
      run(patience); return;
    }

    if (now < nextIdleAt) return;

    const w = { ...cfg().weights };
    const playful = n.happiness > th.playful && n.energy > th.playful;
    if (playful) { w.playAlone *= 2.5; w.chaseTail *= 2; w.wander *= 1.3; }
    if (n.energy < 40) { w.nap = (w.nap || 0) * 4; w.sit *= 2; w.wander *= 0.5; w.playAlone *= 0.2; w.chaseTail = 0; }
    if (G.time.phase === 'morning') w.stretch *= 2;
    if (G.time.isNight()) { w.windowWatch *= 1.6; w.nap *= 2; }
    if (G.objects.radioOn) w.dance = 40;
    const pick = U.weighted(w);
    const fn = ACTIONS[pick];
    scheduleIdle(n.energy < 35 ? 1.5 : 1);
    if (fn) run(fn);
  }

  G.behavior = {
    init() {
      setInterval(think, cfg().thinkEvery);
      G.bus.on('user:activity', () => { pauseUntil = Date.now() + cfg().afterInteractionPause; });
      G.bus.on('pet:lift', () => { dancing = false; });
      G.bus.on('music:beat', ({ beat }) => {
        if (!dancing) return;
        if (ps().physical || ps().activity || !phys().isIdle()) return;
        phys().beat(beat);
        if (beat === 0 && U.chance(0.6)) {
          const p = phys().anchorPoint('top');
          G.fx.spawn('note', p.x + U.rand(-30, 30), p.y + 10);
        }
      });
      G.bus.on('objects:radio', (on) => {
        if (!on) { dancing = false; return; }
        setTimeout(() => {
          if (!free()) return;
          G.bubble.show('note', { duration: 900 });
          run(goDance);
        }, 700);
      });
      G.bus.on('state:activity', ({ activity }) => { if (activity !== 'sleeping') sleepInfo = null; });
    },

    sleepNow: (o) => run(() => sleepNow(o)),
    wakeUp,
    lookAtWindow: () => run(lookAtWindow),
    startDancing,
    get dancing() { return dancing; },
    get busy() { return busy; },
    actions: ACTIONS
  };
})(window.Game = window.Game || {});
