#!/usr/bin/env node
// Lista as vozes do ElevenLabs que a sua conta pode usar e quantos créditos restam.
//   node scripts/voices.mjs            → todas
//   node scripts/voices.mjs female     → filtra por texto (gênero, sotaque, nome)
// Copie o id escolhido para "eleven" no cast do roteiro.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(root, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*?)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error("falta ELEVENLABS_API_KEY em .env.local");
  process.exit(1);
}
const get = async (path) => {
  const res = await fetch(`https://api.elevenlabs.io${path}`, { headers: { "xi-api-key": key } });
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${await res.text()}`);
  return res.json();
};
const filter = (process.argv[2] ?? "").toLowerCase();
const { voices } = await get("/v1/voices");
for (const v of voices) {
  const l = v.labels ?? {};
  const line = `${v.voice_id}  ${v.name.padEnd(28)} ${[l.gender, l.age, l.accent, l.language, l.use_case ?? l.description, v.category].filter(Boolean).join(" · ")}`;
  if (!filter || line.toLowerCase().includes(filter)) console.log(line);
}
try {
  const sub = await get("/v1/user/subscription");
  console.log(`\nplano: ${sub.tier} · créditos usados: ${sub.character_count} de ${sub.character_limit}`);
} catch (e) {
  console.log(`\n(não deu para ler o saldo: ${e.message.slice(0, 80)})`);
}
