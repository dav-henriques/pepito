/* ==========================================================================
   CONTEÚDO PESSOAL — os nomes de vocês dois
   --------------------------------------------------------------------------
   Este arquivo NÃO tem lógica de jogo: só textos e nomes. Dá para
   personalizar tudo sem entender o JavaScript.

   CONVENÇÃO: todo texto entre [COLCHETES MAIÚSCULOS] é um PLACEHOLDER.
   Troque pelo seu (pode apagar os colchetes). Para achar o que falta,
   procure por "[" neste arquivo.

   As imagens ficam em assets/ e os caminhos em src/config/assets.js.
   ========================================================================== */
(function (G) {
  'use strict';

  G.personal = {

    petName: 'Pepito',
    playerName: 'Sarah',          // quem vai jogar (aparece no caderninho)
    madeBy: '[SEU NOME]',         // assinatura no caderninho

    // O pet não fala: ele se expressa com símbolos (z, ♥, ♪, !, ?…).
    // Os símbolos de cada momento ficam em src/systems/expressions.js.

    /* Comida personalizada (aparece no pote, ao lado de ração/petisco/especial) */
    foods: {
      food01: { name: '[COMIDA FAVORITA DELE]' }
    },

    /* ----------------------------------------------------------------------
       BRINQUEDOS — nome e se aparece no quarto.
       showName: mostra uma etiqueta com o nome quando você toca nele.
       ---------------------------------------------------------------------- */
    toys: {
      ball:  { name: 'bolinha' },
      yarn:  { name: 'novelo' },
      mouse: { name: 'ratinho de corda' },
      plush: { name: '[NOME DA PELÚCIA]', showName: true, enabled: true },
      toy01: { name: '[BRINQUEDO COM NOME ENGRAÇADO]', showName: true, enabled: true },
      toy02: { name: '[BRINQUEDO 02]', showName: true, enabled: false },
      toy03: { name: '[BRINQUEDO 03]', showName: true, enabled: false }
    },

    /* Como o pet reage quando você aproxima a pelúcia (pesos: maior = mais comum) */
    plushieReactions: { sniff: 4, ignore: 3, hug: 2, attack: 2 }
  };
})(window.Game = window.Game || {});
