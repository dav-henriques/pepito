/* ==========================================================================
   ALIMENTAÇÃO
   Toque no pote → escolha a comida → ela cai no pote → o pet percebe,
   vai até lá e come (estado 'eating' → imagem eating.png).
   Comidas novas: adicione em petConfig.foods + assets.js (food).
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  const bowl = { food: null, amount: 0 };
  let bowlEl, foodEl, menu = null, outsideHandler = null;
  let eatToken = 0;
  let treatLog = [];

  function foods() { return G.config.foods; }

  function renderBowl(animated) {
    if (!bowl.food || bowl.amount <= 0.02) {
      bowl.food = null; bowl.amount = 0;
      gsap.to(foodEl, { scaleY: 0, duration: animated ? 0.3 : 0, ease: 'power2.in' });
      return;
    }
    const f = foods()[bowl.food];
    foodEl.style.backgroundImage = `url("${G.asset('food.' + f.asset)}")`;
    gsap.to(foodEl, { scaleY: 0.35 + bowl.amount * 0.65, duration: animated ? 0.45 : 0, ease: 'back.out(2.2)' });
  }

  /** Onde o pet fica para comer (ao lado do pote, virado para ele) */
  function eatSpot() {
    const z = G.room.zones.bowl;
    const side = z.cx < G.room.W / 2 ? 1 : -1;
    return { x: z.cx + side * (z.w * 0.5 + G.room.petW * 0.2), z: z.y1 - 3, faceX: z.cx };
  }

  /* ---------------- menu ---------------- */
  function openMenu() {
    if (menu) { closeMenu(); return; }
    const z = G.room.zones.bowl;
    const ui = document.getElementById('ui');
    menu = U.h('div', { class: 'food-menu' });
    ui.appendChild(menu);
    const ax = z.cx, ay = z.y0 + 4;
    gsap.set(menu, { x: ax, y: ay });

    const ids = Object.keys(foods());
    const n = ids.length;
    const R = 92;
    // leque acima do pote, levemente inclinado para o centro do quarto
    const lean = U.clamp((G.room.W / 2 - ax) / G.room.W, -0.5, 0.5) * 0.9;
    const spread = Math.min(2.1, 0.78 * (n - 1));
    const pos = ids.map((id, i) => {
      const a = -Math.PI / 2 + lean + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread);
      return { x: Math.cos(a) * R, y: Math.sin(a) * R - 10 };
    });
    // empurra o leque inteiro para dentro da tela
    const minX = Math.min(...pos.map((p) => ax + p.x)), maxX = Math.max(...pos.map((p) => ax + p.x));
    const shift = minX < 40 ? 40 - minX : maxX > G.room.W - 40 ? G.room.W - 40 - maxX : 0;
    ids.forEach((id, i) => {
      const f = foods()[id];
      const bx = pos[i].x + shift, by = pos[i].y;
      const btn = U.h('button', { class: 'food-btn', 'aria-label': f.label }, [
        U.h('img', { src: G.asset('food.' + f.asset), alt: '', draggable: 'false' }),
        U.h('span', { text: f.label })
      ]);
      btn.addEventListener('click', (e) => { e.stopPropagation(); serve(id, btn); });
      menu.appendChild(btn);
      gsap.fromTo(btn, { x: 0, y: 0, scale: 0, rotation: -40 },
        { x: bx, y: by, scale: 1, rotation: 0, duration: 0.42, delay: i * 0.05, ease: 'back.out(1.9)' });
    });
    G.audio.play('pop', { v: 0.7 });
    gsap.fromTo(bowlEl, { scaleY: 0.9, scaleX: 1.06 }, { scaleY: 1, scaleX: 1, duration: 0.5, ease: 'elastic.out(1, .4)', transformOrigin: '50% 100%' });

    outsideHandler = (e) => {
      if (menu && !menu.contains(e.target) && !e.target.closest('.bowl')) closeMenu();
    };
    setTimeout(() => document.addEventListener('pointerdown', outsideHandler, true), 0);
    G.bus.emit('food:menu', true);
  }

  function closeMenu() {
    if (!menu) return;
    const m = menu; menu = null;
    document.removeEventListener('pointerdown', outsideHandler, true);
    gsap.to(m.children, { x: 0, y: 0, scale: 0, duration: 0.22, stagger: 0.03, ease: 'back.in(1.6)', onComplete: () => m.remove() });
    G.bus.emit('food:menu', false);
  }

  /* ---------------- servir ---------------- */
  function serve(id, btn) {
    const f = foods()[id];
    if (!f) return;
    const z = G.room.zones.bowl;
    const from = btn.getBoundingClientRect();
    const start = G.room.toLocal(from.left + from.width / 2, from.top + from.height / 2);
    closeMenu();

    // a comida voa em arco até o pote
    const fly = U.h('img', { src: G.asset('food.' + f.asset), alt: '', class: 'p' });
    fly.style.width = '44px'; fly.style.marginLeft = '-22px'; fly.style.marginTop = '-16px';
    document.getElementById('fx').appendChild(fly);
    const end = { x: z.cx, y: z.y0 + z.h * 0.3 };
    const peak = Math.min(start.y, end.y) - 70;
    gsap.set(fly, { x: start.x, y: start.y, scale: 1, rotation: 0 });
    const tl = gsap.timeline({ onComplete: () => fly.remove() });
    tl.to(fly, { x: end.x, duration: 0.55, ease: 'power1.inOut' }, 0)
      .to(fly, { y: peak, duration: 0.25, ease: 'power2.out' }, 0)
      .to(fly, { y: end.y, duration: 0.3, ease: 'power2.in' }, 0.25)
      .to(fly, { rotation: 360, scale: 0.7, duration: 0.55, ease: 'none' }, 0)
      .add(() => {
        bowl.food = id;
        bowl.amount = 1;
        renderBowl(true);
        G.audio.play('pour');
        G.fx.burst('crumb', end.x, end.y, 7, { fall: 18 });
        gsap.fromTo(bowlEl, { scaleY: 0.86, scaleX: 1.1 }, { scaleY: 1, scaleX: 1, duration: 0.7, ease: 'elastic.out(1, .35)', transformOrigin: '50% 100%' });
        G.bus.emit('food:served', { food: id });
        G.save.soon();
        if (id === 'treat') {
          const now = Date.now();
          treatLog = treatLog.filter((t) => now - t < 120000);
          treatLog.push(now);
          if (treatLog.length >= 3) { treatLog = []; G.bus.emit('food:treatCombo'); }
        }
      }, 0.55);
  }

  /* ---------------- comer ---------------- */
  let heading = false;
  async function goEat() {
    if (heading) return false;
    heading = true;
    try { return await goEatInner(); } finally { heading = false; }
  }

  async function goEatInner() {
    if (!bowl.food) return false;
    const ps = G.petState;
    if (!ps.can('eat') || ps.activity === 'eating') return false;
    const f = foods()[bowl.food];
    const spot = eatSpot();

    // cheio: recusa (menos petisco, petisco sempre cabe)
    if (!f.alwaysWanted && G.needs.get('hunger') > G.config.fullThreshold) {
      G.physics.faceTo(spot.faceX);
      G.bubble.show('dots');
      await U.wait(700);
      G.physics.face(-Math.sign(spot.faceX - G.physics.P.x) || 1);
      G.bus.emit('food:refused');
      return false;
    }

    const token = ++eatToken;
    const arrived = await G.physics.walkTo(spot.x, spot.z, { run: G.needs.get('hunger') < 40 });
    if (!arrived || token !== eatToken || !bowl.food) return false;
    G.physics.faceTo(spot.faceX);
    return eat(token);
  }

  function eat(token) {
    return new Promise((resolve) => {
      const id = bowl.food;
      const f = foods()[id];
      const startAmount = bowl.amount;
      const total = f.eatTime * startAmount;
      const ps = G.petState;
      ps.setActivity('eating');
      G.physics.setPose('loaf');
      G.bus.emit('food:eatStart', { food: id });

      let elapsed = 0;
      const step = 0.38;
      const tick = () => {
        if (token !== eatToken || ps.activity !== 'eating') return finish(false);
        elapsed += step;
        const left = Math.max(0, 1 - elapsed / total) * startAmount;
        bowl.amount = left;
        renderBowl(true);
        G.audio.play('munch');
        const z = G.room.zones.bowl;
        G.fx.burst('crumb', z.cx + U.rand(-10, 10), z.y0 + 6, 2, { spread: 0.6, fall: 14 });
        if (elapsed >= total) return finish(true);
        gsap.delayedCall(step, tick);
      };
      gsap.delayedCall(step, tick);

      function finish(completed) {
        const eaten = startAmount - bowl.amount;
        const frac = U.clamp(eaten / Math.max(0.01, startAmount), 0, 1) * startAmount;
        G.needs.add({ hunger: f.hunger * frac, happiness: f.happiness * frac, energy: f.energy * frac }, 'eat');
        if (completed) { bowl.amount = 0; renderBowl(true); }
        G.physics.setPose('stand');
        if (ps.activity === 'eating') ps.setActivity(null);
        G.progress.addXp(Math.round(f.xp * frac), 'eat');
        G.progress.count('meals');
        if (completed) {
          ps.emote(id === 'special' ? 'excited' : 'happy', 2600);
          const p = G.physics.anchorPoint('top');
          if (id === 'special') { G.fx.burst('sparkle', p.x, p.y + 20, 7); G.audio.play('sparkle'); }
          G.physics.hop(18);
          G.audio.play('meow', { short: true, pitch: 1.1 });
          G.bus.emit('food:eaten', { food: id });
          if (f.sleepyChance && Math.random() < f.sleepyChance) {
            setTimeout(() => G.behavior && G.behavior.sleepNow({ nap: true }), 3200);
          }
        }
        G.save.soon();
        resolve(completed);
      }
    });
  }

  G.food = {
    init() {
      bowlEl = document.querySelector('.bowl');
      foodEl = bowlEl.querySelector('.bowl-food');
      G.save.register('bowl', {
        get: () => ({ ...bowl }),
        set: (d) => { if (d && foods()[d.food]) { bowl.food = d.food; bowl.amount = U.clamp(+d.amount || 0, 0, 1); } }
      });
      G.interaction.register('bowl', G.interaction.tap(() => openMenu()));
      // ser pego no meio da refeição interrompe
      G.bus.on('pet:press', () => { if (G.petState.activity === 'eating') { eatToken++; } });
      renderBowl(false);
    },
    get bowl() { return { ...bowl }; },
    hasFood() { return !!bowl.food && bowl.amount > 0.02; },
    openMenu, closeMenu, goEat, eatSpot
  };
})(window.Game = window.Game || {});
