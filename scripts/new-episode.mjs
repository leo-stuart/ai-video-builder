#!/usr/bin/env node
// Cria um episódio novo a partir do episódio-modelo (ep03): 19 cenas que já
// renderizam. Você troca as falas e ajusta as cenas, em vez de partir do zero.
//
//   node scripts/new-episode.mjs <slug> "Título" [--place hotel]
//
// --place: cafe, restaurante, hotel, imigracao, aeroporto, loja, farmacia
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const [slug, title = "Título"] = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const place = opt("place", "cafe");
const SIGNS = { cafe: "COFFEE SHOP", restaurante: "RESTAURANT", hotel: "HOTEL", imigracao: "AIRPORT", aeroporto: "AIRPORT", loja: "STORE", farmacia: "PHARMACY" };

if (!slug || !/^ep\d\d-[a-z0-9-]+$/.test(slug)) {
  console.error('uso: node scripts/new-episode.mjs epNN-tema-curto "Título" [--place hotel]');
  process.exit(1);
}
if (!SIGNS[place]) {
  console.error(`--place "${place}" não existe. Opções: ${Object.keys(SIGNS).join(", ")}`);
  process.exit(1);
}
const dir = join(root, "src/episodes", slug);
if (existsSync(dir)) {
  console.error(`já existe: ${dir}`);
  process.exit(1);
}
const model = join(root, "src/episodes/ep03-for-here-or-to-go");
mkdirSync(dir, { recursive: true });

const script = JSON.parse(readFileSync(join(model, "script.json"), "utf8"));
script.slug = slug;
script.title = title;
script.number = Number(slug.slice(2, 4));
script.post = { caption: "TODO: legenda do post", hashtags: ["ingles", "aprenderingles", "dicasdeingles", "inglesparaviagem", "falaringles", "pragma"] };
writeFileSync(join(dir, "script.json"), JSON.stringify(script, null, 2) + "\n");
writeFileSync(join(dir, "timing.json"), JSON.stringify({ provider: "none", scenes: {} }, null, 2) + "\n");

let src = readFileSync(join(model, "index.tsx"), "utf8");
src = src
  .replace(/^\/\/ EPISÓDIO-MODELO[\s\S]*?(?=import React)/, `// ${slug}: criado a partir do episódio-modelo (ep03). Troque falas, rótulos e metáforas.\n`)
  .replaceAll('place="cafe"', `place="${place}"`)
  .replaceAll("<Street cam={cam}", `<Street cam={cam} sign="${SIGNS[place]}"`);
writeFileSync(join(dir, "index.tsx"), src);

console.log(`criado: ${dir}  (lugar: ${place})

próximos passos:
  1. reescreva as falas em src/episodes/${slug}/script.json
  2. node scripts/check.mjs ${slug} --script
  3. node scripts/tts.mjs ${slug}
  4. ajuste as cenas em src/episodes/${slug}/index.tsx
  5. node scripts/check.mjs ${slug} && node scripts/sheet.mjs ${slug}`);
