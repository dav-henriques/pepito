# Pepito — pet virtual

Um bichinho que vive num quartinho 2D no seu celular. Você pode tocar, segurar,
fazer carinho, pegar no colo, arrastar, chacoalhar, arremessar, alimentar, dar
banho, brincar e descobrir segredos. O próprio quarto é a interface.

- **HTML + CSS + JavaScript puro**, sem build e sem framework.
- **Anime.js 4.5** faz a física percebida do pet (`src/systems/physics.js`).
- **GSAP 3.12** cuida de interface, transições, objetos e efeitos.
- Mobile-first, só Pointer Events (mouse e toque usam a mesma lógica), nada depende de hover.

---

## Como rodar

**Jeito mais simples:** dê dois cliques no `index.html`. Funciona direto do
arquivo, sem servidor.

**Como se estivesse hospedado (opcional):**

```bash
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
```

Depois abra `http://localhost:5173`. Qualquer servidor estático também serve
(`npx serve`, `python -m http.server`, a extensão Live Server do VS Code etc.).

**Para publicar:** suba a pasta inteira no GitHub Pages, Netlify, Vercel ou em
qualquer hospedagem estática. Todos os caminhos são relativos, então o jogo também
funciona dentro de subpastas.

> GSAP, Anime.js e a fonte Fredoka vêm de CDN (versões fixas). Para jogar sem
> internet, baixe os dois arquivos abaixo para uma pasta `vendor/` e troque os
> `<script src>` do `index.html`:
> - `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js`
> - `https://cdn.jsdelivr.net/npm/animejs@4.5.0/dist/bundles/anime.umd.min.js`

---

## Onde colocar suas imagens

```
assets/pet/
  normal.png  happy.png  hungry.png  very-hungry.png  dirty.png  very-dirty.png
  clean.png   sleeping.png  eating.png  bathing.png  playful.png  tired.png
  excited.png  sad.png  held.png  dizzy.png  grumpy.png
```

Os arquivos atuais são **placeholders** (um gatinho laranja desenhado por código).
Substitua-os pelos seus mantendo os mesmos nomes, ou aponte para outros arquivos em
`src/config/petConfig.js → pet.images`. **Nenhuma lógica precisa mudar.**

Dicas para as imagens ficarem perfeitas:

1. PNG com fundo transparente, quadrado (400×400 ou 512×512 é ótimo).
2. O mesmo enquadramento em todas, com os "pés" encostando perto da borda de baixo.
3. Não precisa ter todas: se faltar alguma, o jogo usa a de fallback
   (`pet.imageFallbacks`; por exemplo, sem `dizzy.png` ele usa `sad.png`, e no fim `normal.png`).
4. Se o seu pet olha para a esquerda nas fotos, use `pet.facing: -1`.
5. Para os acessórios e balões ficarem no lugar certo, ajuste `pet.anchors`
   (posição da cabeça, olhos e pescoço, em frações de 0 a 1 da imagem).

Os outros desenhos (móveis, comidas, brinquedos, acessórios) são SVGs em
`assets/environment`, `assets/food`, `assets/toys` e `assets/accessories`, todos
registrados em **um único lugar**: `src/config/assets.js`.

---

## Configuração central — `src/config/petConfig.js`

Tudo que define o comportamento mora nesse arquivo:

| Seção | O que ajusta |
|---|---|
| `pet` | nome, imagens, fallbacks, tamanho, lado para onde olha, anchors |
| `needs` | valores iniciais, quanto cai por hora, limiares (fome, sujo, cansado…) |
| `physics` | peso ao arrastar, inclinação, gravidade, quique, atrito, molas, chacoalhar |
| `behavior` | frequência e pesos das ações espontâneas |
| `foods` | comidas e seus efeitos (fome, felicidade, energia, tempo comendo) |
| `bath`, `play` | quanto esfregar, ganho de limpeza, energia gasta brincando… |
| `time` | relógio real ou ciclo acelerado (`mode: 'cycle'`, `cycleMinutes`) |
| `offline` | quanto ele muda enquanto o site está fechado, com pisos mínimos |
| `progress`, `customization` | níveis de amizade e o que cada nível desbloqueia |

`physics.intensity` é um botão geral: `0.6` deixa tudo mais contido, `1.4` mais exagerado.

### Testes rápidos pela URL

- `?hora=22` força um horário (veja a noite, a tarde etc.)
- `?debug=1` mostra os números das necessidades ao tocar nos anéis da HUD
- Em `personalizar → recomeçar do zero` o save é apagado

---

## Arquitetura

```
index.html                 estrutura do quarto (o ambiente é a interface)
styles/main.css            visual, mobile-first
src/config/petConfig.js    ⚙️  configuração central
src/config/assets.js       🖼️  registro central de imagens
src/core/core.js           barramento de eventos (G.bus) + utilitários
src/components/
  room.js                  mede o quarto, zonas (cama, banheira…) e profundidade 2.5D
  particles.js             partículas com pool (GSAP)
  bubble.js                balõezinhos de emoção (GSAP)
  hud.js                   HUD mínima, dicas e avisos
  customize.js             folha de personalização
  icons.js                 ícones SVG
src/systems/
  physics.js               🧲 FÍSICA DO PET — Anime.js
  petState.js              estados com prioridade → decide a imagem
  needs.js                 fome, felicidade, energia, limpeza
  animation.js             troca de imagem + animações idle por estado (GSAP)
  interaction.js           Pointer Events: tocar / segurar / arrastar / soltar
  reactions.js             personalidade: reações a toques, arremessos, lugares
  behavior.js              comportamento autônomo, sono, dança…
  food.js  bath.js  play.js  objects.js
  time.js                  manhã / tarde / noite
  save.js                  save automático + progresso offline
  audio.js                 sons sintetizados (WebAudio, sem arquivos)
  progress.js              amizade, estatísticas, desbloqueios
  easterEggs.js            arquitetura de segredos
src/main.js                inicialização
tools/serve.ps1            servidor local opcional (Windows)
```

Os sistemas conversam por eventos (`G.bus.on/emit`), então dá para adicionar coisas
novas sem mexer no resto.

### Quem faz o quê: Anime.js × GSAP

**Anime.js — a física percebida do pet** (`physics.js`)

- **Arrastar:** `createAnimatable` faz o pet perseguir o dedo com atraso
  (`followLag`), o que dá sensação de peso. Ele fica pendurado pelo ponto exato
  onde você segurou e balança como um pêndulo.
- **Inclinação:** um `createAnimatable` com `outElastic` inclina o pet na direção
  do movimento; quando o dedo para, ele continua balançando até assentar.
- **Squash & stretch:** estica na horizontal quando você mexe rápido de lado e na
  vertical quando mexe para cima e para baixo; amassa ao pousar e volta com `spring()`.
- **Inércia:** ao soltar, a velocidade do dedo vira um `animate` com `outQuad`,
  que é desaceleração constante (atrito). A velocidade inicial é preservada (v₀ = 2d/T).
- **Gravidade:** segmentos balísticos exatos. A subida é `outQuad`, a queda é
  `inQuad`, e com velocidade inicial é usada uma curva própria de h(t) = h₀ + v·t − ½gt².
- **Quiques:** chão, paredes (reflexão com perda de energia) e teto.
- **Mola/damping:** `spring({ stiffness, damping, velocity })` herda a velocidade
  angular de quando você solta.
- **Andar, pular, dar bote, girar atrás do rabo, sacudir depois do banho:** tudo com Anime.js.

**GSAP — todo o resto:** HUD, menus, transições, troca de expressão,
respiração/idle por estado, partículas, banheira, pote, brinquedos (arremessar,
quicar, rolar), rádio, luminária, janela e dia/noite.

---

## Como estender

- **Nova comida:** adicione em `petConfig.foods` + caminho em `assets.js → food`.
- **Novo brinquedo:** adicione em `TOY_DEFS` (`play.js`) + `assets.js → toys`.
- **Novo acessório:** `petConfig.customization.accessories` + `assets.js → accessories`.
- **Novo estado/expressão:** entrada em `STATES` (`petState.js`) + imagem em `pet.images`.
- **Nova ação espontânea:** função em `ACTIONS` (`behavior.js`) + peso em `behavior.weights`.
- **Novo objeto interativo:** HTML com `data-hit="nome"` e
  `G.interaction.register('nome', G.interaction.tap(() => ...))`.
- **Novo segredo:** `G.eggs.register({ id, title, listen(found) { ... }, effect() { ... } })`.
- **Salvar algo novo:** `G.save.register('chave', { get, set })`.
- **Nova música do rádio:** adicione uma estação em `STATIONS` (`audio.js`).

---

<details>
<summary>Segredos (spoiler, só para quem desenvolve)</summary>

- 12 toques rápidos no pet → surto de energia
- chacoalhar bastante → centrífuga
- tocar a janela à noite → estrela cadente
- rádio ligado → ele vai dançar
- deixar um brinquedo parar dentro do pote → cardápio estranho
- arremessar o pet na banheira com força → bomba!
- arremessar até o teto → astronauta
- não mexer nele por um tempo → ele bate na "tela"
- tocar a planta 5 vezes rápido → ela floresce
- deixar o laser em cima dele → cadê o pontinho?
- segurar o relógio → viagem no tempo
- 3 petiscos em 2 minutos → barriguinha
- arremesso muito rápido → cambalhota
- segurar o brinquedo perto da cabeça dele → ladrãozinho
- bater em 3 paredes num só arremesso → pinball
- carinho longo à noite até ele dormir → dormiu no colo

</details>
