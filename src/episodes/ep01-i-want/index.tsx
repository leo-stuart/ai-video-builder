import React from "react";
import { AbsoluteFill } from "remotion";
import {
  Bg,
  Big,
  Bubble,
  C,
  Chip,
  EndCard,
  EpisodeDef,
  Float,
  Mark,
  Meter,
  Person,
  Phone,
  Plate,
  Pop,
  Prag,
  Shake,
  Stamp,
  Wave,
  useCue,
  useT,
} from "../../kit";
import script from "./script.json";
import timing from "./timing.json";

const Cup: React.FC<{ size?: number }> = ({ size = 150 }) => (
  <svg width={size} height={size} viewBox="0 0 150 150" fill="none" stroke={C.ink} strokeWidth={8} strokeLinejoin="round" strokeLinecap="round">
    <path d="M52 8 Q40 22 52 36 M82 8 Q70 22 82 36" stroke={C.muted} />
    <path d="M24 54 H112 L104 132 Q103 140 94 140 H42 Q33 140 32 132 Z" fill={C.white} />
    <path d="M112 70 H126 Q140 70 140 86 Q140 104 122 104 H108" />
    <path d="M30 84 H106" stroke={C.coral} strokeWidth={14} />
  </svg>
);

const En: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ color: C.indigo }}>{children}</span>;

/** Cliente pede café; o atendente fecha a cara quando a narração diz "grosso". */
const Hook: React.FC = () => {
  const cue = useCue();
  const t = useT();
  const rude = t >= cue("grosso");
  return (
    <AbsoluteFill>
      <Bg />
      <Pop at={0.05} from="down" style={{ left: 0, right: 0, top: 250, display: "flex", justifyContent: "center" }}>
        <Chip tone="coral">Cafeteria · Nova York</Chip>
      </Pop>
      <Pop at={0.35} style={{ left: 80, top: 400 }}>
        <Bubble width={720} tail="left" style={{ fontSize: 88, fontWeight: 700, whiteSpace: "nowrap" }}>
          I want a coffee.
        </Bubble>
      </Pop>
      <Pop at={0.1} from="left" style={{ left: 110, top: 670 }}>
        <Person size={580} color={C.gold} mood="smile" talking={t > 0.4 && t < 1.6} armR={70} look={1} />
      </Pop>
      <Float amp={8} style={{ left: 450, top: 930 }}>
        <Cup size={180} />
      </Float>
      <Shake at={cue("grosso")} style={{ left: 700, top: 670 }}>
        <Pop at={0.2} from="right" style={{ left: 0, top: 0 }}>
          <Person size={580} color={C.red} accessory="bowtie" mood={rude ? "frown" : "smile"} look={-1} armL={rude ? 150 : 12} armR={rude ? 150 : 12} />
        </Pop>
      </Shake>
      <Pop at={cue("grosso")} style={{ left: 800, top: 440 }}>
        <Big size={190} color={C.red} width={200}>
          ?!
        </Big>
      </Pop>
    </AbsoluteFill>
  );
};

/** A frase leva um carimbo de ORDEM e o medidor de tom despenca. */
const Ordem: React.FC = () => {
  const cue = useCue();
  return (
    <AbsoluteFill>
      <Bg color={C.coralSoft} />
      <Pop at={0.05} style={{ left: 90, top: 400 }}>
        <Plate width={900} pad="56px 40px" style={{ fontSize: 100, fontWeight: 700, textAlign: "center" }}>
          I want a coffee.
        </Plate>
      </Pop>
      <div style={{ position: "absolute", left: 360, top: 560 }}>
        <Stamp at={cue("ordem")}>Ordem</Stamp>
      </div>
      <Pop at={cue("não", 0)} from="up" style={{ left: 130, top: 960 }}>
        <Meter at={cue("ordem")} from={0.5} to={0.1} left="Seco" right="Educado" />
      </Pop>
    </AbsoluteFill>
  );
};

/** A regra em uma linha: pedido educado = pergunta. */
const Pergunta: React.FC = () => {
  const cue = useCue();
  return (
    <AbsoluteFill>
      <Bg />
      <Pop at={0.1} from="down" style={{ left: 90, top: 300 }}>
        <Big size={120}>
          Pedido educado
          <br />= <b>pergunta</b>
        </Big>
      </Pop>
      <Pop at={cue("pergunta")} style={{ left: 700, top: 660 }}>
        <Float amp={14}>
          <Big size={420} color={C.indigo} width={300}>
            ?
          </Big>
        </Float>
      </Pop>
      <Pop at={0.2} from="up" style={{ left: 90, top: 720 }}>
        <Prag size={600} mood="happy" talking />
      </Pop>
    </AbsoluteFill>
  );
};

/** A troca certa: o medidor sobe até "educado". */
const Could: React.FC = () => {
  const cue = useCue();
  return (
    <AbsoluteFill>
      <Bg color={C.mintSoft} />
      <Pop at={0.05} from="down" style={{ left: 0, right: 0, top: 270, display: "flex", justifyContent: "center" }}>
        <Chip tone="mint">Troca por</Chip>
      </Pop>
      <Pop at={cue("could")} style={{ left: 90, top: 400 }}>
        <Plate width={900} pad="50px 40px" style={{ fontSize: 96, fontWeight: 700, textAlign: "center" }}>
          <En>Could I get</En> a coffee, <En>please?</En>
        </Plate>
      </Pop>
      <Pop at={cue("please")} style={{ left: 880, top: 350 }}>
        <Mark ok size={140} />
      </Pop>
      <Pop at={0.2} from="up" style={{ left: 130, top: 960 }}>
        <Meter at={cue("please")} from={0.1} to={0.92} left="Seco" right="Educado" />
      </Pop>
    </AbsoluteFill>
  );
};

/** A segunda opção, e agora o atendente entrega o café sorrindo. */
const Like: React.FC = () => {
  const cue = useCue();
  const t = useT();
  return (
    <AbsoluteFill>
      <Bg color={C.goldSoft} />
      <Pop at={0.05} from="down" style={{ left: 0, right: 0, top: 270, display: "flex", justifyContent: "center" }}>
        <Chip tone="gold">Ou então</Chip>
      </Pop>
      <Pop at={cue("I'd")} style={{ left: 90, top: 400 }}>
        <Bubble width={900} tail="left" style={{ fontSize: 92, fontWeight: 700, textAlign: "center" }}>
          <En>I'd like</En> a coffee, <En>please.</En>
        </Bubble>
      </Pop>
      <Pop at={0.05} from="left" style={{ left: 110, top: 720 }}>
        <Person size={540} color={C.gold} mood="grin" talking={t > cue("I'd") && t < cue("please") + 0.4} armR={75} look={1} />
      </Pop>
      <Pop at={cue("please")} style={{ left: 455, top: 940 }}>
        <Cup size={170} />
      </Pop>
      <Pop at={0.1} from="right" style={{ left: 710, top: 720 }}>
        <Person size={540} color={C.red} accessory="bowtie" mood="grin" look={-1} armL={80} />
      </Pop>
    </AbsoluteFill>
  );
};

/** Lado a lado: a mesma ideia, um jeito seco e um educado. */
const Tom: React.FC = () => {
  const cue = useCue();
  const row = (ok: boolean, text: React.ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
      <Mark ok={ok} size={130} />
      <Plate tone={ok ? "mint" : "red"} width={740} pad="38px 40px" style={{ fontSize: 68, fontWeight: 700 }}>
        {text}
      </Plate>
    </div>
  );
  return (
    <AbsoluteFill>
      <Bg />
      <Pop at={0.05} from="left" style={{ left: 80, top: 360 }}>
        {row(false, "I want a coffee.")}
      </Pop>
      <Pop at={cue("tom")} from="right" style={{ left: 80, top: 640 }}>
        {row(true, "Could I get a coffee, please?")}
      </Pop>
      <Pop at={cue("completamente")} from="up" style={{ left: 320, top: 930 }}>
        <Prag size={440} mood="wink" />
      </Pop>
    </AbsoluteFill>
  );
};

/** A virada: na hora de falar, dá branco. As opções giram na cabeça. */
const Travar: React.FC = () => {
  const cue = useCue();
  const hard = cue("difícil");
  return (
    <AbsoluteFill>
      <Bg color={C.night} />
      {[
        { text: "I want…?", left: 90, top: 330, at: hard, tone: "red" as const },
        { text: "Can I…?", left: 640, top: 420, at: hard + 0.25, tone: "gold" as const },
        { text: "Could I…?", left: 130, top: 600, at: hard + 0.5, tone: "mint" as const },
      ].map((b, i) => (
        <Pop key={b.text} at={b.at} style={{ left: b.left, top: b.top }}>
          <Float amp={14} speed={0.8 + i * 0.3}>
            <Plate tone={b.tone} pad="22px 40px" radius={999} style={{ fontSize: 64, whiteSpace: "nowrap" }}>
              {b.text}
            </Plate>
          </Float>
        </Pop>
      ))}
      <Pop at={0.05} from="up" style={{ left: 400, top: 730 }}>
        <Shake at={hard} dur={3} amp={5}>
          <Person size={580} color={C.gold} mood="open" sweat armL={150} armR={150} line={C.white} />
        </Shake>
      </Pop>
    </AbsoluteFill>
  );
};

/** O app: a tela de conversa real, o Prag falando e a onda de voz. */
const App: React.FC = () => {
  const cue = useCue();
  return (
    <AbsoluteFill>
      <Bg color={C.indigoSoft} />
      <Pop at={0.05} from="up" style={{ left: 90, top: 270 }}>
        <Phone src="img/08-speak.jpg" width={430} tilt={-4} />
      </Pop>
      <Pop at={cue("voz")} style={{ left: 560, top: 330 }}>
        <Bubble tone="indigo" tail="left" width={420} style={{ fontSize: 60 }}>
          Could I get a coffee, please?
        </Bubble>
      </Pop>
      <Pop at={cue("voz", 0, 0.3)} style={{ left: 600, top: 640 }}>
        <Wave />
      </Pop>
      <Pop at={cue("tutor")} from="right" style={{ left: 560, top: 800 }}>
        <Prag size={400} mood="happy" talking />
      </Pop>
    </AbsoluteFill>
  );
};

const ep: EpisodeDef = {
  script,
  timing,
  visuals: {
    hook: Hook,
    ordem: Ordem,
    pergunta: Pergunta,
    could: Could,
    like: Like,
    tom: Tom,
    travar: Travar,
    app: App,
    fim: () => <EndCard />,
  },
};
export default ep;
