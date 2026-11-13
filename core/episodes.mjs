// Episódios declarativos: leitura, escrita, criação (com sorteio de mundo), edição e histórico de variedade.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { VbError } from "./errors.mjs";
import { config, paths, readJson, writeJson } from "./workspace.mjs";
import { formats, listPautas, loadFormat, manifest, pautas, places, variants } from "./playbook.mjs";

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
export const epDir = (ws, slug) => {
  if (!SLUG.test(String(slug ?? ""))) throw new VbError("bad-slug", `slug inválido: "${slug}". Use letras minúsculas, números e hífen (ex.: ep14-tema).`);
  return join(paths(ws).episodes, slug);
};
export const isSpec = (ws, slug) => existsSync(join(epDir(ws, slug), "episode.json"));
export const readSpec = (ws, slug) => {
  if (!isSpec(ws, slug)) throw new VbError("no-episode", `o episódio "${slug}" não existe em ${paths(ws).episodes} (falta episode.json).`);
  return readJson(join(epDir(ws, slug), "episode.json"));
};

/** O que a narração e a legenda precisam. É o script.json que a voz, o validador e o Remotion leem. */
export const compile = (spec) => {
  const s = {
    slug: spec.slug,
    series: spec.series,
    number: spec.number,
    title: spec.title,
    eleven: spec.eleven,
    captions: spec.captions,
    post: spec.post,
    cast: spec.cast,
    scenes: spec.beats.map((b) => {
      const o = { id: b.id, narration: b.narration };
      for (const k of ["speaker", "sub", "banner", "hold"]) if (b[k] !== undefined) o[k] = b[k];
      if (b.captions === false) o.captions = false;
      return o;
    }),
  };
  return JSON.parse(JSON.stringify(s));
};

/** Grava episode.json e script.json compilado. Toda mudança de spec passa por aqui. */
export const writeSpec = (ws, spec) => {
  const dir = epDir(ws, spec.slug);
  mkdirSync(dir, { recursive: true });
  writeJson(join(dir, "episode.json"), spec);
  writeJson(join(dir, "script.json"), compile(spec));
  if (!existsSync(join(dir, "timing.json"))) writeJson(join(dir, "timing.json"), { provider: "none", scenes: {} });
};

export const readTiming = (ws, slug) => {
  const p = join(epDir(ws, slug), "timing.json");
  return existsSync(p) ? readJson(p) : { provider: "none", scenes: {} };
};

/* ───────────── histórico e variedade ───────────── */

export const readLedger = (ws) => (existsSync(paths(ws).ledger) ? readJson(paths(ws).ledger) : []);
export const writeLedger = (ws, l) => writeJson(paths(ws).ledger, l);

const hash = (s) => parseInt(createHash("sha1").update(String(s)).digest("hex").slice(0, 8), 16);
const mulberry = (a) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const OPT = {
  place: ["cafe", "restaurante", "hotel", "imigracao", "aeroporto", "loja", "farmacia"],
  metaphor: ["scale", "bars", "pile"],
  camStyle: ["push", "pull", "slide"],
  studioTone: ["indigo", "menta"],
  shirt: ["#FFC234", "#FF7A59", "#19C99A", "#B57CFF", "#28C5E7", "#E5484D"],
  pants: ["#2F3A8F", "#1E1B4B", "#3D4B5C", "#5B3A29"],
  hair: ["#2A1B14", "#111111", "#7A3B1D", "#C9A227"],
  skin: ["#F2C29B", "#E8B48C", "#C98F68", "#8C5A3C"],
  hat: ["none", "none", "cap", "beanie"],
};
const FP = ["format", "place", "metaphor", "camStyle", "shirt"];
export const shared = (a, b) => FP.filter((k) => a[k] === b[k]).length;

/** Sorteia o mundo do episódio, fugindo do que os últimos episódios já usaram. */
export const chooseWorld = ({ slug, formatIds, format, place, ledger, window, maxShared }) => {
  const recent = ledger.filter((e) => e.slug !== slug).slice(-window);
  let best = null;
  for (let salt = 0; salt < 300; salt++) {
    const rnd = mulberry(hash(slug) + salt);
    const least = (key, options, fixed) => {
      if (fixed !== undefined) return fixed;
      const counts = options.map((o) => recent.filter((e) => e[key] === o).length);
      const min = Math.min(...counts);
      const cand = options.filter((_, i) => counts[i] === min);
      return cand[Math.floor(rnd() * cand.length)];
    };
    const fmt = least("format", formatIds, format);
    const fp = { format: fmt, place: least("place", OPT.place, place), metaphor: least("metaphor", OPT.metaphor), camStyle: least("camStyle", OPT.camStyle), shirt: least("shirt", OPT.shirt) };
    const worst = Math.max(0, ...recent.map((e) => shared(e, fp)));
    best = { fp, rnd, rest: { studioTone: least("studioTone", OPT.studioTone), pants: least("pants", OPT.pants), hair: least("hair", OPT.hair), skin: least("skin", OPT.skin), hat: least("hat", OPT.hat), oSkin: least("oSkin", OPT.skin), oHair: least("oHair", OPT.hair) } };
    if (worst <= maxShared) return best;
  }
  return best;
};

/* ───────────── formatos ───────────── */

const sub = (v, slots) =>
  typeof v === "string"
    ? v.replace(/\{\{(\w+)\}\}/g, (_, k) => {
        if (slots[k] === undefined) throw new VbError("missing-field", `falta o campo "${k}" na ficha.`);
        return slots[k];
      })
    : Array.isArray(v)
      ? v.map((e) => sub(e, slots))
      : v && typeof v === "object"
        ? Object.fromEntries(Object.entries(v).map(([k, e]) => [k, sub(e, slots)]))
        : v;

const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);

/** Campos que se calculam sozinhos a partir da ficha. */
const derive = (f) => {
  const d = { ...f };
  if (d.hook) d.hookPlain = d.hook.replace(/\*/g, "");
  if (d.question) d.questionShort ??= d.question.replace(/^(hi|hello|hey)[!,.]?\s+/i, "");
  if (d.right) {
    d.rightSay ??= lc(d.right);
    d.rightBang ??= d.right.replace(/\.$/, "!");
  }
  return d;
};

/** Cada pool de falas fixas escolhe a variante menos usada nos últimos episódios. */
const pickPools = (ws, text, ledger, rnd) => {
  const V = variants(ws);
  const picks = {};
  const names = [...new Set([...JSON.stringify(text).matchAll(/\{\{pool:(\w+)\}\}/g)].map((m) => m[1]))];
  for (const n of names) {
    const used = ledger.slice(-6).map((e) => e.sig?.[n]).filter((x) => x !== undefined);
    const counts = V[n].map((_, i) => used.filter((u) => u === i).length);
    const min = Math.min(...counts);
    const cand = V[n].map((_, i) => i).filter((i) => counts[i] === min);
    picks[n] = cand[Math.floor(rnd() * cand.length)];
  }
  return picks;
};

const missingSlots = (format, ficha) => format.slots.filter((s) => s.default === undefined && !String(ficha[s.key] ?? "").trim());
const missingMsg = (miss, prefix = "") => `${prefix}faltam campos na ficha:\n${miss.map((s) => `  ${s.key}: ${s.ask}  (ex.: ${s.example})`).join("\n")}`;

const expandFormat = (ws, format, ficha, ledger, rnd) => {
  const slots = derive({ ...Object.fromEntries(format.slots.filter((s) => s.default !== undefined).map((s) => [s.key, s.default])), ...ficha });
  const picks = pickPools(ws, format.beats, ledger, rnd);
  const V = variants(ws);
  const text = JSON.stringify(format.beats).replace(/\{\{pool:(\w+)\}\}/g, (_, n) => JSON.stringify(V[n][picks[n]]).slice(1, -1));
  const beats = sub(JSON.parse(text), slots);
  const post = format.post ? sub(format.post, slots) : undefined;
  return { beats, post, picks, slots };
};

/** Nível de liberdade: o pedido explícito, ou o do workspace, ou o do modelo (haiku → recipe…). */
export const freedomFor = (cfg, { freedom, model } = {}) => {
  if (freedom) return freedom;
  if (cfg.freedom && cfg.freedom !== "auto") return cfg.freedom;
  const m = String(model ?? "").toLowerCase();
  const hit = Object.keys(cfg.models ?? {}).find((k) => m.includes(k));
  return hit ? cfg.models[hit] : "recipe";
};

/** Cria o episódio inteiro (mundo sorteado, cenas expandidas, elenco, legenda do post) e o grava. */
export const createEpisode = async (ws, { slug, title, pauta, format, ficha = {}, place, freedom, model } = {}) => {
  const cfg = config(ws);
  let formatId = format;
  let placeId = place;
  let fichaAll = { ...ficha };
  if (pauta) {
    const p = pautas(ws).find((x) => x.id === pauta);
    if (!p) throw new VbError("no-pauta", `a pauta "${pauta}" não existe. Veja as pautas disponíveis (vid pauta).`);
    title ??= p.title;
    formatId ??= p.format;
    placeId ??= p.place;
    fichaAll = { ...p.ficha, ...ficha };
  }
  if (!slug || !/^ep\d\d-[a-z0-9-]+$/.test(slug) || !title) throw new VbError("usage", 'informe o slug (epNN-tema), o título (ou uma pauta) e o formato. Ex.: vid new ep14-tema --pauta <id>');
  if (existsSync(epDir(ws, slug))) throw new VbError("exists", `já existe o episódio ${slug}.`);
  if (placeId && !OPT.place.includes(placeId)) throw new VbError("bad-place", `lugar "${placeId}" não existe. Lugares: ${OPT.place.join(", ")}`);

  const ledger = readLedger(ws);
  const fmts = formats(ws);
  if (!fmts.length) throw new VbError("no-format", "o playbook deste espaço de trabalho não tem formatos (playbook/*.json).");
  const fmtFixed = formatId ? loadFormat(ws, formatId) : null;
  const miss = fmtFixed ? missingSlots(fmtFixed, fichaAll) : [];
  if (miss.length) throw new VbError("missing-field", missingMsg(miss));
  const { fp, rnd, rest } = chooseWorld({ slug, formatIds: fmts.map((f) => f.id), format: formatId, place: placeId, ledger, window: cfg.variety.window, maxShared: cfg.variety.maxShared });
  const fmt = fmtFixed ?? loadFormat(ws, fp.format);
  const miss2 = missingSlots(fmt, fichaAll);
  if (miss2.length) throw new VbError("missing-field", missingMsg(miss2, `o formato sorteado foi "${fmt.id}". `));
  const x = expandFormat(ws, fmt, fichaAll, ledger, rnd);
  const attendant = places(ws)[fp.place]?.attendant ?? "Atendente";
  const spec = {
    slug,
    title,
    number: Number(slug.slice(2, 4)) || undefined,
    series: cfg.series ?? "Inglês sem travar",
    format: fmt.id,
    freedom: freedomFor(cfg, { freedom, model }),
    eleven: cfg.voices.narrator,
    captions: { y: 1290, size: 84 },
    post: {
      caption: fichaAll.caption ?? x.post?.caption ?? "",
      hashtags: fichaAll.hashtags ?? cfg.post.hashtags ?? [],
      shortsTitle: fichaAll.shortsTitle ?? x.post?.shortsTitle,
    },
    cast: {
      voce: { label: "Você", color: "gold", eleven: cfg.voices.voce, say: { pt: "Luciana", en: "Luciana" } },
      atendente: { label: attendant, color: "coral", eleven: cfg.voices.atendente, say: { en: "Samantha" } },
      tutor: { label: "Tutor de IA", color: "indigo", eleven: cfg.voices.tutor, say: { en: "Daniel" } },
    },
    // (o elenco é reduzido logo abaixo a quem realmente fala neste episódio)
    world: {
      place: fp.place,
      look: {
        me: { shirt: fp.shirt, pants: rest.pants, hair: rest.hair, skin: fichaAll.skin ?? rest.skin, hat: rest.hat, hatColor: "#E5484D" },
        other: { skin: rest.oSkin, hair: rest.oHair },
      },
      camStyle: fp.camStyle,
      studioTone: rest.studioTone,
      metaphor: fp.metaphor,
    },
    beats: x.beats,
  };
  const speaking = new Set(spec.beats.map((b) => b.speaker).filter(Boolean));
  for (const k of Object.keys(spec.cast)) if (!speaking.has(k)) delete spec.cast[k];
  writeSpec(ws, spec);
  writeLedger(ws, [...ledger.filter((e) => e.slug !== slug), { slug, ...fp, studioTone: rest.studioTone, sig: x.picks, pauta }]);
  return { spec, world: spec.world };
};

/* ───────────── consulta ───────────── */

const statusOf = (ws, slug, spec, timing) => {
  if (existsSync(join(paths(ws).out, slug, "meta.json"))) return "packed";
  if (existsSync(join(paths(ws).out, `${slug}.mp4`))) return "rendered";
  const voiced = timing.provider !== "none" && spec.beats.every((b) => timing.scenes?.[b.id]);
  return voiced ? "voiced" : "draft";
};

export const getEpisode = async (ws, slug) => {
  const spec = readSpec(ws, slug);
  const dir = epDir(ws, slug);
  const script = existsSync(join(dir, "script.json")) ? readJson(join(dir, "script.json")) : compile(spec);
  const timing = readTiming(ws, slug);
  return { spec, script, timing, status: statusOf(ws, slug, spec, timing) };
};

export const listEpisodes = async (ws) => {
  const dir = paths(ws).episodes;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((s) => existsSync(join(dir, s, "episode.json")))
    .sort()
    .map((slug) => {
      const spec = readSpec(ws, slug);
      return { slug, title: spec.title, format: spec.format, freedom: spec.freedom ?? "recipe", status: statusOf(ws, slug, spec, readTiming(ws, slug)) };
    });
};

export const forget = async (ws, slug) => {
  writeLedger(ws, readLedger(ws).filter((e) => e.slug !== slug));
  return { ok: true };
};

/** Apaga o episódio e o que ele gerou (áudio, vídeo, pacote) e o tira do histórico. O cache de voz entre episódios fica. */
export const deleteEpisode = async (ws, slug) => {
  const dir = epDir(ws, slug);
  const p = paths(ws);
  rmSync(dir, { recursive: true, force: true });
  rmSync(join(p.public, "audio", slug), { recursive: true, force: true });
  rmSync(join(p.out, slug), { recursive: true, force: true });
  for (const ext of ["mp4", "txt"]) rmSync(join(p.out, `${slug}.${ext}`), { force: true });
  await forget(ws, slug);
  return { ok: true };
};

/* ───────────── edição ───────────── */

const RECIPE_OK = new Set(["set"]);
const BEAT_FIELDS = ["narration", "sub", "speaker", "hold", "banner", "captions"];
const setPath = (o, path, v) => {
  const ks = path.split(".");
  let c = o;
  ks.slice(0, -1).forEach((k) => (c = c[k] ??= {}));
  c[ks.at(-1)] = v;
};
const noCustom = (t) => {
  if (String(t).startsWith("custom:")) throw new VbError("custom-unsupported", `tipo "${t}": cenas em código (custom:) ficam fora desta versão. Use um tipo da lista (vid formats / listBeats) ou escreva a cena em dados ("scene").`);
};

/**
 * Edita uma cena sem abrir arquivo. `op`:
 *   { type: "set", id, fields: { narration, sub, speaker, hold, banner, captions, "params.x": v } }
 *   { type: "world", fields: { place, metaphor, camStyle, studioTone } }
 *   { type: "replace", id, beatType?, narration?, fields? }
 *   { type: "insert", after, id, beatType, narration, speaker?, sub?, banner?, hold?, fields? }
 *   { type: "move", id, after }
 *   { type: "remove", id }
 *   { type: "scene", id, scene: { parts, overlays } }
 * O nível de liberdade do episódio manda no que é permitido.
 */
export const editScene = async (ws, slug, op) => {
  const spec = readSpec(ws, slug);
  const freedom = spec.freedom ?? "recipe";
  const kind = op?.type;
  if (!["set", "world", "replace", "insert", "move", "remove", "scene"].includes(kind)) throw new VbError("bad-op", `operação "${kind}" não existe. Use set, world, replace, insert, move, remove ou scene.`);
  if (freedom === "recipe" && !RECIPE_OK.has(kind)) throw new VbError("freedom", `este episódio está no nível "recipe": só a operação "set" é permitida. Para o resto, crie o episódio com liberdade "guided".`);
  const types = manifest();
  const beatOf = (i) => spec.beats.find((b) => b.id === i) ?? (() => { throw new VbError("no-scene", `não existe a cena "${i}". Cenas: ${spec.beats.map((b) => b.id).join(", ")}`); })();
  const assign = (b, fields = {}) => {
    for (const [k, val] of Object.entries(fields)) {
      if (k.startsWith("params.")) setPath(b, k, val);
      else if (BEAT_FIELDS.includes(k)) b[k] = val;
      else throw new VbError("bad-field", `campo "${k}" não pode ser editado. Use ${BEAT_FIELDS.join(", ")} ou params.<nome>.`);
    }
  };

  if (kind === "set") {
    assign(beatOf(op.id), op.fields);
  } else if (kind === "world") {
    const allowed = { place: OPT.place, metaphor: OPT.metaphor, camStyle: OPT.camStyle, studioTone: ["indigo", "noite", "menta", "coral"] };
    for (const [k, v] of Object.entries(op.fields ?? {})) {
      if (!allowed[k]) throw new VbError("bad-field", `world aceita: ${Object.keys(allowed).join(", ")}`);
      if (!allowed[k].includes(v)) throw new VbError("bad-value", `${k} aceita: ${allowed[k].join(", ")}`);
      spec.world[k] = v;
    }
  } else if (kind === "replace") {
    const b = beatOf(op.id);
    if (op.beatType) {
      noCustom(op.beatType);
      if (!types[op.beatType]) throw new VbError("bad-type", `tipo "${op.beatType}" não existe. Tipos: ${Object.keys(types).join(", ")}`);
      b.type = op.beatType;
      b.params = {};
      delete b.scene;
    }
    if (op.narration) b.narration = op.narration;
    assign(b, op.fields);
  } else if (kind === "insert") {
    const i = spec.beats.findIndex((b) => b.id === op.after);
    if (i < 0) throw new VbError("no-scene", `não existe a cena "${op.after}".`);
    if (!op.id || !/^[a-z][a-z0-9]*$/.test(op.id)) throw new VbError("bad-id", "o id da cena precisa ser uma palavra minúscula sem acento.");
    if (spec.beats.some((b) => b.id === op.id)) throw new VbError("exists", `já existe uma cena "${op.id}".`);
    noCustom(op.beatType);
    if (!op.beatType || !types[op.beatType]) throw new VbError("bad-type", `tipo inválido. Tipos: ${Object.keys(types).join(", ")}`);
    if (!op.narration) throw new VbError("usage", "a narração é obrigatória.");
    const b = { id: op.id, type: op.beatType, narration: op.narration, params: {} };
    for (const k of ["speaker", "sub", "banner", "hold"]) if (op[k] !== undefined) b[k] = op[k];
    assign(b, op.fields);
    spec.beats.splice(i + 1, 0, b);
  } else if (kind === "move") {
    const b = beatOf(op.id);
    if (!op.after) throw new VbError("usage", "informe depois de qual cena (after).");
    spec.beats.splice(spec.beats.indexOf(b), 1);
    const j = spec.beats.findIndex((x) => x.id === op.after);
    if (j < 0) throw new VbError("no-scene", `não existe a cena "${op.after}".`);
    spec.beats.splice(j + 1, 0, b);
  } else if (kind === "remove") {
    const b = beatOf(op.id);
    if (b.type === "end-card") throw new VbError("end-card", "a tela final não pode ser removida.");
    spec.beats.splice(spec.beats.indexOf(b), 1);
  } else if (kind === "scene") {
    const b = beatOf(op.id);
    if (!op.scene || typeof op.scene !== "object") throw new VbError("usage", "informe a cena em dados (scene).");
    b.scene = op.scene;
  }

  writeSpec(ws, spec);
  if (kind === "world") {
    const l = readLedger(ws);
    const e = l.find((x) => x.slug === slug);
    if (e) {
      Object.assign(e, { place: spec.world.place, metaphor: spec.world.metaphor, camStyle: spec.world.camStyle });
      writeLedger(ws, l);
    }
  }
  return { spec };
};
