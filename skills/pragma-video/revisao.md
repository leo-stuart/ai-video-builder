# Revisão

`node scripts/vid.mjs sheet <slug>` gera folhas em `.qa/<slug>-sheet-N.jpg`: até 12 quadros por folha, dois por cena (um no começo, um perto do fim), cada um com o id da cena e o segundo no canto. **Abra todas as folhas com a ferramenta de ler imagem e olhe.** Você não vê o vídeo de outro jeito.

Para olhar uma cena de perto: `vid sheet <slug> --scene <id>` (seis quadros, maiores). Use sempre que consertar uma cena, em vez de refazer a folha inteira.

Se o comando parar com `ERRO na cena "x"`, a mensagem diz o que quebrou. O mais comum é uma palavra de `cue`/`cueWord` que a voz não fala naquela cena: troque pela palavra certa (a mensagem lista as válidas).

## A lista (percorra cena por cena)

Para cada par de quadros, responda sim ou não:

1. **O cenário é o da cena?** Nenhum quadro vermelho, preto ou vazio.
2. **Quem fala está no quadro, de ombro a ombro, com a boca aberta?** Em fala de personagem, o rosto dele é o centro da imagem.
3. **O humor bate com a fala?** Susto no branco, cara fechada na bronca, sorriso no acerto.
4. **Os dois quadros da cena são diferentes entre si?** Outro plano, outra pose ou um objeto novo. Iguais = a cena está parada.
5. **O texto na tela é o deste episódio?** Nada sobrou de outro episódio ("6 anos", "0 cafés", "To go, please.").
6. **Todo inglês na tela está certo?** Letra por letra: apóstrofo, vírgula, ponto.
7. **A legenda está legível?** Não coberta por cartão, não em cima de outro texto.
8. **Cartão, carimbo e rótulo estão inteiros dentro do quadro** e não cobrem o rosto de quem fala.
9. **O X aparece quando alguém erra e o certo quando acerta.**
10. **A última cena é a tela azul com o logo, "Pragma" e "Link na bio".**

No conjunto:

11. **A história se entende só pelas imagens?**
12. **Duas cenas vizinhas no mesmo cenário têm planos diferentes.**
13. **Este episódio parece diferente do anterior?** O `vid new` imprimiu o mundo sorteado (lugar, câmera, metáfora) e o `check` já barra repetição. Só confira se nada saiu estranho.

Qualquer "não": conserte, refaça a cena com `--scene`, olhe de novo. Só renderize com tudo "sim".

**No nível `recipe`**, nem tudo tem conserto ao seu alcance. Decida assim:
* Problema de **texto** (longo, de outro episódio, com marcação errada): conserte com `set`.
* Problema **só de cenário de fundo** (placa do cenário cortada pela borda, objeto de fundo fora do quadro) que não cobre rosto nem texto: aceite e **liste na entrega**.
* Problema que **atrapalha a leitura** (cartão sobre o rosto, cena vazia, quadro vermelho) e não se resolve com `set`: não renderize; diga ao usuário e proponha outra pauta ou o nível `guided`.

## Consertos

| O que você vê | Por quê | Conserte (nível mínimo) |
|---|---|---|
| Rótulo (`pin`) cortado na borda | Texto longo | Encurte para até 16 caracteres: `vid scene <slug> set <id> params.<campo>="…"` (recipe) |
| Cartão estourando a lateral | Frase longa | Encurte o texto do parâmetro (recipe) |
| Texto de outro episódio na tela | Parâmetro não trocado | `vid scene <slug> set <id> params.<campo>="…"` (recipe) |
| Palavra de animação errada (animação dispara tarde ou cedo) | `cueWord` aponta para outra palavra | `set <id> params.cueWord=palavra` (recipe) |
| Fala com sinal estranho na legenda | Marcação `*` ou `[en]` sem par | Corrija a narração e rode `vid voice` (recipe) |
| Cena parada (dois quadros iguais) | Falta ação ou plano | Troque o tipo (`replace`) ou escreva a cena em dados com dois planos (guided) |
| Episódio igual ao anterior | Mundo repetido | `vid scene <slug> world place=<outro>` ou outra pauta (guided) |
| Boneco cortado na lateral | Plano fechado demais | Cena em dados com um plano mais aberto (guided); código: planos de `SHOT` (free) |
| Carimbo (`stamp`) estourando a lateral | Texto longo ou lugar com letreiro grande | `set <id> params.stamp="Curto"` (recipe) |
| Cartão em cima do rosto | `top` baixo demais | Cena em dados: `top` entre 240 e 420 (guided) |
| Cena escura demais | Cenário de noite com cartão escuro | Cartão claro: `tone: "white"` (guided) |

## Depois do render

```bash
ffprobe -v error -show_entries stream=codec_name,width,height,duration -of csv=p=0 out/<slug>.mp4
```

Tem que mostrar `h264,1080,1920,…` e `aac,…`, com a duração do formato (de 25 a 50 segundos). Sem a linha `aac`, o vídeo saiu mudo: rode a voz e renderize de novo.

## O que você não consegue verificar (diga ao usuário)

* **O som.** Você não ouve. Pronúncia, sotaque e volume ficam para o usuário.
* **O movimento.** As folhas são quadros parados; um corte brusco demais ou uma animação estranha só aparece assistindo.
* **A sincronia fina** entre boca, legenda e voz.
* **O inglês fora das pautas prontas.**

Na entrega, peça ao usuário para assistir uma vez inteiro com som.
