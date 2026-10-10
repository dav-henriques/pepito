/* ==========================================================================
   MÍDIA — carregar imagens com fallback (nada de imagem quebrada no quarto)
   --------------------------------------------------------------------------
   G.media.img(el, 'photos.photo01')          → tenta o arquivo; se falhar,
   G.media.img(el, ref, { fallback: 'x.y' })     tenta o fallback; se falhar,
                                                 usa um placeholder desenhado
                                                 aqui mesmo (nunca falha).
   ========================================================================== */
(function (G) {
  'use strict';

  const esc = (s) => String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Placeholder local (SVG em data URI): mostra qual arquivo está faltando */
  function placeholder(label, opts = {}) {
    const w = opts.w || 320, h = opts.h || 320;
    const name = esc(String(label || 'imagem').split('/').pop());
    const fs = Math.max(12, Math.round(Math.min(w, h) / 13));
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">` +
      `<rect x="8" y="8" width="${w - 16}" height="${h - 16}" rx="22" fill="#f6ecd9" stroke="#2b2a33" stroke-width="6" stroke-dasharray="18 12"/>` +
      `<text x="50%" y="48%" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="${Math.round(Math.min(w, h) / 3.2)}" fill="#d8694a">?</text>` +
      `<text x="50%" y="70%" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="${fs}" fill="#2b2a33">faltando:</text>` +
      `<text x="50%" y="${70 + fs * 0.45}%" text-anchor="middle" font-family="monospace" font-size="${fs}" fill="#2b2a33">${name}</text>` +
      `</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  const imgCache = new Map();   // src → Promise<boolean>

  G.media = {
    placeholder,

    /** Coloca uma imagem num <img> com cadeia de fallback */
    img(el, ref, opts = {}) {
      if (!el) return;
      const list = [...G.assetList(ref), ...G.assetList(opts.fallback)];
      const label = opts.label || list[0] || String(ref);
      let i = 0;
      el.dataset.file = list[0] || '';
      const next = () => {
        if (i < list.length) { el.src = list[i++]; return; }
        el.onerror = null;
        el.src = placeholder(label, opts);
        el.dataset.missing = '1';
      };
      el.onerror = () => {
        console.warn('[media] não carregou:', el.getAttribute('src'));
        next();
      };
      el.onload = () => { if (!el.src.startsWith('data:')) delete el.dataset.missing; if (opts.onload) opts.onload(el); };
      next();
    },

    /** Promise<boolean>: a imagem existe? */
    probeImage(src) {
      if (!src) return Promise.resolve(false);
      if (!imgCache.has(src)) {
        imgCache.set(src, new Promise((res) => {
          const im = new Image();
          im.onload = () => res(true);
          im.onerror = () => res(false);
          im.src = src;
        }));
      }
      return imgCache.get(src);
    },

    /** Primeiro candidato de uma referência que carrega (ou null) */
    async firstImage(ref) {
      for (const src of G.assetList(ref)) if (await this.probeImage(src)) return src;
      return null;
    },

    /** O jogo está rodando via http(s)? (file:// tem várias limitações) */
    get isHttp() { return /^https?:$/.test(location.protocol); }
  };
})(window.Game = window.Game || {});
