/* ==========================================================================
   HUD MÍNIMA (GSAP)
   Nome + nível, 4 anéis discretos de necessidades, botão de som.
   Tocar nos anéis mostra um painel rápido. Dicas aparecem só uma vez.
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;
  const CIRC = 94.25; // 2πr (r = 15)

  const MOOD_TEXT = {
    normal: 'tranquilo', happy: 'feliz', excited: 'animado', playing: 'brincando', playful: 'brincalhão',
    hungry: 'com fome', veryHungry: 'faminto', dirty: 'sujinho', veryDirty: 'muito sujo', clean: 'cheiroso',
    tired: 'cansado', sleeping: 'dormindo', eating: 'comendo', bathing: 'no banho', sad: 'tristinho',
    sadEmote: 'chateado', grumpy: 'emburrado', dizzy: 'tonto', beingDragged: 'no colo', airborne: 'voando!', beingHeld: 'no colo'
  };
  const LABELS = { hunger: 'fome', happiness: 'humor', energy: 'energia', cleanliness: 'limpeza' };
  const ICONS = { hunger: 'food', happiness: 'smile', energy: 'bolt', cleanliness: 'drop' };

  let rings = {};
  let panel = null;
  let panelTimer = null;
  let hintEl, toastEl;
  let seenHints = {};
  let hintQueue = Promise.resolve();
  const lowState = {};

  function updateRings(v) {
    for (const k in rings) {
      const val = U.clamp(v[k] ?? 0, 0, 100);
      gsap.to(rings[k].bar, { strokeDashoffset: CIRC * (1 - val / 100), duration: 0.6, ease: 'power2.out', overwrite: true });
      const low = G.needs.level(k) !== 'ok';
      if (low !== lowState[k]) {
        lowState[k] = low;
        rings[k].el.classList.toggle('low', low);
        if (low) gsap.fromTo(rings[k].el, { scale: 1.35 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1, .35)' });
      }
    }
    if (panel) fillPanel();
  }

  function fillPanel() {
    const v = G.needs.all();
    const debug = G.config.debug.showNumbers || U.param('debug') === '1';
    panel.querySelectorAll('.row').forEach((row) => {
      const k = row.dataset.k;
      gsap.to(row.querySelector('b'), { scaleX: v[k] / 100, duration: 0.4, ease: 'power2.out' });
      if (debug) row.querySelector('.num').textContent = Math.round(v[k]);
    });
    panel.querySelector('.mood').textContent = `${G.config.pet.name} está ${MOOD_TEXT[G.petState.display.state] || 'por aí'}`;
  }

  function togglePanel() {
    if (panel) return closePanel();
    const btn = document.getElementById('needs');
    panel = U.h('div', { class: 'needs-panel' });
    for (const k of Object.keys(LABELS)) {
      const color = getComputedStyle(rings[k].el).getPropertyValue('--c');
      const row = U.h('div', { class: 'row', dataset: { k } });
      const ic = G.icon(ICONS[k]); ic.style.color = color;
      const meter = U.h('div', { class: 'meter' }, [U.h('b')]);
      meter.style.color = color;
      row.append(ic, U.h('span', { text: LABELS[k] }), meter);
      const num = U.h('em', { class: 'num' });
      num.style.cssText = 'font-style:normal;font-size:12px;color:var(--ink-soft);position:absolute;right:16px';
      row.appendChild(num);
      panel.appendChild(row);
    }
    panel.appendChild(U.h('div', { class: 'mood' }));
    btn.parentElement.appendChild(panel);
    panel.style.position = 'absolute';
    gsap.set(panel.querySelectorAll('.meter b'), { scaleX: 0 });
    fillPanel();
    gsap.fromTo(panel, { opacity: 0, y: -10, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'back.out(2)' });
    clearTimeout(panelTimer);
    panelTimer = setTimeout(closePanel, 4200);
  }

  function closePanel() {
    if (!panel) return;
    const p = panel; panel = null;
    clearTimeout(panelTimer);
    gsap.to(p, { opacity: 0, y: -8, scale: 0.95, duration: 0.2, ease: 'power2.in', onComplete: () => p.remove() });
  }

  function renderName() {
    document.querySelector('.pet-name').textContent = G.config.pet.name;
    document.getElementById('pet').setAttribute('aria-label', G.config.pet.name);
    const dots = document.getElementById('level-dots');
    dots.innerHTML = '';
    const lv = G.progress.level();
    const max = Math.min(G.progress.maxLevel(), 7);
    for (let i = 1; i <= max; i++) {
      const d = U.h('i');
      if (i <= lv) d.className = 'on';
      dots.appendChild(d);
    }
  }

  function showHint(text, ms = 3800) {
    hintQueue = hintQueue.then(() => new Promise((resolve) => {
      hintEl.textContent = text;
      gsap.timeline({ onComplete: resolve })
        .fromTo(hintEl, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: 'back.out(2)' })
        .to(hintEl, { opacity: 0, y: 8, duration: 0.35, delay: ms / 1000, ease: 'power2.in' });
    }));
  }

  G.hud = {
    init() {
      hintEl = document.getElementById('hint');
      toastEl = document.getElementById('toast');
      gsap.set(hintEl, { xPercent: -50 });
      gsap.set(toastEl, { xPercent: -50 });
      hintEl.style.transform = toastEl.style.transform = '';
      gsap.set([hintEl, toastEl], { xPercent: -50, opacity: 0 });

      document.querySelectorAll('.ring').forEach((el) => {
        rings[el.dataset.need] = { el, bar: el.querySelector('.bar') };
      });
      G.save.register('hints', { get: () => ({ ...seenHints }), set: (d) => { seenHints = d || {}; } });

      document.getElementById('needs').addEventListener('click', togglePanel);
      document.getElementById('name-chip').addEventListener('click', () => G.customize.open());
      const sb = document.getElementById('sound-btn');
      const syncSound = () => {
        sb.classList.toggle('muted', !G.audio.enabled);
        sb.querySelector('use').setAttribute('href', G.audio.enabled ? '#i-sound' : '#i-mute');
        sb.setAttribute('aria-label', G.audio.enabled ? 'Som ligado' : 'Som desligado');
      };
      sb.addEventListener('click', () => {
        G.audio.setEnabled(!G.audio.enabled);
        syncSound();
        gsap.fromTo(sb, { scale: 0.85 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
        if (G.audio.enabled) G.audio.play('pop');
      });
      syncSound();

      G.bus.on('needs:change', updateRings);
      G.bus.on('progress:level', ({ level }) => {
        renderName();
        this.toast(`amizade nível ${level} · novidades na personalização`, 'paw');
        G.audio.play('chime');
        gsap.fromTo('#name-chip', { scale: 1.2 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1, .35)' });
      });
      G.bus.on('state:display', () => { if (panel) fillPanel(); });
      updateRings(G.needs.all());
      renderName();
    },

    /** Entrada da HUD (GSAP) */
    intro() {
      gsap.from('.hud > *, .hud-right > *', { y: -30, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'back.out(2)', delay: 0.3 });
    },

    renderName,

    hint(text, ms) { showHint(text, ms); },

    /** Dica que aparece só uma vez na vida */
    hintOnce(id, text, ms) {
      if (seenHints[id]) return false;
      seenHints[id] = Date.now();
      G.save.soon();
      showHint(text, ms);
      return true;
    },

    hasSeen(id) { return !!seenHints[id]; },

    closePanel,

    toast(text, icon = 'sparkle') {
      closePanel();
      toastEl.innerHTML = '';
      toastEl.append(G.icon(icon), document.createTextNode(text));
      gsap.killTweensOf(toastEl);
      gsap.timeline()
        .fromTo(toastEl, { opacity: 0, y: -14, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(2.2)' })
        .to(toastEl, { opacity: 0, y: -10, duration: 0.35, delay: 2.8, ease: 'power2.in' });
    }
  };
})(window.Game = window.Game || {});
