#!/usr/bin/env node
// Renderiza um episódio em out/<slug>.mp4 (1080×1920, 30 fps, H.264 + AAC)
// e escreve out/<slug>.txt com a legenda e as hashtags do post.
//
//   node scripts/render.mjs <slug>
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv[2];
if (!slug) {
  console.error("uso: node scripts/render.mjs <slug>");
  process.exit(1);
}
const script = JSON.parse(readFileSync(join(root, "src/episodes", slug, "script.json"), "utf8"));
mkdirSync(join(root, "out"), { recursive: true });
const out = join(root, "out", `${slug}.mp4`);

execFileSync(
  "npx",
  ["remotion", "render", "src/index.ts", slug, out, "--codec=h264", "--crf=18", "--pixel-format=yuv420p", "--audio-codec=aac", "--log=error"],
  { cwd: root, stdio: "inherit" },
);

// Volume no padrão das plataformas (cerca de -14 LUFS); o vídeo é copiado sem recomprimir.
const loud = join(root, "out", `${slug}.loud.mp4`);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", out, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", loud]);
renameSync(loud, out);

if (script.post) {
  writeFileSync(join(root, "out", `${slug}.txt`), `${script.post.caption}\n\n${script.post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}\n`);
}
console.log(`\nvídeo: ${out}`);
