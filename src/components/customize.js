/* ==========================================================================
   PERSONALIZAÇÃO (folha inferior, GSAP)
   Nome, acessório, parede, tapete. Alguns itens desbloqueiam com a amizade.
   Opções novas: petConfig.customization (+ assets.js).
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  const custom = { name: null, accessory: 'none', wall: 'sage', rug: 'sun' };
  let sheet = null, backdrop = null;
  let resetArmed = 0;

  function C() { return G.config.customization; }

  /* ---------------- aplicar ---------------- */
  function applyWall(id) {
    const w = C().walls.find((x) => x.id === id) || C().walls[0];
    const s = document.getElementById('room').style;
    s.setProperty('--wall-base', w.base);
    s.setProperty('--wall-stripe', w.stripe);
  }
  function applyRug(id) {
    const r = C().rugs.find((x) => x.id === id) || C().rugs[0];
    document.getElementById('rug-img').src = G.asset('environment.' + r.asset);
  }
  function applyName(name) {
    if (name) G.config.pet.name = name;
    G.hud.renderName();
  }
  function applyAll() {
    applyWall(custom.wall);
    applyRug(custom.rug);
    applyName(custom.name);
    G.anim.setAccessory(custom.accessory);
  }

  /* ---------------- UI ---------------- */
  function optionButton(item, kind, selected, content) {
    const unlocked = G.progress.isUnlocked(item);
    const b = U.h('button', { class: 'opt' + (selected ? ' selected' : '') + (unlocked ? '' : ' locked'), 'aria-label': item.label });
    if (content) b.appendChild(content);
    b.appendChild(U.h('span', { text: unlocked ? item.label : 'nv ' + item.level }));
    if (!unlocked) b.appendChild(G.icon('lock', 'lk'));
    b.addEventListener('click', () => {
      if (!unlocked) {
        gsap.fromTo(b, { x: -6 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, .3)' });
        G.audio.play('tap');
        return;
      }
      custom[kind] = item.id;
      if (kind === 'wall') applyWall(item.id);
      if (kind === 'rug') applyRug(item.id);
      if (kind === 'accessory') {
        G.anim.setAccessory(item.id);
        if (item.id !== 'none') { G.petState.emote('happy', 1600); G.physics.hop(14); }
      }
      b.parentElement.querySelectorAll('.opt').forEach((o) => o.classList.remove('selected'));
      b.classList.add('selected');
      gsap.fromTo(b, { scale: 0.9 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
      G.audio.play('pop', { v: 0.6 });
      G.save.soon();
    });
    return b;
  }

  function build() {
    const p = G.progress;
    const lv = p.level();
    const el = U.h('div', { class: 'sheet', role: 'dialog', 'aria-label': 'Personalizar' });
    const head = U.h('div', { class: 'sheet-head' }, [U.h('div', { class: 'grab' })]);
    el.appendChild(head);

    el.appendChild(U.h('h2', { text: G.config.pet.name }));
    el.appendChild(U.h('p', { class: 'sub', text: `amizade nível ${lv}` + (lv < p.maxLevel() ? ` · ${Math.round(p.levelProgress() * 100)}% para o próximo` : ' · máximo!') }));
    const xp = U.h('div', { class: 'xpbar' }, [U.h('b')]);
    xp.firstChild.style.width = Math.round(p.levelProgress() * 100) + '%';
    el.appendChild(xp);

    // nome
    el.appendChild(U.h('h3', { text: 'nome' }));
    const input = U.h('input', { type: 'text', maxlength: '14', value: G.config.pet.name, 'aria-label': 'Nome do pet', autocomplete: 'off', spellcheck: 'false' });
    const saveName = () => {
      const v = input.value.trim().slice(0, 14);
      if (!v || v === G.config.pet.name) return;
      custom.name = v;
      applyName(v);
      el.querySelector('h2').textContent = v;
      G.save.soon();
      G.bubble.show('!', { duration: 900 });
      G.audio.play('meow', { short: true });
    };
    input.addEventListener('change', saveName);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { input.blur(); saveName(); } });
    el.appendChild(U.h('div', { class: 'name-row' }, [input]));

    // acessórios
    el.appendChild(U.h('h3', { text: 'acessório' }));
    const acc = U.h('div', { class: 'options' });
    for (const a of C().accessories) {
      const img = a.id === 'none' ? null : U.h('img', { src: G.asset('accessories.' + a.id), alt: '' });
      acc.appendChild(optionButton(a, 'accessory', custom.accessory === a.id, img));
    }
    el.appendChild(acc);

    // parede
    el.appendChild(U.h('h3', { text: 'parede' }));
    const walls = U.h('div', { class: 'options' });
    for (const w of C().walls) {
      const sw = U.h('i', { class: 'sw' });
      sw.style.background = `linear-gradient(90deg, ${w.base} 50%, ${w.stripe} 50%)`;
      walls.appendChild(optionButton(w, 'wall', custom.wall === w.id, sw));
    }
    el.appendChild(walls);

    // tapete
    el.appendChild(U.h('h3', { text: 'tapete' }));
    const rugs = U.h('div', { class: 'options' });
    for (const r of C().rugs) rugs.appendChild(optionButton(r, 'rug', custom.rug === r.id, U.h('img', { src: G.asset('environment.' + r.asset), alt: '' })));
    el.appendChild(rugs);

    // segredos + estatísticas
    const eggs = G.eggs.list();
    const nf = eggs.filter((e) => e.found).length;
    el.appendChild(U.h('h3', { text: `segredos · ${nf}/${eggs.length}` }));
    const eg = U.h('div', { class: 'options' });
    for (const e of eggs) {
      if (!e.found) continue;
      const chip = U.h('span', { class: 'opt', text: e.title });
      chip.style.height = '36px';
      eg.appendChild(chip);
    }
    if (!nf) eg.appendChild(U.h('p', { class: 'sub', text: 'nenhum ainda… será que tem algum?' }));
    el.appendChild(eg);

    const st = p.stats;
    el.appendChild(U.h('h3', { text: 'vocês dois' }));
    const stats = U.h('div', { class: 'stats' });
    const stat = (n, label) => U.h('div', { class: 'stat' }, [U.h('b', { text: String(n || 0) }), U.h('span', { text: label })]);
    stats.append(
      stat(st.meals, 'refeições'), stat(st.baths, 'banhos'),
      stat(st.catches, 'brincadeiras'), stat(Math.round((st.pettingSeconds || 0) / 60), 'min de carinho')
    );
    el.appendChild(stats);

    // rodapé
    const footer = U.h('div', { class: 'footer' });
    const close = U.h('button', { class: 'btn', text: 'pronto' });
    close.addEventListener('click', closeSheet);
    const reset = U.h('button', { class: 'btn ghost danger', text: 'recomeçar do zero' });
    reset.addEventListener('click', () => {
      if (Date.now() - resetArmed < 3000) { G.save.reset(); return; }
      resetArmed = Date.now();
      reset.textContent = 'toque de novo para apagar tudo';
      gsap.fromTo(reset, { x: -5 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, .3)' });
      setTimeout(() => { reset.textContent = 'recomeçar do zero'; }, 3000);
    });
    footer.append(reset, close);
    el.appendChild(footer);

    // arrastar para baixo para fechar
    let startY = null, dy = 0;
    head.addEventListener('pointerdown', (e) => { startY = e.clientY; dy = 0; head.setPointerCapture(e.pointerId); });
    head.addEventListener('pointermove', (e) => {
      if (startY === null) return;
      dy = Math.max(0, e.clientY - startY);
      gsap.set(el, { y: dy });
    });
    const endDrag = () => {
      if (startY === null) return;
      startY = null;
      if (dy > 90) closeSheet();
      else gsap.to(el, { y: 0, duration: 0.3, ease: 'back.out(2)' });
    };
    head.addEventListener('pointerup', endDrag);
    head.addEventListener('pointercancel', endDrag);
    head.style.cssText = 'padding:6px 0 4px;margin:-6px 0 0;touch-action:none;cursor:grab';
    return el;
  }

  function open() {
    if (sheet) return;
    const ui = document.getElementById('ui');
    backdrop = U.h('div', { class: 'sheet-backdrop' });
    backdrop.addEventListener('click', closeSheet);
    sheet = build();
    ui.append(backdrop, sheet);
    gsap.to(backdrop, { opacity: 1, duration: 0.3 });
    gsap.fromTo(sheet, { yPercent: 105 }, { yPercent: 0, duration: 0.5, ease: 'expo.out' });
    gsap.from(sheet.querySelectorAll('h3, .options, .stats, .name-row'), { y: 14, opacity: 0, duration: 0.4, stagger: 0.03, delay: 0.12, ease: 'power2.out' });
    G.audio.play('pop', { v: 0.5 });
  }

  function closeSheet() {
    if (!sheet) return;
    const s = sheet, b = backdrop;
    sheet = null; backdrop = null;
    const input = s.querySelector('input');
    if (input && document.activeElement === input) input.blur();
    gsap.to(s, { yPercent: 105, duration: 0.32, ease: 'power3.in', onComplete: () => s.remove() });
    gsap.to(b, { opacity: 0, duration: 0.3, onComplete: () => b.remove() });
  }

  G.customize = {
    init() {
      G.save.register('custom', {
        get: () => ({ ...custom }),
        set: (d) => { if (d) Object.assign(custom, d); }
      });
      applyAll();
    },
    open,
    close: closeSheet,
    get data() { return { ...custom }; }
  };
})(window.Game = window.Game || {});
