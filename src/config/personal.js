/* ==========================================================================
   CONTEÚDO PESSOAL — os textos e nomes de vocês dois
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

    /* ----------------------------------------------------------------------
       FALAS DO PET (balão de texto)
       Cada momento tem uma lista; o jogo sorteia uma frase.
       Pode ter quantas frases quiser em cada lista. Lista vazia = não fala.
       ---------------------------------------------------------------------- */
    speech: {
      chance: 0.4,           // chance de falar quando acontece o momento (0–1)
      cooldown: 22000,       // tempo mínimo entre falas (ms)
      lines: {
        hello:        ['olais'],
        idle:         ['[FRASE INTERNA 01]', '[FRASE INTERNA 02]', '[FRASE INTERNA 03]'],
        hungry:       ['[PIADA SOBRE COMIDA]'],
        sleepy:       ['[FRASE QUE SÓ NÓS ENTENDEMOS]'],
        dirty:        ['[RECLAMAÇÃO SOBRE BANHO]'],
        petting:      ['[O QUE ELE DIRIA GANHANDO CARINHO]'],
        thrown:       ['AAAAAAAAAAAAA'],
        dizzy:        ['ta doida'],
        eating:       ['[COMENTÁRIO DE BOCA CHEIA]'],
        favoriteFood: ['[REAÇÃO À COMIDA FAVORITA]'],
        clean:        ['[FRASE DE QUEM SAIU DO BANHO]'],
        wakeUp:       ['bodia'],
        staring:      ['fica cueia'],
        sillyPose:    ['[LEGENDA DA POSE ABSURDA]'],
        ignoreToy:    ['[DESPREZO PELO BRINQUEDO]'],
        plushie:      ['[O QUE ELE ACHA DA PELÚCIA]'],
        annoyed:      ['[FRASE IRRITADO COM TANTO CUTUCÃO]'],
        startled:     ['AAAAAAAAAAAAA'],
        night:        ['bonoite']
      }
    },

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
