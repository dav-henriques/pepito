/* ==========================================================================
   BRINCADEIRA — brinquedos reais no quarto
   • Brinquedos são objetos (GSAP): arrastar, arremessar, quicar, rolar.
   • O pet persegue (física Anime.js via physics.walkTo/jumpTo), tenta
     alcançar, dá o bote, rouba da sua mão se você deixar perto.
   • Pelúcia (chase: false): o pet não persegue — ele REAGE quando você
     aproxima (cheira, ignora, abraça ou ataca; ver reactions.js).
   Brinquedo novo: física em petConfig.toys, nome/liga-desliga em
   personal.js → toys, imagem em assets.js → toys.
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  /** Brinquedos ligados: física (petConfig.toys) + nome (personal.js → toys) */
  function buildDefs() {
    const C = G.config.toys || {};
    const P = (G.personal && G.personal.toys) || {};
    const out = {};
    for (const id in C) {
      const p = P[id] || {};
      if (p.enabled === false) continue;
      out[id] = { ...C[id], label: p.name || id, showName: !!p.showName };
    }
    return out;
  }
  let TOY_DEFS = {};

  const toys = {};
  const dirty = new Set();
  let world, stringSvg;
  let session = null;

  /* ======================================================================
     BRINQUEDO
     ====================================================================== */
  function makeToy(id) {
    const def = TOY_DEFS[id];
    const isPhoto = !/\.svg($|\?)/i.test(G.asset(def.asset || 'toys.' + id));
    const el = U.h('div', { class: 'toy ' + id + (def.plush ? ' plush' : '') + (isPhoto ? ' cutout' : ''), dataset: { hit: 'toy', toy: id }, role: 'button', 'aria-label': def.label });
    el.style.setProperty('--size', def.size);
    el.style.transformOrigin = '50% 100%';
    if (def.heightRatio) el.style.setProperty('--hr', def.heightRatio);
    const im = U.h('img', { alt: '', draggable: 'false' });
    G.media.img(im, def.asset || 'toys.' + id);
    const wrap = U.h('div', { class: 'toy-img' }, [im]);
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
    t.w = G.room.ou * t.def.size;
    t.hh = t.w * (t.def.heightRatio || 1);
  }

  function mark(t) { dirty.add(t); }

  function renderToys() {
    if (!dirty.size) return;
    for (const t of dirty) {
      const s = G.room.depthScale(t.z);
      if (t.def.roll) {
        t.rot += ((t.x - t.lastX) / (t.w / 2)) * (180 / Math.PI);
      } else if (t.def.spin && !t.dragging && t.h > 2) {
        t.rot += (t.x - t.lastX) * 1.6 + 4;          // gira no ar e cai do jeito que der
      }
      t.lastX = t.x;
      t.el.style.transform = `translate3d(${(t.x - t.w / 2).toFixed(1)}px,${(t.z - t.h - t.hh).toFixed(1)}px,0) scale(${s.toFixed(3)})`;
      t.wrap.style.transform = t.def.roll ? `rotate(${t.rot.toFixed(1)}deg)` : `scaleX(${t.face}) rotate(${t.rot.toFixed(1)}deg)`;
      const sw = G.room.ou * 9;
      const sc = U.clamp(1 - t.h / 220, 0.3, 1) * s;
      t.shadow.style.transform = `translate3d(${(t.x - sw / 2).toFixed(1)}px,${(t.z - G.room.ou * 1.2).toFixed(1)}px,0) scale(${sc.toFixed(3)})`;
      t.shadow.style.opacity = U.clamp(1 - t.h / 260, 0.25, 1).toFixed(2);
      t.shadow.style.zIndex = Math.round(t.z) - 2;
      if (t.def.string) updateString(t);
    }
    dirty.clear();
  }

  /** Profundidade dos brinquedos (todo quadro): normalmente pela posição no chão,
      mas um brinquedo atrás do gato e coberto por ele passa para a frente —
      a foto do gato é um cartão opaco grande e esconderia o brinquedo inteiro. */
  let petEl = null;
  function toyDepth() {
    if (!petEl) petEl = document.getElementById('pet');
    const P = G.physics.P;
    const petZ = parseInt(petEl.style.zIndex, 10) || Math.round(P.z) + 1;
    const s = G.room.depthScale(P.z);
    const { w, h } = G.physics.size;
    const px0 = P.x - w * s * 0.47, px1 = P.x + w * s * 0.47;
    const py1 = P.z - P.h, py0 = py1 - h * s * 0.97;
    for (const t of Object.values(toys)) {
      let zi;
      if (t.dragging) zi = 4999;
      else {
        zi = Math.round(t.z);
        let front = false;
        if (zi <= petZ && petZ < 4000) {
          // quanto do brinquedo o cartão cobre (com folga para não ficar piscando na borda)
          const ts = G.room.depthScale(t.z);
          const tw = t.w * ts, th = t.hh * ts;
          const ty1 = t.z - t.h, ty0 = ty1 - th;
          const ox = Math.min(t.x + tw / 2, px1) - Math.max(t.x - tw / 2, px0);
          const oy = Math.min(ty1, py1) - Math.max(ty0, py0);
          const cover = ox > 0 && oy > 0 ? (ox * oy) / (tw * th) : 0;
          if (cover > (t._front ? 0.08 : 0.25)) { zi = petZ + 1; front = true; }
        }
        t._front = front;
      }
      if (zi !== t._zi) { t.el.style.zIndex = zi; t._zi = zi; }
    }
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

  /** Muda o ponto de giro da imagem do brinquedo sem ele "pular" (compensa a
      posição pelo giro/espelho atuais — mesma ideia do setRotOrigin do pet) */
  function setToyOrigin(t, fx, fy) {
    const o1 = t.origin || { x: 0.5, y: 0.5 };
    const vx = (fx - o1.x) * t.w, vy = (fy - o1.y) * t.hh;
    const r = t.rot / 57.29578, f = t.def.roll ? 1 : (t.face || 1);
    const cos = Math.cos(r), sin = Math.sin(r);
    // (I − S·R)·v, com S = espelho (scaleX) e R = giro, como no transform do wrap
    const dx = vx - f * (vx * cos - vy * sin);
    const dy = vy - (vx * sin + vy * cos);
    const s = G.room.depthScale(t.z);
    t.x -= dx * s;
    t.h += dy * s;
    t.origin = { x: fx, y: fy };
    t.wrap.style.transformOrigin = `${(fx * 100).toFixed(1)}% ${(fy * 100).toFixed(1)}%`;
    mark(t);
  }

  /* ---------- gesto: arrastar brinquedo ----------
     Mesma física do gato, em versão menor: o ponto agarrado vem até o dedo
     por uma mola, o brinquedo balança como pêndulo em volta do dedo e a
     imagem faz geleca (estica/achata) com os trancos. */
  const toyHandler = {
    down(pt, e, el) {
      const t = toys[el.dataset.toy];
      if (!t) return null;
      killToy(t);
      if (!t.def.roll) t.rot = (((t.rot + 180) % 360) + 360) % 360 - 180;   // mesmo ângulo, sem voltas extras
      const start = { ...pt, t: U.now() };
      const tilts = !t.def.roll;
      // gira em volta de onde o dedo pegou (desfaz giro/espelho atuais para achar
      // o ponto da imagem embaixo do dedo — o ratinho pode estar capotado)
      if (tilts) {
        const s = G.room.depthScale(t.z), o1 = t.origin || { x: 0.5, y: 0.5 };
        const ox = t.x - (t.w * s) / 2 + o1.x * t.w * s, oy = t.z - t.h - t.hh * s + o1.y * t.hh * s;
        const qx = (t.face || 1) * (pt.x - ox) / s, qy = (pt.y - oy) / s;
        const r = t.rot / 57.29578, c = Math.cos(r), sn = Math.sin(r);
        const vx = qx * c + qy * sn, vy = -qx * sn + qy * c;
        setToyOrigin(t, U.clamp((o1.x * t.w + vx) / t.w, 0.1, 0.9), U.clamp((o1.y * t.hh + vy) / t.hh, 0.1, 0.9));
      }
      // onde o dedo pegou, "sem profundidade" (o brinquedo encolhe no fundo do quarto)
      const s0 = G.room.depthScale(t.z);
      const offL = { x: (pt.x - t.x) / s0, y: (pt.y - (t.z - t.h)) / s0 };
      let moved = false;
      const samples = [{ ...pt, t: U.now() }];
      t.dragging = true;
      t.stolen = false;
      mark(t);
      const img = t.wrap.firstChild;
      gsap.killTweensOf(img);
      gsap.set(img, { transformOrigin: '50% 100%' });
      G.audio.play(t.def.sound === 'squeak' ? 'squeak' : 'pop', { pitch: 1.1 });
      G.audio.play('peel', { v: 0.7 });
      G.haptic(6);
      const geo = G.room.geo;
      const lift = 8;      // a sombra descola um pouco enquanto ele está na mão

      // ---- simulação (molas), um passo por quadro ----
      const sim = {
        finger: { x: pt.x, y: pt.y }, G: { x: pt.x, y: pt.y }, vG: { x: 0, y: 0 },
        // ângulo atual entre −180° e 180° (capotado = desvira na mão, com a mola)
        th: ((((t.rot + 180) % 360) + 360) % 360 - 180) / 57.29578, om: 0,
        e: 0, ev: -1.9,                  // "apertou": achata e volta balançando
        L: 1, Lv: 6                      // "descolou": cresce um tiquinho com uma molinha
      };
      let lastT = U.now();
      const wF = Math.PI * 2 * 9.5, zF = 0.82;   // mola até o dedo
      const wS = Math.PI * 2 * 2.6, zS = 0.34;   // balanço (firme: mexer pouco = balançar pouco)
      const wJ = Math.PI * 2 * 4.2, zJ = 0.26;   // geleca
      const wL = Math.PI * 2 * 3.5, zL = 0.4;    // "descolar"
      const knee0 = 4500;                        // tranco pequeno quase não balança
      const tick = () => {
        if (!t.dragging || t.stolen) { gsap.ticker.remove(tick); return; }
        const now = U.now();
        const dt = U.clamp((now - lastT) / 1000, 0, 0.05);
        lastT = now;
        const s = G.room.depthScale(t.z) * sim.L;
        const o = t.origin || { x: 0.5, y: 0.5 };
        const rx0 = (0.5 - o.x) * t.w * s, ry0 = (0.5 - o.y) * t.hh * s;
        const I = rx0 * rx0 + ry0 * ry0 + ((t.w * t.w + t.hh * t.hh) * s * s) / 12;
        const g = moved ? 2000 : 0;
        const n = U.clamp(Math.ceil(dt * 240), 1, 12), h = dt / n;
        for (let i = 0; i < n; i++) {
          let ax = 0, ay = 0;
          if (moved) {
            ax = wF * wF * (sim.finger.x - sim.G.x) - 2 * zF * wF * sim.vG.x;
            ay = wF * wF * (sim.finger.y - sim.G.y) - 2 * zF * wF * sim.vG.y;
            sim.vG.x += ax * h; sim.vG.y += ay * h;
            sim.G.x += sim.vG.x * h; sim.G.y += sim.vG.y * h;
          }
          const am = Math.hypot(ax, ay), knee = am / (am + knee0);
          if (tilts) {
            const f = t.face || 1;
            const cos = Math.cos(sim.th), sin = Math.sin(sim.th);
            // giro visto na tela (o espelho inverte o sentido)
            const rx = f * (rx0 * cos - ry0 * sin), ry = rx0 * sin + ry0 * cos;
            const fx = -ax * knee, fy = g - ay * knee;
            let alpha = f * (rx * fy - ry * fx) / I - wS * wS * sim.th - 2 * zS * wS * sim.om;
            if (Math.abs(sim.th) > 0.9) alpha -= sim.om * 7;                                                // ângulo grande (desvirando): freia
            if (Math.abs(sim.th) > 1.2 && Math.sign(sim.om) === Math.sign(sim.th)) alpha -= sim.om * 18;   // batente macio
            sim.om += alpha * h;
            sim.th += sim.om * h;
          }
          // geleca: puxão vertical estica, freada achata
          sim.ev += (-ay * knee * 0.000009 * wJ * wJ - wJ * wJ * sim.e - 2 * zJ * wJ * sim.ev) * h;
          sim.e += sim.ev * h;
          sim.Lv += ((1.08 - sim.L) * wL * wL - 2 * zL * wL * sim.Lv) * h;
          sim.L += sim.Lv * h;
        }
        sim.e = U.clamp(sim.e, -0.25, 0.3);
        if (tilts) t.rot = sim.th * 57.29578;
        gsap.set(img, { scaleX: sim.L * (1 - sim.e * 0.55), scaleY: sim.L * (1 + sim.e) });
        if (moved) {
          // posição já com a escala de onde ele vai ficar: o ponto agarrado fica no dedo
          const p = sim.G;
          let sc = G.room.depthScale(t.z);
          let by = p.y - offL.y * sc;
          for (let i = 0; i < 2; i++) { sc = G.room.depthScale(U.clamp(by + lift, geo.zMin, geo.zMax)); by = p.y - offL.y * sc; }
          const bx = U.clamp(p.x - offL.x * sc, t.w * 0.5, G.room.W - t.w * 0.5);
          by = Math.max(geo.top + t.hh, by);
          const z = U.clamp(by + lift, geo.zMin, geo.zMax);
          t.x = bx; t.z = z; t.h = Math.max(0, z - by);
          t.lastMoved = now;
        }
        mark(t);
      };
      gsap.ticker.add(tick);

      const end = (cancelled) => {
        gsap.ticker.remove(tick);
        t.dragging = false;
        // volta a girar pelo meio (compensado: sem pulo) e a imagem assenta com geleca
        if (tilts) setToyOrigin(t, 0.5, 0.5);
        mark(t);
        gsap.fromTo(img, { scaleX: gsap.getProperty(img, 'scaleX'), scaleY: gsap.getProperty(img, 'scaleY') },
          { scaleX: 1, scaleY: 1, duration: 0.7, ease: 'elastic.out(1, .32)', overwrite: 'auto' });
        if (t.stolen) return;
        if (!moved && !cancelled) {
          // toque simples
          if (t.def.showName) G.hud.tag(t.el, t.def.label);
          if (t.def.plush) { squish(t); G.bus.emit('toy:squish', t); return; }
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
        // o balanço do arraste continua um pouquinho e volta com mola (roll/spin seguem a física)
        if (tilts && !t.def.spin) {
          const kickRot = t.rot + U.clamp(sim.om * 57.29578 * 0.12, -25, 25);
          gsap.to(t, { keyframes: [{ rot: kickRot, duration: 0.12, ease: 'power1.out' }, { rot: 0, duration: 0.7, ease: 'elastic.out(1, .35)' }], onUpdate: () => mark(t) });
        }
        if (Math.hypot(vx, vy) > 900) G.audio.play('whoosh', { intensity: 0.6 });
        G.bus.emit('toy:thrown', { toy: t, speed: Math.hypot(vx, vy) });
      };

      const sample = (p, e) => {
        samples.push({ x: p.x, y: p.y, t: (e && e.timeStamp) || U.now() });
        if (samples.length > 32) samples.shift();
      };

      return {
        sample,
        move(p, e) {
          if (t.stolen) return;
          sample(p, e);
          sim.finger = p;
          if (!moved && U.dist(p.x, p.y, start.x, start.y) > 6) moved = true;
          if (!moved) return;
          G.bus.emit('toy:move', t);
          if (t.def.plush) {
            const s = G.room.depthScale(t.z);
            plushNear(t, p.x - offL.x * s, p.y - offL.y * s - t.hh / 2);
          }
        },
        up() { end(false); },
        cancel() { end(true); }
      };
    }
  };

  /* ---------- pelúcia ---------- */
  function squish(t) {
    const im = t.wrap.firstChild;
    gsap.fromTo(im, { scaleY: 0.7, scaleX: 1.24 }, { scaleY: 1, scaleX: 1, duration: 0.85, ease: 'elastic.out(1, .3)', transformOrigin: '50% 100%' });
    G.audio.play('squish', { pitch: U.rand(0.9, 1.15) });
    if (G.petState.can('autonomous')) G.physics.faceTo(t.x);
  }

  /** Segurou a pelúcia pertinho da cara do pet → ele reage (x, y = onde o dedo está levando) */
  function plushNear(t, x, y) {
    const head = G.physics.anchorPoint('eyes');
    const close = Math.hypot(x - head.x, y - head.y) < G.room.petW * 0.55;
    const now = U.now();
    if (!close) { t.nearSince = 0; return; }
    if (t.nearSince === -1) return;              // já reagiu nesta aproximação
    if (!t.nearSince) t.nearSince = now;
    if (now - t.nearSince > 450) {
      t.nearSince = -1;
      G.reactions.plush(t, 'offered');
    }
  }

  /* ======================================================================
     SESSÃO DE BRINCADEIRA (o pet persegue o alvo)
     ====================================================================== */
  function targetOf(s) {
    const t = s.toy;
    if (!t) return null;
    return { x: t.x, z: t.z, h: t.h, toy: t, moving: t.dragging || t.running || U.now() - t.lastMoved < 300 };
  }

  function startSession(opts) {
    const ps = G.petState;
    if (!ps.can('play')) {
      if (!ps.activity && !ps.physical) {
        // sem energia: só olha
        const tg = opts.toy;
        if (tg && G.physics.isIdle()) G.physics.faceTo(tg.x);
        if (G.needs.get('energy') <= G.config.play.minEnergyToPlay && !G.bubble.visible) G.bubble.show('z', { duration: 1400 });
      }
      return;
    }
    if (session) {
      session.toy = opts.toy;
      session.lastSeen = U.now();
      return;
    }
    session = { toy: opts.toy, started: U.now(), lastSeen: U.now(), busy: false, catches: 0, lastAction: 0 };
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

    // alvo no ar (você segurando o brinquedo):
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
        else if (Math.random() < 0.3) G.bubble.show('!!', { duration: 700 });
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
      await U.wait(220);
      G.physics.setPose('stand');
      const side = Math.sign(tg.x - P.x) || facing;
      const ok = await G.physics.jumpTo(tg.x - side * G.room.petW * 0.18, tg.z, { height: U.clamp(dist * 0.4 + tg.h, 26, 80), kind: 'pounce' });
      G.needs.add({ energy: -cfg.energyPerPounce }, 'play');
      if (!ok || session !== s) { s.busy = false; return; }
      const t2 = targetOf(s);
      if (t2) {
        const d2 = Math.hypot(t2.x - (G.physics.P.x + G.physics.facing * G.room.petW * 0.22), t2.z - G.physics.P.z);
        if (d2 < cfg.catchRadius * 1.5 && t2.h < 40) await catchTarget(t2);
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
        G.physics.walkTo(goal.x, goal.z, { run: dist > 60 }).then(() => { if (session === s) s.walkTarget = null; });
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
    // largou da mão: volta a girar pelo meio e a imagem assenta
    if (t.origin && (t.origin.x !== 0.5 || t.origin.y !== 0.5)) setToyOrigin(t, 0.5, 0.5);
    gsap.to(t.wrap.firstChild, { scaleX: 1, scaleY: 1, duration: 0.6, ease: 'elastic.out(1, .35)', overwrite: 'auto' });
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
      TOY_DEFS = buildDefs();
      for (const id of Object.keys(TOY_DEFS)) makeToy(id);

      // fio do novelo (SVG do tamanho do quarto)
      const NS = 'http://www.w3.org/2000/svg';
      stringSvg = document.createElementNS(NS, 'svg');
      stringSvg.setAttribute('class', 'yarn-string');
      stringSvg.style.position = 'absolute';
      stringSvg.style.zIndex = '2';
      world.appendChild(stringSvg);
      for (const t of Object.values(toys)) {
        if (!t.def.string) continue;
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#3f7f7a');
        path.setAttribute('stroke-width', '2.5');
        path.setAttribute('stroke-linecap', 'round');
        stringSvg.appendChild(path);
        t.stringPath = path;
      }

      gsap.ticker.add(renderToys);
      gsap.ticker.add(toyDepth);

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

      G.bus.on('toy:move', (t) => {
        if (t.def.chase === false) return;          // pelúcia: o pet não persegue
        if (t.dragging || t.running) startSession({ toy: t });
        else if (G.physics.isIdle() && !G.petState.activity && !G.petState.physical) G.physics.faceTo(t.x);
      });
      G.bus.on('toy:thrown', ({ toy }) => { if (toy.def.chase !== false) startSession({ toy }); });
      // a pelúcia caiu perto dele
      G.bus.on('toy:rest', (t) => {
        if (!t.def.plush) return;
        const P = G.physics.P;
        if (Math.hypot(t.x - P.x, t.z - P.z) < G.room.petW * 0.9 && U.chance(0.6)) setTimeout(() => G.reactions.plush(t, 'landed'), 300);
      });
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
      const list = Object.values(toys).filter((t) => t.def.chase !== false && !t.dragging && !t.running && !G.room.inFootprint('tub', t.x, t.z, 20));
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

    nearestToy(x, z, filter) {
      let best = null, bd = Infinity;
      for (const t of Object.values(toys)) {
        if (filter && !filter(t)) continue;
        const d = Math.hypot(t.x - x, t.z - z);
        if (d < bd) { bd = d; best = t; }
      }
      return best ? { toy: best, dist: bd } : null;
    },

    get toys() { return toys; },
    get session() { return session; },
    endSession,
    kick,
    steal,
    squish
  };
})(window.Game = window.Game || {});
