import type { At, Beat, SceneData, World } from "../types";

/* ───────── palavras da narração: de onde saem os cues ───────── */

type Tok = { w: string; em: boolean; raw: string };

const clean = (w: string) => w.replace(/[.,!?…:;"“”]+$/, "").replace(/^[("“]+/, "");
export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9']/g, "");

/** Mesma divisão do tts.mjs: palavras, com a marca de ênfase `*assim*`. */
export const tokens = (narration: string): Tok[] => {
  const out: Tok[] = [];
  let em = false;
  for (const raw of narration.replace(/\[\/?en\]/g, " ").split(/\s+/).filter(Boolean)) {
    if (raw.startsWith("*")) em = true;
    const closes = /\*[.,!?:;…]*$/.test(raw);
    const w = raw.replace(/\*/g, "");
    if (w) out.push({ w: clean(w), em, raw: w });
    if (closes) em = false;
  }
  return out;
};

/** O cue (palavra + ocorrência) da palavra de índice `i` da narração. */
export const cueAt = (narration: string, i: number, offset = 0): At => {
  const t = tokens(narration);
  const k = Math.min(Math.max(i, 0), t.length - 1);
  const nth = t.slice(0, k).filter((x) => norm(x.w) === norm(t[k].w)).length;
  return { cue: t[k].w, nth, offset };
};

const emphIndex = (n: string) => {
  const i = tokens(n).findIndex((t) => t.em);
  return i < 0 ? tokens(n).length - 1 : i;
};
const afterIndex = (n: string, re: RegExp) => {
  const t = tokens(n);
  const i = t.findIndex((x) => re.test(x.raw));
  return i >= 0 && i + 1 < t.length ? i + 1 : emphIndex(n);
};

/** Primeira palavra com ênfase (`*palavra*`). Sem ênfase, a última. */
export const emph = (n: string, offset = 0): At => cueAt(n, emphIndex(n), offset);
/** Primeira palavra depois da primeira vírgula. */
export const afterComma = (n: string, offset = 0): At => cueAt(n, afterIndex(n, /,$/), offset);
/** Primeira palavra depois do primeiro ponto final. */
export const afterPeriod = (n: string, offset = 0): At => cueAt(n, afterIndex(n, /[.!?]$/), offset);
/** Primeira palavra depois de um token que termina em dois-pontos (`O certo é: palavra`). */
export const afterColon = (n: string, offset = 0): At => cueAt(n, afterIndex(n, /:$/), offset);
/** Palavra por texto, se o autor a escolheu em `params`; senão o `fallback`. */
export const pick = (n: string, word: string | undefined, fallback: At, offset = 0): At => {
  if (!word) return fallback;
  const t = tokens(n);
  const i = t.findIndex((x) => norm(x.w) === norm(word));
  if (i < 0) throw new Error(`a palavra "${word}" não está na narração: ${t.map((x) => x.w).join(" ")}`);
  return cueAt(n, i, offset);
};
export const wordAt = (n: string, i: number): At => cueAt(n, i);

/* ───────── atalhos de expressão ───────── */

export const after = (at: At, then: any, otherwise: any) => ({ $after: { at, then, else: otherwise } });
export const between = (at: At, until: At, then: any, otherwise: any) => ({ $between: { at, until, then, else: otherwise } });
export const spring = (at: At, from = 0, to = 1) => ({ $tween: { from, to, at, ease: "spring" } });
export const smooth = (at: At, from = 0, to = 1) => ({ $tween: { from, to, at, ease: "smooth" } });
export const ramp = (at: At, until: At, from = 0, to = 1) => ({ $tween: { from, to, at, until, ease: "linear" } });
export const bounce = (at: At, h: number) => ({ $bounce: { at, h } });
export const plus = (...v: any[]) => ({ $add: v });
export const off = (a: At, o: number): At =>
  typeof a === "number" ? a + o : "cue" in a ? { ...a, offset: (a.offset ?? 0) + o } : "end" in a ? { end: a.end + o } : a;

export const P = (b: Beat): Record<string, any> => b.params ?? {};

export const SIGN: Record<string, string> = { cafe: "COFFEE SHOP", restaurante: "RESTAURANT", hotel: "HOTEL", imigracao: "AIRPORT", aeroporto: "AIRPORT", loja: "STORE", farmacia: "PHARMACY" };

export type Macro = (b: Beat, w: World) => SceneData;
