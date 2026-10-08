/* ==========================================================================
   REGISTRO CENTRAL DE ASSETS (tudo que não é imagem do pet)
   As imagens do pet ficam em petConfig.js → pet.images.
   Para trocar a arte de um objeto, troque o arquivo ou o caminho aqui.
   Caminhos são relativos ao index.html (funciona em subpastas e via file://).
   ========================================================================== */
(function (G) {
  'use strict';

  G.assets = {
    environment: {
      window:   'assets/environment/window.svg',
      bed:      'assets/environment/bed.svg',
      bowl:     'assets/environment/bowl.svg',
      tubBack:  'assets/environment/tub-back.svg',
      tubFront: 'assets/environment/tub-front.svg',
      plant:    'assets/environment/plant.svg',
      radio:    'assets/environment/radio.svg',
      lamp:     'assets/environment/lamp.svg',
      shelf:    'assets/environment/shelf.svg',
      clock:    'assets/environment/clock.svg',
      picture:  'assets/environment/picture.svg',
      rugSun:   'assets/environment/rug-sun.svg',
      rugWave:  'assets/environment/rug-wave.svg',
      rugCheck: 'assets/environment/rug-check.svg'
    },
    food: {
      kibble:  'assets/food/kibble.svg',
      treat:   'assets/food/treat.svg',
      special: 'assets/food/special.svg'
    },
    toys: {
      ball:  'assets/toys/ball.svg',
      yarn:  'assets/toys/yarn.svg',
      mouse: 'assets/toys/mouse.svg',
      laser: 'assets/toys/laser.svg'
    },
    accessories: {
      bandana:  'assets/accessories/bandana.svg',
      bow:      'assets/accessories/bow.svg',
      glasses:  'assets/accessories/glasses.svg',
      partyHat: 'assets/accessories/party-hat.svg',
      crown:    'assets/accessories/flower-crown.svg'
    }
  };

  /** Resolve "grupo.chave" → caminho. Ex.: G.asset('toys.ball') */
  G.asset = function (path) {
    const [group, key] = path.split('.');
    const src = G.assets[group] && G.assets[group][key];
    if (!src) console.warn('[assets] não encontrado:', path);
    return src || '';
  };
})(window.Game = window.Game || {});
