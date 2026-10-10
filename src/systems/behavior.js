/* ==========================================================================
   COMPORTAMENTO AUTÔNOMO — o "cérebro"
   O pet não fica parado esperando: de tempos em tempos escolhe uma ação
   (pesos no petConfig.behavior.weights), reage às necessidades, dorme,
   pede comida, te encara, faz poses absurdas, despreza brinquedos…
   Ação nova: crie uma função em ACTIONS e dê um peso no config.
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  let busy = false;
  let nextIdleAt = Date.now() + 3500;
  let pauseUntil = 0;
  let sleepInfo = null;
  let staring = false;
  let lastBeg = 0;
  let lastPatience = 0;
  let lastNeedHint = 0;
  const lastRun = {};          // ação → quando rodou (cooldowns)

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

  /** Pode começar uma ação nova? */
  function free() {
    return !busy && still();
  }

  /** Dentro de uma ação: ninguém interrompeu? (pegaram no colo, banho, toque…) */
  function still() {
    return ps().can('autonomous') && !G.bath.active && !G.interaction.isActive;
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
      if (ok && U.chance(0.35)) { phys().setPose('sit'); await U.wait(U.rand(1800, 3800)); if (still()) phys().setPose('stand'); }
      return ok;
    },

    async lookAround() {
      const f = phys().facing;
      phys().face(-f);
      await U.wait(U.rand(700, 1300));
      if (!still()) return false;
      phys().wobble(U.rand(-5, 5));
      await U.wait(U.rand(500, 1000));
      if (!still()) return false;
      phys().face(f);
      return true;
    },

    async sit() {
      phys().setPose(U.chance(0.3) ? 'loaf' : 'sit');
      await U.wait(U.rand(3000, 7000));
      if (still()) phys().setPose('stand');
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
        { x: Z.bed.cx, tag: 'bed' }, { x: Z.bowl.cx, tag: 'bowl' }, { x: Z.tub.cx, tag: 'tub' },
        ...toys.map((t) => ({ x: t.x, tag: 'toy' }))
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
      if (still()) phys().setPose('stand');
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

    /* ---------------- personalidade ---------------- */

    /** vem até a frente, senta e fica te encarando… sem motivo nenhum */
    async stare() {
      const geo = G.room.geo;
      const p = G.room.randomFloorPoint({ x0: G.room.W * 0.3, x1: G.room.W * 0.7, z0: geo.zMax - 34, z1: geo.zMax - 4 });
      if (!(await phys().walkTo(p.x, p.z))) return false;
      if (!still()) return false;
      phys().face(U.pick([-1, 1]));
      phys().setPose('sit');
      staring = true;
      ps().emote('staring', 12000);
      G.bus.emit('behavior:stare');
      await U.wait(U.rand(1800, 2600));
      if (!staring) return true;
      G.speech.maybe('staring', 0.5);
      await U.wait(U.rand(3000, 4800));
      if (!staring) return true;
      staring = false;
      if (ps().emotion === 'staring') ps().clearEmotion();
      phys().wobble(U.pick([-7, 7]));
      if (U.chance(0.4)) G.bubble.show(U.pick(['?', 'dots']), { duration: 900 });
      await U.wait(500);
      if (still()) phys().setPose('stand');
      return true;
    },

    /** trava numa pose absurda (às vezes alguém tira foto) */
    async sillyPose() {
      if (G.needs.get('energy') < 25) return false;
      phys().setPose(U.pick(['lie', 'tall', 'chubby']));
      if (U.chance(0.5)) phys().lean(U.pick([-1, 1]) * U.rand(8, 16));
      ps().emote('sillyPose', U.rand(4200, 5600));
      G.bus.emit('behavior:sillyPose');
      if (U.chance(0.45)) { await U.wait(900); if (!still()) return false; G.fx.flash(0.75); G.anim.flash(); }
      G.speech.maybe('sillyPose', 0.5);
      await U.wait(U.rand(3200, 4400));
      if (!still()) return false;
      phys().lean(0);
      phys().setPose('stand');
      return true;
    },

    /** senta torto e fica assim, como se fosse normal */
    async weirdSit() {
      phys().setPose(U.pick(['loaf', 'sit']));
      phys().lean(U.pick([-1, 1]) * U.rand(11, 17));
      await U.wait(U.rand(2800, 4800));
      if (!still()) return false;
      phys().lean(0);
      phys().setPose('stand');
      return true;
    },

    /** vai até um brinquedo, prepara o bote… e desiste com desprezo */
    async ignoreToy() {
      const list = Object.values(G.play.toys).filter((t) => t.def.chase !== false && !t.dragging && !t.running && !G.room.inFootprint('tub', t.x, t.z, 20));
      if (!list.length) return false;
      const t = U.pick(list);
      const side = Math.sign(phys().P.x - t.x) || 1;
      if (!(await phys().walkTo(t.x + side * G.room.petW * 0.45, t.z))) return false;
      phys().faceTo(t.x);
      phys().setPose('crouch');
      await U.wait(U.rand(800, 1300));
      if (!still()) return false;
      phys().setPose('tall');
      phys().face(side);
      phys().hop(6);
      G.bubble.show('dots', { duration: 1100 });
      G.speech.maybe('ignoreToy', 0.5);
      G.bus.emit('behavior:ignoreToy', { toy: t.id });
      await U.wait(1500);
      if (still()) phys().setPose('stand');
      return true;
    },

    /** vai lá ver a pelúcia */
    async visitPlush() {
      const t = G.play.toys.plush;
      if (!t || t.dragging || t.running) return false;
      return G.reactions.plush(t, 'visit');
    },

    /** fala uma das frases internas */
    async chatter() {
      return G.speech.say('idle');
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

    // energia acabou → dorme onde estiver
    if (n.energy < th.exhausted) { run(() => sleepNow({ here: true })); return; }
    // cansado → vai pra caminha (mais provável à noite)
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
    if (G.time.isNight()) w.nap *= 2;
    if (!G.play.toys.plush) w.visitPlush = 0;
    // cooldowns: a mesma mania não se repete logo em seguida
    const cds = cfg().cooldowns || {};
    for (const k in w) if (lastRun[k] && now - lastRun[k] < (cds[k] || 0)) w[k] = 0;
    const pick = U.weighted(w);
    lastRun[pick] = now;
    const fn = ACTIONS[pick];
    scheduleIdle(n.energy < 35 ? 1.5 : 1);
    if (fn) run(fn);
  }

  G.behavior = {
    init() {
      setInterval(think, cfg().thinkEvery);
      G.bus.on('user:activity', () => { pauseUntil = Date.now() + cfg().afterInteractionPause; });
      G.bus.on('pet:lift', () => {
        if (staring) { staring = false; if (ps().emotion === 'staring') ps().clearEmotion(); }
      });
      G.bus.on('state:activity', ({ activity }) => { if (activity !== 'sleeping') sleepInfo = null; });
    },

    sleepNow: (o) => run(() => sleepNow(o)),
    wakeUp,
    /** tocou nele enquanto encarava: susto, "você piscou primeiro" */
    breakStare() {
      if (!staring) return;
      staring = false;
      ps().emote('startled', 1300);
      phys().hop(30);
      G.bubble.show('!', { duration: 900 });
      G.audio.play('meow', { short: true, pitch: 1.4 });
      G.bus.emit('behavior:stareBroken');
      setTimeout(() => { if (phys().isIdle()) phys().setPose('stand'); }, 900);
    },
    get staring() { return staring; },
    get busy() { return busy; },
    actions: ACTIONS
  };
})(window.Game = window.Game || {});
