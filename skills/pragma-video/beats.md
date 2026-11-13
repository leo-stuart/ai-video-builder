# Cenas (beats)

Gerado por `vid docs`. Cada cena de um episódio tem um `type` desta lista e `params` com os campos abaixo. **Obrigatório** = o validador acusa erro se faltar.

## `hook-walk-out`
Gancho: "você" sai do curso com o diploma; corte na palavra forte. Cartão com o número.

* obrigatório: `plate`
* opcional: `pin`, `sign`, `cueWord`

## `arrive-need`
Chegada a uma cidade, de noite, com uma necessidade no corpo (fome, atraso, frio, cansaço).

* obrigatório: `city`
* opcional: `need`, `pose`, `cueWord`

## `ask`
Quem atende faz a pergunta em inglês no balcão (plano geral e corte para o rosto).

* obrigatório: nenhum
* opcional: `close`, `meMood`

## `freeze`
O branco ao pé da letra: um bloco de gelo cresce em volta de "você".

* obrigatório: nenhum
* opcional: `label`, `cueWord`

## `line-me`
Fala de "você" no balcão, já congelado. Com X.

* obrigatório: nenhum
* opcional: `ice`, `mood`

## `line-other`
Fala de quem atende, com reação (bravo ou feliz).

* obrigatório: nenhum
* opcional: `ice`, `mood`, `meMood`

## `crowd`
A fila cresce de um em um; depois quem atende desiste.

* obrigatório: nenhum
* opcional: `cueWord`

## `walk-out-street`
O prejuízo: de volta à rua, de mãos vazias, com o número em um cartão.

* obrigatório: `loss`
* opcional: `cueWord`, `lean`

## `metaphor`
A causa como objeto 3D: balança, barras ou pilha (o tipo vem do mundo do episódio).

* obrigatório: `heavy`, `light`
* opcional: `kind`, `cueA`, `cueMid`, `cueB`

## `app-enter`
O app entra: em casa, o tutor de IA sai do celular na palavra Pragma.

* obrigatório: nenhum
* opcional: `cueWord`

## `tutor-line`
Fala do tutor. Com plate, a resposta certa aparece grande.

* obrigatório: nenhum
* opcional: `plate`, `plateCue`

## `user-error`
O erro de "você" no treino; no fim da fala, X e o que a frase quis dizer.

* obrigatório: `meaning`
* opcional: nenhum

## `user-success`
O acerto de "você": certo, pulo, estilhaços e carimbo.

* obrigatório: nenhum
* opcional: `stamp`

## `pitch-habit`
O pitch: sete dias acendem; corte para casa com a tela real do app.

* obrigatório: nenhum
* opcional: `cueWord`, `plateText`, `plateSmall`

## `walk-street`
De volta ao lugar, de dia, andando firme.

* obrigatório: nenhum
* opcional: `pin`

## `win`
A vitória no balcão: o objeto vem, estilhaços e carimbo.

* obrigatório: nenhum
* opcional: `stamp`

## `end-card`
Tela final: marca e Link na bio. Sempre a última cena.

* obrigatório: nenhum
* opcional: nenhum

## `title-card`
Abertura: "você" fala com a câmera; um cartão grande dourado entra na palavra forte.

* obrigatório: `card`
* opcional: `cueWord`, `tone`

## `statement`
Cartão de afirmação (mito em vermelho ou fato em verde) com carimbo e "você" reagindo.

* obrigatório: `card`
* opcional: `good`, `stamp`, `mood`, `size`, `tone`

## `say-me`
"Você" diz a frase (errada) para quem atende, sem gelo.

* obrigatório: nenhum
* opcional: `label`, `mood`

## `heard`
O que quem atende ouviu: susto, X e o sentido da frase em um cartão vermelho.

* obrigatório: `meaning`
* opcional: `label`, `cueWord`

## `compare`
Errado e certo lado a lado com X e certo; a palavra depois dos dois-pontos dispara o certo.

* obrigatório: `wrong`, `right`
* opcional: `cueWord`

## `quiz-question`
Quiz: três opções entram uma a uma, contagem regressiva, "você" suando.

* obrigatório: `optA`, `optB`, `optC`
* opcional: nenhum

## `quiz-answer`
Resposta do quiz: a certa fica verde, as outras apagam, com certo e pulo.

* obrigatório: `optA`, `optB`, `optC`, `correct`
* opcional: `cueWord`

## `scene-data`
Cena escrita inteira em dados (JSON). Use `vid scene <slug> scene <id> --json …` para preenchê-la. Só nos níveis guided e free.

* obrigatório: nenhum
* opcional: nenhum

## Parâmetros que se repetem

* `cueWord`: palavra da narração que dispara a animação (inteira, sem pontuação). Sem ela, a animação usa a palavra com `*ênfase*`.
* Rótulos (`heavy`, `light`, `need`, `pin`, `city`, `label`): até 16 caracteres.
