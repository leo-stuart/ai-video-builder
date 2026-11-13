import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Word } from "./anim";
import { C, CAPTION_Y, F } from "./theme";

const MAX_WORDS = 3;
const MAX_CHARS = 16;

/** Agrupa as palavras em blocos curtos; pontuação fecha o bloco. */
export const chunk = (words: Word[]) => {
  const out: Word[][] = [];
  let cur: Word[] = [];
  let chars = 0;
  for (const w of words) {
    const langFlip = cur.length > 0 && !!cur[cur.length - 1].en !== !!w.en;
    if (cur.length > 0 && (cur.length >= MAX_WORDS || chars + w.t.length > MAX_CHARS || langFlip)) {
      out.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(w);
    chars += w.t.length + 1;
    if (/[.!?:]$/.test(w.t)) {
      out.push(cur);
      cur = [];
      chars = 0;
    }
  }
  if (cur.length) out.push(cur);
  return out;
};

/**
 * Legenda palavra por palavra, sincronizada com a narração. Branco com
 * contorno escuro; inglês em dourado, ênfase (`*assim*`) em coral.
 */
export const Captions: React.FC<{ words: Word[]; y?: number; size?: number }> = ({ words, y = CAPTION_Y, size = 104 }) => {
  const k = size / 104;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const chunks = chunk(words);
  if (!chunks.length) return null;
  let idx = chunks.findIndex((c, i) => t < (chunks[i + 1]?.[0].s ?? Infinity));
  if (idx < 0) idx = chunks.length - 1;
  const cur = chunks[idx];
  if (t < cur[0].s - 0.05) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        top: y,
        transform: "translateY(-50%)",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0 26px",
        fontFamily: F.display,
        fontWeight: 700,
        fontSize: cur.some((w) => w.en) ? size * 0.93 : size,
        lineHeight: 1.08,
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      {cur.map((w, i) => {
        const s = spring({ frame: frame - Math.round(w.s * fps), fps, config: { damping: 12, stiffness: 260, mass: 0.5 } });
        const color = w.en ? C.gold : w.em ? C.coral : C.white;
        return (
          <span
            key={`${idx}-${i}`}
            style={{
              display: "inline-block",
              opacity: t >= w.s ? 1 : 0,
              transform: `scale(${0.7 + 0.3 * s}) translateY(${(1 - s) * 18}px)`,
              color,
              WebkitTextStroke: `${18 * k}px ${C.ink}`,
              paintOrder: "stroke fill",
              textShadow: `0 ${10 * k}px 0 ${C.ink}`,
            }}
          >
            {w.t.replace(/[.,:;]+$/, "")}
          </span>
        );
      })}
    </div>
  );
};
