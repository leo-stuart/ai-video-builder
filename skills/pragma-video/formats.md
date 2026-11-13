# Formatos

Gerado por `vid docs`. Cada formato é uma sequência de cenas; você só preenche a ficha. Fichas de exemplo completas em `formats/examples/<formato>.json`.

## `diz-vs-ouve`: O que você diz vs o que ele ouve
"Você" diz uma frase que parece certa, mas quem atende ouve outra coisa. Corrige com o tutor e acerta. 12 cenas, cerca de 35 s.

Sequência: abertura → diz → ouviu → reacao → regra → pragma → treino → certo → volta → resposta → habito → fim

| Campo | O que escrever | Exemplo |
|---|---|---|
| `wrong` | A frase errada que brasileiro diz, em inglês. | I have 25 years. |
| `wrongMeaning` | O que quem atende ouviu, em português, com graça (até 40 caracteres). | Eu tenho 25 anos de idade… de quê? |
| `heardPt` | O que ele ouviu, em narração, com *ênfase*. | Só que ele ouviu: *tenho 25 anos de quê?* |
| `reaction` (opcional) | A reação de quem atende, em inglês. | Sorry, what? |
| `right` | A frase certa, curta. | I'm 25. |
| `rightPt` | A frase certa em português. | eu tenho 25 anos |
| `rightCompare` | O certo, em texto, para a tela (até 30 caracteres). | I'm 25. (ser, não ter) |
| `wrongCompare` | O errado, em texto, para a tela (até 30 caracteres). | I have 25 years. |

## `mini-aula-quiz`: Mini-aula com quiz
Uma pergunta, três opções em contagem regressiva, a resposta certa, e treino com o tutor. 10 cenas, cerca de 35 s.

Sequência: abertura → pergunta → quiz → gabarito → pragma → treino → certo → habito → fim

| Campo | O que escrever | Exemplo |
|---|---|---|
| `question` | A pergunta de quem atende, em inglês. | Window or aisle? |
| `quizAsk` | A pergunta do quiz, em narração, com *ênfase*. | Qual resposta é a *certa*? |
| `optA` | Opção A, em inglês (até 28 caracteres). | Corridor, please. |
| `optB` | Opção B, em inglês (até 28 caracteres). | Aisle, please. |
| `optC` | Opção C, em inglês (até 28 caracteres). | Hallway, please. |
| `correct` | A letra certa: A, B ou C. | B |
| `answerNarr` | A resposta em narração, com a letra em *ênfase*. | É a letra *B*. |
| `right` | O texto da opção certa. | Aisle, please. |
| `rightPt` | A resposta certa em português. | corredor, por favor |

## `mito-vs-fato`: Mito vs fato
Uma crença comum sobre falar inglês é desmentida em um cartão, mostrada no balcão e treinada com o tutor. 11 cenas, cerca de 35 s.

Sequência: mito → fato → pergunta → resposta → pragma → treino → certo → habito → fim

| Campo | O que escrever | Exemplo |
|---|---|---|
| `myth` | O mito, em narração, começando com "Mito:" e com *ênfase*. | Mito: dizer *I'm fine, thank you, and you?* é o jeito natural. |
| `mythCard` | O mito para o cartão (até 60 caracteres). | "I'm fine, thank you, and you?" é natural |
| `fact` | O fato, em narração, começando com "Fato:" e com *ênfase*. | Fato: quase ninguém *responde* assim no dia a dia. |
| `factCard` | O fato para o cartão (até 60 caracteres). | Nativos dizem "Good, you?" |
| `question` | A pergunta de quem atende, em inglês. | How are you? |
| `right` | A resposta certa em inglês, curta. | Good, you? |
| `rightPt` | A resposta certa em português. | bem, e você? |

## `travou-e-treina`: Travou e treina
"Você" trava numa pergunta em inglês lá fora, treina com o tutor de IA do Pragma e volta para acertar. 19 cenas, cerca de 45 s.

Sequência: curso → ny → pergunta → trava → yes → what → fila → fora → balanca → pragma → treino → erro → corrige → certo → habito → volta → revanche → resposta → fim

| Campo | O que escrever | Exemplo |
|---|---|---|
| `hook` | Gancho: o quanto você já estudou, com *ênfase* no número. Até 10 palavras. | Você fez *seis anos* de curso de inglês. |
| `hookPlate` | O número do gancho, para o cartão da tela. | 6 anos |
| `hookPin` | Rótulo curto do gancho (até 16 caracteres). | Diploma |
| `arrive` | Chegada ao lugar. Precisa de uma vírgula antes da necessidade. | Aí chega em *Nova York*, morrendo de fome. |
| `city` | A cidade ou lugar, para o rótulo. | Nova York |
| `need` | O som da necessidade (até 16 caracteres). | Ronc… |
| `pose` (opcional) | hungry, tired, late ou cold. | hungry |
| `question` | A pergunta em inglês que dá o branco. | Hi! For here or to go? |
| `questionPt` | A pergunta em português falado. | Pra comer aqui ou pra levar? |
| `wrong` | A resposta errada que brasileiro dá. | I want to go. |
| `wrongMeaning` | O que o erro quis dizer, em português, com graça. | quero ir embora |
| `right` | A resposta certa, curta. | To go, please. |
| `rightPt` | A resposta certa em português. | pra levar, por favor |
| `loss` | O prejuízo, em narração, terminando com *sem <coisa>*. | E você sai de lá *sem café*. |
| `lossCard` | O prejuízo com número, para o cartão. | 0 cafés |
| `heavy` | Rótulo do prato pesado da metáfora (até 16 caracteres). | Provas: nota 10 |
| `light` (opcional) | Rótulo do prato leve (até 16 caracteres). | Falar: quase 0 |

## Mundo sorteado

`vid new` sorteia, fugindo do que os últimos episódios usaram: lugar (cafe, restaurante, hotel, imigracao, aeroporto, loja, farmacia), metáfora (scale, bars, pile), estilo de câmera (push, pull, slide), tom do estúdio, roupa e cabelo de "você" e do atendente, e uma variante de cada fala fixa (trava: 3, fila: 3, causa: 3, abre: 3, habito: 3, volta: 3, fim: 1, dizouve: 3, quiz: 3).
