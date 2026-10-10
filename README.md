# Pepito — pet virtual

Um gatinho feito de fotos, morando num quartinho de colagem: parede de papel, chão de
papel kraft recortado à mão e móveis/brinquedos que são fotos de verdade coladas por cima.
Dá para tocar, segurar, fazer carinho, arrastar, chacoalhar, arremessar, alimentar,
dar banho e brincar.

Como se joga (sem instruções longas):
- **toque no gato** = cutucão · **segure parado** = carinho · **arraste/arremesse** = física
- **pote** = menu de comidas · **banheira** = banho (ou arraste ele até lá) · **caminha** = soneca
- quando falta alguma coisa, o móvel certo **balança** com um adesivinho (fome, banho, sono)
- o nome lá em cima abre o **caderninho** (nome, som, estatísticas)

- **HTML + CSS + JavaScript puro**, sem build e sem framework.
- **Anime.js 4.5** faz a física do pet (`src/systems/physics.js`).
- **GSAP 3.12** cuida de interface, transições, objetos e efeitos.
- Mobile-first, só Pointer Events (mouse e toque usam a mesma lógica), nada depende de hover.

---

## Como rodar e testar

**Recomendado (é o que vai aparecer quando estiver hospedado):**

```bash
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
```

Depois abra `http://localhost:5173`. Qualquer servidor estático serve
(`npx serve`, `python -m http.server`, Live Server do VS Code…).

**Rápido:** dois cliques no `index.html` também funciona. Limitação: abrindo direto do
arquivo (`file://`) o navegador não deixa o canvas ler os pixels das imagens, então a
sombra do gato vem do CSS e o ajuste automático de tamanho entre as fotos fica
desligado. Pelo servidor (ou hospedado) tudo funciona.

**Para publicar:** suba a pasta inteira no GitHub Pages, Netlify, Vercel ou qualquer
hospedagem estática. Todos os caminhos são relativos.

> GSAP, Anime.js e as fontes (Fredoka, Caveat, VT323) vêm de CDN com versões fixas.
> Para jogar sem internet, baixe os dois scripts abaixo para uma pasta `vendor/` e
> troque os `<script src>` do `index.html`:
> - `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js`
> - `https://cdn.jsdelivr.net/npm/animejs@4.5.0/dist/bundles/anime.umd.min.js`

### Atalhos de teste pela URL

| parâmetro | o que faz |
|---|---|
| `?hora=22` | força um horário (à noite ele fica mais sonolento e o papel fica azulado) |
| `?recorte=css` | simula o modo sem canvas (como abrir o `index.html` direto) |
| `?debug=1` | números das necessidades no painel da HUD |
| `?rascunho=1` / `?rascunho=0` | mostra / esconde os textos `[PLACEHOLDER]` (veja abaixo) |

Para apagar o progresso: caderninho (toque no nome) → "recomeçar do zero".

---

## Personalizar (sem programar)

| arquivo | o que tem |
|---|---|
| `assets/` | as imagens — **troque os arquivos mantendo os nomes**. Guia em [`assets/LEIA-ME.md`](assets/LEIA-ME.md) |
| `src/config/personal.js` | nome do pet, nomes dos brinquedos e da comida favorita, reações à pelúcia |
| `src/systems/expressions.js` | os símbolos que ele mostra em cada momento (ele não fala: se expressa com z, ♥, ♪, !, ?, gotinha, comidinha…) |
| `src/config/assets.js` | o registro central: cada referência → um caminho de arquivo |
| `src/config/petConfig.js` | regras: necessidades, física, comportamento, móveis (`furniture`), brinquedos |

Todo texto entre `[COLCHETES]` em `personal.js` é placeholder. Procure por `[` para achar
o que falta.

**Modo rascunho:** enquanto você monta o presente (abrindo pelo computador, com o
arquivo ou o servidor local), os placeholders aparecem em amarelo para você lembrar
deles. **Publicado num site, eles somem sozinhos**: a comida sem nome vira "favorita",
nomes de brinquedo `[...]` não aparecem e a assinatura `[SEU NOME]` some. Para conferir
como ela vai ver, abra com `?rascunho=0`.

Todas as imagens (pet, móveis, brinquedos, comidas) usam o mesmo esquema: PNG
recortado, com sombra suave colocada pelo jogo (sem contorno). Para voltar o contorno
branco de adesivo: `petConfig.js → pet.look.outline: true`; a borda branca dos cartões de
foto: `pet.look.cardBorder: true`.

### O quarto (fundo)
Sem nenhum arquivo, o quarto é uma colagem de papel: parede clara com rabiscos de lápis
e chão de papel kraft recortado à mão. Para usar **uma foto de verdade** de um ambiente,
coloque `assets/room/background.jpg` (em pé, de preferência) — ela aparece atrás de tudo.
Depois ajuste onde fica o chão da foto em `petConfig.js → room` (`floorTop`, `zMin`, `zMax`).
As cores do papel ficam no começo de `styles/main.css` (`--wall`, `--floor`); para
voltar ao fundo todo branco, troque as duas por `#fff`.
A posição de cada móvel no chão fica em `styles/main.css` (`.bed`, `.bowl`, `.tub-back`:
`--x`, `--y` e `--w`).

### Adicionar uma expressão nova ao gato
1. Coloque a imagem em `assets/pet/` (ex.: `grumpy-loaf.png`) e registre em
   `assets.js → pet`: `grumpyLoaf: 'assets/pet/grumpy-loaf.png'`.
2. Em `src/systems/petState.js → STATES`, crie o estado:
   `grumpyLoaf: { priority: 75, image: 'grumpyLoaf', mood: 'grumpy' }`
   (`mood` = animação idle de `animation.js`: normal, happy, excited, sad, staring, confused, silly…).
3. Use no código: `Game.petState.emote('grumpyLoaf', 3000)`.
4. Opcional: um fallback em `petConfig.js → pet.imageFallbacks`.

### Adicionar um brinquedo
1. Imagem em `assets/toys/` + caminho em `assets.js → toys`.
2. Física em `petConfig.js → toys` (copie um existente: tamanho, quique, atrito…).
3. Nome em `personal.js → toys` (`showName: true` mostra uma etiqueta ao tocar).

### Adicionar uma comida
Imagem em `assets/food/` + caminho em `assets.js → food` + entrada em
`petConfig.js → foods` (quanto mata a fome, alegra etc.).

### Sons e volume
Toque no botão de som = liga/desliga. **Segure** o botão = volume. O volume também está
no caderninho. Para usar seu próprio miado, coloque `assets/sounds/meow.mp3`.
No celular Android, pegar o gato, bater na parede e pousar forte dão uma vibraçãozinha
(o iPhone não deixa sites vibrarem). Som desligado = sem vibração; para tirar de vez:
`petConfig.js → audio.haptics: false`.

### Desempenho (para não travar no celular)
- As fotos JPG do gato aparecem direto (cantos arredondados e sombra são CSS); nada é
  processado ao abrir o jogo.
- Cada camada que se mexe (giro, achatar, humor, balão) tem a própria camada na placa de
  vídeo, e o arraste atualiza o pet uma vez por quadro, por mais eventos que o dedo mande.
- As texturas de papel são dois PNGs pequenos em `styles/textures/` (sem filtros SVG).
- Evite imagens enormes em `assets/` (veja o tamanho sugerido no `assets/LEIA-ME.md`).

---

## Arquitetura

```
index.html                 o quarto (colagem de papel ou foto) com os móveis, o pet e a HUD
styles/main.css            visual, mobile-first
src/config/assets.js       🖼️  registro central de arquivos
src/config/personal.js     💬 nome, nomes de brinquedos e da comida favorita
src/config/petConfig.js    ⚙️  regras do jogo (+ furniture: ajustes das imagens dos móveis)
src/core/core.js           barramento de eventos (G.bus) + utilitários
src/core/media.js          imagens com fallback (nada de imagem quebrada)
src/components/
  room.js                  mede o quarto, zonas (cama, banheira, pote) e profundidade 2.5D
  particles.js  bubble.js (balõezinhos de símbolo)  hud.js  customize.js (caderninho)  icons.js
src/systems/
  physics.js               🧲 FÍSICA DO PET — Anime.js
  cutout.js                foto do pet: cartão com cantos arredondados + sombra, tamanho igualado
  petState.js  animation.js  needs.js  interaction.js  reactions.js  behavior.js
  expressions.js           símbolos de cada momento (ele não fala), com chance e intervalo
  objects.js               cama + "pedidos" dos móveis (balançam quando falta algo)
  food.js  bath.js  play.js (brinquedos, pelúcia)
  time.js  save.js  audio.js  progress.js
src/main.js                inicialização
tools/serve.ps1            servidor local (Windows)
```

Os sistemas conversam por eventos (`G.bus.on/emit`), então dá para adicionar coisas
novas sem mexer no resto.

### Quem faz o quê: Anime.js × GSAP

**Anime.js — a física do pet** (`physics.js`): o arraste é uma simulação de molas rodando
no timer do Anime.js — o ponto agarrado segue o dedo por uma mola, a foto é um pêndulo
pendurado nele (herda o embalo, pende com o peso, balança e assenta), estica/achata e
enverga como papel (molas pouco amortecidas = jiggle). Ajustes em
`petConfig.js → physics.drag` (`swing` menor = pêndulo mais solto, `stretch` = geleca,
`follow` = quão grudado no dedo). Depois: inércia (`outQuad`), gravidade balística exata,
quiques em chão, paredes e teto, molas `spring()` com velocidade herdada, cambalhota,
andar, pular, dar bote. Os brinquedos usam a mesma ideia em versão menor (`play.js`).

**GSAP — todo o resto:** HUD, caderninho, troca de expressão, humores idle, partículas,
flash de câmera, banheira, pote, móveis, brinquedos (arremessar, quicar, rolar).

### Save
Automático em `localStorage` (chave `pepito-pet:save`): necessidades, posição do pet e
dos brinquedos, nome, volume, dicas já vistas e progresso de amizade.
