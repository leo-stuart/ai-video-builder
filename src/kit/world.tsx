import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useScene, useT } from "./anim";
import { Block, Cam, Cyl, FOV, Rig, V3 } from "./three";
import { C, F, H, W } from "./theme";

const rad = (d: number) => (d * Math.PI) / 180;
const DARK = "#17152F";

/* ───────────────────────── câmera com cortes ───────────────────────── */

export type Shot = { at: number; from: Cam; to?: Cam };

/**
 * Vários planos dentro da mesma cena, com corte seco entre eles: é o ritmo
 * das referências (um corte a cada 0,7 a 1,5 s). Cada plano desliza de
 * `from` a `to` até o próximo `at`; sem `to`, aproxima 10% sozinho. Nenhum
 * plano fica mais perto que `minDist` metros (mais perto corta o boneco).
 */
export const useShots = (shots: Shot[], minDist = 5.6): Cam => {
  // Plano fechado demais corta o boneco no quadro vertical: `minDist` afasta a câmera na mesma direção.
  const fit = (c: Cam): Cam => {
    const d = Math.hypot(c.pos[0] - c.look[0], c.pos[1] - c.look[1], c.pos[2] - c.look[2]);
    if (d >= minDist) return c;
    const k = minDist / d;
    return { ...c, pos: [c.look[0] + (c.pos[0] - c.look[0]) * k, c.look[1] + (c.pos[1] - c.look[1]) * k, c.look[2] + (c.pos[2] - c.look[2]) * k] };
  };
  // Sem `to`, a câmera se aproxima 10% durante o plano: nenhum plano fica parado.
  const push = (c: Cam): Cam => ({ ...c, pos: [c.look[0] + (c.pos[0] - c.look[0]) * 0.9, c.look[1] + (c.pos[1] - c.look[1]) * 0.9, c.look[2] + (c.pos[2] - c.look[2]) * 0.9] });
  if (!shots.length) throw new Error("useShots: precisa de pelo menos um plano.");
  shots = shots.map((s) => ({ ...s, from: fit(s.from), to: s.to ? fit(s.to) : push(fit(s.from)) }));
  const t = useT();
  const { dur } = useScene();
  let i = 0;
  shots.forEach((s, j) => {
    if (t >= s.at) i = j;
  });
  const s = shots[i];
  const end = shots[i + 1]?.at ?? Math.max(dur, s.at + 0.5);
  const to = s.to!;
  const k = interpolate(t, [s.at, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const mix = (a: V3, b: V3): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const f0 = s.from.fov ?? FOV;
  return { pos: mix(s.from.pos, to.pos), look: mix(s.from.look, to.look), fov: f0 + ((to.fov ?? f0) - f0) * k };
};

/* ───────────────────────────── palco ───────────────────────────── */

const Env: React.FC<{ intensity: number }> = ({ intensity }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
  }, [gl, scene]);
  scene.environmentIntensity = intensity;
  return null;
};

const LIGHT = {
  day: { amb: 0.75, sun: 2.4, sunColor: "#FFF4E0", env: 0.55, pos: [6, 10, 7] as V3 },
  indoor: { amb: 0.7, sun: 1.7, sunColor: "#FFE9CC", env: 0.5, pos: [3, 9, 6] as V3 },
  night: { amb: 0.32, sun: 1.5, sunColor: "#AFC3FF", env: 0.28, pos: [-5, 9, 5] as V3 },
};

type WorldProps = {
  cam: Cam;
  /** Fundo em CSS: cor ou gradiente. É o céu. */
  sky?: string;
  floor?: string;
  light?: keyof typeof LIGHT;
  /** Lua e estrelas no céu (cenas de noite ao ar livre). */
  moon?: boolean;
  children: React.ReactNode;
};

/**
 * Palco 3D com acabamento de brinquedo: céu em gradiente, luz com sombra
 * macia e reflexo de ambiente, que dá o brilho de plástico. Os filhos são
 * objetos do mundo (`Guy`, `Robot`, `Block`, `Sign`…).
 */
export const World: React.FC<WorldProps> = ({ cam, sky = "linear-gradient(#8FD3FF, #FFE9D2)", floor = "#D9C7B0", light = "day", moon = false, children }) => {
  const L = LIGHT[light];
  return (
    <AbsoluteFill style={{ background: sky }}>
      {moon && (
        <AbsoluteFill>
          <div style={{ position: "absolute", left: 760, top: 150, width: 120, height: 120, borderRadius: 60, background: "#FFF6D6", boxShadow: "0 0 80px 30px rgba(255,246,214,0.35)" }} />
          {[
            [120, 210], [300, 120], [520, 260], [640, 90], [930, 420], [210, 430], [430, 60], [80, 560], [990, 180], [700, 380],
          ].map(([x, y], i) => (
            <div key={i} style={{ position: "absolute", left: x, top: y, width: 7, height: 7, borderRadius: 4, background: "#fff", opacity: 0.75 }} />
          ))}
        </AbsoluteFill>
      )}
      <ThreeCanvas width={W} height={H} shadows flat gl={{ alpha: true }} camera={{ fov: cam.fov ?? FOV, position: cam.pos, near: 0.1, far: 300 }}>
        <Rig cam={cam} />
        <Env intensity={L.env} />
        <ambientLight intensity={L.amb} />
        <directionalLight
          position={L.pos}
          color={L.sunColor}
          intensity={L.sun}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-14}
          shadow-camera-right={14}
          shadow-camera-top={14}
          shadow-camera-bottom={-14}
          shadow-camera-far={60}
          shadow-bias={-0.0004}
          shadow-radius={5}
        />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[120, 120]} />
          <meshStandardMaterial color={floor} roughness={0.95} />
        </mesh>
        {children}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

/* ───────────────────────── texto e textura ───────────────────────── */

const canvasTexture = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

type SignProps = { text: string; sub?: string; pos?: V3; rot?: V3; w?: number; h?: number; bg?: string; color?: string; frame?: string; glow?: boolean };

/**
 * Placa com texto dentro do mundo 3D (fachada, cardápio, letreiro). O texto
 * entra em perspectiva junto com a câmera. `glow` acende a placa no escuro.
 */
export const Sign: React.FC<SignProps> = ({ text, sub, pos = [0, 2, 0], rot = [0, 0, 0], w = 2, h = 0.6, bg = C.white, color = DARK, frame = DARK, glow = true }) => {
  const tex = useMemo(
    () =>
      canvasTexture(1024, Math.round((1024 * h) / w), (g) => {
        const ch = (1024 * h) / w;
        g.fillStyle = bg;
        g.fillRect(0, 0, 1024, ch);
        g.fillStyle = color;
        g.textAlign = "center";
        g.textBaseline = "middle";
        let px = ch * (sub ? 0.46 : 0.6);
        g.font = `700 ${px}px ${F.display}`;
        const wide = g.measureText(text).width;
        if (wide > 920) px *= 920 / wide;
        g.font = `700 ${px}px ${F.display}`;
        g.fillText(text, 512, sub ? ch * 0.4 : ch * 0.53);
        if (sub) {
          g.globalAlpha = 0.75;
          g.font = `600 ${ch * 0.2}px ${F.display}`;
          g.fillText(sub, 512, ch * 0.78);
        }
      }),
    [text, sub, w, h, bg, color],
  );
  return (
    <group position={pos} rotation={rot}>
      <Block size={[w + 0.12, h + 0.12, 0.08]} color={frame} r={0.03} />
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[w, h]} />
        {glow ? <meshBasicMaterial map={tex} toneMapped={false} /> : <meshStandardMaterial map={tex} roughness={0.8} />}
      </mesh>
    </group>
  );
};

const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed & 0xffff) / 0xffff;
};

/** Prédio com janelas acesas: o fundo de qualquer rua. */
export const Building: React.FC<{ pos?: V3; size?: V3; color?: string; seed?: number; lit?: number }> = ({
  pos = [0, 0, 0],
  size = [3, 8, 3],
  color = "#3B3F73",
  seed = 7,
  lit = 0.55,
}) => {
  const tex = useMemo(() => {
    const cols = Math.max(2, Math.round(size[0] / 0.75));
    const rows = Math.max(3, Math.round(size[1] / 0.9));
    const rnd = seeded(seed * 97 + 13);
    return canvasTexture(cols * 64, rows * 64, (g) => {
      g.fillStyle = color;
      g.fillRect(0, 0, cols * 64, rows * 64);
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
          g.fillStyle = rnd() < lit ? (rnd() < 0.5 ? "#FFE28A" : "#FFF3C4") : "#22254A";
          g.fillRect(x * 64 + 14, y * 64 + 12, 36, 40);
        }
    });
  }, [size[0], size[1], color, seed, lit]);
  return (
    <group position={[pos[0], pos[1] + size[1] / 2, pos[2]]}>
      <Block size={size} color={color} r={0.04} />
      <mesh position={[0, 0, size[2] / 2 + 0.01]}>
        <planeGeometry args={[size[0] * 0.92, size[1] * 0.94]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
};

/** Parede de tijolos. */
export const BrickWall: React.FC<{ pos?: V3; size?: V3; rot?: V3; color?: string }> = ({ pos = [0, 0, 0], size = [4, 2, 0.3], rot = [0, 0, 0], color = "#C8553D" }) => {
  const tex = useMemo(() => {
    const t = canvasTexture(256, 128, (g) => {
      g.fillStyle = "#EBD9C6";
      g.fillRect(0, 0, 256, 128);
      g.fillStyle = color;
      for (let r = 0; r < 4; r++) for (let c = -1; c < 4; c++) g.fillRect(c * 64 + (r % 2 ? 32 : 0) + 3, r * 32 + 3, 58, 26);
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(size[0] / 1.2, size[1] / 0.6);
    return t;
  }, [size[0], size[1], color]);
  return (
    <mesh position={[pos[0], pos[1] + size[1] / 2, pos[2]]} rotation={rot} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial map={tex} roughness={0.9} />
    </mesh>
  );
};

/** Rua de asfalto com faixa tracejada, ao longo do eixo x. */
export const Road: React.FC<{ z?: number; width?: number; length?: number }> = ({ z = 3, width = 3.2, length = 60 }) => (
  <group position={[0, 0.011, z]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[length, width]} />
      <meshStandardMaterial color="#34364F" roughness={0.9} />
    </mesh>
    {Array.from({ length: Math.floor(length / 2.4) }).map((_, i) => (
      <mesh key={i} position={[-length / 2 + 1.2 + i * 2.4, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.1, 0.14]} />
        <meshBasicMaterial color="#FFD23F" />
      </mesh>
    ))}
  </group>
);

/* ───────────────────────────── boneco ───────────────────────────── */

export type GuyMood = "ok" | "happy" | "wide" | "angry" | "sad";

export type GuyProps = {
  pos?: V3;
  /** Giro em graus: 0 olha para a câmera (+z), 90 para a direita (+x). */
  turn?: number;
  /** Rotação livre do corpo inteiro, em graus, em volta dos pés: tombo, voo, deitado. */
  spin?: V3;
  shirt?: string;
  pants?: string;
  skin?: string;
  hair?: string;
  hat?: "none" | "cap" | "beanie";
  hatColor?: string;
  apron?: string;
  backpack?: string;
  mood?: GuyMood;
  talking?: boolean;
  /** Braço para a frente, em graus: 0 pendurado, 90 estendido, 170 para cima. */
  armL?: number;
  armR?: number;
  /** Braço aberto para o lado, em graus. */
  outL?: number;
  outR?: number;
  /** Anda (0 parado, 1 passo cheio). Mova `pos` na cena para ele sair do lugar. */
  walk?: number;
  hop?: number;
  lean?: number;
  headTurn?: number;
  headTilt?: number;
  sweat?: boolean;
  shiver?: number;
  scale?: number;
  /** Congelado: pose dura, sem respirar nem piscar. */
  frozen?: boolean;
};

/**
 * Boneco articulado do canal, de proporção de brinquedo de montar. Respira
 * e pisca sozinho; anda, pula, cai, fala e reage pelas props.
 */
export const Guy: React.FC<GuyProps> = ({
  pos = [0, 0, 0],
  turn = 0,
  spin = [0, 0, 0],
  shirt = C.gold,
  pants = "#2F3A8F",
  skin = "#F2C29B",
  hair = "#2A1B14",
  hat = "none",
  hatColor = C.red,
  apron,
  backpack,
  mood = "ok",
  talking = false,
  armL = 0,
  armR = 0,
  outL = 0,
  outR = 0,
  walk = 0,
  hop = 0,
  lean = 0,
  headTurn = 0,
  headTilt = 0,
  sweat = false,
  shiver = 0,
  scale = 1,
  frozen = false,
}) => {
  const tt = useT();
  const t = frozen ? 0 : tt;
  const breathe = frozen ? 0 : Math.sin(t * 2.4) * 0.008;
  const stride = Math.sin(t * 10) * 0.75 * walk;
  const bounce = Math.abs(Math.cos(t * 10)) * 0.05 * walk;
  const jitter = Math.sin(tt * 75) * 0.014 * shiver;
  const blink = !frozen && t % 2.9 > 2.78 ? 0.12 : 1;
  const eyeS = mood === "wide" ? 1.5 : 1;
  const open = talking ? 0.3 + Math.abs(Math.sin(t * 15)) * 0.9 : 0;
  const R = 0.5;
  const arm = (fwd: number, out: number, side: number, swing: number) => (
    <group position={[side * 0.285, 1.42, 0]} rotation={[-rad(fwd) + swing, 0, side * (0.1 + rad(out))]}>
      <Block size={[0.13, 0.36, 0.14]} pos={[0, -0.14, 0]} color={shirt} r={0.06} rough={R} />
      <Block size={[0.115, 0.22, 0.125]} pos={[0, -0.4, 0]} color={skin} r={0.05} rough={R} />
      <mesh position={[0, -0.54, 0]} castShadow>
        <sphereGeometry args={[0.078, 16, 12]} />
        <meshStandardMaterial color={skin} roughness={R} />
      </mesh>
    </group>
  );
  return (
    <group position={[pos[0] + jitter, pos[1] + hop + bounce, pos[2]]} rotation={[rad(spin[0]), rad(turn + spin[1]), rad(spin[2])]} scale={scale}>
      <group rotation={[rad(lean), 0, 0]}>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.115, 0.86, 0]} rotation={[s * stride, 0, 0]}>
            <Block size={[0.185, 0.78, 0.2]} pos={[0, -0.38, 0]} color={pants} r={0.07} rough={R} />
            <Block size={[0.2, 0.11, 0.31]} pos={[0, -0.8, 0.05]} color={DARK} r={0.045} rough={0.4} />
          </group>
        ))}
        <Block size={[0.46, 0.62 + breathe, 0.27]} pos={[0, 1.16, 0]} color={shirt} r={0.1} rough={R} />
        <Block size={[0.44, 0.1, 0.26]} pos={[0, 0.87, 0]} color={pants} r={0.04} rough={R} />
        {apron && (
          <>
            <Block size={[0.4, 0.62, 0.04]} pos={[0, 1.08, 0.13]} color={apron} r={0.02} rough={0.7} />
            <Block size={[0.16, 0.12, 0.04]} pos={[0, 1.42, 0.125]} color={apron} r={0.02} rough={0.7} />
          </>
        )}
        {backpack && <Block size={[0.36, 0.44, 0.16]} pos={[0, 1.2, -0.2]} color={backpack} r={0.07} rough={0.6} />}
        {arm(armL, outL, -1, -stride * 0.8)}
        {arm(armR, outR, 1, stride * 0.8)}
        <Cyl size={[0.075, 0.08]} pos={[0, 1.5, 0]} color={skin} rough={R} />
        <group position={[0, 1.71 + breathe, 0]} rotation={[0, rad(headTurn), rad(headTilt)]}>
          <Block size={[0.37, 0.39, 0.35]} color={skin} r={0.16} rough={R} />
          {hat === "none" && (
            <>
              <Block size={[0.4, 0.17, 0.38]} pos={[0, 0.15, -0.01]} color={hair} r={0.08} rough={0.6} />
              <Block size={[0.4, 0.26, 0.13]} pos={[0, 0.04, -0.13]} color={hair} r={0.06} rough={0.6} />
            </>
          )}
          {hat === "cap" && (
            <>
              <Block size={[0.41, 0.17, 0.39]} pos={[0, 0.15, -0.01]} color={hatColor} r={0.08} rough={0.6} />
              <Block size={[0.3, 0.04, 0.2]} pos={[0, 0.09, 0.26]} color={hatColor} r={0.018} rough={0.6} />
              <Block size={[0.4, 0.2, 0.1]} pos={[0, 0.0, -0.15]} color={hair} r={0.04} rough={0.6} />
            </>
          )}
          {hat === "beanie" && <Block size={[0.42, 0.24, 0.4]} pos={[0, 0.13, 0]} color={hatColor} r={0.11} rough={0.9} />}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.085, 0.01, 0.176]}>
              <mesh scale={[eyeS, eyeS * (mood === "happy" && !talking ? 0.55 : blink), 0.4]}>
                <sphereGeometry args={[0.03, 14, 10]} />
                <meshStandardMaterial color={DARK} roughness={0.3} />
              </mesh>
              {(mood === "angry" || mood === "sad") && (
                <Block size={[0.1, 0.022, 0.02]} pos={[0, 0.07, 0.004]} rot={[0, 0, (mood === "angry" ? -1 : 1) * s * 0.5]} color={DARK} r={0.008} shadow={false} />
              )}
            </group>
          ))}
          {talking || mood === "wide" ? (
            <mesh position={[0, -0.095, 0.172]} scale={[1, talking ? open : 1.1, 0.35]}>
              <sphereGeometry args={[0.045, 14, 10]} />
              <meshStandardMaterial color="#5A1F2A" roughness={0.5} />
            </mesh>
          ) : (
            <mesh position={[0, mood === "happy" ? -0.07 : -0.115, 0.172]} rotation={[0, 0, mood === "sad" || mood === "angry" ? 0 : Math.PI]}>
              <torusGeometry args={[mood === "ok" ? 0.035 : 0.05, 0.011, 8, 18, mood === "ok" ? Math.PI * 0.7 : Math.PI]} />
              <meshStandardMaterial color={DARK} roughness={0.4} />
            </mesh>
          )}
          {mood === "happy" &&
            [-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.135, -0.055, 0.158]} scale={[1, 0.6, 0.3]}>
                <sphereGeometry args={[0.035, 12, 8]} />
                <meshStandardMaterial color="#F4978E" roughness={0.6} />
              </mesh>
            ))}
          {sweat && (
            <mesh position={[0.19, 0.12 - ((tt * 0.45) % 0.3), 0.14]} scale={[1, 1.5, 1]}>
              <sphereGeometry args={[0.035, 12, 12]} />
              <meshStandardMaterial color={C.sky} roughness={0.2} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
};

/* ───────────────────────────── objetos ───────────────────────────── */

/** Bloco de gelo translúcido: "travar" ao pé da letra. `k` vai de 0 (sem gelo) a 1. */
export const Ice: React.FC<{ pos?: V3; k?: number; size?: V3 }> = ({ pos = [0, 0, 0], k = 1, size = [0.95, 2.15, 0.8] }) =>
  k <= 0.01 ? null : (
    <group position={[pos[0], pos[1] + (size[1] / 2) * k, pos[2]]} scale={[0.6 + 0.4 * k, k, 0.6 + 0.4 * k]}>
      <Block size={size} color="#9EDCFF" r={0.12} opacity={0.5} rough={0.08} />
      <Block size={[size[0] * 0.5, 0.05, 0.02]} pos={[-0.1, size[1] * 0.28, size[2] / 2 + 0.01]} rot={[0, 0, 0.6]} color="#FFFFFF" opacity={0.8} r={0.01} />
      <Block size={[size[0] * 0.28, 0.04, 0.02]} pos={[0.05, size[1] * 0.2, size[2] / 2 + 0.01]} rot={[0, 0, 0.6]} color="#FFFFFF" opacity={0.8} r={0.01} />
    </group>
  );

/** Estilhaços voando a partir de um ponto: gelo quebrando, comemoração. `k` de 0 a 1. */
export const Burst: React.FC<{ pos?: V3; k: number; color?: string; n?: number; power?: number }> = ({ pos = [0, 1, 0], k, color = "#BFE9FF", n = 14, power = 2.2 }) => {
  if (k <= 0 || k >= 1) return null;
  const rnd = seeded(41);
  return (
    <group position={pos}>
      {Array.from({ length: n }).map((_, i) => {
        const a = rnd() * Math.PI * 2;
        const up = 0.6 + rnd() * 1.6;
        const sp = (0.5 + rnd()) * power;
        const s = 0.08 + rnd() * 0.14;
        return (
          <Block
            key={i}
            size={[s, s, s]}
            pos={[Math.cos(a) * sp * k, up * k * 2.2 - 3.2 * k * k, Math.sin(a) * sp * k * 0.6]}
            rot={[k * 6 * rnd(), k * 5, k * 4 * rnd()]}
            color={color}
            r={0.02}
            rough={0.2}
            opacity={0.85}
          />
        );
      })}
    </group>
  );
};

/** Balança de dois pratos: o lado mais pesado desce. `tilt` em graus (positivo: direita desce). */
export const Scale: React.FC<{ pos?: V3; tilt?: number; scale?: number; left?: React.ReactNode; right?: React.ReactNode }> = ({ pos = [0, 0, 0], tilt = 0, scale = 1, left, right }) => {
  const a = rad(tilt);
  const arm = 1.25;
  const pan = (side: number) => {
    const x = side * arm * Math.cos(a);
    const y = 2.1 - side * arm * Math.sin(a);
    return (
      <group position={[x, y, 0]}>
        <Cyl size={[0.012, 0.75]} pos={[0, -0.38, 0]} color={DARK} />
        <Cyl size={[0.55, 0.06]} pos={[0, -0.78, 0]} color={C.gold} rough={0.35} />
        <group position={[0, -0.75, 0]}>{side < 0 ? left : right}</group>
      </group>
    );
  };
  return (
    <group position={pos} scale={scale}>
      <Cyl size={[0.5, 0.12]} pos={[0, 0.06, 0]} color={DARK} rough={0.4} />
      <Cyl size={[0.07, 2.1]} pos={[0, 1.1, 0]} color={C.gold} rough={0.35} />
      <group position={[0, 2.1, 0]} rotation={[0, 0, -a]}>
        <Block size={[2.7, 0.09, 0.09]} color={C.gold} r={0.03} rough={0.35} />
      </group>
      <mesh position={[0, 2.18, 0]} castShadow>
        <sphereGeometry args={[0.12, 16, 12]} />
        <meshStandardMaterial color={C.gold} roughness={0.35} />
      </mesh>
      {pan(-1)}
      {pan(1)}
    </group>
  );
};

/** Táxi amarelo. */
export const Taxi: React.FC<{ pos?: V3; turn?: number }> = ({ pos = [0, 0, 0], turn = 90 }) => (
  <group position={pos} rotation={[0, rad(turn), 0]}>
    <Block size={[0.95, 0.45, 2.1]} pos={[0, 0.48, 0]} color="#FFC61A" r={0.12} rough={0.35} />
    <Block size={[0.85, 0.4, 1.05]} pos={[0, 0.86, -0.08]} color="#FFC61A" r={0.14} rough={0.35} />
    <Block size={[0.87, 0.26, 0.9]} pos={[0, 0.88, -0.08]} color="#1D2247" r={0.08} rough={0.15} />
    <Block size={[0.3, 0.11, 0.16]} pos={[0, 1.12, -0.08]} color={C.white} glow={0.6} r={0.03} />
    {[-1, 1].flatMap((x) => [-1, 1].map((z) => <Cyl key={`${x}${z}`} size={[0.2, 0.14]} pos={[x * 0.48, 0.2, z * 0.68]} rot={[0, 0, Math.PI / 2]} color={DARK} rough={0.6} />))}
    <Block size={[0.7, 0.1, 0.04]} pos={[0, 0.5, 1.06]} color="#FFF6C9" glow={1} r={0.02} />
  </group>
);

/** Poste de luz com lâmpada acesa. */
export const Lamp: React.FC<{ pos?: V3 }> = ({ pos = [0, 0, 0] }) => (
  <group position={pos}>
    <Cyl size={[0.06, 3.4]} pos={[0, 1.7, 0]} color={DARK} rough={0.5} />
    <Block size={[0.7, 0.07, 0.1]} pos={[0.3, 3.4, 0]} color={DARK} r={0.02} />
    <Block size={[0.3, 0.09, 0.18]} pos={[0.55, 3.33, 0]} color="#FFF1B8" glow={1.2} r={0.03} />
    <pointLight position={[0.55, 3.1, 0]} intensity={9} color="#FFDFA0" distance={8} />
  </group>
);

/** Vaso com planta, para encher canto de cenário. */
export const Plant: React.FC<{ pos?: V3; scale?: number }> = ({ pos = [0, 0, 0], scale = 1 }) => (
  <group position={pos} scale={scale}>
    <Cyl size={[0.2, 0.36]} top={0.27} pos={[0, 0.18, 0]} color="#C8553D" />
    {[0, 1, 2, 3, 4].map((i) => (
      <Block key={i} size={[0.13, 0.75, 0.05]} pos={[Math.sin(i * 1.3) * 0.12, 0.72, Math.cos(i * 1.3) * 0.12]} rot={[Math.cos(i * 1.3) * 0.4, 0, -Math.sin(i * 1.3) * 0.4]} color={i % 2 ? "#2FA36B" : "#1F8A5B"} r={0.02} rough={0.5} />
    ))}
  </group>
);

/* ───────────────────── metáforas de número ───────────────────── */

/** Topo de uma barra de `Bars`, para colar um rótulo com `Anchor`. */
export const barTop = (i: number, n: number, value: number, pos: V3 = [0, 0, 0], maxH = 2.4): V3 => [pos[0] + (i - (n - 1) / 2) * 0.95, pos[1] + 0.12 + value * maxH + 0.25, pos[2]];

/**
 * Gráfico de barras 3D para comparar dois ou três números ("6 anos lendo"
 * contra "2 horas falando"). `values` de 0 a 1; `k` de 0 a 1 faz crescer.
 */
export const Bars: React.FC<{ values: number[]; colors?: string[]; pos?: V3; k?: number; maxH?: number }> = ({ values, colors = [C.mint, C.red, C.gold], pos = [0, 0, 0], k = 1, maxH = 2.4 }) => (
  <group position={pos}>
    <Block size={[values.length * 0.95 + 0.4, 0.12, 1.0]} pos={[0, 0.06, 0]} color={DARK} r={0.04} rough={0.4} />
    {values.map((v, i) => {
      const h = Math.max(0.04, v * maxH * k);
      return <Block key={i} size={[0.62, h, 0.62]} pos={[(i - (values.length - 1) / 2) * 0.95, 0.12 + h / 2, 0]} color={colors[i % colors.length]} r={0.06} rough={0.45} />;
    })}
  </group>
);

/** Pilha de blocos que caem um por um (livros, anos, tentativas). `k` de 0 a 1 enche a pilha. */
export const Pile: React.FC<{ n?: number; pos?: V3; k?: number; colors?: string[] }> = ({ n = 6, pos = [0, 0, 0], k = 1, colors = [C.coral, C.mint, C.gold, C.lilac, C.sky, C.indigo] }) => (
  <group position={pos}>
    {Array.from({ length: n }).map((_, i) => {
      const p = Math.min(1, Math.max(0, k * n - i));
      if (p <= 0) return null;
      return <Block key={i} size={[0.7 - (i % 2) * 0.1, 0.16, 0.5]} pos={[(i % 2) * 0.06 - 0.03, 0.08 + i * 0.165 + (1 - p) * (1 - p) * 3, 0]} rot={[0, i * 0.25, 0]} color={colors[i % colors.length]} r={0.035} rough={0.5} />;
    })}
  </group>
);
