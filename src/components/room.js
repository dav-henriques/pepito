/* ==========================================================================
   QUARTO — medidas, zonas e profundidade.
   As posições dos móveis vêm do CSS; aqui elas são medidas e viram "zonas"
   (cama, banheira, pote…) usadas pela física e pelo comportamento.
   Mover um móvel no CSS atualiza tudo automaticamente.
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  // Faixa "andável" do chão, em fração da altura do quarto (petConfig → room)
  const GEO = () => ({ floorTop: 0.45, zMin: 0.52, zMax: 0.952, topMargin: 0.015, ...(G.config.room || {}) });

  const room = {
    el: null,
    world: null,
    W: 375,
    H: 740,
    u: 3.75,
    ou: 3.75,
    petW: 128,
    petH: 128,
    left: 0,
    top: 0,
    geo: {},
    zones: {},

    init() {
      this.el = document.getElementById('room');
      this.world = document.getElementById('world');
      // contorno de recorte / borda dos cartões de foto (petConfig → pet.look) valem para tudo
      const L = G.config.pet.look || {};
      this.el.classList.toggle('no-outline', L.outline === false);
      this.el.classList.toggle('no-card-border', L.cardBorder === false);
      // Caminhos de imagens vindos do registro central (assets.js), com fallback.
      // Os móveis usam o mesmo visual de "recorte" do gato (sombra; contorno se
      // pet.look.outline); foto JPG sem transparência vira um cartão de foto.
      for (const img of U.$$('img[data-asset]')) {
        G.media.img(img, img.dataset.asset);
        img.classList.add('cut');
        if (/\.jpe?g($|\?)/i.test(G.asset(img.dataset.asset))) img.classList.add('photo-card');
      }
      // re-mede quando as imagens chegam (a altura vem da proporção de cada arquivo)
      for (const img of U.$$('.world img[data-asset]')) {
        if (!img.complete) img.addEventListener('load', () => { this.measure(); G.bus.emit('room:resize', this); }, { once: true });
      }
      this.applyFurniture();
      this.measure();
      this.loadBackground();
      let raf = 0;
      const onResize = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => { this.measure(); G.bus.emit('room:resize', this); });
      };
      window.addEventListener('resize', onResize);
      window.addEventListener('orientationchange', onResize);
      if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
    },

    measure() {
      const r = this.el.getBoundingClientRect();
      this.left = r.left; this.top = r.top;
      this.W = r.width; this.H = r.height;
      this.u = Math.min(this.W / 100, (this.H * 0.56) / 100);
      const cfg = G.config.pet;
      this.petW = this.petH = U.clamp(this.u * cfg.size, cfg.minSizePx, cfg.maxSizePx);
      // unidade dos OBJETOS (móveis, brinquedos): segue a escala do gato, para a
      // cama nunca ficar menor que ele (celular deitado, telas muito largas…)
      this.ou = this.petW / cfg.size;

      const s = this.el.style;
      s.setProperty('--u', this.u.toFixed(3) + 'px');
      s.setProperty('--ou', this.ou.toFixed(3) + 'px');
      s.setProperty('--pet-w', this.petW.toFixed(1) + 'px');
      s.setProperty('--pet-h', this.petH.toFixed(1) + 'px');

      const g = GEO();
      s.setProperty('--floor-top', (g.floorTop * 100).toFixed(2) + '%');
      // paredes: o cartão de foto é mais largo que um gato recortado
      const card = /\.jpe?g($|\?)/i.test((cfg.images && cfg.images.normal) || '');
      const margin = this.petW * (card ? 0.47 : 0.36);
      this.geo = {
        zMin: this.H * g.zMin,
        zMax: this.H * g.zMax,
        minX: margin,
        maxX: this.W - margin,
        top: this.H * g.topMargin,
        floorTop: this.H * g.floorTop
      };
      this.measureZones();
    },

    /** Caixa do elemento no quarto pelo layout (ignora transforms: medir no meio
        da animação de entrada dos móveis não pode deslocar as zonas) */
    rectOf(el) {
      let x = 0, y = 0, n = el;
      while (n && n !== this.el) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      if (n === this.el && el.offsetWidth) {
        const w = el.offsetWidth, h = el.offsetHeight;
        return { x0: x, y0: y, x1: x + w, y1: y + h, w, h };
      }
      return this.screenRectOf(el);
    },

    /** Caixa do elemento como aparece na tela (com transforms: brinquedos, pet…) */
    screenRectOf(el) {
      const r = el.getBoundingClientRect();
      const o = this.el.getBoundingClientRect();
      return { x0: r.left - o.left, y0: r.top - o.top, x1: r.right - o.left, y1: r.bottom - o.top, w: r.width, h: r.height };
    },

    measureZones() {
      const q = (sel) => this.el.querySelector(sel);
      const z = {};

      const bed = this.rectOf(q('.bed'));
      z.bed = {
        ...bed,
        cx: (bed.x0 + bed.x1) / 2,
        seatZ: bed.y0 + bed.h * 0.62,
        // pegada no chão (elipse)
        fx0: bed.x0 + bed.w * 0.06, fx1: bed.x1 - bed.w * 0.06,
        fz0: bed.y0 + bed.h * 0.18, fz1: bed.y1 - bed.h * 0.02,
        surface: Math.max(3, bed.h * 0.08)
      };

      const tub = this.rectOf(q('.tub-front'));
      z.tub = {
        ...tub,
        cx: (tub.x0 + tub.x1) / 2,
        seatZ: tub.y0 + tub.h * 0.56,
        fx0: tub.x0 + tub.w * 0.04, fx1: tub.x1 - tub.w * 0.04,
        fz0: tub.y0 + tub.h * 0.2, fz1: tub.y1,
        rimY: tub.y0 + tub.h * 0.42
      };

      const bowl = this.rectOf(q('.bowl'));
      z.bowl = { ...bowl, cx: (bowl.x0 + bowl.x1) / 2, cz: bowl.y1 - bowl.h * 0.25 };

      this.zones = z;

      // profundidade dos móveis (quem está mais "na frente" fica por cima)
      q('.bed').style.zIndex = Math.round(bed.y0 + bed.h * 0.3);
      q('.bed-front').style.zIndex = Math.round(bed.y1) + 2;
      q('.bowl').style.zIndex = Math.round(bowl.y1);
      q('.tub-back').style.zIndex = Math.round(tub.y0 + tub.h * 0.3);
      q('.tub-front').style.zIndex = Math.round(tub.y1) + 2;
    },

    /** Foto de fundo opcional (assets.js → room.background). Sem ela: colagem de papel. */
    async loadBackground() {
      const src = await G.media.firstImage('room.background');
      if (!src) return;
      const img = this.el.querySelector('.backdrop-photo');
      if (!img) return;
      img.src = src;
      img.hidden = false;
      this.el.classList.add('has-photo');
      gsap.fromTo(img, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power1.out' });
    },

    /** Ajustes das imagens dos móveis (petConfig → furniture) viram variáveis CSS */
    applyFurniture() {
      const F = G.config.furniture || {};
      const s = this.el.style;
      const pct = (v) => (v * 100).toFixed(2) + '%';
      if (F.bed) s.setProperty('--bed-front', pct(F.bed.frontClip ?? 0.8));
      if (F.bathtub) {
        s.setProperty('--tub-front', pct(F.bathtub.frontClip ?? 0.39));
        const w = F.bathtub.water || {};
        s.setProperty('--water-top', pct(w.top ?? 0.285));
        s.setProperty('--water-left', pct(w.left ?? 0.07));
        s.setProperty('--water-right', pct(w.right ?? 0.07));
        s.setProperty('--water-h', pct(w.height ?? 0.17));
      }
      if (F.bowl) s.setProperty('--bowl-front', pct(F.bowl.frontClip ?? 0.47));
      if (F.bowl && F.bowl.food) {
        const f = F.bowl.food;
        s.setProperty('--food-left', pct(f.left ?? 0.17));
        s.setProperty('--food-top', pct(f.top ?? -0.36));
        s.setProperty('--food-w', pct(f.width ?? 0.66));
        s.setProperty('--food-h', pct(f.height ?? 0.66));
      }
    },

    /** client (tela) → coordenadas locais do quarto */
    toLocal(cx, cy) {
      const r = this.el.getBoundingClientRect();
      this.left = r.left; this.top = r.top;
      return { x: cx - r.left, y: cy - r.top };
    },

    /** Escala de profundidade (2.5D) para uma posição z do chão */
    depthScale(z) {
      const p = G.config.physics;
      const t = U.clamp(U.invLerp(this.geo.zMin, this.geo.zMax, z), 0, 1);
      return U.lerp(p.depthScaleBack, p.depthScaleFront, t);
    },

    inFootprint(name, x, z, pad = 0) {
      const f = this.zones[name];
      if (!f) return false;
      const x0 = (f.fx0 ?? f.x0) - pad, x1 = (f.fx1 ?? f.x1) + pad;
      const z0 = (f.fz0 ?? f.y0) - pad, z1 = (f.fz1 ?? f.y1) + pad;
      if (x < x0 || x > x1 || z < z0 || z > z1) return false;
      // elipse inscrita
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const nx = (x - cx) / ((x1 - x0) / 2), nz = (z - cz) / ((z1 - z0) / 2);
      return nx * nx + nz * nz <= 1.05;
    },

    /** "Em cima da caminha" do ponto de vista de quem solta o pet (área generosa) */
    nearBed(x, z) {
      const b = this.zones.bed;
      if (!b) return false;
      return x > b.x0 + b.w * 0.08 && x < b.x1 - b.w * 0.08 && z > b.y0 - this.petH * 0.22 && z < b.y1 + 8;
    },

    /** Ponto aleatório no chão, evitando banheira/cama/pote */
    randomFloorPoint(opts = {}) {
      const g = this.geo;
      const pad = this.petW * 0.25;
      for (let i = 0; i < 24; i++) {
        const x = U.rand(opts.x0 ?? g.minX, opts.x1 ?? g.maxX);
        const z = U.rand(opts.z0 ?? g.zMin + 8, opts.z1 ?? g.zMax - 6);
        if (this.inFootprint('tub', x, z, pad) || this.inFootprint('bed', x, z, 4)) continue;
        if (Math.abs(x - this.zones.bowl.cx) < this.zones.bowl.w * 0.6 && Math.abs(z - this.zones.bowl.cz) < 26) continue;
        return { x, z };
      }
      return { x: this.W / 2, z: (g.zMin + g.zMax) / 2 };
    },

    clampFloor(x, z) {
      const g = this.geo;
      return { x: U.clamp(x, g.minX, g.maxX), z: U.clamp(z, g.zMin, g.zMax) };
    }
  };

  G.room = room;
})(window.Game = window.Game || {});
