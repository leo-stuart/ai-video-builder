#!/usr/bin/env node
// Folha de contato: quadros do episódio lado a lado, cada um com o id da cena
// e o segundo, para revisar sem assistir. Sai em .qa/<slug>-sheet-N.jpg, 12
// quadros por folha. ABRA AS IMAGENS E OLHE antes de renderizar.
//
//   node scripts/sheet.mjs <slug>                 2 quadros por cena (começo e fim)
//   node scripts/sheet.mjs <slug> --per 4         mais quadros por cena
//   node scripts/sheet.mjs <slug> --scene trava   só uma cena, maior (use para consertar)
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const slug = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!slug) {
  console.error("uso: node scripts/sheet.mjs <slug> [--per 2] [--scene <id>]");
  process.exit(1);
}
const only = opt("scene");
const per = Number(opt("per", only ? 6 : 2));
const FPS = 30;
const dir = join(root, "src/episodes", slug);
const script = JSON.parse(readFileSync(join(dir, "script.json"), "utf8"));
const timing = existsSync(join(dir, "timing.json")) ? JSON.parse(readFileSync(join(dir, "timing.json"), "utf8")) : { scenes: {} };
if (only && !script.scenes.some((s) => s.id === only)) {
  console.error(`cena "${only}" não existe. Cenas: ${script.scenes.map((s) => s.id).join(", ")}`);
  process.exit(1);
}

// Dois quadros por cena pegam os dois planos: um aos 22% (antes do corte) e um aos 88% (tudo já entrou).
const fractions = per === 1 ? [0.85] : per === 2 ? [0.22, 0.88] : Array.from({ length: per }, (_, i) => 0.08 + (0.86 * i) / (per - 1));
const frames = [];
let from = 0;
for (const s of script.scenes) {
  const dur = (timing.scenes[s.id]?.dur ?? s.narration.split(/\s+/).length * 0.36 + 0.4) + (s.hold ?? 0);
  const n = Math.max(1, Math.round(dur * FPS));
  if (!only || only === s.id) for (const f of fractions) frames.push({ id: s.id, frame: from + Math.min(n - 1, Math.round(n * f)), t: (from + n * f) / FPS });
  from += n;
}

const qa = join(root, ".qa");
const tmp = join(qa, `${slug}-frames`);
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
for (const f of readdirSync(qa)) if (f.startsWith(`${slug}${only ? `-${only}` : ""}-sheet`)) rmSync(join(qa, f));

process.stdout.write("montando o projeto… ");
const serveUrl = await bundle({ entryPoint: join(root, "src/index.ts"), publicDir: join(root, "public") });
const chromiumOptions = { gl: "angle" };
const composition = await selectComposition({ serveUrl, id: slug, chromiumOptions });
console.log("ok");

const scale = only ? 0.42 : 0.3;
const font = join(root, "public/fonts/Nunito-ExtraBold.ttf").replace(/:/g, "\\:");
for (const [i, f] of frames.entries()) {
  const raw = join(tmp, `raw-${i}.jpg`);
  try {
    await renderStill({ serveUrl, composition, frame: f.frame, output: raw, scale, imageFormat: "jpeg", chromiumOptions, logLevel: "error" });
  } catch (e) {
    console.error(`\n\nERRO na cena "${f.id}" (quadro ${f.frame}):\n${String(e.message).split("\n").slice(0, 6).join("\n")}\n`);
    process.exit(1);
  }
  const label = `${f.id}  ${f.t.toFixed(1)}s`.replace(/'/g, "");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-vf", `drawbox=x=0:y=0:w=iw:h=34:color=black@0.75:t=fill,drawtext=fontfile='${font}':text='${label}':x=8:y=6:fontsize=22:fontcolor=white`, "-q:v", "3", join(tmp, `${String(i).padStart(3, "0")}.jpg`)]);
  rmSync(raw);
  process.stdout.write(`\r${i + 1}/${frames.length} ${f.id}            `);
}

const PAGE = 12;
const out = [];
for (let p = 0; p * PAGE < frames.length; p++) {
  const count = Math.min(PAGE, frames.length - p * PAGE);
  const cols = Math.min(count, 6);
  const file = join(qa, `${slug}${only ? `-${only}` : ""}-sheet-${p + 1}.jpg`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-start_number", String(p * PAGE), "-i", join(tmp, "%03d.jpg"), "-vf", `tile=${cols}x${Math.ceil(count / cols)}:padding=6:color=black`, "-frames:v", "1", "-q:v", "3", file]);
  out.push(file);
}
rmSync(tmp, { recursive: true, force: true });
console.log(`\n\nfolhas (abra e olhe cada uma):\n${out.join("\n")}`);
