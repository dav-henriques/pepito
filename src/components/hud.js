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
    sadEmote: 'chateado', grumpy: 'emburrado', dizzy: 'tonto', beingDragged: 'no colo', airborne: 'voando!', beingHeld: 'no colo',
    angry: 'bravo', sleepy: 'com soninho', confused: 'confuso', staring: 'te encarando', sillyPose: 'fazendo pose', startled: 'assustado'
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
  }

  /* ---------------- estado do pet (linha fixa no topo) ---------------- */
  let statusEl = null, statusText = '';
  function updateStatus(instant) {
    const text = `${G.config.pet.name} está ${MOOD_TEXT[G.petState.display.state] || 'por aí'}`;
    if (text === statusText) return;
    statusText = text;
    gsap.killTweensOf(statusEl);
    if (instant || U.reducedMotion) { statusEl.textContent = text; gsap.set(statusEl, { opacity: 1, y: 0 }); return; }
    gsap.timeline()
      .to(statusEl, { opacity: 0, y: -4, duration: 0.12, ease: 'power1.in' })
      .add(() => { statusEl.textContent = statusText; })
      .to(statusEl, { opacity: 1, y: 0, duration: 0.25, ease: 'back.out(2)' });
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
    if (statusEl) updateStatus(true);   // nome novo → texto novo
  }

  /* ---------------- volume (segurar o botão de som) ---------------- */
  let volPop = null, volTimer = 0;

  function slider(label, value, onInput) {
    const input = U.h('input', { type: 'range', min: '0', max: '100', step: '1', value: String(Math.round(value * 100)), 'aria-label': label });
    input.addEventListener('input', () => { onInput(input.value / 100); armVolClose(); });
    input.addEventListener('change', () => G.audio.play('pop', { v: 0.5 }));
    return U.h('label', { class: 'vol-row' }, [U.h('span', { text: label }), input]);
  }

  function armVolClose() {
    clearTimeout(volTimer);
    volTimer = setTimeout(closeVolume, 5000);
  }

  function openVolume(btn) {
    if (volPop) return closeVolume();
    closePanel();
    const lv = G.audio.levels;
    volPop = U.h('div', { class: 'vol-pop', role: 'dialog', 'aria-label': 'Volume' }, [
      slider('volume', lv.volume, (v) => G.audio.setVolume(v))
    ]);
    const mute = U.h('button', { class: 'vol-mute', text: G.audio.enabled ? 'silenciar tudo' : 'ligar o som' });
    mute.addEventListener('click', () => {
      G.audio.setEnabled(!G.audio.enabled);
      G.hud.syncSound();
      mute.textContent = G.audio.enabled ? 'silenciar tudo' : 'ligar o som';
      armVolClose();
    });
    volPop.appendChild(mute);
    btn.parentElement.appendChild(volPop);
    gsap.fromTo(volPop, { opacity: 0, y: -10, scale: 0.9, rotation: -3 }, { opacity: 1, y: 0, scale: 1, rotation: -1, duration: 0.35, ease: 'back.out(2)' });
    G.audio.play('pop', { v: 0.5 });
    armVolClose();
    setTimeout(() => document.addEventListener('pointerdown', outsideVol, true), 0);
  }

  function outsideVol(e) {
    if (volPop && !volPop.contains(e.target) && !e.target.closest('#sound-btn')) closeVolume();
  }

  function closeVolume() {
    if (!volPop) return;
    const p = volPop; volPop = null;
    clearTimeout(volTimer);
    document.removeEventListener('pointerdown', outsideVol, true);
    gsap.to(p, { opacity: 0, y: -8, scale: 0.95, duration: 0.2, ease: 'power2.in', onComplete: () => p.remove() });
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
      statusEl = document.getElementById('status-line');
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
        sb.setAttribute('aria-label', G.audio.enabled ? 'Som ligado (segure para o volume)' : 'Som desligado');
      };
      this.syncSound = syncSound;
      // toque = liga/desliga (como antes) · segurar = volume
      let lp = 0, longPressed = false;
      sb.addEventListener('pointerdown', () => {
        longPressed = false;
        clearTimeout(lp);
        lp = setTimeout(() => { longPressed = true; openVolume(sb); }, 480);
      });
      const cancelLp = () => clearTimeout(lp);
      sb.addEventListener('pointerup', cancelLp);
      sb.addEventListener('pointerleave', cancelLp);
      sb.addEventListener('pointercancel', cancelLp);
      sb.addEventListener('contextmenu', (e) => e.preventDefault());
      sb.addEventListener('click', () => {
        if (longPressed) { longPressed = false; return; }
        G.audio.setEnabled(!G.audio.enabled);
        syncSound();
        gsap.fromTo(sb, { scale: 0.85 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
        if (G.audio.enabled) G.audio.play('pop');
        if (G.audio.enabled) this.hintOnce('volume', 'segure o botão de som para ajustar o volume', 3000);
      });
      syncSound();

      G.bus.on('needs:change', updateRings);
      G.bus.on('progress:level', ({ level }) => {
        renderName();
        this.toast(`amizade nível ${level} · novidades na personalização`, 'paw');
        G.audio.play('chime');
        gsap.fromTo('#name-chip', { scale: 1.2 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1, .35)' });
      });
      G.bus.on('state:display', () => { updateStatus(); if (panel) fillPanel(); });
      updateRings(G.needs.all());
      renderName();
    },

    /** Entrada da HUD (GSAP) */
    intro() {
      gsap.from('.hud > *, .hud-right > *, .status-line', { y: -30, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'back.out(2)', delay: 0.3 });
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

    /** Etiquetinha de texto perto de um elemento (ex.: nome de um brinquedo) */
    tag(el, text, ms = 2400) {
      if (!el || !text) return;
      const r = G.room.rectOf(el);
      const t = U.h('div', { class: 'name-tag', text });
      if (/^\[.*\]$/.test(String(text).trim())) t.classList.add('placeholder');
      document.getElementById('ui').appendChild(t);
      const w = t.offsetWidth;
      const x = U.clamp((r.x0 + r.x1) / 2 - w / 2, 8, G.room.W - w - 8);
      const y = Math.max(60, r.y0 - t.offsetHeight - 6);
      gsap.set(t, { x, y, rotation: U.rand(-4, 4) });
      gsap.timeline({ onComplete: () => t.remove() })
        .fromTo(t, { scale: 0.4, opacity: 0, y: y + 10 }, { scale: 1, opacity: 1, y, duration: 0.35, ease: 'back.out(2.5)' })
        .to(t, { opacity: 0, y: y - 8, duration: 0.3, delay: ms / 1000, ease: 'power2.in' });
    },

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
