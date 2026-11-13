#!/usr/bin/env node
// UI local do builder: um processo só. Vite em modo middleware (app em ui/app/) + o core por HTTP em /api/*.
// Só escuta em 127.0.0.1. Nunca publica nada nem envia arquivo para fora.
//   node ui/server.mjs [--port 4173] [--workspace <pasta>]   (ou VB_WORKSPACE)
import { createServer } from "node:http";
import { createReadStream, existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, dirname, extname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import react from "@vitejs/plugin-react";
import { createServer as createVite } from "vite";
import * as core from "../core/index.mjs";
import { EFFORTS, MODELS, clearHistory, removeHistory, displayHistory, getChatConfig, hasChatKey, noKeyError, runChat, setChatConfig } from "./chat.mjs";

const UI = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(UI, "..");

/* ───────────── argumentos ───────────── */
const argv = process.argv.slice(2);
const arg = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const PORT = Number(arg("port") ?? process.env.PORT ?? 4173);
const HOST = "127.0.0.1";
let WS;
try {
  WS = core.resolveWorkspace(arg("workspace"));
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

/* ───────────── utilidades HTTP ───────────── */
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  res.end(JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 2e6) reject(new core.VbError("too-big", "corpo grande demais."));
    });
    req.on("end", () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new core.VbError("bad-json", "corpo da requisição não é JSON válido."));
      }
    });
    req.on("error", reject);
  });
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const slugOf = (s) => {
  if (!SLUG.test(s ?? "")) throw new core.VbError("bad-slug", `slug inválido: "${s}".`);
  return s;
};

const MIME = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".mp4": "video/mp4",
  ".ttf": "font/ttf", ".otf": "font/otf", ".woff": "font/woff", ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8", ".json": "application/json; charset=utf-8", ".csv": "text/csv; charset=utf-8",
};

/** Serve um arquivo (com Range, para áudio e vídeo) só se ele estiver, de verdade, dentro de uma das raízes. */
const serveFile = (req, res, roots, rel) => {
  let decoded;
  try {
    decoded = decodeURIComponent(rel);
  } catch {
    return send(res, 400, { code: "bad-path", message: "caminho inválido." });
  }
  if (decoded.includes("\0") || decoded.split(/[\\/]/).some((p) => p === ".." )) return send(res, 400, { code: "bad-path", message: "caminho inválido." });
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const base = realpathSync(root);
    const cand = join(base, decoded);
    if (!existsSync(cand)) continue;
    const real = realpathSync(cand);
    if (!real.startsWith(base + sep)) continue;
    const st = statSync(real);
    if (!st.isFile()) continue;
    const type = MIME[extname(real).toLowerCase()];
    if (!type) return send(res, 415, { code: "bad-type", message: "tipo de arquivo não servido." });
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
    const head = { "content-type": type, "accept-ranges": "bytes", "cache-control": "no-cache" };
    if (range) {
      const start = range[1] ? Number(range[1]) : Math.max(0, st.size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
      if (start > end || start >= st.size) {
        res.writeHead(416, { "content-range": `bytes */${st.size}` });
        return res.end();
      }
      res.writeHead(206, { ...head, "content-range": `bytes ${start}-${end}/${st.size}`, "content-length": end - start + 1 });
      return req.method === "HEAD" ? res.end() : createReadStream(real, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...head, "content-length": st.size });
    return req.method === "HEAD" ? res.end() : createReadStream(real).pipe(res);
  }
  return send(res, 404, { code: "not-found", message: "arquivo não encontrado." });
};

const P = {
  public: join(WS, "public"),
  enginePublic: join(ENGINE, "public"),
  qa: join(WS, ".qa"),
  out: join(WS, "out"),
};
// Mesma regra de preparePublic: o motor vence o espaço de trabalho em nomes repetidos.
const publicTop = () => new Set([P.enginePublic, P.public].flatMap((d) => (existsSync(d) ? readdirSync(d).filter((n) => !n.startsWith(".")) : [])));

/* ───────────── tarefas longas ───────────── */
const jobs = new Map();
const busy = { episode: new Map(), bundle: null }; // uma por episódio; as que montam o bundle (folhas, render) uma por vez no processo
const chatting = new Set(); // slugs com um turno de chat em andamento (um chat por vez por episódio; não roda junto com tarefa do mesmo episódio)

const publicJob = (j) => ({ id: j.id, kind: j.kind, slug: j.slug, status: j.status, progress: j.progress, result: j.result, error: j.error, startedAt: j.startedAt, endedAt: j.endedAt });

const startJob = (kind, slug, run, { usesBundle = false } = {}) => {
  const current = busy.episode.get(slug);
  if (current) throw new core.VbError("busy", `já existe uma tarefa em andamento neste episódio (${jobs.get(current).kind}). Espere terminar.`, { jobId: current });
  if (chatting.has(slug)) throw new core.VbError("busy", "o chat está editando este episódio agora. Espere a resposta terminar.");
  if (usesBundle && busy.bundle) throw new core.VbError("busy", `outra tarefa de imagem/vídeo está em andamento (${jobs.get(busy.bundle)?.kind ?? "chat"} de ${jobs.get(busy.bundle)?.slug ?? busy.bundle.replace("chat:", "")}). Espere terminar.`, { jobId: busy.bundle });
  const job = { id: randomUUID().slice(0, 8), kind, slug, status: "running", progress: { step: "start", done: 0, total: 0, label: "começando" }, result: null, error: null, startedAt: Date.now() };
  jobs.set(job.id, job);
  busy.episode.set(slug, job.id);
  if (usesBundle) busy.bundle = job.id;
  const release = () => {
    busy.episode.delete(slug);
    if (busy.bundle === job.id) busy.bundle = null;
    job.endedAt = Date.now();
  };
  Promise.resolve()
    .then(() => run((p) => (job.progress = { ...job.progress, ...p })))
    .then((r) => {
      job.result = r;
      job.status = "done";
    })
    .catch((e) => {
      job.status = "error";
      job.error = { code: e.code ?? "error", message: e.message ?? String(e) };
    })
    .finally(release);
  return job;
};

const lastJobOf = (slug) => [...jobs.values()].filter((j) => j.slug === slug).sort((a, b) => b.startedAt - a.startedAt)[0];

/* ───────────── chat (SSE) ───────────── */
const chat = async (req, res, slug, body) => {
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) throw new core.VbError("empty", "mensagem vazia.");
  if (message.length > 20000) throw new core.VbError("too-big", "mensagem grande demais.");
  if (!hasChatKey(WS)) throw noKeyError();
  await core.getEpisode(WS, slug); // erro claro se o episódio não existe
  if (chatting.has(slug)) throw new core.VbError("busy", "o chat já está respondendo neste episódio.");
  if (busy.episode.has(slug)) throw new core.VbError("busy", `há uma tarefa em andamento neste episódio (${jobs.get(busy.episode.get(slug))?.kind}). Espere terminar.`);
  chatting.add(slug);
  res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", connection: "keep-alive", "x-accel-buffering": "no" });
  const emit = (event, data) => {
    if (!res.writableEnded && !res.destroyed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  // Folhas de revisão montam o bundle: uma tarefa de imagem/vídeo por vez no processo, como nas tarefas da UI.
  const serial = async (fn) => {
    if (busy.bundle) throw new core.VbError("busy", `outra tarefa de imagem/vídeo está em andamento (${jobs.get(busy.bundle)?.kind ?? "chat"}). Tente de novo quando terminar.`);
    const mine = `chat:${slug}`;
    busy.bundle = mine;
    try {
      return await fn();
    } finally {
      if (busy.bundle === mine) busy.bundle = null;
    }
  };
  // Se a aba fechar no meio, o turno termina no servidor (as edições já feitas ficam e o histórico é gravado).
  try {
    await runChat({ ws: WS, slug, message, emit, serial });
  } catch (e) {
    const msg = e?.name === "VbError" ? e.message : e instanceof Anthropic.APIError ? `API da Anthropic (${e.status ?? "?"}): ${e.message}` : (e?.message ?? String(e));
    if (!(e?.name === "VbError")) console.error("[chat]", e);
    emit("error", { code: e?.code ?? "error", message: msg });
  } finally {
    chatting.delete(slug);
    res.end();
  }
};

/* ───────────── rotas da API ───────────── */
const outFiles = (slug) => {
  const dir = join(P.out, slug);
  return existsSync(dir) ? readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile()).sort() : [];
};

const hasKey = async () => {
  try {
    return (await core.voiceBalance(WS)) !== null;
  } catch {
    return true; // há chave, mas a consulta falhou
  }
};

const api = async (req, res, url) => {
  const m = req.method;
  const parts = url.pathname.split("/").filter(Boolean).slice(1); // sem "api"
  const body = m === "POST" || m === "PATCH" || m === "PUT" ? await readBody(req) : {};
  const q = url.searchParams;
  const [a, b, c] = parts;

  if (a === "workspace" && b === "chat") {
    const info = () => ({ ...getChatConfig(WS), models: MODELS.map(({ id, label, price }) => ({ id, label, price })), efforts: EFFORTS, hasKey: hasChatKey(WS) });
    if (m === "GET") return send(res, 200, info());
    if (m === "PATCH" || m === "PUT" || m === "POST") {
      const cur = getChatConfig(WS);
      setChatConfig(WS, { model: body.model ?? cur.model, effort: body.effort ?? cur.effort });
      return send(res, 200, info());
    }
  }
  if (a === "workspace" && m === "GET") {
    const cfg = await core.getWorkspace(WS);
    return send(res, 200, { path: WS, brand: cfg.brand, freedom: cfg.freedom, models: cfg.models, rules: cfg.rules });
  }
  if (a === "formats" && m === "GET") return send(res, 200, await core.listFormats(WS));
  if (a === "beats" && m === "GET") return send(res, 200, await core.listBeats());
  if (a === "pautas" && m === "GET") return send(res, 200, await core.listPautas(WS, { format: q.get("format") ?? undefined }));

  if (a === "voice" && b === "balance" && m === "GET") {
    // Consulta de saldo (somente leitura, não gasta créditos). null = sem chave.
    try {
      return send(res, 200, { balance: await core.voiceBalance(WS) });
    } catch (e) {
      return send(res, 200, { balance: null, error: e.message });
    }
  }

  if (a === "jobs" && b && m === "GET") {
    const j = jobs.get(b);
    return j ? send(res, 200, publicJob(j)) : send(res, 404, { code: "no-job", message: "tarefa não encontrada (o servidor foi reiniciado?)." });
  }

  if (a === "episodes") {
    if (!b) {
      if (m === "GET") return send(res, 200, await core.listEpisodes(WS));
      if (m === "POST") {
        const slug = slugOf(body.slug);
        const { spec, world } = await core.createEpisode(WS, { slug, title: body.title || undefined, pauta: body.pauta || undefined, format: body.format || undefined, ficha: body.ficha, place: body.place || undefined, freedom: body.freedom || undefined });
        return send(res, 201, { slug, spec, world });
      }
    } else {
      const slug = slugOf(b);
      if (!c) {
        if (m === "GET") {
          const ep = await core.getEpisode(WS, slug);
          const props = await core.inputPropsOf(WS, slug);
          const job = lastJobOf(slug);
          return send(res, 200, { ...ep, brand: props.brand, files: { video: existsSync(join(P.out, `${slug}.mp4`)), pack: outFiles(slug) }, job: job && job.status === "running" ? publicJob(job) : null });
        }
        if (m === "DELETE") {
          if (busy.episode.has(slug) || chatting.has(slug)) throw new core.VbError("busy", "há uma tarefa ou uma conversa em andamento neste episódio.");
          const r = await core.deleteEpisode(WS, slug);
          removeHistory(WS, slug);
          return send(res, 200, r);
        }
      }
      if (c === "chat") {
        if (m === "GET") return send(res, 200, { ...displayHistory(WS, slug), busy: chatting.has(slug) });
        if (m === "DELETE") {
          if (chatting.has(slug)) throw new core.VbError("busy", "o chat está respondendo; espere terminar para limpar.");
          clearHistory(WS, slug);
          return send(res, 200, { ok: true });
        }
        if (m === "POST") return chat(req, res, slug, body);
      }
      if (c === "scene" && (m === "POST" || m === "PATCH")) return send(res, 200, await core.editScene(WS, slug, body.op ?? body));
      if (c === "validate" && m === "GET") return send(res, 200, await core.validate(WS, slug, { scriptOnly: q.get("scriptOnly") === "1" }));
      if (c === "job" && m === "GET") {
        const j = lastJobOf(slug);
        return send(res, 200, j ? publicJob(j) : null);
      }
      if (c === "voice" && m === "POST") {
        const provider = body.provider || undefined;
        // Gasto de voz só com confirmação explícita: nunca disparado sem `confirm: true`, salvo provedores sem custo.
        if (provider !== "none" && provider !== "say" && body.confirm !== true) throw new core.VbError("confirm", "gerar voz pode gastar créditos: envie confirm: true depois de mostrar as falas ao usuário.");
        const job = startJob("voice", slug, (onProgress) => core.voice(WS, slug, { provider, force: body.force === true, onProgress }));
        return send(res, 202, { jobId: job.id });
      }
      if (c === "frames" && m === "POST") {
        const job = startJob(
          "frames",
          slug,
          async (onProgress) => {
            const r = await core.frames(WS, slug, { scene: body.scene || undefined, per: body.per || undefined, onProgress });
            return { sheets: r.sheets.map((f) => `/files/qa/${encodeURIComponent(basename(f))}?v=${Date.now()}`), frames: r.frames };
          },
          { usesBundle: true },
        );
        return send(res, 202, { jobId: job.id });
      }
      if (c === "render" && m === "POST") {
        const job = startJob(
          "render",
          slug,
          async (onProgress) => {
            const r = await core.render(WS, slug, { force: body.force === true, onProgress });
            return { ...r, video: `/files/out/${slug}.mp4?v=${Date.now()}` };
          },
          { usesBundle: true },
        );
        return send(res, 202, { jobId: job.id });
      }
      if (c === "pack" && m === "POST") {
        const job = startJob("pack", slug, async () => {
          const r = await core.pack(WS, slug);
          return { files: r.files.map((f) => ({ name: basename(f), url: `/files/out/${slug}/${encodeURIComponent(basename(f))}?v=${Date.now()}` })) };
        });
        return send(res, 202, { jobId: job.id });
      }
    }
  }
  return send(res, 404, { code: "not-found", message: `rota ${m} ${url.pathname} não existe.` });
};

/* ───────────── arquivos do workspace (somente leitura) ───────────── */
const files = (req, res, url) => {
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { code: "method", message: "somente leitura." });
  const [, , area, ...rest] = url.pathname.split("/"); // "", "files", area, ...
  const rel = rest.join("/");
  if (area === "qa") return /^[^/]+\.jpg$/i.test(decodeURIComponent(rel)) ? serveFile(req, res, [P.qa], rel) : send(res, 404, { code: "not-found", message: "folha não encontrada." });
  if (area === "out") {
    // out/<slug>.mp4 ou out/<slug>/<arquivo do pacote>
    const r = decodeURIComponent(rel);
    if (/^[a-z0-9-]+\.mp4$/.test(r) || /^[a-z0-9-]+\/[\w.-]+\.(mp4|txt|jpg|json)$/.test(r)) return serveFile(req, res, [P.out], rel);
    return send(res, 404, { code: "not-found", message: "arquivo não encontrado." });
  }
  if (area === "audio") return serveFile(req, res, [join(P.public, "audio")], rel);
  if (area === "img") return serveFile(req, res, [join(P.public, "img")], rel);
  return send(res, 404, { code: "not-found", message: "área desconhecida." });
};

/* ───────────── servidor ───────────── */
const vite = await createVite({
  root: join(UI, "app"),
  configFile: false,
  plugins: [react()],
  appType: "spa",
  server: { middlewareMode: true, fs: { allow: [ENGINE] }, hmr: false },
  optimizeDeps: { include: ["react", "react-dom/client", "react/jsx-runtime", "remotion", "@remotion/player", "@remotion/fonts", "@remotion/three", "three", "@react-three/fiber"] },
  clearScreen: false,
  logLevel: "warn",
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}`);
  try {
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    if (url.pathname.startsWith("/files/")) return files(req, res, url);
    // staticFile() do Remotion resolve "/fonts/…", "/sfx/…", "/audio/…", "/img/…" na raiz.
    const top = url.pathname.split("/")[1];
    if ((req.method === "GET" || req.method === "HEAD") && top && publicTop().has(top)) {
      const rel = url.pathname.slice(1);
      return serveFile(req, res, [P.enginePublic, P.public], rel);
    }
  } catch (e) {
    if (e?.name === "VbError") return send(res, 400, { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) });
    console.error(e);
    return send(res, 500, { code: "internal", message: e?.message ?? String(e) });
  }
  vite.middlewares(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Builder de vídeos: http://${HOST}:${PORT}  (workspace: ${WS})`);
});

const stop = () => {
  server.close();
  vite.close().finally(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
