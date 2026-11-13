---
name: video-builder
description: Builder local de vídeos curtos animados em 3D (Reels, TikTok, YouTube Shorts) que promovem uma marca, do roteiro ao pacote de postagem. Use quando pedirem um vídeo, reel, short, episódio, criativo, lote de vídeos, pauta ou ideia de conteúdo para uma marca do builder, ou para editar, corrigir ou renderizar um episódio que já existe.
---

# Builder de vídeos

Um vídeo é um arquivo `episode.json`: um **formato** (sequência de cenas), uma **ficha** (as frases do episódio) e um **mundo** sorteado (lugar, elenco, câmera, metáfora). O motor desenha tudo a partir disso; ninguém escreve código de cena, a menos que o nível de liberdade permita.

Tudo roda do repositório do motor, com `node scripts/vid.mjs --workspace <pasta> <comando>`. **Todo comando leva `--workspace <pasta>`** (a pasta com o `workspace.json` da marca), ou a variável `VB_WORKSPACE` já definida; os exemplos abaixo mostram a flag. **Se o servidor MCP `video-builder` estiver registrado, prefira as ferramentas dele** a estes comandos. Na primeira vez: `pnpm install` (precisa de Node 20+ e `ffmpeg`).

## 1. Descubra o seu nível de liberdade

| Nível | Quem usa | O que você pode fazer | Guia |
|---|---|---|---|
| `recipe` | modelos pequenos (Haiku) | escolher uma pauta pronta, ou preencher a ficha de um formato, e ajustar textos | `recipe.md` |
| `guided` | modelos médios (Sonnet) | além disso: reordenar, trocar, inserir e remover cenas; escrever uma cena em dados; mudar o mundo | `guided.md` |
| `free` | modelos grandes (Opus, Fable) | além disso: escrever cenas novas em código (TSX) para este episódio | `free.md` |

O nível sai do bloco `models` de `workspace.json` (com `freedom: auto`, mapeia o nome do modelo) ou do que o usuário pedir. **Passe o seu nome de modelo no `new`**: `--model haiku` (ou `sonnet`, `opus`). Se o usuário pediu um nível, passe `--freedom recipe|guided|free`. O nível fica gravado no episódio e o validador o impõe: o que está fora do seu nível dá ERRO.

Leia o guia do seu nível antes de começar. Na dúvida, fique em `recipe`.

## 2. O fluxo (igual nos três níveis)

```bash
node scripts/vid.mjs --workspace <pasta> pauta                                   # 1. pautas prontas; a marcada com → é a recomendada
node scripts/vid.mjs --workspace <pasta> new ep14-tema --pauta <id> --model haiku   # 2. cria o episódio (mundo sorteado)
node scripts/vid.mjs --workspace <pasta> check ep14-tema --script                # 3. confere o roteiro
#    → mostre as falas ao usuário e espere o sim (a voz gasta crédito)
node scripts/vid.mjs --workspace <pasta> voice ep14-tema                        # 4. voz e tempos (veja o saldo antes: seção 2)
node scripts/vid.mjs --workspace <pasta> check ep14-tema                         # 5. confere tudo
node scripts/vid.mjs --workspace <pasta> sheet ep14-tema                         # 6. folhas de revisão: ABRA E OLHE
node scripts/vid.mjs --workspace <pasta> render ep14-tema                        # 7. render (só refaz o que mudou)
node scripts/vid.mjs --workspace <pasta> pack ep14-tema                          # 8. pacote por plataforma em out/<slug>/
```

* **Número do episódio:** o próximo livre (`ls <pasta>/episodes`). O slug é `epNN-tema-curto`, minúsculas e hífens.
* **Pauta própria:** se o usuário deu um tema, não use `--pauta`. Escolha o formato em `formats.md`, escreva a ficha (JSON) como em `<pasta>/playbook/examples/<formato>.json` e rode `new ... "Título" --format <formato> --ficha ficha.json`. O `new` diz exatamente que campo falta.
* **Pare antes da voz.** No passo 3, mostre ao usuário a lista de falas e a legenda do post. Só gere voz depois do sim. Uma autorização explícita do usuário para gastar voz neste episódio, ou no lote, vale como o sim; sem ela, pergunte. Se ninguém puder responder e não houve autorização, **não gere voz**: entregue só o roteiro e diga que a voz aguarda aprovação.
* **Saldo da voz:** `vid voices` (mostra o saldo) antes e depois do `voice`; a diferença é o gasto do episódio (da ordem de 300 a 900 créditos; falas iguais de outro episódio não gastam, ficam em cache). Diga o gasto na entrega.
* **Corrigir sem refazer tudo:** `vid scene <slug> set <id> narration="…" params.x=…` e `vid render` de novo: só as cenas mudadas são renderizadas.
* **Revisão:** siga `revisao.md` nas folhas do passo 6. Não renderize sem olhar.

## 3. Lote ("faça 5 vídeos hoje")

```bash
node scripts/vid.mjs --workspace <pasta> pauta                      # escolha N pautas, priorizando formatos diferentes
node scripts/vid.mjs --workspace <pasta> new ep14-a --pauta … --model <você>   # um por pauta
node scripts/vid.mjs --workspace <pasta> batch ep14-a ep15-b ep16-c  # voz + validação + render + pacote, retomável
```

Mostre ao usuário todas as falas antes do `batch` (gasta voz). O `batch` para no primeiro problema de cada episódio e diz qual; corrija e rode de novo: ele retoma de onde parou. Ao fim, `out/calendar.csv` tem a ordem e o horário sugerido de cada vídeo, e `out/<slug>/` tem `video.mp4`, `reels.txt`, `tiktok.txt`, `shorts.txt`, `thumb.jpg` e `meta.json`.

## 4. Regras que não se quebram

* **Não publique nem envie o vídeo a lugar nenhum.** Postar é do usuário, na conta dele.
* **Inglês correto.** Toda frase em inglês tem que estar certa e ser o que um nativo diria. As pautas prontas (`vid pauta`) já foram conferidas; fichas novas, não. Se não tem certeza do inglês, use uma pauta pronta e diga isso ao usuário.
* **As falas fixas do fecho e do pitch** (as que a marca define no `workspace.json` e no playbook, como o "Link na bio") são da série: não as reescreva. Se o usuário pedir outra promessa, confirme com ele.
* **Só prometa o que a marca faz,** o que estiver no `workspace.json` e no playbook. Nada de preço, "grátis", prazo para resultado ou porcentagem.
* **Chave de API nunca vai para arquivo do git nem para o chat.** Ela mora em `.env.local`.
* **Não edite `src/kit/`, `src/engine/` nem o `playbook/` da marca** para resolver um problema de um episódio. Formato ou cena que falta é pedido ao usuário, não improviso. Cena em código (nível `free`) está fora do MVP: o validador recusa.
* **Não copie roteiro, personagem ou arte de outro canal ou app.**
* **Não use episódios antigos em código (`src/legacy/`) como modelo.** Use `<pasta>/playbook/examples/` e episódios do próprio espaço de trabalho.

## 5. Voz

O `voice` usa o ElevenLabs quando existe `ELEVENLABS_API_KEY` em `.env.local`. As vozes dos personagens já vêm no episódio; não troque.

* Sem chave: peça ao usuário para criar `<pasta>/.env.local` com `ELEVENLABS_API_KEY=...`. Não peça a chave no chat. Enquanto isso, `vid voice <slug> --provider none` gera tempos estimados para você revisar as cenas; antes do render final rode a voz de verdade.
* Gravação humana em `voice/<slug>/<id>.m4a` (um arquivo por cena) tem prioridade sobre a voz sintética.
* O plano grátis do ElevenLabs não cobre uso comercial: avise o usuário na entrega.

## 6. Quando algo dá errado

| Sintoma | Causa e conserto |
|---|---|
| `check` com ERRO | A mensagem diz o que e como consertar. Conserte e rode de novo. |
| `cue("x") não existe` ou `a palavra "x" não está na narração` | Palavra de animação que a voz não fala nessa cena. A mensagem lista as palavras válidas. |
| `check` diz que a narração mudou depois da voz | Rode `vid voice <slug>`. |
| `parecido demais com epNN` | Mundo repetido. Troque o lugar (`vid scene <slug> world place=<outro>`, nível guided) ou use outra pauta. |
| Boneco cortado, cartão em cima do rosto, rótulo fora do quadro | Tabela de consertos em `revisao.md`. |
| `voice` responde 401 ou 402 | Chave errada ou créditos acabados. Avise o usuário; não tente outra conta. |
| Quadro vermelho no render | Erro de cena: a mensagem do `sheet` diz qual. |
| Nada daqui resolve | Peça ajuda ao usuário, com a mensagem de erro inteira. |

## 7. Arquivos desta skill

* `recipe.md`, `guided.md`, `free.md`: um guia por nível.
* `formats.md` e `beats.md`: gerados por `vid docs`; listam formatos, campos da ficha e tipos de cena.
* `revisao.md`: lista de revisão das folhas e tabela de consertos.
* `catalogo-1.jpg`, `catalogo-2.jpg`, `catalogo-3.jpg`: foto de cada cenário e de cada câmera, com o nome (úteis em `guided` e `free`).
* `referencias.md`: de onde veio o formato. Leia só se o usuário pedir algo diferente.
