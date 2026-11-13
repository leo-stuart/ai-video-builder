import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { useSpring, useT } from "./anim";
import { renderTagline, useBrand } from "./brand";
import { C, F } from "./theme";

/** Fundo da cena. Troque de cor entre cenas para marcar a virada de ideia. */
export const Bg: React.FC<{ color?: string; dots?: boolean }> = ({ color = C.cream, dots = true }) => {
  const dark = color === C.night || color === C.ink || color === C.indigo;
  return (
    <AbsoluteFill style={{ background: color }}>
      {dots && (
        <AbsoluteFill
          style={{
            backgroundImage: `radial-gradient(${dark ? "rgba(255,255,255,0.07)" : "rgba(30,27,75,0.06)"} 4px, transparent 4px)`,
            backgroundSize: "60px 60px",
          }}
        />
      )}
    </AbsoluteFill>
  );
};

type Tone = "white" | "indigo" | "mint" | "coral" | "red" | "gold" | "lilac" | "ink";
const tones: Record<Tone, { face: string; edge: string; lip: string; text: string }> = {
  white: { face: C.white, edge: C.border, lip: C.borderLip, text: C.ink },
  indigo: { face: C.indigo, edge: C.indigoLip, lip: C.indigoLip, text: C.white },
  mint: { face: C.mintSoft, edge: C.mint, lip: C.mintLip, text: "#0B5E45" },
  coral: { face: C.coralSoft, edge: C.coral, lip: C.coralLip, text: "#8F2E15" },
  red: { face: C.redSoft, edge: C.red, lip: C.redLip, text: "#9F1519" },
  gold: { face: C.goldSoft, edge: C.gold, lip: C.goldLip, text: "#6B4A00" },
  lilac: { face: C.lilacSoft, edge: C.lilac, lip: C.lilacLip, text: "#4E1FA0" },
  ink: { face: C.ink, edge: "#0E0C2B", lip: "#0E0C2B", text: C.white },
};

type PlateProps = {
  tone?: Tone;
  pad?: number | string;
  radius?: number;
  width?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

/** A "placa" do design system: face, borda e um lábio embaixo. */
export const Plate: React.FC<PlateProps> = ({ tone = "white", pad = 40, radius = 48, width, style, children }) => {
  const k = tones[tone];
  return (
    <div
      style={{
        background: k.face,
        color: k.text,
        border: `5px solid ${k.edge}`,
        boxShadow: `0 12px 0 ${k.lip}`,
        borderRadius: radius,
        padding: pad,
        width,
        boxSizing: "border-box",
        fontFamily: F.display,
        fontWeight: 600,
        fontSize: 64,
        lineHeight: 1.15,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Balão de fala. `tail` diz de que lado sai a ponta. */
export const Bubble: React.FC<PlateProps & { tail?: "left" | "right" | "none" }> = ({ tail = "left", tone = "white", children, ...rest }) => {
  const k = tones[tone];
  return (
    <div style={{ position: "relative" }}>
      <Plate tone={tone} radius={56} pad="34px 44px" {...rest}>
        {children}
      </Plate>
      {tail !== "none" && (
        <svg width={70} height={64} viewBox="0 0 70 64" style={{ position: "absolute", bottom: -52, [tail]: 70 } as React.CSSProperties}>
          <path d={tail === "left" ? "M4 2 L10 58 L62 2" : "M66 2 L60 58 L8 2"} fill={k.face} stroke={k.edge} strokeWidth={5} strokeLinejoin="round" />
          <path d="M0 0 H70" stroke={k.face} strokeWidth={10} />
        </svg>
      )}
    </div>
  );
};

/** Título grande. `<b>` dentro dele pinta a palavra com a cor de destaque. */
export const Big: React.FC<{ size?: number; color?: string; accent?: string; align?: "left" | "center"; width?: number; children: React.ReactNode }> = ({
  size = 110,
  color = C.ink,
  accent = C.indigo,
  align = "center",
  width = 900,
  children,
}) => (
  <div
    className="big"
    style={
      {
        fontFamily: F.display,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1.02,
        letterSpacing: -1,
        color,
        textAlign: align,
        width,
        "--accent": accent,
      } as React.CSSProperties
    }
  >
    <style>{`.big b{color:var(--accent);font-weight:700}`}</style>
    {children}
  </div>
);

/** Etiqueta pequena em pílula: rótulo de objeto, número de passo, categoria. */
export const Chip: React.FC<{ tone?: Tone; size?: number; children: React.ReactNode }> = ({ tone = "ink", size = 40, children }) => {
  const k = tones[tone];
  return (
    <div
      style={{
        display: "inline-block",
        background: tone === "ink" ? C.ink : k.edge,
        color: tone === "gold" ? C.ink : C.white,
        fontFamily: F.display,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: 2,
        textTransform: "uppercase",
        padding: `${size * 0.28}px ${size * 0.7}px`,
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
};

/** Carimbo torto que bate na tela: "ORDEM", "ERRADO", "NATURAL". */
export const Stamp: React.FC<{ at: number; tone?: "red" | "mint" | "gold"; rotate?: number; size?: number; children: React.ReactNode }> = ({
  at,
  tone = "red",
  rotate = -9,
  size = 92,
  children,
}) => {
  const s = useSpring(at);
  const k = tones[tone];
  return (
    <div
      style={{
        opacity: Math.min(1, s * 2),
        transform: `rotate(${rotate}deg) scale(${2.2 - 1.2 * s})`,
        border: `10px solid ${k.edge}`,
        color: k.edge,
        background: k.face,
        borderRadius: 28,
        padding: "8px 36px",
        fontFamily: F.display,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: 4,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
};

/** Bolinha de certo ou errado. O glifo é obrigatório: cor sozinha não basta. */
export const Mark: React.FC<{ ok: boolean; size?: number }> = ({ ok, size = 120 }) => (
  <svg width={size} height={size} viewBox="0 0 120 120">
    <circle cx={60} cy={66} r={52} fill={ok ? C.mintLip : C.redLip} />
    <circle cx={60} cy={56} r={52} fill={ok ? C.mint : C.red} />
    <path
      d={ok ? "M36 58 L53 75 L86 40" : "M40 36 L80 76 M80 36 L40 76"}
      stroke={C.white}
      strokeWidth={13}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

/**
 * Medidor com ponteiro: vai de `from` a `to` (0 a 1) a partir de `at`.
 * Serve para tom (grosso ↔ educado), nível, confiança, tempo.
 */
export const Meter: React.FC<{ at: number; from?: number; to: number; left: string; right: string; width?: number }> = ({
  at,
  from = 0.5,
  to,
  left,
  right,
  width = 820,
}) => {
  const s = useSpring(at);
  const v = from + (to - from) * s;
  return (
    <div style={{ width, fontFamily: F.display, fontWeight: 700, fontSize: 44, color: C.ink }}>
      <div style={{ position: "relative", height: 56, borderRadius: 999, border: `5px solid ${C.ink}`, background: `linear-gradient(90deg, ${C.red}, ${C.gold} 50%, ${C.mint})` }}>
        <div
          style={{
            position: "absolute",
            left: `calc(${v * 100}% - 22px)`,
            top: -26,
            width: 44,
            height: 108,
            borderRadius: 22,
            background: C.white,
            border: `6px solid ${C.ink}`,
            boxSizing: "border-box",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 34, textTransform: "uppercase", letterSpacing: 2 }}>
        <span style={{ color: C.redLip }}>{left}</span>
        <span style={{ color: C.mintLip }}>{right}</span>
      </div>
    </div>
  );
};

/** Celular com uma captura real do app (arquivo em `public/` do espaço de trabalho, ex.: img/tela.jpg). */
export const Phone: React.FC<{ src: string; width?: number; tilt?: number }> = ({ src, width = 460, tilt = 0 }) => (
  <div
    style={{
      width,
      borderRadius: width * 0.14,
      border: `14px solid ${C.ink}`,
      boxShadow: `0 18px 0 rgba(30,27,75,0.25)`,
      overflow: "hidden",
      background: C.cream,
      transform: `rotate(${tilt}deg)`,
      lineHeight: 0,
    }}
  >
    <Img src={staticFile(src)} style={{ width: "100%" }} />
  </div>
);

/** Onda de voz animada: alguém está falando ou o app está ouvindo. */
export const Wave: React.FC<{ color?: string; bars?: number; height?: number }> = ({ color = C.teal, bars = 9, height = 120 }) => {
  const t = useT();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, height }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} style={{ width: 18, borderRadius: 9, background: color, height: height * (0.25 + 0.75 * Math.abs(Math.sin(t * 7 + i * 0.9))) }} />
      ))}
    </div>
  );
};

/** Tela final com a marca e a chamada (lidas de `brand`). Feche todo episódio com ela. */
export const EndCard: React.FC<{ line?: React.ReactNode; cta?: string }> = ({ line, cta }) => {
  const brand = useBrand();
  const a = useSpring(0.05);
  const b = useSpring(0.5);
  const c = useSpring(1.1);
  const t = useT();
  const text = line ?? (brand.tagline ? renderTagline(brand.tagline) : null);
  const label = cta ?? brand.cta;
  return (
    <AbsoluteFill>
      <Bg color={C.indigo} />
      <div style={{ position: "absolute", top: 330, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 46 }}>
        {brand.logo && <Img src={staticFile(brand.logo)} style={{ width: 330, transform: `scale(${a}) translateY(${Math.sin(t * 2.6) * 8}px)` }} />}
        <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 150, color: C.white, letterSpacing: -3, transform: `scale(${a})` }}>{brand.name}</div>
        {text && (
          <div style={{ opacity: b, transform: `translateY(${(1 - b) * 60}px)` }}>
            <Big color={C.white} accent={C.gold} size={84} width={860}>
              {text}
            </Big>
          </div>
        )}
        {label && (
          <div style={{ transform: `scale(${c * (1 + Math.sin(t * 5) * 0.03)})`, marginTop: 20 }}>
            <Plate tone="gold" radius={999} pad="30px 70px" style={{ fontSize: 72, fontWeight: 700, color: C.ink, background: C.gold }}>
              {label} ↗
            </Plate>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/** Rótulo das referências: pílula branca com um ponto colorido. Prenda a um objeto com `Anchor`. */
export const Pin: React.FC<{ dot?: string; size?: number; children: React.ReactNode }> = ({ dot = C.red, size = 38, children }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: size * 0.32,
      background: C.white,
      color: C.ink,
      border: `4px solid ${C.ink}`,
      borderRadius: 999,
      padding: `${size * 0.2}px ${size * 0.6}px`,
      fontFamily: F.display,
      fontWeight: 700,
      fontSize: size,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      whiteSpace: "nowrap",
      boxShadow: "0 6px 0 rgba(0,0,0,0.3)",
    }}
  >
    <span style={{ width: size * 0.42, height: size * 0.42, borderRadius: size, background: dot, flexShrink: 0 }} />
    {children}
  </div>
);

/** Selo de certo ou errado que bate no canto de cima, como nas referências. */
export const Verdict: React.FC<{ ok: boolean; at: number; size?: number }> = ({ ok, at, size = 170 }) => {
  const s = useSpring(at);
  return (
    <div style={{ position: "absolute", left: 70, top: 230, opacity: Math.min(1, s * 2), transform: `scale(${2 - s}) rotate(${(1 - s) * -25}deg)` }}>
      <Mark ok={ok} size={size} />
    </div>
  );
};
