import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneProvider, SceneTiming } from "./anim";
import { Captions } from "./Captions";
import { C, CAPTION_Y, F, FPS, loadFonts } from "./theme";

export type Script = {
  slug: string;
  series?: string;
  number?: number;
  title: string;
  post?: { caption: string; hashtags: string[] };
  /** Quem fala em vídeos de conversa: rótulo, cor (chave de `C`) e voz. */
  cast?: Record<string, { label: string; color: string; say?: { pt?: string; en?: string }; openai?: string }>;
  /** Ajuste da legenda. O padrão das conversas em 3D é `{ "y": 1290, "size": 84 }`. */
  captions?: { y?: number; size?: number };
  scenes: {
    id: string;
    narration: string;
    captions?: boolean;
    hold?: number;
    /** Chave de `cast`. */
    speaker?: string;
    /** Tradução pequena embaixo da legenda, para fala em inglês. */
    sub?: string;
    /** Faixa fixa no topo: a frase do gancho. Repita nas cenas em que ela deve ficar. */
    banner?: string;
  }[];
};
export type Timing = { provider: string; scenes: Record<string, SceneTiming & { hash?: string }> };
export type EpisodeDef = { script: Script; timing: Timing; visuals: Record<string, React.FC>; progress?: boolean };

const fallback = (narration: string): SceneTiming => {
  const words = narration.replace(/\[\/?en\]|\*/g, "").split(/\s+/).filter(Boolean);
  const per = 0.36;
  return { dur: words.length * per + 0.4, audio: null, words: words.map((t, i) => ({ t, s: i * per, e: (i + 1) * per })) };
};

export const sceneFrames = (ep: EpisodeDef) =>
  ep.script.scenes.map((s) => {
    const tm = ep.timing.scenes[s.id] ?? fallback(s.narration);
    return { id: s.id, scene: s, tm, frames: Math.max(1, Math.round((tm.dur + (s.hold ?? 0)) * FPS)), captions: s.captions !== false };
  });

export const episodeFrames = (ep: EpisodeDef) => sceneFrames(ep).reduce((a, s) => a + s.frames, 0);

const Missing: React.FC<{ id: string }> = ({ id }) => (
  <AbsoluteFill style={{ background: C.red, color: C.white, fontFamily: F.display, fontSize: 70, alignItems: "center", justifyContent: "center" }}>
    sem visual: {id}
  </AbsoluteFill>
);

const stroke = { WebkitTextStroke: `14px ${C.ink}`, paintOrder: "stroke fill" } as React.CSSProperties;

/** Quem está falando, logo acima da legenda. */
const Speaker: React.FC<{ label: string; color: string; y?: number }> = ({ label, color, y = CAPTION_Y }) => (
  <div style={{ position: "absolute", left: 0, right: 0, top: y - 150, display: "flex", justifyContent: "center" }}>
    <div
      style={{
        background: (C as Record<string, string>)[color] ?? color,
        color: color === "gold" ? C.ink : C.white,
        border: `5px solid ${C.ink}`,
        boxShadow: `0 7px 0 ${C.ink}`,
        borderRadius: 999,
        padding: "6px 30px",
        fontFamily: F.display,
        fontWeight: 700,
        fontSize: 40,
        letterSpacing: 2,
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
  </div>
);

const Sub: React.FC<{ text: string; y?: number }> = ({ text, y = CAPTION_Y }) => (
  <div
    style={{
      position: "absolute",
      left: 80,
      right: 80,
      top: y + 96,
      textAlign: "center",
      fontFamily: F.display,
      fontWeight: 600,
      fontSize: 50,
      color: C.white,
      ...stroke,
    }}
  >
    {text}
  </div>
);

const Banner: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: "absolute", left: 0, right: 0, top: 205, display: "flex", justifyContent: "center" }}>
    <div
      style={{
        background: C.ink,
        color: C.white,
        borderRadius: 30,
        padding: "18px 40px",
        maxWidth: 900,
        textAlign: "center",
        fontFamily: F.display,
        fontWeight: 700,
        fontSize: 58,
        lineHeight: 1.08,
        boxShadow: `0 10px 0 rgba(0,0,0,0.25)`,
      }}
    >
      {text}
    </div>
  </div>
);

/** Barra fina no topo: quanto falta para acabar. Segura quem está em dúvida. */
const Progress: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 12, background: "rgba(30,27,75,0.15)" }}>
      <div style={{ width: `${(frame / durationInFrames) * 100}%`, height: "100%", background: C.gold }} />
    </div>
  );
};

/** Monta o episódio: cenas em sequência, áudio de cada uma e legendas por cima. */
export const Episode: React.FC<{ ep: EpisodeDef }> = ({ ep }) => {
  // Segura o render até as fontes carregarem: as placas 3D desenham texto em canvas.
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("fontes"));
  useEffect(() => {
    loadFonts().then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [handle]);
  const scenes = sceneFrames(ep);
  if (!ready) return null;
  let from = 0;
  return (
    <AbsoluteFill style={{ background: C.cream }}>
      {scenes.map((s) => {
        const Visual = ep.visuals[s.id];
        const start = from;
        from += s.frames;
        return (
          <Sequence key={s.id} from={start} durationInFrames={s.frames} name={s.id}>
            <SceneProvider value={{ ...s.tm, id: s.id }}>
              <AbsoluteFill>{Visual ? <Visual /> : <Missing id={s.id} />}</AbsoluteFill>
              {s.tm.audio && <Audio src={staticFile(s.tm.audio)} />}
              {s.scene.banner && <Banner text={s.scene.banner} />}
              {s.captions && s.scene.speaker && ep.script.cast?.[s.scene.speaker] && <Speaker {...ep.script.cast[s.scene.speaker]} y={ep.script.captions?.y} />}
              {s.captions && <Captions words={s.tm.words} y={ep.script.captions?.y} size={ep.script.captions?.size} />}
              {s.captions && s.scene.sub && <Sub text={s.scene.sub} y={ep.script.captions?.y} />}
            </SceneProvider>
          </Sequence>
        );
      })}
      {ep.progress !== false && <Progress />}
    </AbsoluteFill>
  );
};
