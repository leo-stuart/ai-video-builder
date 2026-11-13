import React from "react";
import { Block, Cam, CupToGo, Cyl, PhoneToy, Robot, RobotMood, V3 } from "./three";
import { C } from "./theme";
import { BrickWall, Building, Guy, GuyProps, Ice, Lamp, Plant, Road, Sign, Taxi, World } from "./world";

/**
 * CENÁRIOS PRONTOS. Cada um já tem os bonecos nos lugares certos e uma lista
 * de câmeras testadas (`SHOT`). Um episódio novo escolhe cenário e câmera;
 * não precisa posicionar nada à mão.
 */

/* ───────────────────────────── elenco ───────────────────────────── */

/** "Você": camiseta dourada, mochila vermelha. É o mesmo em todo episódio. */
export const VOCE: GuyProps = { shirt: C.gold, pants: "#2F3A8F", hair: "#2A1B14", backpack: C.red };

/** Quem está atrás de "você" na fila, na ordem em que chegam. */
const QUEUE: GuyProps[] = [
  { shirt: C.teal, hair: "#111", mood: "angry", armR: 30 },
  { shirt: C.lilac, skin: "#B9794F", hair: "#111", hat: "beanie", hatColor: C.red, mood: "angry", headTurn: -25 },
  { shirt: C.red, hair: "#C9A227", mood: "sad", outL: 30, outR: 30 },
  { shirt: C.mint, skin: "#8C5A3C", hair: "#111", mood: "angry", armL: 60 },
];

/* ───────────────────────────── balcão ───────────────────────────── */

export type Place = "cafe" | "hotel" | "imigracao" | "loja" | "farmacia" | "aeroporto" | "restaurante";

type Theme = {
  brick?: string;
  wall: string;
  floor: string;
  sign: [string, string];
  counter: string;
  accent: string;
  shelf: "cups" | "boxes" | "none";
  item: "cup" | "card" | "box" | "none";
  itemColor?: string;
  attendant: GuyProps;
};

/** Todo lugar em que alguém atende "você" atrás de um balcão. */
export const PLACES: Record<Place, Theme> = {
  cafe: {
    brick: "#B5533C",
    wall: "#3A2418",
    floor: "#C9A27A",
    sign: ["MENU", "coffee · latte · tea · bagel"],
    counter: "#7A4B2E",
    accent: C.coral,
    shelf: "cups",
    item: "cup",
    attendant: { shirt: C.white, pants: C.ink, hair: "#7A3B1D", skin: "#E8B48C", apron: C.coral, hat: "cap", hatColor: C.coral },
  },
  restaurante: {
    brick: "#7E3B32",
    wall: "#2B1A18",
    floor: "#B98C64",
    sign: ["RESTAURANT", "today's special · steak"],
    counter: "#4A2E22",
    accent: C.gold,
    shelf: "none",
    item: "card",
    itemColor: "#1B1840",
    attendant: { shirt: C.white, pants: C.ink, hair: "#1B1B1B", skin: "#C98F68", apron: C.ink },
  },
  hotel: {
    wall: "#2F4A6B",
    floor: "#B98C64",
    sign: ["RECEPTION", "check-in · check-out"],
    counter: "#5B3A29",
    accent: C.gold,
    shelf: "none",
    item: "card",
    itemColor: C.gold,
    attendant: { shirt: "#1F2A44", pants: "#1F2A44", hair: "#3B2A20", skin: "#F0C7A4" },
  },
  imigracao: {
    wall: "#DCE3EA",
    floor: "#9AA5B1",
    sign: ["IMMIGRATION", "passport control"],
    counter: "#3D4B5C",
    accent: C.indigo,
    shelf: "none",
    item: "card",
    itemColor: "#8C1D2C",
    attendant: { shirt: "#1D3557", pants: "#14213D", hair: "#222", skin: "#B9794F", hat: "cap", hatColor: "#14213D" },
  },
  aeroporto: {
    wall: "#E8EEF5",
    floor: "#A9B4C2",
    sign: ["CHECK-IN", "gate A12 · boarding 10:40"],
    counter: "#4C5C70",
    accent: C.sky,
    shelf: "none",
    item: "card",
    itemColor: C.white,
    attendant: { shirt: "#B22234", pants: "#14213D", hair: "#5A3A22", skin: "#F0C7A4" },
  },
  loja: {
    wall: "#F3D9E6",
    floor: "#D9C7B0",
    sign: ["CASHIER", "cash or card"],
    counter: "#E8E0D8",
    accent: C.lilac,
    shelf: "boxes",
    item: "box",
    itemColor: C.lilac,
    attendant: { shirt: C.teal, pants: C.ink, hair: "#C9A227", skin: "#F0C7A4" },
  },
  farmacia: {
    wall: "#E6F5EC",
    floor: "#C7D3CC",
    sign: ["PHARMACY", "prescriptions · pick-up"],
    counter: "#F4F6F5",
    accent: C.mint,
    shelf: "boxes",
    item: "box",
    itemColor: C.white,
    attendant: { shirt: C.white, pants: "#3D4B5C", hair: "#2A1B14", skin: "#8C5A3C" },
  },
};

type CounterProps = {
  cam: Cam;
  place?: Place;
  /** "Você", à esquerda do balcão. Sobrepõe as props padrão. */
  me?: GuyProps;
  /** Quem atende, à direita. */
  other?: GuyProps;
  /** 0 a 1: "você" dentro de um bloco de gelo. */
  ice?: number;
  /** Quantas pessoas na fila atrás de "você" (0 a 4). */
  queue?: number;
  /** 0 a 1: o objeto do balcão desliza até "você". */
  itemOut?: number;
  /** Objetos three.js a mais (por exemplo `<Burst … />`). */
  world?: React.ReactNode;
};

/** Onde cada um fica no balcão. Use em `Anchor` para colar um rótulo sobre a cabeça. */
export const COUNTER = {
  me: [-0.8, 0, 0.3] as V3,
  other: [1.25, 0, 0.1] as V3,
  overMe: [-0.8, 2.45, 0.3] as V3,
  overOther: [1.25, 2.45, 0.1] as V3,
  overQueue: [-3.5, 2.6, 0.2] as V3,
  item: [0.35, 1.6, 0.4] as V3,
};

/**
 * Balcão com atendente: cafeteria, hotel, imigração, check-in, loja,
 * farmácia, restaurante. Troque `place` e o resto muda junto.
 */
export const Counter: React.FC<CounterProps> = ({ cam, place = "cafe", me = {}, other = {}, ice = 0, queue = 0, itemOut = 0, world }) => {
  const T = PLACES[place];
  return (
    <World cam={cam} sky={T.wall} floor={T.floor} light="indoor">
      {T.brick ? (
        <BrickWall pos={[0, 0, -2.6]} size={[18, 5, 0.3]} color={T.brick} />
      ) : (
        <>
          <Block size={[18, 5, 0.3]} pos={[0, 2.5, -2.6]} color={T.wall} r={0.02} />
          <Block size={[18, 0.9, 0.34]} pos={[0, 0.45, -2.58]} color={T.accent} r={0.02} />
        </>
      )}
      <Sign text={T.sign[0]} sub={T.sign[1]} pos={[1.0, 3.0, -2.4]} w={2.3} h={1.2} bg="#1B1840" color={C.white} />
      {T.shelf !== "none" && <Block size={[2.4, 0.08, 0.4]} pos={[-2.3, 2.5, -2.3]} color={T.counter} r={0.02} />}
      {T.shelf === "cups" && [-3.0, -2.5, -2.0, -1.6].map((x, i) => <CupToGo key={x} pos={[x, 2.54, -2.3]} scale={1.1 + (i % 2) * 0.2} />)}
      {T.shelf === "boxes" &&
        [-3.1, -2.7, -2.3, -1.9, -1.5].map((x, i) => (
          <Block key={x} size={[0.3, 0.3 + (i % 3) * 0.12, 0.26]} pos={[x, 2.69 + (i % 3) * 0.06, -2.3]} color={[C.coral, C.mint, C.gold, C.lilac, C.sky][i]} r={0.03} />
        ))}
      {[-1.6, 0.4, 2.4].map((x) => (
        <group key={x} position={[x, 0, -0.6]}>
          <Cyl size={[0.015, 1.4]} pos={[0, 4.4, 0]} color={C.ink} />
          <Cyl size={[0.3, 0.3]} top={0.1} pos={[0, 3.6, 0]} color={T.accent} rough={0.35} />
          <pointLight position={[0, 3.3, 0]} intensity={5} color="#FFD9A0" distance={7} />
        </group>
      ))}
      <Block size={[0.85, 1.05, 2.6]} pos={[0.35, 0.525, -0.3]} color={T.counter} r={0.05} />
      <Block size={[1.0, 0.08, 2.75]} pos={[0.35, 1.09, -0.3]} color="#F6E7D3" r={0.03} rough={0.35} />
      <Block size={[0.36, 0.3, 0.34]} pos={[0.35, 1.28, -1.1]} color={C.ink} r={0.04} />
      <Block size={[0.3, 0.2, 0.02]} pos={[0.17, 1.32, -1.1]} rot={[0, -Math.PI / 2, 0]} color={C.sky} glow={0.5} r={0.008} />
      {T.item === "cup" && <CupToGo pos={[0.35 - itemOut * 0.3, 1.13, 0.35]} scale={1.3} />}
      {T.item === "card" && <Block size={[0.2, 0.03, 0.3]} pos={[0.35 - itemOut * 0.3, 1.15, 0.35]} color={T.itemColor} r={0.012} rough={0.4} />}
      {T.item === "box" && <Block size={[0.3, 0.26, 0.3]} pos={[0.35 - itemOut * 0.3, 1.26, 0.35]} color={T.itemColor} r={0.04} rough={0.5} />}
      <Plant pos={[-4.6, 0, -1.9]} scale={1.5} />
      <Guy pos={COUNTER.me} turn={65} {...VOCE} {...me} frozen={ice > 0.5} />
      <Ice pos={COUNTER.me} k={ice} />
      <Guy pos={COUNTER.other} turn={-65} {...T.attendant} {...other} />
      {QUEUE.slice(0, Math.max(0, Math.min(4, Math.floor(queue)))).map((q, i) => (
        <Guy key={i} pos={[-2.0 - i * 1.05, 0, i % 2 ? 0.35 : 0.15]} turn={78} {...q} />
      ))}
      {world}
    </World>
  );
};

/* ───────────────────────────── rua ───────────────────────────── */

const NIGHT = "linear-gradient(#0E1033 0%, #2A2A6E 55%, #5B4B9A 100%)";
const DAY = "linear-gradient(#7CC8FF 0%, #CDEBFF 60%, #FFE9D2 100%)";

/** Onde "você" fica na calçada, em frente à porta. A calçada tem 0,16 de altura. */
export const STREET = {
  me: [-1.3, 0.16, -0.6] as V3,
  overMe: [-1.3, 2.6, -0.6] as V3,
  /** Barriga, para um rótulo de "ronc". */
  belly: [-1.3, 1.25, -0.4] as V3,
};

type StreetProps = {
  cam: Cam;
  /** Letreiro da fachada: "COFFEE SHOP", "HOTEL", "PHARMACY"… */
  sign?: string;
  night?: boolean;
  /** Posição do táxi na rua (eixo x). Anime com `t` para ele passar. */
  taxiX?: number;
  /** "Você" na calçada. `null` tira o boneco (para você pôr um com `pos` animado em `world`). */
  me?: GuyProps | null;
  world?: React.ReactNode;
};

/** Rua de cidade grande: prédios, fachada de tijolo com letreiro, poste, táxi. */
export const Street: React.FC<StreetProps> = ({ cam, sign = "COFFEE SHOP", night = true, taxiX = -20, me = {}, world }) => (
  <World cam={cam} sky={night ? NIGHT : DAY} floor={night ? "#4A4A68" : "#B9B6C6"} light={night ? "night" : "day"} moon={night}>
    <Building pos={[-6.2, 0, -5]} size={[3.4, 11, 3]} color="#2E3168" seed={3} lit={night ? 0.55 : 0.1} />
    <Building pos={[-2.8, 0, -6]} size={[3, 15, 3]} color="#3A2F6B" seed={5} lit={night ? 0.5 : 0.1} />
    <Building pos={[5.4, 0, -5.5]} size={[3.6, 13, 3]} color="#263A6E" seed={9} lit={night ? 0.6 : 0.1} />
    <Building pos={[9, 0, -6]} size={[3, 9, 3]} color="#3A2F6B" seed={11} lit={night ? 0.5 : 0.1} />
    <BrickWall pos={[1.2, 0, -2.6]} size={[5.2, 4.2, 0.4]} />
    <Block size={[5.5, 0.35, 0.9]} pos={[1.2, 4.3, -2.4]} color={C.coral} r={0.06} />
    <Sign text={sign} pos={[1.2, 3.35, -2.36]} w={3.6} h={0.72} bg="#1B1840" color="#FFE28A" />
    <Block size={[1.2, 2.3, 0.1]} pos={[0.3, 1.15, -2.38]} color="#FFE7A8" glow={night ? 0.9 : 0.1} r={0.04} />
    <Block size={[1.9, 1.5, 0.1]} pos={[2.5, 1.65, -2.38]} color="#FFE7A8" glow={night ? 0.8 : 0.1} r={0.04} />
    <Block size={[30, 0.16, 2.6]} pos={[0, 0.08, -1.2]} color={night ? "#77778F" : "#D8D5E2"} r={0.03} />
    <Road z={2.2} width={4.2} />
    <Lamp pos={[-2.2, 0.16, -0.3]} />
    <Taxi pos={[taxiX, 0.012, 2.6]} />
    {me && <Guy pos={STREET.me} turn={15} {...VOCE} {...me} />}
    {world}
  </World>
);

/* ───────────────────────────── casa ───────────────────────────── */

export const HOME = {
  me: [-0.65, 0, 0.3] as V3,
  bot: [0.75, 1.75, 0.45] as V3,
  overMe: [-0.65, 2.45, 0.3] as V3,
  overBot: [0.75, 2.35, 0.45] as V3,
  /** Centro do tapete, na frente: bom lugar para objetos de metáfora. */
  front: [0, 0, 1.9] as V3,
};

type HomeProps = {
  cam: Cam;
  me?: GuyProps;
  /** O tutor de IA. `scale` de 0 a 1 faz ele sair do celular. */
  bot?: { mood?: RobotMood; talking?: boolean; tilt?: number; scale?: number };
  world?: React.ReactNode;
};

/** A sala de noite: sofá, janela com lua, abajur, celular na mão e o tutor ao lado. */
export const Home: React.FC<HomeProps> = ({ cam, me = {}, bot = {}, world }) => (
  <World cam={cam} sky="#1B1840" floor="#4A4291" light="night">
    <Block size={[18, 5.5, 0.3]} pos={[0, 2.75, -2.6]} color="#3B3585" r={0.02} />
    <Block size={[18, 0.3, 0.34]} pos={[0, 0.15, -2.56]} color="#2A2566" r={0.02} />
    <Block size={[1.9, 2.0, 0.1]} pos={[-1.5, 2.7, -2.42]} color="#101235" r={0.05} />
    <Block size={[0.06, 2.0, 0.12]} pos={[-1.5, 2.7, -2.4]} color="#E9E4FF" r={0.01} />
    <Block size={[1.9, 0.06, 0.12]} pos={[-1.5, 2.7, -2.4]} color="#E9E4FF" r={0.01} />
    <Cyl size={[0.22, 0.02]} pos={[-1.05, 3.2, -2.36]} rot={[Math.PI / 2, 0, 0]} color="#FFF1CC" glow={1} />
    <Block size={[2.8, 0.55, 1.05]} pos={[-0.2, 0.32, -1.6]} color={C.lilac} r={0.16} />
    <Block size={[2.8, 1.15, 0.34]} pos={[-0.2, 0.68, -2.1]} color={C.lilacLip} r={0.16} />
    {[-1.55, 1.15].map((x) => (
      <Block key={x} size={[0.34, 0.85, 1.05]} pos={[x, 0.48, -1.6]} color={C.lilacLip} r={0.14} />
    ))}
    <Block size={[3.6, 0.03, 2.4]} pos={[0, 0.016, 0.3]} color="#6C63D9" r={0.01} shadow={false} />
    <Cyl size={[0.05, 2.0]} pos={[2.2, 1.0, -1.8]} color={C.ink} />
    <Cyl size={[0.4, 0.46]} top={0.2} pos={[2.2, 2.15, -1.8]} color={C.gold} glow={0.5} />
    <pointLight position={[2.2, 2.0, -1.4]} intensity={14} color="#FFD27A" distance={9} />
    <pointLight position={[0, 2.4, 2.5]} intensity={8} color="#B9B4FF" distance={9} />
    <Plant pos={[-2.6, 0, -1.7]} scale={1.4} />
    <Guy pos={HOME.me} turn={40} armR={80} {...VOCE} backpack={undefined} {...me} />
    <PhoneToy pos={[-0.18, 1.12, 0.8]} rot={[-0.25, -0.5, 0]} scale={0.5} screen={C.indigo} />
    <Robot pos={HOME.bot} turn={-34} scale={0.8 * Math.max(0.001, bot.scale ?? 1)} mood={bot.mood} talking={bot.talking} tilt={bot.tilt} />
    {world}
  </World>
);

/* ───────────────────────────── escola ───────────────────────────── */

type SchoolProps = { cam: Cam; sign?: string; world?: React.ReactNode };

/** Fachada do curso, de dia. Ponha o boneco em `world`: ele sai pela porta em z de -1 a 0,7. */
export const School: React.FC<SchoolProps> = ({ cam, sign = "ENGLISH COURSE", world }) => (
  <World cam={cam} sky={DAY} floor="#BFD9A8" light="day">
    <Block size={[7, 4.6, 3]} pos={[0, 2.3, -3]} color="#F4E3C8" r={0.05} />
    <Block size={[7.3, 0.4, 3.3]} pos={[0, 4.75, -3]} color={C.coral} r={0.08} />
    <Sign text={sign} pos={[0, 3.6, -1.45]} w={4.2} h={0.8} bg={C.indigo} color={C.white} />
    <Block size={[1.3, 2.4, 0.12]} pos={[0, 1.2, -1.46]} color="#7A4B2E" r={0.04} />
    <Block size={[0.1, 0.1, 0.1]} pos={[0.45, 1.2, -1.38]} color={C.gold} r={0.05} rough={0.3} />
    {[-2.3, 2.3].map((x) => (
      <Block key={x} size={[1.3, 1.3, 0.1]} pos={[x, 2.0, -1.47]} color="#9ED7FF" r={0.04} rough={0.15} />
    ))}
    <Block size={[2.6, 0.02, 3]} pos={[0, 0.012, 0.1]} color="#E7D8C3" r={0.005} shadow={false} />
    <Plant pos={[-1.5, 0, -1.1]} scale={1.2} />
    <Plant pos={[1.5, 0, -1.1]} scale={1.2} />
    {world}
  </World>
);

/* ───────────────────────────── estúdio ───────────────────────────── */

const TONES = {
  indigo: ["linear-gradient(#2B2A7A, #4F46E5)", "#3730A3"],
  noite: ["linear-gradient(#0E1033, #2A2A6E)", "#1D1A40"],
  menta: ["linear-gradient(#0E9F74, #19C99A)", "#0E9F74"],
  coral: ["linear-gradient(#E0603F, #FF7A59)", "#E0603F"],
} as const;

/** Fundo liso de cor, sem cenário: palco para metáfora (balança, pilha, gelo) e para o pitch. */
export const Studio: React.FC<{ cam: Cam; tone?: keyof typeof TONES; children?: React.ReactNode }> = ({ cam, tone = "indigo", children }) => (
  <World cam={cam} sky={TONES[tone][0]} floor={TONES[tone][1]} light="indoor">
    {children}
  </World>
);

/* ───────────────────────────── câmeras ───────────────────────────── */

/**
 * Câmeras testadas de cada cenário. Use em `useShots`:
 *   const cam = useShots([{ at: 0, from: SHOT.counter.wide }, { at: cue("go"), from: SHOT.counter.onOther }]);
 * Sem `to`, a câmera se aproxima sozinha 10% durante o plano.
 */
export const SHOT = {
  counter: {
    /** Os dois e o balcão, de frente. */
    wide: { pos: [0.2, 2.6, 10.8], look: [0.2, 0.9, 0] } as Cam,
    /** Quem atende, visto por cima do ombro de "você". */
    onOther: { pos: [-0.9, 1.95, 3.4], look: [1.25, 1.55, 0.1] } as Cam,
    /** "Você", visto do lado de quem atende. */
    onMe: { pos: [1.3, 1.9, 3.6], look: [-0.8, 1.5, 0.3] } as Cam,
    /** "Você" de baixo, de corpo inteiro: bom para o bloco de gelo. */
    lowMe: { pos: [-0.2, 1.1, 6.2], look: [-0.5, 1.2, 0] } as Cam,
    /** A fila, do alto. Combine `from: queue, to: queueFar` para abrir o plano. */
    queue: { pos: [-1.4, 3.6, 11], look: [-1.6, 0.9, 0] } as Cam,
    queueFar: { pos: [-2.6, 4.4, 14.5], look: [-2.2, 0.8, 0] } as Cam,
  },
  street: {
    /** De baixo, mostrando os prédios e o letreiro. */
    establish: { pos: [-3.5, 1.0, 11], look: [0.5, 3.4, -2] } as Cam,
    /** "Você" na calçada. */
    onMe: { pos: [-0.2, 1.7, 4.4], look: [-1.3, 1.35, -0.6] } as Cam,
    /** Calçada e porta, de lado. */
    door: { pos: [-2.4, 1.3, 7.6], look: [-0.6, 1.7, -1] } as Cam,
    /** Acompanha alguém andando pela calçada, da esquerda para a porta. */
    walk: { pos: [-3.0, 1.2, 9.2], look: [0.5, 2.4, -1.5] } as Cam,
  },
  home: {
    wide: { pos: [0.1, 2.5, 9.6], look: [0.1, 0.95, 0] } as Cam,
    onBot: { pos: [-0.4, 1.9, 4.0], look: [0.72, 1.72, 0.45] } as Cam,
    onMe: { pos: [1.0, 1.9, 4.0], look: [-0.6, 1.5, 0.3] } as Cam,
    /** Os dois, mais perto que `wide`: comemoração. */
    both: { pos: [0.1, 2.2, 8.2], look: [0.1, 1.1, 0] } as Cam,
    /** Do alto, olhando o tapete da frente (`HOME.front`). */
    floor: { pos: [0, 3.2, 8.4], look: [0, 0.5, 0.6] } as Cam,
  },
  school: {
    establish: { pos: [-1.2, 1.2, 9.5], look: [0, 2.2, -1] } as Cam,
    /** Quem acabou de sair pela porta (boneco em z = 0,7). */
    onMe: { pos: [1.4, 1.7, 4.6], look: [0, 1.35, 0.6] } as Cam,
  },
  studio: {
    /** Objeto no centro (x = 0), de frente. */
    wide: { pos: [0, 2.2, 11.5], look: [0, 0.95, 0] } as Cam,
    /** O mesmo objeto, de três quartos. */
    side: { pos: [-2.6, 1.9, 10.4], look: [0.1, 1.0, 0] } as Cam,
    /** Um boneco no centro falando com a câmera. */
    close: { pos: [0.3, 1.9, 6.4], look: [0, 1.35, 0] } as Cam,
    /** O boneco na metade de baixo; a de cima fica livre para cartões e opções. */
    low: { pos: [0.2, 1.6, 8.2], look: [0, 2.1, 0] } as Cam,
  },
};
