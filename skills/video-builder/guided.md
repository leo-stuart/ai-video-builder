# Nível `guided`

Tudo do nível `recipe` (leia `recipe.md` primeiro: pautas, fichas e regras de texto valem aqui) mais **mexer na estrutura do episódio**: reordenar, trocar, inserir e remover cenas, mudar o mundo e escrever uma cena em dados.

Peça `--freedom guided` ou `--model sonnet` no `vid new`. O validador impõe o nível; código TSX continua proibido (isso é `free`).

## Comandos

```bash
node scripts/vid.mjs --workspace <pasta> scene <slug> set <id> narration="…" sub="…" hold=0.5 params.campo=valor
node scripts/vid.mjs --workspace <pasta> scene <slug> replace <id> --type <tipo> --narration "…" --set params.campo=valor
node scripts/vid.mjs --workspace <pasta> scene <slug> insert <id-da-cena-anterior> --id nova --type <tipo> --narration "…" [--speaker voce|atendente|tutor] [--sub "…"] [--hold 0.4] --set params.campo=valor
node scripts/vid.mjs --workspace <pasta> scene <slug> move <id> --after <outro-id>
node scripts/vid.mjs --workspace <pasta> scene <slug> remove <id>
node scripts/vid.mjs --workspace <pasta> scene <slug> world place=hotel metaphor=bars camStyle=slide studioTone=noite
node scripts/vid.mjs --workspace <pasta> scene <slug> scene <id> --json '{…cena em dados…}'      (ou --json @cena.json)
```

* Os **tipos de cena** e os campos de cada um estão em `beats.md`. Os **formatos** (que sequências já funcionam) estão em `formats.md`.
* Cena nova que fala precisa de `--narration`, e depois `vid voice`. `--speaker` é quem fala: `voce`, `atendente`, `tutor`; sem `speaker` é o narrador. **Fala de `atendente` e de `tutor` é em inglês** (`[en]…[/en]`); o validador avisa se vier em português. Narração em português é do narrador (sem `speaker`).
* **Cena nova só em dados:** insira uma cena do tipo `scene-data` e preencha com `scene --json`:
  `vid scene <slug> insert <id-anterior> --id dica --type scene-data --narration "…"` e depois `vid scene <slug> scene dica --json @dica.json`.
* A última cena é sempre `end-card` e não pode ser removida.
* Antes de escolher câmeras, leia [direcao.md](direcao.md). Para um plano estável, `shot` e `to` devem ser iguais; omitir `to` aplica movimento automático. Quiz/gabarito conservam plano e posições durante leitura/revelação.
* Mudou a sequência de cenas? Releia o episódio como um todo: tem que continuar contando uma história (lugar → problema → treino → acerto → marca).

## Misturar formatos

Dá para pegar cenas de formatos diferentes. Por exemplo, trocar o fecho de um `mito-vs-fato` por um `quiz-question` + `quiz-answer`. Regras:

* Cada cena precisa dos seus parâmetros obrigatórios (`beats.md`).
* `app-enter` vem antes de qualquer `tutor-line`, `user-error` ou `user-success`: elas se passam em casa, com o tutor.
* Não ponha duas cenas de estúdio seguidas com o mesmo cartão: o episódio fica parado.
* Mantenha as falas fixas da série: o fecho e a menção à marca (as que estão no `workspace.json`).

## Cena em dados (`scene`)

Quando nenhum tipo de cena serve, descreva a cena em JSON. Ela substitui o macro do tipo. Exemplo completo e testado (um boneco assustado na rua, com carimbo e cartão):

```json
{
  "parts": [
    {
      "set": "street",
      "props": { "sign": "STORE", "night": false, "me": { "mood": "wide", "sweat": true } },
      "shots": [{ "at": 0, "shot": "street.onMe", "to": "street.door" }]
    }
  ],
  "overlays": [
    { "type": "stamp", "text": "Mito", "tone": "red", "at": 0.1, "left": 330, "top": 240, "size": 104 },
    { "type": "plate", "text": "Será?", "tone": "white", "at": 0.4, "left": 90, "top": 440, "width": 900, "size": 80 }
  ]
}
```

### Estrutura

* **`parts`**: trechos em sequência. O trecho `i` vale a partir do seu `at` (o primeiro, de 0). Use mais de um para trocar de cenário no meio da fala.
* **`set`**: `counter`, `street`, `home`, `school`, `studio` (cenários prontos) ou `endcard`.
* **`props`** (por cenário):
  * `counter`: `place`, `me`, `other` (props de boneco), `ice` (0 a 1), `queue` (0 a 4), `itemOut` (0 a 1)
  * `street`: `sign`, `night` (true/false), `taxiX`, `me` (props de boneco, ou `null` para tirar)
  * `home`: `me`, `bot` (`mood`, `talking`, `tilt`, `scale`)
  * `school`: `sign`
  * `studio`: `tone` (`indigo`, `noite`, `menta`, `coral`)
* **Props de boneco** (`me`, `other`, `guy`): `mood` (`ok`, `happy`, `wide`, `angry`, `sad`), `talking`, `armL`, `armR` (graus: 0 pendurado, 90 estendido, 170 para cima), `outL`, `outR`, `lean`, `headTurn`, `headTilt`, `walk` (0 a 1), `hop`, `sweat`, `shiver` (0 a 1), `frozen`. O elenco do episódio (roupa, cabelo) já é aplicado.
* **`shots`**: câmeras. `{ "at": 0, "shot": "counter.onOther" }`; com `"to": "counter.queueFar"` a câmera desliza. Nomes: `counter.wide|onOther|onMe|lowMe|queue|queueFar`, `street.establish|onMe|door|walk`, `home.wide|onBot|onMe|both|floor`, `school.establish|onMe`, `studio.wide|side|close|low`. Veja `catalogo-*.jpg`. Dê dois planos a cenas com mais de 2 segundos.
* **`objects`** (3D extra): `{ "kind": "guy", "look": "me", "pos": [x,y,z], "turn": 90, ...props de boneco }` (`look` é `"me"` para "você" ou `"other"` para quem atende; qualquer prop de boneco aceita os valores que mudam com o tempo, como `$tween` e `$bounce`); `robot`, `burst` (`pos`, `k`, `color`), `block` (`size`, `pos`, `color`), `bars` (`values`, `k`), `pile` (`n`, `k`, `pos`), `scale` (`tilt`, `leftPile`, `rightDot`), `daybars` (`n`). Unidade é o metro; o chão é y = 0.
* **`overlays`** (na tela, por cima do 3D), cada um com `at` (quando entra) e opcionalmente `until` (quando sai):
  * `pin`: rótulo em pílula. `text` (até 16 caracteres), `dot` (cor), `size`, e **ou** `top` (centralizado no alto) **ou** `anchor` (preso a um ponto 3D: `"COUNTER.overMe"`, `"COUNTER.overOther"`, `"COUNTER.overQueue"`, `"HOME.overBot"`, `"STREET.belly"`, `"scale.left"`, `"scale.right"`, `"bars.top0"`, ou `[x,y,z]`)
  * `plate`: cartão. `text`, `small`, `tone` (`white`, `gold`, `mint`, `red`, `coral`, `indigo`, `lilac`), `left`, `top`, `width`, `size`
  * `stamp`: carimbo torto. `text`, `tone` (`mint`, `red`, `gold`), `left`, `top`, `size`, `rotate`
  * `mark`: bolinha de certo/errado. `ok`, `left`, `top`, `size`
  * `verdict`: X ou certo no canto de cima. `ok`
  * `phone`: tela real do app. `src` (`img/08-speak.jpg`, `img/05-home.jpg`, `img/06-learn.jpg`, `img/15-fluency-map.jpg`), `left`, `top`, `width`
  * `sfx`: som. `name` (`pop` entrada, `tick` corte, `bong` erro, `ding` acerto, `whoosh` mudança), `volume`

### Tempo (`at`, `until`)

| Forma | Significa |
|---|---|
| `1.2` | 1,2 segundo depois do começo da cena |
| `{ "cue": "palavra" }` | o instante em que a voz fala a palavra (inteira, sem pontuação). `nth` escolhe a ocorrência, `offset` adianta ou atrasa |
| `{ "end": -0.3 }` | 0,3 s antes do fim da cena |
| `{ "frac": 0.5 }` | no meio da cena |

Sincronize com a voz: `at` com `cue` na palavra forte da fala. **O `check` acusa palavra que não existe na narração.**

### Valores que mudam com o tempo

Em qualquer número, texto ou objeto de `props`, `objects` e `overlays`:

```json
{ "$after": { "at": {"cue":"trava"}, "then": "sad", "else": "ok" } }
{ "$tween": { "from": 0, "to": 1, "at": {"cue":"trava"}, "ease": "spring" } }
{ "$tween": { "from": 0, "to": 1, "at": 0.2, "until": 1.5, "ease": "linear" } }
{ "$between": { "at": 0.5, "until": 2, "then": true, "else": false } }
{ "$bounce": { "at": {"cue":"certo"}, "h": 0.3 } }
```

`$after` troca um valor por outro a partir de `at`; `$tween` anima um número (`spring` com mola, `smooth` suave, `linear` entre dois instantes); `$between` vale só entre dois instantes; `$bounce` é um pulinho de comemoração (use em `hop`). `{ "$ref": "COUNTER.item" }` é um ponto fixo de cenário; `{ "$fmt": ["Fila +", {"$int": <número>}] }` monta texto. Nomes de cor da marca: `"C.gold"`, `"C.mint"`, `"C.red"`, `"C.coral"`, `"C.indigo"`, `"C.sky"`, `"C.white"`, `"C.ink"`.

## Exemplos prontos

**O boneco congela na palavra "trava"** (gelo cresce em volta dele):

```json
{ "parts": [ { "set": "counter",
    "props": { "ice": { "$tween": { "from": 0, "to": 1, "at": {"cue": "trava"}, "ease": "spring" } },
               "me": { "mood": "wide", "sweat": { "$after": { "at": {"cue":"trava"}, "then": false, "else": true } } } },
    "shots": [ { "at": 0, "shot": "counter.onMe" }, { "at": {"cue": "trava", "offset": 0.45}, "shot": "counter.lowMe" } ] } ],
  "overlays": [ { "type": "sfx", "name": "bong", "at": {"cue": "trava"} },
                { "type": "verdict", "ok": false, "at": {"cue": "trava", "offset": 0.1} } ] }
```

**Duas barras no estúdio** (uma enorme, outra mínima), rótulos presos às barras:

```json
{ "parts": [ { "set": "studio", "props": { "tone": "noite" },
    "shots": [ { "at": 0, "shot": "studio.wide" }, { "at": 2, "shot": "studio.side" } ],
    "objects": [ { "kind": "bars", "values": [1, 0.08], "k": { "$tween": { "from": 0, "to": 1, "at": 0.3, "ease": "smooth" } } } ] } ],
  "overlays": [ { "type": "pin", "text": "Lendo: 6 anos", "dot": "C.mint", "size": 36, "at": 0.6, "anchor": "bars.top0" },
                { "type": "pin", "text": "Falando: 2 horas", "dot": "C.red", "size": 36, "at": 2, "anchor": "bars.top1" } ] }
```

Depois de escrever uma cena em dados: `vid check <slug>` e `vid sheet <slug> --scene <id>`; **olhe**. Se a mensagem de erro citar uma palavra, um cenário ou uma âncora, é porque o nome está errado: use um dos nomes acima.
