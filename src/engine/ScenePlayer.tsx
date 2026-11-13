import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import {
  Anchor,
  Bars,
  Block,
  Burst,
  C,
  COUNTER,
  Cam,
  Counter,
  EndCard,
  Guy,
  HOME,
  Mark,
  Home,
  Phone,
  Pile,
  Pin,
  Plate,
  Pop,
  Robot,
  SHOT,
  STREET,
  Scale,
  School,
  Sfx,
  Stamp,
  Street,
  Studio,
  VOCE,
  Verdict,
  useBrand,
  useCue,
  useScene,
  useShots,
} from "../kit";
import type { At, Obj, Overlay, Part, SceneData, World } from "./types";

/* ───────────── expressões: o JSON da cena fala com o tempo ───────────── */

type X = { t: number; frame: number; fps: number; dur: number; cue: (w: string, nth?: number, off?: number) => number };

const REFS: Record<string, any> = {};
for (const [k, v] of Object.entries(COUNTER)) REFS[`COUNTER.${k}`] = v;
for (const [k, v] of Object.entries(HOME)) REFS[`HOME.${k}`] = v;
for (const [k, v] of Object.entries(STREET)) REFS[`STREET.${k}`] = v;

export const sec = (a: At | undefined, x: X, d = 0): number => {
  if (a === undefined) return d;
  if (typeof a === "number") return a;
  if ("cue" in a) return x.cue(a.cue, a.nth ?? 0, a.offset ?? 0);
  if ("end" in a) return x.dur + a.end;
  return x.dur * a.frac;
};

const prog = (at: number, x: X, bouncy: boolean) =>
  spring({ frame: x.frame - Math.round(at * x.fps), fps: x.fps, config: bouncy ? { damping: 11, stiffness: 170, mass: 0.7 } : { damping: 200 } });

/**
 * Operadores que podem aparecer em qualquer valor da cena:
 *  {$tween:{from,to,at,until?,ease?}}  número que anda (ease: spring | smooth | linear)
 *  {$after:{at,then,else}}             um valor antes, outro depois de `at`
 *  {$between:{at,until,then,else}}     um valor só entre dois instantes
 *  {$bounce:{at,h}}                    pulinho de comemoração
 *  {$ref:"COUNTER.item"}               ponto fixo de um cenário
 *  {$add:[a,b,…]} {$t:k} {$int:v} {$fmt:["Fila +", v]}
 * Texto "C.gold" vira a cor da marca.
 */
export const resolve = (v: any, x: X): any => {
  if (typeof v === "string") return v.startsWith("C.") && (C as any)[v.slice(2)] ? (C as any)[v.slice(2)] : v;
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map((e) => resolve(e, x));
  if ("$tween" in v) {
    const o = v.$tween;
    const a = sec(o.at, x, 0);
    const ease = o.ease ?? "spring";
    let p: number;
    if (ease === "linear") {
      const b = o.until === undefined ? a + 1 : sec(o.until, x);
      p = Math.min(1, Math.max(0, (x.t - a) / Math.max(0.001, b - a)));
    } else p = prog(a, x, ease === "spring");
    return o.from + (o.to - o.from) * p;
  }
  if ("$after" in v) return resolve(x.t >= sec(v.$after.at, x) ? v.$after.then : v.$after.else, x);
  if ("$between" in v) {
    const o = v.$between;
    return resolve(x.t >= sec(o.at, x) && x.t < sec(o.until, x) ? o.then : o.else, x);
  }
  if ("$bounce" in v) {
    const a = sec(v.$bounce.at, x);
    return x.t > a ? Math.abs(Math.sin((x.t - a) * 9)) * v.$bounce.h : 0;
  }
  if ("$ref" in v) return REFS[v.$ref];
  if ("$add" in v) return (v.$add as any[]).reduce((s, e) => s + Number(resolve(e, x)), 0);
  if ("$t" in v) return x.t * v.$t;
  if ("$int" in v) return Math.floor(Number(resolve(v.$int, x)));
  if ("$fmt" in v) return (v.$fmt as any[]).map((e) => resolve(e, x)).join("");
  const out: Record<string, any> = {};
  for (const k of Object.keys(v)) out[k] = resolve(v[k], x);
  return out;
};

/* ───────────── câmeras ───────────── */

const lookupShot = (name: string): Cam => {
  const c = name.split(".").reduce((o: any, k) => o?.[k], SHOT as any);
  if (!c) throw new Error(`câmera "${name}" não existe. Use uma de SHOT (ex.: counter.onOther, street.establish, home.onBot).`);
  return c;
};
const DEFAULT_SHOT: Record<string, string> = { counter: "counter.wide", street: "street.establish", home: "home.wide", school: "school.establish", studio: "studio.wide" };
const toward = (c: Cam, k: number): Cam => ({ ...c, pos: [c.look[0] + (c.pos[0] - c.look[0]) * k, c.look[1] + (c.pos[1] - c.look[1]) * k, c.look[2] + (c.pos[2] - c.look[2]) * k] });

/** Estilo de câmera do episódio: aplica-se aos planos que não têm `to`. */
const styled = (from: Cam, to: Cam | undefined, style: World["camStyle"]): { from: Cam; to?: Cam } => {
  if (to) return { from, to };
  if (style === "pull") return { from: toward(from, 0.9), to: from };
  if (style === "slide") return { from, to: { ...from, pos: [from.pos[0] + 0.7, from.pos[1], from.pos[2]], look: [from.look[0] + 0.35, from.look[1], from.look[2]] } };
  return { from };
};

/* ───────────── objetos 3D ───────────── */

type Ctx = { world: World };

const Obj3D: React.FC<{ o: any; ctx: Ctx }> = ({ o, ctx }) => {
  switch (o.kind) {
    case "guy": {
      const { kind, look, ...g } = o;
      const base = look === "me" ? { ...VOCE, ...ctx.world.look.me } : look === "other" ? { ...ctx.world.look.other } : {};
      return <Guy {...base} {...g} />;
    }
    case "robot":
      return <Robot pos={o.pos} turn={o.turn} scale={o.scale} mood={o.mood} talking={o.talking} />;
    case "burst":
      return <Burst pos={o.pos} k={o.k} color={o.color} n={o.n} power={o.power} />;
    case "block":
      return <Block size={o.size} pos={o.pos} rot={o.rot} color={o.color} r={o.r} opacity={o.opacity} rough={o.rough} glow={o.glow} />;
    case "bars":
      return <Bars values={o.values} k={o.k} pos={o.pos} colors={o.colors} />;
    case "pile":
      return <Pile n={o.n} k={o.k} pos={o.pos} />;
    case "scale":
      return (
        <Scale
          scale={o.scale ?? 0.72}
          tilt={o.tilt}
          left={
            o.leftPile ? (
              <group position={[0, (1 - o.leftPile.drop) * 3, 0]}>
                {[C.coral, C.mint, C.gold, C.lilac, C.sky].slice(0, o.leftPile.n).map((c, i) => (
                  <Block key={c} size={[0.62 - (i % 2) * 0.08, 0.13, 0.44]} pos={[(i % 2) * 0.05 - 0.02, 0.07 + i * 0.135, 0]} rot={[0, i * 0.2, 0]} color={c} r={0.03} rough={0.5} />
                ))}
              </group>
            ) : null
          }
          right={o.rightDot ? <Block size={[0.16, 0.12, 0.12]} pos={[0, 0.07, 0]} color={C.white} r={0.04} /> : null}
        />
      );
    case "daybars":
      return (
        <>
          {Array.from({ length: o.n ?? 7 }).map((_, i) => {
            const lit = Math.min(1, Math.max(0, (o.t - (o.at ?? 0.1) - i * (o.stagger ?? 0.16)) / 0.15));
            const h = 0.16 + lit * 0.9;
            return <Block key={i} size={[0.38, h, 0.38]} pos={[-1.38 + i * 0.46, h / 2, 0]} color={lit > 0.5 ? C.mint : "#6C63D9"} glow={lit * 0.25} r={0.06} rough={0.4} />;
          })}
        </>
      );
    default:
      throw new Error(`objeto "${o.kind}" não existe. Tipos: guy, robot, burst, block, bars, pile, scale, daybars.`);
  }
};

/** Pontos 3D que dependem de objetos animados (a ponta da balança sobe e desce). */
const anchorsOf = (objs: any[]) => {
  const a: Record<string, [number, number, number]> = {};
  for (const o of objs) {
    if (o.kind === "scale") {
      const K = o.scale ?? 0.72;
      const r = (o.tilt * Math.PI) / 180;
      a["scale.left"] = [-1.25 * Math.cos(r) * K, (2.2 + 1.25 * Math.sin(r)) * K, 0];
      a["scale.right"] = [1.25 * Math.cos(r) * K, (1.6 - 1.25 * Math.sin(r)) * K, 0];
    }
    if (o.kind === "bars") {
      const n = o.values.length;
      o.values.forEach((v: number, i: number) => {
        const h = Math.max(0.04, v * 2.4 * (o.k ?? 1));
        a[`bars.top${i}`] = [(i - (n - 1) / 2) * 0.95 + (o.pos?.[0] ?? 0), 0.12 + h + 0.25, o.pos?.[2] ?? 0];
      });
    }
  }
  return a;
};

/* ───────────── sobreposições (HTML por cima do 3D) ───────────── */

const OverlayView: React.FC<{ o: any; cam: Cam; x: X; anchors: Record<string, [number, number, number]> }> = ({ o, cam, x, anchors }) => {
  const brand = useBrand();
  const at = sec(o.at, x, 0);
  const until = o.until === undefined ? undefined : sec(o.until, x);
  const live = x.t >= at && (until === undefined || x.t < until);
  switch (o.type) {
    case "sfx":
      return <Sfx name={o.name} at={at} volume={o.volume} />;
    case "mark":
      return (
        <Pop at={at} out={until} style={{ left: o.left ?? 30, top: o.top ?? 260 }}>
          <Mark ok={o.ok} size={o.size ?? 110} />
        </Pop>
      );
    case "verdict":
      return <Verdict ok={o.ok} at={at} size={o.size} />;
    case "stamp":
      return (
        <div style={{ position: "absolute", left: o.left ?? 300, top: o.top ?? 260 }}>
          <Stamp at={at} tone={o.tone ?? "mint"} rotate={o.rotate} size={o.size}>
            {o.text}
          </Stamp>
        </div>
      );
    case "phone": {
      // Sem `src`, usa a primeira tela do produto cadastrada na marca; sem nenhuma, não desenha o celular.
      const src = o.src ?? brand.productShots?.[0];
      if (!src) return null;
      return (
        <Pop at={at} out={until} from={o.from ?? "down"} style={{ left: o.left ?? 420, top: o.top ?? 235 }}>
          <Phone src={src} width={o.width ?? 270} tilt={o.tilt} />
        </Pop>
      );
    }
    case "plate":
      return (
        <Pop at={at} out={until} from={o.from} style={{ left: o.left ?? 90, top: o.top ?? 250 }}>
          <Plate tone={o.tone ?? "white"} width={o.width} pad={o.pad ?? "14px 46px"} radius={o.radius ?? 36} style={{ fontSize: o.size ?? 100, fontWeight: 700, textAlign: "center", ...(o.color ? { color: o.color } : {}), ...(o.bg ? { background: o.bg } : {}) }}>
            {o.text}
            {o.small && <span style={{ fontSize: (o.size ?? 100) * 0.52, color: C.inkSoft }}>{o.small}</span>}
          </Plate>
        </Pop>
      );
    case "pin": {
      if (!live) return null;
      const dot = o.dot ?? C.red;
      const size = o.size ?? 38;
      if (o.anchor !== undefined) {
        const p = typeof o.anchor === "string" ? (anchors[o.anchor] ?? REFS[o.anchor]) : o.anchor;
        if (!p) throw new Error(`âncora "${o.anchor}" não existe nesta cena.`);
        return (
          <Anchor cam={cam} p={p} align={o.align} dx={o.dx} dy={o.dy}>
            <Pin dot={dot} size={size}>
              {o.text}
            </Pin>
          </Anchor>
        );
      }
      return (
        <Pop at={at} out={until} from="down" style={{ left: 0, right: 0, top: o.top ?? 240, display: "flex", justifyContent: "center" }}>
          <Pin dot={dot} size={size}>
            {o.text}
          </Pin>
        </Pop>
      );
    }
    default:
      throw new Error(`sobreposição "${o.type}" não existe. Tipos: pin, plate, stamp, mark, verdict, phone, sfx.`);
  }
};

/* ───────────── a cena ───────────── */

const PartView: React.FC<{ part: Part; overlays: Overlay[]; ctx: Ctx }> = ({ part, overlays, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { dur } = useScene();
  const cue = useCue();
  const x: X = { t: frame / fps, frame, fps, dur, cue };

  const defs = part.shots?.length ? part.shots : [{ at: 0, shot: DEFAULT_SHOT[part.set] }];
  const cam = useShots(
    defs.map((s) => {
      const from = s.from ?? lookupShot(s.shot!);
      const to = typeof s.to === "string" ? lookupShot(s.to) : s.to;
      return { at: sec(s.at, x, 0), ...styled(from, to, ctx.world.camStyle) };
    }),
  );

  const props = resolve(part.props ?? {}, x);
  const objs = (part.objects ?? []).map((o) => resolve(o, x));
  const anchors = anchorsOf(objs);
  const ovs = overlays.map((o) => resolve({ ...o, at: undefined, until: undefined }, x));
  const world = (
    <>
      {objs.map((o, i) => (
        <Obj3D key={i} o={{ ...o, t: x.t }} ctx={ctx} />
      ))}
    </>
  );
  const look = ctx.world.look;
  const me = props.me === null ? null : { ...look.me, ...props.me };
  const other = { ...look.other, ...props.other };

  let set: React.ReactNode;
  switch (part.set) {
    case "counter":
      set = <Counter cam={cam} place={(props.place ?? ctx.world.place) as any} me={me ?? {}} other={other} ice={props.ice} queue={props.queue} itemOut={props.itemOut} world={world} />;
      break;
    case "street":
      set = <Street cam={cam} sign={props.sign} night={props.night} taxiX={props.taxiX} me={me} world={world} />;
      break;
    case "home":
      set = <Home cam={cam} me={me ?? {}} bot={props.bot} world={world} />;
      break;
    case "school":
      set = <School cam={cam} sign={props.sign} world={world} />;
      break;
    case "studio":
      set = (
        <Studio cam={cam} tone={props.tone ?? ctx.world.studioTone}>
          {world}
        </Studio>
      );
      break;
    default:
      throw new Error(`cenário "${part.set}" não existe. Use: counter, street, home, school, studio, endcard.`);
  }
  return (
    <AbsoluteFill>
      {set}
      {overlays.map((o, i) => (
        <OverlayView key={i} o={{ ...o, ...ovs[i], at: o.at, until: o.until }} cam={cam} x={x} anchors={anchors} />
      ))}
    </AbsoluteFill>
  );
};

/** Desenha uma cena a partir de dados. Nenhum TSX por cena. */
export const ScenePlayer: React.FC<{ data: SceneData; ctx: Ctx }> = ({ data, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { dur } = useScene();
  const cue = useCue();
  const x: X = { t: frame / fps, frame, fps, dur, cue };
  let idx = 0;
  data.parts.forEach((p, i) => {
    if (x.t >= sec(p.at, x, 0)) idx = i;
  });
  const part = data.parts[idx];
  if (part.set === "endcard") return <EndCard />;
  return <PartView key={idx} part={part} overlays={data.overlays ?? []} ctx={ctx} />;
};
