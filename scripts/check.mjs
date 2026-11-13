#!/usr/bin/env node
// Confere um episódio antes de gastar voz e render. Cada linha diz o que está
// errado e como consertar. ERRO impede o render; AVISO pede uma olhada.
//
//   node scripts/check.mjs <slug>            confere roteiro, tempos e cenas
//   node scripts/check.mjs <slug> --script   só o roteiro (antes do tts)
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
const onlyScript = args.includes("--script");
if (!slug) {
  console.error("uso: node scripts/check.mjs <slug> [--script]");
  process.exit(1);
}
const dir = join(root, "src/episodes", slug);
const errors = [];
const warns = [];
const E = (m) => errors.push(m);
const A = (m) => warns.push(m);

if (!existsSync(join(dir, "script.json"))) {
  console.error(`não existe ${dir}/script.json. Crie o episódio com: node scripts/new-episode.mjs ${slug} "Título"`);
  process.exit(1);
}
let script;
try {
  script = JSON.parse(readFileSync(join(dir, "script.json"), "utf8"));
} catch (e) {
  console.error(`script.json não é JSON válido: ${e.message}`);
  process.exit(1);
}

const PALETTE = ["gold", "coral", "indigo", "mint", "teal", "lilac", "red", "sky", "ink"];
const plain = (n) => n.replace(/\[\/?en\]/g, "").replace(/\*/g, "");
const words = (n) => plain(n).split(/\s+/).filter(Boolean);
const scenes = script.scenes ?? [];
const specPath = join(dir, "episode.json");
const spec = existsSync(specPath) ? JSON.parse(readFileSync(specPath, "utf8")) : null;

/* ───────────── roteiro ───────────── */
if (script.slug !== slug) E(`"slug" no roteiro é "${script.slug}", mas a pasta é "${slug}". Deixe os dois iguais.`);
if (!/^ep\d\d-[a-z0-9-]+$/.test(slug)) A(`slug "${slug}" foge do padrão epNN-tema-curto (ex.: ep04-cash-or-card).`);
if (!script.captions || script.captions.y !== 1290 || script.captions.size !== 84) A(`falta "captions": { "y": 1290, "size": 84 } na raiz do roteiro (legenda no padrão das referências).`);
if (!script.eleven) A(`falta "eleven": "<id da voz do narrador>" na raiz. Copie do ep03 ou rode node scripts/voices.mjs.`);
if (scenes.length < (spec ? 9 : 12) || scenes.length > 22) A(`${scenes.length} cenas. O formato pede de 14 a 20: cada cena é uma fala curta.`);

const ids = new Set();
let total = 0;
scenes.forEach((s, i) => {
  const at = `cena ${i + 1} ("${s.id}")`;
  if (!/^[a-z][a-z0-9]*$/.test(s.id ?? "")) E(`${at}: id precisa ser uma palavra minúscula sem acento nem espaço.`);
  if (ids.has(s.id)) E(`${at}: id repetido. Cada cena tem um id único.`);
  ids.add(s.id);
  const n = s.narration ?? "";
  if (!n.trim()) return E(`${at}: narração vazia.`);
  if ((n.match(/\[en\]/g) ?? []).length !== (n.match(/\[\/en\]/g) ?? []).length) E(`${at}: [en] sem [/en] correspondente.`);
  if ((n.match(/\*/g) ?? []).length % 2) E(`${at}: asterisco de ênfase sem par. Use *palavra*.`);
  const w = words(n);
  total += w.length;
  if (w.length > 18) A(`${at}: ${w.length} palavras. Passou de 18: quebre em duas cenas.`);
  if (/\bIA\b/.test(plain(n))) A(`${at}: escreva "inteligência artificial" em vez de "IA" na narração (a voz lê melhor). No "label" e nos rótulos da tela pode ser IA.`);
  const outside = n.replace(/\[en\].*?\[\/en\]/g, " ");
  const eng = outside.match(/\b(the|please|you|what|where|here|would|could|thanks?|sorry|yes|have|want|need)\b/gi);
  if (eng) A(`${at}: parece haver inglês fora de [en]…[/en] (${[...new Set(eng)].join(", ")}). Todo trecho em inglês leva a marca.`);
  if (/fluente em|em \d+ (dias|semanas|meses)|gr[áa]tis|R\$|\d+ ?%/.test(plain(n))) A(`${at}: promessa de prazo, preço ou porcentagem. Só cite o que o time confirmou.`);
  if (s.speaker) {
    if (!script.cast?.[s.speaker]) E(`${at}: speaker "${s.speaker}" não existe em "cast".`);
    if (!/\[en\]/.test(n) && s.speaker !== "voce") A(`${at}: fala de "${s.speaker}" sem inglês. Quem atende e o tutor falam inglês; português é do narrador.`);
  }
  if (s.speaker === "tutor" && /\[en\]/.test(n) && !s.sub) A(`${at}: fala do tutor em inglês sem "sub" (a tradução curta embaixo da legenda).`);
  if (s.sub && s.sub.length > 48) A(`${at}: "sub" com ${s.sub.length} caracteres. Passou de 48 e vai quebrar em três linhas.`);
  if (s.banner && s.banner.length > 34) A(`${at}: "banner" com ${s.banner.length} caracteres. Passou de 34.`);
});

Object.entries(script.cast ?? {}).forEach(([k, c]) => {
  if (!c.label) E(`cast.${k}: falta "label" (o nome que aparece sobre a legenda).`);
  if (!PALETTE.includes(c.color)) E(`cast.${k}: color "${c.color}" não existe. Use uma de: ${PALETTE.join(", ")}.`);
  if (!c.eleven) A(`cast.${k}: falta "eleven" (id da voz). Copie do ep03 ou rode node scripts/voices.mjs.`);
});

if (JSON.stringify(script).includes("TODO")) E(`ainda há "TODO" no roteiro. Preencha (a legenda do post, por exemplo).`);
const modelPath = join(root, "src/episodes/ep03-for-here-or-to-go/script.json");
if (!spec && slug !== "ep03-for-here-or-to-go" && existsSync(modelPath)) {
  // Só as cenas que mudam com a pauta: as outras são fixas da série.
  const OWN = ["pergunta", "fora", "treino", "erro", "corrige", "certo", "revanche", "resposta"];
  const model = Object.fromEntries(JSON.parse(readFileSync(modelPath, "utf8")).scenes.map((s) => [s.id, s.narration]));
  const same = scenes.filter((s) => OWN.includes(s.id) && model[s.id] === s.narration).map((s) => s.id);
  if (same.length > 2) E(`${same.length} cenas ainda têm a fala do episódio-modelo (${same.join(", ")}). Reescreva com a ficha desta pauta.`);
}

const first = scenes[0];
const last = scenes.at(-1);
if (first && words(first.narration).length > 10) A(`a primeira cena tem ${words(first.narration).length} palavras. O gancho precisa caber em 10.`);
if (last) {
  if (last.captions !== false) E(`a última cena ("${last.id}") precisa de "captions": false (ela mostra a tela final).`);
  if ((last.hold ?? 0) < 1.2) E(`a última cena ("${last.id}") precisa de "hold": 1.6 para a tela final ficar no ar.`);
  if (!/link na bio/i.test(last.narration)) A(`a última cena deveria terminar em "Link na bio."`);
}
if (!scenes.some((s) => /pragma/i.test(s.narration))) E(`nenhuma cena fala "Pragma". O app precisa ser nomeado no pitch.`);
if (!scenes.some((s) => s.speaker === "tutor")) A(`nenhuma cena do tutor. O treino com o tutor é a demonstração do produto.`);
if (total < (spec ? 40 : 60) || total > 120) A(`${total} palavras no total. O alvo é de 75 a 110 (40 a 47 segundos).`);
if (!script.post?.caption) E(`falta post.caption (a legenda do post).`);
const tags = script.post?.hashtags ?? [];
if (tags.length < 5 || tags.length > 8) A(`${tags.length} hashtags. Use de 5 a 8, e uma delas é "pragma".`);
if (!tags.includes("pragma")) A(`falta a hashtag "pragma".`);

/* ───────────── tempos e cenas ───────────── */
if (!onlyScript) {
  const tp = join(dir, "timing.json");
  const timing = existsSync(tp) ? JSON.parse(readFileSync(tp, "utf8")) : { scenes: {} };
  let dur = 0;
  const missing = [];
  const silent = [];
  scenes.forEach((s) => {
    const t = timing.scenes?.[s.id];
    if (!t) return missing.push(s.id);
    dur += t.dur + (s.hold ?? 0);
    const a = t.words.map((w) => w.t).join(" ");
    if (a !== words(s.narration).join(" ")) E(`cena "${s.id}": a narração mudou depois da voz. Rode: node scripts/tts.mjs ${slug}`);
    if (!t.audio) silent.push(s.id);
    if (t.dur > 6.5) A(`cena "${s.id}" dura ${t.dur.toFixed(1)}s. Passou de 6,5s: quebre em duas ou use três planos.`);
  });
  if (missing.length) E(`${missing.length} cena(s) sem voz/tempo (${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""}). Rode: node scripts/tts.mjs ${slug}`);
  if (silent.length) A(`${silent.length} cena(s) sem áudio (voz "none"). Antes do render final rode: node scripts/tts.mjs ${slug}`);
  if (timing.provider === "say") A(`voz "say" (macOS) é rascunho. Para publicar, gere com ElevenLabs ou gravação.`);
  if (dur > 60) E(`${dur.toFixed(0)}s de duração. Passou de 60s: corte cenas.`);
  else {
    const fp = spec && existsSync(join(root, "formats", `${spec.format}.json`)) ? JSON.parse(readFileSync(join(root, "formats", `${spec.format}.json`), "utf8")) : null;
    const [lo, hi] = fp?.target ?? [35, 50];
    if (!missing.length && (dur > hi || dur < lo)) A(`${dur.toFixed(0)}s de duração. O alvo deste formato é de ${lo} a ${hi}s.`);
  }

  const ip = join(dir, "index.tsx");
  if (spec) checkSpec();
  else if (!existsSync(ip)) E(`falta ${ip}.`);
  else {
    const src = readFileSync(ip, "utf8");
    const block = src.match(/visuals:\s*\{([\s\S]*?)\n\s*\},?\s*\n\};/);
    if (!block) E(`não achei "visuals: { … }" no fim de index.tsx. Copie o formato do ep03.`);
    else {
      const keys = [...block[1].replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/^\s*([a-z][a-z0-9]*)\s*:/gm)].map((m) => m[1]);
      scenes.forEach((s) => !keys.includes(s.id) && E(`cena "${s.id}" está no roteiro mas não em visuals. Crie a cena e ligue: ${s.id}: NomeDaCena,`));
      keys.forEach((k) => !ids.has(k) && E(`visuals tem "${k}", que não existe no roteiro. Apague ou corrija o id.`));
    }
    const all = scenes.flatMap((s) => words(s.narration).map((w) => w.toLowerCase().normalize("NFD").replace(/[^a-z0-9']/g, "")));
    for (const m of src.matchAll(/cue\(\s*["'`]([^"'`]+)["'`]/g)) {
      const w = m[1].toLowerCase().normalize("NFD").replace(/[^a-z0-9']/g, "");
      if (!all.includes(w)) E(`cue("${m[1]}"): essa palavra não está em nenhuma narração. Use uma palavra inteira que a voz fala naquela cena.`);
    }
    if (/\p{Extended_Pictographic}/u.test(src.replace(/…/g, ""))) E(`há emoji em index.tsx. O render desenha emoji errado: use texto, Verdict ou Mark.`);
    if (/\b(Stage|Toy|useCam)\b/.test(src)) A(`index.tsx usa Stage/Toy/useCam, do kit antigo. Episódio novo usa os cenários prontos (Counter, Street, Home…), Guy e useShots.`);
    if (!/EndCard/.test(src)) E(`a última cena precisa ser <EndCard />.`);
    const comps = (src.match(/^const [A-Z]\w*: React\.FC/gm) ?? []).length;
    const shots = (src.match(/useShots\(/g) ?? []).length;
    const cuts = (src.match(/\{\s*at:/g) ?? []).length;
    if (shots < comps) A(`${comps} cenas e só ${shots} com useShots. Toda cena 3D pega a câmera de useShots.`);
    if (cuts < scenes.length * 1.3) A(`${cuts} planos para ${scenes.length} cenas. As referências cortam a cada 1 a 1,5s: dê dois planos às cenas com mais de 2s.`);
    if ((src.match(/<Sfx /g) ?? []).length < scenes.length * 0.8) A(`poucos efeitos sonoros. Ponha um <Sfx> em cada corte e em cada virada (pop, tick, bong, ding, whoosh).`);
    if (!/<Verdict /.test(src)) A(`nenhum <Verdict>. O X no erro e o certo no acerto são marca do formato.`);
    if (!/img\/[\w-]+\.jpg/.test(src)) A(`nenhuma tela real do app (<Phone src="img/08-speak.jpg" />). O pitch precisa mostrar o app.`);
    if (slug !== "ep03-for-here-or-to-go") {
      for (const left of ["6 anos\n", "0 cafés", "quero ir embora", "To go, please", "Ler e ouvir"]) {
        if (src.includes(left)) A(`index.tsx ainda mostra um texto do modelo ("${left.trim()}"). Troque pelo texto deste episódio.`);
      }
    }
    const hex = [...src.matchAll(/["'`](#[0-9A-Fa-f]{6})["'`]/g)].length;
    if (hex > 6) A(`${hex} cores escritas à mão (#RRGGBB). Prefira as de C (C.gold, C.mint…): mantêm a marca.`);
  }
}

function checkSpec() {
  const manifest = JSON.parse(readFileSync(join(root, "src/engine/beats.manifest.json"), "utf8"));
  const cfg = JSON.parse(readFileSync(join(root, "builder.config.json"), "utf8"));
  const freedom = spec.freedom ?? "recipe";
  const fmtPath = join(root, "formats", `${spec.format}.json`);
  const fmt = existsSync(fmtPath) ? JSON.parse(readFileSync(fmtPath, "utf8")) : null;
  if (!fmt) A(`formato "${spec.format}" não existe em formats/.`);
  if (spec.beats.at(-1)?.type !== "end-card") E(`a última cena precisa ser do tipo "end-card".`);
  for (const b of spec.beats) {
    const at = `cena "${b.id}"`;
    const custom = b.type.startsWith("custom:");
    if (!custom && !manifest[b.type]) E(`${at}: tipo "${b.type}" não existe. Tipos: ${Object.keys(manifest).join(", ")}`);
    if (custom && freedom !== "free") E(`${at}: tipos custom exigem o nível "free" (este episódio é "${freedom}").`);
    if (custom && !existsSync(join(dir, "custom", `${b.type.slice(7)}.tsx`))) E(`${at}: falta src/episodes/${slug}/custom/${b.type.slice(7)}.tsx.`);
    if (b.type === "scene-data" && !b.scene) E(`${at}: tipo scene-data sem cena em dados. Rode: vid scene ${slug} scene ${b.id} --json '{…}'`);
    if (b.scene && freedom === "recipe") E(`${at}: cena escrita em dados ("scene") exige o nível "guided" ou "free".`);
    const m = manifest[b.type];
    if (m) {
      for (const k of m.needs ?? []) if (!String(b.params?.[k] ?? "").trim()) E(`${at}: falta o parâmetro "${k}" (tipo ${b.type}).`);
      for (const k of Object.keys(b.params ?? {})) if (!(m.needs ?? []).includes(k) && !(m.optional ?? []).includes(k)) A(`${at}: parâmetro "${k}" não existe no tipo ${b.type}. Existem: ${[...(m.needs ?? []), ...(m.optional ?? [])].join(", ") || "nenhum"}.`);
    }
    const p = b.params ?? {};
    for (const k of ["heavy", "light", "need", "pin", "city", "label"]) if (typeof p[k] === "string" && p[k].length > 16) A(`${at}: "${k}" tem ${p[k].length} caracteres. Rótulo preso a objeto: até 16, senão sai do quadro.`);
    for (const k of ["cueWord", "cueA", "cueB", "cueMid", "plateCue"]) {
      if (p[k] && !words(b.narration).some((w) => w.toLowerCase().normalize("NFD").replace(/[^a-z0-9']/g, "") === String(p[k]).toLowerCase().normalize("NFD").replace(/[^a-z0-9']/g, ""))) E(`${at}: ${k} "${p[k]}" não é uma palavra da narração. Palavras: ${words(b.narration).join(" | ")}`);
    }
    if (m && /^(hook-walk-out|arrive-need|walk-out-street|metaphor|crowd|freeze|app-enter)$/.test(b.type) && !/\*/.test(b.narration) && !p.cueWord) A(`${at}: sem *ênfase* e sem cueWord. A animação dispara na última palavra; marque a palavra forte com *asteriscos*.`);
  }
  if (freedom === "recipe" && fmt) {
    const want = fmt.beats.map((b) => b.type).join(",");
    const have = spec.beats.map((b) => b.type).join(",");
    if (want !== have) E(`no nível "recipe" a sequência de cenas é a do formato (${fmt.id}); esta foi alterada. Peça --freedom guided para reordenar.`);
  }
  // Variedade: compara com os episódios anteriores do histórico.
  const ledger = existsSync(join(root, "ledger.json")) ? JSON.parse(readFileSync(join(root, "ledger.json"), "utf8")) : [];
  const idx = ledger.findIndex((e) => e.slug === slug);
  const prev = (idx < 0 ? ledger : ledger.slice(0, idx)).slice(-cfg.variety.window);
  const fp = { format: spec.format, place: spec.world.place, metaphor: spec.world.metaphor, camStyle: spec.world.camStyle, shirt: spec.world.look?.me?.shirt };
  for (const e of prev) {
    const same = Object.keys(fp).filter((k) => fp[k] !== undefined && e[k] === fp[k]);
    if (same.length > cfg.variety.maxShared) E(`parecido demais com ${e.slug} (repete ${same.join(", ")}). Troque o lugar ou o formato: vid scene ${slug} world place=<outro>.`);
  }
}

for (const m of errors) console.log(`ERRO   ${m}`);
for (const m of warns) console.log(`AVISO  ${m}`);
console.log(`\n${slug}: ${errors.length} erro(s), ${warns.length} aviso(s)${errors.length ? "" : ". Pode seguir."}`);
process.exit(errors.length ? 1 : 0);
