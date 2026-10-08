/* ==========================================================================
   BANHO
   Arraste o pet até a banheira → a água enche → esfregue com o dedo
   (espuma gruda nele) → enxágue com o dedo (a espuma vai embora) →
   ele pula fora, se sacode e fica limpinho (clean.png).
   dirty → bathing → clean → happy
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  let tubEl, waterEl, foamLayer, tool = null;
  let st = null;            // estado do banho atual
  let hoverTick = null;
  let tubHover = false;

  function cfg() { return G.config.bath; }

  /* ---------------- água ---------------- */
  function fillWater() {
    gsap.to(waterEl, { scaleY: 1, opacity: 1, duration: 0.7, ease: 'back.out(1.6)' });
  }
  function drainWater() {
    gsap.to(waterEl, { scaleY: 0, opacity: 0, duration: 0.8, ease: 'power2.in' });
  }

  /* ---------------- espuma no pet ---------------- */
  function petLocal(pt) {
    const P = G.physics.P;
    const { w, h } = G.physics.size;
    const s = G.room.depthScale(P.z);
    const footY = h * G.config.pet.footOffset;
    let lx = (pt.x - (P.x - (w * s) / 2)) / (w * s);
    const ly = (pt.y - (P.z - P.h + footY - h * s)) / (h * s);
    if (G.physics.F.face < 0) lx = 1 - lx;
    return { lx, ly };
  }

  function addFoam(pt) {
    if (st.foam.length >= cfg().maxFoam) return;
    const { lx, ly } = petLocal(pt);
    if (lx < 0.12 || lx > 0.88 || ly < 0.1 || ly > 0.86) return;
    const size = U.rand(14, 30);
    const el = U.h('i');
    el.style.width = el.style.height = size + 'px';
    el.style.left = (lx * 100).toFixed(1) + '%';
    el.style.top = (ly * 100).toFixed(1) + '%';
    foamLayer.appendChild(el);
    gsap.fromTo(el, { xPercent: -50, yPercent: -50, scale: 0 }, { scale: 1, duration: 0.35, ease: 'back.out(3)' });
    st.foam.push({ el, lx, ly });
  }

  function removeFoamNear(pt) {
    if (!st.foam.length) return;
    const { lx, ly } = petLocal(pt);
    let best = -1, bd = 0.22;
    st.foam.forEach((f, i) => {
      const d = Math.hypot(f.lx - lx, f.ly - ly);
      if (d < bd) { bd = d; best = i; }
    });
    if (best < 0 && Math.random() < 0.25) best = U.randInt(0, st.foam.length - 1);
    if (best < 0) return;
    const [f] = st.foam.splice(best, 1);
    gsap.to(f.el, { scale: 0, opacity: 0, y: 14, duration: 0.3, ease: 'power2.in', onComplete: () => f.el.remove() });
  }

  function clearFoam() {
    for (const f of st?.foam || []) gsap.to(f.el, { scale: 0, opacity: 0, duration: 0.25, onComplete: () => f.el.remove() });
    if (st) st.foam = [];
  }

  /* ---------------- ferramenta (sabão → chuveirinho) ---------------- */
  function showTool() {
    const z = G.room.zones.tub;
    tool = U.h('div', { class: 'bath-tool' });
    const ring = `<svg class="prog" viewBox="0 0 48 48"><circle class="track" cx="24" cy="24" r="21"/><circle class="bar" cx="24" cy="24" r="21"/></svg>`;
    const t = U.h('div', { class: 'tool', html: ring });
    t.appendChild(G.icon('soap', 'ico'));
    const tip = U.h('span', { class: 'tip', text: 'esfregue' });
    const close = U.h('button', { class: 'close', 'aria-label': 'Terminar banho' });
    close.appendChild(G.icon('close'));
    close.addEventListener('click', (e) => { e.stopPropagation(); finish(false); });
    tool.append(t, tip, close);
    document.getElementById('ui').appendChild(tool);
    const w = 170;
    const x = U.clamp(z.cx - w / 2, 10, G.room.W - w - 10);
    const y = Math.max(70, z.seatZ - G.room.petH - 66);
    gsap.set(tool, { x, y });
    gsap.fromTo(tool, { scale: 0.4, opacity: 0, y: y + 20 }, { scale: 1, opacity: 1, y, duration: 0.45, ease: 'back.out(2)' });
    st.toolEls = { bar: tool.querySelector('.bar'), icon: t.querySelector('.ico use'), tip, wrap: t };
  }

  function updateTool(p) {
    if (!tool) return;
    gsap.to(st.toolEls.bar, { strokeDashoffset: 131.9 * (1 - U.clamp(p, 0, 1)), duration: 0.2, overwrite: true });
  }

  function switchToRinse() {
    const els = st.toolEls;
    gsap.timeline()
      .to(els.wrap, { scale: 0, rotation: -90, duration: 0.18, ease: 'back.in(2)' })
      .add(() => {
        els.icon.setAttribute('href', '#i-shower');
        els.tip.textContent = 'enxágue';
        els.bar.style.stroke = '#4fa6cc';
        gsap.set(els.bar, { strokeDashoffset: 131.9 });
      })
      .to(els.wrap, { scale: 1, rotation: 0, duration: 0.4, ease: 'back.out(2.5)' });
    G.audio.play('water');
  }

  function hideTool() {
    if (!tool) return;
    const t = tool; tool = null;
    gsap.to(t, { scale: 0.5, opacity: 0, duration: 0.25, ease: 'back.in(2)', onComplete: () => t.remove() });
  }

  /* ---------------- gesto de esfregar / enxaguar ---------------- */
  const override = {
    down(pt, e, hitEl, kind) {
      if (!st || (st.phase !== 'soap' && st.phase !== 'rinse')) return null;
      const petRect = document.getElementById('pet').getBoundingClientRect();
      const r = G.room.toLocal(petRect.left, petRect.top);
      const pad = 26;
      const inside = pt.x > r.x - pad && pt.x < r.x + petRect.width + pad && pt.y > r.y - pad && pt.y < r.y + petRect.height + pad;
      if (!inside && kind !== 'tub' && kind !== 'pet') return null;
      let prev = pt;
      let lastSound = 0, lastFoam = 0, acc = 0;
      return {
        move(p) {
          if (!st) return;
          const d = Math.min(60, U.dist(p.x, p.y, prev.x, prev.y));
          prev = p;
          if (d < 0.5) return;
          const now = U.now();
          acc += d;
          if (st.phase === 'soap') {
            st.soap += d;
            if (acc - lastFoam > 26) { lastFoam = acc; addFoam(p); }
            if (Math.random() < 0.07) G.fx.spawn('bubble', p.x, p.y - 10, { rise: U.rand(70, 150) });
            if (now - lastSound > 110) { lastSound = now; G.audio.play('scrub'); }
            if (Math.random() < 0.015) { G.physics.wobble(U.rand(-6, 6)); }
            updateTool(st.soap / cfg().soapNeeded);
            if (st.soap >= cfg().soapNeeded) {
              st.phase = 'rinse';
              switchToRinse();
              G.petState.emote('happy', 1500);
              G.bubble.show('sparkle', { duration: 1200 });
            }
          } else if (st.phase === 'rinse') {
            st.rinse += d;
            if (Math.random() < 0.5) G.fx.spawn('drop', p.x + U.rand(-8, 8), p.y, { vx: U.rand(-30, 30), vy: U.rand(40, 120) });
            if (acc - lastFoam > 22) { lastFoam = acc; removeFoamNear(p); }
            if (now - lastSound > 260) { lastSound = now; G.audio.play('water'); }
            updateTool(st.rinse / cfg().rinseNeeded);
            if (st.rinse >= cfg().rinseNeeded) finish(true);
          }
        },
        up() {},
        cancel() {}
      };
    }
  };

  /* ---------------- fluxo ---------------- */
  async function start(opts = {}) {
    if (st) return;
    const ps = G.petState;
    if (!ps.can('bathe')) return;
    const z = G.room.zones.tub;
    st = { phase: 'enter', soap: 0, rinse: 0, foam: [], startedDirty: G.needs.get('cleanliness') < G.config.needs.thresholds.dirty };
    if (ps.activity === 'sleeping') ps.setActivity(null);
    ps.setActivity('bathing');
    G.food.closeMenu?.();
    G.bus.emit('bath:start', opts);

    const ok = await G.physics.jumpTo(z.cx, z.seatZ, { height: 26, kind: 'bath' });
    if (!st) return;
    if (!ok) { cancelSilently(); return; }
    G.physics.anchor(true, z.cx, z.seatZ);
    G.physics.setPose('sit');
    fillWater();
    G.audio.play('splash', { intensity: opts.impact > 900 ? 1.3 : 0.8 });
    const n = opts.impact > 900 ? 22 : 9;
    for (let i = 0; i < n; i++) G.fx.spawn('drop', z.cx + U.rand(-50, 50), z.rimY, { vx: U.rand(-200, 200), vy: U.rand(-420, -160) });
    if (opts.impact > 900) G.bus.emit('bath:cannonball');
    G.physics.shiver(700);

    st.phase = 'soap';
    showTool();
    G.interaction.setOverride(override);
    G.hud?.hintOnce('bath', 'esfregue o ' + G.config.pet.name + ' com o dedo');
  }

  function cancelSilently() {
    G.interaction.clearOverride(override);
    hideTool();
    drainWater();
    clearFoam();
    if (G.petState.activity === 'bathing') G.petState.setActivity(null);
    G.physics.setPose('stand');
    st = null;
  }

  async function finish(completed) {
    if (!st || st.phase === 'exit') return;
    const progress = completed ? 1 : U.clamp((st.soap / cfg().soapNeeded + st.rinse / cfg().rinseNeeded) / 2, 0, 1);
    const wasDirty = st.startedDirty;
    st.phase = 'exit';
    G.interaction.clearOverride(override);
    hideTool();
    drainWater();
    clearFoam();
    G.physics.anchor(false);
    G.physics.setPose('stand');

    const z = G.room.zones.tub;
    const out = G.room.clampFloor(z.x0 - G.room.petW * 0.15, Math.min(z.seatZ, G.room.geo.zMax - 10));
    await G.physics.jumpTo(out.x, out.z, { height: 34, kind: 'bathExit' });

    G.needs.add({ cleanliness: cfg().cleanlinessGain * progress, happiness: cfg().happinessGain * progress, energy: -3 }, 'bath');
    G.petState.setActivity(null);
    st = null;

    if (progress > 0.5) {
      // sacode a água
      const P = G.physics.P;
      G.audio.play('splash', { intensity: 0.5 });
      await G.physics.shakeOff(() => {
        if (Math.random() < 0.35) {
          const p = G.physics.anchorPoint('eyes');
          G.fx.spawn('drop', p.x + U.rand(-30, 30), p.y + U.rand(0, 40), { vx: U.rand(-260, 260), vy: U.rand(-260, -60) });
        }
      });
      G.petState.emote('clean', 4800);
      const p = G.physics.anchorPoint('top');
      G.fx.burst('sparkle', p.x, p.y + 30, 9, { spread: 1.3 });
      G.audio.play('sparkle');
      G.physics.hop(20);
      G.progress.addXp(Math.round(cfg().xp * (wasDirty ? 1 : 0.5)), 'bath');
      G.progress.count('baths');
      G.bus.emit('bath:done', { wasDirty });
      // gotinhas por um tempo
      let drips = 8;
      const drip = () => {
        if (drips-- <= 0) return;
        const pp = G.physics.anchorPoint('neck');
        G.fx.spawn('drop', P.x + U.rand(-25, 25), pp.y + 10, { vx: U.rand(-10, 10), vy: 20 });
        gsap.delayedCall(U.rand(0.4, 0.9), drip);
      };
      drip();
    } else {
      G.petState.emote('sadEmote', 1800);
      G.bus.emit('bath:quit');
    }
    G.save.soon();
  }

  /* destaque da banheira enquanto o pet é carregado por cima dela */
  function hoverCheck() {
    const P = G.physics.P;
    const over = G.room.inFootprint('tub', P.x, P.z, 10);
    if (over !== tubHover) {
      tubHover = over;
      gsap.to(tubEl, { scaleY: over ? 1.04 : 1, scaleX: over ? 1.03 : 1, duration: 0.3, ease: over ? 'back.out(3)' : 'power2.out' });
      if (over) G.audio.play('water');
    }
  }

  G.bath = {
    init() {
      tubEl = document.querySelector('.tub-front');
      waterEl = tubEl.querySelector('.tub-water');
      foamLayer = G.anim.foamLayer;
      gsap.set(waterEl, { scaleY: 0, opacity: 0 });

      G.interaction.register('tub', G.interaction.tap(() => {
        // dica sutil: ondinha na água
        gsap.fromTo(tubEl, { scaleX: 1.04, scaleY: 0.97 }, { scaleX: 1, scaleY: 1, duration: 0.6, ease: 'elastic.out(1, .4)' });
        G.audio.play('water');
        const z = G.room.zones.tub;
        G.fx.burst('bubble', z.cx, z.rimY, 3, { jitter: 40, rise: 80 });
      }));

      G.bus.on('pet:lift', () => {
        if (hoverTick) gsap.ticker.remove(hoverTick);
        hoverTick = hoverCheck;
        gsap.ticker.add(hoverTick);
      });
      G.bus.on('pet:release', () => {
        if (hoverTick) { gsap.ticker.remove(hoverTick); hoverTick = null; }
        if (tubHover) { tubHover = false; gsap.to(tubEl, { scaleX: 1, scaleY: 1, duration: 0.3 }); }
      });
      // pousou dentro da banheira → banho!
      G.bus.on('physics:settled', (e) => {
        if (st || e.kind === 'bath' || e.kind === 'bathExit' || e.kind === 'jump') return;
        if (G.room.inFootprint('tub', e.x, e.z, 6)) start({ impact: e.impact });
      });
      G.bus.on('room:resize', () => {
        if (st && st.phase !== 'exit') {
          const z = G.room.zones.tub;
          G.physics.anchor(true, z.cx, z.seatZ);
        }
      });
    },
    start,
    finish,
    get active() { return !!st; },
    get phase() { return st?.phase || null; }
  };
})(window.Game = window.Game || {});
