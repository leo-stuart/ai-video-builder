// vid batch <slug> [<slug> …] | vid batch lote.json
// Para cada episódio: confere o roteiro, gera a voz, confere tudo, renderiza e monta o pacote.
// Retomável: o que já foi feito (estado em .cache/batch.json) não se repete.
// --redo refaz tudo de um episódio já concluído.
//
// lote.json: [{ "slug": "ep06-…", "title": "…", "format": "…", "place": "…", "ficha": {…} }, …]
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createEpisode, epDir, isSpec, readLedger, root, writeLedger, writeSpec } from "./spec.mjs";
import { renderEpisode } from "./cmd-render.mjs";
import { packEpisode } from "./cmd-pack.mjs";

const statePath = join(root, ".cache/batch.json");
const load = () => (existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {});
const save = (s) => {
  mkdirSync(join(root, ".cache"), { recursive: true });
  writeFileSync(statePath, JSON.stringify(s, null, 2));
};
const node = (script, a) => spawnSync("node", [join(root, "scripts", script), ...a], { cwd: root, encoding: "utf8" });

export default async ({ positional, flag, die }) => {
  if (!positional.length) die("uso: vid batch <slug> [<slug> …]  ou  vid batch lote.json");
  let jobs;
  if (positional[0].endsWith(".json")) jobs = JSON.parse(readFileSync(positional[0], "utf8"));
  else jobs = positional.map((slug) => ({ slug }));

  const state = load();
  if (flag("redo")) for (const j of jobs) delete state[j.slug];
  const report = [];
  for (const job of jobs) {
    const { slug } = job;
    const st = (state[slug] ??= {});
    try {
      if (!isSpec(slug)) {
        if (!job.title) throw new Error(`o episódio ${slug} não existe e o lote não traz "title" para criá-lo.`);
        const out = createEpisode({ slug, title: job.title, formatId: job.format, ficha: job.ficha ?? {}, place: job.place, freedom: job.freedom ?? "recipe" });
        writeSpec(out.spec);
        writeLedger([...readLedger().filter((e) => e.slug !== slug), out.fingerprint]);
        console.log(`+ ${slug}: criado (${out.spec.format}, ${out.spec.world.place})`);
      }
      if (!st.script) {
        const r = node("check.mjs", [slug, "--script"]);
        if (r.status) throw new Error(`roteiro com erro:\n${r.stdout}`);
        st.script = true;
        save(state);
      }
      if (!st.voice) {
        const args = [slug];
        if (flag("provider")) args.push("--provider", flag("provider"));
        const r = node("tts.mjs", args);
        if (r.status) throw new Error(`voz falhou:\n${r.stdout}${r.stderr}`);
        st.voice = true;
        save(state);
      }
      if (!st.check) {
        const r = node("check.mjs", [slug]);
        if (r.status) throw new Error(`validação com erro:\n${r.stdout}`);
        st.check = true;
        save(state);
      }
      if (!st.render) {
        await renderEpisode(slug, { quiet: true });
        st.render = true;
        save(state);
      }
      if (!st.pack) {
        packEpisode(slug);
        st.pack = true;
        save(state);
      }
      report.push({ slug, ok: true });
      console.log(`✓ ${slug}: pronto em out/${slug}/`);
    } catch (e) {
      st.error = e.message.split("\n")[0];
      save(state);
      report.push({ slug, ok: false, error: e.message });
      console.error(`✗ ${slug}: ${e.message}`);
    }
  }
  const bad = report.filter((r) => !r.ok).length;
  console.log(`\n${report.length - bad} de ${report.length} prontos${bad ? `; ${bad} com erro (rode de novo para retomar do ponto em que parou)` : ""}.`);
  if (bad) process.exit(1);
};
