/* ==========================================================================
   NÚCLEO: barramento de eventos + utilitários compartilhados.
   Os sistemas conversam por eventos (G.bus) para ficarem desacoplados:
   adicionar um sistema novo = ouvir/emitir eventos, sem mexer nos outros.
   ========================================================================== */
(function (G) {
  'use strict';

  /* ---------------- Event bus ---------------- */
  const listeners = new Map();
  G.bus = {
    on(evt, fn) {
      if (!listeners.has(evt)) listeners.set(evt, new Set());
      listeners.get(evt).add(fn);
      return () => this.off(evt, fn);
    },
    once(evt, fn) {
      const off = this.on(evt, (d) => { off(); fn(d); });
      return off;
    },
    off(evt, fn) { listeners.get(evt)?.delete(fn); },
    emit(evt, data) {
      const set = listeners.get(evt);
      if (!set) return;
      for (const fn of [...set]) {
        try { fn(data); } catch (err) { console.error('[bus]', evt, err); }
      }
    }
  };

  /* ---------------- Utils ---------------- */
  const U = G.util = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    invLerp: (a, b, v) => (b === a ? 0 : (v - a) / (b - a)),
    rand: (a, b) => a + Math.random() * (b - a),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    chance: (p) => Math.random() < p,
    sign: (v) => (v < 0 ? -1 : 1),
    dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
    now: () => performance.now(),
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),

    /** Sorteio com pesos: { a: 3, b: 1 } → 'a' (75%) */
    weighted(weights) {
      let total = 0;
      for (const k in weights) total += Math.max(0, weights[k]);
      let r = Math.random() * total;
      for (const k in weights) {
        r -= Math.max(0, weights[k]);
        if (r <= 0) return k;
      }
      return Object.keys(weights)[0];
    },

    /** Criação rápida de elementos: h('div', {class:'x', dataset:{hit:'pet'}}, [filhos]) */
    h(tag, attrs = {}, children = []) {
      const el = document.createElement(tag);
      for (const k in attrs) {
        const v = attrs[k];
        if (k === 'class') el.className = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
      }
      for (const c of [].concat(children)) if (c) el.append(c);
      return el;
    },

    $: (sel, root = document) => root.querySelector(sel),
    $$: (sel, root = document) => [...root.querySelectorAll(sel)],

    /** Mistura cores hex (#rrggbb) */
    mixColor(a, b, t) {
      const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
      const r = Math.round(U.lerp(pa >> 16, pb >> 16, t));
      const g = Math.round(U.lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
      const bl = Math.round(U.lerp(pa & 255, pb & 255, t));
      return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
    },

    /** Parâmetros de URL (?hora=22&debug=1) */
    param(name) {
      try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
    },

    reducedMotion: (() => {
      try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    })(),

    /** Texto ainda não personalizado? ("[NOME DA PELÚCIA]") */
    isPlaceholder: (s) => /^\s*\[[^\]]*\]\s*$/.test(String(s ?? ''))
  };

  /** Vibraçãozinha no celular (Android; o iPhone ignora). Segue o botão de som:
      som desligado = sem vibração. Desligar de vez: petConfig → audio.haptics */
  G.haptic = function (ms = 10) {
    if (G.config && G.config.audio && G.config.audio.haptics === false) return;
    if (G.audio && !G.audio.enabled) return;
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ok */ }
  };

  /* Placeholders [ASSIM] aparecem (em amarelo) só enquanto você monta o
     presente: abrindo pelo computador (arquivo ou servidor local) ou com
     ?rascunho=1. Publicado num site, eles somem — ela nunca vê "[SEU NOME]".
     ?rascunho=0 esconde também no computador. */
  U.showPlaceholders = (() => {
    const p = U.param('rascunho');
    if (p !== null) return p !== '0';
    return location.protocol === 'file:' || /^(localhost|127\.|\[::1\]|192\.168\.|10\.)/.test(location.hostname);
  })();
})(window.Game = window.Game || {});
