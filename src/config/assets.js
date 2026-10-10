/* ==========================================================================
   REGISTRO CENTRAL DE ASSETS — o ÚNICO lugar com caminhos de arquivos
   --------------------------------------------------------------------------
   Cada "referência" (ex.: 'room.bed') aponta para um arquivo.
   O resto do jogo só conhece as referências, nunca os caminhos.

   >>> Para trocar uma imagem: substitua o arquivo MANTENDO O MESMO NOME.
       Nenhuma linha de código precisa mudar.
   >>> Se o seu arquivo tiver outro nome/extensão (ex.: .webp ou .jpg),
       troque só o caminho aqui.
   >>> Se um arquivo faltar ou não carregar, o jogo usa uma alternativa
       (fallback) e continua funcionando.

   Todos os objetos usam o mesmo esquema do gato: PNG com fundo transparente
   (recortado) fica perfeito; a sombra no chão é do jogo.
   Caminhos são relativos ao index.html (funciona em subpastas e via file://).
   ========================================================================== */
(function (G) {
  'use strict';

  G.assets = {

    /* ----------------------------------------------------------------------
       PET — uma foto por expressão (JPG quadrado 512×512).
       As fotos sem fundo transparente viram um "cartão de foto" em pé no chão.
       Para trocar uma: substitua o arquivo mantendo o nome (de preferência
       quadrado; o jogo recorta o resto). Se um arquivo não existir, o jogo
       usa a alternativa de petConfig → imageFallbacks.
       ---------------------------------------------------------------------- */
    pet: {
      normal:     'assets/pet/normal.jpg',
      happy:      'assets/pet/happy.jpg',
      hungry:     'assets/pet/hungry.jpg',
      sleepy:     'assets/pet/sleepy.jpg',
      angry:      'assets/pet/angry.jpg',
      confused:   'assets/pet/confused.jpg',
      excited:    'assets/pet/excited.jpg',
      eating:     'assets/pet/eating.jpg',
      bathing:    'assets/pet/bathing.jpg',
      dirty:      'assets/pet/dirty.jpg',
      clean:      'assets/pet/clean.jpg',
      beingHeld:  'assets/pet/being-held.jpg',   // no colo / sendo arrastado — AINDA FALTA (usa excited)
      sleeping:   'assets/pet/sleeping.jpg',
      sillyPose:  'assets/pet/silly-pose.jpg',   // pose absurda espontânea
      staring:    'assets/pet/staring.jpg',      // encarando você sem motivo
      flying:     'assets/pet/flying.jpg',       // arremessado / caindo
      sad:        'assets/pet/sad.jpg',
      dizzy:      'assets/pet/dizzy.jpg',        // depois de ser chacoalhado
      playful:    'assets/pet/playful.jpg',
      veryHungry: 'assets/pet/very-hungry.jpg',
      veryDirty:  'assets/pet/very-dirty.jpg'
    },

    /* ----------------------------------------------------------------------
       MÓVEIS DO CHÃO (cada um é uma imagem, como o gato)
       Cama e banheira: o jogo usa a MESMA imagem duas vezes (atrás e na
       frente do pet) para ele parecer "dentro". Quanto da imagem fica na
       frente é ajustável em petConfig → furniture.
       ---------------------------------------------------------------------- */
    room: {
      bed:     'assets/room/bed.png',
      bowl:    'assets/room/bowl.png',
      bathtub: 'assets/room/bathtub.png',
      // OPCIONAL: foto de um ambiente de verdade atrás de tudo (parede + chão).
      // Sem o arquivo, o quarto é uma colagem de papel (parede clara + chão de
      // papel kraft). Com a foto, ajuste o chão em petConfig → room.
      background: 'assets/room/background.jpg'
    },

    food: {
      kibble:  'assets/food/kibble.png',
      treat:   'assets/food/treat.png',
      special: 'assets/food/special.png',
      food01:  'assets/food/food-01.png'    // comida favorita (nome em personal.js)
    },

    toys: {
      ball:    'assets/toys/ball.png',
      yarn:    'assets/toys/yarn.png',
      mouse:   'assets/toys/mouse.png',
      plushie: 'assets/toys/plushie.png',   // pelúcia
      toy01:   'assets/toys/toy-01.png',    // brinquedo com nome engraçado
      toy02:   'assets/toys/toy-02.png',    // (desligado — ligue em personal.js → toys)
      toy03:   'assets/toys/toy-03.png'     // (desligado — ligue em personal.js → toys)
    },

    /* ----------------------------------------------------------------------
       EFEITOS SONOROS EM ARQUIVO (opcionais)
       Sem arquivo, o jogo usa o som sintetizado (WebAudio), então nada quebra.
       Cada lista são VARIAÇÕES: o jogo sorteia entre as que existirem.
       Ex.: grave 3 miados e use ['assets/sounds/meow.mp3', 'assets/sounds/meow-02.mp3', ...]
       Nomes disponíveis: meow, boing, land, thud, squeak, pop, munch, splash,
       hiss, yawn, sparkle, chime, squish… (veja SFX em src/systems/audio.js)
       ---------------------------------------------------------------------- */
    sfx: {
      meow: ['assets/sounds/meow.mp3']
    }
  };

  /** Lista de caminhos candidatos de uma referência ('grupo.chave', caminho ou lista) */
  G.assetList = function (ref) {
    if (!ref) return [];
    if (Array.isArray(ref)) return ref.flatMap((r) => G.assetList(r));
    if (typeof ref === 'object') return [ref.file, ...(ref.alt || []), ref.placeholder].filter(Boolean);
    if (ref.includes('/') || ref.startsWith('data:')) return [ref];   // já é um caminho
    const [group, key] = ref.split('.');
    const v = G.assets[group] && G.assets[group][key];
    if (v == null) { console.warn('[assets] referência não encontrada:', ref); return []; }
    return G.assetList(v);
  };

  /** Resolve "grupo.chave" → caminho (o primeiro candidato). Ex.: G.asset('toys.ball') */
  G.asset = function (ref) {
    return G.assetList(ref)[0] || '';
  };
})(window.Game = window.Game || {});
