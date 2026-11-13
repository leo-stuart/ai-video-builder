// vid docs  Gera skills/pragma-video/beats.md e formats.md a partir do código e dos formatos.
// Não edite esses dois arquivos à mão: rode este comando.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { OPT, formats, manifest, places, root, variants } from "./spec.mjs";

export default async () => {
  const out = join(root, "skills/pragma-video");
  const m = manifest();
  let b = "# Cenas (beats)\n\nGerado por `vid docs`. Cada cena de um episódio tem um `type` desta lista e `params` com os campos abaixo. **Obrigatório** = o validador acusa erro se faltar.\n\n";
  for (const [id, v] of Object.entries(m)) {
    b += `## \`${id}\`\n${v.desc}\n\n`;
    b += `* obrigatório: ${v.needs.length ? v.needs.map((x) => `\`${x}\``).join(", ") : "nenhum"}\n`;
    b += `* opcional: ${v.optional.length ? v.optional.map((x) => `\`${x}\``).join(", ") : "nenhum"}\n\n`;
  }
  b += "## Parâmetros que se repetem\n\n* `cueWord`: palavra da narração que dispara a animação (inteira, sem pontuação). Sem ela, a animação usa a palavra com `*ênfase*`.\n* Rótulos (`heavy`, `light`, `need`, `pin`, `city`, `label`): até 16 caracteres.\n";
  writeFileSync(join(out, "beats.md"), b);

  let f = "# Formatos\n\nGerado por `vid docs`. Cada formato é uma sequência de cenas; você só preenche a ficha. Fichas de exemplo completas em `formats/examples/<formato>.json`.\n\n";
  for (const x of formats()) {
    f += `## \`${x.id}\`: ${x.title}\n${x.desc}\n\n`;
    f += `Sequência: ${x.beats.map((e) => e.id).join(" → ")}\n\n`;
    f += "| Campo | O que escrever | Exemplo |\n|---|---|---|\n";
    for (const s of x.slots) f += `| \`${s.key}\`${s.default !== undefined ? " (opcional)" : ""} | ${s.ask} | ${String(s.example).replace(/\|/g, "\\|")} |\n`;
    f += "\n";
  }
  const V = variants();
  f += "## Mundo sorteado\n\n`vid new` sorteia, fugindo do que os últimos episódios usaram: lugar (" + OPT.place.join(", ") + "), metáfora (" + OPT.metaphor.join(", ") + "), estilo de câmera (" + OPT.camStyle.join(", ") + "), tom do estúdio, roupa e cabelo de \"você\" e do atendente, e uma variante de cada fala fixa (" + Object.entries(V).map(([k, v]) => `${k}: ${v.length}`).join(", ") + ").\n";
  writeFileSync(join(out, "formats.md"), f);
  console.log("gerado: skills/pragma-video/beats.md e formats.md");
};
