# Servidor MCP do builder

Expõe o core do builder como ferramentas MCP (stdio) para agentes: escolher pauta, criar e editar episódio, validar, gerar voz, revisar quadros (como imagem), renderizar e montar o pacote de postagem. Nada é publicado nem enviado para fora; a voz paga só roda com `confirm: true`.

## Ferramentas

`get_workspace`, `list_formats`, `list_beats`, `list_pautas`, `list_episodes`, `get_episode`, `create_episode`, `edit_scene`, `validate`, `voice_balance`, `generate_voice`, `review_frames`, `render`, `pack`, `delete_episode`. Prompt: `novo_video`. As instruções do servidor ensinam o fluxo ao agente.

## Espaço de trabalho

Informe a pasta (a que contém `workspace.json`) por `VB_WORKSPACE` ou `--workspace <pasta>`. Use caminho absoluto no registro.

## Claude Code

```bash
claude mcp add video-builder -e VB_WORKSPACE=/caminho/absoluto/do/workspace -- node /caminho/absoluto/ai-video-builder/mcp/server.mjs
```

Ou, sem variável de ambiente:

```bash
claude mcp add video-builder -- node /caminho/absoluto/ai-video-builder/mcp/server.mjs --workspace /caminho/absoluto/do/workspace
```

Use `--scope project` para gravar em `.mcp.json`. Confira com `claude mcp list`.

## Claude Desktop

Em `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`):

```json
{
  "mcpServers": {
    "video-builder": {
      "command": "node",
      "args": ["/caminho/absoluto/ai-video-builder/mcp/server.mjs"],
      "env": { "VB_WORKSPACE": "/caminho/absoluto/do/workspace" }
    }
  }
}
```

Reinicie o Claude Desktop. Se `node` não for achado, use o caminho completo (`which node`); precisa de Node 22 e `ffmpeg` no PATH.

## Observações

* A chave `ELEVENLABS_API_KEY` fica em `<workspace>/.env.local`, nunca na configuração do cliente.
* `review_frames`, `render` e `generate_voice` enviam notificações de progresso quando o cliente manda `progressToken`, e rodam uma de cada vez.
* Teste: `node mcp/smoke.mjs` (acrescente `--render` para também renderizar `ep15-teste-sonnet`, em cache). Usa `workspaces/pragma`.
