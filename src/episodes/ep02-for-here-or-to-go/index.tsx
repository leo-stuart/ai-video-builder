import React from "react";
import { AbsoluteFill } from "remotion";
import {
  Anchor,
  Block,
  C,
  Cam,
  CupToGo,
  Cyl,
  EndCard,
  EpisodeDef,
  Mark,
  Phone,
  PhoneToy,
  Plate,
  Pop,
  Robot,
  RobotMood,
  Sfx,
  Stage,
  Stamp,
  Toy,
  ToyMood,
  useCam,
  useCue,
  useScene,
  useSpring,
  useT,
} from "../../kit";
import script from "./script.json";
import timing from "./timing.json";

const ME = { shirt: C.gold, pants: C.indigoLip, hair: "#2A1B14" };
const CASHIER = { shirt: C.white, pants: C.ink, hair: "#7A3B1D", skin: "#E8B48C", hat: "apron" as const, hatColor: C.coral };

/** Plaquinha presa a um ponto do cenário. */
const Tag: React.FC<{ cam: Cam; p: [number, number, number]; tone?: "ink" | "white" | "coral" | "mint" | "red"; size?: number; children: React.ReactNode }> = ({
  cam,
  p,
  tone = "ink",
  size = 40,
  children,
}) => (
  <Anchor cam={cam} p={p} align="center">
    <Plate tone={tone} pad="8px 24px" radius={18} style={{ fontSize: size, fontWeight: 700, whiteSpace: "nowrap", letterSpacing: 1, boxShadow: "0 6px 0 rgba(0,0,0,0.25)" }}>
      {children}
    </Plate>
  </Anchor>
);

type CafeProps = {
  cam: Cam;
  me?: { mood?: ToyMood; talking?: boolean; sweat?: boolean; shiver?: number; lean?: number; armR?: number; hop?: number; headTurn?: number };
  cashier?: { mood?: ToyMood; talking?: boolean; armL?: number; lean?: number };
  queue?: boolean;
  cupOut?: number;
  children?: React.ReactNode;
};

/** A cafeteria: balcão, caixa de avental, cardápio na parede e a fila atrás. */
const Cafe: React.FC<CafeProps> = ({ cam, me = {}, cashier = {}, queue = false, cupOut = 0, children }) => (
  <AbsoluteFill>
    <Stage cam={cam} sky="#FFD9B8" floor="#E9C9A6">
      <Block size={[14, 5, 0.3]} pos={[0, 2.5, -2.2]} color="#FFE9D2" r={0.02} />
      <Block size={[14, 0.9, 0.34]} pos={[0, 0.45, -2.18]} color={C.coral} r={0.02} />
      <Block size={[1.5, 1.0, 0.08]} pos={[0.6, 2.75, -2.02]} color={C.ink} r={0.04} />
      {[0, 1, 2, 3].map((i) => (
        <Block key={i} size={[i % 2 ? 0.7 : 1.05, 0.07, 0.02]} pos={[0.6 - (i % 2 ? 0.17 : 0), 3.05 - i * 0.2, -1.97]} color={i === 0 ? C.gold : C.white} r={0.02} />
      ))}
      <Block size={[0.75, 1.02, 2.0]} pos={[0.3, 0.51, -0.1]} color="#8A5A3C" r={0.05} />
      <Block size={[0.9, 0.08, 2.15]} pos={[0.3, 1.06, -0.1]} color="#F6E7D3" r={0.03} />
      <Block size={[0.34, 0.26, 0.3]} pos={[0.3, 1.23, -0.75]} color={C.ink} r={0.04} />
      <Block size={[0.3, 0.2, 0.02]} pos={[0.14, 1.25, -0.75]} rot={[0, -Math.PI / 2, 0]} color={C.sky} glow={0.4} r={0.008} />
      <CupToGo pos={[0.3 - cupOut * 0.22, 1.1, 0.35]} scale={1.25} />
      <Cyl size={[0.05, 1.3]} pos={[2.6, 3.9, -1]} color={C.ink} />
      <Cyl size={[0.3, 0.28]} top={0.12} pos={[2.6, 3.2, -1]} color={C.gold} />
      <Toy pos={[-0.72, 0, 0.25]} turn={62} {...ME} {...me} />
      <Toy pos={[1.05, 0, 0.05]} turn={-62} {...CASHIER} {...cashier} />
      {queue && (
        <>
          <Toy pos={[-1.75, 0, 0.1]} turn={75} shirt={C.teal} hair="#111" mood="angry" armR={25} />
          <Toy pos={[-2.65, 0, 0.3]} turn={70} shirt={C.lilac} skin="#B9794F" hair="#111" mood="angry" headTurn={-20} />
          <Toy pos={[-3.5, 0, 0.05]} turn={78} shirt={C.red} hair="#C9A227" mood="sad" />
        </>
      )}
    </Stage>
    {children}
  </AbsoluteFill>
);

const WIDE: Cam = { pos: [0.15, 4.3, 12.8], look: [0.15, 0.5, 0] };
const WIDE_IN: Cam = { pos: [0.15, 3.9, 11.2], look: [0.15, 0.55, 0] };

/** Gancho: a caixa pergunta e o vídeo já começou. */
const Pergunta: React.FC = () => {
  const cam = useCam(WIDE, WIDE_IN);
  return (
    <Cafe cam={cam} me={{ mood: "ok" }} cashier={{ mood: "happy", talking: true, armL: 55 }}>
      <Sfx name="pop" at={0.02} />
      <Tag cam={cam} p={[1.05, 2.0, 0.05]} tone="coral">
        CAIXA
      </Tag>
      <Tag cam={cam} p={[-0.72, 2.0, 0.25]} tone="white">
        VOCÊ
      </Tag>
    </Cafe>
  );
};

/** Deu branco: a frase vira um borrão na cabeça. */
const Branco: React.FC = () => {
  const cam = useCam({ pos: [-0.9, 2.6, 7.4], look: [-0.6, 0.95, 0] }, { pos: [-0.85, 2.3, 6.2], look: [-0.62, 1.0, 0] });
  const t = useT();
  return (
    <Cafe cam={cam} me={{ mood: "wide", sweat: true, shiver: 1, lean: -8, talking: t > 0.05 && t < 0.9 }} cashier={{ mood: "ok" }}>
      <Sfx name="bong" at={0.05} />
      <Pop at={0.05} style={{ left: 90, top: 400 }}>
        <Plate tone="white" pad="24px 36px" radius={40} style={{ fontSize: 66, fontWeight: 700, boxShadow: `0 10px 0 ${C.borderLip}` }}>
          <span style={{ color: C.muted }}>"forrir… ór… tugôu"</span> <span style={{ color: C.red }}>???</span>
        </Plate>
      </Pop>
    </Cafe>
  );
};

/** A caixa não entendeu e a fila atrás cresce. */
const YesWhat: React.FC = () => {
  const cam = useCam({ pos: [0.15, 4.2, 12.6], look: [0.15, 0.6, 0] }, { pos: [-1.25, 5.4, 18], look: [-1.25, 0.5, 0] });
  const a = useSpring(0.25);
  return (
    <Cafe cam={cam} queue me={{ mood: "sad", sweat: true, shiver: 0.6 }} cashier={{ mood: "angry", talking: true, lean: 10 }}>
      <Sfx name="whoosh" at={0.1} volume={0.35} />
      <div style={{ opacity: a }}>
        <Tag cam={cam} p={[-2.65, 2.15, 0.3]} tone="red" size={46}>
          FILA +3
        </Tag>
      </div>
    </Cafe>
  );
};

/** Ela vira para a câmera: o problema dito por quem viveu. */
const Camera: React.FC = () => {
  const cam = useCam({ pos: [-0.72, 1.9, 6.6], look: [-0.72, 0.95, 0.25] }, { pos: [-0.72, 1.8, 5.6], look: [-0.72, 1.0, 0.25] });
  const cue = useCue();
  const t = useT();
  return (
    <AbsoluteFill>
      <Stage cam={cam} sky={C.night} floor="#1D1A40">
        <Toy pos={[-0.72, 0, 0.25]} {...ME} talking mood="ok" armL={t > cue("sabia") ? 70 : 0} armR={t > cue("voz") ? 80 : 0} headTurn={Math.sin(t * 1.8) * 6} />
      </Stage>
      <Pop at={cue("sabia")} style={{ left: 90, top: 330 }}>
        <Plate tone="mint" pad="18px 34px" radius={30} style={{ fontSize: 60, fontWeight: 700 }}>
          na prova ✓
        </Plate>
      </Pop>
      <Pop at={cue("voz")} style={{ left: 560, top: 470 }}>
        <Plate tone="red" pad="18px 34px" radius={30} style={{ fontSize: 60, fontWeight: 700 }}>
          falando ✕
        </Plate>
      </Pop>
    </AbsoluteFill>
  );
};

type HomeProps = { cam: Cam; me?: CafeProps["me"]; bot?: { mood?: RobotMood; talking?: boolean; tilt?: number }; children?: React.ReactNode };

/** Em casa, de noite: sofá, abajur, celular na mão e o tutor saindo da tela. */
const Home: React.FC<HomeProps> = ({ cam, me = {}, bot = {}, children }) => (
  <AbsoluteFill>
    <Stage cam={cam} sky="#2B2760" floor="#3A3580">
      <Block size={[14, 5, 0.3]} pos={[0, 2.5, -2.2]} color="#39347A" r={0.02} />
      <Block size={[1.3, 1.5, 0.08]} pos={[-1.2, 2.6, -2.02]} color="#151238" r={0.05} />
      <Cyl size={[0.2, 0.02]} pos={[-0.95, 3.0, -1.96]} rot={[Math.PI / 2, 0, 0]} color="#FFF1CC" />
      <Block size={[2.3, 0.5, 0.95]} pos={[-0.3, 0.3, -1.3]} color={C.lilac} r={0.14} />
      <Block size={[2.3, 1.05, 0.3]} pos={[-0.3, 0.6, -1.75]} color={C.lilacLip} r={0.14} />
      <Cyl size={[0.04, 1.7]} pos={[1.75, 0.85, -1.5]} color={C.ink} />
      <Cyl size={[0.34, 0.4]} top={0.18} pos={[1.75, 1.85, -1.5]} color={C.gold} />
      <pointLight position={[1.75, 1.8, -1.2]} intensity={7} color="#FFD27A" distance={6} />
      <Toy pos={[-0.62, 0, 0.2]} turn={38} armR={78} {...ME} {...me} />
      <PhoneToy pos={[-0.12, 1.02, 0.72]} rot={[-0.2, -0.5, 0]} scale={0.62} screen={C.indigo} />
      <Robot pos={[0.72, 1.55, 0.35]} turn={-32} scale={0.82} {...bot} />
    </Stage>
    {children}
  </AbsoluteFill>
);

const HOME: Cam = { pos: [0.05, 3.6, 11.6], look: [0.05, 0.75, 0] };
const HOME_IN: Cam = { pos: [0.05, 3.3, 10.4], look: [0.05, 0.8, 0] };

/** O tutor puxa o treino da mesma frase. */
const Treino: React.FC = () => {
  const cam = useCam(HOME, HOME_IN);
  return (
    <Home cam={cam} me={{ mood: "ok" }} bot={{ mood: "happy", talking: true }}>
      <Sfx name="pop" at={0.02} />
      <Tag cam={cam} p={[0.72, 2.25, 0.35]} tone="ink">
        TUTOR DE IA
      </Tag>
    </Home>
  );
};

/** Ela erra: "I want to go" quer dizer outra coisa. */
const Erro: React.FC = () => {
  const cam = useCam(HOME_IN, { pos: [-0.1, 2.9, 8.8], look: [-0.05, 0.9, 0] });
  const { dur } = useScene();
  const t = useT();
  const hit = dur - 0.25;
  return (
    <Home cam={cam} me={{ mood: t > hit ? "sad" : "ok", talking: t < hit }} bot={{ mood: t > hit ? "wide" : "neutral", tilt: t > hit ? 10 : 0 }}>
      <Sfx name="bong" at={hit} />
      <Pop at={hit} style={{ left: 110, top: 360 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Mark ok={false} size={110} />
          <Plate tone="red" pad="20px 34px" radius={30} style={{ fontSize: 58, fontWeight: 700 }}>
            = "quero ir embora"
          </Plate>
        </div>
      </Pop>
    </Home>
  );
};

/** A correção na hora: a frase certa aparece grande. */
const Corrige: React.FC = () => {
  const cam = useCam({ pos: [0.5, 2.6, 8.4], look: [0.3, 0.95, 0] }, { pos: [0.6, 2.4, 7.4], look: [0.35, 1.0, 0] });
  const cue = useCue();
  return (
    <Home cam={cam} me={{ mood: "ok", headTurn: 10 }} bot={{ mood: "happy", talking: true }}>
      <Sfx name="pop" at={cue("to")} />
      <Pop at={cue("to")} style={{ left: 90, top: 340 }}>
        <Plate tone="mint" width={900} pad="36px 30px" style={{ fontSize: 108, fontWeight: 700, textAlign: "center" }}>
          To go, please.
        </Plate>
      </Pop>
    </Home>
  );
};

/** Ela acerta e comemora. */
const Certo: React.FC = () => {
  const cam = useCam({ pos: [-0.1, 2.9, 8.8], look: [-0.05, 0.9, 0] }, HOME_IN);
  const { dur } = useScene();
  const t = useT();
  const hit = dur - 0.3;
  const hop = t > hit ? Math.abs(Math.sin((t - hit) * 9)) * 0.28 : 0;
  return (
    <Home cam={cam} me={{ mood: t > hit ? "happy" : "ok", talking: t < hit, hop, armR: t > hit ? 165 : 78 }} bot={{ mood: "happy" }}>
      <Sfx name="ding" at={hit} />
      <div style={{ position: "absolute", left: 250, top: 380 }}>
        <Stamp at={hit} tone="mint" size={110}>
          Natural ✓
        </Stamp>
      </div>
    </Home>
  );
};

/** De volta ao balcão: a mesma pergunta. */
const Volta: React.FC = () => {
  const cam = useCam(WIDE, WIDE_IN);
  return <Cafe cam={cam} me={{ mood: "happy" }} cashier={{ mood: "happy", talking: true, armL: 55 }} />;
};

/** Agora sai na hora, e o café vem. */
const Resposta: React.FC = () => {
  const cam = useCam(WIDE_IN, { pos: [0.15, 3.8, 11.2], look: [0.15, 0.65, 0] });
  const { dur } = useScene();
  const t = useT();
  const hit = dur - 0.2;
  const out = useSpring(hit);
  return (
    <Cafe cam={cam} cupOut={out} me={{ mood: "happy", talking: t < hit, armR: t > hit ? 80 : 30 }} cashier={{ mood: "happy", armL: t > hit ? 70 : 0 }}>
      <Sfx name="ding" at={hit} />
      <div style={{ position: "absolute", left: 200, top: 420 }}>
        <Stamp at={hit} tone="mint" rotate={-6} size={96}>
          Sem travar
        </Stamp>
      </div>
    </Cafe>
  );
};

/** O pitch: ela apresenta o tutor, com a tela real do app. */
const Pitch: React.FC = () => {
  const cam = useCam({ pos: [0.35, 2.2, 7.6], look: [0.35, 0.8, 0] }, { pos: [0.35, 2.1, 6.8], look: [0.35, 0.85, 0] });
  const cue = useCue();
  const t = useT();
  return (
    <AbsoluteFill>
      <Stage cam={cam} sky={C.indigo} floor={C.indigoLip}>
        <Toy pos={[-0.35, 0, 0]} turn={14} {...ME} talking mood="happy" armR={t > cue("Pragma") ? 95 : 0} />
      </Stage>
      <Pop at={cue("Pragma")} style={{ left: 110, top: 330 }}>
        <Plate tone="gold" pad="16px 40px" radius={999} style={{ fontSize: 84, fontWeight: 700, color: C.ink, background: C.gold }}>
          Pragma
        </Plate>
      </Pop>
      <Pop at={cue("voz")} from="right" style={{ left: 560, top: 330 }}>
        <Phone src="img/08-speak.jpg" width={380} tilt={5} />
      </Pop>
    </AbsoluteFill>
  );
};

/** Cinco minutos por dia: o hábito em uma imagem. */
const Ritmo: React.FC = () => {
  const cam = useCam({ pos: [0.1, 2.5, 9.2], look: [0.1, 0.7, 0] }, { pos: [0.1, 2.4, 8.4], look: [0.1, 0.75, 0] });
  const cue = useCue();
  return (
    <AbsoluteFill>
      <Stage cam={cam} sky={C.indigo} floor={C.indigoLip}>
        <Toy pos={[-0.6, 0, 0]} turn={16} {...ME} talking mood="happy" armL={90} />
        <Robot pos={[0.7, 1.3, 0.2]} turn={-16} scale={0.9} mood="happy" />
      </Stage>
      <Pop at={cue("cinco")} style={{ left: 250, top: 330 }}>
        <Plate tone="white" pad="20px 50px" radius={40} style={{ fontSize: 120, fontWeight: 700, textAlign: "center", color: C.indigo }}>
          5 min<span style={{ fontSize: 64, color: C.inkSoft }}> /dia</span>
        </Plate>
      </Pop>
    </AbsoluteFill>
  );
};

const ep: EpisodeDef = {
  script,
  timing,
  visuals: {
    pergunta: Pergunta,
    branco: Branco,
    yeswhat: YesWhat,
    camera: Camera,
    treino: Treino,
    erro: Erro,
    corrige: Corrige,
    certo: Certo,
    volta: Volta,
    resposta: Resposta,
    pitch: Pitch,
    ritmo: Ritmo,
    fim: () => <EndCard />,
  },
};
export default ep;
