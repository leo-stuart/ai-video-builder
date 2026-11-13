import React, { createContext, useContext } from "react";
import { Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export type Word = { t: string; s: number; e: number; en?: boolean; em?: boolean };
export type SceneTiming = { dur: number; audio: string | null; words: Word[]; id?: string };

const SceneCtx = createContext<SceneTiming>({ dur: 3, audio: null, words: [] });
export const SceneProvider = SceneCtx.Provider;
export const useScene = () => useContext(SceneCtx);

/** Segundos desde o início da cena. */
export const useT = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9']/g, "");

/**
 * Devolve o instante (s) em que a narração fala uma palavra. Use para
 * sincronizar o visual com a voz: `<Pop at={cue("coffee")}>`.
 * `nth` escolhe a enésima ocorrência; `offset` adianta ou atrasa.
 */
export const useCue = () => {
  const { words, id } = useScene();
  return (word: string, nth = 0, offset = 0) => {
    const hits = words.filter((w) => norm(w.t) === norm(word));
    // Erro alto e claro: um cue errado dessincroniza a cena inteira sem ninguém notar.
    if (!hits.length) {
      throw new Error(`cue("${word}") não existe na cena "${id}". Palavras desta cena: ${words.map((w) => w.t.replace(/[.,!?…:;]+$/, "")).join(" | ")}`);
    }
    return Math.max(0, (hits[nth] ?? hits[hits.length - 1]).s + offset);
  };
};

/** Pulinho de comemoração que começa em `at` segundos. Passe o resultado em `hop`. */
export const useBounce = (at: number, height = 0.25) => {
  const t = useT();
  return t > at ? Math.abs(Math.sin((t - at) * 9)) * height : 0;
};

/** Verdadeiro depois de `at` segundos. Para trocar humor ou pose no meio da cena. */
export const useAfter = (at: number) => useT() >= at;

/** Mola 0→1 que dispara em `at` segundos. */
export const useSpring = (at = 0, bouncy = true) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: frame - Math.round(at * fps),
    fps,
    config: bouncy ? { damping: 11, stiffness: 170, mass: 0.7 } : { damping: 200 },
  });
};

type PopProps = {
  at?: number;
  /** Some neste instante (s). */
  out?: number;
  from?: "scale" | "up" | "down" | "left" | "right" | "fade";
  style?: React.CSSProperties;
  children: React.ReactNode;
};

/** Faz o filho entrar com mola em `at` segundos. A peça básica de toda cena. */
export const Pop: React.FC<PopProps> = ({ at = 0, out, from = "scale", style, children }) => {
  const t = useT();
  const inn = useSpring(at, from === "scale");
  const gone = out === undefined ? 1 : interpolate(t, [out, out + 0.15], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const d = (1 - inn) * 140;
  const transform = {
    scale: `scale(${inn})`,
    up: `translateY(${d}px)`,
    down: `translateY(${-d}px)`,
    left: `translateX(${-d * 3}px)`,
    right: `translateX(${d * 3}px)`,
    fade: "none",
  }[from];
  return (
    <div style={{ position: "absolute", opacity: Math.min(1, inn * 1.4) * gone, transform, transformOrigin: "center", ...style }}>
      {children}
    </div>
  );
};

/** Balança de lado entre `at` e `at + dur`: erro, susto, bronca. */
export const Shake: React.FC<{ at: number; dur?: number; amp?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  at,
  dur = 0.45,
  amp = 14,
  style,
  children,
}) => {
  const t = useT();
  const on = t >= at && t <= at + dur;
  const x = on ? Math.sin((t - at) * 55) * amp * (1 - (t - at) / dur) : 0;
  return <div style={{ position: "absolute", transform: `translateX(${x}px)`, ...style }}>{children}</div>;
};

/** Sobe e desce devagar para sempre: dá vida ao que está parado. */
export const Float: React.FC<{ amp?: number; speed?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  amp = 10,
  speed = 1,
  style,
  children,
}) => {
  const t = useT();
  return <div style={{ position: "absolute", transform: `translateY(${Math.sin(t * 2.4 * speed) * amp}px)`, ...style }}>{children}</div>;
};

/** 0→1 linear entre dois instantes, travado nas pontas. */
export const useRamp = (from: number, to: number) => {
  const t = useT();
  return interpolate(t, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
};

/** Efeito sonoro em `at` segundos. Arquivos em public/sfx: pop, ding, bong, whoosh, tick. */
export const Sfx: React.FC<{ name: "pop" | "ding" | "bong" | "whoosh" | "tick"; at?: number; volume?: number }> = ({ name, at = 0, volume = 0.5 }) => {
  const { fps } = useVideoConfig();
  return (
    <Sequence from={Math.max(0, Math.round(at * fps))} layout="none">
      <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
    </Sequence>
  );
};
