/* ==========================================================================
   RECORTE DE FOTO — transforma as imagens do pet em "personagem de jogo"
   --------------------------------------------------------------------------
   Para cada imagem do pet (assets.js → pet), num canvas:
   • detecta se tem transparência (gato recortado) ou não (foto inteira);
   • recortado → iguala o TAMANHO VISUAL entre as fotos (autoFit: mesma área
     de gato, pés na mesma linha, centralizado), adiciona contorno branco de
     adesivo e uma sombra suave;
   • foto inteira → vira um "cartão de foto" com borda e sombra, em pé no chão.
   O resultado é uma imagem 512×512 em memória — os arquivos não mudam.

   Limitação: abrindo o index.html direto (file://), o navegador proíbe ler
   os pixels do canvas. Nesse caso o jogo usa contorno via CSS (sem autoFit).
   Rodando num servidor (tools/serve.ps1) ou hospedado, tudo funciona.
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;
  const SIZE = 512;

  const out = {};          // chave → { url, opaque, processed } | null
  const waiters = {};      // chave → [resolve]
  const queue = [];
  let working = null;      // chave sendo processada
  let mode = 'pending';    // 'pending' | 'canvas' | 'css'

  const look = () => G.config.pet.look || {};

  function mk(w = SIZE, h = SIZE) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d', { willReadFrequently: true });   // canvas em CPU: leitura/exportação rápidas
    return c;
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* ======================================================================
     FUNÇÕES PURAS (também usadas para gerar os placeholders)
     ====================================================================== */

  /** Área de gato (alpha), caixa robusta e se a imagem é opaca.
      region (opcional) = retângulo onde a imagem foi desenhada: a
      opacidade só é medida ali dentro (as margens do enquadramento não contam). */
  function analyze(data, w, h, region) {
    let area = 0, transparent = 0;
    const rx0 = region ? Math.ceil(region.x) : 0, ry0 = region ? Math.ceil(region.y) : 0;
    const rx1 = region ? Math.floor(region.x + region.w) : w, ry1 = region ? Math.floor(region.y + region.h) : h;
    const rows = new Float64Array(h), cols = new Float64Array(w);
    for (let y = 0, i = 3; y < h; y++) {
      let row = 0;
      const inY = y >= ry0 && y < ry1;
      for (let x = 0; x < w; x++, i += 4) {
        const a = data[i];
        if (inY && x >= rx0 && x < rx1 && a < 250) transparent++;
        if (a > 24) { const v = a / 255; row += v; cols[x] += v; }
      }
      rows[y] = row;
      area += row;
    }
    const regionArea = Math.max(1, (rx1 - rx0) * (ry1 - ry0));
    // ignora pixels soltos nas bordas (0,3% da área de cada lado)
    const cut = area * 0.003;
    const edge = (arr, rev) => {
      let acc = 0;
      for (let j = 0; j < arr.length; j++) {
        const k = rev ? arr.length - 1 - j : j;
        acc += arr[k];
        if (acc > cut) return k;
      }
      return rev ? arr.length - 1 : 0;
    };
    return {
      w, h, area,
      fill: area / (w * h),
      opaque: transparent < regionArea * 0.004,
      empty: area < 1,
      x0: edge(cols), x1: edge(cols, true) + 1,
      y0: edge(rows), y1: edge(rows, true) + 1
    };
  }

  /** Escala/translação que leva o recorte ao enquadramento padrão.
      srcScale = quanto o arquivo original já foi reduzido para caber em 512
      (o limite de ampliação vale para os pixels do ARQUIVO: um PNG grande
      com muita margem transparente pode ser ampliado à vontade sem perder nitidez). */
  function fitTransform(st, L, srcScale = 1) {
    const lim = L.maxUpscale || 1.6;
    let s = Math.sqrt((L.targetFill * st.w * st.h) / Math.max(1, st.area));
    s = U.clamp(s, 0.25, lim / Math.min(1, srcScale));
    const bw = st.x1 - st.x0, bh = st.y1 - st.y0;
    const baseline = st.h * (1 - L.footOffset);
    s = Math.min(s, (st.w * 0.97) / bw, (baseline * 0.98) / bh);
    const cx = (st.x0 + st.x1) / 2;
    return { s, dx: st.w / 2 - cx * s, dy: baseline - st.y1 * s };
  }

  /** Contorno de adesivo + sombra suave */
  function decorate(src, L) {
    const o = mk();
    const c = o.getContext('2d');
    const px = L.outline ? (L.outlineWidth || 7) : 0;
    const sil = mk();
    const sc = sil.getContext('2d');
    sc.drawImage(src, 0, 0);
    sc.globalCompositeOperation = 'source-in';
    sc.fillStyle = L.outlineColor || '#ffffff';
    sc.fillRect(0, 0, SIZE, SIZE);
    if (L.shadow) {
      c.save();
      c.shadowColor = 'rgba(40, 24, 12, 0.30)';
      c.shadowBlur = 14;
      c.shadowOffsetY = 5;
      c.drawImage(sil, 0, 0);
      c.restore();
    }
    const n = 20;
    const ring = (img, r) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        c.drawImage(img, Math.cos(a) * r, Math.sin(a) * r);
      }
    };
    if (px && L.outlineEdge) {
      // fiozinho escuro em volta do contorno branco (aparece no fundo branco)
      const edge = mk();
      const ec = edge.getContext('2d');
      ec.drawImage(src, 0, 0);
      ec.globalCompositeOperation = 'source-in';
      ec.fillStyle = '#2b2a33';
      ec.fillRect(0, 0, SIZE, SIZE);
      const band = mk();
      const bc = band.getContext('2d');
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        bc.drawImage(edge, Math.cos(a) * (px + 1.8), Math.sin(a) * (px + 1.8));
      }
      c.globalAlpha = typeof L.outlineEdge === 'number' ? L.outlineEdge : 0.2;
      c.drawImage(band, 0, 0);
      c.globalAlpha = 1;
    }
    if (px) { ring(sil, px * 0.5); ring(sil, px); }
    c.drawImage(src, 0, 0);
    return o;
  }

  /** Foto sem transparência → cartão de foto em pé */
  function card(img, L, footOffset) {
    const o = mk();
    const c = o.getContext('2d');
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const fill = L.cardFill ?? 0.82;
    const k = Math.min((SIZE * fill) / iw, (SIZE * fill) / ih);
    const w = iw * k, h = ih * k;
    const bottom = SIZE * (1 - footOffset);
    if (L.cardBorder === false) {
      // só a foto (cantos levemente arredondados) com a sombra seguindo a própria foto
      const x = (SIZE - w) / 2, y = bottom - h;
      const ph = mk();
      const pc = ph.getContext('2d');
      roundRect(pc, x, y, w, h, SIZE * 0.012);
      pc.clip();
      pc.drawImage(img, x, y, w, h);
      c.shadowColor = 'rgba(40, 24, 12, 0.32)';
      c.shadowBlur = 16;
      c.shadowOffsetY = 6;
      c.drawImage(ph, 0, 0);
      return o;
    }
    const b = Math.round(SIZE * 0.028);
    const x = (SIZE - w) / 2, y = bottom - h - b;
    c.save();
    c.shadowColor = 'rgba(40, 24, 12, 0.32)';
    c.shadowBlur = 16;
    c.shadowOffsetY = 6;
    c.fillStyle = L.outlineColor || '#fffaf2';
    roundRect(c, x - b, y - b, w + 2 * b, h + 2 * b, b * 0.8);
    c.fill();
    c.restore();
    if (L.outlineEdge) {
      c.save();
      c.strokeStyle = `rgba(43, 42, 51, ${typeof L.outlineEdge === 'number' ? L.outlineEdge : 0.2})`;
      c.lineWidth = 2;
      roundRect(c, x - b, y - b, w + 2 * b, h + 2 * b, b * 0.8);
      c.stroke();
      c.restore();
    }
    c.save();
    roundRect(c, x, y, w, h, b * 0.35);
    c.clip();
    c.drawImage(img, x, y, w, h);
    c.restore();
    return o;
  }

  // toDataURL é síncrono e rápido (~3 ms em 512px); o toBlob do Chrome espera um
  // "momento ocioso" e pode levar até 1 s por imagem com animações rodando.
  function toURL(cv) {
    return Promise.resolve(cv.toDataURL('image/png'));
  }

  /* ======================================================================
     PROCESSAMENTO
     ====================================================================== */
  async function processOne(key, img) {
    const L = { ...look(), footOffset: G.config.pet.footOffset };
    const tw = (G.config.pet.imageTweaks || {})[key] || {};
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (!iw || !ih) return null;

    // enquadra (contain, pés embaixo) num canvas de análise
    const k = Math.min(SIZE / iw, SIZE / ih);
    const aw = iw * k, ah = ih * k, ax = (SIZE - aw) / 2, ay = SIZE - ah;
    const a = mk();
    const ac = a.getContext('2d', { willReadFrequently: true });
    ac.drawImage(img, ax, ay, aw, ah);
    // file:// → SecurityError (tratado em pump)
    const st = analyze(ac.getImageData(0, 0, SIZE, SIZE).data, SIZE, SIZE, { x: ax, y: ay, w: aw, h: ah });
    if (st.empty) return null;

    if (st.opaque) {
      if (!L.frameOpaque) return { url: img.src, opaque: true, processed: false };
      return { url: await toURL(card(img, L, L.footOffset)), opaque: true, processed: true };
    }

    let base = a;
    if (L.autoFit && tw.fit !== false) {
      const f = fitTransform(st, L, k);
      if (Math.abs(f.s - 1) > 0.012 || Math.abs(f.dx) > 1 || Math.abs(f.dy) > 1) {
        base = mk();
        const bc = base.getContext('2d');
        bc.imageSmoothingQuality = 'high';
        // um único reamostramento a partir do arquivo original (máxima nitidez)
        bc.drawImage(img, ax * f.s + f.dx, ay * f.s + f.dy, aw * f.s, ah * f.s);
      }
    }
    const fin = (L.outline || L.shadow) ? decorate(base, L) : base;
    return { url: await toURL(fin), opaque: false, processed: true };
  }

  function settle(key, value) {
    out[key] = value;
    (waiters[key] || []).forEach((r) => r(value));
    delete waiters[key];
    if (value) G.bus.emit('cutout:ready', { key });
  }

  function switchToCss(reason) {
    if (mode === 'css') return;
    mode = 'css';
    if (reason) console.info('[cutout] usando contorno via CSS:', reason);
    for (const q of queue.splice(0)) settle(q.key, null);
    G.bus.emit('cutout:mode', mode);
  }

  async function pump() {
    if (working) return;
    while (queue.length) {
      const { key, img } = queue.shift();
      working = key;
      let r = null;
      try {
        r = await processOne(key, img);
        if (mode === 'pending') { mode = 'canvas'; G.bus.emit('cutout:mode', mode); }
      } catch (e) {
        if (e && e.name === 'SecurityError') {
          working = null;
          settle(key, null);
          switchToCss('o navegador bloqueou a leitura dos pixels (abra pelo servidor local para o recorte completo)');
          return;
        }
        console.warn('[cutout]', key, e);
      }
      working = null;
      settle(key, r);
      await U.wait(0); // respira entre imagens
    }
  }

  G.cutout = {
    SIZE, analyze, fitTransform, decorate, card,

    init() {
      // ?recorte=css simula o modo sem canvas (como abrir o index.html direto)
      if (!look().process || !window.HTMLCanvasElement || U.param('recorte') === 'css') switchToCss();
    },

    /** Coloca uma imagem (já carregada) na fila. priority → vai para a frente */
    enqueue(key, img, priority) {
      if (mode === 'css') { settle(key, null); return; }
      if (key in out || queue.some((q) => q.key === key) || working === key) return;
      queue[priority ? 'unshift' : 'push']({ key, img });
      pump();
    },

    /** Resultado pronto (ou null): { url, opaque, processed } */
    result(key) { return out[key] || null; },

    isPending(key) { return !(key in out) && (working === key || queue.some((q) => q.key === key)); },

    /** Espera a imagem ficar pronta (com limite de tempo) */
    whenReady(key, timeout = 400) {
      if (key in out || !this.isPending(key)) return Promise.resolve(out[key] || null);
      return new Promise((res) => {
        (waiters[key] = waiters[key] || []).push(res);
        setTimeout(() => res(out[key] || null), timeout);
      });
    },

    get mode() { return mode; }
  };
})(window.Game = window.Game || {});
