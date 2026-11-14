#!/usr/bin/env node
// Evidência temporal a partir de um MP4 já renderizado; não chama TTS nem altera o episódio.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveWorkspace, getEpisode } from "../core/index.mjs";

const argv = process.argv.slice(2);
const wi = argv.indexOf("--workspace");
const ws = resolveWorkspace(wi < 0 ? undefined : argv[wi + 1]);
if (wi >= 0) argv.splice(wi, 2);
const [slug] = argv;
if (!slug) throw new Error("uso: node scripts/review-motion.mjs --workspace <pasta> <slug>");
const { spec, timing } = await getEpisode(ws, slug);
const video = join(ws, "out", `${slug}.mp4`);
if (!existsSync(video)) throw new Error(`falta ${video}; renderize um rascunho primeiro.`);
const out = join(ws, ".qa", `${slug}-motion`);
mkdirSync(out, { recursive: true });
const ff = (...args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const clips = [];
let frame = 0;
for (const [i, beat] of spec.beats.entries()) {
  const tm = timing.scenes[beat.id];
  if (!tm) throw new Error(`sem tempo da cena ${beat.id}`);
  const frames = Math.max(1, Math.round((tm.dur + (beat.hold ?? 0)) * 30));
  // Inclui a saída da cena anterior e a entrada da próxima: o reinício da câmera fica visível.
  const start = Math.max(0, frame / 30 - 0.45);
  const end = (frame + frames) / 30 + 0.45;
  const name = String(i + 1).padStart(2, "0");
  ff("-ss", String(start), "-i", video, "-t", String(end - start), "-vf", "scale=360:640", "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-c:a", "aac", "-movflags", "+faststart", join(out, `${name}.mp4`));
  // Tira temporal complementa o player; não substitui reprodução em velocidade normal.
  ff("-ss", String(start), "-i", video, "-t", String(end - start), "-vf", `fps=${12 / (end - start)},scale=180:320,tile=6x2:padding=3:color=black`, "-frames:v", "1", join(out, `${name}.jpg`));
  clips.push({ id: beat.id, type: beat.type, start, end, narration: beat.narration, cameraStyle: spec.world.camStyle, shots: beat.scene?.parts?.flatMap((p) => p.shots ?? []) ?? null, file: `${name}.mp4`, strip: `${name}.jpg` });
  frame += frames;
}
writeFileSync(join(out, "manifest.json"), JSON.stringify({ slug, source: video, clips, status: "pending-human-motion-review" }, null, 2));
writeFileSync(join(out, "index.html"), `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Movimento · ${esc(spec.title)}</title><style>body{font:16px system-ui;background:#15151b;color:#eee;margin:24px;max-width:1100px}article{border-top:1px solid #555;padding:20px 0}video{max-height:640px;max-width:100%;background:#000}img{display:block;max-width:100%;margin-top:12px}button{padding:8px;margin:4px}p{max-width:75ch}</style><h1>${esc(spec.title)}</h1><p>Revisão pendente. Cada trecho inclui 0,45 s das cenas vizinhas. Assista a 1× antes de usar 0,5×. Verifique centro de atenção, leitura, reinício de câmera, corte no rosto, aceleração e ação que demonstra a fala. Uma folha estática ou ausência de erro não aprova movimento.</p>${clips.map((c) => `<article><h2>${esc(c.id)} · ${esc(c.type)} · ${c.start.toFixed(2)}–${c.end.toFixed(2)} s</h2><p>${esc(c.narration)}</p><video controls playsinline preload="metadata" src="${c.file}"></video><p><button onclick="this.parentElement.previousElementSibling.playbackRate=1">1×</button><button onclick="this.parentElement.previousElementSibling.playbackRate=.5">0,5×</button></p><img src="${c.strip}" alt="Doze quadros em ordem temporal"></article>`).join("")}</html>`);
console.log(join(out, "index.html"));
