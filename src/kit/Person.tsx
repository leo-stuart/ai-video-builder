import React from "react";
import { useT } from "./anim";
import { C } from "./theme";

export type PersonMood = "smile" | "flat" | "frown" | "open" | "grin";

type Props = {
  size?: number;
  /** Cor do boné, da gravata ou do avental. */
  color?: string;
  mood?: PersonMood;
  accessory?: "cap" | "bowtie" | "none";
  /** Ângulo de cada braço em graus: 0 pendurado, 90 na horizontal, 160 para cima. */
  armL?: number;
  armR?: number;
  talking?: boolean;
  sweat?: boolean;
  /** Olha para a esquerda (-1) ou direita (1). */
  look?: -1 | 0 | 1;
  flip?: boolean;
  /** Cor do traço. Em fundo escuro use C.white. */
  line?: string;
};


/** Boneco de palito do canal: cabeça redonda, traço grosso, um acessório. */
export const Person: React.FC<Props> = ({
  size = 420,
  color = C.gold,
  mood = "smile",
  accessory = "cap",
  armL = 12,
  armR = 12,
  talking = false,
  sweat = false,
  look = 0,
  flip = false,
  line = C.ink,
}) => {
  const INK = line;
  const t = useT();
  const breathe = Math.sin(t * 2.2) * 2;
  const shoulder = { x: 100, y: 168 };
  const arm = (deg: number, side: -1 | 1) => {
    const r = (deg * Math.PI) / 180;
    return { x: shoulder.x + side * Math.sin(r) * 92, y: shoulder.y + Math.cos(r) * 92 };
  };
  const l = arm(armL, -1);
  const r = arm(armR, 1);
  const ex = look * 7;
  const open = talking ? 6 + Math.abs(Math.sin(t * 13)) * 12 : 0;
  const mouth = () => {
    if (talking) return <ellipse cx={100 + ex} cy={92} rx={11} ry={open} fill={C.ink} />;
    switch (mood) {
      case "smile":
        return <path d={`M${84 + ex} 88 Q${100 + ex} 104 ${116 + ex} 88`} />;
      case "grin":
        return <path d={`M${80 + ex} 84 Q${100 + ex} 112 ${120 + ex} 84 Z`} fill={INK} />;
      case "frown":
        return <path d={`M${84 + ex} 98 Q${100 + ex} 84 ${116 + ex} 98`} />;
      case "open":
        return <ellipse cx={100 + ex} cy={94} rx={10} ry={13} fill={C.ink} />;
      default:
        return <path d={`M${86 + ex} 93 H${114 + ex}`} />;
    }
  };
  return (
    <svg
      width={(size * 200) / 420}
      height={size}
      viewBox="0 0 200 420"
      style={{ overflow: "visible", transform: flip ? "scaleX(-1)" : undefined }}
      fill="none"
      stroke={INK}
      strokeWidth={9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx={100} cy={408} rx={70} ry={10} fill="rgba(30,27,75,0.12)" stroke="none" />
      <path d={`M100 ${122 + breathe} V270 M100 270 L66 400 M100 270 L134 400`} />
      <path d={`M${shoulder.x} ${shoulder.y} L${l.x} ${l.y} M${shoulder.x} ${shoulder.y} L${r.x} ${r.y}`} />
      <circle cx={100} cy={70 + breathe} r={50} fill={C.white} stroke={C.ink} />
      <g transform={`translate(0 ${breathe})`}>
        {accessory === "cap" && (
          <g>
            <path d="M52 56 A50 50 0 0 1 148 56 Z" fill={color} stroke={C.ink} />
            <path d="M148 56 H184" strokeWidth={13} stroke={color} />
          </g>
        )}
        {accessory === "bowtie" && <path d="M100 126 L76 112 V140 Z M100 126 L124 112 V140 Z" fill={color} strokeWidth={6} stroke={C.ink} />}
        <g stroke="none" fill={C.ink}>
          <circle cx={82 + ex} cy={70} r={6} />
          <circle cx={118 + ex} cy={70} r={6} />
        </g>
        {(mood === "frown" || mood === "flat") && !talking && (
          <path d={mood === "frown" ? `M72 54 L92 60 M128 54 L108 60` : ""} strokeWidth={6} stroke={C.ink} />
        )}
        <g strokeWidth={7} stroke={C.ink}>{mouth()}</g>
        {sweat && (
          <path
            d="M160 40 Q172 62 160 70 Q148 62 160 40 Z"
            fill={C.sky}
            strokeWidth={5}
            transform={`translate(0 ${((t * 40) % 30) - 6})`}
          />
        )}
      </g>
    </svg>
  );
};
