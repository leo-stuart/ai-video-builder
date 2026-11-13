// Lote: para cada episódio, confere o roteiro, gera a voz, confere tudo, renderiza e monta o pacote.
// Retomável: o que já foi feito (estado em <ws>/.cache/batch.json) não se repete. `redo` refaz tudo.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { VbError } from "./errors.mjs";
import { createEpisode, isSpec } from "./episodes.mjs";
import { pack } from "./pack.mjs";
import { render } from "./remotion.mjs";
import { validate } from "./validate.mjs";
import { voice } from "./voice.mjs";
import { paths, readJson, writeJson } from "./workspace.mjs";

const fmt = (r) => r.errors.map((e) => `ERRO   ${e.message}`).join("\n");

/** `jobs`: [{ slug, title?, format?, place?, ficha?, freedom? }]. Devolve [{ slug, ok, error? }]. */
export const batch = async (ws, jobs, { provider, redo = false, onProgress } = {}) => {
  if (!jobs?.length) throw new VbError("usage", "informe ao menos um episódio.");
  const statePath = join(paths(ws).cache, "batch.json");
  const state = existsSync(statePath) ? readJson(statePath) : {};
  if (redo) for (const j of jobs) delete state[j.slug];
  const save = () => writeJson(statePath, state);
  const report = [];
  for (const [i, job] of jobs.entries()) {
    const { slug } = job;
    const st = (state[slug] ??= {});
    const step = (label) => onProgress?.({ step: "batch", done: i, total: jobs.length, label: `${slug}: ${label}` });
    try {
      if (!isSpec(ws, slug)) {
        if (!job.title) throw new VbError("usage", `o episódio ${slug} não existe e o lote não traz "title" para criá-lo.`);
        step("criando");
        await createEpisode(ws, { slug, title: job.title, format: job.format, ficha: job.ficha ?? {}, place: job.place, freedom: job.freedom ?? "recipe" });
      }
      if (!st.script) {
        step("roteiro");
        const r = await validate(ws, slug, { scriptOnly: true });
        if (!r.ok) throw new VbError("invalid", `roteiro com erro:\n${fmt(r)}`);
        st.script = true;
        save();
      }
      if (!st.voice) {
        step("voz");
        await voice(ws, slug, { provider });
        st.voice = true;
        save();
      }
      if (!st.check) {
        step("validação");
        const r = await validate(ws, slug);
        if (!r.ok) throw new VbError("invalid", `validação com erro:\n${fmt(r)}`);
        st.check = true;
        save();
      }
      if (!st.render) {
        step("render");
        await render(ws, slug);
        st.render = true;
        save();
      }
      if (!st.pack) {
        step("pacote");
        await pack(ws, slug);
        st.pack = true;
        save();
      }
      report.push({ slug, ok: true });
    } catch (e) {
      st.error = e.message.split("\n")[0];
      save();
      report.push({ slug, ok: false, error: e.message });
    }
  }
  return report;
};

