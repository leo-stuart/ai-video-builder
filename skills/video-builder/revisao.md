# Revisão

`node scripts/vid.mjs --workspace <pasta> sheet <slug>` gera folhas em `.qa/<slug>-sheet-N.jpg`: até 12 quadros por folha, dois por cena (um no começo, um perto do fim), cada um com o id da cena e o segundo no canto. **Abra todas as folhas com a ferramenta de ler imagem e olhe.** Elas conferem composição e texto; não demonstram movimento suave ou ritmo bom.

Para olhar uma cena de perto: `vid sheet <slug> --scene <id>` (seis quadros, maiores). Use sempre que consertar uma cena, em vez de refazer a folha inteira.

Se o comando parar com `ERRO na cena "x"`, a mensagem diz o que quebrou. O mais comum é uma palavra de `cue`/`cueWord` que a voz não fala naquela cena: troque pela palavra certa (a mensagem lista as válidas).

## A lista (percorra cena por cena)

Para cada par de quadros, responda sim ou não:

1. **O cenário é o da cena?** Nenhum quadro vermelho, preto ou vazio.
2. **Quem fala está no quadro, de ombro a ombro, com a boca aberta?** Em fala de personagem, o rosto dele é o centro da imagem.
3. **O humor bate com a fala?** Susto no branco, cara fechada na bronca, sorriso no acerto.
4. **A ação prevista está visível?** Compare com `direction.md`. Dois quadros diferentes não provam ritmo; dois iguais podem ser uma pausa de leitura intencional. Não adicionar zoom só para passar nesta lista.
5. **O texto na tela é o deste episódio?** Nada sobrou de outro episódio ("6 anos", "0 cafés", "To go, please.").
6. **Todo inglês na tela está certo?** Letra por letra: apóstrofo, vírgula, ponto.
7. **A legenda está legível?** Não coberta por cartão, não em cima de outro texto.
8. **Cartão, carimbo e rótulo estão inteiros dentro do quadro** e não cobrem o rosto de quem fala.
9. **O X aparece quando alguém erra e o certo quando acerta.**
10. **A última cena é a tela azul com o logo, o nome da marca e "Link na bio".**

No conjunto:

11. **A história se entende só pelas imagens?**
12. **As cenas vizinhas conservam continuidade ou cortam por um motivo claro.** Quiz → gabarito deve manter o enquadramento; diálogo pode cortar para quem responde.
13. **Este episódio parece diferente do anterior?** O `vid new` imprimiu o mundo sorteado (lugar, câmera, metáfora) e o `check` já barra repetição. Só confira se nada saiu estranho.

Qualquer "não": conserte, refaça a cena com `--scene`, olhe de novo. Só faça o render de revisão após conferir essas imagens. Isso ainda não aprova a entrega final.

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
| Plano longo sem progressão | Não há mudança narrativa | Introduza ação/transformação relevante ou reduza a fala; não resolver só com travelling (guided) |
| Câmera reinicia/deriva sob opções | Estilo global aplicado em cenas independentes | Use `shot` e `to` iguais; mantenha o mesmo plano no quiz/gabarito e revise a fronteira (guided) |
| Episódio igual ao anterior | Mundo repetido | `vid scene <slug> world place=<outro>` ou outra pauta (guided) |
| Boneco cortado na lateral | Plano fechado demais | Cena em dados com um plano mais aberto (guided); código: planos de `SHOT` (free) |
| Carimbo (`stamp`) estourando a lateral | Texto longo ou lugar com letreiro grande | `set <id> params.stamp="Curto"` (recipe) |
| Cartão em cima do rosto | `top` baixo demais | Cena em dados: `top` entre 240 e 420 (guided) |
| Cena escura demais | Cenário de noite com cartão escuro | Cartão claro: `tone: "white"` (guided) |

## Depois do render

Gere evidência temporal e abra o player:

```bash
node scripts/review-motion.mjs --workspace <pasta> <slug>
```

Saída: `.qa/<slug>-motion/index.html`, trechos MP4 a 30 fps com 0,45 s das cenas vizinhas, tiras temporais e `manifest.json`. Não chama voz nem altera o episódio. As tiras ajudam a localizar defeitos, mas não substituem reprodução a 1×. Reproduza o vídeo completo e os trechos problemáticos; use 0,5× só para investigar o que pareceu errado a 1×.

Registre em `episodes/<slug>/motion-review.md`: arquivo/revisão, trecho assistido, método de reprodução, defeito observado, correção e resultado do reteste. Sem esse registro, o render permanece prévia. Não preencher "aprovado" só porque foi gerado um HTML ou extraído um conjunto de quadros.

Confira em particular: deriva da câmera atrás de cartões fixos; reinício de zoom entre cenas semelhantes; opções/gabarito que saltam; rosto saindo do quadro no trajeto; ação sem relação com a fala; longos blocos com o mesmo boneco e cartões. Rever as fronteiras, não só o meio da cena. Na ClippAI, conferir se existe transformação visual de problema em resultado, além do texto.

```bash
ffprobe -v error -show_entries stream=codec_name,width,height,duration -of csv=p=0 out/<slug>.mp4
```

Tem que mostrar `h264,1080,1920,…` e `aac,…`, com a duração alvo do formato escolhido. A presença de AAC não garante narração: confira que `timing.provider` não é `none` e que as cenas faladas têm áudio. `none` pode produzir AAC apenas com efeitos; não chamar isso de voz pronta.

## O que você não consegue verificar (diga ao usuário)

* **O som.** Você não ouve. Pronúncia, sotaque e volume ficam para o usuário.
* **O movimento, caso não tenha havido reprodução.** Nesse caso registre a revisão como pendente. Folhas, codec correto e ausência de quadros pretos não substituem assistir.
* **A sincronia fina** entre boca, legenda e voz.
* **O inglês fora das pautas prontas.**

Na entrega, peça ao usuário para assistir uma vez inteiro com som.
