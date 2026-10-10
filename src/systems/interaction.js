/* ==========================================================================
   INTERAÇÃO — Pointer Events (mouse, touch e caneta com a MESMA lógica)
   --------------------------------------------------------------------------
   Um único listener no quarto descobre o que foi tocado ([data-hit]) e
   entrega para o "handler" daquele tipo. Cada handler devolve um gesto
   { move, up, cancel }. Sistemas novos só precisam registrar um handler:
       G.interaction.register('meuObjeto', { down(pt, e, el) { ...; return gesto } })
   Nada depende de hover.
   ========================================================================== */
(function (G) {
  'use strict';
  const U = G.util;

  const handlers = {};
  let override = null;       // ex.: modo banho captura o toque
  let active = null;
  let roomEl = null;
  let lastActivity = Date.now();

  // posição do quarto na tela: medida no começo de cada gesto (e ao redimensionar),
  // não a cada movimento do dedo — getBoundingClientRect em todo pointermove
  // força o navegador a recalcular estilos dezenas de vezes por segundo
  let roomRect = null;
  function measureRoom() {
    const r = roomEl.getBoundingClientRect();
    roomRect = { left: r.left, top: r.top };
    G.room.left = r.left; G.room.top = r.top;
  }
  function local(e) {
    if (!roomRect) measureRoom();
    return { x: e.clientX - roomRect.left, y: e.clientY - roomRect.top };
  }

  /** O ponto está sobre o corpo do pet? (caixa encolhida, ignora as bordas transparentes) */
  function petUnder(pt) {
    const P = G.physics.P;
    const s = G.room.depthScale(P.z);
    const w = G.room.petW * s, h = G.room.petH * s;
    const bottom = P.z - P.h, top = bottom - h * 0.92;
    return pt.x > P.x - w * 0.36 && pt.x < P.x + w * 0.36 && pt.y > top && pt.y < bottom;
  }

  function onDown(e) {
    if (active) return;                          // ignora o segundo dedo
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const t = e.target;
    if (t.closest('.hud, .food-menu, .bath-tool, .sheet, .sheet-backdrop, .needs-panel, .vol-pop')) return;

    measureRoom();
    const pt = local(e);
    lastActivity = Date.now();
    G.bus.emit('user:activity', { pt });

    let gesture = null;
    let hitEl = t.closest('[data-hit]');
    // brinquedos e o pet têm prioridade sobre móveis (podem estar parcialmente atrás deles)
    if (!hitEl || (hitEl.dataset.hit !== 'pet' && hitEl.dataset.hit !== 'toy' && hitEl.dataset.hit !== 'bubble')) {
      const toy = G.play && G.play.toyAt(pt.x, pt.y);
      if (toy && !toy.el.contains(t)) hitEl = toy.el;
      else if (petUnder(pt)) hitEl = document.getElementById('pet');
    }
    const kind = hitEl ? hitEl.dataset.hit : 'room';

    if (override) gesture = override.down(pt, e, hitEl, kind);
    if (!gesture && handlers[kind]) gesture = handlers[kind].down(pt, e, hitEl);
    if (!gesture && kind !== 'room' && handlers.room) gesture = handlers.room.down(pt, e, null);
    if (!gesture) return;

    active = { id: e.pointerId, g: gesture };
    try { roomEl.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
    if (e.cancelable) e.preventDefault();
  }

  function onMove(e) {
    if (!active || e.pointerId !== active.id) return;
    const g = active.g;
    if (!g.move) return;
    // eventos agrupados (telas de 120 Hz, caneta): os intermediários só servem
    // para medir a velocidade do arremesso; o gesto anda com o último
    if (g.sample && e.getCoalescedEvents) {
      const list = e.getCoalescedEvents();
      for (let i = 0; i < list.length - 1; i++) g.sample(local(list[i]), list[i]);
    }
    g.move(local(e), e);
  }

  function onEnd(e, cancelled) {
    if (!active || e.pointerId !== active.id) return;
    const g = active.g;
    active = null;
    lastActivity = Date.now();
    if (cancelled && g.cancel) g.cancel(local(e), e);
    else if (g.up) g.up(local(e), e);
  }

  /* ---------------- PET: tocar / segurar (carinho) / arrastar ---------------- */
  const petHandler = {
    down(pt) {
      const ps = G.petState;
      if (G.physics.mode === 'anchored') return null;
      const c = G.config.physics;
      const start = { x: pt.x, y: pt.y, t: U.now() };
      let lifted = false;
      let petting = false;
      let stroke = 0;
      let prev = pt;
      let threshold = c.dragThreshold;

      G.physics.press(pt);
      ps.setPhysical('beingHeld');
      G.bus.emit('pet:press', { pt });

      const holdTimer = setTimeout(() => {
        if (lifted) return;
        petting = true;
        threshold = 26;   // durante o carinho, dá pra "alisar" sem levantar
        G.bus.emit('pet:pettingStart');
      }, 480);

      const finish = (cancelled) => {
        clearTimeout(holdTimer);
        // marca "no ar" ANTES de soltar: o pouso pode acontecer na mesma hora
        if (lifted) ps.setPhysical('airborne');
        const r = G.physics.release();
        if (lifted) {
          if (G.physics.isIdle() && ps.physical === 'airborne') ps.setPhysical(null);
          G.bus.emit('pet:release', r || {});
        } else {
          ps.setPhysical(null);
          if (petting) G.bus.emit('pet:pettingEnd', { stroke, duration: U.now() - start.t });
          else if (!cancelled) G.bus.emit('pet:tap', { pt, duration: U.now() - start.t });
        }
      };

      let prevT = U.now();
      return {
        sample(p, e) { G.physics.sample(p, e && e.timeStamp); },
        move(p, e) {
          if (!lifted) {
            const d = U.dist(p.x, p.y, start.x, start.y);
            const now = U.now();
            const step = U.dist(p.x, p.y, prev.x, prev.y);
            const speed = step / Math.max(0.008, (now - prevT) / 1000);
            if (petting) { stroke += step; G.bus.emit('pet:stroke', { stroke }); }
            prev = p; prevT = now;
            // no carinho dá para "alisar" sem levantar… mas puxar para cima ou
            // arrastar rápido levanta na hora (antes ficava preso até 30 px)
            const pulling = petting && (start.y - p.y > 14 || (speed > 900 && d > 14));
            if (d > threshold || pulling) {
              lifted = true;
              clearTimeout(holdTimer);
              if (petting) { petting = false; G.bus.emit('pet:pettingEnd', { stroke, interrupted: true }); }
              G.physics.lift();
              ps.setPhysical('beingDragged');
              G.haptic(8);
              G.bus.emit('pet:lift');
            }
          }
          G.physics.dragTo(p, e && e.timeStamp);
        },
        up() { finish(false); },
        cancel() { finish(true); }
      };
    }
  };

  /* ---------------- toque no chão/parede vazios ---------------- */
  const roomHandler = {
    down(pt) {
      const start = { ...pt, t: U.now() };
      return {
        up(p) {
          if (U.dist(p.x, p.y, start.x, start.y) > 14 || U.now() - start.t > 500) return;
          G.fx.spawn('ring', p.x, p.y, { scale: 1.4 });
          G.bus.emit('room:tap', { x: p.x, y: p.y });
        }
      };
    }
  };

  const interaction = {
    init() {
      roomEl = document.getElementById('room');
      roomEl.addEventListener('pointerdown', onDown);
      roomEl.addEventListener('pointermove', onMove);
      roomEl.addEventListener('pointerup', (e) => onEnd(e, false));
      roomEl.addEventListener('pointercancel', (e) => onEnd(e, true));
      roomEl.addEventListener('lostpointercapture', (e) => onEnd(e, true));
      roomEl.addEventListener('contextmenu', (e) => e.preventDefault());
      // impede gestos de zoom/scroll do navegador dentro do jogo (iOS)
      document.addEventListener('gesturestart', (e) => e.preventDefault());
      document.addEventListener('touchmove', (e) => { if (!e.target.closest('.sheet, .vol-pop, input[type="range"]')) e.preventDefault(); }, { passive: false });

      this.register('pet', petHandler);
      this.register('room', roomHandler);
      this.register('bubble', { down: (pt, e, el) => { G.fx.pop(el); return { up() {} }; } });

      // acessibilidade: Enter/Espaço nos objetos (click de teclado tem detail 0)
      roomEl.addEventListener('click', (e) => {
        if (e.detail !== 0) return;
        const el = e.target.closest('[data-hit]');
        if (!el) return;
        const h = handlers[el.dataset.hit];
        if (h && h.keyboard) h.keyboard(el);
        else if (el.dataset.hit === 'pet') G.bus.emit('pet:tap', { pt: G.physics.anchorPoint('top') });
      });

      G.bus.on('physics:settled', () => {
        if (G.petState.physical === 'airborne') G.petState.setPhysical(null);
      });
      G.bus.on('room:resize', () => { roomRect = null; });
    },

    register(kind, handler) { handlers[kind] = handler; },

    /** Captura temporária de todos os toques (banho…) */
    setOverride(h) { override = h; },
    clearOverride(h) { if (!h || override === h) override = null; },

    /** Handler simples de toque (+ toque longo opcional) */
    tap(onTap, opts = {}) {
      return {
        keyboard: (el) => { const r = G.room.rectOf(el); onTap({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 }, el); },
        down(pt, e, el) {
          const start = { ...pt, t: U.now() };
          let longDone = false;
          const lt = opts.onLong ? setTimeout(() => { longDone = true; opts.onLong(pt, el); }, opts.longMs || 650) : 0;
          if (opts.onPress) opts.onPress(pt, el);
          return {
            move(p) { if (U.dist(p.x, p.y, start.x, start.y) > 16) clearTimeout(lt); },
            up(p) {
              clearTimeout(lt);
              if (longDone) return;
              if (U.dist(p.x, p.y, start.x, start.y) > 16) return;
              onTap(p, el);
            },
            cancel() { clearTimeout(lt); }
          };
        }
      };
    },

    get isActive() { return !!active; },
    get idleMs() { return Date.now() - lastActivity; },
    touch() { lastActivity = Date.now(); }
  };

  G.interaction = interaction;
})(window.Game = window.Game || {});
