// vid render <slug> [--force]
// Renderiza cada cena como um segmento em cache e junta tudo. Mudou uma cena,
// só ela é refeita. Episódios antigos (sem episode.json) usam o render inteiro.
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, copyFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { epDir, isSpec, readSpec, root } from "./spec.mjs";

const FPS = 30;
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));

/** Muda quando qualquer arquivo do kit ou do motor muda: invalida todos os segmentos. */
const kitVersion = () => {
  const h = createHash("sha1");
  for (const f of [...walk(join(root, "src/kit")), ...walk(join(root, "src/engine")), join(root, "remotion.config.ts")].sort()) h.update(f).update(readFileSync(f));
  return h.digest("hex").slice(0, 12);
};

export const renderEpisode = async (slug, { force = false, quiet = false } = {}) => {
  const log = (m) => !quiet && console.log(m);
  const out = join(root, "out", `${slug}.mp4`);
  mkdirSync(join(root, "out"), { recursive: true });

  if (!isSpec(slug)) {
    execFileSync("node", [join(root, "scripts/render.mjs"), slug], { stdio: "inherit", cwd: root });
    return out;
  }

  const spec = readSpec(slug);
  const timing = JSON.parse(readFileSync(join(epDir(slug), "timing.json"), "utf8"));
  const missing = spec.beats.filter((b) => !timing.scenes[b.id]);
  if (missing.length) throw new Error(`faltam tempos de voz em ${missing.length} cena(s) (${missing.slice(0, 3).map((b) => b.id).join(", ")}). Rode: vid voice ${slug}`);
  if (timing.provider === "none") log("aviso: sem voz (provider none). O vídeo sai mudo; rode vid voice antes do render final.");

  let start = 0;
  const segs = spec.beats.map((b) => {
    const t = timing.scenes[b.id];
    const frames = Math.max(1, Math.round((t.dur + (b.hold ?? 0)) * FPS));
    const seg = { id: b.id, from: start, to: start + frames - 1, key: createHash("sha1").update(JSON.stringify([b, spec.world, spec.cast, spec.captions, t, frames])).digest("hex").slice(0, 16) };
    start += frames;
    return seg;
  });

  const kit = kitVersion();
  const cache = join(root, ".cache/segments", kit);
  mkdirSync(cache, { recursive: true });
  const todo = segs.filter((s) => force || !existsSync(join(cache, `${s.key}.mp4`)) || !existsSync(join(cache, `${s.key}.wav`)));
  log(`${segs.length} cenas: ${segs.length - todo.length} em cache, ${todo.length} para renderizar`);

  if (todo.length) {
    const serveUrl = await bundle({ entryPoint: join(root, "src/index.ts"), publicDir: join(root, "public") });
    const chromiumOptions = { gl: "angle" };
    const composition = await selectComposition({ serveUrl, id: slug, chromiumOptions });
    for (const [i, s] of todo.entries()) {
      const t0 = Date.now();
      const base = { serveUrl, composition, frameRange: [s.from, s.to], chromiumOptions, logLevel: "error" };
      await renderMedia({ ...base, codec: "h264", muted: true, crf: 18, pixelFormat: "yuv420p", outputLocation: join(cache, `${s.key}.tmp.mp4`) });
      await renderMedia({ ...base, codec: "wav", outputLocation: join(cache, `${s.key}.tmp.wav`) });
      renameSync(join(cache, `${s.key}.tmp.mp4`), join(cache, `${s.key}.mp4`));
      renameSync(join(cache, `${s.key}.tmp.wav`), join(cache, `${s.key}.wav`));
      log(`  ${i + 1}/${todo.length} ${s.id} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
  }

  // Junta: vídeo e áudio concatenados sem recodificar, e uma só normalização de volume no fim.
  const tmp = join(root, ".cache/concat");
  mkdirSync(tmp, { recursive: true });
  const list = (ext) => segs.map((s) => `file '${join(cache, `${s.key}.${ext}`)}'`).join("\n");
  writeFileSync(join(tmp, `${slug}.v.txt`), list("mp4"));
  writeFileSync(join(tmp, `${slug}.a.txt`), list("wav"));
  const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...a]);
  ff(["-f", "concat", "-safe", "0", "-i", join(tmp, `${slug}.v.txt`), "-c", "copy", join(tmp, `${slug}.v.mp4`)]);
  ff(["-f", "concat", "-safe", "0", "-i", join(tmp, `${slug}.a.txt`), "-c", "copy", join(tmp, `${slug}.a.wav`)]);
  ff(["-i", join(tmp, `${slug}.v.mp4`), "-i", join(tmp, `${slug}.a.wav`), "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out]);

  if (spec.post) writeFileSync(join(root, "out", `${slug}.txt`), `${spec.post.caption}\n\n${spec.post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}\n`);
  log(`vídeo: ${out}`);
  return out;
};

export default async ({ positional, flag, die }) => {
  const [slug] = positional;
  if (!slug) die("uso: vid render <slug> [--force]");
  try {
    await renderEpisode(slug, { force: !!flag("force") });
  } catch (e) {
    die(`ERRO: ${e.message}`);
  }
};
