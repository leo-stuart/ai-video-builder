// Voz: gera a narração de um episódio e o timing.json que sincroniza legenda e visual.
//
// Ordem de escolha, por cena:
//   1. gravação humana em <ws>/voice/<slug>/<id>.(wav|m4a|mp3): sempre vence;
//   2. provider (opção, PRAGMA_TTS/VB_TTS ou o primeiro disponível): elevenlabs → openai → say (macOS);
//   3. none: sem áudio, só estimativa de tempo.
// Cache por cena (no episódio) e entre episódios (<ws>/.cache/voice): a mesma fala com a mesma voz não gasta crédito duas vezes.
//
// Marcação da narração:  [en]Could I get a coffee?[/en]  trecho em inglês   ·   *palavra*  ênfase na legenda
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { VbError } from "./errors.mjs";
import { epDir, readSpec, compile } from "./episodes.mjs";
import { paths, readEnv, readJson, writeJson } from "./workspace.mjs";

const TAIL = 0.28; // respiro depois da última palavra

const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...a]);
const duration = (f) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
const toWav = (src, dst) => ff(["-i", src, "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse", "-ar", "44100", "-ac", "1", dst]);

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

const defaultProvider = (env) => env.PRAGMA_TTS ?? env.VB_TTS ?? (env.ELEVENLABS_API_KEY ? "elevenlabs" : env.OPENAI_API_KEY ? "openai" : process.platform === "darwin" ? "say" : "none");

export const voice = async (ws, slug, { provider: asked, force = false, onProgress } = {}) => {
  const env = readEnv(ws);
  const P = paths(ws);
  const spec = readSpec(ws, slug);
  const dir = epDir(ws, slug);
  const script = existsSync(join(dir, "script.json")) ? readJson(join(dir, "script.json")) : compile(spec);
  const timingPath = join(dir, "timing.json");
  const old = existsSync(timingPath) ? readJson(timingPath) : { scenes: {} };
  const outDir = join(P.public, "audio", slug);
  const tmp = join(P.cache, "tts", slug);
  mkdirSync(outDir, { recursive: true });
  mkdirSync(tmp, { recursive: true });

  const provider = asked ?? defaultProvider(env);
  if (!["say", "elevenlabs", "openai", "none"].includes(provider)) throw new VbError("bad-provider", `voz "${provider}" não existe. Use elevenlabs, openai, say ou none.`);
  const warnings = [];
  const SAY_PT = env.PRAGMA_SAY_VOICE_PT ?? "Luciana";
  const SAY_EN = env.PRAGMA_SAY_VOICE_EN ?? "Samantha";
  const SAY_RATE = env.PRAGMA_SAY_RATE ?? "195";
  const ELEVEN_VOICE = env.ELEVENLABS_VOICE_ID ?? "";
  const OPENAI_VOICE = env.OPENAI_TTS_VOICE ?? "nova";

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
      // Voz por personagem: "eleven" no cast, ou ELEVENLABS_VOICE_<PERSONAGEM>, ou a voz padrão.
      const voiceId = (speaker && env[`ELEVENLABS_VOICE_${speaker.toUpperCase()}`]) || cast?.eleven || script.eleven || ELEVEN_VOICE;
      if (!env.ELEVENLABS_API_KEY) throw new VbError("no-key", "falta ELEVENLABS_API_KEY em .env.local do espaço de trabalho.");
      if (!voiceId) throw new VbError("no-voice", `sem voz para "${speaker ?? "narrador"}": ponha "eleven": "<id>" no cast (vid voices lista as vozes).`);
      const text = segs.map((s) => s.text).join(" ");
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: env.ELEVENLABS_MODEL ?? "eleven_multilingual_v2",
          voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true },
        }),
      });
      if (!res.ok) throw new VbError("provider", `elevenlabs ${res.status}: ${await res.text()}`);
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
        warnings.push(`${id}: alinhamento da API não bateu (${spans.length} x ${words.length} palavras); tempo estimado.`);
        return { file: out, words: spread(words, 0.04, duration(out) - 0.04) };
      }
      return { file: out, words: words.map((w, i) => ({ ...w, s: +spans[i].s.toFixed(3), e: +spans[i].e.toFixed(3) })) };
    },
    async openai(segs, id, cast) {
      if (!env.OPENAI_API_KEY) throw new VbError("no-key", "defina OPENAI_API_KEY em .env.local do espaço de trabalho.");
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
          voice: cast?.openai ?? OPENAI_VOICE,
          input: segs.map((s) => s.text).join(" "),
          instructions: "Narrador brasileiro jovem, animado e direto, ritmo de vídeo curto. Pronuncie os trechos em inglês com sotaque americano natural.",
          response_format: "mp3",
        }),
      });
      if (!res.ok) throw new VbError("provider", `openai ${res.status}: ${await res.text()}`);
      return fromBuffer(Buffer.from(await res.arrayBuffer()), "mp3", segs, id);
    },
  };

  const timing = { provider, scenes: {} };
  const result = [];
  const cdir = join(P.cache, "voice");
  const total = script.scenes.length;
  try {
    for (const [i, scene] of script.scenes.entries()) {
      const segs = parse(scene.narration);
      const recorded = ["wav", "m4a", "mp3"].map((e) => join(P.voice, slug, `${scene.id}.${e}`)).find(existsSync);
      const source = recorded ? "recorded" : provider;
      const hash = createHash("sha1")
        .update(JSON.stringify([scene.narration, source, env.ELEVENLABS_MODEL, scene.speaker && env[`ELEVENLABS_VOICE_${scene.speaker.toUpperCase()}`], scene.speaker, script.cast?.[scene.speaker], script.eleven, SAY_PT, SAY_EN, SAY_RATE, ELEVEN_VOICE, OPENAI_VOICE, recorded ? readFileSync(recorded).length : 0]))
        .digest("hex")
        .slice(0, 12);
      const done = (src, label) => {
        result.push({ id: scene.id, seconds: timing.scenes[scene.id].dur, source: src });
        onProgress?.({ step: "voice", done: i + 1, total, label: `${scene.id} (${label})` });
      };
      const prev = old.scenes?.[scene.id];
      if (!force && prev?.hash === hash && (!prev.audio || existsSync(join(P.public, prev.audio)))) {
        timing.scenes[scene.id] = prev;
        done("cache", "cache");
        continue;
      }
      // Cache entre episódios.
      const ckey = createHash("sha1").update(JSON.stringify([scene.narration, source, env.ELEVENLABS_MODEL, script.cast?.[scene.speaker], script.eleven, scene.speaker ? 1 : 0])).digest("hex").slice(0, 16);
      if (source !== "none" && source !== "recorded" && !force && existsSync(join(cdir, `${ckey}.json`)) && existsSync(join(cdir, `${ckey}.wav`))) {
        const hit = readJson(join(cdir, `${ckey}.json`));
        ff(["-i", join(cdir, `${ckey}.wav`), "-c", "copy", join(outDir, `${scene.id}.wav`)]);
        timing.scenes[scene.id] = { hash, dur: hit.dur, audio: `audio/${slug}/${scene.id}.wav`, words: hit.words };
        done("shared", "reaproveitada de outro episódio");
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
      done(source, source);
    }
    writeJson(timingPath, timing);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  const seconds = Object.values(timing.scenes).reduce((a, s) => a + s.dur, 0);
  if (seconds > 60) warnings.push("passou de 60s. Corte texto: o alvo é 25 a 45s.");
  return { scenes: result, seconds: +seconds.toFixed(2), provider, warnings };
};

const eleven = async (ws, path) => {
  const key = readEnv(ws).ELEVENLABS_API_KEY;
  if (!key) return null;
  const res = await fetch(`https://api.elevenlabs.io${path}`, { headers: { "xi-api-key": key } });
  if (!res.ok) throw new VbError("provider", `${path} → ${res.status}: ${await res.text()}`);
  return res.json();
};

/** Saldo de créditos do ElevenLabs, ou null sem chave. */
export const voiceBalance = async (ws) => {
  const sub = await eleven(ws, "/v1/user/subscription");
  return sub ? { plan: sub.tier, used: sub.character_count, limit: sub.character_limit } : null;
};

/** Vozes que a conta pode usar (filtro por texto opcional), ou null sem chave. */
export const listVoices = async (ws, { filter = "" } = {}) => {
  const r = await eleven(ws, "/v1/voices");
  if (!r) return null;
  const f = filter.toLowerCase();
  return r.voices
    .map((v) => {
      const l = v.labels ?? {};
      return { id: v.voice_id, name: v.name, info: [l.gender, l.age, l.accent, l.language, l.use_case ?? l.description, v.category].filter(Boolean).join(" · ") };
    })
    .filter((v) => !f || `${v.id} ${v.name} ${v.info}`.toLowerCase().includes(f));
};
