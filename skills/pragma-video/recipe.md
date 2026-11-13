# Nível `recipe`

Você segue a receita: escolhe uma pauta pronta (ou preenche a ficha de um formato) e confere. Quase tudo já vem decidido: cenas, câmeras, lugar, elenco, sons.

## O que você pode e não pode

| Pode | Não pode |
|---|---|
| `vid pauta`, `vid new --pauta`, `vid new --format --ficha` | reordenar, inserir, remover ou trocar o tipo de cena |
| `vid scene <slug> set <id> narration="…"`, `sub=…`, `hold=…`, `params.<campo>=…` | mudar o mundo (`world`), escrever cena em dados, escrever código |
| `vid check`, `voice`, `sheet`, `render`, `pack`, `batch` | editar `src/`, `formats/`, `skills/` |

O validador acusa ERRO se você sair disso.

## Caminho 1: pauta pronta (o normal)

1. `node scripts/vid.mjs pauta`. Escolha a marcada com `→`, a menos que o usuário peça outra.
2. `node scripts/vid.mjs new epNN-tema --pauta <id> --model haiku`.
3. `node scripts/vid.mjs check epNN-tema --script`. Sem ERRO, siga.
4. Leia as falas (`src/episodes/epNN-tema/script.json`, campo `narration` de cada cena) e mostre ao usuário, com a legenda do post (`post.caption`).
5. Depois do sim: `vid voice`, `vid check`, `vid sheet`, **olhe as folhas** (`revisao.md`), `vid render`, `vid pack`.

Pronto. A pauta tem ficha completa e inglês conferido: você não escreve nada. (Nos quizzes, as opções erradas são erradas de propósito; não as "corrija".)

## Caminho 2: o usuário deu um tema

1. Escolha o formato em `formats.md`:
   * `travou-e-treina`: "você" trava numa pergunta, treina com o tutor e volta (45 s). O mais completo.
   * `diz-vs-ouve`: a frase errada soa como outra coisa para quem ouve (35 s).
   * `mito-vs-fato`: uma crença comum desmentida (35 s).
   * `mini-aula-quiz`: pergunta, três opções, resposta, treino (35 s).
2. Copie `formats/examples/<formato>.json` para `ficha.json` (na pasta `videos`) e troque **todos** os valores pelos do tema.
3. `vid new epNN-tema "Título" --format <formato> --ficha ficha.json --place <lugar> --model haiku`.

Lugares: `cafe`, `restaurante`, `hotel`, `imigracao`, `aeroporto`, `loja`, `farmacia`.

### Regras da ficha

* **Inglês:** só frases que você tem certeza de que um nativo diria. Respostas curtas terminadas em "please" ou "thanks" são as mais seguras. **Se não tem certeza, escolha uma pauta pronta e avise o usuário.**
* **O erro** (`wrong`) tem que ser um erro que brasileiro comete de verdade, e `wrongMeaning` tem que ser engraçado e verdadeiro (o sentido literal em português). Se não consegue escrever o `wrongMeaning`, o tema é fraco: escolha outro.
* **Marcação da narração:** `*palavra*` dá ênfase (a legenda fica coral e a animação dispara nela); `[en]…[/en]` em volta de todo trecho em inglês; reticências com o caractere `…`.
* **Rótulos de tela** (`heavy`, `light`, `need`, `hookPin`, `city`): até 16 caracteres.
* **Cartões** (`lossCard`, `mythCard`, `factCard`): até 60 caracteres.
* **A narração do gancho** (`hook`) tem até 10 palavras e um número com `*ênfase*`.
* **`arrive`** precisa de uma vírgula antes da necessidade: "Aí chega em *Miami*, precisando de um casaco."
* **`loss`** termina com `*sem <o que você foi buscar>*`: "E você sai de lá *sem casaco*."
* Nunca cite preço, "grátis", prazo para ficar fluente ou porcentagem.
* Escreva por extenso o que a voz lê mal: "inteligência artificial", não "IA".

## Ajustar sem refazer

```bash
node scripts/vid.mjs scene epNN-tema set trava narration="E você… *congela*."
node scripts/vid.mjs scene epNN-tema set fora params.loss="0 casacos"
node scripts/vid.mjs voice epNN-tema      # só as falas mudadas gastam voz
node scripts/vid.mjs render epNN-tema     # só as cenas mudadas são renderizadas
```

`params.<campo>` troca um parâmetro da cena. Os campos de cada tipo de cena estão em `beats.md`.

## Quando parar e perguntar

* A pauta pedida não existe e você não tem certeza do inglês.
* O validador pede uma mudança que só o nível `guided` permite (por exemplo, trocar o lugar por causa de "parecido demais"): diga ao usuário e sugira outra pauta.
