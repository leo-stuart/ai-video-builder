// Documentação gerada a partir do código e do playbook (beats.md e formats.md da skill).
import { OPT, } from "./episodes.mjs";
import { formats, manifest, variants } from "./playbook.mjs";

/** Devolve o texto de beats.md e formats.md. Quem chama decide onde gravar. */
export const generateDocs = async (ws) => {
  const m = manifest();
  let b = "# Cenas (beats)\n\nGerado por `vid docs`. Cada cena de um episódio tem um `type` desta lista e `params` com os campos abaixo. **Obrigatório** = o validador acusa erro se faltar.\n\n";
  for (const [id, v] of Object.entries(m)) {
    b += `## \`${id}\`\n${v.desc}\n\n`;
    b += `* obrigatório: ${v.needs.length ? v.needs.map((x) => `\`${x}\``).join(", ") : "nenhum"}\n`;
    b += `* opcional: ${v.optional.length ? v.optional.map((x) => `\`${x}\``).join(", ") : "nenhum"}\n\n`;
  }
  b += "## Parâmetros que se repetem\n\n* `cueWord`: palavra da narração que dispara a animação (inteira, sem pontuação). Sem ela, a animação usa a palavra com `*ênfase*`.\n* Rótulos (`heavy`, `light`, `need`, `pin`, `city`, `label`): até 16 caracteres.\n";

  let f = "# Formatos\n\nGerado por `vid docs`. Cada formato é uma sequência de cenas; você só preenche a ficha. Fichas de exemplo completas em `playbook/examples/<formato>.json`.\n\n";
  for (const x of formats(ws)) {
    f += `## \`${x.id}\`: ${x.title}\n${x.desc}\n\n`;
    f += `Sequência: ${x.beats.map((e) => e.id).join(" → ")}\n\n`;
    f += "| Campo | O que escrever | Exemplo |\n|---|---|---|\n";
    for (const s of x.slots) f += `| \`${s.key}\`${s.default !== undefined ? " (opcional)" : ""} | ${s.ask} | ${String(s.example).replace(/\|/g, "\\|")} |\n`;
    f += "\n";
  }
  const V = variants(ws);
  f += "## Mundo sorteado\n\n`vid new` sorteia, fugindo do que os últimos episódios usaram: lugar (" + OPT.place.join(", ") + "), metáfora (" + OPT.metaphor.join(", ") + "), estilo de câmera (" + OPT.camStyle.join(", ") + "), tom do estúdio, roupa e cabelo de \"você\" e do atendente, e uma variante de cada fala fixa (" + Object.entries(V).map(([k, v]) => `${k}: ${v.length}`).join(", ") + ").\n";
  return { beats: b, formats: f };
};
