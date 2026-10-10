# Pasta de assets — o que trocar e como

Todo arquivo aqui é um **placeholder funcional**: o jogo já roda com ele.
Para personalizar, **substitua o arquivo mantendo o mesmo nome** (e a mesma extensão).
Nenhuma linha de código precisa mudar. Os caminhos ficam todos em `src/config/assets.js`.

Todas as imagens seguem o mesmo esquema do gato: **PNG com fundo transparente**
(recortado) fica perfeito — a sombra suave é colocada pelo jogo (sem contorno; para
voltar o contorno branco de adesivo: `petConfig.js → pet.look.outline: true`).
JPG sem recorte também funciona: vira um "cartão de foto" em pé, sem borda
(borda branca: `pet.look.cardBorder: true`).

As imagens atuais têm uma fita com o nome do próprio arquivo: quando você vê a fita
no jogo, sabe exatamente qual arquivo está aparecendo.

Se um arquivo faltar ou não abrir, o jogo usa uma alternativa e continua funcionando
(o pet usa outra expressão; objetos mostram um "?" com o nome do arquivo que falta).

---

## 1. O que ainda falta

- `pet/being-held.jpg` — a única foto do gato que ainda não existe (no colo / sendo
  arrastado / susto). Enquanto ela não existir, o jogo usa a foto de `excited`.
  Basta colocar o arquivo com esse nome.
- `room/bed.png`, `room/bowl.png`, `room/bathtub.png`, brinquedos e comidas ainda são
  placeholders desenhados (com a fita do nome).

Depois procure por `[` em `src/config/personal.js` e troque os textos.

---

## 2. `pet/` — as fotos do gato

São fotos JPG **quadradas, 512×512** (já recortadas com o rosto enquadrado). Como não
têm fundo transparente, cada uma aparece como um **cartão de foto** em pé no chão, com
sombra (sem borda). Fotos ficam sempre retas e **nunca são espelhadas** quando o gato
vira de lado (senão textos como "I'm hungry." ficariam ao contrário). Se quiser inclinar
ou ajustar alguma: `src/config/petConfig.js → pet.imageTweaks` (ex.: `angry: { rotate: -3 }`).
Quanto a foto entorta/balança ao ser arrastada: `physics.photoDeform`.

Para trocar uma foto: substitua o arquivo mantendo o nome. O ideal é quadrado; se não
for, o jogo encaixa a foto inteira dentro do cartão (e o cartão fica retangular).
Quanto da caixa do pet o cartão ocupa: `petConfig.js → pet.look.cardFill`.
Se preferir o gato recortado (sem fundo), use PNG transparente e troque a extensão do
caminho em `src/config/assets.js → pet`.

| arquivo | quando aparece |
|---|---|
| `normal.jpg` | parado, tranquilo |
| `being-held.jpg` | no colo / sendo arrastado / susto — **falta** (usa `excited`) |
| `happy.jpg` | feliz, carinho |
| `sleeping.jpg` | dormindo |
| `eating.jpg` | comendo |
| `hungry.jpg` | com fome |
| `very-hungry.jpg` | faminto |
| `sleepy.jpg` | cansado, com sono |
| `angry.jpg` | emburrado (cutucaram demais, acordaram ele) |
| `confused.jpg` | confuso, cheirando a pelúcia |
| `excited.jpg` | animado |
| `bathing.jpg` | no banho |
| `dirty.jpg` | sujinho |
| `very-dirty.jpg` | muito sujo |
| `clean.jpg` | saiu do banho |
| `silly-pose.jpg` | pose absurda espontânea |
| `staring.jpg` | te encarando sem motivo |
| `flying.jpg` | arremessado / caindo |
| `sad.jpg` | tristinho |
| `dizzy.jpg` | tonto depois de chacoalhado |
| `playful.jpg` | brincando |

---

## 3. `room/` — móveis do chão

| arquivo | o que é | dica |
|---|---|---|
| `bed.png` | caminha (toque → ele vai dormir se estiver cansado) | o jogo usa a mesma imagem atrás e na frente do gato. A parte de baixo (a partir de 80% da altura) fica **na frente** dele; ajuste em `petConfig.js → furniture.bed.frontClip` |
| `bowl.png` | pote de comida (toque → menu de comidas) | onde a comida aparece: `furniture.bowl.food` |
| `bathtub.png` | banheira (solte o gato dentro → banho) | a lateral (a partir de 39%) fica na frente do gato: `furniture.bathtub.frontClip`; a água: `furniture.bathtub.water` |

## 4. `toys/` — brinquedos (todos arrastáveis e arremessáveis)

| arquivo | o que é |
|---|---|
| `ball.png` | bolinha (rola) |
| `yarn.png` | novelo (deixa um fio) |
| `mouse.png` | ratinho de corda (toque → sai correndo) |
| `plushie.png` | pelúcia (o gato não persegue; aproxime da cara dele e veja a reação) |
| `toy-01.png` | brinquedo com nome engraçado (nome em `personal.js → toys`) |
| `toy-02.png`, `toy-03.png` | **desligados** — ligue com `enabled: true` em `personal.js → toys` |

## 5. `food/` — comidas

`kibble.png` (ração), `treat.png` (petisco), `special.png` (especial) e `food-01.png`
(comida favorita, nome em `personal.js → foods`). Aparecem no menu do pote e dentro dele.

## 6. `accessories/`

Acessórios do caderninho (bandana, lacinho, óculos…), em SVG. Podem virar PNG:
troque o caminho em `assets.js → accessories`.

---

## 7. `sounds/`

Sem nenhum arquivo, todos os sons são sintetizados. Coloque `sounds/meow.mp3` e todos os
miados viram o seu. Para variações, grave mais miados e liste em
`assets.js → sfx.meow` (ex.: `meow-02.mp3`). Outros efeitos também podem virar arquivo
(`boing`, `squeak`, `munch`, `hiss`, `yawn`…): adicione a chave em `assets.js → sfx`.

> No console do navegador aparece um "404" de `meow.mp3`: é o jogo conferindo se você
> já colocou o arquivo. É normal enquanto ele não existir.
