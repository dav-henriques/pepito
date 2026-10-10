/* ==========================================================================
   CONFIGURAÇÃO CENTRAL DO PET
   --------------------------------------------------------------------------
   As REGRAS do jogo moram aqui: ritmo das necessidades, física, comidas,
   comportamento, brinquedos… Ajuste valores à vontade.
   • Nome, falas do pet e nomes dos brinquedos → src/config/personal.js
   • Caminhos de imagens e sons               → src/config/assets.js
   ========================================================================== */
(function (G) {
  'use strict';

  G.config = {

    /* ----------------------------------------------------------------------
       IDENTIDADE + IMAGENS DO PET
       ----------------------------------------------------------------------
       >>> COLOQUE AS FOTOS DO GATO EM:  assets/pet/
       Os caminhos ficam em src/config/assets.js → pet (registro central).
       Substitua os arquivos mantendo os mesmos nomes (normal.jpg, happy.jpg…).

       Dicas para as fotos (veja também assets/LEIA-ME.md):
       - JPG quadrado (512×512) vira um "cartão de foto" em pé no chão.
       - PNG com fundo transparente (gato recortado) vira um adesivo recortado
         (para isso, troque a extensão do caminho em assets.js).
       - Não precisa ter o mesmo tamanho nem o mesmo enquadramento: com
         look.autoFit o jogo iguala o tamanho visual do gato entre as fotos.
       - Não precisa ter todas: se uma faltar, o jogo usa o fallback abaixo.
       ---------------------------------------------------------------------- */
    pet: {
      name: (G.personal && G.personal.petName) || 'Pepito',
      species: 'gato',

      images: G.assets.pet,

      // Se a imagem de uma chave não existir/falhar, tenta estas (em ordem).
      imageFallbacks: {
        veryHungry: ['hungry', 'sad'],
        veryDirty:  ['dirty'],
        clean:      ['happy'],
        playful:    ['excited', 'happy'],
        excited:    ['happy'],
        beingHeld:  ['excited', 'happy'],
        flying:     ['beingHeld', 'excited'],
        staring:    ['normal'],
        confused:   ['staring', 'normal'],
        sillyPose:  ['excited', 'happy'],
        dizzy:      ['confused', 'sad'],
        angry:      ['sad'],
        sleepy:     ['sleeping', 'sad'],
        bathing:    ['clean', 'happy'],
        eating:     ['happy'],
        '*':        ['normal']             // último recurso para qualquer chave
      },

      /* Visual de "recorte de foto" (feito no navegador, sem editar os arquivos).
         Quando o jogo roda num servidor (ou hospedado), as imagens são
         processadas num canvas: contorno de adesivo, sombra e tamanho igualado.
         Abrindo o index.html direto (file://), o navegador não deixa ler os
         pixels: aí o contorno vem do CSS e o autoFit fica desligado. */
      look: {
        process: true,          // processar as imagens no canvas quando possível
        autoFit: true,          // iguala o tamanho visual do gato entre as fotos
        targetFill: 0.3461,     // fração da imagem ocupada pelo gato (maior = gato maior)
        maxUpscale: 1.6,        // limite do autoFit
        outline: false,         // contorno branco de adesivo (gato, móveis e brinquedos recortados)
        outlineColor: '#ffffff',
        outlineWidth: 7,        // px numa imagem de 512
        outlineEdge: 0.22,      // fiozinho em volta do contorno, 0–1 (aparece no fundo branco; 0 = sem)
        shadow: true,           // sombra suave grudada no recorte
        frameOpaque: true,      // foto SEM transparência vira um cartão de foto em pé
        cardBorder: false,      // borda branca em volta dos cartões de foto
        cardFill: 0.92          // quanto da caixa do pet o cartão de foto ocupa (0–1)
      },

      /* Ajuste fino por imagem (aplicado depois do autoFit):
         scale (1 = igual), x / y (fração da caixa, ex.: 0.05), rotate (graus),
         flip: true (espelha — útil se numa foto ele olha para o outro lado),
         fit: false (desliga o autoFit só nessa imagem).
         Ex.: sleeping: { scale: 0.92, y: 0.02 }  ·  angry: { rotate: -3 }
         (as fotos ficam retas por padrão: qualquer giro fixo soma com a física) */
      imageTweaks: {},

      // Para qual lado o pet "olha" nas imagens: 1 = direita, -1 = esquerda.
      facing: 1,
      // Espelhar a imagem quando ele vira para o outro lado?
      // 'auto' = só gato recortado (PNG transparente); foto nunca espelha.
      flipWhenWalking: 'auto',

      // Tamanho do pet em "unidades do quarto" (1u ≈ 1% da largura do quarto)
      size: 38,
      minSizePx: 116,
      maxSizePx: 196,

      // Fração da altura da imagem que fica ABAIXO dos pés (margem transparente).
      footOffset: 0.02,

      // Onde ficam cabeça/olhos/pescoço na imagem (frações 0–1 da caixa do pet).
      // Usado para balões, partículas e acessórios. Com cartões de foto, o
      // cartão ocupa quase a caixa toda: "top" fica logo acima dele.
      anchors: {
        head: { x: 0.50, y: 0.22 },
        eyes: { x: 0.50, y: 0.42 },
        neck: { x: 0.50, y: 0.70 },
        mouth: { x: 0.50, y: 0.56 },
        top:  { x: 0.50, y: 0.03 }
      },
      // Ajuste fino dos anchors por estado (ex.: { sleeping: { y: 0.06 } })
      anchorOffsets: {}
    },

    /* ----------------------------------------------------------------------
       NECESSIDADES (0–100). 100 = totalmente satisfeito.
       ---------------------------------------------------------------------- */
    needs: {
      initial: { hunger: 52, happiness: 66, energy: 82, cleanliness: 48 },

      // Quanto cada necessidade cai POR HORA com o jogo aberto.
      decayPerHour: { hunger: 14, happiness: 7, energy: 8, cleanliness: 9 },

      // Dormindo: recupera energia e gasta menos fome.
      sleepingPerHour: { energy: +55, hunger: -6, happiness: +2 },

      // Multiplicadores de humor: fome/sujeira deixam o pet triste mais rápido.
      sadnessFromHunger: 1.6,
      sadnessFromDirt: 1.3,
      nightEnergyMultiplier: 1.5,

      // Limiares que viram estados (abaixo do valor → estado ativo)
      thresholds: {
        hungry: 40, veryHungry: 18,
        dirty: 40, veryDirty: 18,
        tired: 28, exhausted: 10,  // exhausted = dorme sozinho onde estiver
        sad: 30,
        playful: 72                // felicidade E energia acima disso → brincalhão
      }
    },

    /* ----------------------------------------------------------------------
       FÍSICA PERCEBIDA (implementada com Anime.js em src/systems/physics.js)
       Unidades: px e segundos. Valores maiores = efeito mais forte.
       ---------------------------------------------------------------------- */
    physics: {
      intensity: 1,              // multiplicador geral (0.5 = mais contido, 1.5 = mais exagerado)

      // Acompanhar o dedo (Anime.js createAnimatable)
      followLag: 95,             // ms de atraso pet ↔ dedo (sensação de peso)
      followEase: 'out(3)',
      liftHeight: 16,            // quanto o pet "sobe" ao ser pego
      dragThreshold: 7,          // px até considerar arraste (abaixo disso é toque)
      rubberBand: 0.18,          // resistência ao arrastar além da parede

      // Inclinação e deformação durante o arraste
      tiltPerSpeed: 0.022,       // graus por px/s
      maxTilt: 34,
      tiltLag: 420,              // duração do elástico de inclinação (ms)
      tiltEase: 'outElastic(1, .55)',
      stretchPerSpeed: 0.00011,  // deformação por px/s
      maxStretch: 0.16,
      // "efeito papel": a foto recortada entorta (skew) quando é arrastada rápido
      skewPerSpeed: 0.0045,      // graus por px/s
      maxSkew: 8,
      dangle: 3.2,               // balanço (graus) quando fica pendurado parado no ar
      photoDeform: 0.4,          // com FOTO (cartão), entortar/balançar é multiplicado por isto

      // Soltar / arremessar
      velocityWindow: 90,        // ms usados para medir a velocidade do dedo
      throwMultiplier: 1.0,
      maxThrowSpeed: 2600,
      tossUp: 0.95,              // parte do movimento vertical que vira altura
      friction: 1500,            // desaceleração no chão (px/s²) → inércia
      gravity: 2600,             // px/s²
      floorRestitution: 0.42,    // quique no chão
      wallRestitution: 0.55,     // quique nas paredes
      ceilingRestitution: 0.35,
      minBounceSpeed: 170,
      flipSpeed: 1250,           // velocidade horizontal para dar cambalhota
      flipMinAirTime: 0.36,

      // Squash & stretch
      landSquashPerSpeed: 0.00028,
      maxSquash: 0.30,
      airStretchPerSpeed: 0.00009,

      // Molas (Anime.js spring)
      settleSpring: { mass: 1, stiffness: 230, damping: 9 },    // geleca ao pousar
      tiltSpring:   { mass: 1, stiffness: 120, damping: 6.5 },  // balanço ao soltar
      poseSpring:   { mass: 1, stiffness: 170, damping: 14 },

      // Profundidade (2.5D): pet menor no fundo do quarto
      depthScaleBack: 0.84,
      depthScaleFront: 1.0,

      // Detecção de chacoalhar
      shakeSpeed: 650,
      shakeReversals: 5,
      shakeWindow: 1300,

      // Andar
      walkSpeed: 120,            // px/s
      runSpeed: 290,
      stepTime: 0.24,            // s por passinho
      walkHop: 7,
      runHop: 13
    },

    /* ----------------------------------------------------------------------
       COMPORTAMENTO AUTÔNOMO
       ---------------------------------------------------------------------- */
    behavior: {
      thinkEvery: 900,           // ms entre "pensamentos"
      idleMin: 4500,             // intervalo entre ações espontâneas
      idleMax: 11000,
      afterInteractionPause: 2600,
      patienceSeconds: 70,       // tempo sem interação até ele "procurar" você
      // Pesos das ações espontâneas (maior = mais frequente)
      weights: {
        wander: 30, lookAround: 22, sit: 14, stretch: 7, lookAtObject: 12,
        playAlone: 9, lookAtUser: 6, chaseTail: 2, groomShake: 5, nap: 3,
        // personalidade
        stare: 5, sillyPose: 3, weirdSit: 5, ignoreToy: 4, chatter: 6, visitPlush: 4
      },
      // Tempo mínimo (ms) antes de repetir a mesma ação — evita manias repetitivas
      cooldowns: {
        stare: 90000, sillyPose: 150000, weirdSit: 60000, ignoreToy: 70000,
        chatter: 45000, visitPlush: 80000, chaseTail: 45000, lookAtUser: 30000
      },
      startleChance: 0.08,       // chance de um susto exagerado ao ser cutucado
      startleCooldown: 45000
    },

    /* ----------------------------------------------------------------------
       BRINQUEDOS — física de cada um. Nomes e liga/desliga: personal.js → toys
       kind: o comportamento base. chase: false = o pet não persegue (pelúcia).
       ---------------------------------------------------------------------- */
    toys: {
      // ball:  { asset: 'toys.ball',  size: 10, bounce: 'bounce.out', friction: 1,   roll: true,  sound: 'squeak', weight: 1,   start: { x: 0.46, z: 0.84 } },
      // yarn:  { asset: 'toys.yarn',  size: 11, bounce: 'bounce.out', friction: 1.6, roll: true,  sound: 'pop',    weight: 1.3, string: true, start: { x: 0.64, z: 0.69 } },
      mouse: { asset: 'toys.mouse', size: 30, bounce: 'power2.in',  friction: 2.2, roll: false, sound: 'squeak', weight: 0.8, windup: true, heightRatio: 0.62, start: { x: 0.28, z: 0.79 } },
      // plush: { asset: 'toys.plushie', size: 15, bounce: 'power2.out', friction: 2.8, roll: false, sound: 'squish', weight: 1.8, chase: false, plush: true, start: { x: 0.55, z: 0.71 } },
      // toy01: { asset: 'toys.toy01', size: 11, bounce: 'bounce.out', friction: 1.3, roll: false, spin: true, sound: 'squeak', weight: 1, start: { x: 0.37, z: 0.91 } },
      // toy02: { asset: 'toys.toy02', size: 11, bounce: 'bounce.out', friction: 1.2, roll: true,  sound: 'pop',    weight: 1.1, start: { x: 0.7,  z: 0.8 } },
      // toy03: { asset: 'toys.toy03', size: 11, bounce: 'power2.in',  friction: 2,   roll: false, spin: true, sound: 'squeak', weight: 0.9, start: { x: 0.2,  z: 0.88 } }
    },

    /* ----------------------------------------------------------------------
       MÓVEIS DO CHÃO — ajuste quando trocar as imagens
       frontClip: a partir de que altura (0–1, de cima para baixo) a imagem
       fica NA FRENTE do pet (ex.: a borda da cama, a lateral da banheira).
       ---------------------------------------------------------------------- */
    furniture: {
      bed:     { frontClip: 0.8 },
      bathtub: { frontClip: 0.39, water: { top: 0.285, left: 0.07, right: 0.07, height: 0.17 } },
      bowl:    { food: { left: 0.17, top: -0.36, width: 0.66, height: 0.66 } }  // onde a comida aparece
    },

    /* ----------------------------------------------------------------------
       COMIDAS — adicione novas aqui (e a imagem em assets.js)
       ---------------------------------------------------------------------- */
    foods: {
      kibble:  { label: 'ração',    asset: 'kibble',  hunger: 34, happiness: 4,  energy: 3,  eatTime: 3.4, xp: 3 },
      treat:   { label: 'petisco',  asset: 'treat',   hunger: 10, happiness: 12, energy: 4,  eatTime: 1.6, xp: 2, alwaysWanted: true },
      special: { label: 'especial', asset: 'special', hunger: 52, happiness: 20, energy: 10, eatTime: 4.4, xp: 6, sleepyChance: 0.35 },
      // comida personalizada: o nome vem de personal.js → foods.food01
      food01:  { label: (G.personal && G.personal.foods && G.personal.foods.food01 && G.personal.foods.food01.name) || 'favorita',
                 asset: 'food01', hunger: 40, happiness: 24, energy: 6, eatTime: 3, xp: 5, alwaysWanted: true, favorite: true }
    },
    fullThreshold: 92,           // acima disso ele recusa comida (menos petiscos)

    /* ----------------------------------------------------------------------
       BANHO
       ---------------------------------------------------------------------- */
    bath: {
      soapNeeded: 1600,          // px esfregados para ensaboar
      rinseNeeded: 1300,         // px esfregados para enxaguar
      maxFoam: 16,
      cleanlinessGain: 75,
      happinessGain: 12,
      xp: 8
    },

    /* ----------------------------------------------------------------------
       BRINCADEIRA
       ---------------------------------------------------------------------- */
    play: {
      catchRadius: 46,
      pounceRange: 120,
      maxJumpReach: 120,         // altura máxima que ele alcança pulando
      energyPerPounce: 1.6,
      happinessPerCatch: 3.5,
      cleanlinessPerCatch: 0.6,
      xpPerCatch: 1,
      restAfter: 2600,           // ms parado até a brincadeira acabar
      minEnergyToPlay: 16
    },

    /* ----------------------------------------------------------------------
       CICLO DE TEMPO
       mode 'real'  → usa o relógio do aparelho
       mode 'cycle' → um dia inteiro dura cycleMinutes (bom para demonstrar)
       Teste rápido: abra com ?hora=22 na URL.
       ---------------------------------------------------------------------- */
    time: {
      mode: 'real',
      cycleMinutes: 20,
      morningStart: 5.5,
      afternoonStart: 12,
      nightStart: 18.5
    },

    /* ----------------------------------------------------------------------
       PROGRESSO OFFLINE (quando o site está fechado)
       ---------------------------------------------------------------------- */
    offline: {
      rateMultiplier: 0.55,      // fora do jogo as necessidades caem mais devagar
      maxHours: 16,              // além disso, não piora mais
      floors: { hunger: 14, happiness: 22, energy: 25, cleanliness: 16 }, // nunca abaixo disso
      sleepAfterHours: 2.5,      // ausente por mais tempo → pode estar dormindo
      restoreEnergyPerHour: 9    // ele também dorme enquanto você está fora
    },

    /* ----------------------------------------------------------------------
       PROGRESSO / DESBLOQUEIOS
       ---------------------------------------------------------------------- */
    progress: {
      // XP total necessário para cada nível de amizade
      levels: [0, 12, 35, 70, 120, 190, 280, 400],
      petXpPerSecond: 0.4
    },

    /* ----------------------------------------------------------------------
       PERSONALIZAÇÃO — adicione novas opções aqui
       ---------------------------------------------------------------------- */
    customization: {
      accessories: [
        { id: 'none',     label: 'nada',     level: 0 },
        { id: 'bandana',  label: 'bandana',  level: 0, anchor: 'neck', width: 0.46, dy: 0 },
        { id: 'bow',      label: 'lacinho',  level: 1, anchor: 'head', width: 0.24, dx: 0.17, dy: -0.02, rotate: 12 },
        { id: 'glasses',  label: 'óculos',   level: 2, anchor: 'eyes', width: 0.48, dy: 0 },
        { id: 'partyHat', label: 'festa',    level: 3, anchor: 'head', width: 0.2,  dx: -0.12, dy: -0.11, rotate: -14 },
        { id: 'crown',    label: 'flores',   level: 4, anchor: 'head', width: 0.56, dy: -0.04 }
      ]
    },

    /* ----------------------------------------------------------------------
       SOM — efeitos sintetizados (WebAudio) + arquivos opcionais (assets.js)
       volume é o máximo; o jogador ajusta pelos controles
       (segure o botão de som, ou no caderninho).
       ---------------------------------------------------------------------- */
    audio: {
      enabledByDefault: true,
      volume: 0.55
    },

    /* ----------------------------------------------------------------------
       SAVE
       ---------------------------------------------------------------------- */
    save: {
      key: 'pepito-pet:save',
      version: 1,
      autosaveEvery: 8000
    },

    debug: {
      // ?debug=1 na URL mostra os números das necessidades no HUD expandido
      showNumbers: false
    }
  };
})(window.Game = window.Game || {});
