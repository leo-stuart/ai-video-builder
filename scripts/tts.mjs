#!/usr/bin/env node
// Gera a narração de um episódio e o timing.json que sincroniza legenda e visual.
//
//   node scripts/tts.mjs <slug> [--provider say|elevenlabs|openai|none] [--force]
//
// Ordem de escolha da voz, por cena:
//   1. Gravação humana em voice/<slug>/<id>.(wav|m4a|mp3)  → sempre vence.
//   2. --provider, ou PRAGMA_TTS, ou o primeiro disponível:
//      elevenlabs (ELEVENLABS_API_KEY) → openai (OPENAI_API_KEY) → say (macOS).
//   3. none: sem áudio, só estimativa de tempo (para rascunhar o visual).
//
// Conversa: cada cena pode ter "speaker"; a voz de cada um vem de script.cast
//   "cast": { "caixa": { "label": "Caixa", "color": "coral", "say": { "en": "Samantha" } } }
//
// Marcação da narração:  [en]Could I get a coffee?[/en]  trecho em inglês
//                        *palavra*                       ênfase na legenda
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Chaves ficam em .env.local (fora do git), uma por linha: NOME=valor
const envFile = join(root, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*?)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
const flag = (n) => {
  const i = args.indexOf(`--${n}`);
  return i < 0 ? undefined : (args[i + 1] ?? true);
};
if (!slug) {
  console.error("uso: node scripts/tts.mjs <slug> [--provider say|elevenlabs|openai|none] [--force]");
  process.exit(1);
}

const epDir = join(root, "src/episodes", slug);
const script = JSON.parse(readFileSync(join(epDir, "script.json"), "utf8"));
const timingPath = join(epDir, "timing.json");
const old = existsSync(timingPath) ? JSON.parse(readFileSync(timingPath, "utf8")) : { scenes: {} };
const outDir = join(root, "public/audio", slug);
const tmp = join(root, ".qa/tts", slug);
mkdirSync(outDir, { recursive: true });
mkdirSync(tmp, { recursive: true });

const provider =
  flag("provider") ??
  process.env.PRAGMA_TTS ??
  (process.env.ELEVENLABS_API_KEY ? "elevenlabs" : process.env.OPENAI_API_KEY ? "openai" : process.platform === "darwin" ? "say" : "none");

const SAY_PT = process.env.PRAGMA_SAY_VOICE_PT ?? "Luciana";
const SAY_EN = process.env.PRAGMA_SAY_VOICE_EN ?? "Samantha";
const SAY_RATE = process.env.PRAGMA_SAY_RATE ?? "195";
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID ?? "";
const OPENAI_VOICE = process.env.OPENAI_TTS_VOICE ?? "nova";
const TAIL = 0.28; // respiro depois da última palavra

const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...a]);
const duration = (f) =>
  parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
const toWav = (src, dst) =>
  ff(["-i", src, "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse", "-ar", "44100", "-ac", "1", dst]);

/** "[en]a b[/en] c *d*" → segmentos por idioma, cada um com suas palavras. */
const parse = (narration) => {
  const segs = [];
  for (const part of narration.split(/(\[en\].*?\[\/en\])/g)) {
    if (!part.trim()) continue;
    const en = part.startsWith("[en]");
    const text = part.replace(/\[\/?en\]/g, "").trim();
    const words = [];
    let em = false;
    for (const raw of text.split(/\s+/)) {
      let w = raw;
      if (w.startsWith("*")) em = true;
      const closes = /\*[.,!?:;]*$/.test(w);
      w = w.replace(/\*/g, "");
      if (w) words.push({ t: w, en: en || undefined, em: (em && !en) || undefined });
      if (closes) em = false;
    }
    segs.push({ en, text: text.replace(/\*/g, ""), words });
  }
  return segs;
};

/** Reparte a duração entre as palavras pelo tamanho; pontuação pesa como pausa. */
const spread = (words, start, dur) => {
  const weight = (w) => w.t.replace(/[^\p{L}\p{N}]/gu, "").length + 1.5 + (/[.!?]$/.test(w.t) ? 5 : /[,:;]$/.test(w.t) ? 2.5 : 0);
  const total = words.reduce((a, w) => a + weight(w), 0) || 1;
  let t = start;
  return words.map((w) => {
    const d = (weight(w) / total) * dur;
    const out = { ...w, s: +t.toFixed(3), e: +(t + d).toFixed(3) };
    t += d;
    return out;
  });
};

const speak = {
  async say(segs, id, cast) {
    const parts = [];
    segs.forEach((seg, i) => {
      const aiff = join(tmp, `${id}-${i}.aiff`);
      const wav = join(tmp, `${id}-${i}.wav`);
      execFileSync("say", ["-v", seg.en ? (cast?.say?.en ?? SAY_EN) : (cast?.say?.pt ?? SAY_PT), "-r", seg.en ? String(SAY_RATE - 25) : SAY_RATE, "-o", aiff, seg.text]);
      toWav(aiff, wav);
      parts.push({ wav, dur: duration(wav), seg });
    });
    const out = join(outDir, `${id}.wav`);
    const gap = 0.12;
    const inputs = parts.flatMap((p) => ["-i", p.wav]);
    const chain = parts.map((_, i) => `[${i}:a]apad=pad_dur=${i < parts.length - 1 ? gap : 0}[a${i}]`).join(";");
    ff([...inputs, "-filter_complex", `${chain};${parts.map((_, i) => `[a${i}]`).join("")}concat=n=${parts.length}:v=0:a=1`, "-ar", "44100", "-ac", "1", out]);
    let t = 0.04;
    const words = parts.flatMap((p) => {
      const w = spread(p.seg.words, t, p.dur);
      t += p.dur + gap;
      return w;
    });
    return { file: out, words };
  },
  async elevenlabs(segs, id, cast, speaker) {
    // Voz por personagem: "eleven" no cast do roteiro, ou ELEVENLABS_VOICE_<PERSONAGEM>, ou a voz padrão.
    const voice = (speaker && process.env[`ELEVENLABS_VOICE_${speaker.toUpperCase()}`]) || cast?.eleven || script.eleven || ELEVEN_VOICE;
    if (!process.env.ELEVENLABS_API_KEY) throw new Error("falta ELEVENLABS_API_KEY em .env.local");
    if (!voice) throw new Error(`sem voz para "${speaker ?? "narrador"}": rode node scripts/voices.mjs e ponha "eleven": "<id>" no cast`);
    const text = segs.map((s) => s.text).join(" ");
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL ?? "eleven_multilingual_v2",
        voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true },
      }),
    });
    if (!res.ok) throw new Error(`elevenlabs ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const raw = join(tmp, `${id}.mp3`);
    writeFileSync(raw, Buffer.from(json.audio_base64, "base64"));
    const out = join(outDir, `${id}.wav`);
    ff(["-i", raw, "-ar", "44100", "-ac", "1", out]); // sem cortar silêncio: os tempos da API valem como estão
    const words = segs.flatMap((s) => s.words);
    // A API devolve o tempo de cada caractere; junta em palavras, na mesma divisão do roteiro.
    const al = json.alignment;
    const spans = [];
    let cur = null;
    al?.characters?.forEach((ch, i) => {
      if (/\s/.test(ch)) {
        if (cur) spans.push(cur);
        cur = null;
      } else if (cur) cur.e = al.character_end_times_seconds[i];
      else cur = { s: al.character_start_times_seconds[i], e: al.character_end_times_seconds[i] };
    });
    if (cur) spans.push(cur);
    if (spans.length !== words.length) {
      console.log(`  (${id}: alinhamento da API não bateu, ${spans.length} x ${words.length} palavras; tempo estimado)`);
      return { file: out, words: spread(words, 0.04, duration(out) - 0.04) };
    }
    return { file: out, words: words.map((w, i) => ({ ...w, s: +spans[i].s.toFixed(3), e: +spans[i].e.toFixed(3) })) };
  },
  async openai(segs, id, cast) {
    if (!process.env.OPENAI_API_KEY) throw new Error("defina OPENAI_API_KEY");
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
        voice: cast?.openai ?? OPENAI_VOICE,
        input: segs.map((s) => s.text).join(" "),
        instructions: "Narrador brasileiro jovem, animado e direto, ritmo de vídeo curto. Pronuncie os trechos em inglês com sotaque americano natural.",
        response_format: "mp3",
      }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}: ${await res.text()}`);
    return fromBuffer(Buffer.from(await res.arrayBuffer()), "mp3", segs, id);
  },
};

const fromFile = (src, segs, id) => {
  const out = join(outDir, `${id}.wav`);
  toWav(src, out);
  return { file: out, words: spread(segs.flatMap((s) => s.words), 0.04, duration(out) - 0.04) };
};
const fromBuffer = (buf, ext, segs, id) => {
  const raw = join(tmp, `${id}.${ext}`);
  writeFileSync(raw, buf);
  return fromFile(raw, segs, id);
};

const timing = { provider, scenes: {} };
for (const scene of script.scenes) {
  const segs = parse(scene.narration);
  const recorded = ["wav", "m4a", "mp3"].map((e) => join(root, "voice", slug, `${scene.id}.${e}`)).find(existsSync);
  const source = recorded ? "recorded" : provider;
  const hash = createHash("sha1")
    .update(JSON.stringify([scene.narration, source, process.env.ELEVENLABS_MODEL, scene.speaker && process.env[`ELEVENLABS_VOICE_${scene.speaker.toUpperCase()}`], scene.speaker, script.cast?.[scene.speaker], script.eleven, SAY_PT, SAY_EN, SAY_RATE, ELEVEN_VOICE, OPENAI_VOICE, recorded ? readFileSync(recorded).length : 0]))
    .digest("hex")
    .slice(0, 12);
  const prev = old.scenes?.[scene.id];
  if (!flag("force") && prev?.hash === hash && (!prev.audio || existsSync(join(root, "public", prev.audio)))) {
    timing.scenes[scene.id] = prev;
    console.log(`= ${scene.id}  ${prev.dur.toFixed(2)}s  (cache)`);
    continue;
  }
  // Cache entre episódios: a mesma fala com a mesma voz não gasta crédito duas vezes.
  const cdir = join(root, ".cache/voice");
  const ckey = createHash("sha1").update(JSON.stringify([scene.narration, source, process.env.ELEVENLABS_MODEL, script.cast?.[scene.speaker], script.eleven, scene.speaker ? 1 : 0])).digest("hex").slice(0, 16);
  if (source !== "none" && source !== "recorded" && !flag("force") && existsSync(join(cdir, `${ckey}.json`)) && existsSync(join(cdir, `${ckey}.wav`))) {
    const hit = JSON.parse(readFileSync(join(cdir, `${ckey}.json`), "utf8"));
    const out = join(outDir, `${scene.id}.wav`);
    ff(["-i", join(cdir, `${ckey}.wav`), "-c", "copy", out]);
    timing.scenes[scene.id] = { hash, dur: hit.dur, audio: `audio/${slug}/${scene.id}.wav`, words: hit.words };
    console.log(`≈ ${scene.id}  ${hit.dur.toFixed(2)}s  (reaproveitada de outro episódio)`);
    continue;
  }
  if (source === "none") {
    const words = spread(segs.flatMap((s) => s.words), 0.04, segs.flatMap((s) => s.words).length * 0.36);
    timing.scenes[scene.id] = { hash, dur: +(words.at(-1).e + TAIL).toFixed(3), audio: null, words };
  } else {
    const { file, words } = recorded ? fromFile(recorded, segs, scene.id) : await speak[provider](segs, scene.id, script.cast?.[scene.speaker], scene.speaker);
    timing.scenes[scene.id] = { hash, dur: +(duration(file) + TAIL).toFixed(3), audio: `audio/${slug}/${scene.id}.wav`, words };
    if (!recorded) {
      mkdirSync(cdir, { recursive: true });
      ff(["-i", file, "-c", "copy", join(cdir, `${ckey}.wav`)]);
      writeFileSync(join(cdir, `${ckey}.json`), JSON.stringify({ dur: timing.scenes[scene.id].dur, words }));
    }
  }
  console.log(`+ ${scene.id}  ${timing.scenes[scene.id].dur.toFixed(2)}s  (${source})`);
}
writeFileSync(timingPath, JSON.stringify(timing, null, 2) + "\n");
rmSync(tmp, { recursive: true, force: true });
const total = Object.values(timing.scenes).reduce((a, s) => a + s.dur, 0);
console.log(`\n${slug}: ${total.toFixed(1)}s no total, voz "${provider}" → ${timingPath}`);
if (total > 60) console.log("aviso: passou de 60s. Corte texto: o alvo é 25 a 45s.");
