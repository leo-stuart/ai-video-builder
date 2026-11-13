import { SceneData } from "../types";
import { Macro, P, SIGN, afterComma, afterPeriod, after, between, bounce, cueAt, emph, off, pick, plus, ramp, smooth, spring } from "./common";

/** As cenas do formato "travou e treina". Cada uma é um macro: parâmetros entram, dados de cena saem. */

const NEED_POSES: Record<string, any> = {
  hungry: { mood: "sad", armL: 55, armR: 55, lean: 8 },
  tired: { mood: "sad", lean: 14, headTilt: -12 },
  late: { mood: "wide", walk: 1, shiver: 0.6 },
  cold: { mood: "sad", shiver: 1, lean: 6 },
};

/** Gancho: "você" sai do curso com o diploma; corte para ele na palavra forte. */
export const hookWalkOut: Macro = (b) => {
  const cut = pick(b.narration, P(b).cueWord, emph(b.narration));
  const p = P(b);
  return {
    parts: [
      {
        set: "school",
        props: { sign: p.sign ?? "ENGLISH COURSE" },
        shots: [
          { at: 0, shot: "school.establish" },
          { at: cut, shot: "school.onMe" },
        ],
        objects: [
          { kind: "guy", look: "me", pos: [0, 0, ramp(0, cut, -1, 0.7)], mood: "happy", walk: after(cut, 0, 1), armR: after(cut, 150, 0), hop: bounce(cut, 0.12) },
          { kind: "block", size: [0.3, 0.22, 0.02], pos: [0.33, after(cut, plus(2.2, bounce(cut, 0.12)), -5), 0.8], color: "C.white", r: 0.01 },
        ],
      },
    ],
    overlays: [
      { type: "sfx", name: "whoosh", at: cut, volume: 0.3 },
      { type: "plate", text: p.plate, tone: "gold", at: off(cut, 0.05), left: 90, top: 250, size: 110, color: "C.ink", bg: "C.gold", pad: "10px 40px", radius: 30 },
      { type: "pin", text: p.pin ?? "Diploma", dot: "C.mint", at: off(cut, 0.1), anchor: [0.45, 2.55, 0.7] },
    ],
  };
};

/** Chegada ao lugar com uma necessidade (fome, atraso, frio, cansaço). */
export const arriveNeed: Macro = (b, w) => {
  const p = P(b);
  const cut = pick(b.narration, p.cueWord, afterComma(b.narration));
  return {
    parts: [
      {
        set: "street",
        props: {
          sign: SIGN[w.place] ?? "COFFEE SHOP",
          taxiX: plus(-9, { $t: 9 }),
          me: after(cut, NEED_POSES[p.pose ?? "hungry"], { turn: 50, walk: 0.6 }),
        },
        shots: [
          { at: 0, shot: "street.establish" },
          { at: cut, shot: "street.onMe" },
        ],
      },
    ],
    overlays: [
      { type: "sfx", name: "whoosh", at: 0.05, volume: 0.3 },
      { type: "pin", text: p.city, dot: "C.gold", size: 48, at: 0.15, top: 240 },
      { type: "pin", text: p.need ?? "Ronc…", dot: "C.red", size: 44, at: off(cut, 0.15), anchor: "STREET.belly", align: "center" },
      { type: "sfx", name: "bong", at: off(cut, 0.15), volume: 0.35 },
    ],
  };
};

/** Quem atende faz a pergunta em inglês. `close` pula o plano geral. */
export const ask: Macro = (b) => {
  const p = P(b);
  const wide = p.close !== true;
  return {
    parts: [
      {
        set: "counter",
        props: { me: { mood: p.meMood ?? "ok" }, other: { mood: "happy", talking: true, armL: 60 } },
        shots: wide
          ? [
              { at: 0, shot: "counter.wide" },
              { at: { frac: 0.42 }, shot: "counter.onOther" },
            ]
          : [{ at: 0, shot: "counter.onOther" }],
      },
    ],
    overlays: wide
      ? [
          { type: "sfx", name: "pop", at: 0.02 },
          { type: "sfx", name: "tick", at: { frac: 0.42 } },
        ]
      : [{ type: "sfx", name: "tick", at: 0.02 }],
  };
};

/** O branco: "travar" ao pé da letra. O bloco de gelo cresce em volta de "você". */
export const freeze: Macro = (b) => {
  const hit = pick(b.narration, P(b).cueWord, emph(b.narration));
  return {
    parts: [
      {
        set: "counter",
        props: {
          ice: spring(hit),
          me: { mood: "wide", sweat: after(hit, false, true), shiver: after(hit, 0, 1), lean: -6, outL: 20, outR: 20 },
        },
        shots: [
          { at: 0, shot: "counter.onMe" },
          { at: off(hit, 0.45), shot: "counter.lowMe" },
        ],
      },
    ],
    overlays: [
      { type: "sfx", name: "bong", at: hit, volume: 0.7 },
      { type: "sfx", name: "tick", at: off(hit, 0.45) },
      { type: "verdict", ok: false, at: off(hit, 0.1) },
      { type: "pin", text: P(b).label ?? "Travou", dot: "C.sky", at: off(hit, 0.5), anchor: "COUNTER.overMe" },
    ],
  };
};

/** Fala de "você" no balcão, já congelado. */
export const lineMe: Macro = (b) => ({
  parts: [{ set: "counter", props: { ice: P(b).ice ?? 1, me: { mood: P(b).mood ?? "wide", lean: -6, outL: 20, outR: 20 } }, shots: [{ at: 0, shot: "counter.onMe" }] }],
  overlays: [{ type: "verdict", ok: false, at: -1 }],
});

/** Fala de quem atende, com a reação (bravo, feliz). */
export const lineOther: Macro = (b) => {
  const mood = P(b).mood ?? "angry";
  return {
    parts: [
      {
        set: "counter",
        props: { ice: P(b).ice ?? 1, other: mood === "angry" ? { mood, talking: true, lean: 12, headTilt: 8 } : { mood, talking: true, armL: 60 }, me: P(b).meMood ? { mood: P(b).meMood } : {} },
        shots: [{ at: 0, shot: "counter.onOther" }],
      },
    ],
    overlays: [{ type: "sfx", name: "tick", at: 0.02 }],
  };
};

/** A fila cresce, um por um, e depois quem atende desiste. */
export const crowd: Macro = (b) => {
  const cut = pick(b.narration, P(b).cueWord, afterPeriod(b.narration));
  const grow = ramp(0.15, off(cut, -0.2), 1, 4.99);
  return {
    parts: [
      {
        set: "counter",
        props: {
          ice: 1,
          queue: after(cut, 4, grow),
          other: after(cut, { mood: "sad", outL: 55, outR: 55, armL: 35, armR: 35, headTurn: 35 }, { mood: "angry" }),
        },
        shots: [
          { at: 0, from: undefined as any, shot: "counter.queue", to: "counter.queueFar" },
          { at: cut, shot: "counter.onOther" },
        ],
      },
    ],
    overlays: [
      { type: "sfx", name: "pop", at: 0.2, volume: 0.4 },
      { type: "sfx", name: "pop", at: 0.45, volume: 0.4 },
      { type: "sfx", name: "pop", at: 0.7, volume: 0.4 },
      { type: "sfx", name: "tick", at: cut },
      { type: "pin", text: { $fmt: ["Fila +", { $int: grow }] }, dot: "C.red", size: 46, at: 0.5, until: cut, anchor: "COUNTER.overQueue" },
    ],
  };
};

/** O prejuízo: de volta à rua, de mãos vazias, com o número na tela. */
export const walkOutStreet: Macro = (b, w) => {
  const hit = pick(b.narration, P(b).cueWord, emph(b.narration));
  const open = (v: number) => after(hit, v, 0);
  return {
    parts: [
      {
        set: "street",
        props: {
          sign: SIGN[w.place] ?? "COFFEE SHOP",
          taxiX: plus(3, { $t: 7 }),
          me: { turn: -15, mood: "sad", lean: P(b).lean ?? 10, headTilt: -8, shiver: 0.5, outL: open(40), outR: open(40), armL: open(40), armR: open(40) },
        },
        shots: [{ at: 0, shot: "street.door", to: "street.onMe" }],
      },
    ],
    overlays: [
      { type: "sfx", name: "whoosh", at: 0.02, volume: 0.3 },
      { type: "sfx", name: "bong", at: hit, volume: 0.5 },
      { type: "plate", text: P(b).loss, tone: "red", at: hit, left: 250, top: 300, size: 96, pad: "14px 44px", radius: 30 },
    ],
  };
};

/** A causa, como objeto: balança, barras ou pilha. O tipo vem do mundo do episódio. */
export const metaphor: Macro = (b, w) => {
  const p = P(b);
  const n = b.narration;
  const a = pick(n, p.cueA, cueAt(n, 1));
  const mid = pick(n, p.cueMid, afterPeriod(n));
  const bb = pick(n, p.cueB, emph(n));
  const kind = p.kind ?? w.metaphor;
  const shots = [
    { at: 0 as number, shot: "studio.wide" },
    { at: mid, shot: "studio.side" },
  ];
  const sfx = [
    { type: "sfx" as const, name: "bong", at: off(a, 0.25), volume: 0.5 },
    { type: "sfx" as const, name: "tick", at: mid },
    { type: "sfx" as const, name: "pop", at: bb },
  ];
  if (kind === "bars") {
    return {
      parts: [{ set: "studio", props: { tone: "noite" }, shots, objects: [{ kind: "bars", values: [1, 0.08], k: smooth(off(a, 0.2)) }] }],
      overlays: [...sfx, { type: "pin", text: p.heavy, dot: "C.mint", size: 36, at: off(a, 0.3), anchor: "bars.top0" }, { type: "pin", text: p.light, dot: "C.red", size: 36, at: bb, anchor: "bars.top1" }],
    };
  }
  if (kind === "pile") {
    return {
      parts: [
        {
          set: "studio",
          props: { tone: "coral" },
          shots,
          objects: [
            { kind: "pile", n: 6, k: ramp(a, mid), pos: [-0.8, 0, 0] },
            { kind: "guy", look: "me", pos: [0.8, 0, 0], turn: -20, mood: after(bb, "sad", "ok"), outL: after(bb, 35, 0), outR: after(bb, 35, 0) },
          ],
        },
      ],
      overlays: [...sfx, { type: "pin", text: p.heavy, dot: "C.mint", size: 36, at: off(a, 0.3), anchor: [-0.8, 1.45, 0] }, { type: "pin", text: p.light, dot: "C.red", size: 36, at: bb, anchor: [0.8, 2.4, 0] }],
    };
  }
  return {
    parts: [
      {
        set: "studio",
        props: { tone: "indigo" },
        shots,
        objects: [{ kind: "scale", scale: 0.72, tilt: spring(off(a, 0.2), 0, -17), leftPile: { n: 5, drop: smooth(off(a, 0.05)) }, rightDot: after(bb, true, false) }],
      },
    ],
    overlays: [...sfx, { type: "pin", text: p.heavy, dot: "C.mint", size: 36, at: off(a, 0.3), anchor: "scale.left", dy: -10 }, { type: "pin", text: p.light, dot: "C.red", size: 36, at: bb, anchor: "scale.right", dy: -10 }],
  };
};

/** O app entra: em casa, o tutor sai do celular na palavra "Pragma". */
export const appEnter: Macro = (b) => {
  const hit = pick(b.narration, P(b).cueWord, emph(b.narration));
  return {
    parts: [
      {
        set: "home",
        props: { me: { headTurn: 20 }, bot: { mood: "happy", scale: spring(hit) } },
        shots: [
          { at: 0, shot: "home.wide" },
          { at: hit, shot: "home.onBot" },
        ],
      },
    ],
    overlays: [
      { type: "sfx", name: "whoosh", at: 0.02, volume: 0.3 },
      { type: "sfx", name: "ding", at: hit, volume: 0.5 },
      { type: "pin", text: "Tutor de IA", dot: "C.indigo", at: off(hit, 0.25), anchor: "HOME.overBot" },
    ],
  };
};

/** Fala do tutor. Com `plate`, a resposta certa aparece grande na palavra `plateCue`. */
export const tutorLine: Macro = (b) => {
  const p = P(b);
  const plateAt = pick(b.narration, p.plateCue, afterSay(b.narration));
  return {
    parts: [{ set: "home", props: { bot: { mood: "happy", talking: true } }, shots: [{ at: 0, shot: "home.onBot" }] }],
    overlays: [
      { type: "sfx", name: "tick", at: 0.02 },
      ...(p.plate ? [{ type: "sfx" as const, name: "pop", at: plateAt }, { type: "plate" as const, text: p.plate, tone: "mint", at: plateAt, left: 90, top: 250, width: 900, size: 110, pad: "30px 30px", radius: 48 }] : []),
    ],
  };
};

/** A palavra depois de "Say:" (a resposta que o tutor ensina). */
const afterSay = (n: string) => {
  const m = n.replace(/\[\/?en\]|\*/g, "").split(/\s+/);
  const i = m.findIndex((w) => /^say:?$/i.test(w));
  return i >= 0 && i + 1 < m.length ? cueAt(n, i + 1) : emph(n);
};

/** O erro de "você": no fim da fala, X, som e o que a frase quis dizer. */
export const userError: Macro = (b) => {
  const hit: any = { end: -0.3 };
  return {
    parts: [
      {
        set: "home",
        props: {
          me: { mood: after(hit, "sad", "ok"), talking: after({ end: -0.5 }, false, true) },
          bot: { mood: after(hit, "wide", "neutral"), tilt: after(hit, 12, 0) },
        },
        shots: [{ at: 0, shot: "home.onMe" }],
      },
    ],
    overlays: [
      { type: "sfx", name: "tick", at: 0.02 },
      { type: "sfx", name: "bong", at: hit },
      { type: "verdict", ok: false, at: hit },
      { type: "plate", text: `= "${P(b).meaning}"`, tone: "red", at: off(hit, 0.05), left: 270, top: 270, size: 60, pad: "14px 34px", radius: 26 },
    ],
  };
};

/** O acerto de "você": certo, som, pulo, estilhaços e carimbo. */
export const userSuccess: Macro = (b) => {
  const hit: any = { end: -0.45 };
  const hop = bounce(hit, 0.3);
  return {
    parts: [
      {
        set: "home",
        props: {
          me: { mood: after(hit, "happy", "ok"), talking: after({ end: -0.55 }, false, true), hop, armR: after(hit, 170, 80), armL: after(hit, 170, 0) },
          bot: { mood: "happy" },
        },
        shots: [
          { at: 0, shot: "home.onMe" },
          { at: hit, shot: "home.both" },
        ],
        objects: [{ kind: "burst", pos: [0.1, 1.2, 0.6], k: ramp(hit, off(hit, 0.7)), color: "C.gold", n: 18, power: 2.6 }],
      },
    ],
    overlays: [
      { type: "sfx", name: "tick", at: 0.02 },
      { type: "sfx", name: "ding", at: hit },
      { type: "verdict", ok: true, at: hit },
      { type: "stamp", text: P(b).stamp ?? "Natural", tone: "mint", at: off(hit, 0.05), left: 320, top: 260, size: 96 },
    ],
  };
};

/** O pitch: sete dias acendem; corte para casa, com a tela real do app. */
export const pitchHabit: Macro = (b) => {
  const cut = pick(b.narration, P(b).cueWord, afterComma(b.narration));
  return {
    parts: [
      { set: "studio", props: { tone: "indigo" }, shots: [{ at: 0, shot: "studio.wide" }], objects: [{ kind: "daybars", n: 7 }] },
      { at: cut, set: "home", props: { me: { mood: "happy", talking: true }, bot: { mood: "happy" } }, shots: [{ at: cut, shot: "home.both" }] },
    ],
    overlays: [
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({ type: "sfx" as const, name: "tick", at: 0.12 + i * 0.16, volume: 0.4 })),
      { type: "plate", text: P(b).plateText ?? "5 min", small: P(b).plateSmall ?? " /dia", tone: "white", at: 0.05, until: cut, left: 240, top: 300, size: 120, color: "C.indigo" },
      { type: "sfx", name: "whoosh", at: cut, volume: 0.3 },
      { type: "phone", at: { frac: 0.62 }, left: 405, top: 235, width: 270 },
    ],
  };
};

/** De volta ao lugar, de dia, andando firme. */
export const walkStreet: Macro = (b, w) => ({
  parts: [
    {
      set: "street",
      props: { night: false, sign: SIGN[w.place] ?? "COFFEE SHOP", taxiX: plus(2.5, { $t: 6 }), me: null },
      shots: [{ at: 0, shot: "street.walk" }],
      objects: [{ kind: "guy", look: "me", pos: [ramp(0, { end: 0 }, -3.2, -0.6), 0.16, -0.5], turn: 90, mood: "happy", walk: 1 }],
    },
  ],
  overlays: [
    { type: "sfx", name: "whoosh", at: 0.02, volume: 0.3 },
    { type: "pin", text: P(b).pin ?? "No dia seguinte", dot: "C.mint", size: 48, at: 0.1, top: 240 },
  ],
});

/** A vitória: fechado na fala; corte para o geral com o objeto vindo e a festa. */
export const win: Macro = (b) => {
  const hit: any = { end: -1.25 };
  return {
    parts: [
      {
        set: "counter",
        props: {
          itemOut: spring(hit),
          me: { mood: "happy", talking: after({ end: -1.35 }, false, true), armR: after(hit, 85, 20), hop: bounce(hit, 0.14) },
          other: { mood: "happy", armL: after(hit, 75, 0) },
        },
        shots: [
          { at: 0, shot: "counter.onMe" },
          { at: hit, shot: "counter.wide" },
        ],
        objects: [{ kind: "burst", pos: { $ref: "COUNTER.item" }, k: ramp(hit, off(hit, 0.9)), color: "C.gold", n: 22, power: 3 }],
      },
    ],
    overlays: [
      { type: "sfx", name: "tick", at: 0.02 },
      { type: "sfx", name: "ding", at: hit },
      { type: "verdict", ok: true, at: hit },
      { type: "stamp", text: P(b).stamp ?? "Sem travar", tone: "mint", at: off(hit, 0.05), left: 260, top: 260, size: 78, rotate: -6 },
    ],
  };
};

/** Tela final: marca e "Link na bio". */
export const endCard: Macro = (): SceneData => ({ parts: [{ set: "endcard" }] });

export { between };
