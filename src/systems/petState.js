/* ==========================================================================
   SISTEMA CENTRAL DE ESTADOS
   --------------------------------------------------------------------------
   O pet tem 4 "camadas" de estado ativas ao mesmo tempo:
     physical  → beingHeld / beingDragged / airborne     (física, temporário)
     activity  → sleeping / eating / bathing / playing    (exclusivas)
     emotion   → happy / excited / clean / grumpy / dizzy… (com duração)
     condition → derivada das necessidades (hungry, dirty, tired, sad…)
   O estado EXIBIDO é o de maior prioridade que tenha imagem.
   Para criar um estado novo: adicione em STATES (prioridade + imagem + humor)
   e uma imagem em petConfig.pet.images.
   ========================================================================== */
(function (G) {
  'use strict';

  /* prioridade: maior vence.  image: chave em pet.images (null = deixa passar)
     mood: nome da animação idle (GSAP) em animation.js */
  const STATES = {
    dizzy:        { priority: 120, image: 'dizzy',      mood: 'dizzy' },
    beingDragged: { priority: 100, image: 'held',       mood: 'held' },
    airborne:     { priority: 98,  image: 'held',       mood: 'none' },
    beingHeld:    { priority: 97,  image: null,         mood: null },     // apenas pressionado: mantém expressão atual
    bathing:      { priority: 90,  image: 'bathing',    mood: 'bathing' },
    eating:       { priority: 85,  image: 'eating',     mood: 'eating' },
    sleeping:     { priority: 80,  image: 'sleeping',   mood: 'sleeping' },
    grumpy:       { priority: 74,  image: 'grumpy',     mood: 'grumpy' },
    clean:        { priority: 73,  image: 'clean',      mood: 'happy' },
    excited:      { priority: 72,  image: 'excited',    mood: 'excited' },
    happy:        { priority: 70,  image: 'happy',      mood: 'happy' },
    sadEmote:     { priority: 69,  image: 'sad',        mood: 'sad' },
    playing:      { priority: 60,  image: 'playful',    mood: 'playful' },
    veryHungry:   { priority: 50,  image: 'veryHungry', mood: 'weak' },
    veryDirty:    { priority: 48,  image: 'veryDirty',  mood: 'itchy' },
    tired:        { priority: 45,  image: 'tired',      mood: 'tired' },
    hungry:       { priority: 40,  image: 'hungry',     mood: 'normal' },
    dirty:        { priority: 38,  image: 'dirty',      mood: 'itchy' },
    sad:          { priority: 35,  image: 'sad',        mood: 'sad' },
    playful:      { priority: 20,  image: 'playful',    mood: 'playful' },
    normal:       { priority: 0,   image: 'normal',     mood: 'normal' }
  };

  const layers = {
    physical: null,
    activity: null,
    emotion: null,
    condition: 'normal'
  };
  let emotionTimer = 0;
  let display = { state: 'normal', image: 'normal', mood: 'normal' };
  let activitySince = 0;

  function computeCondition() {
    const n = G.needs;
    const t = G.config.needs.thresholds;
    if (!n) return 'normal';
    const v = n.all();
    // ordem = prioridade entre necessidades
    if (v.hunger < t.veryHungry) return 'veryHungry';
    if (v.cleanliness < t.veryDirty) return 'veryDirty';
    if (v.energy < t.tired) return 'tired';
    if (v.hunger < t.hungry) return 'hungry';
    if (v.cleanliness < t.dirty) return 'dirty';
    if (v.happiness < t.sad) return 'sad';
    if (v.happiness > t.playful && v.energy > t.playful) return 'playful';
    return 'normal';
  }

  function resolve() {
    const candidates = [layers.physical, layers.emotion, layers.activity, layers.condition, 'normal'].filter(Boolean);
    let best = null;
    for (const name of candidates) {
      const def = STATES[name];
      if (!def || !def.image) continue;
      if (!best || def.priority > STATES[best].priority) best = name;
    }
    best = best || 'normal';
    const def = STATES[best];
    const next = { state: best, image: def.image, mood: def.mood };
    if (next.state !== display.state || next.image !== display.image) {
      const prev = display;
      display = next;
      G.bus.emit('state:display', { display, prev, layers: { ...layers } });
    }
  }

  const petState = {
    STATES,

    init() {
      G.save.register('state', {
        get: () => ({ activity: layers.activity === 'sleeping' ? 'sleeping' : null }),
        set: (d) => { if (d?.activity === 'sleeping') { layers.activity = 'sleeping'; activitySince = Date.now(); } }
      });
      layers.condition = computeCondition();
      G.bus.on('needs:change', () => this.refreshCondition());
      resolve();
    },

    refreshCondition() {
      const c = computeCondition();
      if (c !== layers.condition) {
        const prev = layers.condition;
        layers.condition = c;
        G.bus.emit('state:condition', { condition: c, prev });
      }
      resolve();
    },

    /* ---------------- camadas ---------------- */
    setPhysical(name) {
      if (layers.physical === name) return;
      layers.physical = name;
      G.bus.emit('state:physical', name);
      resolve();
    },

    setActivity(name) {
      if (layers.activity === name) return;
      const prev = layers.activity;
      layers.activity = name;
      activitySince = Date.now();
      G.bus.emit('state:activity', { activity: name, prev });
      G.save.soon();
      resolve();
    },

    /** Emoção temporária: petState.emote('happy', 2500) */
    emote(name, ms = 2200) {
      if (!STATES[name]) return;
      // tontura não é interrompida por emoções mais leves
      if (layers.emotion === 'dizzy' && name !== 'dizzy') return;
      layers.emotion = name;
      clearTimeout(emotionTimer);
      emotionTimer = setTimeout(() => { layers.emotion = null; resolve(); G.bus.emit('state:emotionEnd', name); }, ms);
      G.bus.emit('state:emotion', name);
      resolve();
    },

    clearEmotion() {
      clearTimeout(emotionTimer);
      layers.emotion = null;
      resolve();
    },

    /* ---------------- consultas ---------------- */
    get activity() { return layers.activity; },
    get physical() { return layers.physical; },
    get emotion() { return layers.emotion; },
    get condition() { return layers.condition; },
    get display() { return display; },
    get activityAge() { return Date.now() - activitySince; },

    is(name) {
      return layers.physical === name || layers.activity === name || layers.emotion === name || layers.condition === name;
    },

    isAsleep() { return layers.activity === 'sleeping'; },
    isHeld() { return layers.physical === 'beingHeld' || layers.physical === 'beingDragged'; },

    /** Regras de transição: o que o pet pode fazer agora? */
    can(action) {
      const a = layers.activity, p = layers.physical;
      const n = G.needs;
      switch (action) {
        case 'autonomous': return !p && !a && G.physics.isIdle();
        case 'play': return !p && a !== 'sleeping' && a !== 'eating' && a !== 'bathing' && n.get('energy') > G.config.play.minEnergyToPlay;
        case 'eat': return !p && a !== 'sleeping' && a !== 'bathing';
        case 'walk': return !p && a !== 'sleeping' && a !== 'bathing' && a !== 'eating';
        case 'bathe': return a !== 'eating';
        case 'notice': return a !== 'sleeping' && a !== 'bathing';
        default: return true;
      }
    }
  };

  G.petState = petState;
})(window.Game = window.Game || {});
