import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useScene, useT } from "./anim";
import { C, H, W } from "./theme";

export type V3 = [number, number, number];
export type Cam = { pos: V3; look: V3; fov?: number };

export const FOV = 30;

/** Câmera que desliza de `from` até `to` ao longo da cena (ou entre dois instantes). */
export const useCam = (from: Cam, to: Cam = from, start = 0, end?: number): Cam => {
  const t = useT();
  const { dur } = useScene();
  const k = interpolate(t, [start, end ?? dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const mix = (a: V3, b: V3): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const f0 = from.fov ?? FOV;
  return { pos: mix(from.pos, to.pos), look: mix(from.look, to.look), fov: f0 + ((to.fov ?? FOV) - f0) * k };
};

/** Ponto do mundo 3D → pixel da tela. É o que cola rótulos e balões nos objetos. */
export const project = (cam: Cam, p: V3) => {
  const c = new THREE.PerspectiveCamera(cam.fov ?? FOV, W / H, 0.1, 200);
  c.position.set(...cam.pos);
  c.lookAt(...cam.look);
  c.updateMatrixWorld();
  c.updateProjectionMatrix();
  const v = new THREE.Vector3(...p).project(c);
  return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H };
};

export const Rig: React.FC<{ cam: Cam }> = ({ cam }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const apply = () => {
    camera.position.set(...cam.pos);
    camera.fov = cam.fov ?? FOV;
    camera.lookAt(...cam.look);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  };
  apply();
  useLayoutEffect(apply);
  return null;
};

/**
 * Palco 3D: chão, luz com sombra e câmera. Os filhos são objetos do mundo
 * (`Toy`, `Robot`, `Block`…). Rótulos e balões vão fora, em `Anchor`.
 */
export const Stage: React.FC<{ cam: Cam; sky?: string; floor?: string; children: React.ReactNode }> = ({
  cam,
  sky = C.cream,
  floor = C.sand,
  children,
}) => (
  <AbsoluteFill>
    <ThreeCanvas width={W} height={H} shadows flat camera={{ fov: cam.fov ?? FOV, position: cam.pos, near: 0.1, far: 200 }}>
      <Rig cam={cam} />
      <color attach="background" args={[sky]} />
      <ambientLight intensity={1.5} />
      <hemisphereLight args={["#ffffff", floor, 0.7]} />
      <directionalLight
        position={[5, 10, 7]}
        intensity={1.9}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0004}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={floor} roughness={1} />
      </mesh>
      {children}
    </ThreeCanvas>
  </AbsoluteFill>
);

/** Conteúdo HTML preso a um ponto do mundo 3D. `align` diz que borda encosta no ponto. */
export const Anchor: React.FC<{ cam: Cam; p: V3; align?: "bottom" | "center" | "top"; dx?: number; dy?: number; children: React.ReactNode }> = ({
  cam,
  p,
  align = "bottom",
  dx = 0,
  dy = 0,
  children,
}) => {
  const s = project(cam, p);
  const ty = align === "bottom" ? "-100%" : align === "center" ? "-50%" : "0%";
  return <div style={{ position: "absolute", left: s.x + dx, top: s.y + dy, transform: `translate(-50%, ${ty})` }}>{children}</div>;
};

type BlockProps = { size?: V3; pos?: V3; rot?: V3; color?: string; r?: number; glow?: number; scale?: V3 | number; opacity?: number; rough?: number; shadow?: boolean };

/** Bloco de cantos arredondados: a peça de montar de todo cenário. */
export const Block: React.FC<BlockProps> = ({ size = [1, 1, 1], pos = [0, 0, 0], rot = [0, 0, 0], color = C.white, r = 0.06, glow = 0, scale = 1, opacity = 1, rough = 0.8, shadow = true }) => {
  const geo = useMemo(() => new RoundedBoxGeometry(size[0], size[1], size[2], 4, Math.min(r, Math.min(...size) / 2 - 0.001)), [size[0], size[1], size[2], r]);
  return (
    <mesh geometry={geo} position={pos} rotation={rot} scale={scale} castShadow={shadow && opacity === 1} receiveShadow>
      <meshStandardMaterial color={color} roughness={rough} emissive={color} emissiveIntensity={glow} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1} />
    </mesh>
  );
};

/** Cilindro (copo, pé de mesa, poste). `size` é [raio, altura]. */
export const Cyl: React.FC<{ size?: [number, number]; pos?: V3; rot?: V3; color?: string; top?: number; glow?: number; rough?: number }> = ({
  size = [0.5, 1],
  pos = [0, 0, 0],
  rot = [0, 0, 0],
  color = C.white,
  top,
  glow = 0,
  rough = 0.8,
}) => (
  <mesh position={pos} rotation={rot} castShadow receiveShadow>
    <cylinderGeometry args={[top ?? size[0], size[0], size[1], 28]} />
    <meshStandardMaterial color={color} roughness={rough} emissive={color} emissiveIntensity={glow} />
  </mesh>
);

export type ToyMood = "ok" | "happy" | "wide" | "angry" | "sad";

type ToyProps = {
  pos?: V3;
  /** Giro em graus: 0 olha para a câmera (+z), 90 para a direita (+x). */
  turn?: number;
  shirt?: string;
  pants?: string;
  skin?: string;
  hair?: string;
  hat?: "none" | "cap" | "apron";
  hatColor?: string;
  mood?: ToyMood;
  talking?: boolean;
  /** Braços em graus para a frente: 0 pendurado, 90 estendido, 170 para cima. */
  armL?: number;
  armR?: number;
  /** Anda no lugar (0 parado, 1 passo cheio). */
  walk?: number;
  /** Pulo em metros. */
  hop?: number;
  /** Inclina o corpo para a frente, em graus (negativo: para trás, de susto). */
  lean?: number;
  /** Cabeça vira de lado, em graus. */
  headTurn?: number;
  sweat?: boolean;
  /** Treme de nervoso (0 a 1). */
  shiver?: number;
  scale?: number;
};

const rad = (d: number) => (d * Math.PI) / 180;
const DARK = "#17152F";

/**
 * Boneco de brinquedo do canal: cabeça grande, corpo de blocos. Respira
 * sozinho; fala, anda, pula e reage pelas props.
 */
export const Toy: React.FC<ToyProps> = ({
  pos = [0, 0, 0],
  turn = 0,
  shirt = C.indigo,
  pants = C.ink,
  skin = "#F2C29B",
  hair = "#3B2A20",
  hat = "none",
  hatColor = C.gold,
  mood = "ok",
  talking = false,
  armL = 0,
  armR = 0,
  walk = 0,
  hop = 0,
  lean = 0,
  headTurn = 0,
  sweat = false,
  shiver = 0,
  scale = 1,
}) => {
  const t = useT();
  const breathe = Math.sin(t * 2.4) * 0.012;
  const step = Math.sin(t * 11) * 0.6 * walk;
  const jitter = Math.sin(t * 70) * 0.012 * shiver;
  const mouth = talking ? 0.35 + Math.abs(Math.sin(t * 15)) * 0.9 : mood === "wide" ? 1 : 0.22;
  const eyeY = mood === "wide" ? 1.5 : 1;
  const arm = (deg: number, side: number, swing: number) => (
    <group position={[side * 0.33, 0.98, 0]} rotation={[-rad(deg) + swing, 0, side * 0.08]}>
      <Block size={[0.16, 0.46, 0.18]} pos={[0, -0.2, 0]} color={shirt} r={0.07} />
      <Block size={[0.15, 0.14, 0.17]} pos={[0, -0.47, 0]} color={skin} r={0.06} />
    </group>
  );
  return (
    <group position={[pos[0] + jitter, pos[1] + hop, pos[2]]} rotation={[0, rad(turn), 0]} scale={scale}>
      <group rotation={[rad(lean), 0, 0]}>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.13, 0.45, 0]} rotation={[s * step, 0, 0]}>
            <Block size={[0.21, 0.45, 0.24]} pos={[0, -0.22, 0]} color={pants} r={0.07} />
            <Block size={[0.22, 0.1, 0.32]} pos={[0, -0.4, 0.04]} color={DARK} r={0.04} />
          </group>
        ))}
        <Block size={[0.52, 0.56 + breathe, 0.32]} pos={[0, 0.74, 0]} color={shirt} r={0.1} />
        {hat === "apron" && <Block size={[0.42, 0.5, 0.05]} pos={[0, 0.7, 0.16]} color={hatColor} r={0.02} />}
        {arm(armL, -1, -step)}
        {arm(armR, 1, step)}
        <group position={[0, 1.36 + breathe, 0]} rotation={[0, rad(headTurn), 0]}>
          <Block size={[0.66, 0.6, 0.58]} color={skin} r={0.2} />
          <Block size={[0.7, 0.26, 0.62]} pos={[0, 0.24, -0.02]} color={hat === "cap" ? hatColor : hair} r={0.12} />
          {hat === "cap" && <Block size={[0.5, 0.06, 0.3]} pos={[0, 0.15, 0.4]} color={hatColor} r={0.02} />}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.15, 0.0, 0.295]}>
              <Block size={[0.085, 0.1, 0.03]} scale={[1, eyeY, 1]} color={DARK} r={0.014} />
              {mood === "angry" && <Block size={[0.16, 0.035, 0.03]} pos={[0, 0.11, 0.005]} rot={[0, 0, -s * 0.5]} color={DARK} r={0.01} />}
              {mood === "sad" && <Block size={[0.16, 0.035, 0.03]} pos={[0, 0.12, 0.005]} rot={[0, 0, s * 0.45]} color={DARK} r={0.01} />}
            </group>
          ))}
          <Block
            size={[mood === "happy" || talking ? 0.22 : 0.14, 0.09, 0.03]}
            pos={[0, -0.16, 0.295]}
            scale={[1, mood === "angry" || mood === "sad" ? 0.3 : mood === "happy" && !talking ? 0.85 : mouth, 1]}
            color={mood === "happy" ? "#B23A48" : DARK}
            r={0.03}
          />
          {mood === "happy" &&
            [-1, 1].map((s) => <Block key={s} size={[0.1, 0.06, 0.02]} pos={[s * 0.24, -0.1, 0.293]} color="#F4978E" r={0.02} />)}
          {sweat && (
            <mesh position={[0.3, 0.2 - ((t * 0.5) % 0.35), 0.3]} scale={[1, 1.5, 1]}>
              <sphereGeometry args={[0.05, 12, 12]} />
              <meshStandardMaterial color={C.sky} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
};

export type RobotMood = "neutral" | "happy" | "wide" | "sad";

/**
 * O Prag em 3D: a cabeça do logo flutuando. É o rosto do tutor de IA. Os
 * olhos brilham; `talking` faz a boca pulsar.
 */
export const Robot: React.FC<{ pos?: V3; turn?: number; scale?: number; mood?: RobotMood; talking?: boolean; tilt?: number }> = ({
  pos = [0, 1.2, 0],
  turn = 0,
  scale = 1,
  mood = "neutral",
  talking = false,
  tilt = 0,
}) => {
  const t = useT();
  const bob = Math.sin(t * 2.6) * 0.05;
  const blink = t % 3.1 > 2.95 ? 0.15 : 1;
  const eyeH = mood === "wide" ? 1.3 : mood === "sad" ? 0.55 : blink;
  const mouth = talking ? 0.4 + Math.abs(Math.sin(t * 15)) : 0;
  const EYE = "#E3F2FB";
  return (
    <group position={[pos[0], pos[1] + bob, pos[2]]} rotation={[0, rad(turn), rad(tilt)]} scale={scale}>
      <Block size={[1, 0.82, 0.6]} color="#F3EEDC" r={0.26} />
      <Block size={[0.8, 0.6, 0.08]} pos={[0, 0.02, 0.28]} color="#0B0C10" r={0.03} />
      {[-1, 1].map((s) => (
        <React.Fragment key={s}>
          <Cyl size={[0.17, 0.14]} pos={[s * 0.54, 0.02, 0]} rot={[0, 0, Math.PI / 2]} color="#3D7CC9" />
          <Block size={[0.1, 0.2, 0.03]} pos={[s * 0.15, 0.06, 0.325]} scale={[1, eyeH, 1]} color={EYE} glow={0.9} r={0.014} />
        </React.Fragment>
      ))}
      {talking && <Block size={[0.14, 0.07, 0.03]} pos={[0, -0.16, 0.325]} scale={[1, mouth, 1]} color={EYE} glow={0.9} r={0.014} />}
      {mood === "happy" && !talking && <Block size={[0.22, 0.05, 0.03]} pos={[0, -0.15, 0.325]} color={EYE} glow={0.9} r={0.02} />}
      <mesh position={[-0.28, -0.46, 0]} rotation={[0, 0, Math.PI + 0.5]} castShadow>
        <coneGeometry args={[0.13, 0.26, 4]} />
        <meshStandardMaterial color="#F3EEDC" roughness={0.8} />
      </mesh>
    </group>
  );
};

/** Copo de café para viagem. */
export const CupToGo: React.FC<{ pos?: V3; scale?: number }> = ({ pos = [0, 0, 0], scale = 1 }) => (
  <group position={pos} scale={scale}>
    <Cyl size={[0.075, 0.22]} top={0.095} pos={[0, 0.11, 0]} color={C.white} />
    <Cyl size={[0.092, 0.08]} top={0.094} pos={[0, 0.13, 0]} color={C.coral} />
    <Cyl size={[0.1, 0.035]} pos={[0, 0.235, 0]} color={DARK} />
  </group>
);

/** Celular em pé com a tela acesa. */
export const PhoneToy: React.FC<{ pos?: V3; rot?: V3; scale?: number; screen?: string }> = ({ pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, screen = C.indigo }) => (
  <group position={pos} rotation={rot} scale={scale}>
    <Block size={[0.36, 0.7, 0.05]} color={DARK} r={0.024} />
    <Block size={[0.31, 0.64, 0.02]} pos={[0, 0, 0.022]} color={screen} glow={0.5} r={0.009} />
  </group>
);
