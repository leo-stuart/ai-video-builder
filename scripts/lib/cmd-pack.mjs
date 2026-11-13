// vid pack <slug>  Monta o pacote de postagem em out/<slug>/ e atualiza out/calendar.csv.
// Nada é publicado: o pacote é para você (ou um agendador) postar.
import { execFileSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config, epDir, readSpec, root } from "./spec.mjs";

const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…");

export const packEpisode = (slug) => {
  const video = join(root, "out", `${slug}.mp4`);
  if (!existsSync(video)) throw new Error(`não existe out/${slug}.mp4. Rode: vid render ${slug}`);
  const spec = readSpec(slug);
  const post = spec.post;
  if (!post?.caption || post.caption.includes("TODO")) throw new Error("falta a legenda do post (post.caption) no episode.json.");
  const dir = join(root, "out", slug);
  mkdirSync(dir, { recursive: true });
  copyFileSync(video, join(dir, "video.mp4"));

  const tags = post.hashtags.map((h) => `#${h.replace(/^#/, "")}`);
  const lines = post.caption.split("\n\n");
  const first = lines[0];
  const ask = lines.at(-1);
  const short = [first, ask].join("\n\n");
  const title = clip(post.shortsTitle ?? first.replace(/\n/g, " "), 60);

  writeFileSync(join(dir, "reels.txt"), `${post.caption}\n\n${tags.slice(0, 8).join(" ")}\n`);
  writeFileSync(join(dir, "tiktok.txt"), `${clip(short, 300)}\n\n${tags.slice(0, 5).join(" ")}\n`);
  writeFileSync(join(dir, "shorts.txt"), `TÍTULO (até 60 caracteres):\n${title}\n\nDESCRIÇÃO:\n${post.caption}\n\n${tags.slice(0, 5).join(" ")} #Shorts\n`);

  // Miniatura: a cena do branco (o gelo), perto do fim dela.
  const timing = JSON.parse(readFileSync(join(epDir(slug), "timing.json"), "utf8"));
  let t = 0;
  let thumbAt = 3;
  for (const b of spec.beats) {
    const d = (timing.scenes[b.id]?.dur ?? 2) + (b.hold ?? 0);
    if (b.type === "freeze") thumbAt = t + d * 0.9;
    t += d;
  }
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(thumbAt), "-i", video, "-frames:v", "1", "-q:v", "2", join(dir, "thumb.jpg")]);

  const dur = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video]).toString().trim();
  const meta = { slug, title: spec.title, format: spec.format, freedom: spec.freedom, place: spec.world.place, seconds: Number(Number(dur).toFixed(1)), voice: timing.provider, shortsTitle: title, hashtags: post.hashtags };
  writeFileSync(join(dir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");

  // Calendário: um horário de cada vez, na ordem dos horários do config.
  const cal = join(root, "out", "calendar.csv");
  if (!existsSync(cal)) writeFileSync(cal, "slug,ordem,horario_sugerido,formato,titulo_shorts,pasta\n");
  const rows = readFileSync(cal, "utf8").trim().split("\n").slice(1).filter(Boolean);
  if (!rows.some((r) => r.startsWith(`${slug},`))) {
    const slots = config().post.slots;
    appendFileSync(cal, `${slug},${rows.length + 1},${slots[rows.length % slots.length]},${spec.format ?? ""},"${title.replace(/"/g, "'")}",out/${slug}\n`);
  }
  return dir;
};

export default async ({ positional, die }) => {
  const [slug] = positional;
  if (!slug) die("uso: vid pack <slug>");
  try {
    console.log(`pacote: ${packEpisode(slug)}`);
  } catch (e) {
    die(`ERRO: ${e.message}`);
  }
};
