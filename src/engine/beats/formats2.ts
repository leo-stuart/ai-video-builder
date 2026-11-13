import { Macro, P, SIGN, after, afterColon, bounce, cueAt, emph, off, pick, plus, ramp, spring } from "./common";

/** Cenas dos formatos "diz-vs-ouve", "mito-vs-fato" e "mini-aula-quiz". */

/** Cartão de abertura: "você" fala com a câmera e um cartão grande entra na palavra forte. */
export const titleCard: Macro = (b, w) => {
  const p = P(b);
  const hit = pick(b.narration, p.cueWord, emph(b.narration));
  return {
    parts: [{ set: "studio", props: { tone: p.tone ?? w.studioTone }, shots: [{ at: 0, shot: "studio.low" }], objects: [{ kind: "guy", look: "me", pos: [0, 0, 0], mood: "wide", talking: true, armR: after(hit, 150, 0) }] }],
    overlays: [
      { type: "sfx", name: "pop", at: 0.05 },
      { type: "plate", text: p.card, tone: "gold", at: off(hit, 0.05), left: 90, top: 300, width: 900, size: 96, color: "C.ink", bg: "C.gold", pad: "24px 30px", radius: 44 },
    ],
  };
};

/** Cartão de afirmação (mito ou fato): carimbo, texto grande e "você" reagindo. */
export const statement: Macro = (b, w) => {
  const p = P(b);
  const good = p.good === true || p.good === "true";
  return {
    parts: [
      {
        set: "studio",
        props: { tone: p.tone ?? (good ? "menta" : "coral") },
        shots: [{ at: 0, shot: "studio.low" }],
        objects: [{ kind: "guy", look: "me", pos: [0, 0, 0], mood: p.mood ?? (good ? "happy" : "wide"), talking: true, sweat: !good, armR: good ? after(0.6, 150, 0) : 0 }],
      },
    ],
    overlays: [
      { type: "sfx", name: good ? "ding" : "bong", at: 0.15 },
      { type: "stamp", text: p.stamp ?? (good ? "Fato" : "Mito"), tone: good ? "mint" : "red", at: 0.1, left: 330, top: 240, size: 104 },
      { type: "plate", text: p.card, tone: good ? "mint" : "red", at: 0.4, left: 90, top: 440, width: 900, size: p.size ?? 72, pad: "26px 30px", radius: 40 },
    ],
  };
};

/** "Você" diz a frase errada para quem atende. */
export const sayMe: Macro = (b) => ({
  parts: [{ set: "counter", props: { me: { mood: P(b).mood ?? "ok", talking: true }, other: { mood: "ok" } }, shots: [{ at: 0, shot: "counter.onMe" }] }],
  overlays: [
    { type: "sfx", name: "tick", at: 0.02 },
    { type: "pin", text: P(b).label ?? "Você diz", dot: "C.gold", at: 0.25, anchor: "COUNTER.overMe" },
  ],
});

/** O que quem atende ouviu: susto, X e o sentido da frase em um cartão. */
export const heard: Macro = (b) => {
  const hit = pick(b.narration, P(b).cueWord, emph(b.narration));
  return {
    parts: [
      {
        set: "counter",
        props: { me: { mood: "ok" }, other: { mood: after(hit, "wide", "ok") } },
        shots: [
          { at: 0, shot: "counter.wide" },
          { at: hit, shot: "counter.onOther" },
        ],
      },
    ],
    overlays: [
      { type: "sfx", name: "bong", at: hit },
      { type: "verdict", ok: false, at: hit },
      { type: "plate", text: `"${P(b).meaning}"`, tone: "red", at: off(hit, 0.1), left: 120, top: 440, width: 840, size: 70, pad: "22px 26px", radius: 40 },
      { type: "pin", text: P(b).label ?? "Ele ouviu", dot: "C.red", at: off(hit, 0.1), top: 300, left: 230 },
    ],
  };
};

/** Errado e certo lado a lado, com X e certo. A palavra do certo dispara a segunda linha. */
export const compare: Macro = (b, w) => {
  const p = P(b);
  const hit = pick(b.narration, p.cueWord, afterColon(b.narration));
  return {
    parts: [
      {
        set: "studio",
        props: { tone: w.studioTone },
        shots: [{ at: 0, shot: "studio.low" }],
        objects: [{ kind: "guy", look: "me", pos: [0, 0, 0], mood: after(hit, "happy", "sad"), talking: true }],
      },
    ],
    overlays: [
      { type: "sfx", name: "tick", at: 0.1 },
      { type: "plate", text: p.wrong, tone: "red", at: 0.1, left: 150, top: 280, width: 800, size: 72, pad: "20px 26px", radius: 36 },
      { type: "mark", ok: false, at: 0.25, left: 20, top: 285, size: 110 },
      { type: "sfx", name: "ding", at: hit },
      { type: "plate", text: p.right, tone: "mint", at: hit, left: 150, top: 500, width: 800, size: 72, pad: "20px 26px", radius: 36 },
      { type: "mark", ok: true, at: off(hit, 0.1), left: 20, top: 505, size: 110 },
    ],
  };
};

const OPTS = ["A", "B", "C"];
const optPlates = (p: any, at: number, highlight?: string) =>
  OPTS.map((L, i) => {
    const mine = highlight === undefined ? undefined : highlight === L;
    return {
      type: "plate" as const,
      text: `${L}  ${p[`opt${L}`]}`,
      tone: mine === true ? "mint" : "white",
      color: mine === false ? "C.muted" : undefined,
      at: at + i * 0.5,
      left: 90,
      top: 440 + i * 175,
      width: 900,
      size: 64,
      pad: "20px 30px",
      radius: 38,
      from: "right",
    };
  });

/** A pergunta do quiz: as três opções entram uma a uma e uma contagem regressiva corre. */
export const quizQuestion: Macro = (b, w) => {
  const p = P(b);
  const end: any = { end: -0.2 };
  return {
    parts: [{ set: "studio", props: { tone: w.studioTone }, shots: [{ at: 0, shot: "studio.low" }], objects: [{ kind: "guy", look: "me", pos: [0, 0, 0], mood: "ok", sweat: after({ frac: 0.5 }, true, false) }] }],
    overlays: [
      ...optPlates(p, 0.4),
      { type: "sfx", name: "tick", at: 0.4 },
      { type: "sfx", name: "tick", at: 0.9 },
      { type: "sfx", name: "tick", at: 1.4 },
      { type: "pin", text: { $fmt: [{ $int: plus(3.99, ramp(0.2, end, 0, -2.98)) }] }, dot: "C.gold", size: 60, at: 0.2, top: 250 },
    ],
  };
};

/** A resposta do quiz: a opção certa fica verde, as outras apagam. */
export const quizAnswer: Macro = (b, w) => {
  const p = P(b);
  const hit = pick(b.narration, p.cueWord, emph(b.narration));
  return {
    parts: [{ set: "studio", props: { tone: w.studioTone }, shots: [{ at: 0, shot: "studio.low" }], objects: [{ kind: "guy", look: "me", pos: [0, 0, 0], mood: after(hit, "happy", "ok"), armR: after(hit, 150, 0), hop: bounce(hit, 0.15) }] }],
    overlays: [
      ...optPlates(p, 0.0, p.correct).map((o, i) => ({ ...o, at: 0.0 + i * 0.05, from: undefined })),
      { type: "sfx", name: "ding", at: hit },
      { type: "verdict", ok: true, at: hit },
    ],
  };
};

export { SIGN, cueAt, spring };
