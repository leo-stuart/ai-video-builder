# Nível `free`

> **Fora do MVP.** O validador recusa cenas `custom:`. Este guia descreve o caminho previsto; hoje use `recipe` ou `guided` (cena em dados).

Tudo do nível `guided` (leia `guided.md` primeiro) mais uma coisa: **escrever uma cena nova em código (TSX)**, só para este episódio. Use quando nenhuma cena de `beats.md` nem uma cena em dados (`vid scene … scene`) consegue fazer o que a ideia pede (uma perseguição, uma animação de objeto que não existe).

Antes de escrever código, tente `guided`: cena em dados cobre quase tudo.

## Como criar uma cena em código

1. Crie `<pasta>/episodes/<slug>/custom/<nome>.tsx` (caminho previsto) com um componente React **sem props** como `export default`. Use as peças do kit (referência abaixo) e o mesmo padrão das cenas do `ep03` (`src/legacy/ep03-for-here-or-to-go/index.tsx`, que é só código de exemplo).
2. Na cena do `episode.json`, ponha `"type": "custom:<nome>"` (por exemplo `vid scene <slug> replace <id> --type custom:perseguicao`).
3. `vid check <slug>`, `vid sheet <slug> --scene <id>`, olhe, `vid render <slug>`.

Esqueleto:

```tsx
import React from "react";
import { AbsoluteFill } from "remotion";
import { C, Counter, Pin, SHOT, Sfx, useAfter, useCue, useShots } from "../../../kit";

const Perseguicao: React.FC = () => {
  const cue = useCue();                  // segundo em que a voz fala a palavra (erro claro se não existe)
  const hit = cue("palavra");
  const after = useAfter(hit);
  const cam = useShots([{ at: 0, from: SHOT.counter.wide }, { at: hit, from: SHOT.counter.onOther }]);
  return (
    <AbsoluteFill>
      <Counter cam={cam} other={{ mood: after ? "angry" : "ok" }} />
      <Sfx name="pop" at={hit} />
    </AbsoluteFill>
  );
};
export default Perseguicao;
```

Regras de código: chame os `use…` no topo do componente; use cores de `C`; sem emoji; câmera só por `useShots` com planos de `SHOT`; toda cena com pelo menos dois planos ou uma ação; `Sfx` em cada virada. Não edite `src/kit/` nem `src/engine/`.

## Promoção

Se a mesma cena em código serve a dois episódios, avise o usuário: ela deve virar um tipo de cena do motor (em `src/engine/beats/`), e quem decide isso é ele.

## Referência do kit

### Cenários

| Cenário | Props | Lugares fixos (para `Anchor`) |
|---|---|---|
| `Counter` | `cam`, `place`, `me`, `other`, `ice` (0 a 1), `queue` (0 a 4), `itemOut` (0 a 1), `world` | `COUNTER.overMe`, `.overOther`, `.overQueue`, `.item` |
| `Street` | `cam`, `sign`, `night` (padrão `true`), `taxiX`, `me` (`null` tira o boneco), `world` | `STREET.overMe`, `.belly`, `.me` |
| `Home` | `cam`, `me`, `bot` (`mood`, `talking`, `tilt`, `scale`), `world` | `HOME.overMe`, `.overBot`, `.front` |
| `School` | `cam`, `sign`, `world` (ponha o `Guy` aqui) | porta em `z = -1`; boneco para em `z = 0.7` |
| `Studio` | `cam`, `tone`, filhos | centro em `[0, 0, 0]` |

`me` e `other` recebem props de `Guy` e sobrepõem o padrão: `me={{ mood: "wide", sweat: true }}`. `world` recebe objetos 3D a mais.

### Câmeras (`SHOT`)

| Cenário | Planos |
|---|---|
| `SHOT.counter` | `wide` (os dois), `onOther` (quem atende), `onMe` (você), `lowMe` (você de corpo inteiro, de baixo), `queue` e `queueFar` (a fila, do alto) |
| `SHOT.street` | `establish` (prédios e letreiro, de baixo), `onMe`, `door` (calçada e porta), `walk` (acompanha quem anda) |
| `SHOT.home` | `wide`, `onBot` (tutor), `onMe`, `both` (os dois, perto), `floor` (o tapete, do alto) |
| `SHOT.school` | `establish`, `onMe` |
| `SHOT.studio` | `wide` (objeto de frente), `side` (três quartos), `close` (boneco falando com a câmera) |

```tsx
const cam = useShots([
  { at: 0, from: SHOT.counter.wide },             // o primeiro plano começa sempre em 0
  { at: cue("go"), from: SHOT.counter.onOther },  // corte seco quando a voz diz "go"
]);
```

* Sem `to`, a câmera se aproxima 10% sozinha. Com `to`, desliza de um plano ao outro: `{ at: 0, from: SHOT.counter.queue, to: SHOT.counter.queueFar }`.
* **Fala de personagem:** um plano, fechado em quem fala (`onOther`, `onMe`, `onBot`).
* **Fala do narrador com mais de 2 segundos:** dois planos, o geral e depois o fechado, com o corte em `cue()` da palavra forte.
* Passe o mesmo `cam` ao cenário e a todo `Anchor` da cena.
* Não escreva coordenadas de câmera à mão. Se nenhum plano serve, use o mais próximo.

### Boneco (`Guy`)

| Prop | Valores |
|---|---|
| `mood` | `ok`, `happy`, `wide` (susto), `angry`, `sad` |
| `talking` | `true` enquanto fala |
| `armL`, `armR` | graus para a frente: 0 pendurado, 90 estendido, 170 para cima |
| `outL`, `outR` | graus para o lado (abrir os braços) |
| `lean` | inclina para a frente (negativo: para trás) |
| `headTurn`, `headTilt` | cabeça de lado, cabeça torta |
| `walk` | 0 parado, 1 andando (mude `pos` para sair do lugar) |
| `hop` | pulo em metros (use `useBounce`) |
| `sweat`, `shiver` (0 a 1) | nervoso |
| `frozen` | pose dura |
| `turn` | giro em graus: 0 de frente para a câmera, 90 para a direita |

`{...VOCE}` é a roupa de "você". O tutor é o `Robot` dentro de `Home`: `bot={{ mood: "happy" | "neutral" | "wide" | "sad", talking: true }}`.

### Tempo

| Peça | Para quê |
|---|---|
| `const cue = useCue()` → `cue("palavra")` | Segundo em que a voz fala a palavra. Dá erro claro se a palavra não existe na cena |
| `useAfter(seg)` | `true` depois daquele segundo: trocar humor ou mostrar algo |
| `useSpring(seg)` | 0→1 com mola a partir daquele segundo: objeto que entra (`ice`, `itemOut`, `scale` do tutor) |
| `useRamp(a, b)` | 0→1 linear entre dois segundos: coisa que cresce ou anda |
| `useBounce(seg, altura)` | pulinho de comemoração, para `hop` |
| `useT()` | segundos desde o começo da cena |
| `useScene().dur` | duração da cena. Em fala de personagem, o fim da fala é `dur - 0.3` |

Chame os `use…` sempre no topo do componente, antes do `return`, nunca dentro de `if` nem de JSX. Guarde o resultado em uma constante e use a constante.

### Na tela (HTML por cima do 3D)

| Peça | Uso |
|---|---|
| `<Pop at={seg} style={{ left, top }}>` | Faz o filho entrar em `seg`. `from="down"` ou `"right"` muda a entrada; `out={seg}` faz sair |
| `<Plate tone="red" …>` | Cartão com texto. Tons: `white`, `gold`, `mint`, `red`, `coral`, `indigo`, `lilac`, `ink` |
| `<Pin dot={C.red}>Texto</Pin>` | Rótulo em pílula. Dentro de `<Anchor cam={cam} p={…}>` fica preso a um ponto 3D. **Até 16 caracteres**: rótulo longo preso a um objeto perto da borda sai do quadro |
| `<Verdict ok={false} at={seg} />` | X (ou certo) batendo no alto à esquerda |
| `<Stamp at={seg} tone="mint">Texto</Stamp>` | Carimbo torto |
| `<Phone src="img/08-speak.jpg" width={330} />` | Tela real do app. Outras: `05-home.jpg`, `06-learn.jpg`, `15-fluency-map.jpg` |
| `<Sfx name="pop" at={seg} />` | Som: `pop` (entrada), `tick` (corte), `bong` (erro), `ding` (acerto), `whoosh` (mudança de lugar) |
| `<EndCard />` | Tela final. É sempre a última cena |

**Mapa da tela (1080 × 1920).** Cartão e carimbo: `top` entre 240 e 420. A legenda ocupa de 1130 a 1420: nada de HTML ali. Abaixo de 1500 e à direita de 960 ficam os botões do aplicativo: nada importante ali. Texto de cartão: de 60 a 120 px.

### Objetos 3D para metáfora

`Ice` (já embutido em `Counter` por `ice`), `Scale` (`tilt`, `scale`, `left`, `right`), `Bars` + `barTop`, `Pile` (`n`, `k`), `Burst` (`pos`, `k`, `color`), `Block` (`size`, `pos`, `color`, `r`), `CupToGo`, `PhoneToy`. Cores: sempre de `C` (`C.gold`, `C.mint`, `C.coral`, `C.red`, `C.indigo`, `C.lilac`, `C.sky`, `C.teal`, `C.white`, `C.ink`).

## O que não fazer

* Não apague `Sfx`, `Verdict` nem o segundo plano de uma cena para "simplificar": são eles que dão o ritmo.
* Não ponha emoji em `Pin`, `Plate` ou `Stamp`: o render desenha errado. Reticências `…` pode.
* Não escreva a frase inteira do narrador num cartão: a legenda já escreve. Cartão mostra número, frase em inglês ou rótulo.
* Não desenhe tela do app à mão: use as imagens reais com `Phone`.
* Não use `Stage`, `Toy`, `useCam`, `Person` nem `Prag` (kit antigo).
* Não mude `id` de cena nem a ordem do bloco `visuals`.
