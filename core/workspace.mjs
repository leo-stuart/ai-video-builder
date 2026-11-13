// Espaço de trabalho: onde moram marca, playbook, episódios, mídia e saídas de um usuário.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { VbError } from "./errors.mjs";

/** Raiz do motor (este repositório). */
export const ENGINE = join(dirname(fileURLToPath(import.meta.url)), "..");

export const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
export const writeJson = (p, d) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(d, null, 2) + "\n");
};

/**
 * Caminho absoluto do espaço de trabalho: o argumento, ou VB_WORKSPACE, ou
 * ./workspaces/default (no motor). Caminho relativo vale a partir da pasta atual
 * e, se não existir lá, a partir da raiz do motor.
 */
export const resolveWorkspace = (path) => {
  const raw = path ?? process.env.VB_WORKSPACE;
  let dir;
  if (raw) {
    const here = resolve(raw);
    dir = isAbsolute(raw) || existsSync(here) ? here : resolve(ENGINE, raw);
  } else dir = join(ENGINE, "workspaces", "default");
  if (!existsSync(join(dir, "workspace.json"))) {
    throw new VbError("no-workspace", `não há workspace.json em ${dir}. Aponte um espaço de trabalho (--workspace <pasta> ou VB_WORKSPACE) ou crie um: vid init <pasta> --name "Marca".`);
  }
  return dir;
};

export const paths = (ws) => ({
  config: join(ws, "workspace.json"),
  playbook: join(ws, "playbook"),
  episodes: join(ws, "episodes"),
  public: join(ws, "public"),
  voice: join(ws, "voice"),
  out: join(ws, "out"),
  ledger: join(ws, "ledger.json"),
  cache: join(ws, ".cache"),
  qa: join(ws, ".qa"),
  env: join(ws, ".env.local"),
});

/** workspace.json (síncrono, para uso interno). */
export const config = (ws) => {
  let c;
  try {
    c = readJson(paths(ws).config);
  } catch (e) {
    throw new VbError("bad-workspace", `workspace.json inválido em ${ws}: ${e.message}`);
  }
  return {
    brand: { name: "" },
    voices: {},
    freedom: "auto",
    models: {},
    variety: { window: 6, maxShared: 2 },
    rules: {},
    post: { slots: ["08:00", "12:30", "18:00", "21:00", "23:00"], hashtags: [] },
    ...c,
  };
};

/** Chaves de .env.local do espaço de trabalho; o que já está no ambiente do processo vence. Não altera process.env. */
export const readEnv = (ws) => {
  const env = {};
  const f = paths(ws).env;
  if (existsSync(f)) {
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*?)"?\s*$/);
      if (m) env[m[1]] = m[2];
    }
  }
  return { ...env, ...process.env };
};

export const getWorkspace = async (ws) => config(ws);

const PLACES = {
  cafe: { attendant: "Caixa" },
  restaurante: { attendant: "Garçom" },
  hotel: { attendant: "Recepção" },
  imigracao: { attendant: "Agente" },
  aeroporto: { attendant: "Atendente" },
  loja: { attendant: "Caixa" },
  farmacia: { attendant: "Farmácia" },
};

/** Cria a estrutura mínima de um espaço de trabalho novo. */
export const initWorkspace = async (path, { brand = {} } = {}) => {
  if (!path) throw new VbError("usage", "informe a pasta do novo espaço de trabalho.");
  if (!String(brand.name ?? "").trim()) throw new VbError("usage", 'informe o nome da marca (brand.name), ex.: vid init <pasta> --name "Marca".');
  const dir = resolve(path);
  if (existsSync(join(dir, "workspace.json"))) throw new VbError("exists", `já existe um espaço de trabalho em ${dir}.`);
  for (const d of ["playbook/examples", "playbook/pautas", "episodes", "public/img", "public/audio", "out"]) mkdirSync(join(dir, d), { recursive: true });
  const cfg = {
    brand: { name: brand.name, tagline: brand.tagline ?? "", cta: brand.cta ?? "", ...(brand.logo ? { logo: brand.logo } : {}), productShots: brand.productShots ?? [] },
    voices: {},
    freedom: "auto",
    models: { haiku: "recipe", sonnet: "guided", opus: "free", fable: "free" },
    variety: { window: 6, maxShared: 2 },
    rules: { requireBrandMention: true, requireBeats: [] },
    post: { slots: ["08:00", "12:30", "18:00", "21:00", "23:00"], hashtags: [] },
  };
  writeJson(join(dir, "workspace.json"), cfg);
  writeJson(join(dir, "playbook/places.json"), PLACES);
  writeJson(join(dir, "playbook/variants.json"), {});
  const envFile = join(dir, ".env.local");
  if (!existsSync(envFile)) writeFileSync(envFile, "ELEVENLABS_API_KEY=\n");
  return { ws: dir, workspace: cfg };
};
