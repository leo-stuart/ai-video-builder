// vid scene <slug> <op> …  Edita o episode.json sem abrir o arquivo.
//
//   set     <id> campo=valor …            narration, sub, speaker, hold, banner, params.<k>
//   world   campo=valor …                 place, metaphor, camStyle, studioTone
//   replace <id> --type T [--narration "…"] [--set params.k=v …]
//   insert  <depois-de-id> --id X --type T --narration "…" [--set params.k=v …]
//   move    <id> --after <outro-id>
//   remove  <id>
//   scene   <id> --json '{"parts":[…],"overlays":[…]}'    cena escrita em dados
//
// O nível de liberdade do episódio manda no que é permitido.
import { readFileSync } from "node:fs";
import { OPT, manifest, readSpec, writeSpec, readLedger, writeLedger } from "./spec.mjs";

const RECIPE_OK = new Set(["set"]);

const parseVal = (v) => {
  if (v === "true") return true;
  if (v === "false") return false;
  if (v !== "" && !isNaN(Number(v))) return Number(v);
  return v;
};
const setPath = (o, path, v) => {
  const ks = path.split(".");
  let c = o;
  ks.slice(0, -1).forEach((k) => (c = c[k] ??= {}));
  c[ks.at(-1)] = v;
};

export default async ({ args, positional, flag, die }) => {
  const [slug, op, id] = positional;
  if (!slug || !op) die('uso: vid scene <slug> set|world|replace|insert|move|remove|scene <id> …');
  const spec = readSpec(slug);
  const freedom = spec.freedom ?? "recipe";
  const need = { set: "recipe", world: "guided", replace: "guided", insert: "guided", move: "guided", remove: "guided", scene: "guided" }[op];
  if (!need) die(`operação "${op}" não existe.`);
  if (freedom === "recipe" && !RECIPE_OK.has(op)) die(`este episódio está no nível "recipe": só o comando "set" é permitido. Para o resto, crie o episódio com --freedom guided.`);
  const types = manifest();
  const beatOf = (i) => spec.beats.find((b) => b.id === i) ?? die(`não existe a cena "${i}". Cenas: ${spec.beats.map((b) => b.id).join(", ")}`);
  const kv = args.filter((a, i) => args[i - 1] === "--set").concat(args.filter((a, i) => /^[\w.]+=/.test(a) && args[i - 1] !== "--set" && positional.indexOf(a) < 0 && !a.startsWith("--")));
  const assign = (b) => {
    for (const pair of kv) {
      const [k, ...r] = pair.split("=");
      const val = parseVal(r.join("="));
      if (k.startsWith("params.")) setPath(b, k, val);
      else if (["narration", "sub", "speaker", "hold", "banner", "captions"].includes(k)) b[k] = val;
      else die(`campo "${k}" não pode ser editado. Use narration, sub, speaker, hold, banner, captions ou params.<nome>.`);
    }
  };
  const posKv = positional.slice(3).filter((a) => a.includes("="));
  kv.push(...posKv);

  if (op === "set") {
    const b = beatOf(id);
    assign(b);
  } else if (op === "world") {
    for (const pair of [...positional.slice(2), ...kv].filter((a) => a.includes("="))) {
      const [k, v] = pair.split("=");
      const allowed = { place: OPT.place, metaphor: OPT.metaphor, camStyle: OPT.camStyle, studioTone: ["indigo", "noite", "menta", "coral"] };
      if (!allowed[k]) die(`world aceita: ${Object.keys(allowed).join(", ")}`);
      if (!allowed[k].includes(v)) die(`${k} aceita: ${allowed[k].join(", ")}`);
      spec.world[k] = v;
    }
  } else if (op === "replace") {
    const b = beatOf(id);
    const t = flag("type");
    if (t) {
      if (!types[t] && !t.startsWith("custom:")) die(`tipo "${t}" não existe. Tipos: ${Object.keys(types).join(", ")}`);
      if (t.startsWith("custom:") && freedom !== "free") die(`tipos custom exigem o nível "free".`);
      b.type = t;
      b.params = {};
      delete b.scene;
    }
    if (flag("narration")) b.narration = flag("narration");
    assign(b);
  } else if (op === "insert") {
    const i = spec.beats.findIndex((b) => b.id === id);
    if (i < 0) die(`não existe a cena "${id}".`);
    const nid = flag("id");
    const t = flag("type");
    if (!nid || !/^[a-z][a-z0-9]*$/.test(nid)) die("--id precisa ser uma palavra minúscula sem acento.");
    if (spec.beats.some((b) => b.id === nid)) die(`já existe uma cena "${nid}".`);
    if (!t || (!types[t] && !t.startsWith("custom:"))) die(`--type inválido. Tipos: ${Object.keys(types).join(", ")}`);
    if (!flag("narration")) die("--narration é obrigatório.");
    const b = { id: nid, type: t, narration: flag("narration"), params: {} };
    for (const k of ["speaker", "sub", "banner", "hold"]) if (flag(k)) b[k] = k === "hold" ? Number(flag(k)) : flag(k);
    assign(b);
    spec.beats.splice(i + 1, 0, b);
  } else if (op === "move") {
    const b = beatOf(id);
    const after = flag("after");
    if (!after) die("--after <id> é obrigatório.");
    spec.beats.splice(spec.beats.indexOf(b), 1);
    const j = spec.beats.findIndex((x) => x.id === after);
    if (j < 0) die(`não existe a cena "${after}".`);
    spec.beats.splice(j + 1, 0, b);
  } else if (op === "remove") {
    const b = beatOf(id);
    if (b.type === "end-card") die("a tela final não pode ser removida.");
    spec.beats.splice(spec.beats.indexOf(b), 1);
  } else if (op === "scene") {
    const b = beatOf(id);
    const j = flag("json") ?? die("--json '<cena em dados>' é obrigatório.");
    try {
      b.scene = JSON.parse(j.startsWith("@") ? readFileSync(j.slice(1), "utf8") : j);
    } catch (e) {
      die(`JSON inválido: ${e.message}`);
    }
  }

  writeSpec(spec);
  // Se o formato ou o mundo mudou, o histórico de variedade acompanha.
  const l = readLedger();
  const e = l.find((x) => x.slug === slug);
  if (e && op === "world") {
    Object.assign(e, spec.world.place ? { place: spec.world.place, metaphor: spec.world.metaphor, camStyle: spec.world.camStyle } : {});
    writeLedger(l);
  }
  console.log(`ok: ${slug} (${op}${id ? " " + id : ""}). Se mudou a narração, rode: vid voice ${slug}`);
};
