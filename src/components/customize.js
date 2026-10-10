/* ==========================================================================
   CADERNINHO (folha inferior, GSAP)
   Nome, volume e estatísticas.
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  const custom = { name: null };
  let sheet = null, backdrop = null;
  let resetArmed = 0;

  /* ---------------- aplicar ---------------- */
  function applyName(name) {
    if (name) G.config.pet.name = name;
    G.hud.renderName();
  }

  /* ---------------- UI ---------------- */
  function build() {
    const p = G.progress;
    const lv = p.level();
    const el = U.h('div', { class: 'sheet', role: 'dialog', 'aria-label': 'Personalizar' });
    const head = U.h('div', { class: 'sheet-head' }, [U.h('div', { class: 'grab' })]);
    el.appendChild(head);

    el.appendChild(U.h('p', { class: 'kicker', text: 'caderninho do' }));
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

    // som
    el.appendChild(U.h('h3', { text: 'som' }));
    const vol = U.h('input', { type: 'range', min: '0', max: '100', step: '1', value: String(Math.round(G.audio.levels.volume * 100)), 'aria-label': 'Volume' });
    vol.addEventListener('input', () => G.audio.setVolume(vol.value / 100));
    vol.addEventListener('change', () => G.audio.play('pop', { v: 0.5 }));
    const sound = U.h('div', { class: 'sound-box' }, [U.h('label', { class: 'vol-row' }, [U.h('span', { text: 'volume' }), vol])]);
    const muteBtn = U.h('button', { class: 'btn ghost small', text: G.audio.enabled ? 'silenciar' : 'ligar o som' });
    muteBtn.addEventListener('click', () => {
      G.audio.setEnabled(!G.audio.enabled);
      G.hud.syncSound();
      muteBtn.textContent = G.audio.enabled ? 'silenciar' : 'ligar o som';
    });
    sound.appendChild(muteBtn);
    el.appendChild(sound);

    // estatísticas
    const st = p.stats;
    const who = (G.personal && G.personal.playerName) || '';
    el.appendChild(U.h('h3', { text: who ? `${who} & ${G.config.pet.name}` : 'vocês dois' }));
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
    const by = (G.personal && G.personal.madeBy) || '';
    if (by && (U.showPlaceholders || !U.isPlaceholder(by))) el.appendChild(U.h('p', { class: 'signature', text: `feito à mão por ${by}` }));

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
    gsap.from(sheet.querySelectorAll('h3, .sound-box, .stats, .name-row'), { y: 14, opacity: 0, duration: 0.4, stagger: 0.03, delay: 0.12, ease: 'power2.out' });
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
        set: (d) => {
          if (d && typeof d.name === 'string') custom.name = d.name;
        }
      });
      applyName(custom.name);
    },
    open,
    close: closeSheet,
    get data() { return { ...custom }; }
  };
})(window.Game = window.Game || {});
