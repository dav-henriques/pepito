/* ==========================================================================
   FÍSICA PERCEBIDA DO PET — Anime.js
   --------------------------------------------------------------------------
   Este é o sistema que faz o pet parecer um objeto de verdade.
   Toda a movimentação física é feita com Anime.js:

   • drag ............ simulação de molas rodando no timer do Anime.js
                       (createTimer → frame()): o ponto agarrado segue o dedo
                       por uma mola; a foto é um pêndulo pendurado nesse ponto
                       (embalo, peso, balança e assenta); estica/achata e
                       enverga como papel com molas pouco amortecidas (jiggle).
   • squash/stretch .. no drag pela simulação; spring() ao pousar.
   • inércia ......... animate() com 'outQuad' — desaceleração constante
                       (atrito de Coulomb): v0 = 2·d/T, então a velocidade do
                       dedo no momento em que solta é preservada.
   • gravidade ....... animate() em segmentos balísticos. Subida = 'outQuad'
                       e queda = 'inQuad' são as curvas EXATAS de um corpo sob
                       gravidade; quando há velocidade inicial, uma função de
                       easing customizada resolve h(t) = h0 + v·t − ½·g·t².
   • quiques ......... ao tocar o chão, um novo segmento com v·restituição.
   • paredes ......... a posição é animada "desdobrada" e refletida na parede
                       (com perda de energia) dentro do onUpdate.
   • mola/damping .... spring({ stiffness, damping, velocity }) para voltar à
                       posição neutra, com a velocidade angular herdada.
   • efeito papel .... skewX: a foto "enverga" com o tranco do arraste e volta
                       com spring() ao soltar.

   Coordenadas (2.5D):  x = horizontal, z = profundidade no chão (y da sombra),
   h = altura acima do chão.  Na tela: y = z − h.
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;
  const { animate, createTimer, spring, utils } = window.anime;

  const C = () => G.config.physics;
  const K = () => C().intensity * (U.reducedMotion ? 0.6 : 1);

  /* ---------- estado animado pelo Anime.js ---------- */
  const P = { x: 0, z: 0, h: 0 };          // posição
  const D = { rot: 0, sx: 1, sy: 1, sk: 0 }; // corpo (rotação / squash-stretch / skew "papel")
  const F = { face: 1 };                   // espelhamento (virar)
  const POSE = { x: 1, y: 1 };             // pose: sentado, deitado…
  const E = { rot: 0, sx: 1, sy: 1 };      // efeitos extras: ronronar, dançar
  const LIFT = { s: 1 };                   // "descolar" do papel ao ser pego (escala em volta do dedo)

  let els = null;
  let W = 128, H = 128;
  let geo = null;
  let mode = 'idle';                       // idle | held | drag | air | walk | anchored
  let chainId = 0;
  let motion = null;                       // { id, resolve }
  const running = new Set();
  let drag = null;                         // simulação do gesto atual (molas)
  let rotOrigin = { x: 0.5, y: 0.55 };     // fração da caixa
  let last = {};
  let zOverride = null;                    // z-index forçado (ex.: sendo carregado)
  let heading = 1;                         // para que lado ele está virado (1 = direita)

  /** A imagem atual é uma foto (cartão)? Fotos não espelham e entortam menos. */
  const isPhoto = () => !!(G.anim && G.anim.isCard);
  const photoK = () => (isPhoto() ? (C().photoDeform ?? 0.4) : 1);
  /** Ponto de giro "em repouso" (fração da caixa): foto gira pelo centro do cartão;
      gato recortado, um pouco abaixo do meio (onde fica o corpo) */
  const restPivot = () => (isPhoto() ? { x: 0.5, y: 0.5 } : { x: 0.5, y: 0.55 });
  /** Pode espelhar a imagem ao virar? (true | false | 'auto' = só recortes, nunca fotos) */
  function canMirror() {
    const f = G.config.pet.flipWhenWalking;
    return f === true || (f === 'auto' && !isPhoto());
  }

  /* ======================================================================
     RENDER — uma única escrita de transform por camada, só se mudou
     ====================================================================== */
  function render() {
    if (!els) return;
    const s = G.room.depthScale(P.z);
    const footY = H * G.config.pet.footOffset;
    let cx = 0, cy = 0;
    if (drag && mode === 'drag' && drag.compK > 0.001) {
      // o estica/achata/enverga acontece em volta dos pés; segurando pela cabeça,
      // isso deslocaria o ponto agarrado. Desloca o pet ao contrário para o
      // ponto agarrado ficar parado embaixo do dedo
      const sx = D.sx * POSE.x * E.sx, sy = D.sy * POSE.y * E.sy;
      const gx = (rotOrigin.x - 0.5) * W, gy = (rotOrigin.y - 1) * H;
      const dx = sx * (gx + Math.tan(D.sk / RAD) * gy) - gx, dy = sy * gy - gy;
      const th = (D.rot + E.rot) / RAD, cos = Math.cos(th), sin = Math.sin(th);
      const k = -s * LIFT.s * drag.compK;
      cx = k * (dx * cos - dy * sin);
      cy = k * (dx * sin + dy * cos);
    }
    last.compX = cx; last.compY = cy;
    const tx = P.x - W / 2 + cx;
    const ty = P.z - P.h - H + footY + cy;

    const rootT = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) scale(${s.toFixed(4)})`;
    if (rootT !== last.root) { els.root.style.transform = rootT; last.root = rootT; }

    // giro + "descolar" em volta do ponto onde o dedo segurou
    const rotT = `rotate(${(D.rot + E.rot).toFixed(2)}deg) scale(${LIFT.s.toFixed(4)})`;
    if (rotT !== last.rot) { els.rot.style.transform = rotT; last.rot = rotT; }

    const sqT = `scale(${(D.sx * POSE.x * E.sx).toFixed(4)},${(D.sy * POSE.y * E.sy).toFixed(4)}) skewX(${D.sk.toFixed(2)}deg)`;
    if (sqT !== last.sq) { els.squash.style.transform = sqT; last.sq = sqT; }

    const fT = `scaleX(${F.face.toFixed(3)})`;
    if (fT !== last.face) { els.face.style.transform = fT; last.face = fT; }

    // sombra: encolhe e some com a altura
    const lift = Math.max(0, P.h);
    const sc = U.clamp(1 - lift / 280, 0.35, 1) * s;
    const op = U.clamp(1 - lift / 360, 0.2, 1);
    const sw = W * 0.62, sh = W * 0.15;
    const shT = `translate3d(${(P.x - sw / 2).toFixed(2)}px,${(P.z - sh / 2).toFixed(2)}px,0) scale(${sc.toFixed(3)})`;
    if (shT !== last.sh) { els.shadow.style.transform = shT; last.sh = shT; }
    const opS = op.toFixed(2);
    if (opS !== last.op) { els.shadow.style.opacity = opS; last.op = opS; }

    // profundidade em degraus de 3px: andando, o z-index muda bem menos vezes
    // (cada mudança obriga o navegador a reordenar as camadas)
    const zq = Math.round(P.z / 3) * 3;
    const zi = zOverride ?? zq + 1;
    if (zi !== last.zi) { els.root.style.zIndex = zi; els.shadow.style.zIndex = zq - 1; last.zi = zi; }
  }

  /* ======================================================================
     CONTROLE DE MOVIMENTOS (cancelamento seguro)
     ====================================================================== */
  function track(anim) {
    running.add(anim);
    return anim;
  }
  function untrack(anim) { running.delete(anim); }

  function stopMotions(opts = {}) {
    chainId++;
    if (motion) { const m = motion; motion = null; m.resolve(false); }
    for (const a of running) { try { a.pause(); } catch (e) { /* ok */ } }
    running.clear();
    utils.remove(P);
    if (opts.body) utils.remove(D);
    // o rebolado do andar (camada E) não pode ficar "torto" se a caminhada foi interrompida
    if (mode === 'walk') {
      utils.remove(E, null, 'rot');
      if (Math.abs(E.rot) > 0.05) animate(E, { rot: 0, duration: 220, ease: 'out(2)' });
    }
  }

  function beginMotion(kind) {
    stopMotions();
    const id = chainId;
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    motion = { id, resolve, kind };
    return { id, promise };
  }

  function endMotion(id, ok = true) {
    if (motion && motion.id === id) {
      const m = motion; motion = null;
      m.resolve(ok);
    }
  }

  /** anime.animate + registro para poder cancelar */
  function anim(target, params) {
    const userComplete = params.onComplete;
    const a = animate(target, {
      ...params,
      onComplete: (self) => { untrack(a); if (userComplete) userComplete(self); }
    });
    return track(a);
  }

  /* ======================================================================
     HELPERS FÍSICOS
     ====================================================================== */
  function springEase(base, velocity = 0) {
    return spring({ ...base, velocity: U.clamp(velocity, -60, 60) });
  }

  /** Volta a rotação para 0 herdando a velocidade angular (deg/s) */
  function rotSpringTo(target = 0, angVel = 0, base = C().tiltSpring) {
    const from = D.rot;
    const dist = target - from;
    if (Math.abs(dist) < 1.5 && Math.abs(angVel) > 40) {
      // passando pelo zero rápido: empurra um pouco e deixa a mola agir
      const kick = U.clamp(angVel * 0.07, -18, 18);
      return animate(D, { rot: [{ to: from + kick, duration: 110, ease: 'out(2)' }, { to: target, ease: springEase(base) }] });
    }
    const v = Math.abs(dist) > 0.5 ? angVel / dist : 0;
    return animate(D, { rot: target, ease: springEase(base, v) });
  }

  /** Geleca: parte de um squash (sx, sy) e deixa a mola devolver ao normal */
  function jelly(sx, sy, base = C().settleSpring) {
    return animate(D, { sx: [sx, 1], sy: [sy, 1], ease: spring(base) });
  }

  /** Quanto a FOTO pode ser deformada (esticar/achatar). Foto de verdade
      esticada parece imagem distorcida, não gato: deforma bem menos que um recorte */
  const SQ = () => (isPhoto() ? (C().photoSquash ?? 0.4) : 1);

  /** Pancada/tranco: geleca já na medida certa para foto ou recorte */
  function boing(sx, sy, base) {
    const f = SQ();
    return jelly(1 + (sx - 1) * f, 1 + (sy - 1) * f, base);
  }

  /** Reflete uma coordenada "desdobrada" nas paredes, com perda de energia */
  function fold(u, min, max, e) {
    let pos = u, hits = 0;
    for (let i = 0; i < 6; i++) {
      if (pos > max) { pos = max - (pos - max) * e; hits++; }
      else if (pos < min) { pos = min + (min - pos) * e; hits++; }
      else break;
    }
    return { pos: U.clamp(pos, min, max), hits };
  }

  /** Limite macio: passa um pouco da borda e "segura" (elástico) */
  function soft(v, min, max, L = 26) {
    if (v < min) return min - L * (1 - Math.exp((v - min) / L));
    if (v > max) return max + L * (1 - Math.exp(-(v - max) / L));
    return v;
  }

  function ceilingFor(z) {
    return Math.max(10, z - H * G.room.depthScale(z) * 0.95 - geo.top);
  }

  /* ======================================================================
     INÉRCIA (eixo x ou z) — Anime.js 'outQuad' = desaceleração constante
     ====================================================================== */
  function inertia(axis, v, id, pending) {
    const c = C();
    if (Math.abs(v) < 14) { pending[axis] = false; return; }
    const T = U.clamp(Math.abs(v) / c.friction, 0.14, 1.7);
    const d = (v * T) / 2;                       // outQuad: v0 = 2d/T
    const [min, max] = axis === 'x' ? [geo.minX, geo.maxX] : [geo.zMin, geo.zMax];
    const e = c.wallRestitution;
    const tgt = { u: P[axis] };
    let hits = 0, prevU = tgt.u, prevT = U.now();
    pending[axis] = true;
    anim(tgt, {
      u: tgt.u + d,
      duration: T * 1000,
      ease: 'outQuad',
      onUpdate: () => {
        if (id !== chainId) return;
        const r = fold(tgt.u, min, max, e);
        P[axis] = r.pos;
        const now = U.now();
        const speed = Math.abs(tgt.u - prevU) / Math.max(0.001, (now - prevT) / 1000);
        prevU = tgt.u; prevT = now;
        if (r.hits > hits) {
          hits = r.hits;
          wallImpact(axis, speed * e, r.pos <= min + 0.5 ? -1 : 1);
        }
      },
      onComplete: () => {
        if (id !== chainId) return;
        pending[axis] = false;
        trySettle(id, pending);
      }
    });
  }

  /** Skew "papel" volta para 0 com mola */
  function skewSettle(kick = 0) {
    const base = C().settleSpring;
    if (kick) animate(D, { sk: [{ to: kick, duration: 70, ease: 'out(2)' }, { to: 0, ease: spring(base) }] });
    else if (Math.abs(D.sk) > 0.15) animate(D, { sk: 0, ease: spring(base) });
  }

  function wallImpact(axis, speed, side) {
    const k = K();
    if (speed < 80) return;
    const q = U.clamp(speed * 0.00022 * k, 0.04, 0.22);
    if (axis === 'x') {
      boing(1 - q, 1 + q * 0.7);
      rotSpringTo(0, -side * speed * 0.12);
      skewSettle(U.clamp(side * q * 45, -C().maxSkew, C().maxSkew) * photoK());
    } else {
      boing(1 + q * 0.6, 1 - q * 0.6);
    }
    G.bus.emit('physics:wall', { axis, side, speed, x: P.x, z: P.z, h: P.h });
  }

  /* ======================================================================
     GRAVIDADE — segmentos balísticos exatos com Anime.js
     ====================================================================== */
  /** Easing customizado para h(t) = h0 + v0·t − ½·g·t² normalizado em [0,1] */
  function ballisticEase(v0, g, T, dh) {
    return (p) => {
      const t = p * T;
      return (v0 * t - 0.5 * g * t * t) / dh;
    };
  }

  function ballistic(v0, id, pending, info) {
    const c = C();
    const g = c.gravity;
    const h0 = P.h;
    const ceil = ceilingFor(P.z);
    const stretchK = c.airStretchPerSpeed * K();

    // ---- subindo ----
    if (v0 > 0.5) {
      const apex = h0 + (v0 * v0) / (2 * g);
      if (apex > ceil && ceil > h0 + 2) {
        // bate no teto
        const disc = Math.max(0, v0 * v0 - 2 * g * (ceil - h0));
        const tc = (v0 - Math.sqrt(disc)) / g;
        const vc = v0 - g * tc;
        airStretch(v0, vc, tc, stretchK);
        anim(P, {
          h: ceil, duration: tc * 1000, ease: ballisticEase(v0, g, tc, ceil - h0),
          onComplete: () => {
            if (id !== chainId) return;
            info.ceiling = true;
            boing(1 + 0.18, 1 - 0.2);
            G.bus.emit('physics:ceiling', { speed: vc, x: P.x, z: P.z });
            ballistic(-vc * c.ceilingRestitution, id, pending, info);
          }
        });
        return;
      }
      const tUp = v0 / g;
      if (!info.bounces) airStretch(v0, 0, tUp, stretchK); // no quique, deixa o squash da geleca aparecer
      anim(P, {
        h: apex, duration: tUp * 1000, ease: 'outQuad',  // subida exata sob gravidade
        onComplete: () => { if (id === chainId) ballistic(0, id, pending, info); }
      });
      return;
    }

    // ---- caindo (v0 <= 0) ----
    const dh = h0;
    if (dh <= 0.5) {
      land(Math.abs(v0), id, pending, info);
      return;
    }
    const vd = -v0; // velocidade para baixo (>= 0)
    const tf = (-vd + Math.sqrt(vd * vd + 2 * g * dh)) / g;
    const vImp = vd + g * tf;
    airStretch(-vd, -vImp, tf, stretchK);
    const ease = vd < 0.5 ? 'inQuad' : ((p) => { const t = p * tf; return (vd * t + 0.5 * g * t * t) / dh; });
    anim(P, {
      h: 0, duration: Math.max(16, tf * 1000), ease,
      onComplete: () => { if (id === chainId) land(vImp, id, pending, info); }
    });
  }

  /** Stretch vertical proporcional à velocidade durante o voo (linear no tempo) */
  function airStretch(vStart, vEnd, T, k) {
    const a = Math.abs(vStart), b = Math.abs(vEnd);
    if (Math.max(a, b) < 320 || T < 0.06) return;
    const f = SQ();
    const s0 = U.clamp(a * k, 0, 0.16) * f, s1 = U.clamp(b * k, 0, 0.16) * f;
    animate(D, {
      sy: [1 + s0, 1 + s1], sx: [1 - s0 * 0.6, 1 - s1 * 0.6],
      duration: T * 1000, ease: 'linear'
    });
  }

  function land(vImp, id, pending, info) {
    const c = C();
    const k = K();
    info.bounces = (info.bounces || 0) + 1;
    info.maxImpact = Math.max(info.maxImpact || 0, vImp);
    P.h = 0;

    if (info.flip && info.bounces === 1) {
      // cambalhota termina em pé
      D.rot = ((D.rot % 360) + 540) % 360 - 180;
      rotSpringTo(0, 0);
    } else if (info.bounces === 1 && Math.abs(D.rot) > 2) {
      rotSpringTo(0, -D.rot * 6);
    }

    if (vImp > 60) {
      const q = U.clamp(vImp * c.landSquashPerSpeed * k, 0.05, c.maxSquash);
      boing(1 + q, 1 - q * 1.05);
    }
    G.bus.emit('physics:land', { speed: vImp, x: P.x, z: P.z, bounce: info.bounces, kind: info.kind });

    const vb = vImp * c.floorRestitution;
    if (vb > c.minBounceSpeed && info.bounces < 5) {
      ballistic(vb, id, pending, info);
    } else {
      pending.v = false;
      trySettle(id, pending, info);
    }
  }

  function trySettle(id, pending, info = pending.info) {
    if (id !== chainId) return;
    if (pending.v || pending.x || pending.z) return;
    mode = 'idle';
    if (Math.abs(D.rot) > 0.5 && !info?.flip) rotSpringTo(0, 0);
    G.bus.emit('physics:settled', { x: P.x, z: P.z, kind: info?.kind, impact: info?.maxImpact || 0, ceiling: !!info?.ceiling });
    endMotion(id, true);
  }

  /* ======================================================================
     VELOCIDADE DO DEDO
     ====================================================================== */
  function pointerVelocity(now) {
    const s = drag?.samples;
    if (!s || s.length < 2) return { x: 0, y: 0 };
    const win = C().velocityWindow;
    const lastS = s[s.length - 1];
    let first = lastS;
    for (let i = s.length - 2; i >= 0; i--) {
      first = s[i];
      if (lastS.t - s[i].t > win) break;
    }
    const dt = Math.max(8, lastS.t - first.t) / 1000;
    let vx = (lastS.x - first.x) / dt, vy = (lastS.y - first.y) / dt;
    // se o dedo parou antes de soltar, a velocidade "morre"
    const idle = now - lastS.t;
    if (idle > 30) {
      const f = U.clamp(1 - (idle - 30) / 90, 0, 1);
      vx *= f; vy *= f;
    }
    return { x: vx, y: vy };
  }

  /* ======================================================================
     ORIGEM DA ROTAÇÃO — gira em torno do ponto onde o dedo segurou
     (com compensação para não "pular")
     ====================================================================== */
  function setRotOrigin(fx, fy) {
    const th = (D.rot + E.rot) * Math.PI / 180;
    const s = G.room.depthScale(P.z);
    const L = LIFT.s;
    const o1x = rotOrigin.x * W, o1y = rotOrigin.y * H;
    const o2x = fx * W, o2y = fy * H;
    const vx = o2x - o1x, vy = o2y - o1y;
    const cos = Math.cos(th), sin = Math.sin(th);
    // (I − R·L)·v  (giro e "descolar" acontecem em volta da origem)
    const dx = vx - L * (cos * vx - sin * vy);
    const dy = vy - L * (sin * vx + cos * vy);
    P.x -= dx * s;
    P.h += dy * s;
    rotOrigin = { x: fx, y: fy };
    els.rot.style.transformOrigin = `${(fx * 100).toFixed(1)}% ${(fy * 100).toFixed(1)}%`;
  }

  /* ======================================================================
     LOOP DE QUADRO (timer do Anime.js)
     ====================================================================== */
  let lastFrame = U.now();
  function frame() {
    const now = U.now();
    const dt = U.clamp((now - lastFrame) / 1000, 0, 0.05);
    lastFrame = now;
    if (drag && (mode === 'drag' || mode === 'held')) stepDrag(dt, now);
    render();
  }

  /* ======================================================================
     ARRASTE — simulação física de verdade (molas + pêndulo), a cada quadro
     ----------------------------------------------------------------------
     • o dedo puxa o "ponto agarrado" por uma mola suave (nada de trancos);
     • a foto é um corpo pendurado nesse ponto: herda o embalo do dedo e
       balança como pêndulo (segurada pela pontinha, pende com o peso);
     • estica/achata com o tranco e enverga como papel;
     • tudo com molas pouco amortecidas: ao parar, ela balança e assenta
       sozinha. Roda dentro do timer do Anime.js (frame()).
     Ajustes: petConfig → physics.drag
     ====================================================================== */
  const TAU = Math.PI * 2;
  const RAD = 180 / Math.PI;

  function stepDrag(dt, now) {
    const c = C(), p = c.drag || {}, k = K();
    const lifted = mode === 'drag';
    const phot = isPhoto() ? (p.photo ?? 0.8) : 1;
    const wF = TAU * (p.follow ?? 7.5), zF = p.followDamping ?? 0.7;
    const wS = TAU * (p.swing ?? 1.5), zS = p.swingDamping ?? 0.2;
    const wJ = TAU * (p.jiggle ?? 3.2), zJ = p.jiggleDamping ?? 0.16;
    const wB = TAU * (p.bend ?? 2.4), zB = p.bendDamping ?? 0.2;
    const gEff = lifted ? c.gravity * (p.weight ?? 1.4) : 0;
    const maxTh = (p.maxSwing ?? 30) / RAD;
    const soft = Math.max(1, p.softness ?? 4500);
    const kJ = 9.6e-6 * wJ * wJ * (p.stretch ?? 1) * phot * k;      // estica por px/s² de puxão
    const kB = 0.0012 * wB * wB * (p.bendAmount ?? 1) * phot * k;   // graus de "envergar" por px/s²

    // corpo: centro da foto em relação ao ponto agarrado (px de tela, sem giro)
    const s = G.room.depthScale(P.z), L = LIFT.s;
    const rx0 = (0.5 - rotOrigin.x) * W * s * L, ry0 = (0.52 - rotOrigin.y) * H * s * L;
    const rl = Math.hypot(rx0, ry0);
    const hx = rl > 4 ? rx0 / rl : 0, hy = rl > 4 ? ry0 / rl : 1;
    const inertia = rx0 * rx0 + ry0 * ry0 + ((W * W + H * H) * s * s * L * L) / 12;

    const d = drag;
    const n = U.clamp(Math.ceil(dt * 240), 1, 12);
    const hstep = dt / n;
    for (let i = 0; i < n; i++) {
      let ax = 0, ay = 0;
      if (lifted) {
        ax = wF * wF * (d.finger.x - d.G.x) - 2 * zF * wF * d.vG.x;
        ay = wF * wF * (d.finger.y - d.G.y) - 2 * zF * wF * d.vG.y;
        d.vG.x += ax * hstep; d.vG.y += ay * hstep;
        d.G.x += d.vG.x * hstep; d.G.y += d.vG.y * hstep;
      }
      // força (por massa) no corpo, vista de quem segura: peso − aceleração do dedo.
      // "Joelho" suave: tranco pequeno vira quase nada, puxão forte continua vivo
      const am = Math.hypot(ax, ay), knee = am / (am + soft);
      const fx = -ax * knee, fy = gEff - ay * knee;
      const cos = Math.cos(d.th), sin = Math.sin(d.th);
      const rx = rx0 * cos - ry0 * sin, ry = rx0 * sin + ry0 * cos;
      let alpha = (rx * fy - ry * fx) / inertia - wS * wS * d.th - 2 * zS * wS * d.om;
      if (Math.abs(d.th) > maxTh) alpha -= (d.th - Math.sign(d.th) * maxTh) * wS * wS * 6;   // batente macio
      d.om += alpha * hstep;
      d.th += d.om * hstep;
      // a mesma força no referencial da foto: ao longo do "braço" estica, de lado enverga
      const flx = fx * cos + fy * sin, fly = -fx * sin + fy * cos;
      const fPar = flx * hx + fly * hy;
      const fPerp = hx * fly - hy * flx;
      d.ev += (kJ * fPar - wJ * wJ * d.e - 2 * zJ * wJ * d.ev) * hstep;
      d.e += d.ev * hstep;
      d.bv += (-kB * fPerp * Math.abs(hy) - wB * wB * d.b - 2 * zB * wB * d.bv) * hstep;
      d.b += d.bv * hstep;
    }
    d.e = U.clamp(d.e, -0.22, 0.26);
    d.b = U.clamp(d.b, -c.maxSkew * 1.4, c.maxSkew * 1.4);

    // escreve no corpo: o estica-e-achata segue a direção do "braço"
    const wy = hy * hy, wx = hx * hx;
    D.rot = d.th * RAD;
    D.sy = 1 + d.e * (wy - 0.55 * wx);
    D.sx = 1 + d.e * (wx - 0.55 * wy);
    D.sk = d.b;

    d.v = pointerVelocity(now);
    if (lifted) {
      d.compK += (1 - d.compK) * Math.min(1, dt * 10);   // entra aos poucos (sem pulo ao levantar)
      placeFromGrab(now);
      shakeCheck(now);
    }
  }

  /** Pancadinha no corpo (bateu na parede arrastando): balanço + envergada */
  function dragKick(side, speed) {
    if (!drag) return;
    const q = U.clamp(speed / 900, 0.3, 1.4);
    drag.om -= side * 2.6 * q;
    drag.bv += side * 70 * q;
    drag.ev -= 1.6 * q;
  }

  /** Chacoalhar = muitas inversões rápidas de direção */
  function shakeCheck(now) {
    const c = C();
    const v = drag.v;
    if (Math.abs(v.x) > c.shakeSpeed) {
      const dir = Math.sign(v.x);
      if (dir !== drag.dir) {
        drag.dir = dir;
        drag.reversals.push(now);
      }
    }
    while (drag.reversals.length && now - drag.reversals[0] > c.shakeWindow) drag.reversals.shift();
    if (drag.reversals.length >= c.shakeReversals && now > drag.shakeCooldown) {
      drag.reversals.length = 0;
      drag.shakeCooldown = now + 850;
      drag.shakes++;
      G.bus.emit('physics:shake', { count: drag.shakes });
    }
  }

  /** Posiciona o pet a partir do ponto agarrado (que a mola trouxe até o dedo).
      "Estar no colo" aparece pela sombra que descola do chão (liftHeight). */
  function placeFromGrab(now) {
    const c = C();
    const pt = drag.G;
    // o pet encolhe no fundo do quarto (profundidade): calcula a posição já com a
    // escala de onde ele vai ficar, para o ponto agarrado não escorregar do dedo
    let s = G.room.depthScale(P.z);
    let ay = pt.y - drag.offYL * s;
    for (let i = 0; i < 2; i++) {
      s = G.room.depthScale(U.clamp(ay + c.liftHeight, geo.zMin, geo.zMax));
      ay = pt.y - drag.offYL * s;
    }
    const rawX = pt.x - drag.offXL * s;
    const ax = soft(rawX, geo.minX, geo.maxX);

    // não deixa sumir pelo teto nem afundar no chão
    const sTop = G.room.depthScale(geo.zMin);
    ay = soft(ay, geo.top + H * sTop * 0.9, Infinity, 18);
    ay = soft(ay, -Infinity, geo.zMax, 10);

    const z = U.clamp(ay + c.liftHeight, geo.zMin, geo.zMax);
    const h = Math.max(0, z - ay);

    // bateu na parede arrastando rápido: tranco no corpo
    const outside = rawX < geo.minX - 4 || rawX > geo.maxX + 4;
    if (outside && !drag.outside) {
      const sp = Math.abs(drag.vG.x);
      if (sp > 380) {
        const side = rawX < geo.minX ? -1 : 1;
        dragKick(side, sp);
        G.bus.emit('physics:wall', { axis: 'x', side, speed: sp * 0.6, x: ax, z, h, dragging: true });
      }
    }
    drag.outside = outside;

    P.x = ax;
    P.z = z;
    P.h = h;
  }

  /* ======================================================================
     API PÚBLICA
     ====================================================================== */
  const physics = {
    P, D, F, POSE, E, LIFT,

    init(elements) {
      els = elements;
      this.resize();
      createTimer({ onUpdate: frame });   // loop de render no motor do Anime.js
      G.bus.on('room:resize', () => this.resize());
    },

    resize() {
      W = G.room.petW; H = G.room.petH;
      const old = geo;
      geo = { ...G.room.geo };
      // mantém a posição relativa (rotação do celular, janela redimensionada…)
      if (old && old.maxX > old.minX + 10 && old.zMax > old.zMin + 10) {
        P.x = geo.minX + ((P.x - old.minX) / (old.maxX - old.minX)) * (geo.maxX - geo.minX);
        P.z = geo.zMin + ((P.z - old.zMin) / (old.zMax - old.zMin)) * (geo.zMax - geo.zMin);
      } else if (old) {
        // o quarto tinha tamanho zero (aba oculta ao abrir): centraliza
        P.x = G.room.W / 2; P.z = (geo.zMin + geo.zMax) / 2;
      }
      if (mode === 'idle' || mode === 'walk' || !old) {
        const c = G.room.clampFloor(P.x, P.z);
        P.x = c.x; P.z = c.z;
      }
      last = {};
      render();
    },

    get mode() { return mode; },
    isIdle() { return mode === 'idle'; },
    isBusy() { return mode !== 'idle'; },
    get facing() { return heading; },
    get size() { return { w: W, h: H }; },

    /** Posição atual (cópia) */
    get() { return { x: P.x, z: P.z, h: P.h, mode }; },

    /** Ponto de tela de um anchor do config (cabeça, boca…) */
    anchorPoint(name = 'top') {
      const a = G.config.pet.anchors[name] || { x: 0.5, y: 0.2 };
      const s = G.room.depthScale(P.z);
      return { x: P.x + (a.x - 0.5) * W * s, y: P.z - P.h - (1 - a.y) * H * s };
    },

    place(x, z, h = 0) {
      stopMotions({ body: true });
      P.x = x; P.z = z; P.h = h;
      D.rot = 0; D.sx = 1; D.sy = 1; D.sk = 0;
      utils.remove(LIFT); LIFT.s = 1;
      mode = 'idle';
      render();
    },

    setZIndex(z) { zOverride = z; render(); },

    stop() {
      stopMotions();
      if (mode !== 'anchored') mode = 'idle';
    },

    /* ---------------- gesto: pressionar / arrastar / soltar ---------------- */

    /** Dedo encostou no pet */
    press(pt) {
      stopMotions({ body: true });
      utils.remove(E, null, 'rot');
      E.rot = 0;
      mode = 'held';

      // ponto local onde o dedo segurou (fração da caixa): gira em volta do dedo
      const s = G.room.depthScale(P.z);
      const footY = H * G.config.pet.footOffset;
      const lx = W / 2 + (pt.x - P.x) / s;
      const ly = H + (pt.y - (P.z - P.h + footY)) / s;
      setRotOrigin(U.clamp(lx / W, 0.05, 0.95), U.clamp(ly / H, 0.05, 0.95));

      // estado da simulação do arraste (molas): começa de onde o corpo está
      drag = {
        // onde o dedo pegou, em px "sem profundidade" (divididos pela escala atual)
        offXL: (pt.x - P.x) / s,
        offYL: (pt.y - (P.z - P.h)) / s,
        finger: { x: pt.x, y: pt.y },
        G: { x: pt.x, y: pt.y }, vG: { x: 0, y: 0 },          // ponto agarrado (mola até o dedo)
        th: D.rot / RAD, om: 0,                              // balanço (rad, rad/s)
        e: (D.sy - 1), ev: -1.8 * K(),                       // estica-achata: "apertou" e volta balançando
        b: D.sk, bv: 0,                                      // envergada de papel (graus)
        compK: 0,
        samples: [{ x: pt.x, y: pt.y, t: U.now() }],
        reversals: [], dir: 0, shakeCooldown: 0, shakes: 0,
        outside: false, v: { x: 0, y: 0 }
      };
      G.bus.emit('physics:press');
    },

    /** O dedo se moveu o suficiente: levanta o pet */
    lift() {
      if (mode !== 'held' || !drag) return;
      const c = C();
      mode = 'drag';
      zOverride = 5000;
      // descola do papel: cresce um tiquinho em volta do dedo, com uma molinha
      utils.remove(LIFT);
      animate(LIFT, { s: c.liftScale ?? 1.05, ease: spring({ mass: 1, stiffness: 300, damping: 11 }) });
      G.bus.emit('physics:lift');
    },

    /** Ponto intermediário do dedo (eventos agrupados): só entra na conta da velocidade */
    sample(pt, t) {
      if (!drag) return;
      drag.samples.push({ x: pt.x, y: pt.y, t: t || U.now() });
      if (drag.samples.length > 32) drag.samples.splice(0, drag.samples.length - 32);
    },

    /** Dedo arrastando: guarda o ponto; a simulação leva o pet até ele no próximo quadro */
    dragTo(pt, t) {
      if (!drag) return;
      this.sample(pt, t);
      drag.finger = pt;
    },

    /** Soltou: herda a velocidade do dedo e o balanço do corpo → inércia + gravidade + mola */
    release() {
      if (!drag) return null;
      const c = C(), k = K();
      const now = U.now();
      const wasDragging = mode === 'drag';
      const v = pointerVelocity(now);
      const angVel = drag.om * RAD;          // o balanço continua no voo
      const shakes = drag.shakes;

      // o que o desenho estava compensando vira posição de verdade (sem pulo)
      if (wasDragging) { P.x += last.compX || 0; P.h -= last.compY || 0; }
      utils.remove(P); utils.remove(D);
      drag = null;
      zOverride = null;
      const rp = restPivot();
      setRotOrigin(rp.x, rp.y);
      skewSettle();
      // cola de volta: o "descolar" volta ao tamanho normal com uma molinha
      utils.remove(LIFT);
      if (LIFT.s !== 1) animate(LIFT, { s: 1, ease: spring(c.settleSpring) });

      if (!wasDragging) {
        // só pressionou: volta ao normal com geleca
        mode = 'idle';
        jelly(D.sx, D.sy);
        if (Math.abs(D.rot) > 0.5) rotSpringTo(0, angVel);
        render();
        return { thrown: false, speed: 0, shakes };
      }
      // o corpo volta ao normal balançando (o voo e o pouso somam o resto)
      if (Math.abs(D.sx - 1) > 0.004 || Math.abs(D.sy - 1) > 0.004) jelly(D.sx, D.sy);

      // velocidade de tela → mundo
      let vx = v.x * c.throwMultiplier * k;
      let vy = v.y * c.throwMultiplier * k;
      const sp = Math.hypot(vx, vy);
      if (sp > c.maxThrowSpeed) { vx *= c.maxThrowSpeed / sp; vy *= c.maxThrowSpeed / sp; }

      let vz, vh;
      if (vy < 0) {               // jogou pra cima → vira altura
        vh = -vy * c.tossUp;
        vz = vy * (1 - c.tossUp) * 0.8;
      } else if (P.h > c.liftHeight + 6) {  // jogou pra baixo estando no alto
        vh = -vy * 0.55;
        vz = vy * 0.45;
      } else {                    // empurrou pra frente rente ao chão
        vh = 0;
        vz = vy * 0.8;
      }
      const speed = Math.hypot(vx, vy);
      const res = this.launch(vx, vz, vh, { angVel, kind: 'throw' });
      return { thrown: speed > 500, speed, shakes, promise: res };
    },

    /* ---------------- movimentos ---------------- */

    /** Lança o pet com velocidade (px/s). vh > 0 = para cima. */
    launch(vx, vz, vh, opts = {}) {
      const c = C();
      const { id, promise } = beginMotion('air');
      mode = 'air';
      const pending = { v: true, x: false, z: false };
      const info = { kind: opts.kind || 'launch', bounces: 0, maxImpact: 0 };
      pending.info = info;

      inertia('x', vx, id, pending);
      inertia('z', vz, id, pending);

      // tempo de voo previsto (para decidir cambalhota)
      const g = c.gravity;
      const air = (Math.max(0, vh) + Math.sqrt(Math.max(0, vh) ** 2 + 2 * g * Math.max(0, P.h))) / g;
      if (Math.abs(vx) > c.flipSpeed && air > c.flipMinAirTime && !U.reducedMotion) {
        info.flip = true;
        const dir = Math.sign(vx);
        animate(D, { rot: D.rot + dir * 360, duration: air * 1000, ease: 'inOut(1.4)' });
        G.bus.emit('physics:flip');
      } else {
        rotSpringTo(U.clamp(vx * 0.006, -14, 14), opts.angVel || 0);
      }

      if (vh > 0 || P.h > 0.5) ballistic(vh, id, pending, info);
      else { pending.v = false; G.bus.emit('physics:slide', { speed: Math.hypot(vx, vz) }); trySettle(id, pending, info); }
      return promise;
    },

    /** Pulinho no lugar */
    hop(height = 26) {
      const g = C().gravity;
      return this.launch(0, 0, Math.sqrt(2 * g * height * K()), { kind: 'hop' });
    },

    /** Pula até um ponto: agacha um instante (preparação), sai no arco balístico
        com x/z constantes e pousa com geleca */
    jumpTo(x, z, opts = {}) {
      const c = C();
      const g = c.gravity;
      const { id, promise } = beginMotion('jump');
      mode = 'air';
      const dist = Math.hypot(x - P.x, z - P.z);
      const peak = opts.height ?? U.clamp(dist * 0.35, 22, 90);
      const v0 = Math.sqrt(2 * g * peak);
      const tUp = v0 / g, tDown = Math.sqrt(2 * (P.h + peak) / g);
      const T = tUp + tDown;
      this.faceTo(x);
      const pending = { v: true, x: true, z: false };
      const info = { kind: opts.kind || 'jump', bounces: 0 };
      pending.info = info;
      const f = SQ();
      const prep = U.reducedMotion ? 0 : 110;
      // agacha (preparação) e estica ao sair do chão
      animate(D, {
        sy: [{ to: 1 - 0.12 * f, duration: prep || 1, ease: 'out(2)' }, { to: 1 + 0.07 * f, duration: 150, ease: 'out(2)' }, { to: 1, ease: spring(c.poseSpring) }],
        sx: [{ to: 1 + 0.09 * f, duration: prep || 1, ease: 'out(2)' }, { to: 1 - 0.04 * f, duration: 150, ease: 'out(2)' }, { to: 1, ease: spring(c.poseSpring) }]
      });
      const go = () => {
        if (id !== chainId) return;
        anim(P, {
          x, z, duration: T * 1000, ease: 'linear',
          onComplete: () => { if (id === chainId) { pending.x = false; trySettle(id, pending, info); } }
        });
        rotSpringTo(Math.sign(x - P.x) * 8 * photoK(), 0);
        ballistic(v0, id, pending, info);
      };
      if (prep) setTimeout(go, prep); else go();
      return promise;
    },

    /** Anda (ou corre) até um ponto com passinhos saltitantes */
    walkTo(x, z, opts = {}) {
      const c = C();
      const p = G.room.clampFloor(x, z);
      const dist = Math.hypot(p.x - P.x, p.z - P.z);
      if (dist < 4) return Promise.resolve(true);
      const { id, promise } = beginMotion('walk');
      mode = 'walk';
      const speed = (opts.run ? c.runSpeed : c.walkSpeed) * (opts.speedMul || 1);
      const T = dist / speed;
      const steps = Math.max(1, Math.round(T / (opts.run ? c.stepTime * 0.8 : c.stepTime)));
      const stepDur = (T / steps) * 1000;
      const photo = isPhoto();
      // foto "anda" como figurinha: pulinhos baixos e macios + um rebolado de lado a lado
      const hop = (opts.run ? c.runHop : c.walkHop) * (opts.hopMul ?? 1) * (photo ? 0.6 : 1);
      const rock = (opts.run ? 3.2 : 2.4) * (photo ? 1 : 1.6) * K();
      const f = SQ();
      const dir = Math.sign(p.x - P.x) || heading;
      if (Math.abs(p.x - P.x) > 6) this.faceTo(p.x);

      animate(D, { rot: dir * (opts.run ? 7 : 3) * photoK(), duration: 320, ease: 'inOut(2)' });
      let stepN = 0;
      const rockStep = () => {
        stepN++;
        animate(E, { rot: (stepN % 2 ? 1 : -1) * rock, duration: stepDur, ease: 'inOut(2)' });
      };
      rockStep();
      anim(P, {
        x: p.x, z: p.z, duration: T * 1000, ease: opts.run ? 'inOut(1.3)' : 'inOut(1.6)',
        onComplete: () => {
          if (id !== chainId) return;
          mode = 'idle';
          rotSpringTo(0, 0);
          animate(E, { rot: 0, ease: spring(c.poseSpring) });
          if (P.h > 0.3) animate(P, { h: 0, duration: 110, ease: 'in(2)' });
          G.bus.emit('physics:arrive', { x: P.x, z: P.z });
          endMotion(id, true);
        }
      });
      anim(P, {
        // subida e descida macias (curva suave, sem "quicar" duro no chão)
        h: [{ to: hop, duration: stepDur / 2, ease: 'out(1.6)' }, { to: 0, duration: stepDur / 2, ease: 'in(1.6)' }],
        loop: steps - 1,
        onLoop: () => {
          if (id !== chainId) return;
          rockStep();
          if (f > 0.5) animate(D, { sx: [1 + 0.05 * f, 1], sy: [1 - 0.05 * f, 1], duration: stepDur * 0.9, ease: 'out(2)' });
          G.bus.emit('physics:step', { run: !!opts.run });
        }
      });
      return promise;
    },

    /** Vira para o lado de x (espelha a imagem passando por 0 = "giro" 2D) */
    faceTo(x) {
      const dir = x >= P.x ? 1 : -1;
      this.face(dir);
    },

    /** Vira para um lado. O lado é sempre guardado (a lógica do jogo usa);
        a imagem só é espelhada quando pode — foto nunca espelha. */
    face(dir, instant) {
      const prev = heading;
      heading = dir < 0 ? -1 : 1;
      if (!canMirror()) {
        // foto: não espelha (nem espreme); ao mudar de lado dá uma inclinadinha
        // suave para o lado que agora "olha", como quem vira a cabeça
        this.straighten();
        if (!instant && prev !== heading && mode === 'idle') {
          animate(D, { rot: [{ to: heading * 2.6, duration: 160, ease: 'out(2)' }, { to: 0, ease: spring(C().poseSpring) }] });
        }
        return;
      }
      const target = heading * G.config.pet.facing;
      if (instant) { utils.remove(F); F.face = target; render(); return; }
      if (Math.sign(F.face) === target && Math.abs(F.face) > 0.99) return;
      animate(F, { face: target, duration: 230, ease: 'inOut(2)' });
    },

    /** Desfaz qualquer espelhamento (ex.: trocou para uma foto) */
    straighten() {
      if (F.face > 0.85) return;   // já está reto (ou só na "piscada")
      utils.remove(F);
      animate(F, { face: 1, duration: 160, ease: 'out(2)' });
    },

    /** Balancinho rotacional (cutucão, susto): sai suave e volta numa mola macia */
    wobble(amount = 10, base) {
      const b = base || { mass: 1, stiffness: 190, damping: 9 };
      const a = amount * (isPhoto() ? 0.6 : 1);
      animate(D, { rot: [{ to: D.rot + a, duration: 110, ease: 'out(2)' }, { to: 0, ease: spring(b) }] });
    },

    /** Inclina o corpo e fica assim (sentar torto). lean(0) volta com mola. */
    lean(angle = 0) {
      if (!angle) { rotSpringTo(0, 0); return; }
      animate(D, { rot: angle * K() * (isPhoto() ? 0.55 : 1), ease: spring(C().poseSpring) });
    },

    /** Apertãozinho com geleca (cutucão, pegar comida…) */
    squash(amount = 0.15) {
      const a = amount * K() * SQ();
      animate(D, {
        sx: [{ to: 1 + a, duration: 90, ease: 'out(2)' }, { to: 1, ease: spring(C().settleSpring) }],
        sy: [{ to: 1 - a, duration: 90, ease: 'out(2)' }, { to: 1, ease: spring(C().settleSpring) }]
      });
    },

    /** Espreguiçar: estica devagar (comprido e baixinho), segura e relaxa.
        Na foto é bem mais sutil — foto esticada demais parece distorcida */
    stretchPose() {
      return new Promise((resolve) => {
        const photo = isPhoto();
        const sx = photo ? 1.03 : 1.24, sy = photo ? 0.972 : 0.8;
        const relax = spring({ mass: 1, stiffness: 140, damping: 11 });
        animate(D, {
          sx: [{ to: sx, duration: 620, ease: 'inOut(2)' }, { to: sx, duration: 420 }, { to: 1, ease: relax }],
          sy: [{ to: sy, duration: 620, ease: 'inOut(2)' }, { to: sy, duration: 420 }, { to: 1, ease: relax }],
          rot: [{ to: heading * 4 * photoK(), duration: 620, ease: 'inOut(2)' }, { to: heading * 4 * photoK(), duration: 420 }, { to: 0, ease: relax }],
          onComplete: () => resolve(true)
        });
      });
    },

    /** Gira atrás do rabo (na camada E, para não brigar com as molas do corpo) */
    spin(turns = 1) {
      return new Promise((resolve) => {
        utils.remove(E, null, 'rot');
        const start = E.rot;
        animate(E, {
          rot: start + 360 * turns,
          duration: 680 * Math.abs(turns),
          ease: 'inOut(2)',
          onComplete: () => { E.rot = 0; this.wobble(Math.sign(turns) * -7); resolve(true); }
        });
      });
    },

    /** Sacudida de cachorro molhado (depois do banho): oscilação que vai morrendo */
    shakeOff(onShake) {
      return new Promise((resolve) => {
        const k = (isPhoto() ? 1 : 1.6) * K();
        const seq = [-9, 9, -8, 7.5, -6, 5, -3.5, 2, -1, 0];
        utils.remove(E, null, 'rot');
        animate(E, {
          rot: seq.map((r) => ({ to: r * k, duration: 78, ease: 'inOut(2)' })),
          onUpdate: onShake,
          onComplete: () => { E.rot = 0; resolve(true); }
        });
      });
    },

    /** Pose corporal: 'stand' | 'sit' | 'lie' | 'loaf' | 'crouch' | 'chubby' | 'tall'.
        Foto: quase não deforma (só "afunda"/"cresce" de leve) — a pose está na própria foto */
    setPose(name) {
      const CUT = { stand: [1, 1], sit: [1.03, 0.94], lie: [1.12, 0.84], loaf: [1.08, 0.88], crouch: [1.1, 0.86], chubby: [1.16, 0.97], tall: [0.95, 1.06] };
      const PHOTO = { stand: [1, 1], sit: [1, 0.98], lie: [1.01, 0.965], loaf: [1.005, 0.972], crouch: [1.01, 0.968], chubby: [1.02, 1.005], tall: [0.995, 1.022] };
      const T = isPhoto() ? PHOTO : CUT;
      const [x, y] = T[name] || T.stand;
      animate(POSE, { x, y, ease: spring(C().poseSpring) });
    },

    /** Ronronar: vibraçãozinha bem leve (camada E) */
    purr(on) {
      utils.remove(E, null, 'sy');
      if (on) animate(E, { sy: [1, isPhoto() ? 0.994 : 0.985], duration: 95, loop: true, alternate: true, ease: 'inOut(2)' });
      else animate(E, { sy: 1, duration: 160, ease: 'out(2)' });
    },

    /** Batida da música: dança */
    beat(beat) {
      const dir = beat % 2 ? 1 : -1;
      const f = SQ();
      animate(E, {
        sy: [{ to: 1 - 0.1 * f, duration: 110, ease: 'out(2)' }, { to: 1, ease: spring({ mass: 1, stiffness: 240, damping: 12 }) }],
        rot: [{ to: dir * 7 * photoK(), duration: 160, ease: 'out(2)' }, { to: 0, duration: 300, ease: 'inOut(2)' }]
      });
    },

    /** Prende o pet num lugar (banho) ou solta */
    anchor(on, x, z) {
      stopMotions();
      if (on) {
        mode = 'anchored';
        if (x !== undefined) { P.x = x; P.z = z; P.h = 0; }
      } else {
        mode = 'idle';
      }
      render();
    },

    /** Leve tremedeira (frio no banho, susto) */
    shiver(ms = 600) {
      const n = Math.round(ms / 60);
      const a = isPhoto() ? 0.6 : 1;
      const seq = [];
      for (let i = 0; i < n; i++) seq.push({ to: (i % 2 ? 1 : -1) * U.rand(1.4, 2.6) * a * (1 - (i / n) * 0.6), duration: 60, ease: 'inOut(2)' });
      seq.push({ to: 0, duration: 100, ease: 'out(2)' });
      animate(E, { rot: seq });
    },

    render
  };

  G.physics = physics;
})(window.Game = window.Game || {});
