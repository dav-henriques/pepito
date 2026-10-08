/* ==========================================================================
   CONFIGURAÇÃO CENTRAL DO PET
   --------------------------------------------------------------------------
   Quase tudo que define o comportamento do jogo mora aqui. Ajuste valores
   à vontade: nenhum outro arquivo precisa ser editado para mudar nome,
   imagens, ritmo das necessidades, física, comidas etc.
   ========================================================================== */
(function (G) {
  'use strict';

  G.config = {

    /* ----------------------------------------------------------------------
       IDENTIDADE + IMAGENS DO PET
       ----------------------------------------------------------------------
       >>> COLOQUE SUAS IMAGENS REAIS EM:  assets/pet/
       Substitua os arquivos mantendo os mesmos nomes (normal.png, happy.png…)
       ou aponte as chaves abaixo para os seus arquivos.

       Dicas para as imagens:
       - PNG com fundo transparente, quadrado (ex.: 400x400 ou 512x512).
       - O pet deve encostar os "pés" perto da borda de baixo da imagem.
       - Todas as imagens com o mesmo enquadramento (evita "pulos" ao trocar).
       - Não precisa ter todas: se uma faltar, o jogo usa o fallback abaixo.
       ---------------------------------------------------------------------- */
    pet: {
      name: 'Pepito',
      species: 'gato',

      images: {
        normal:     'assets/pet/normal.png',
        happy:      'assets/pet/happy.png',
        hungry:     'assets/pet/hungry.png',
        veryHungry: 'assets/pet/very-hungry.png',
        dirty:      'assets/pet/dirty.png',
        veryDirty:  'assets/pet/very-dirty.png',
        clean:      'assets/pet/clean.png',
        sleeping:   'assets/pet/sleeping.png',
        eating:     'assets/pet/eating.png',
        bathing:    'assets/pet/bathing.png',
        playful:    'assets/pet/playful.png',
        tired:      'assets/pet/tired.png',
        excited:    'assets/pet/excited.png',
        sad:        'assets/pet/sad.png',
        held:       'assets/pet/held.png',    // sendo carregado / no ar
        dizzy:      'assets/pet/dizzy.png',   // depois de ser chacoalhado
        grumpy:     'assets/pet/grumpy.png'   // irritado (muitos cutucões, acordado à força…)
      },

      // Se a imagem de uma chave não existir/falhar, tenta estas (em ordem).
      imageFallbacks: {
        veryHungry: ['hungry', 'sad'],
        veryDirty:  ['dirty'],
        clean:      ['happy'],
        playful:    ['excited', 'happy'],
        excited:    ['happy'],
        held:       ['excited', 'happy'],
        dizzy:      ['sad'],
        grumpy:     ['sad'],
        tired:      ['sleeping', 'sad'],
        bathing:    ['clean', 'happy'],
        eating:     ['happy'],
        '*':        ['normal']             // último recurso para qualquer chave
      },

      // Para qual lado o pet "olha" nas imagens: 1 = direita, -1 = esquerda.
      // (A imagem é espelhada quando ele anda para o outro lado.)
      facing: 1,
      flipWhenWalking: true,

      // Tamanho do pet em "unidades do quarto" (1u ≈ 1% da largura do quarto)
      size: 34,
      minSizePx: 104,
      maxSizePx: 176,

      // Fração da altura da imagem que fica ABAIXO dos pés (margem transparente).
      footOffset: 0.012,

      // Onde ficam cabeça/olhos/pescoço na SUA imagem (frações 0–1 da imagem).
      // Usado para posicionar acessórios e balões. Ajuste se trocar as imagens.
      anchors: {
        head: { x: 0.50, y: 0.30 },
        eyes: { x: 0.50, y: 0.555 },
        neck: { x: 0.50, y: 0.775 },
        mouth: { x: 0.50, y: 0.63 },
        top:  { x: 0.50, y: 0.12 }
      },
      // Ajuste fino dos anchors por estado (ex.: dormindo a cabeça fica mais baixa)
      anchorOffsets: {
        sleeping: { y: 0.06 }
      }
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
        playAlone: 9, lookAtUser: 6, chaseTail: 2, windowWatch: 6, groomShake: 5, nap: 3
      }
    },

    /* ----------------------------------------------------------------------
       COMIDAS — adicione novas aqui (e a imagem em assets.js)
       ---------------------------------------------------------------------- */
    foods: {
      kibble:  { label: 'ração',    asset: 'kibble',  hunger: 34, happiness: 4,  energy: 3,  eatTime: 3.4, xp: 3 },
      treat:   { label: 'petisco',  asset: 'treat',   hunger: 10, happiness: 12, energy: 4,  eatTime: 1.6, xp: 2, alwaysWanted: true },
      special: { label: 'especial', asset: 'special', hunger: 52, happiness: 20, energy: 10, eatTime: 4.4, xp: 6, sleepyChance: 0.35 }
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
      laserDuration: 26000,
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
      ],
      walls: [
        { id: 'sage',   label: 'sálvia',  level: 0, base: '#93b5a4', stripe: '#a1c0b0' },
        { id: 'butter', label: 'manteiga', level: 0, base: '#e8d3a2', stripe: '#efdcb0' },
        { id: 'sky',    label: 'céu',     level: 1, base: '#9cbdd0', stripe: '#aac8d8' },
        { id: 'clay',   label: 'argila',  level: 2, base: '#d9a58a', stripe: '#e1b197' },
        { id: 'lilac',  label: 'lilás',   level: 3, base: '#b4a8c9', stripe: '#bfb4d2' },
        { id: 'night',  label: 'noturno', level: 5, base: '#4f5d7a', stripe: '#586783' }
      ],
      rugs: [
        { id: 'sun',   label: 'sol',     level: 0, asset: 'rugSun' },
        { id: 'wave',  label: 'ondas',   level: 1, asset: 'rugWave' },
        { id: 'check', label: 'xadrez',  level: 2, asset: 'rugCheck' }
      ]
    },

    /* ----------------------------------------------------------------------
       SOM (sintetizado, sem arquivos)
       ---------------------------------------------------------------------- */
    audio: {
      enabledByDefault: true,
      volume: 0.55,
      musicVolume: 0.32
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
