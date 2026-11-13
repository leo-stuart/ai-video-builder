# Arquitetura do MVP

Contrato que todo trabalho no MVP segue. Se algo aqui se mostrar inviável, pare e relate; não invente outro desenho.

## Três camadas

```
core/        biblioteca Node (ESM, .mjs): toda a lógica. Devolve dados, nunca imprime nem encerra o processo.
clientes     scripts/vid.mjs (CLI) · mcp/ (servidor MCP) · ui/ (app web local). Finos: só chamam o core.
src/         motor Remotion (kit, engine). Desenha um episódio a partir de dados.
```

## Motor × espaço de trabalho

* **Motor** = este repositório: `core/`, `src/`, `mcp/`, `ui/`, `public/` (só fontes e efeitos sonoros).
* **Espaço de trabalho** = uma pasta do usuário, fora do git do motor. O core a encontra por `VB_WORKSPACE` (variável de ambiente) ou, se ausente, `./workspaces/default`.

```
<workspace>/
  workspace.json        marca, vozes, regras, horários (ver abaixo)
  playbook/             formatos (*.json), examples/, pautas/, variants.json, places.json
  episodes/<slug>/      episode.json, script.json (gerado), timing.json (gerado)
  public/               img/ (logo, telas do produto), audio/<slug>/ (gerado)
  voice/<slug>/         gravações humanas opcionais
  out/                  vídeos, pacotes, calendar.csv
  ledger.json           histórico de variedade
  .cache/               segmentos de render, voz em cache, estado de tarefas
  .qa/                  folhas de revisão
  .env.local            chaves (ELEVENLABS_API_KEY)
```

`workspaces/` está no `.gitignore` do motor, exceto `workspaces/demo/`.

### workspace.json

```json
{
  "brand": { "name": "Vidforge", "tagline": "Do roteiro ao vídeo. **Sem editar nada.**", "cta": "Link na bio",
             "logo": "img/logo-mark.png", "productShots": ["img/08-speak.jpg"] },
  "voices": { "narrator": "<id>", "voce": "<id>", "atendente": "<id>", "tutor": "<id>" },
  "freedom": "auto",
  "models": { "haiku": "recipe", "sonnet": "guided", "opus": "free", "fable": "free" },
  "variety": { "window": 6, "maxShared": 2 },
  "rules": { "requireBrandMention": true, "foreignMarkup": "en", "requireBeats": ["tutor-line"] },
  "post": { "slots": ["08:00", "12:30", "18:00", "21:00", "23:00"], "hashtags": ["videocurto", "vidforge"] }
}
```

`rules` liga e desliga verificações que eram fixas para o Pragma (mencionar a marca, inglês fora de `[en]`, exigir cena do tutor); agora vêm do espaço de trabalho.

## Uma composição genérica

O Remotion registra **uma** composição, `Episode`, que recebe por `inputProps`: `{ spec, script, timing, brand }` e calcula a própria duração (`calculateMetadata`). Nenhum episódio é registrado em código. Consequências:

* render e folhas de revisão passam `inputProps`;
* a UI toca a mesma composição no `@remotion/player`, sem render;
* `EndCard` e a cena do pitch leem `brand` (nome, logo, frase, chamada, telas) em vez de valores fixos;
* o diretório público do bundle é montado a partir de `public/` do motor + `public/` do espaço de trabalho.

Cenas em código (`custom:`, nível `free`) ficam **fora do MVP**: o validador as recusa com mensagem clara. Os episódios antigos em TSX (`ep01`–`ep04`) saem do motor; `ep03` e `catalogo` vão para `src/legacy/` e continuam registrados só para referência e para gerar o catálogo.

## API do core (`core/index.mjs`)

Toda função recebe `ws` (caminho do espaço de trabalho, já resolvido por `resolveWorkspace()`), é `async`, devolve objeto serializável e **lança `VbError` (com `code` e `message` em português)** em erro de uso. Nunca `process.exit`, nunca `console.log`.

| Função | Devolve |
|---|---|
| `resolveWorkspace(path?)` | caminho absoluto; erro se não houver `workspace.json` |
| `initWorkspace(path, { brand })` | cria a estrutura mínima |
| `getWorkspace(ws)` | conteúdo de `workspace.json` |
| `listFormats(ws)` / `listBeats()` | formatos com campos da ficha / tipos de cena com parâmetros |
| `listPautas(ws, { format? })` | pautas não usadas, a recomendada primeiro (`recommended: true`) |
| `listEpisodes(ws)` | `[{ slug, title, format, freedom, status }]`; `status`: `draft`, `voiced`, `rendered`, `packed` |
| `getEpisode(ws, slug)` | `{ spec, script, timing, status }` |
| `createEpisode(ws, { slug, title?, pauta?, format?, ficha?, place?, freedom?, model? })` | `{ spec, world }` |
| `editScene(ws, slug, op)` | `{ spec }`; `op` = `{ type: "set" \| "world" \| "replace" \| "insert" \| "move" \| "remove" \| "scene", ... }`, mesmas regras de liberdade de hoje |
| `validate(ws, slug, { scriptOnly? })` | `{ errors: [{ scene?, message }], warnings: [...] , ok }` |
| `voiceBalance(ws)` | `{ plan, used, limit }` ou `null` sem chave |
| `voice(ws, slug, { provider?, onProgress? })` | `{ scenes: [{ id, seconds, source }], seconds, provider }` |
| `frames(ws, slug, { scene?, per? , onProgress? })` | `{ sheets: [caminhos .jpg], frames: [{ scene, t }] }` |
| `render(ws, slug, { force?, onProgress? })` | `{ video, seconds, cached, rendered }` |
| `pack(ws, slug)` | `{ dir, files }` |
| `forget(ws, slug)` / `deleteEpisode(ws, slug)` | `{ ok }` |

`onProgress({ step, done, total, label })` é opcional. Gasto de voz nunca é disparado por outra função (render não gera voz).

## Clientes

* **CLI** `scripts/vid.mjs`: mesmos comandos de hoje, agora chamando o core; aceita `--workspace`.
* **MCP** `mcp/server.mjs` (stdio, `@modelcontextprotocol/sdk`): uma ferramenta por função do core; `frames` devolve as folhas como imagem; `voice` exige `confirm: true`; instruções do servidor = conteúdo essencial da skill.
* **UI** `ui/` (Vite + React, pacote próprio): servidor local fino em `ui/server.mjs` que expõe o core por HTTP (`/api/...`) e serve o app; prévia com `@remotion/player` importando a composição `Episode` de `../src`.

## Regra de ouro da refatoração

`node scripts/golden.mjs check` precisa passar antes e depois de cada etapa: os quadros de referência não podem mudar (salvo mudança intencional, que se registra regravando a referência e dizendo por quê).
