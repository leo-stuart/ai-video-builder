#!/usr/bin/env node
// CLI do builder de vídeos: cliente fino do core.  node scripts/vid.mjs [--workspace <pasta>] <comando> …
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as core from "../core/index.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let argv = process.argv.slice(2);
let wsArg;
const wi = argv.indexOf("--workspace");
if (wi >= 0) {
  wsArg = argv[wi + 1];
  argv = argv.filter((_, i) => i !== wi && i !== wi + 1);
}
const [cmd, ...args] = argv;
const flag = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i < 0 ? d : (args[i + 1] ?? true);
};
const positional = args.filter((a, i) => !a.startsWith("--") && !(args[i - 1] ?? "").startsWith("--"));
const die = (m) => {
  console.error(m);
  process.exit(1);
};
const progress = ({ step, done, total, label }) => {
  if (step === "plan") console.log(label);
  else if (step === "render" || step === "frames" || step === "voice" || step === "batch") console.log(`  ${done}/${total} ${label ?? ""}`);
};

const HELP = `vid [--workspace <pasta>] <comando>

  init <pasta> --name "Marca"   cria um espaço de trabalho mínimo
  new <slug> [--pauta id | "Título" --format X] [--place Y] [--ficha ficha.json] [--set campo=valor] [--freedom Z] [--model nome]
  formats                       lista os formatos e os campos da ficha de cada um
  pauta [formato]               lista as pautas prontas ainda não usadas (ficha completa, inglês conferido)
  check <slug> [--script]       valida o episódio
  voice <slug> [--provider none]  gera a voz e os tempos
  voices [filtro]               lista as vozes do ElevenLabs e o saldo
  sheet <slug> [--scene id] [--per N]  folhas de revisão
  scene <slug> …                edita uma cena sem abrir arquivo (set, world, replace, insert, move, remove, scene)
  render <slug> [--force]       render por segmentos, com cache
  pack <slug>                   pacote de postagem por plataforma
  batch <slug> [<slug> …]       voz + check + render + pacote de cada episódio (ou lote.json)
  docs                          gera skills/pragma-video/beats.md e formats.md
  forget <slug>                 tira o episódio do histórico de variedade

O espaço de trabalho vem de --workspace, de VB_WORKSPACE ou de ./workspaces/default.
`;

const parseVal = (v) => (v === "true" ? true : v === "false" ? false : v !== "" && !isNaN(Number(v)) ? Number(v) : v);
const kvOf = (list) =>
  Object.fromEntries(
    list.map((pair) => {
      const [k, ...r] = pair.split("=");
      return [k, r.join("=")];
    }),
  );
const allFlags = (n) => args.flatMap((a, i) => (a === `--${n}` && args[i + 1] ? [args[i + 1]] : []));

async function main() {
  if (!cmd || cmd === "help" || cmd === "--help") return console.log(HELP);

  if (cmd === "init") {
    const [dir] = positional;
    if (!dir) die('uso: vid init <pasta> --name "Marca"');
    const r = await core.initWorkspace(dir, { brand: { name: flag("name"), tagline: flag("tagline"), cta: flag("cta") } });
    return console.log(`espaço de trabalho criado em ${r.ws}\nPróximo: ponha formatos em playbook/, a logo em public/img/ e use: vid --workspace ${r.ws} formats`);
  }

  const ws = core.resolveWorkspace(wsArg);

  switch (cmd) {
    case "formats": {
      const list = await core.listFormats(ws);
      if (!list.length) console.log("este espaço de trabalho não tem formatos (playbook/*.json).");
      for (const f of list) {
        console.log(`\n${f.id}: ${f.desc}`);
        for (const s of f.slots) console.log(`  ${s.key}${s.default !== undefined ? " (opcional)" : ""}: ${s.ask}  ex.: ${s.example}`);
      }
      break;
    }

    case "pauta": {
      const free = await core.listPautas(ws, { format: positional[0] });
      if (!free.length) console.log("nenhuma pauta pronta sobrando. Crie a ficha à mão (veja playbook/examples/).");
      for (const p of free) console.log(`${p.recommended ? "→" : " "} ${p.id.padEnd(20)} ${p.format.padEnd(16)} ${p.place.padEnd(11)} ${p.title}`);
      if (free.length) console.log("\n→ = recomendada (formato menos usado nos últimos episódios). Use: vid new epNN-tema --pauta <id>");
      break;
    }

    case "new": {
      const [slug, title] = positional;
      let ficha = {};
      if (flag("ficha")) ficha = JSON.parse(readFileSync(flag("ficha"), "utf8"));
      Object.assign(ficha, kvOf(allFlags("set")));
      const { spec } = await core.createEpisode(ws, { slug, title, pauta: flag("pauta"), format: flag("format"), place: flag("place"), ficha, freedom: flag("freedom"), model: flag("model") });
      const w = spec.world;
      console.log(`criado: episodes/${slug}  formato ${spec.format} · liberdade ${spec.freedom} · lugar ${w.place} · metáfora ${w.metaphor} · câmera ${w.camStyle}`);
      console.log(`próximo: vid check ${slug} --script  →  vid voice ${slug}  →  vid check ${slug}  →  vid sheet ${slug}  →  vid render ${slug}`);
      break;
    }

    case "check": {
      const [slug] = positional;
      if (!slug) die("uso: vid check <slug> [--script]");
      const r = await core.validate(ws, slug, { scriptOnly: !!flag("script") });
      for (const e of r.errors) console.log(`ERRO   ${e.message}`);
      for (const w of r.warnings) console.log(`AVISO  ${w.message}`);
      console.log(`\n${slug}: ${r.errors.length} erro(s), ${r.warnings.length} aviso(s)${r.ok ? ". Pode seguir." : ""}`);
      process.exitCode = r.ok ? 0 : 1;
      break;
    }

    case "voice": {
      const [slug] = positional;
      if (!slug) die("uso: vid voice <slug> [--provider say|elevenlabs|openai|none] [--force]");
      const r = await core.voice(ws, slug, { provider: flag("provider"), force: !!flag("force"), onProgress: progress });
      for (const w of r.warnings) console.log(`aviso: ${w}`);
      console.log(`\n${slug}: ${r.seconds.toFixed(1)}s no total, voz "${r.provider}"`);
      break;
    }

    case "voices": {
      const list = await core.listVoices(ws, { filter: positional[0] });
      if (!list) die("falta ELEVENLABS_API_KEY em .env.local do espaço de trabalho.");
      for (const v of list) console.log(`${v.id}  ${v.name.padEnd(28)} ${v.info}`);
      const b = await core.voiceBalance(ws);
      if (b) console.log(`\nplano: ${b.plan} · créditos usados: ${b.used} de ${b.limit}`);
      break;
    }

    case "sheet": {
      const [slug] = positional;
      if (!slug) die("uso: vid sheet <slug> [--per 2] [--scene <id>]");
      const r = await core.frames(ws, slug, { scene: flag("scene"), per: flag("per"), onProgress: progress });
      console.log(`\nfolhas (abra e olhe cada uma):\n${r.sheets.join("\n")}`);
      break;
    }

    case "scene": {
      const [slug, kind, id] = positional;
      if (!slug || !kind) die("uso: vid scene <slug> set|world|replace|insert|move|remove|scene <id> …");
      const pairs = allFlags("set").concat(positional.slice(kind === "world" ? 2 : 3).filter((a) => a.includes("=")));
      const raw = kvOf(pairs);
      const fields = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, ["narration", "sub", "speaker", "banner"].includes(k) || kind === "world" ? v : parseVal(v)]));
      let op;
      if (kind === "set") op = { type: "set", id, fields };
      else if (kind === "world") op = { type: "world", fields };
      else if (kind === "replace") op = { type: "replace", id, beatType: flag("type"), narration: flag("narration"), fields };
      else if (kind === "insert") {
        op = { type: "insert", after: id, id: flag("id"), beatType: flag("type"), narration: flag("narration"), fields };
        for (const k of ["speaker", "sub", "banner"]) if (flag(k)) op[k] = flag(k);
        if (flag("hold")) op.hold = Number(flag("hold"));
      } else if (kind === "move") op = { type: "move", id, after: flag("after") };
      else if (kind === "remove") op = { type: "remove", id };
      else if (kind === "scene") {
        const j = flag("json") ?? die("--json '<cena em dados>' é obrigatório.");
        try {
          op = { type: "scene", id, scene: JSON.parse(j.startsWith("@") ? readFileSync(j.slice(1), "utf8") : j) };
        } catch (e) {
          die(`JSON inválido: ${e.message}`);
        }
      } else op = { type: kind };
      await core.editScene(ws, slug, op);
      console.log(`ok: ${slug} (${kind}${id ? " " + id : ""}). Se mudou a narração, rode: vid voice ${slug}`);
      break;
    }

    case "render": {
      const [slug] = positional;
      if (!slug) die("uso: vid render <slug> [--force]");
      const r = await core.render(ws, slug, { force: !!flag("force"), onProgress: progress });
      for (const w of r.warnings) console.log(`aviso: ${w}`);
      console.log(`vídeo: ${r.video}`);
      break;
    }

    case "pack": {
      const [slug] = positional;
      if (!slug) die("uso: vid pack <slug>");
      console.log(`pacote: ${(await core.pack(ws, slug)).dir}`);
      break;
    }

    case "batch": {
      if (!positional.length) die("uso: vid batch <slug> [<slug> …]  ou  vid batch lote.json");
      const jobs = positional[0].endsWith(".json") ? JSON.parse(readFileSync(positional[0], "utf8")) : positional.map((slug) => ({ slug }));
      const report = await core.batch(ws, jobs, { provider: flag("provider"), redo: !!flag("redo"), onProgress: progress });
      for (const r of report) console.log(r.ok ? `✓ ${r.slug}: pronto em out/${r.slug}/` : `✗ ${r.slug}: ${r.error}`);
      const bad = report.filter((r) => !r.ok).length;
      console.log(`\n${report.length - bad} de ${report.length} prontos${bad ? `; ${bad} com erro (rode de novo para retomar do ponto em que parou)` : ""}.`);
      if (bad) process.exitCode = 1;
      break;
    }

    case "docs": {
      const d = await core.generateDocs(ws);
      const out = join(root, "skills/pragma-video");
      writeFileSync(join(out, "beats.md"), d.beats);
      writeFileSync(join(out, "formats.md"), d.formats);
      console.log("gerado: skills/pragma-video/beats.md e formats.md");
      break;
    }

    case "forget": {
      const [slug] = positional;
      if (!slug) die("uso: vid forget <slug>");
      await core.forget(ws, slug);
      console.log(`${slug} saiu do histórico de variedade.`);
      break;
    }

    default:
      console.log(HELP);
  }
}

try {
  await main();
} catch (e) {
  if (e instanceof core.VbError) die(`ERRO: ${e.message}`);
  throw e;
}
