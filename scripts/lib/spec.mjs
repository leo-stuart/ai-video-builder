// Biblioteca comum do builder: lê e grava episódios declarativos, expande
// formatos, sorteia a variação e guarda o histórico (ledger).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const W = (p, d) => writeFileSync(p, JSON.stringify(d, null, 2) + "\n");

export const config = () => J(join(root, "builder.config.json"));
export const manifest = () => J(join(root, "src/engine/beats.manifest.json"));
export const places = () => J(join(root, "formats/places.json"));
export const variants = () => J(join(root, "formats/variants.json"));
export const formats = () =>
  readdirSync(join(root, "formats"))
    .filter((f) => f.endsWith(".json") && !["places.json", "variants.json"].includes(f))
    .map((f) => J(join(root, "formats", f)));
export const pautas = () =>
  readdirSync(join(root, "formats/pautas"))
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => J(join(root, "formats/pautas", f)).map((p) => ({ ...p, format: f.replace(".json", "") })));
export const loadFormat = (id) => {
  const f = formats().find((x) => x.id === id);
  if (!f) throw new Error(`formato "${id}" não existe. Formatos: ${formats().map((x) => x.id).join(", ")}`);
  return f;
};

export const epDir = (slug) => join(root, "src/episodes", slug);
export const isSpec = (slug) => existsSync(join(epDir(slug), "episode.json"));
export const readSpec = (slug) => {
  if (!isSpec(slug)) throw new Error(`${slug} não é um episódio declarativo (falta src/episodes/${slug}/episode.json).`);
  return J(join(epDir(slug), "episode.json"));
};

/** O que a narração e a legenda precisam. É o script.json que o tts, o check e o Remotion leem. */
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

/** Grava episode.json e o script.json compilado. Todo comando que muda o spec passa por aqui. */
export const writeSpec = (spec) => {
  const dir = epDir(spec.slug);
  mkdirSync(dir, { recursive: true });
  W(join(dir, "episode.json"), spec);
  W(join(dir, "script.json"), compile(spec));
  if (!existsSync(join(dir, "timing.json"))) W(join(dir, "timing.json"), { provider: "none", scenes: {} });
};

/* ───────────── histórico e variedade ───────────── */

const ledgerPath = join(root, "ledger.json");
export const readLedger = () => (existsSync(ledgerPath) ? J(ledgerPath) : []);
export const writeLedger = (l) => W(ledgerPath, l);

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
        if (slots[k] === undefined) throw new Error(`falta o campo "${k}" na ficha.`);
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
const pickPools = (text, ledger, rnd) => {
  const V = variants();
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

export const missingSlots = (format, ficha) => format.slots.filter((s) => s.default === undefined && !String(ficha[s.key] ?? "").trim());

export const expandFormat = (format, ficha, ledger, rnd) => {
  const slots = derive({ ...Object.fromEntries(format.slots.filter((s) => s.default !== undefined).map((s) => [s.key, s.default])), ...ficha });
  const picks = pickPools(format.beats, ledger, rnd);
  const V = variants();
  const text = JSON.stringify(format.beats).replace(/\{\{pool:(\w+)\}\}/g, (_, n) => JSON.stringify(V[n][picks[n]]).slice(1, -1));
  const beats = sub(JSON.parse(text), slots);
  const post = format.post ? sub(format.post, slots) : undefined;
  return { beats, post, picks, slots };
};

/** Cria o episódio inteiro: mundo sorteado + beats expandidos + elenco + legenda do post. */
export const createEpisode = ({ slug, title, formatId, ficha, place, freedom, pautaId }) => {
  const cfg = config();
  const ledger = readLedger();
  const fmts = formats();
  const format = formatId ? loadFormat(formatId) : null;
  const miss = format ? missingSlots(format, ficha) : [];
  if (miss.length) throw new Error(`faltam campos na ficha:\n${miss.map((s) => `  ${s.key}: ${s.ask}  (ex.: ${s.example})`).join("\n")}`);
  const { fp, rnd, rest } = chooseWorld({ slug, formatIds: fmts.map((f) => f.id), format: formatId, place, ledger, window: cfg.variety.window, maxShared: cfg.variety.maxShared });
  const fmt = format ?? loadFormat(fp.format);
  const miss2 = missingSlots(fmt, ficha);
  if (miss2.length) throw new Error(`o formato sorteado foi "${fmt.id}". Faltam campos na ficha:\n${miss2.map((s) => `  ${s.key}: ${s.ask}  (ex.: ${s.example})`).join("\n")}`);
  const x = expandFormat(fmt, ficha, ledger, rnd);
  const hatColor = "#E5484D";
  const spec = {
    slug,
    title,
    number: Number(slug.slice(2, 4)) || undefined,
    series: "Inglês sem travar",
    format: fmt.id,
    freedom,
    eleven: cfg.voices.narrator,
    captions: { y: 1290, size: 84 },
    post: {
      caption: ficha.caption ?? x.post?.caption ?? "",
      hashtags: ficha.hashtags ?? ["ingles", "aprenderingles", "dicasdeingles", "inglesparaviagem", "falaringles", "pragma"],
      shortsTitle: ficha.shortsTitle ?? x.post?.shortsTitle,
    },
    cast: {
      voce: { label: "Você", color: "gold", eleven: cfg.voices.voce, say: { pt: "Luciana", en: "Luciana" } },
      atendente: { label: places()[fp.place].attendant, color: "coral", eleven: cfg.voices.atendente, say: { en: "Samantha" } },
      tutor: { label: "Tutor de IA", color: "indigo", eleven: cfg.voices.tutor, say: { en: "Daniel" } },
    },
    world: {
      place: fp.place,
      look: {
        me: { shirt: fp.shirt, pants: rest.pants, hair: rest.hair, skin: ficha.skin ?? rest.skin, hat: rest.hat, hatColor },
        other: { skin: rest.oSkin, hair: rest.oHair },
      },
      camStyle: fp.camStyle,
      studioTone: rest.studioTone,
      metaphor: fp.metaphor,
    },
    beats: x.beats,
  };
  return { spec, fingerprint: { slug, ...fp, studioTone: rest.studioTone, sig: x.picks, pauta: pautaId } };
};
