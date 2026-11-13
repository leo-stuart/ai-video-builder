#!/usr/bin/env node
// Rede de segurança de regressão visual: quadros de referência em golden/.
//
//   node scripts/golden.mjs record   renderiza e grava golden/*.png + golden/manifest.json
//   node scripts/golden.mjs check    renderiza em pasta temporária e compara (SSIM) com a referência
import { renderStill, selectComposition } from "@remotion/renderer";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getEpisode, inputPropsOf, makeBundle, resolveWorkspace } from "../core/index.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const goldenDir = join(root, "golden");
const manifestFile = join(goldenDir, "manifest.json");
const EPISODES = ["ep14-teste-haiku", "ep15-teste-sonnet"];
// Espaço de trabalho dos episódios de referência: VB_WORKSPACE, ou workspaces/pragma.
const ws = resolveWorkspace(process.env.VB_WORKSPACE ?? join(root, "workspaces/pragma"));
const FPS = 30;
const SCALE = 0.25;
const FRACTION = 0.7;
export const THRESHOLD = 0.985;

let serveUrl = null;
const chromiumOptions = { gl: "angle" };

async function getBundle() {
  serveUrl ??= await makeBundle(ws);
  return serveUrl;
}

// Única parte que sabe localizar o episódio e passá-lo ao Remotion: composição única "Episode" + inputProps.
async function renderFrame(slug, frame, outFile) {
  const url = await getBundle();
  const inputProps = await inputPropsOf(ws, slug);
  const composition = await selectComposition({ serveUrl: url, id: "Episode", inputProps, chromiumOptions });
  await renderStill({ serveUrl: url, composition, inputProps, frame, output: outFile, scale: SCALE, imageFormat: "png", chromiumOptions, logLevel: "error" });
}

async function planFrames() {
  const list = [];
  for (const slug of EPISODES) {
    const { script, timing } = await getEpisode(ws, slug);
    let from = 0;
    for (const s of script.scenes) {
      const n = Math.round((timing.scenes[s.id].dur + (s.hold || 0)) * FPS);
      list.push({ slug, scene: s.id, frame: from + Math.min(n - 1, Math.floor(n * FRACTION)) });
      from += n;
    }
  }
  return list;
}

const fileFor = (f) => `${f.slug}__${f.scene}.png`;
const idOf = (f) => `${f.slug}/${f.scene}@${f.frame}`;

function ssim(a, b) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-i", a, "-i", b, "-lavfi", "ssim", "-f", "null", "-"], { encoding: "utf8" });
  const m = /All:([0-9.]+)/.exec(r.stderr || "");
  return m ? Number(m[1]) : 0;
}

async function record() {
  const frames = await planFrames();
  rmSync(goldenDir, { recursive: true, force: true });
  mkdirSync(goldenDir, { recursive: true });
  for (const [i, f] of frames.entries()) {
    await renderFrame(f.slug, f.frame, join(goldenDir, fileFor(f)));
    process.stdout.write(`\r${i + 1}/${frames.length} ${f.slug}/${f.scene}        `);
  }
  writeFileSync(manifestFile, JSON.stringify({ fps: FPS, scale: SCALE, fraction: FRACTION, frames }, null, 2) + "\n");
  console.log(`\ngravados ${frames.length} quadros em golden/`);
}

export async function goldenCheck() {
  if (!existsSync(manifestFile)) throw new Error("golden/manifest.json não existe; rode `record` primeiro");
  const { frames } = JSON.parse(readFileSync(manifestFile, "utf8"));
  const tmp = mkdtempSync(join(tmpdir(), "golden-"));
  const results = [];
  try {
    for (const f of frames) {
      const out = join(tmp, fileFor(f));
      await renderFrame(f.slug, f.frame, out);
      const s = ssim(join(goldenDir, fileFor(f)), out);
      results.push({ id: idOf(f), ssim: s, ok: s >= THRESHOLD });
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return { ok: results.every((r) => r.ok), results };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cmd = process.argv[2];
  if (cmd === "record") await record();
  else if (cmd === "check") {
    const { ok, results } = await goldenCheck();
    for (const r of results) console.log(`${r.ok ? "ok       " : "DIFERENTE"} ${r.ssim.toFixed(4)}  ${r.id}`);
    console.log(ok ? `\ntudo igual (limiar ${THRESHOLD})` : `\nHÁ DIFERENÇAS (limiar ${THRESHOLD})`);
    process.exit(ok ? 0 : 1);
  } else {
    console.error("uso: node scripts/golden.mjs record|check");
    process.exit(1);
  }
  process.exit(0);
}
