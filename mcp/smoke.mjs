// Teste de fumaça do servidor MCP: sobe o servidor como subprocesso e exercita as ferramentas.
//   node mcp/smoke.mjs [--render]     (usa VB_WORKSPACE=workspaces/pragma; --render também renderiza ep15-teste-sonnet, em cache)
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const WS = resolve(root, "workspaces/pragma");
const LEDGER = join(WS, "ledger.json");
const digest = () => (existsSync(LEDGER) ? createHash("sha1").update(readFileSync(LEDGER)).digest("hex") : "(sem ledger)");
const TMP = "ep91-mcp-tmp";
let bad = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) bad++;
  console.log(`${cond ? "OK   " : "FALHA"} ${name}${extra ? " — " + extra : ""}`);
};
const json = (r) => JSON.parse(r.content.find((c) => c.type === "text").text);

const transport = new StdioClientTransport({ command: process.execPath, args: [join(root, "mcp/server.mjs")], cwd: root, env: { ...process.env, VB_WORKSPACE: "workspaces/pragma" }, stderr: "pipe" });
transport.stderr?.on("data", (d) => process.stderr.write(`  [servidor] ${d}`));
const client = new Client({ name: "smoke", version: "1.0.0" });
const call = (name, args = {}) => client.callTool({ name, arguments: args });

const before = digest();
await client.connect(transport);
try {
  const inst = client.getInstructions() ?? "";
  ok("instruções do servidor", inst.length > 500, `${inst.split("\n").length} linhas`);
  const prompts = await client.listPrompts();
  ok("prompt novo_video listado", prompts.prompts.some((p) => p.name === "novo_video"));
  const pr = await client.getPrompt({ name: "novo_video", arguments: { tema: "pedir café" } });
  ok("getPrompt novo_video", pr.messages[0].content.text.includes("pedir café"));

  const tools = (await client.listTools()).tools.map((t) => t.name);
  const want = ["list_formats", "list_beats", "list_pautas", "list_episodes", "get_episode", "create_episode", "edit_scene", "validate", "voice_balance", "generate_voice", "review_frames", "render", "pack", "delete_episode", "get_workspace"];
  ok("lista de ferramentas", want.every((n) => tools.includes(n)) && tools.length === want.length, tools.join(", "));

  const ws = json(await call("get_workspace"));
  ok("get_workspace", !!ws.config.brand?.name, ws.config.brand?.name);
  ok("list_formats", json(await call("list_formats")).length > 0);
  ok("list_beats", json(await call("list_beats")).length > 0);

  const pautas = json(await call("list_pautas"));
  ok("list_pautas", pautas.length > 0 && pautas[0].recommended, `${pautas.length} pautas, recomendada: ${pautas[0]?.id}`);
  const eps = json(await call("list_episodes"));
  ok("list_episodes", eps.some((e) => e.slug === "ep14-teste-haiku"), eps.map((e) => `${e.slug}:${e.status}`).join(" "));
  const g = json(await call("get_episode", { slug: "ep14-teste-haiku" }));
  ok("get_episode", g.scenes.length > 5, `${g.scenes.length} cenas, status ${g.status}`);
  const v = json(await call("validate", { slug: "ep14-teste-haiku" }));
  ok("validate ep14-teste-haiku", Array.isArray(v.errors), `ok=${v.ok}, ${v.errors.length} erros, ${v.warnings.length} avisos`);

  const bal = await call("voice_balance");
  ok("voice_balance", !bal.isError, bal.content[0].text.slice(0, 80));

  const nv = await call("get_episode", { slug: "nao-existe" });
  ok("VbError vira isError", nv.isError === true, nv.content[0].text.slice(0, 100));

  const sem = await call("generate_voice", { slug: "ep14-teste-haiku" });
  ok("generate_voice sem confirm recusa", sem.isError === true && /confirm=true/.test(sem.content[0].text), sem.content[0].text.slice(0, 90));
  const sem2 = await call("generate_voice", { slug: "ep14-teste-haiku", provider: "elevenlabs", confirm: false });
  ok("generate_voice elevenlabs confirm=false recusa", sem2.isError === true);

  // Episódio descartável
  const c = await call("create_episode", { slug: TMP, pauta: pautas[0].id, model: "haiku" });
  const ce = c.isError ? {} : json(c);
  ok("create_episode", !c.isError && ce.scenes.length > 5, c.isError ? c.content[0].text : `${ce.format}, ${ce.freedom}, ${ce.scenes.length} cenas`);
  try {
    const first = ce.scenes[0].id;
    const vs = json(await call("validate", { slug: TMP, scriptOnly: true }));
    ok("validate scriptOnly", Array.isArray(vs.errors), `ok=${vs.ok}, ${vs.errors.length} erros`);

    const prog = [];
    const gv = await client.callTool({ name: "generate_voice", arguments: { slug: TMP, provider: "none" } }, undefined, { onprogress: (p) => prog.push(p) });
    ok("generate_voice provider none", !gv.isError, gv.isError ? gv.content[0].text : `${json(gv).seconds}s, ${prog.length} notificações de progresso`);

    const es = await call("edit_scene", { slug: TMP, op: { type: "set", id: first, fields: { sub: "teste mcp" } } });
    ok("edit_scene set", !es.isError, es.content[0].text.slice(0, 80));
    const eg = await call("edit_scene", { slug: TMP, op: { type: "world", fields: { place: "loja" } } });
    ok("edit_scene world em recipe recusa", eg.isError === true, eg.content[0].text.slice(0, 90));
    const vf = json(await call("validate", { slug: TMP }));
    ok("validate completo", Array.isArray(vf.errors), `ok=${vf.ok}, ${vf.errors.length} erros, ${vf.warnings.length} avisos`);

    const fprog = [];
    const rf = await client.callTool({ name: "review_frames", arguments: { slug: TMP, scene: first } }, undefined, { timeout: 300000, onprogress: (p) => fprog.push(p) });
    const imgs = rf.content.filter((x) => x.type === "image");
    const bytes = imgs.map((i) => Buffer.from(i.data, "base64").length);
    const jpeg = imgs.every((i) => i.mimeType === "image/jpeg" && Buffer.from(i.data, "base64").subarray(0, 2).toString("hex") === "ffd8");
    ok("review_frames devolve imagem", !rf.isError && imgs.length >= 1 && jpeg, rf.isError ? rf.content[0].text : `${imgs.length} imagem(ns), ${bytes.join("+")} bytes, ${fprog.length} notificações de progresso`);
  } finally {
    const dl = await call("delete_episode", { slug: TMP });
    ok("delete_episode", !dl.isError);
    ok("episódio sumiu", !json(await call("list_episodes")).some((e) => e.slug === TMP));
  }

  if (process.argv.includes("--render")) {
    const rp = [];
    const r = await client.callTool({ name: "render", arguments: { slug: "ep15-teste-sonnet" } }, undefined, { timeout: 600000, onprogress: (p) => rp.push(p) });
    ok("render ep15-teste-sonnet", !r.isError, `${r.content[0].text.slice(0, 160)} (${rp.length} notificações)`);
  }
} finally {
  await client.close();
}
const after = digest();
ok("ledger.json igual ao de antes", before === after, `${before.slice(0, 10)} → ${after.slice(0, 10)}`);
console.log(bad ? `\n${bad} falha(s)` : "\ntudo certo");
process.exit(bad ? 1 : 0);
