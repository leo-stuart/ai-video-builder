// Playbook do espaço de trabalho: formatos, pautas, lugares e variantes de fala.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { VbError } from "./errors.mjs";
import { ENGINE, config, paths, readJson } from "./workspace.mjs";
import { readLedger } from "./episodes.mjs";

export const manifest = () => readJson(join(ENGINE, "src/engine/beats.manifest.json"));

const optional = (p, d) => (existsSync(p) ? readJson(p) : d);
export const places = (ws) => optional(join(paths(ws).playbook, "places.json"), {});
export const variants = (ws) => optional(join(paths(ws).playbook, "variants.json"), {});

export const formats = (ws) => {
  const dir = paths(ws).playbook;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !["places.json", "variants.json"].includes(f))
    .sort()
    .map((f) => readJson(join(dir, f)));
};

export const loadFormat = (ws, id) => {
  const f = formats(ws).find((x) => x.id === id);
  if (!f) throw new VbError("no-format", `formato "${id}" não existe. Formatos: ${formats(ws).map((x) => x.id).join(", ") || "(nenhum)"}`);
  return f;
};

export const pautas = (ws) => {
  const dir = join(paths(ws).playbook, "pautas");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .flatMap((f) => readJson(join(dir, f)).map((p) => ({ ...p, format: f.replace(".json", "") })));
};

export const listFormats = async (ws) =>
  formats(ws).map((f) => ({ id: f.id, title: f.title, desc: f.desc, target: f.target, sequence: f.beats.map((b) => b.id), slots: f.slots }));

export const listBeats = async () => Object.entries(manifest()).map(([id, v]) => ({ id, desc: v.desc, needs: v.needs ?? [], optional: v.optional ?? [] }));

/** Pautas ainda não usadas. A primeira (`recommended`) é a do formato menos usado nos últimos episódios. */
export const listPautas = async (ws, { format } = {}) => {
  const ledger = readLedger(ws);
  const used = new Set(ledger.map((e) => e.pauta).filter(Boolean));
  const recent = ledger.slice(-config(ws).variety.window);
  const uses = (f) => recent.filter((e) => e.format === f).length;
  const free = pautas(ws).filter((p) => !used.has(p.id) && (!format || p.format === format));
  free.sort((a, b) => uses(a.format) - uses(b.format));
  return free.map((p, i) => ({ ...p, recommended: i === 0 }));
};
