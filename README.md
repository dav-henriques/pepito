# Pepito — pet virtual

Um gato (em foto recortada) num espaço branco, com cama, pote, banheira e brinquedos.
Dá para tocar, segurar, fazer carinho, arrastar, chacoalhar, arremessar, alimentar,
dar banho e brincar. Nesta fase o foco é só o pet: não há cenário de fundo.

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
| `?hora=22` | força um horário (à noite ele fica mais sonolento) |
| `?recorte=css` | simula o modo sem canvas (como abrir o `index.html` direto) |
| `?debug=1` | números das necessidades no painel da HUD |

Para apagar o progresso: caderninho (toque no nome) → "recomeçar do zero".

---

## Personalizar (sem programar)

| arquivo | o que tem |
|---|---|
| `assets/` | as imagens — **troque os arquivos mantendo os nomes**. Guia em [`assets/LEIA-ME.md`](assets/LEIA-ME.md) |
| `src/config/personal.js` | nome do pet, falas (balões de texto), nomes dos brinquedos e da comida favorita, reações à pelúcia |
| `src/config/assets.js` | o registro central: cada referência → um caminho de arquivo |
| `src/config/petConfig.js` | regras: necessidades, física, comportamento, móveis (`furniture`), brinquedos |

Todo texto entre `[COLCHETES]` em `personal.js` é placeholder. Procure por `[` para achar
o que falta.

Todas as imagens (pet, móveis, brinquedos, comidas) usam o mesmo esquema: PNG
recortado, com sombra suave colocada pelo jogo (sem contorno). Para voltar o contorno
branco de adesivo: `petConfig.js → pet.look.outline: true`; a borda branca dos cartões de
foto: `pet.look.cardBorder: true`.

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

---

## Arquitetura

```
index.html                 o quarto (fundo branco) com os móveis, o pet e a HUD
styles/main.css            visual, mobile-first
src/config/assets.js       🖼️  registro central de arquivos
src/config/personal.js     💬 nome, falas, nomes de brinquedos
src/config/petConfig.js    ⚙️  regras do jogo (+ furniture: ajustes das imagens dos móveis)
src/core/core.js           barramento de eventos (G.bus) + utilitários
src/core/media.js          imagens com fallback (nada de imagem quebrada)
src/components/
  room.js                  mede o quarto, zonas (cama, banheira, pote) e profundidade 2.5D
  particles.js  bubble.js (ícones + falas)  hud.js  customize.js (caderninho)  icons.js
src/systems/
  physics.js               🧲 FÍSICA DO PET — Anime.js
  cutout.js                recorte de foto do pet: contorno, sombra, tamanho igualado
  petState.js  animation.js  needs.js  interaction.js  reactions.js  behavior.js
  speech.js                falas do pet (com chance e intervalo)
  objects.js               cama
  food.js  bath.js  play.js (brinquedos, pelúcia)
  time.js  save.js  audio.js  progress.js
src/main.js                inicialização
tools/serve.ps1            servidor local (Windows)
```

Os sistemas conversam por eventos (`G.bus.on/emit`), então dá para adicionar coisas
novas sem mexer no resto.

### Quem faz o quê: Anime.js × GSAP

**Anime.js — a física do pet** (`physics.js`): arrastar com atraso (`createAnimatable`),
pêndulo pelo ponto onde você segurou, inclinação elástica, squash & stretch, skew "papel"
(a foto entorta quando arrastada rápido e volta com `spring()`), balanço quando fica
pendurado parado, inércia (`outQuad`), gravidade balística exata, quiques em chão,
paredes e teto, molas com velocidade herdada, cambalhota, andar, pular, dar bote.

**GSAP — todo o resto:** HUD, caderninho, troca de expressão, humores idle, partículas,
flash de câmera, banheira, pote, móveis, brinquedos (arremessar, quicar, rolar).

### Save
Automático em `localStorage` (chave `pepito-pet:save`): necessidades, posição do pet e
dos brinquedos, nome, acessório, volume, dicas já vistas e progresso de amizade.
