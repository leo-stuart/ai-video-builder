// Chat da UI: o usuário conversa com o Claude e ele edita o episódio aberto com as mesmas ferramentas do MCP (mcp/tools.mjs).
// SDK oficial @anthropic-ai/sdk, Tool Runner em beta com streaming. A conversa de cada episódio fica em <workspace>/.cache/chat/<slug>.json.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import * as core from "../core/index.mjs";
import { config, paths, readEnv } from "../core/workspace.mjs";
import { TOOLS, toolMessage } from "../mcp/tools.mjs";

/* ───────────── modelos e esforço (escolhidos pela UI, gravados em workspace.json → chat) ───────────── */

export const MODELS = [
  { id: "claude-opus-5-5", label: "Opus 5.5", price: { in: "$4", out: "$20" }, fallback: true },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", price: { in: "$2", out: "$10" }, fallback: true },
  { id: "claude-haiku-5-5", label: "Haiku 5.5", price: { in: "$0,10", out: "$0,50" }, fallback: false }, // sem fallback do servidor
  { id: "claude-fable-5-2", label: "Fable 5.2", price: { in: "$8", out: "$40" }, fallback: true }, // só "default"; a forma de lista não existe
];
export const EFFORTS = ["low", "medium", "high"];
const DEFAULTS = { model: "claude-opus-5-5", effort: "medium" };
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export const getChatConfig = (ws) => {
  const c = config(ws).chat ?? {};
  return {
    model: MODELS.some((m) => m.id === c.model) ? c.model : DEFAULTS.model,
    effort: EFFORTS.includes(c.effort) ? c.effort : DEFAULTS.effort,
  };
};

/** Grava só a chave "chat" de workspace.json, por edição de texto, sem reformatar o resto do arquivo. */
export const setChatConfig = (ws, { model, effort }) => {
  if (!MODELS.some((m) => m.id === model)) throw new core.VbError("bad-model", `modelo "${model}" não está na lista.`);
  if (!EFFORTS.includes(effort)) throw new core.VbError("bad-effort", `esforço "${effort}" inválido. Use low, medium ou high.`);
  const file = paths(ws).config;
  const raw = readFileSync(file, "utf8");
  const block = JSON.stringify({ model, effort });
  const had = /"chat"\s*:\s*\{[^{}]*\}/;
  let next;
  if (had.test(raw)) next = raw.replace(had, `"chat": ${block}`);
  else {
    const end = raw.lastIndexOf("}");
    const before = raw.slice(0, end).replace(/\s*$/, "");
    next = `${before},\n  "chat": ${block}\n${raw.slice(end)}`;
  }
  try {
    const back = JSON.parse(next);
    if (back.chat?.model !== model || back.chat?.effort !== effort) throw new Error("conferência falhou");
  } catch {
    const obj = JSON.parse(raw);
    obj.chat = { model, effort };
    next = JSON.stringify(obj, null, 2) + "\n";
  }
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, next);
  renameSync(tmp, file);
  return getChatConfig(ws);
};

/* ───────────── histórico em disco ───────────── */

const histFile = (ws, slug) => join(paths(ws).cache, "chat", `${slug}.json`);
export const loadHistory = (ws, slug) => {
  const f = histFile(ws, slug);
  if (!existsSync(f)) return { model: null, messages: [] };
  try {
    const h = JSON.parse(readFileSync(f, "utf8"));
    return { model: h.model ?? null, messages: Array.isArray(h.messages) ? h.messages : [] };
  } catch {
    return { model: null, messages: [] };
  }
};
const saveHistory = (ws, slug, h) => {
  const f = histFile(ws, slug);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(`${f}.tmp`, JSON.stringify(h));
  renameSync(`${f}.tmp`, f);
};
export const clearHistory = (ws, slug) => saveHistory(ws, slug, { model: null, messages: [] });
export const removeHistory = (ws, slug) => rmSync(histFile(ws, slug), { force: true });

/* ───────────── prompt de sistema (estável: o slug entra na 1ª mensagem, não aqui) ───────────── */

const SYSTEM = `Você é o assistente de edição do builder de vídeos curtos animados (Reels, TikTok, Shorts) que ensinam uma frase de inglês e vendem o app da marca. O usuário está com um episódio aberto no editor e conversa com você para ajustá-lo. A primeira mensagem diz qual é o episódio; trabalhe só nele.

COMO TRABALHAR
- Antes de mexer, leia o episódio (get_episode). Para trocar tipo de cena ou parâmetros, consulte list_beats; para mudar a estrutura do vídeo, list_formats.
- Edite com edit_scene. O nível de liberdade do episódio manda: em recipe só vale a operação set (narration, sub, hold, params.campo); guided e free aceitam também replace, insert, move, remove, world e scene. Se o pedido exige mais do que o nível permite, diga isso e proponha uma alternativa.
- Depois de editar, rode validate (scriptOnly=true se ainda não há voz) e corrija os erros que apontar.
- Para ver o resultado, use review_frames, de preferência só da cena mexida (scene). OLHE as imagens antes de afirmar que ficou bom. Você não vê movimento nem ouve o som: diga isso quando importar.
- Você não gera voz, não renderiza, não monta pacote e não apaga ou cria episódios. Se mudou uma fala, avise que a voz precisa ser gerada de novo e sugira o botão Voz do editor (gasta créditos pagos; é decisão do usuário).

REGRAS QUE NÃO SE QUEBRAM
- Inglês correto, como um nativo diria. Sem certeza, avise.
- Marcação da narração: *palavra* dá ênfase, [en]…[/en] envolve todo trecho em inglês, "…" para reticências. Rótulos até 16 caracteres, cartões até 60.
- As falas fixas do fecho e do pitch da série não se reescrevem. Só prometa o que o app faz (lições curtas, tutor de IA por voz, mapa de fluência); nada de preço, "grátis", prazo para fluência ou porcentagem.
- Não copie roteiro, personagem ou arte de outro canal ou app. Nada é publicado: postar é do usuário.
- Nunca peça nem mostre chaves de API.

Responda em português, curto e direto: diga o que mudou e, se for o caso, o que ficou por verificar.`;

/* ───────────── ferramentas do chat ───────────── */

const CHAT_TOOLS = ["get_episode", "list_beats", "list_formats", "validate", "edit_scene", "review_frames", "get_workspace"];
const MUTATING = new Set(["edit_scene"]);

const clip = (s, n = 70) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));
const summarize = (name, input = {}, text) => {
  let out = {};
  try {
    out = JSON.parse(text ?? "{}");
  } catch {}
  switch (name) {
    case "edit_scene": {
      const op = input.op ?? {};
      const f = op.fields ? Object.keys(op.fields).join(", ") : "";
      return clip([op.type, op.id ?? op.after, f].filter(Boolean).join(" · "));
    }
    case "validate":
      return out.errors ? `${out.errors.length} erro(s), ${out.warnings?.length ?? 0} aviso(s)` : "";
    case "review_frames":
      return input.scene ? `cena ${input.scene}` : "episódio todo";
    case "get_episode":
      return out.status ? `status ${out.status}` : "";
    default:
      return "";
  }
};

/** Ferramentas do MCP em forma de ferramenta do Tool Runner: valida com zod, só mexe no episódio aberto. */
const buildTools = ({ ws, slug, emit, serial, signal }) =>
  CHAT_TOOLS.map((name, i) => {
    const t = TOOLS.find((x) => x.name === name);
    const last = i === CHAT_TOOLS.length - 1;
    return betaZodTool({
      name: t.name,
      description: t.description,
      inputSchema: z.object(t.inputSchema),
      eager_input_streaming: true,
      ...(last ? { cache_control: { type: "ephemeral" } } : {}), // tools → system: o ponto de corte cobre as duas
      run: async (input) => {
        const fail = (message) => {
          emit("tool", { name, summary: clip(message, 90), ok: false });
          throw new Error(message);
        };
        if (input.slug !== undefined && input.slug !== slug) return fail(`O chat só edita o episódio aberto (${slug}); recebi "${input.slug}".`);
        let r;
        try {
          r = await t.run(input, { ws, serial, onProgress: undefined, signal });
        } catch (e) {
          return fail(toolMessage(name, e));
        }
        if (r.error) return fail(r.error);
        emit("tool", { name, summary: summarize(name, input, r.text), ok: true });
        if (MUTATING.has(name)) emit("changed", { scene: input.op?.id ?? input.op?.after ?? null });
        if (!r.images?.length) return r.text;
        return [{ type: "text", text: r.text }, ...r.images.map((im) => ({ type: "image", source: { type: "base64", media_type: im.mimeType, data: im.data } }))];
      },
    });
  });

/* ───────────── a conversa ───────────── */

const REFUSAL = (d) => `O modelo recusou este pedido${d?.category ? ` (categoria: ${d.category})` : ""}${d?.explanation ? `: ${d.explanation}` : "."} Reescreva o pedido de outro jeito ou escolha outro modelo.`;

export const noKeyError = () => new core.VbError("no-key", "Falta a chave da Anthropic: ponha ANTHROPIC_API_KEY no .env.local do espaço de trabalho.");

export const hasChatKey = (ws) => !!readEnv(ws).ANTHROPIC_API_KEY;

/**
 * Um turno do chat. `emit(evento, dados)` recebe: text {delta}, tool {name, summary, ok}, changed {scene}, done, error.
 * Só grava o histórico se o turno terminou limpo (assistente por último, sem tool_use pendente, sem recusa).
 */
export const runChat = async ({ ws, slug, message, emit, serial, signal }) => {
  const env = readEnv(ws);
  if (!env.ANTHROPIC_API_KEY) throw noKeyError();
  const { model, effort } = getChatConfig(ws);
  const info = MODELS.find((m) => m.id === model);
  const hist = loadHistory(ws, slug);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}) });
  const first = hist.messages.length === 0;
  const messages = [...hist.messages, { role: "user", content: first ? `Episódio aberto: ${slug}\n\n${message}` : message }];

  const params = {
    model,
    max_tokens: 32000,
    stream: true,
    thread: false, // o runner usa message threads por padrão; aqui cada pedido leva a conversa inteira do nosso histórico (fonte da verdade)
    max_iterations: 20,
    output_config: { effort }, // sem thinking (adaptativo), sem temperature, sem tool_choice
    cache_control: { type: "ephemeral" },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: buildTools({ ws, slug, emit, serial, signal }),
    messages,
    ...(info.fallback ? { betas: [FALLBACK_BETA], fallbacks: "default" } : {}),
  };

  const runner = client.beta.messages.toolRunner(params, { signal });
  let lastFinal = null;
  let stop = null;
  let usage = null;
  for await (const ms of runner) {
    ms.on("text", (delta) => emit("text", { delta }));
    const final = await ms.finalMessage();
    lastFinal = final;
    usage = final.usage;
    if (final.stop_reason === "refusal") {
      stop = "refusal";
      emit("error", { code: "refusal", message: REFUSAL(final.stop_details) });
      break; // nunca roda as ferramentas de um turno recusado
    }
    if (final.stop_reason === "max_tokens" && final.content.some((b) => b.type === "tool_use")) {
      throw new core.VbError("truncated", "A resposta do modelo foi cortada no meio de uma chamada de ferramenta (limite de tokens). Peça algo menor.");
    }
    stop = final.stop_reason;
  }
  if (!lastFinal) throw new core.VbError("empty", "O modelo não respondeu.");
  if (stop === "refusal") return { saved: false, stop };

  // runner.params.messages tem tudo o que o runner mandou; o último turno do assistente entra por último se faltar.
  const all = [...runner.params.messages];
  if (all[all.length - 1]?.role !== "assistant") all.push({ role: "assistant", content: lastFinal.content });
  const tail = all[all.length - 1];
  if (stop === "tool_use" || (Array.isArray(tail.content) && tail.content.some((b) => b.type === "tool_use"))) {
    emit("error", { code: "unfinished", message: "A conversa parou antes de terminar as ferramentas (limite de passos). Mande outra mensagem para continuar." });
    return { saved: false, stop };
  }
  saveHistory(ws, slug, { model, messages: all });
  emit("done", { stop, usage: { in: usage?.input_tokens, out: usage?.output_tokens, cacheRead: usage?.cache_read_input_tokens, cacheWrite: usage?.cache_creation_input_tokens }, model });
  return { saved: true, stop };
};

/** Histórico para exibir: texto do usuário, texto do assistente e chamadas de ferramenta (com ok/erro). Não mexe no que está em disco. */
export const displayHistory = (ws, slug) => {
  const { model, messages } = loadHistory(ws, slug);
  const results = new Map();
  for (const m of messages) if (m.role === "user" && Array.isArray(m.content)) for (const b of m.content) if (b.type === "tool_result") results.set(b.tool_use_id, b.is_error !== true);
  const items = [];
  for (const m of messages) {
    if (m.role === "user") {
      if (Array.isArray(m.content) && m.content.some((b) => b.type === "tool_result")) continue;
      const text = typeof m.content === "string" ? m.content : m.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      items.push({ role: "user", text: text.replace(/^Episódio aberto: [a-z0-9-]+\n\n/, "") });
    } else if (Array.isArray(m.content)) {
      for (const b of m.content) {
        if (b.type === "text" && b.text.trim()) items.push({ role: "assistant", text: b.text });
        else if (b.type === "tool_use") items.push({ role: "tool", name: b.name, summary: summarize(b.name, b.input), ok: results.get(b.id) ?? true });
      }
    }
  }
  return { model, items };
};
