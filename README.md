# ai-video-builder

Builder local de vídeos curtos animados em 3D (Reels, TikTok, YouTube Shorts), feito com [Remotion](https://www.remotion.dev) e three.js, para qualquer marca. Você escreve a pauta, gera a voz e renderiza o vídeo e o pacote de postagem, tudo na sua máquina.

## Comece em 5 minutos

Precisa de Node 22+, pnpm e `ffmpeg`.

```bash
pnpm install
VB_WORKSPACE=workspaces/demo pnpm start
```

Abra http://127.0.0.1:4173. O espaço `workspaces/demo` (marca fictícia "Vidforge") já vem com um episódio.

Mesmo fluxo pela CLI, sem voz paga (`--provider none` gera só os tempos, para rascunho):

```bash
node scripts/vid.mjs --workspace workspaces/demo pauta
node scripts/vid.mjs --workspace workspaces/demo new ep02-meu-primeiro --pauta precisa-saber-editar --model haiku
node scripts/vid.mjs --workspace workspaces/demo check ep02-meu-primeiro --script
node scripts/vid.mjs --workspace workspaces/demo voice ep02-meu-primeiro --provider none
node scripts/vid.mjs --workspace workspaces/demo sheet ep02-meu-primeiro
```

`pauta` lista as pautas prontas (a marcada com → é a recomendada). `sheet` grava as folhas de revisão em `workspaces/demo/.qa/`: abra e olhe antes de seguir.

Episódios criados no demo aparecem no `git status` (pasta nova em `workspaces/demo/episodes/`). Para testar sem sujar o repositório, crie um espaço próprio (veja [Espaço de trabalho](#espaço-de-trabalho)).

## Três jeitos de usar

* **UI web**: `pnpm start` (com `VB_WORKSPACE` apontando para o espaço). Lista de episódios, editor de cenas, prévia ao vivo, aprovar voz, renderizar e baixar o pacote. Endereço: http://127.0.0.1:4173.
* **Agente (MCP)**: `pnpm mcp` sobe o servidor MCP por stdio. Para registrar no Claude Code ou no Claude Desktop, veja [`mcp/README.md`](mcp/README.md).
* **CLI**: `node scripts/vid.mjs` (ou `pnpm vid`). Sem argumentos, mostra a ajuda:

```
init       cria um espaço de trabalho mínimo
new        cria um episódio (--pauta id, ou "Título" --format X --ficha ficha.json)
formats    lista os formatos e os campos da ficha
pauta      pautas prontas ainda não usadas
check      valida o episódio (--script confere só o roteiro)
voice      gera a voz e os tempos (--provider none: sem voz paga)
voices     vozes do ElevenLabs e saldo
sheet      folhas de revisão
scene      edita uma cena sem abrir arquivo
render     render por segmentos, com cache
pack       pacote de postagem por plataforma
batch      voz, validação, render e pacote de vários episódios
docs       gera beats.md e formats.md da skill
forget     tira o episódio do histórico de variedade
```

Todo comando aceita `--workspace <pasta>`, ou use a variável `VB_WORKSPACE`.

Agentes que usam a CLI leem `skills/video-builder/SKILL.md`. Para o Claude Code encontrá-la: `bash scripts/install-skills.sh`.

## Espaço de trabalho

Todo conteúdo fica num espaço de trabalho, uma pasta fora do motor:

```
<pasta>/
  workspace.json     marca, vozes, regras, horários
  playbook/          formatos (*.json), examples/, pautas/, variants.json, places.json
  episodes/<slug>/   episode.json, script.json e timing.json (os dois últimos são gerados)
  public/            img/ (logo, telas do produto), audio/ (gerado)
  out/               vídeos, pacotes por plataforma e calendar.csv
  .env.local         chave de voz (ELEVENLABS_API_KEY)
  ledger.json        histórico de variedade
  .cache/, .qa/      gerados
```

Escolha o espaço com `--workspace <pasta>` ou `VB_WORKSPACE=<pasta>`. Sem nenhum dos dois, o builder procura `workspaces/default`.

Para criar o seu:

```bash
node scripts/vid.mjs init workspaces/minha-marca --name "Minha Marca"
```

Depois ponha formatos em `playbook/`, a logo em `public/img/` e edite `workspace.json`. Os espaços `workspaces/*` são privados e ficam fora do git; só `workspaces/demo` é público.

O builder nasceu para os vídeos de um app de inglês. Hoje a marca é um dado do espaço de trabalho.

## Níveis de liberdade

O nível vem do modelo que cria o episódio (`--model`, mapeado no bloco `models` do `workspace.json`). `--freedom` força outro.

| Nível | Modelo | O que pode |
|---|---|---|
| `recipe` | Haiku | pauta pronta ou ficha; ajustar textos |
| `guided` | Sonnet | reordenar, trocar, inserir e remover cenas; escrever cenas em dados |
| `free` | Opus, Fable | cenas novas em código. **Fora do MVP:** o validador recusa cenas `custom:` |

O validador (`vid check`) impõe o nível.

## Voz

* Provedor: ElevenLabs. Ponha `ELEVENLABS_API_KEY=...` em `<espaço>/.env.local` (modelo em `env.example`). A chave nunca vai para o git.
* As vozes dos personagens ficam no `workspace.json`, em `voices`.
* Falas iguais em episódios diferentes ficam em cache e não gastam crédito. `vid voices` mostra o saldo.
* O plano grátis do ElevenLabs não cobre uso comercial.
* `--provider none` gera só os tempos, sem chamar a API: use para rascunhar. `voice` sem essa flag gasta crédito.
* Gravação humana opcional: `voice/<slug>/<id>.m4a`, uma por cena, substitui a voz sintética.

## Desenvolvimento

```bash
pnpm typecheck                  # tsc --noEmit
node scripts/golden.mjs check   # quadros de referência
node mcp/smoke.mjs              # teste do servidor MCP
```

`golden.mjs` e `smoke.mjs` usam `workspaces/pragma`, que é privado e não vai para o git. Por isso não rodam num clone limpo.

Desenho e contrato: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). O que está feito e o que falta: [`ROADMAP.md`](ROADMAP.md).

## Licenças

Fredoka e Nunito estão sob a SIL Open Font License. O Remotion é gratuito para pessoas e equipes pequenas; empresas com mais de três funcionários precisam de licença paga.
