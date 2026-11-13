#!/usr/bin/env node
// Dublê local de POST /v1/messages (streaming SSE no formato da API) para testar o chat da UI sem gastar API.
//   node ui/chat-stub.mjs [--port 4599]
// Suba a UI com ANTHROPIC_BASE_URL=http://127.0.0.1:<porta> e uma ANTHROPIC_API_KEY falsa.
// Roteiro: 1º pedido de um turno → bloco thinking + texto + tool_use de edit_scene (op set); depois do tool_result → texto final, end_turn.
// A mensagem do usuário comanda o dublê: `cena <id>` e uma fala entre aspas ("...") viram a op set.
//   "invalida" na mensagem → tool_use com entrada inválida (testa a validação zod)
//   "recusa"   → stop_reason "refusal"
// GET /_requests devolve o que o dublê recebeu (modelo, betas, fallbacks, effort), para conferir a configuração da UI.
import { createServer } from "node:http";

const argv = process.argv.slice(2);
const PORT = Number(argv[argv.indexOf("--port") + 1] || process.env.STUB_PORT || 4599);
const seen = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0;

const sse = (res, event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
const lastUserText = (messages) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const parts = typeof m.content === "string" ? [m.content] : m.content.filter((b) => b.type === "text").map((b) => b.text);
    if (parts.length) return parts.join("\n");
  }
  return "";
};

const reply = async (res, body) => {
  const id = `msg_stub_${++n}`;
  const base = { id, type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 120, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } };
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  sse(res, "message_start", { type: "message_start", message: base });
  let idx = 0;
  const text = async (chunks) => {
    sse(res, "content_block_start", { type: "content_block_start", index: idx, content_block: { type: "text", text: "" } });
    for (const c of chunks) {
      sse(res, "content_block_delta", { type: "content_block_delta", index: idx, delta: { type: "text_delta", text: c } });
      await sleep(120);
    }
    sse(res, "content_block_stop", { type: "content_block_stop", index: idx++ });
  };
  const stop = (reason, extra = {}) => {
    sse(res, "message_delta", { type: "message_delta", delta: { stop_reason: reason, stop_sequence: null, ...extra }, usage: { output_tokens: 42 } });
    sse(res, "message_stop", { type: "message_stop" });
    res.end();
  };

  const msgs = body.messages ?? [];
  const lastMsg = msgs[msgs.length - 1];
  const afterTool = lastMsg?.role === "user" && Array.isArray(lastMsg.content) && lastMsg.content.some((b) => b.type === "tool_result");
  const user = lastUserText(msgs);

  if (/recusa/.test(user) && !afterTool) {
    await text(["Não posso ", "ajudar com isso."]);
    return stop("refusal", { stop_details: { type: "refusal", category: "general_harms", explanation: "Pedido recusado pelo dublê." } });
  }

  if (afterTool) {
    const res0 = lastMsg.content.find((b) => b.type === "tool_result");
    const bad = res0?.is_error === true;
    await text(bad ? ["A ferramenta recusou a entrada: ", String(typeof res0.content === "string" ? res0.content : JSON.stringify(res0.content)).slice(0, 160)] : ["Pronto. ", "Troquei a fala ", "como você pediu. ", "Lembre de gerar a voz de novo (botão Voz)."]);
    return stop("end_turn");
  }

  // 1º pedido do turno: pensamento (com assinatura, para conferir que volta intacto), texto e a ferramenta.
  sse(res, "content_block_start", { type: "content_block_start", index: idx, content_block: { type: "thinking", thinking: "", signature: "" } });
  sse(res, "content_block_delta", { type: "content_block_delta", index: idx, delta: { type: "thinking_delta", thinking: "Vou ajustar a fala da cena pedida." } });
  sse(res, "content_block_delta", { type: "content_block_delta", index: idx, delta: { type: "signature_delta", signature: "stub-signature-abc123" } });
  sse(res, "content_block_stop", { type: "content_block_stop", index: idx++ });
  await text(["Certo, ", "vou mexer ", "na fala dessa cena."]);

  const slug = /Episódio aberto: ([a-z0-9-]+)/.exec(msgs[0]?.content?.[0]?.text ?? msgs[0]?.content ?? "")?.[1] ?? "ep95-chat-tmp";
  const scene = /cena (\w+)/i.exec(user)?.[1] ?? "hook";
  const fala = /"([^"]+)"/.exec(user)?.[1] ?? "Fala trocada pelo dublê.";
  const input = /invalida/.test(user) ? { slug, op: { type: "set", id: scene } } : { slug, op: { type: "set", id: scene, fields: { narration: fala } } };
  const json = JSON.stringify(input);
  sse(res, "content_block_start", { type: "content_block_start", index: idx, content_block: { type: "tool_use", id: `toolu_stub_${n}`, name: "edit_scene", input: {} } });
  for (let i = 0; i < json.length; i += 24) {
    sse(res, "content_block_delta", { type: "content_block_delta", index: idx, delta: { type: "input_json_delta", partial_json: json.slice(i, i + 24) } });
    await sleep(40);
  }
  sse(res, "content_block_stop", { type: "content_block_stop", index: idx++ });
  stop("tool_use");
};

createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "GET" && url.pathname === "/_requests") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify(seen));
  }
  if (req.method === "POST" && url.pathname === "/v1/messages") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw || "{}");
      seen.push({
        model: body.model, effort: body.output_config?.effort, fallbacks: body.fallbacks, betas: req.headers["anthropic-beta"] ?? null,
        thinking: body.thinking, temperature: body.temperature, tool_choice: body.tool_choice, stream: body.stream,
        system_cache: body.system?.[body.system.length - 1]?.cache_control ?? null, tools: (body.tools ?? []).map((t) => t.name),
        tools_eager: (body.tools ?? []).every((t) => t.eager_input_streaming === true), last_tool_cache: body.tools?.at(-1)?.cache_control ?? null,
        messages: body.messages?.length, thinkingEchoed: JSON.stringify(body.messages).includes("stub-signature-abc123"),
      });
      if (!body.stream) {
        res.writeHead(400, { "content-type": "application/json" });
        return res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "o dublê só atende stream:true" } }));
      }
      reply(res, body).catch((e) => {
        console.error(e);
        res.end();
      });
    });
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ type: "error", error: { type: "not_found_error", message: `${req.method} ${url.pathname}` } }));
}).listen(PORT, "127.0.0.1", () => console.log(`dublê da API em http://127.0.0.1:${PORT}`));
