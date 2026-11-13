// Ponte com o Remotion: monta o diretório público do bundle, passa as props da composição única
// e faz folhas de revisão (frames) e render por segmentos com cache (render).
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { VbError } from "./errors.mjs";
import { getEpisode, isSpec } from "./episodes.mjs";
import { ENGINE, config, paths } from "./workspace.mjs";

export const FPS = 30;
export const COMPOSITION = "Episode";
const chromiumOptions = { gl: "angle" };

/**
 * Diretório público do bundle: fontes e efeitos do motor + public/ do espaço de trabalho (img/, audio/…),
 * montado em <ws>/.cache/public com links simbólicos. O motor vence em caso de nome repetido.
 */
export const preparePublic = (ws) => {
  const dir = join(paths(ws).cache, "public");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const src of [join(ENGINE, "public"), paths(ws).public]) {
    if (!existsSync(src)) continue;
    for (const name of readdirSync(src)) {
      if (name.startsWith(".")) continue;
      const link = join(dir, name);
      if (!existsSync(link) && !isLink(link)) symlinkSync(join(src, name), link);
    }
  }
  return dir;
};
const isLink = (p) => {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};

export const makeBundle = (ws) => bundle({ entryPoint: join(ENGINE, "src/index.ts"), publicDir: preparePublic(ws) });

/** { spec, script, timing, brand }: as props da composição `Episode`. */
export const inputPropsOf = async (ws, slug) => {
  const { spec, script, timing } = await getEpisode(ws, slug);
  return { spec, script, timing, brand: config(ws).brand ?? { name: "" } };
};

const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));

/** Muda quando qualquer arquivo do kit ou do motor muda: invalida todos os segmentos. */
const kitVersion = () => {
  const h = createHash("sha1");
  for (const f of [...walk(join(ENGINE, "src/kit")), ...walk(join(ENGINE, "src/engine")), join(ENGINE, "remotion.config.ts")].sort()) h.update(f).update(readFileSync(f));
  return h.digest("hex").slice(0, 12);
};

const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...a]);

/* ───────────── folhas de revisão ───────────── */

/** Quadros do episódio lado a lado, cada um com o id da cena e o segundo, em <ws>/.qa/<slug>-sheet-N.jpg. */
export const frames = async (ws, slug, { scene, per, onProgress } = {}) => {
  const { script, timing } = await getEpisode(ws, slug);
  if (scene && !script.scenes.some((s) => s.id === scene)) throw new VbError("no-scene", `cena "${scene}" não existe. Cenas: ${script.scenes.map((s) => s.id).join(", ")}`);
  const n = Number(per ?? (scene ? 6 : 2));
  // Dois quadros por cena pegam os dois planos: um aos 22% (antes do corte) e um aos 88% (tudo já entrou).
  const fractions = n === 1 ? [0.85] : n === 2 ? [0.22, 0.88] : Array.from({ length: n }, (_, i) => 0.08 + (0.86 * i) / (n - 1));
  const list = [];
  let from = 0;
  for (const s of script.scenes) {
    const dur = (timing.scenes[s.id]?.dur ?? s.narration.split(/\s+/).length * 0.36 + 0.4) + (s.hold ?? 0);
    const count = Math.max(1, Math.round(dur * FPS));
    if (!scene || scene === s.id) for (const f of fractions) list.push({ scene: s.id, frame: from + Math.min(count - 1, Math.round(count * f)), t: +((from + count * f) / FPS).toFixed(2) });
    from += count;
  }

  const qa = paths(ws).qa;
  const tmp = join(qa, `${slug}-frames`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  for (const f of readdirSync(qa)) if (f.startsWith(`${slug}${scene ? `-${scene}` : ""}-sheet`)) rmSync(join(qa, f));

  onProgress?.({ step: "bundle", done: 0, total: list.length, label: "montando o projeto" });
  const serveUrl = await makeBundle(ws);
  const inputProps = await inputPropsOf(ws, slug);
  const composition = await selectComposition({ serveUrl, id: COMPOSITION, inputProps, chromiumOptions });
  const size = scene ? 0.42 : 0.3;
  const font = join(ENGINE, "public/fonts/Nunito-ExtraBold.ttf").replace(/:/g, "\\:");
  try {
    for (const [i, f] of list.entries()) {
      const raw = join(tmp, `raw-${i}.jpg`);
      try {
        await renderStill({ serveUrl, composition, inputProps, frame: f.frame, output: raw, scale: size, imageFormat: "jpeg", chromiumOptions, logLevel: "error" });
      } catch (e) {
        throw new VbError("render", `erro na cena "${f.scene}" (quadro ${f.frame}):\n${String(e.message).split("\n").slice(0, 6).join("\n")}`);
      }
      const label = `${f.scene}  ${f.t.toFixed(1)}s`.replace(/'/g, "");
      ff(["-i", raw, "-vf", `drawbox=x=0:y=0:w=iw:h=34:color=black@0.75:t=fill,drawtext=fontfile='${font}':text='${label}':x=8:y=6:fontsize=22:fontcolor=white`, "-q:v", "3", join(tmp, `${String(i).padStart(3, "0")}.jpg`)]);
      rmSync(raw);
      onProgress?.({ step: "frames", done: i + 1, total: list.length, label: f.scene });
    }
    const PAGE = 12;
    const sheets = [];
    for (let p = 0; p * PAGE < list.length; p++) {
      const count = Math.min(PAGE, list.length - p * PAGE);
      const cols = Math.min(count, 6);
      const file = join(qa, `${slug}${scene ? `-${scene}` : ""}-sheet-${p + 1}.jpg`);
      ff(["-framerate", "1", "-start_number", String(p * PAGE), "-i", join(tmp, "%03d.jpg"), "-vf", `tile=${cols}x${Math.ceil(count / cols)}:padding=6:color=black`, "-frames:v", "1", "-q:v", "3", file]);
      sheets.push(file);
    }
    return { sheets, frames: list.map(({ scene: s, t }) => ({ scene: s, t })) };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
};

/* ───────────── render ───────────── */

/** Renderiza cada cena como um segmento em cache e junta tudo. Mudou uma cena, só ela é refeita. Nunca gera voz. */
export const render = async (ws, slug, { force = false, onProgress } = {}) => {
  if (!isSpec(ws, slug)) throw new VbError("no-episode", `o episódio "${slug}" não existe (falta episode.json).`);
  const P = paths(ws);
  const { spec, timing } = await getEpisode(ws, slug);
  const out = join(P.out, `${slug}.mp4`);
  mkdirSync(P.out, { recursive: true });
  const missing = spec.beats.filter((b) => !timing.scenes[b.id]);
  if (missing.length) throw new VbError("no-voice", `faltam tempos de voz em ${missing.length} cena(s) (${missing.slice(0, 3).map((b) => b.id).join(", ")}). Rode: vid voice ${slug}`);
  const warnings = timing.provider === "none" ? ["sem voz (provider none): o vídeo sai mudo. Rode vid voice antes do render final."] : [];
  const brand = config(ws).brand ?? { name: "" };

  let start = 0;
  const segs = spec.beats.map((b) => {
    const t = timing.scenes[b.id];
    const n = Math.max(1, Math.round((t.dur + (b.hold ?? 0)) * FPS));
    const seg = { id: b.id, from: start, to: start + n - 1, key: createHash("sha1").update(JSON.stringify([b, spec.world, spec.cast, spec.captions, t, n, brand])).digest("hex").slice(0, 16) };
    start += n;
    return seg;
  });

  const cache = join(P.cache, "segments", kitVersion());
  mkdirSync(cache, { recursive: true });
  const todo = segs.filter((s) => force || !existsSync(join(cache, `${s.key}.mp4`)) || !existsSync(join(cache, `${s.key}.wav`)));
  onProgress?.({ step: "plan", done: segs.length - todo.length, total: segs.length, label: `${segs.length - todo.length} em cache, ${todo.length} para renderizar` });

  if (todo.length) {
    const serveUrl = await makeBundle(ws);
    const inputProps = await inputPropsOf(ws, slug);
    const composition = await selectComposition({ serveUrl, id: COMPOSITION, inputProps, chromiumOptions });
    for (const [i, s] of todo.entries()) {
      const base = { serveUrl, composition, inputProps, frameRange: [s.from, s.to], chromiumOptions, logLevel: "error" };
      await renderMedia({ ...base, codec: "h264", muted: true, crf: 18, pixelFormat: "yuv420p", outputLocation: join(cache, `${s.key}.tmp.mp4`) });
      await renderMedia({ ...base, codec: "wav", outputLocation: join(cache, `${s.key}.tmp.wav`) });
      renameSync(join(cache, `${s.key}.tmp.mp4`), join(cache, `${s.key}.mp4`));
      renameSync(join(cache, `${s.key}.tmp.wav`), join(cache, `${s.key}.wav`));
      onProgress?.({ step: "render", done: i + 1, total: todo.length, label: s.id });
    }
  }

  // Junta: vídeo e áudio concatenados sem recodificar, e uma só normalização de volume no fim.
  const tmp = join(P.cache, "concat");
  mkdirSync(tmp, { recursive: true });
  const list = (ext) => segs.map((s) => `file '${join(cache, `${s.key}.${ext}`)}'`).join("\n");
  writeFileSync(join(tmp, `${slug}.v.txt`), list("mp4"));
  writeFileSync(join(tmp, `${slug}.a.txt`), list("wav"));
  ff(["-f", "concat", "-safe", "0", "-i", join(tmp, `${slug}.v.txt`), "-c", "copy", join(tmp, `${slug}.v.mp4`)]);
  ff(["-f", "concat", "-safe", "0", "-i", join(tmp, `${slug}.a.txt`), "-c", "copy", join(tmp, `${slug}.a.wav`)]);
  ff(["-i", join(tmp, `${slug}.v.mp4`), "-i", join(tmp, `${slug}.a.wav`), "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out]);

  if (spec.post) writeFileSync(join(P.out, `${slug}.txt`), `${spec.post.caption}\n\n${spec.post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}\n`);
  return { video: out, seconds: +(start / FPS).toFixed(2), cached: segs.length - todo.length, rendered: todo.length, warnings };
};

