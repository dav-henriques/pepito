/* ==========================================================================
   SAVE AUTOMÁTICO (localStorage)
   Cada sistema registra um "provedor" com get()/set(). O save junta tudo.
   Para salvar algo novo: G.save.register('minhaChave', { get, set }).
   Não existe botão de salvar: salva sozinho em mudanças, a cada X segundos,
   e ao sair/minimizar a página.
   ========================================================================== */
(function (G) {
  'use strict';

  const providers = new Map();
  let loaded = null;
  let dirtyTimer = 0;
  let ready = false;

  function storage() {
    try { return window.localStorage; } catch (e) { return null; }
  }

  G.save = {
    /** Registra um provedor de dados. set() é chamado com o que foi salvo antes. */
    register(key, provider) {
      providers.set(key, provider);
      if (loaded && loaded.data && key in loaded.data) {
        try { provider.set(loaded.data[key]); } catch (e) { console.warn('[save] falha ao restaurar', key, e); }
      }
    },

    /** Lê o save (uma vez, no boot). Retorna { data, elapsedMs, isNew } */
    load() {
      const cfg = G.config.save;
      let raw = null;
      try { raw = storage()?.getItem(cfg.key); } catch (e) { /* modo privado */ }
      let parsed = null;
      if (raw) {
        try { parsed = JSON.parse(raw); } catch (e) { console.warn('[save] corrompido, ignorando'); }
      }
      if (parsed && parsed.version !== cfg.version) parsed = this.migrate(parsed);
      const now = Date.now();
      const last = parsed?.timestamp || now;
      loaded = {
        data: parsed?.data || null,
        elapsedMs: Math.max(0, now - last),
        isNew: !parsed,
        lastTimestamp: last
      };
      return loaded;
    },

    /** Ponto de extensão: converter saves antigos quando a estrutura mudar */
    migrate(old) {
      return old;
    },

    collect() {
      const data = {};
      for (const [key, p] of providers) {
        try { data[key] = p.get(); } catch (e) { console.warn('[save] falha ao coletar', key, e); }
      }
      return { version: G.config.save.version, timestamp: Date.now(), data };
    },

    now() {
      if (!ready) return;
      clearTimeout(dirtyTimer);
      try {
        storage()?.setItem(G.config.save.key, JSON.stringify(this.collect()));
      } catch (e) { /* cota cheia / modo privado: o jogo continua funcionando */ }
    },

    /** Marca que algo mudou → salva em breve (com debounce) */
    soon(ms = 1500) {
      if (!ready) return;
      clearTimeout(dirtyTimer);
      dirtyTimer = setTimeout(() => this.now(), ms);
    },

    start() {
      ready = true;
      setInterval(() => this.now(), G.config.save.autosaveEvery);
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.now(); });
      window.addEventListener('pagehide', () => this.now());
      window.addEventListener('beforeunload', () => this.now());
      G.bus.on('save:soon', () => this.soon());
    },

    reset() {
      ready = false;
      try { storage()?.removeItem(G.config.save.key); } catch (e) { /* ok */ }
      location.reload();
    },

    get loaded() { return loaded; }
  };
})(window.Game = window.Game || {});
