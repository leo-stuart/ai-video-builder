// Validador: confere um episódio antes de gastar voz e render. Erro impede o render; aviso pede uma olhada.
// Regras da marca vêm de workspace.json → rules e brand.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { VbError } from "./errors.mjs";
import { compile, epDir, isSpec, readLedger, readSpec, readTiming } from "./episodes.mjs";
import { manifest, formats } from "./playbook.mjs";
import { config, readJson } from "./workspace.mjs";

const PALETTE = ["gold", "coral", "indigo", "mint", "teal", "lilac", "red", "sky", "ink"];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const norm = (w) => w.toLowerCase().normalize("NFD").replace(/[^a-z0-9']/g, "");
const slugTag = (s) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

export const validate = async (ws, slug, { scriptOnly = false } = {}) => {
  if (!isSpec(ws, slug)) throw new VbError("no-episode", `o episódio "${slug}" não existe (falta episode.json).`);
  const cfg = config(ws);
  const rules = cfg.rules ?? {};
  const brand = cfg.brand ?? {};
  const spec = readSpec(ws, slug);
  const dir = epDir(ws, slug);
  const script = existsSync(join(dir, "script.json")) ? readJson(join(dir, "script.json")) : compile(spec);

  const errors = [];
  const warnings = [];
  const E = (message, scene) => errors.push(scene ? { scene, message } : { message });
  const A = (message, scene) => warnings.push(scene ? { scene, message } : { message });

  const tag = typeof rules.foreignMarkup === "string" && rules.foreignMarkup ? rules.foreignMarkup : null;
  const plain = (n) => n.replace(/\[\/?en\]/g, "").replace(/\*/g, "");
  const words = (n) => plain(n).split(/\s+/).filter(Boolean);
  const scenes = script.scenes ?? [];

  /* ───────────── roteiro ───────────── */
  if (script.slug !== slug) E(`"slug" no roteiro é "${script.slug}", mas a pasta é "${slug}". Deixe os dois iguais.`);
  if (!/^ep\d\d-[a-z0-9-]+$/.test(slug)) A(`slug "${slug}" foge do padrão epNN-tema-curto (ex.: ep04-cash-or-card).`);
  if (!script.captions || script.captions.y !== 1290 || script.captions.size !== 84) A(`falta "captions": { "y": 1290, "size": 84 } na raiz do roteiro (legenda no padrão das referências).`);
  if (!script.eleven) A(`falta "eleven": "<id da voz do narrador>" na raiz (workspace.json → voices.narrator).`);
  if (scenes.length < 9 || scenes.length > 22) A(`${scenes.length} cenas. O formato pede de 14 a 20: cada cena é uma fala curta.`);

  const ids = new Set();
  let total = 0;
  scenes.forEach((s, i) => {
    const at = `cena ${i + 1} ("${s.id}")`;
    if (!/^[a-z][a-z0-9]*$/.test(s.id ?? "")) E(`${at}: id precisa ser uma palavra minúscula sem acento nem espaço.`, s.id);
    if (ids.has(s.id)) E(`${at}: id repetido. Cada cena tem um id único.`, s.id);
    ids.add(s.id);
    const n = s.narration ?? "";
    if (!n.trim()) return E(`${at}: narração vazia.`, s.id);
    if ((n.match(/\[en\]/g) ?? []).length !== (n.match(/\[\/en\]/g) ?? []).length) E(`${at}: [en] sem [/en] correspondente.`, s.id);
    if ((n.match(/\*/g) ?? []).length % 2) E(`${at}: asterisco de ênfase sem par. Use *palavra*.`, s.id);
    const w = words(n);
    total += w.length;
    if (w.length > 18) A(`${at}: ${w.length} palavras. Passou de 18: quebre em duas cenas.`, s.id);
    if (/\bIA\b/.test(plain(n))) A(`${at}: escreva "inteligência artificial" em vez de "IA" na narração (a voz lê melhor). No "label" e nos rótulos da tela pode ser IA.`, s.id);
    if (tag) {
      const outside = n.replace(/\[en\].*?\[\/en\]/g, " ");
      const eng = outside.match(/\b(the|please|you|what|where|here|would|could|thanks?|sorry|yes|have|want|need)\b/gi);
      if (eng) A(`${at}: parece haver inglês fora de [${tag}]…[/${tag}] (${[...new Set(eng)].join(", ")}). Todo trecho em inglês leva a marca.`, s.id);
    }
    if (/fluente em|em \d+ (dias|semanas|meses)|gr[áa]tis|R\$|\d+ ?%/.test(plain(n))) A(`${at}: promessa de prazo, preço ou porcentagem. Só cite o que o time confirmou.`, s.id);
    if (s.speaker) {
      if (!script.cast?.[s.speaker]) E(`${at}: speaker "${s.speaker}" não existe em "cast".`, s.id);
      if (tag && !/\[en\]/.test(n) && s.speaker !== "voce") A(`${at}: fala de "${s.speaker}" sem inglês. Quem atende e o tutor falam inglês; português é do narrador.`, s.id);
    }
    if (tag && s.speaker === "tutor" && /\[en\]/.test(n) && !s.sub) A(`${at}: fala do tutor em inglês sem "sub" (a tradução curta embaixo da legenda).`, s.id);
    if (s.sub && s.sub.length > 48) A(`${at}: "sub" com ${s.sub.length} caracteres. Passou de 48 e vai quebrar em três linhas.`, s.id);
    if (s.banner && s.banner.length > 34) A(`${at}: "banner" com ${s.banner.length} caracteres. Passou de 34.`, s.id);
  });

  Object.entries(script.cast ?? {}).forEach(([k, c]) => {
    if (!c.label) E(`cast.${k}: falta "label" (o nome que aparece sobre a legenda).`);
    if (!PALETTE.includes(c.color)) E(`cast.${k}: color "${c.color}" não existe. Use uma de: ${PALETTE.join(", ")}.`);
    if (!c.eleven) A(`cast.${k}: falta "eleven" (id da voz). Rode listVoices / vid voices e ponha o id no cast.`);
  });

  if (JSON.stringify(script).includes("TODO")) E(`ainda há "TODO" no roteiro. Preencha (a legenda do post, por exemplo).`);

  const first = scenes[0];
  const last = scenes.at(-1);
  if (first && words(first.narration).length > 10) A(`a primeira cena tem ${words(first.narration).length} palavras. O gancho precisa caber em 10.`, first.id);
  if (last) {
    if (last.captions !== false) E(`a última cena ("${last.id}") precisa de "captions": false (ela mostra a tela final).`, last.id);
    if ((last.hold ?? 0) < 1.2) E(`a última cena ("${last.id}") precisa de "hold": 1.6 para a tela final ficar no ar.`, last.id);
    if (brand.cta && !new RegExp(esc(brand.cta), "i").test(last.narration)) A(`a última cena deveria terminar em "${brand.cta}."`, last.id);
  }
  if (rules.requireBrandMention && brand.name) {
    const re = new RegExp(esc(brand.name), "i");
    if (!scenes.some((s) => re.test(s.narration))) E(`nenhuma cena fala "${brand.name}". O app precisa ser nomeado no pitch.`);
  }
  for (const need of rules.requireBeats ?? []) {
    if (!spec.beats.some((b) => b.type === need)) A(`nenhuma cena do tipo "${need}". Este espaço de trabalho pede essa cena (rules.requireBeats).`);
  }
  if (total < 40 || total > 120) A(`${total} palavras no total. O alvo é de 75 a 110 (40 a 47 segundos).`);
  if (!script.post?.caption) E(`falta post.caption (a legenda do post).`);
  const tags = script.post?.hashtags ?? [];
  if (tags.length < 5 || tags.length > 8) A(`${tags.length} hashtags. Use de 5 a 8.`);
  const brandTag = brand.name ? slugTag(brand.name) : "";
  if (rules.requireBrandMention && brandTag && !tags.includes(brandTag)) A(`falta a hashtag "${brandTag}".`);

  /* ───────────── tempos ───────────── */
  if (!scriptOnly) {
    const timing = readTiming(ws, slug);
    let dur = 0;
    const missing = [];
    const silent = [];
    scenes.forEach((s) => {
      const t = timing.scenes?.[s.id];
      if (!t) return missing.push(s.id);
      dur += t.dur + (s.hold ?? 0);
      const a = t.words.map((w) => w.t).join(" ");
      if (a !== words(s.narration).join(" ")) E(`cena "${s.id}": a narração mudou depois da voz. Rode: vid voice ${slug}`, s.id);
      if (!t.audio) silent.push(s.id);
      if (t.dur > 6.5) A(`cena "${s.id}" dura ${t.dur.toFixed(1)}s. Passou de 6,5s: quebre em duas ou use três planos.`, s.id);
    });
    if (missing.length) E(`${missing.length} cena(s) sem voz/tempo (${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""}). Rode: vid voice ${slug}`);
    if (silent.length) A(`${silent.length} cena(s) sem áudio (voz "none"). Antes do render final rode: vid voice ${slug}`);
    if (timing.provider === "say") A(`voz "say" (macOS) é rascunho. Para publicar, gere com ElevenLabs ou gravação.`);
    const fmt = formats(ws).find((f) => f.id === spec.format) ?? null;
    if (dur > 60) E(`${dur.toFixed(0)}s de duração. Passou de 60s: corte cenas.`);
    else {
      const [lo, hi] = fmt?.target ?? [35, 50];
      if (!missing.length && (dur > hi || dur < lo)) A(`${dur.toFixed(0)}s de duração. O alvo deste formato é de ${lo} a ${hi}s.`);
    }
  }

  /* ───────────── cenas ───────────── */
  checkSpec();

  function checkSpec() {
    const types = manifest();
    const freedom = spec.freedom ?? "recipe";
    const fmt = formats(ws).find((f) => f.id === spec.format) ?? null;
    if (!fmt) A(`formato "${spec.format}" não existe em playbook/.`);
    if (spec.beats.at(-1)?.type !== "end-card") E(`a última cena precisa ser do tipo "end-card".`);
    for (const b of spec.beats) {
      const at = `cena "${b.id}"`;
      if (b.type.startsWith("custom:")) {
        E(`${at}: tipos "custom:" (cenas em código) ficam fora desta versão. Troque por um tipo da lista (${Object.keys(types).join(", ")}) ou escreva a cena em dados (scene).`, b.id);
        continue;
      }
      if (!types[b.type]) E(`${at}: tipo "${b.type}" não existe. Tipos: ${Object.keys(types).join(", ")}`, b.id);
      if (b.type === "scene-data" && !b.scene) E(`${at}: tipo scene-data sem cena em dados. Rode: vid scene ${slug} scene ${b.id} --json '{…}'`, b.id);
      if (b.scene && freedom === "recipe") E(`${at}: cena escrita em dados ("scene") exige o nível "guided" ou "free".`, b.id);
      const m = types[b.type];
      if (m) {
        for (const k of m.needs ?? []) if (!String(b.params?.[k] ?? "").trim()) E(`${at}: falta o parâmetro "${k}" (tipo ${b.type}).`, b.id);
        for (const k of Object.keys(b.params ?? {})) if (!(m.needs ?? []).includes(k) && !(m.optional ?? []).includes(k)) A(`${at}: parâmetro "${k}" não existe no tipo ${b.type}. Existem: ${[...(m.needs ?? []), ...(m.optional ?? [])].join(", ") || "nenhum"}.`, b.id);
      }
      const p = b.params ?? {};
      for (const k of ["heavy", "light", "need", "pin", "city", "label"]) if (typeof p[k] === "string" && p[k].length > 16) A(`${at}: "${k}" tem ${p[k].length} caracteres. Rótulo preso a objeto: até 16, senão sai do quadro.`, b.id);
      for (const k of ["cueWord", "cueA", "cueB", "cueMid", "plateCue"]) {
        if (p[k] && !words(b.narration).some((w) => norm(w) === norm(String(p[k])))) E(`${at}: ${k} "${p[k]}" não é uma palavra da narração. Palavras: ${words(b.narration).join(" | ")}`, b.id);
      }
      if (m && /^(hook-walk-out|arrive-need|walk-out-street|metaphor|crowd|freeze|app-enter)$/.test(b.type) && !/\*/.test(b.narration) && !p.cueWord) A(`${at}: sem *ênfase* e sem cueWord. A animação dispara na última palavra; marque a palavra forte com *asteriscos*.`, b.id);
    }
    if (freedom === "recipe" && fmt) {
      const want = fmt.beats.map((b) => b.type).join(",");
      const have = spec.beats.map((b) => b.type).join(",");
      if (want !== have) E(`no nível "recipe" a sequência de cenas é a do formato (${fmt.id}); esta foi alterada. Peça liberdade "guided" para reordenar.`);
    }
    // Variedade: compara com os episódios anteriores do histórico.
    const ledger = readLedger(ws);
    const idx = ledger.findIndex((e) => e.slug === slug);
    const prev = (idx < 0 ? ledger : ledger.slice(0, idx)).slice(-cfg.variety.window);
    const fp = { format: spec.format, place: spec.world.place, metaphor: spec.world.metaphor, camStyle: spec.world.camStyle, shirt: spec.world.look?.me?.shirt };
    for (const e of prev) {
      const same = Object.keys(fp).filter((k) => fp[k] !== undefined && e[k] === fp[k]);
      if (same.length > cfg.variety.maxShared) E(`parecido demais com ${e.slug} (repete ${same.join(", ")}). Troque o lugar ou o formato: vid scene ${slug} world place=<outro>.`);
    }
  }

  return { errors, warnings, ok: errors.length === 0 };
};
