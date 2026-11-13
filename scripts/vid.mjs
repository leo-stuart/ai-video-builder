#!/usr/bin/env node
// CLI do builder de vídeos do Pragma.  node scripts/vid.mjs <comando> …
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { OPT, config, createEpisode, epDir, formats, isSpec, loadFormat, pautas, readLedger, readSpec, root, writeLedger, writeSpec } from "./lib/spec.mjs";

const [cmd, ...args] = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i < 0 ? d : (args[i + 1] ?? true);
};
const positional = args.filter((a, i) => !a.startsWith("--") && !(args[i - 1] ?? "").startsWith("--"));
const run = (script, a) => {
  const r = spawnSync("node", [join(root, "scripts", script), ...a], { stdio: "inherit", cwd: root });
  if (r.status) process.exit(r.status);
};
const die = (m) => {
  console.error(m);
  process.exit(1);
};

const HELP = `vid <comando>

  new <slug> [--pauta id | "Título" --format X] [--place Y] [--ficha ficha.json] [--set campo=valor] [--freedom Z] [--model nome]
  formats                       lista os formatos e os campos da ficha de cada um
  pauta [formato]               lista as pautas prontas ainda não usadas (ficha completa, inglês conferido)
  check <slug> [--script]       valida o episódio
  voice <slug> [--provider none]  gera a voz e os tempos
  sheet <slug> [--scene id]     folhas de revisão
  scene <slug> …                edita uma cena sem abrir arquivo (set, replace, insert, move, remove)
  render <slug> [--force]       render por segmentos, com cache
  pack <slug>                   pacote de postagem por plataforma
  batch <slug> [<slug> …]       voz + check + render + pacote de cada episódio
  docs                          gera skills/pragma-video/beats.md e formats.md
  forget <slug>                 tira o episódio do histórico de variedade
`;

const freedomFor = () => {
  const cfg = config();
  const explicit = flag("freedom");
  if (explicit) return explicit;
  if (cfg.freedom !== "auto") return cfg.freedom;
  const m = String(flag("model", "")).toLowerCase();
  const hit = Object.keys(cfg.models).find((k) => m.includes(k));
  return hit ? cfg.models[hit] : "recipe";
};

switch (cmd) {
  case "formats":
    for (const f of formats()) {
      console.log(`\n${f.id}: ${f.desc}`);
      for (const s of f.slots) console.log(`  ${s.key}${s.default !== undefined ? " (opcional)" : ""}: ${s.ask}  ex.: ${s.example}`);
    }
    break;

  case "pauta": {
    const used = new Set(readLedger().map((e) => e.pauta).filter(Boolean));
    const free = pautas().filter((p) => !used.has(p.id) && (!positional[0] || p.format === positional[0]));
    if (!free.length) console.log("nenhuma pauta pronta sobrando. Crie a ficha à mão (veja formats/examples/).");
    // O formato menos usado nos últimos episódios vem primeiro: é a recomendação.
    const recent = readLedger().slice(-config().variety.window);
    const uses = (f) => recent.filter((e) => e.format === f).length;
    free.sort((a, b) => uses(a.format) - uses(b.format));
    free.forEach((p, i) => console.log(`${i === 0 ? "→" : " "} ${p.id.padEnd(20)} ${p.format.padEnd(16)} ${p.place.padEnd(11)} ${p.title}`));
    if (free.length) console.log("\n→ = recomendada (formato menos usado nos últimos episódios). Use: vid new epNN-tema --pauta <id>");
    break;
  }

  case "new": {
    let [slug, title] = positional;
    let pautaId;
    let formatFlag = flag("format");
    let placeFlag = flag("place");
    let ficha = {};
    if (flag("pauta")) {
      const p = pautas().find((x) => x.id === flag("pauta")) ?? die(`pauta "${flag("pauta")}" não existe. Veja: vid pauta`);
      pautaId = p.id;
      title ??= p.title;
      formatFlag ??= p.format;
      placeFlag ??= p.place;
      ficha = { ...p.ficha };
    }
    if (!slug || !/^ep\d\d-[a-z0-9-]+$/.test(slug) || !title) die('uso: vid new epNN-tema --pauta <id>   ou   vid new epNN-tema "Título" --format X --ficha ficha.json');
    if (existsSync(epDir(slug))) die(`já existe: ${epDir(slug)}`);
    if (flag("ficha")) ficha = { ...ficha, ...JSON.parse(readFileSync(flag("ficha"), "utf8")) };
    args.forEach((a, i) => {
      if (a === "--set") {
        const [k, ...v] = args[i + 1].split("=");
        ficha[k] = v.join("=");
      }
    });
    const place = placeFlag;
    if (place && !OPT.place.includes(place)) die(`--place "${place}" não existe. Lugares: ${OPT.place.join(", ")}`);
    let out;
    try {
      out = createEpisode({ slug, title, formatId: formatFlag, ficha, place, freedom: freedomFor(), pautaId });
    } catch (e) {
      die(e.message);
    }
    writeSpec(out.spec);
    writeLedger([...readLedger().filter((e) => e.slug !== slug), out.fingerprint]);
    const w = out.spec.world;
    console.log(`criado: src/episodes/${slug}  formato ${out.spec.format} · liberdade ${out.spec.freedom} · lugar ${w.place} · metáfora ${w.metaphor} · câmera ${w.camStyle}`);
    console.log(`próximo: vid check ${slug} --script  →  vid voice ${slug}  →  vid check ${slug}  →  vid sheet ${slug}  →  vid render ${slug}`);
    break;
  }

  case "check":
    run("check.mjs", args);
    break;
  case "voice":
    run("tts.mjs", args);
    break;
  case "sheet":
    run("sheet.mjs", args);
    break;
  case "forget": {
    const [slug] = positional;
    writeLedger(readLedger().filter((e) => e.slug !== slug));
    console.log(`${slug} saiu do histórico de variedade.`);
    break;
  }

  case "scene":
  case "render":
  case "pack":
  case "batch":
  case "docs": {
    const mod = await import(`./lib/cmd-${cmd}.mjs`).catch((e) => die(`comando "${cmd}" ainda não disponível: ${e.message}`));
    await mod.default({ args, positional, flag, die });
    break;
  }

  default:
    console.log(HELP);
}
