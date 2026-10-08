/* ==========================================================================
   BRINCADEIRA — brinquedos reais no quarto
   • Brinquedos são objetos (GSAP): arrastar, arremessar, quicar, rolar.
   • O pet persegue (física Anime.js via physics.walkTo/jumpTo), tenta
     alcançar, dá o bote, rouba da sua mão se você deixar perto.
   • Laser: toque na caneta da prateleira e mexa o dedo pelo quarto.
   Brinquedo novo: adicione em TOY_DEFS + assets.js (toys).
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  const TOY_DEFS = {
    ball:  { label: 'Bolinha', size: 10, bounce: 'bounce.out', friction: 1, roll: true, sound: 'squeak', weight: 1, start: { x: 0.46, z: 0.84 } },
    yarn:  { label: 'Novelo', size: 11, bounce: 'bounce.out', friction: 1.6, roll: true, sound: 'pop', weight: 1.3, string: true, start: { x: 0.64, z: 0.69 } },
    mouse: { label: 'Ratinho de corda', size: 13, bounce: 'power2.in', friction: 2.2, roll: false, sound: 'squeak', weight: 0.8, windup: true, start: { x: 0.28, z: 0.79 } }
  };

  const toys = {};
  const dirty = new Set();
  let world, stringSvg;
  let session = null;
  let laser = null;

  /* ======================================================================
     BRINQUEDO
     ====================================================================== */
  function makeToy(id) {
    const def = TOY_DEFS[id];
    const el = U.h('div', { class: 'toy ' + id, dataset: { hit: 'toy', toy: id }, role: 'button', 'aria-label': def.label });
    el.style.setProperty('--size', def.size);
    const wrap = U.h('div', { class: 'toy-img' }, [U.h('img', { src: G.asset('toys.' + id), alt: '', draggable: 'false' })]);
    el.appendChild(wrap);
    const shadow = U.h('div', { class: 'toy-shadow' });
    world.append(shadow, el);
    const t = {
      id, def, el, wrap, shadow,
      x: G.room.W * def.start.x, z: G.room.H * def.start.z, h: 0, rot: 0, face: 1,
      w: 40, hh: 40, dragging: false, lastMoved: 0, lastX: 0, running: false,
      trail: []
    };
    t.lastX = t.x;
    measureToy(t);
    toys[id] = t;
    mark(t);
    return t;
  }

  function measureToy(t) {
    t.w = G.room.u * t.def.size;
    t.hh = id2h(t);
  }
  function id2h(t) { return t.id === 'mouse' ? G.room.u * 8 : t.w; }

  function mark(t) { dirty.add(t); }

  function renderToys() {
    if (!dirty.size) return;
    for (const t of dirty) {
      const s = G.room.depthScale(t.z);
      if (t.def.roll) {
        t.rot += ((t.x - t.lastX) / (t.w / 2)) * (180 / Math.PI);
      }
      t.lastX = t.x;
      t.el.style.transform = `translate3d(${(t.x - t.w / 2).toFixed(1)}px,${(t.z - t.h - t.hh).toFixed(1)}px,0) scale(${s.toFixed(3)})`;
      t.el.style.transformOrigin = '50% 100%';
      t.wrap.style.transform = t.def.roll ? `rotate(${t.rot.toFixed(1)}deg)` : `scaleX(${t.face}) rotate(${t.rot.toFixed(1)}deg)`;
      t.el.style.zIndex = t.dragging ? 4999 : Math.round(t.z);
      const sw = G.room.u * 9;
      const sc = U.clamp(1 - t.h / 220, 0.3, 1) * s;
      t.shadow.style.transform = `translate3d(${(t.x - sw / 2).toFixed(1)}px,${(t.z - G.room.u * 1.2).toFixed(1)}px,0) scale(${sc.toFixed(3)})`;
      t.shadow.style.opacity = U.clamp(1 - t.h / 260, 0.25, 1).toFixed(2);
      t.shadow.style.zIndex = Math.round(t.z) - 2;
      if (t.def.string) updateString(t);
    }
    dirty.clear();
  }

  /* ---------- fio do novelo ---------- */
  function updateString(t) {
    const tail = t.trail;
    const now = U.now();
    const head = { x: t.x, y: t.z - t.h - 2 };
    if (!tail.length || U.dist(head.x, head.y, tail[0].x, tail[0].y) > 7) {
      tail.unshift({ ...head, t: now });
      if (tail.length > 9) tail.pop();
    }
    while (tail.length > 1 && now - tail[tail.length - 1].t > 1400) tail.pop();
    let d = `M${head.x.toFixed(1)} ${head.y.toFixed(1)}`;
    for (let i = 1; i < tail.length; i++) {
      const a = tail[i - 1], b = tail[i];
      d += ` Q${a.x.toFixed(1)} ${a.y.toFixed(1)} ${((a.x + b.x) / 2).toFixed(1)} ${((a.y + b.y) / 2).toFixed(1)}`;
    }
    if (tail.length < 2) {
      const dir = t.face || 1;
      d += ` q${-dir * 10} 8 ${-dir * 22} 4`;
    }
    t.stringPath.setAttribute('d', d);
  }

  /* ---------- física de brinquedo (GSAP) ---------- */
  /** Para qualquer movimento do brinquedo (tweens, timeline, eixos) */
  function killToy(t) {
    gsap.killTweensOf(t);
    if (t.tl) { t.tl.kill(); t.tl = null; }
    (t.proxies || []).forEach((p) => gsap.killTweensOf(p));
    t.proxies = [];
    t.running = false;
    t.winding = false;
  }

  function throwToy(t, vx, vz, vh) {
    killToy(t);
    const g = 2400;
    const proxies = [];
    const fr = 1100 * t.def.friction;
    const geo = G.room.geo;
    const minX = t.w * 0.6, maxX = G.room.W - t.w * 0.6;
    const minZ = geo.zMin, maxZ = geo.zMax;
    t.running = true;
    t.lastMoved = U.now();

    const axis = (key, v, min, max) => {
      if (Math.abs(v) < 10) return;
      const T = U.clamp(Math.abs(v) / fr, 0.2, 2);
      const proxy = { u: t[key] };
      let hits = 0;
      gsap.to(proxy, {
        u: t[key] + (v * T) / 2, duration: T, ease: 'power1.out',
        onUpdate: () => {
          let pos = proxy.u, hh = 0;
          for (let i = 0; i < 5; i++) {
            if (pos > max) { pos = max - (pos - max) * 0.6; hh++; } else if (pos < min) { pos = min + (min - pos) * 0.6; hh++; } else break;
          }
          if (hh > hits) { hits = hh; G.audio.play('tap'); }
          t[key] = U.clamp(pos, min, max);
          t.lastMoved = U.now();
          mark(t);
          G.bus.emit('toy:move', t);
        }
      });
      // alvo do gsap é o proxy; guardamos para poder matar junto
      proxies.push(proxy);
    };
    t.proxies = proxies;
    axis('x', vx, minX, maxX);
    axis('z', vz, minZ, maxZ);

    // vertical: sobe (se jogou pra cima) e cai quicando (bounce.out do GSAP)
    const tl = gsap.timeline({ onComplete: () => { t.running = false; t.lastMoved = U.now(); G.bus.emit('toy:rest', t); } });
    t.tl = tl;
    if (vh > 0) {
      const apex = Math.min(t.h + (vh * vh) / (2 * g), 320);
      tl.to(t, { h: apex, duration: vh / g, ease: 'power2.out', onUpdate: () => mark(t) });
    }
    const fallFrom = Math.max(vh > 0 ? Math.min(t.h + (vh * vh) / (2 * g), 320) : t.h, 0);
    if (fallFrom > 1) {
      const dur = Math.sqrt((2 * fallFrom) / g) * (t.def.bounce === 'bounce.out' ? 2.1 : 1);
      tl.to(t, { h: 0, duration: dur, ease: t.def.bounce, onUpdate: () => { mark(t); }, onComplete: () => { G.audio.play('tap'); } });
    } else {
      tl.to({}, { duration: 0.5 });
    }
  }

  function kick(t, dirX, power = 1) {
    if (t.def.windup) {
      // ratinho capotado
      killToy(t);
      gsap.to(t, { rot: 180 * (Math.random() < 0.5 ? 1 : -1), h: 0, duration: 0.35, ease: 'back.out(2)', onUpdate: () => mark(t) });
      gsap.to(t, { rot: 0, duration: 0.4, delay: U.rand(2.5, 4), ease: 'back.out(2)', onUpdate: () => mark(t) });
      G.audio.play('squeak', { pitch: 1.3 });
      t.lastMoved = U.now();
      return;
    }
    const sp = U.rand(260, 520) * power / t.def.weight;
    throwToy(t, dirX * sp, U.rand(-120, 120), U.rand(120, 340) * power);
    G.audio.play(t.def.sound, { pitch: U.rand(0.9, 1.2) });
  }

  /** Ratinho de corda: corre sozinho pelo quarto */
  function windUp(t) {
    killToy(t);
    t.running = true;
    G.audio.play('click');
    const tl = gsap.timeline({ onComplete: () => { t.running = false; t.lastMoved = U.now(); G.bus.emit('toy:rest', t); } });
    t.tl = tl;
    // dá corda: tremidinha (intocável enquanto isso)
    t.winding = true;
    tl.to(t, { rot: 8, duration: 0.05, repeat: 7, yoyo: true, onUpdate: () => mark(t) });
    tl.add(() => { t.winding = false; });
    const n = U.randInt(5, 8);
    let px = t.x;
    const P = G.physics.P;
    for (let i = 0; i < n; i++) {
      // a primeira corrida é para longe do pet
      let p = G.room.randomFloorPoint();
      if (i === 0) {
        for (let k = 0; k < 6; k++) {
          const q = G.room.randomFloorPoint();
          if (Math.hypot(q.x - P.x, q.z - P.z) > Math.hypot(p.x - P.x, p.z - P.z)) p = q;
        }
      }
      const d = Math.hypot(p.x - px, p.z - t.z);
      const dir = Math.sign(p.x - px) || 1;
      px = p.x;
      tl.add(() => { t.face = dir; mark(t); G.audio.play('squeak', { pitch: U.rand(1.2, 1.6) }); });
      tl.to(t, {
        x: p.x, z: p.z, rot: dir * 4, duration: U.clamp(d / 360, 0.3, 0.9), ease: 'power1.inOut',
        onUpdate: () => { t.lastMoved = U.now(); mark(t); G.bus.emit('toy:move', t); }
      });
      tl.to(t, { rot: 0, duration: 0.1 });
    }
    G.bus.emit('toy:move', t);
  }

  /* ---------- gesto: arrastar brinquedo ---------- */
  const toyHandler = {
    down(pt, e, el) {
      const t = toys[el.dataset.toy];
      if (!t) return null;
      killToy(t);
      const start = { ...pt, t: U.now() };
      const off = { x: pt.x - t.x, y: pt.y - (t.z - t.h) };
      let moved = false;
      const samples = [{ ...pt, t: U.now() }];
      const qx = gsap.quickTo(t, 'x', { duration: 0.12, ease: 'power3.out', onUpdate: () => mark(t) });
      const qz = gsap.quickTo(t, 'z', { duration: 0.12, ease: 'power3.out', onUpdate: () => mark(t) });
      const qh = gsap.quickTo(t, 'h', { duration: 0.12, ease: 'power3.out', onUpdate: () => mark(t) });
      t.dragging = true;
      t.stolen = false;
      mark(t);
      gsap.fromTo(t.wrap, { scale: 0.86 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
      G.audio.play(t.def.sound === 'squeak' ? 'squeak' : 'pop', { pitch: 1.1 });
      const geo = G.room.geo;

      const end = (cancelled) => {
        t.dragging = false;
        mark(t);
        if (t.stolen) return;
        if (!moved && !cancelled) {
          // toque simples
          if (t.def.windup) windUp(t);
          else kick(t, U.pick([-1, 1]), 0.6);
          G.bus.emit('toy:move', t);
          return;
        }
        const now = U.now();
        const last = samples[samples.length - 1];
        let first = last;
        for (let i = samples.length - 2; i >= 0; i--) { first = samples[i]; if (last.t - samples[i].t > 90) break; }
        const dt = Math.max(0.016, (last.t - first.t) / 1000);
        let vx = (last.x - first.x) / dt, vy = (last.y - first.y) / dt;
        const idle = now - last.t;
        if (idle > 40) { const f = U.clamp(1 - (idle - 40) / 100, 0, 1); vx *= f; vy *= f; }
        const vh = vy < 0 ? -vy * 0.8 : 0;
        const vz = vy < 0 ? vy * 0.2 : vy * 0.7;
        throwToy(t, U.clamp(vx, -2400, 2400), U.clamp(vz, -1200, 1200), U.clamp(vh, 0, 1800));
        if (Math.hypot(vx, vy) > 900) G.audio.play('whoosh', { intensity: 0.6 });
        G.bus.emit('toy:thrown', { toy: t, speed: Math.hypot(vx, vy) });
      };

      return {
        move(p) {
          if (t.stolen) return;
          samples.push({ ...p, t: U.now() });
          if (samples.length > 20) samples.shift();
          if (!moved && U.dist(p.x, p.y, start.x, start.y) > 6) moved = true;
          if (!moved) return;
          const ax = U.clamp(p.x - off.x, t.w * 0.5, G.room.W - t.w * 0.5);
          const ay = Math.max(geo.top + t.hh, p.y - off.y - 8);
          const z = U.clamp(ay + 8, geo.zMin, geo.zMax);
          qx(ax); qz(z); qh(Math.max(0, z - ay));
          t.lastMoved = U.now();
          G.bus.emit('toy:move', t);
        },
        up() { end(false); },
        cancel() { end(true); }
      };
    }
  };

  /* ======================================================================
     LASER
     ====================================================================== */
  function laserOn() {
    if (laser) return laserOff();
    const btn = document.querySelector('.laser-pointer');
    btn.classList.add('on');
    const dot = U.h('div', { class: 'laser-dot' });
    world.appendChild(dot);
    const geo = G.room.geo;
    laser = { dot, btn, x: G.room.W * 0.5, y: (geo.zMin + geo.zMax) / 2, onPet: 0, until: Date.now() + G.config.play.laserDuration };
    const L = laser;
    const target = { x: L.x, y: L.y };
    gsap.set(dot, { x: L.x, y: L.y, opacity: 0, scale: 0 });
    gsap.to(dot, { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(3)' });
    L.flicker = gsap.to(dot, { scale: 0.85, duration: 0.07, repeat: -1, yoyo: true, ease: 'none' });
    L.qx = gsap.quickTo(target, 'x', { duration: 0.08, onUpdate: () => { L.x = target.x; gsap.set(dot, { x: L.x }); } });
    L.qy = gsap.quickTo(target, 'y', { duration: 0.08, onUpdate: () => { L.y = target.y; gsap.set(dot, { y: L.y }); } });
    L.target = target;
    G.audio.play('zap');
    G.interaction.setOverride(laserOverride);
    L.timer = setInterval(() => { if (Date.now() > L.until) laserOff(); }, 500);
    startSession({ laser: true });
    G.bus.emit('laser:on');
  }

  function laserOff() {
    if (!laser) return;
    const L = laser; laser = null;
    clearInterval(L.timer);
    L.flicker.kill();
    L.btn.classList.remove('on');
    gsap.to(L.dot, { opacity: 0, scale: 0, duration: 0.2, onComplete: () => L.dot.remove() });
    G.interaction.clearOverride(laserOverride);
    G.audio.play('click');
    G.bus.emit('laser:off');
  }

  const laserOverride = {
    down(pt, e, el, kind) {
      if (!laser) return null;
      if (kind === 'laser') return null; // tocar a caneta de novo desliga
      const move = (p) => {
        if (!laser) return;
        laser.until = Math.max(laser.until, Date.now() + 6000);
        laser.qx(U.clamp(p.x, 6, G.room.W - 6));
        laser.qy(U.clamp(p.y, G.room.geo.top + 10, G.room.H - 6));
        laser.lastMoved = U.now();
      };
      move(pt);
      return { move, up() {}, cancel() {} };
    }
  };

  /* ======================================================================
     SESSÃO DE BRINCADEIRA (o pet persegue o alvo)
     ====================================================================== */
  function targetOf(s) {
    if (s.laser) {
      if (!laser) return null;
      const geo = G.room.geo;
      const z = U.clamp(laser.y, geo.zMin, geo.zMax);
      return { x: laser.x, z, h: Math.max(0, z - laser.y), laser: true, moving: U.now() - (laser.lastMoved || 0) < 400 };
    }
    const t = s.toy;
    return { x: t.x, z: t.z, h: t.h, toy: t, moving: t.dragging || t.running || U.now() - t.lastMoved < 300 };
  }

  function startSession(opts) {
    const ps = G.petState;
    if (!ps.can('play')) {
      if (!ps.activity && !ps.physical) {
        // sem energia: só olha
        const tg = opts.laser ? { x: laser?.x || 0 } : opts.toy;
        if (tg && G.physics.isIdle()) G.physics.faceTo(tg.x);
        if (G.needs.get('energy') <= G.config.play.minEnergyToPlay && !G.bubble.visible) G.bubble.show('z', { duration: 1400 });
      }
      return;
    }
    if (session) {
      if (opts.laser) session.laser = true;
      else if (!session.laser) session.toy = opts.toy;
      session.lastSeen = U.now();
      return;
    }
    session = { toy: opts.toy, laser: !!opts.laser, started: U.now(), lastSeen: U.now(), busy: false, catches: 0, lastAction: 0 };
    ps.setActivity('playing');
    G.physics.setPose('stand');
    const tg = targetOf(session);
    if (tg) G.physics.faceTo(tg.x);
    G.bubble.show(U.chance(0.5) ? '!' : 'ball', { duration: 900 });
    G.audio.play('meow', { short: true, pitch: 1.2 });
    session.loop = setInterval(think, 140);
  }

  function endSession(reason) {
    if (!session) return;
    clearInterval(session.loop);
    const s = session;
    session = null;
    if (G.petState.activity === 'playing') G.petState.setActivity(null);
    if (reason !== 'interrupted' && s.catches > 0) G.petState.emote('happy', 2200);
    if (reason === 'tired') { G.petState.emote('sadEmote', 1500); G.bubble.show('z'); G.physics.setPose('lie'); }
    G.bus.emit('play:end', { reason, catches: s.catches });
  }

  async function think() {
    const s = session;
    if (!s) return;
    const ps = G.petState;
    if (ps.physical || ps.activity !== 'playing') return endSession('interrupted');
    if (G.needs.get('energy') <= G.config.play.minEnergyToPlay * 0.7) return endSession('tired');
    if (s.laser && !laser) { s.laser = false; if (!s.toy) return endSession('laserOff'); }
    const tg = targetOf(s);
    if (!tg) return endSession('noTarget');
    if (tg.moving) s.lastSeen = U.now();
    if (U.now() - s.lastSeen > G.config.play.restAfter) return endSession('rest');
    if (s.busy) return;

    const cfg = G.config.play;
    const P = G.physics.P;
    const facing = G.physics.facing;
    const pawX = P.x + facing * G.room.petW * 0.22;
    const dist = Math.hypot(tg.x - pawX, tg.z - P.z);
    const reach = cfg.maxJumpReach;

    // alvo no ar (você segurando o brinquedo, ou o laser na parede):
    // compara na TELA a cabeça do pet com o alvo e pula tentando alcançar
    if (tg.h > 30) {
      const petH = G.room.petH * G.room.depthScale(P.z);
      const headY = P.z - petH * 0.8;
      const targetY = tg.z - tg.h;
      const gap = headY - targetY;                     // > 0: alvo acima da cabeça
      const dx = Math.abs(tg.x - P.x);
      if (dx < G.room.petW * 0.55 && gap > -30 && gap < reach + 40) {
        s.busy = true;
        G.physics.faceTo(tg.x);
        if (G.physics.isIdle() || G.physics.mode === 'walk') await G.physics.hop(U.clamp(gap + 34, 24, reach));
        G.needs.add({ energy: -cfg.energyPerPounce * 0.6 }, 'play');
        const t2 = targetOf(s);
        if (t2 && t2.toy && t2.toy.dragging && gap < reach - 10 && Math.abs(t2.x - G.physics.P.x) < G.room.petW * 0.6) steal(t2.toy);
        else if (Math.random() < 0.3) G.bubble.show(tg.laser ? '?' : '!!', { duration: 700 });
        await U.wait(250);
        s.busy = false;
        return;
      }
      // anda até ficar embaixo do alvo
      if (G.physics.isIdle() || (G.physics.mode === 'walk' && (!s.walkTarget || Math.abs(s.walkTarget.x - tg.x) > 40))) {
        const goal = G.room.clampFloor(tg.x, targetY + petH * 1.05);
        if (!G.room.inFootprint('tub', goal.x, goal.z, 10)) {
          s.walkTarget = { x: tg.x, z: goal.z };
          G.physics.walkTo(goal.x, goal.z, { run: dx > 80 }).then(() => { if (session === s) s.walkTarget = null; });
        }
      }
      return;
    }

    if (tg.toy && tg.toy.winding) { G.physics.faceTo(tg.x); return; }

    if (dist < cfg.catchRadius && tg.h < 30) {
      s.busy = true;
      await catchTarget(tg);
      s.busy = false;
      return;
    }

    if (dist < cfg.pounceRange && tg.h < reach * 0.6 && U.now() - s.lastAction > 500) {
      // bote!
      s.busy = true;
      s.lastAction = U.now();
      G.physics.setPose('crouch');
      G.physics.faceTo(tg.x);
      await U.wait(tg.laser ? 120 : 220);
      G.physics.setPose('stand');
      const side = Math.sign(tg.x - P.x) || facing;
      const ok = await G.physics.jumpTo(tg.x - side * G.room.petW * 0.18, tg.z, { height: U.clamp(dist * 0.4 + tg.h, 26, 80), kind: 'pounce' });
      G.needs.add({ energy: -cfg.energyPerPounce }, 'play');
      if (!ok || session !== s) { s.busy = false; return; }
      const t2 = targetOf(s);
      if (t2) {
        const d2 = Math.hypot(t2.x - (G.physics.P.x + G.physics.facing * G.room.petW * 0.22), t2.z - G.physics.P.z);
        if (d2 < cfg.catchRadius * 1.5 && t2.h < 40) await catchTarget(t2);
        else if (t2.laser) { G.bubble.show('?', { duration: 700 }); }
      }
      s.busy = false;
      return;
    }

    // corre atrás
    if (G.physics.mode !== 'walk' || !s.walkTarget || Math.hypot(s.walkTarget.x - tg.x, s.walkTarget.z - tg.z) > 46) {
      const side = Math.sign(P.x - tg.x) || 1;
      const goal = G.room.clampFloor(tg.x + side * G.room.petW * 0.3, tg.z);
      if (G.room.inFootprint('tub', goal.x, goal.z, 10)) { return; }
      s.walkTarget = { x: tg.x, z: tg.z };
      if (G.physics.isIdle() || G.physics.mode === 'walk') {
        G.physics.walkTo(goal.x, goal.z, { run: dist > 60, speedMul: tg.laser ? 1.25 : 1 }).then(() => { if (session === s) s.walkTarget = null; });
      }
    }
  }

  async function catchTarget(tg) {
    const cfg = G.config.play;
    const s = session;
    if (!s) return;
    s.catches++;
    G.progress.count('catches');
    G.progress.addXp(cfg.xpPerCatch, 'play');
    G.needs.add({ happiness: cfg.happinessPerCatch, energy: -cfg.energyPerPounce * 0.5, cleanliness: -cfg.cleanlinessPerCatch }, 'play');
    G.physics.squash(0.14);
    if (tg.laser) {
      // laser não dá pra pegar…
      G.physics.wobble(12);
      G.bubble.show(U.pick(['?', '?!', 'dots']), { duration: 900 });
      G.bus.emit('play:laserCatch');
      await U.wait(380);
      return;
    }
    const t = tg.toy;
    if (t.dragging) { steal(t); await U.wait(300); return; }
    if (t.def.windup) {
      // pegou o ratinho! ele capota e a brincadeira termina com orgulho
      G.physics.squash(0.12);
      kick(t, G.physics.facing);
      G.petState.emote('excited', 1600);
      G.bubble.show(U.pick(['!!', 'sparkle', 'star']), { duration: 1100 });
      G.bus.emit('play:catch', { toy: t.id, pinned: true });
      await U.wait(700);
      endSession('satisfied');
      return;
    }
    G.petState.emote('excited', 1200);
    if (Math.random() < 0.35) G.bubble.show(U.pick(['!', 'note', 'sparkle']), { duration: 800 });
    G.audio.play('meow', { short: true, pitch: 1.25 });
    await U.wait(140);
    // rebate para o lado com mais espaço (evita ficar preso na parede)
    const room = G.room;
    const toCenter = Math.sign(room.W / 2 - t.x) || 1;
    const nearWall = t.x < room.W * 0.25 || t.x > room.W * 0.75;
    const dir = nearWall ? toCenter : (U.chance(0.7) ? G.physics.facing : -G.physics.facing);
    // depois de algumas capturas, às vezes ele só "segura" e cansa da brincadeira
    const done = Math.random() < 0.1 + s.catches * 0.09;
    if (done && !t.def.windup) {
      G.physics.setPose('loaf');
      G.bubble.show(U.pick(['love', 'note', 'sparkle']), { duration: 1200 });
      G.bus.emit('play:catch', { toy: t.id, kept: true });
      await U.wait(900);
      G.physics.setPose('stand');
      endSession('satisfied');
      return;
    }
    kick(t, dir, U.rand(0.7, 1.15));
    G.bus.emit('play:catch', { toy: t.id });
    await U.wait(320);
  }

  /** O pet arranca o brinquedo da sua mão */
  function steal(t) {
    if (!t.dragging) return;
    t.stolen = true;
    t.dragging = false;
    G.audio.play('squeak', { pitch: 1.4 });
    G.petState.emote('excited', 1500);
    G.bubble.show('!!', { duration: 900 });
    throwToy(t, G.physics.facing * U.rand(200, 380), U.rand(-60, 60), 160);
    G.progress.count('steals');
    G.bus.emit('play:steal', { toy: t.id });
  }

  /* ======================================================================
     API
     ====================================================================== */
  G.play = {
    init() {
      world = document.getElementById('world');
      for (const id of Object.keys(TOY_DEFS)) makeToy(id);

      // fio do novelo (SVG do tamanho do quarto)
      const NS = 'http://www.w3.org/2000/svg';
      stringSvg = document.createElementNS(NS, 'svg');
      stringSvg.setAttribute('class', 'yarn-string');
      stringSvg.style.position = 'absolute';
      stringSvg.style.zIndex = '2';
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#3f7f7a');
      path.setAttribute('stroke-width', '2.5');
      path.setAttribute('stroke-linecap', 'round');
      stringSvg.appendChild(path);
      world.appendChild(stringSvg);
      toys.yarn.stringPath = path;

      gsap.ticker.add(renderToys);

      G.save.register('toys', {
        get: () => Object.fromEntries(Object.values(toys).map((t) => [t.id, { x: t.x / G.room.W, z: t.z / G.room.H }])),
        set: (d) => {
          for (const id in d || {}) {
            const t = toys[id];
            if (!t || typeof d[id]?.x !== 'number') continue;
            const p = G.room.clampFloor(d[id].x * G.room.W, d[id].z * G.room.H);
            t.x = p.x; t.z = p.z; t.lastX = t.x; mark(t);
          }
        }
      });

      G.interaction.register('toy', toyHandler);
      G.interaction.register('laser', G.interaction.tap(() => laserOn()));

      G.bus.on('toy:move', (t) => {
        if (t.dragging || t.running) startSession({ toy: t });
        else if (G.physics.isIdle() && !G.petState.activity && !G.petState.physical) G.physics.faceTo(t.x);
      });
      G.bus.on('toy:thrown', ({ toy }) => startSession({ toy }));
      let lastW = G.room.W, lastH = G.room.H;
      G.bus.on('room:resize', () => {
        const fx = lastW > 50 ? G.room.W / lastW : 1, fz = lastH > 50 ? G.room.H / lastH : 1;
        for (const t of Object.values(toys)) {
          measureToy(t);
          if (lastW <= 50) { t.x = G.room.W * t.def.start.x; t.z = G.room.H * t.def.start.z; }
          const p = G.room.clampFloor(t.x * fx, t.z * fz);
          t.x = p.x; t.z = p.z; t.lastX = t.x; mark(t);
        }
        lastW = G.room.W; lastH = G.room.H;
      });
      G.bus.on('pet:press', () => { if (session) endSession('interrupted'); });
    },

    /** Brincar sozinho: vai até um brinquedo e dá um tapinha */
    async playAlone() {
      const list = Object.values(toys).filter((t) => !t.dragging && !t.running && !G.room.inFootprint('tub', t.x, t.z, 20));
      if (!list.length) return false;
      const t = U.pick(list);
      const P = G.physics.P;
      const side = Math.sign(P.x - t.x) || 1;
      const ok = await G.physics.walkTo(t.x + side * G.room.petW * 0.32, t.z, { run: U.chance(0.4) });
      if (!ok) return false;
      G.physics.faceTo(t.x);
      G.physics.setPose('crouch');
      await U.wait(400);
      G.physics.setPose('stand');
      if (!G.petState.can('autonomous')) return false;
      G.physics.squash(0.1);
      kick(t, -side, 0.5);
      G.needs.add({ happiness: 1.5, energy: -0.5 }, 'playAlone');
      return true;
    },

    /** Brinquedo sob o dedo (tolerante), mesmo que esteja atrás de um móvel */
    toyAt(x, y) {
      let best = null, bd = Infinity;
      for (const t of Object.values(toys)) {
        const cx = t.x, cy = t.z - t.h - t.hh / 2;
        const d = Math.hypot(cx - x, cy - y);
        const r = Math.max(26, t.w * 0.7);
        if (d < r && d < bd) { bd = d; best = t; }
      }
      return best;
    },

    nearestToy(x, z) {
      let best = null, bd = Infinity;
      for (const t of Object.values(toys)) {
        const d = Math.hypot(t.x - x, t.z - z);
        if (d < bd) { bd = d; best = t; }
      }
      return best ? { toy: best, dist: bd } : null;
    },

    get toys() { return toys; },
    get laserOn() { return !!laser; },
    get laser() { return laser; },
    get session() { return session; },
    laserOff,
    endSession
  };
})(window.Game = window.Game || {});
