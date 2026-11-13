import React from "react";
import { useT } from "./anim";

const INK = "#121318";
const CREAM = "#F3EEDC";
const SCREEN = "#0B0C10";
const EYE = "#E3F2FB";

export type PragMood = "neutral" | "happy" | "sad" | "surprised" | "stern" | "wink";

const Eye: React.FC<{ cx: number; mood: PragMood; blink: number; right?: boolean }> = ({ cx, mood, blink, right }) => {
  const cy = 206;
  const arc = (up: boolean) => (
    <path
      d={`M${cx - 24} ${cy + (up ? 12 : -8)} Q${cx} ${cy + (up ? -26 : 22)} ${cx + 24} ${cy + (up ? 12 : -8)}`}
      stroke={EYE}
      strokeWidth={15}
      strokeLinecap="round"
      fill="none"
    />
  );
  if (mood === "happy") return arc(true);
  if (mood === "wink" && right) return arc(true);
  if (mood === "sad") {
    return (
      <g>
        <rect x={cx - 17} y={cy - 14} width={34} height={44} rx={17} fill={EYE} />
        <polygon
          points={right ? `${cx - 30},${cy - 20} ${cx + 30},${cy - 34} ${cx + 30},${cy + 4}` : `${cx - 30},${cy - 34} ${cx + 30},${cy - 20} ${cx - 30},${cy + 4}`}
          fill={SCREEN}
        />
      </g>
    );
  }
  if (mood === "surprised") return <circle cx={cx} cy={cy} r={27} fill={EYE} />;
  if (mood === "stern") {
    return (
      <g>
        <rect x={cx - 17} y={cy - 30} width={34} height={60} rx={17} fill={EYE} />
        <polygon
          points={right ? `${cx - 30},${cy - 2} ${cx + 30},${cy - 34} ${cx - 30},${cy - 40}` : `${cx - 30},${cy - 34} ${cx + 30},${cy - 2} ${cx + 30},${cy - 40}`}
          fill={SCREEN}
        />
      </g>
    );
  }
  const h = 60 * blink;
  return <rect x={cx - 17} y={cy - h / 2} width={34} height={Math.max(h, 6)} rx={Math.min(17, Math.max(h, 6) / 2)} fill={EYE} />;
};

/**
 * Prag, o mascote do Pragma: o rosto do logo (balão de fala com tela e
 * orelhas azuis). Flutua e pisca sozinho; `talking` abre a boca no ritmo.
 */
export const Prag: React.FC<{ size?: number; mood?: PragMood; talking?: boolean; tilt?: number }> = ({
  size = 420,
  mood = "neutral",
  talking = false,
  tilt = 0,
}) => {
  const t = useT();
  const cycle = t % 3.1;
  const blink = cycle > 2.9 ? Math.abs(cycle - 3.0) / 0.1 : 1;
  const bob = Math.sin(t * 2.6) * 6;
  const mouth = talking ? 8 + Math.abs(Math.sin(t * 14)) * 22 : 0;
  return (
    <svg width={size} height={(size * 440) / 512} viewBox="0 0 512 440" style={{ transform: `translateY(${bob}px) rotate(${tilt}deg)`, overflow: "visible" }}>
      {[62, 450].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy={215} rx={36} ry={64} fill="#3D7CC9" stroke={INK} strokeWidth={14} />
          <ellipse cx={cx} cy={215} rx={13} ry={34} fill="#6FA3E3" stroke={INK} strokeWidth={8} />
        </g>
      ))}
      <path
        d="M170 68 H342 A95 95 0 0 1 437 163 V258 A95 95 0 0 1 342 353 H218 L128 410 L140 346 A95 95 0 0 1 75 258 V163 A95 95 0 0 1 170 68 Z"
        fill={CREAM}
        stroke={INK}
        strokeWidth={16}
        strokeLinejoin="round"
      />
      <rect x={112} y={100} width={288} height={212} rx={72} fill={SCREEN} />
      <path d="M148 152 Q156 126 190 120" stroke="#4A4B52" strokeWidth={11} strokeLinecap="round" fill="none" />
      <Eye cx={208} mood={mood} blink={blink} />
      <Eye cx={304} mood={mood} blink={blink} right />
      {talking && <rect x={256 - 20} y={262 - mouth / 2} width={40} height={mouth} rx={Math.min(12, mouth / 2)} fill={EYE} />}
    </svg>
  );
};
