/* ==========================================================================
   QUARTO — medidas, zonas e profundidade.
   As posições dos móveis vêm do CSS; aqui elas são medidas e viram "zonas"
   (cama, banheira, pote…) usadas pela física e pelo comportamento.
   Mover um móvel no CSS atualiza tudo automaticamente.
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  // Faixa "andável" do chão, em fração da altura do quarto
  const GEO = { zMin: 0.612, zMax: 0.945, topMargin: 0.015 };

  const room = {
    el: null,
    world: null,
    W: 375,
    H: 740,
    u: 3.75,
    petW: 128,
    petH: 128,
    left: 0,
    top: 0,
    geo: {},
    zones: {},

    init() {
      this.el = document.getElementById('room');
      this.world = document.getElementById('world');
      // Caminhos de imagens vindos do registro central (assets.js)
      for (const img of U.$$('img[data-asset]')) img.src = G.asset(img.dataset.asset);
      this.measure();
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

      const s = this.el.style;
      s.setProperty('--u', this.u.toFixed(3) + 'px');
      s.setProperty('--pet-w', this.petW.toFixed(1) + 'px');
      s.setProperty('--pet-h', this.petH.toFixed(1) + 'px');

      const margin = this.petW * 0.36;
      this.geo = {
        zMin: this.H * GEO.zMin,
        zMax: this.H * GEO.zMax,
        minX: margin,
        maxX: this.W - margin,
        top: this.H * GEO.topMargin,
        floorTop: this.H * 0.556
      };
      this.measureZones();
    },

    rectOf(el) {
      const r = el.getBoundingClientRect();
      return { x0: r.left - this.left, y0: r.top - this.top, x1: r.right - this.left, y1: r.bottom - this.top, w: r.width, h: r.height };
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

      const plant = this.rectOf(q('.plant'));
      z.plant = { ...plant, cx: (plant.x0 + plant.x1) / 2, cz: plant.y1 - 4 };

      const rug = this.rectOf(q('.rug'));
      z.rug = { ...rug, cx: (rug.x0 + rug.x1) / 2, cz: (rug.y0 + rug.y1) / 2 };

      const win = this.rectOf(q('.window'));
      z.window = { ...win, cx: (win.x0 + win.x1) / 2, cy: (win.y0 + win.y1) / 2 };

      const radio = this.rectOf(q('.radio'));
      z.radio = { ...radio, cx: (radio.x0 + radio.x1) / 2, cy: (radio.y0 + radio.y1) / 2 };

      const lamp = this.rectOf(q('.lamp'));
      z.lamp = { ...lamp, cx: (lamp.x0 + lamp.x1) / 2, cy: lamp.y1 };

      this.zones = z;

      // profundidade dos móveis (quem está mais "na frente" fica por cima)
      q('.bed').style.zIndex = Math.round(bed.y0 + bed.h * 0.3);
      q('.bed-front').style.zIndex = Math.round(bed.y1) + 2;
      q('.plant').style.zIndex = Math.round(plant.y1);
      q('.bowl').style.zIndex = Math.round(bowl.y1);
      q('.tub-back').style.zIndex = Math.round(tub.y0 + tub.h * 0.3);
      q('.tub-front').style.zIndex = Math.round(tub.y1) + 2;
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

    /** Ponto aleatório no chão, evitando banheira/pote/planta */
    randomFloorPoint(opts = {}) {
      const g = this.geo;
      const pad = this.petW * 0.25;
      for (let i = 0; i < 24; i++) {
        const x = U.rand(opts.x0 ?? g.minX, opts.x1 ?? g.maxX);
        const z = U.rand(opts.z0 ?? g.zMin + 8, opts.z1 ?? g.zMax - 6);
        if (this.inFootprint('tub', x, z, pad) || this.inFootprint('bed', x, z, 4)) continue;
        if (Math.abs(x - this.zones.bowl.cx) < this.zones.bowl.w * 0.6 && Math.abs(z - this.zones.bowl.cz) < 26) continue;
        if (x < this.zones.plant.x1 && z < this.zones.plant.y1 + 14) continue;
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
