// EPISÓDIO-MODELO. Copie a forma: cada cena escolhe um cenário pronto
// (Counter, Street, Home, School, Studio), uma ou duas câmeras de SHOT,
// e liga humor, fala e objetos à voz com cue().
import React from "react";
import { AbsoluteFill } from "remotion";
import {
  Anchor,
  Block,
  Burst,
  C,
  COUNTER,
  Counter,
  EndCard,
  EpisodeDef,
  Guy,
  HOME,
  Home,
  Phone,
  Pin,
  Plate,
  Pop,
  STREET,
  SHOT,
  Scale,
  School,
  Sfx,
  Stamp,
  Street,
  Studio,
  VOCE,
  Verdict,
  useAfter,
  useBounce,
  useCue,
  useRamp,
  useScene,
  useShots,
  useSpring,
  useT,
} from "../../kit";
import script from "./script.json";
import timing from "./timing.json";

/* 1. ABERTURA — narrador. Plano geral do lugar, corte para "você" na palavra forte. */
const Curso: React.FC = () => {
  const cue = useCue();
  const cut = cue("seis");
  const after = useAfter(cut);
  const walked = useRamp(0, cut);
  const hop = useBounce(cut, 0.12);
  const z = -1.0 + walked * 1.7;
  const cam = useShots([
    { at: 0, from: SHOT.school.establish },
    { at: cut, from: SHOT.school.onMe },
  ]);
  return (
    <AbsoluteFill>
      <School
        cam={cam}
        world={
          <>
            <Guy pos={[0, 0, z]} {...VOCE} mood="happy" walk={after ? 0 : 1} armR={after ? 150 : 0} hop={hop} />
            {after && <Block size={[0.3, 0.22, 0.02]} pos={[0.33, 2.2 + hop, z + 0.1]} color={C.white} r={0.01} />}
          </>
        }
      />
      <Sfx name="whoosh" at={cut} volume={0.3} />
      <Pop at={cut + 0.05} style={{ left: 90, top: 250 }}>
        <Plate tone="gold" pad="10px 40px" radius={30} style={{ fontSize: 110, fontWeight: 700, color: C.ink, background: C.gold }}>
          6 anos
        </Plate>
      </Pop>
      <Anchor cam={cam} p={[0.45, 2.55, z]}>{after && <Pin dot={C.mint}>Diploma</Pin>}</Anchor>
    </AbsoluteFill>
  );
};

/* 2. CHEGADA — narrador. A rua de noite, táxi passando; corte para a barriga roncando. */
const NY: React.FC = () => {
  const cue = useCue();
  const t = useT();
  const cut = cue("morrendo");
  const after = useAfter(cut);
  const cam = useShots([
    { at: 0, from: SHOT.street.establish },
    { at: cut, from: SHOT.street.onMe },
  ]);
  return (
    <AbsoluteFill>
      <Street cam={cam} taxiX={-9 + t * 9} me={after ? { mood: "sad", armL: 55, armR: 55, lean: 8 } : { turn: 50, walk: 0.6 }} />
      <Sfx name="whoosh" at={0.05} volume={0.3} />
      <Pop at={0.15} from="down" style={{ left: 0, right: 0, top: 240, display: "flex", justifyContent: "center" }}>
        <Pin dot={C.gold} size={48}>
          Nova York
        </Pin>
      </Pop>
      <Anchor cam={cam} p={STREET.belly} align="center">
        {after && (
          <div style={{ transform: `rotate(${Math.sin(t * 30) * 4}deg)` }}>
            <Pin dot={C.red} size={44}>
              Ronc…
            </Pin>
          </div>
        )}
      </Anchor>
      <Sfx name="bong" at={cut + 0.15} volume={0.35} />
    </AbsoluteFill>
  );
};

/* 3. A PERGUNTA — fala do outro. Plano geral, corte para quem fala. */
const Pergunta: React.FC = () => {
  const { dur } = useScene();
  const cam = useShots([
    { at: 0, from: SHOT.counter.wide },
    { at: dur * 0.42, from: SHOT.counter.onOther },
  ]);
  return (
    <AbsoluteFill>
      <Counter cam={cam} place="cafe" other={{ mood: "happy", talking: true, armL: 60 }} />
      <Sfx name="pop" at={0.02} />
      <Sfx name="tick" at={dur * 0.42} />
    </AbsoluteFill>
  );
};

/* 4. O BRANCO — narrador. A ideia ao pé da letra: "travar" vira um bloco de gelo. */
const Trava: React.FC = () => {
  const cue = useCue();
  const hit = cue("trava");
  const after = useAfter(hit);
  const late = useAfter(hit + 0.5);
  const ice = useSpring(hit);
  const cam = useShots([
    { at: 0, from: SHOT.counter.onMe },
    { at: hit + 0.45, from: SHOT.counter.lowMe },
  ]);
  return (
    <AbsoluteFill>
      <Counter cam={cam} place="cafe" ice={ice} me={{ mood: "wide", sweat: !after, shiver: after ? 0 : 1, lean: -6, outL: 20, outR: 20 }} />
      <Sfx name="bong" at={hit} volume={0.7} />
      <Sfx name="tick" at={hit + 0.45} />
      <Verdict ok={false} at={hit + 0.1} />
      <Anchor cam={cam} p={COUNTER.overMe}>{late && <Pin dot={C.sky}>Travou</Pin>}</Anchor>
    </AbsoluteFill>
  );
};

/* 5. FALA DE "VOCÊ" — um plano só, fechado em quem fala. */
const Yes: React.FC = () => {
  const cam = useShots([{ at: 0, from: SHOT.counter.onMe }]);
  return (
    <AbsoluteFill>
      <Counter cam={cam} place="cafe" ice={1} me={{ mood: "wide", lean: -6, outL: 20, outR: 20 }} />
      <Verdict ok={false} at={-1} />
    </AbsoluteFill>
  );
};

/* 6. REAÇÃO DO OUTRO — fechado em quem fala, com o humor da reação. */
const What: React.FC = () => {
  const cam = useShots([{ at: 0, from: SHOT.counter.onOther }]);
  return (
    <AbsoluteFill>
      <Counter cam={cam} place="cafe" ice={1} other={{ mood: "angry", talking: true, lean: 12, headTilt: 8 }} />
      <Sfx name="tick" at={0.02} />
    </AbsoluteFill>
  );
};

/* 7. CONSEQUÊNCIA — narrador. A fila cresce um por um; corte para o outro sem entender. */
const Fila: React.FC = () => {
  const cue = useCue();
  const cut = cue("ninguém");
  const after = useAfter(cut);
  const grow = useRamp(0.15, cut - 0.2);
  const queue = after ? 4 : 1 + Math.floor(grow * 3.99);
  const cam = useShots([
    { at: 0, from: SHOT.counter.queue, to: SHOT.counter.queueFar },
    { at: cut, from: SHOT.counter.onOther },
  ]);
  return (
    <AbsoluteFill>
      <Counter cam={cam} place="cafe" ice={1} queue={queue} other={after ? { mood: "sad", outL: 55, outR: 55, armL: 35, armR: 35, headTurn: 35 } : { mood: "angry" }} />
      {[0.2, 0.45, 0.7].map((a) => (
        <Sfx key={a} name="pop" at={a} volume={0.4} />
      ))}
      <Sfx name="tick" at={cut} />
      <Anchor cam={cam} p={COUNTER.overQueue}>
        {!after && queue > 1 && (
          <Pin dot={C.red} size={46}>
            {`Fila +${queue}`}
          </Pin>
        )}
      </Anchor>
    </AbsoluteFill>
  );
};

/* 8. O PREJUÍZO — narrador. De volta à rua, de mãos vazias, com o número na tela. */
const Fora: React.FC = () => {
  const cue = useCue();
  const t = useT();
  const hit = cue("sem");
  const after = useAfter(hit);
  const cam = useShots([{ at: 0, from: SHOT.street.door, to: SHOT.street.onMe }]);
  return (
    <AbsoluteFill>
      <Street cam={cam} taxiX={3 + t * 7} me={{ turn: -15, mood: "sad", lean: 10, headTilt: -8, shiver: 0.5, outL: after ? 40 : 0, outR: after ? 40 : 0, armL: after ? 40 : 0, armR: after ? 40 : 0 }} />
      <Sfx name="whoosh" at={0.02} volume={0.3} />
      <Sfx name="bong" at={hit} volume={0.5} />
      <Pop at={hit} style={{ left: 250, top: 300 }}>
        <Plate tone="red" pad="14px 44px" radius={30} style={{ fontSize: 96, fontWeight: 700 }}>
          0 cafés
        </Plate>
      </Pop>
    </AbsoluteFill>
  );
};

/* 9. A CAUSA — narrador. Metáfora física no estúdio: a balança pende para o que sobra. */
const Balanca: React.FC = () => {
  const cue = useCue();
  const a = cue("problema");
  const b = cue("falou");
  const K = 0.72;
  const tilt = -useSpring(a + 0.2) * 17;
  const drop = useSpring(a + 0.05, false);
  const showLeft = useAfter(a + 0.3);
  const showRight = useAfter(b);
  const cam = useShots([
    { at: 0, from: SHOT.studio.wide },
    { at: cue("É"), from: SHOT.studio.side },
  ]);
  const r = (tilt * Math.PI) / 180;
  return (
    <AbsoluteFill>
      <Studio cam={cam} tone="indigo">
        <Scale
          scale={K}
          tilt={tilt}
          left={
            <group position={[0, (1 - drop) * 3, 0]}>
              {[C.coral, C.mint, C.gold, C.lilac, C.sky].map((c, i) => (
                <Block key={c} size={[0.62 - (i % 2) * 0.08, 0.13, 0.44]} pos={[(i % 2) * 0.05 - 0.02, 0.07 + i * 0.135, 0]} rot={[0, i * 0.2, 0]} color={c} r={0.03} rough={0.5} />
              ))}
            </group>
          }
          right={showRight ? <Block size={[0.16, 0.12, 0.12]} pos={[0, 0.07, 0]} color={C.white} r={0.04} /> : null}
        />
      </Studio>
      <Sfx name="bong" at={a + 0.25} volume={0.5} />
      <Sfx name="tick" at={cue("É")} />
      <Sfx name="pop" at={b} />
      <Anchor cam={cam} p={[-1.25 * Math.cos(r) * K, (2.2 + 1.25 * Math.sin(r)) * K, 0]} dy={-10}>
        {showLeft && (
          <Pin dot={C.mint} size={36}>
            Ler e ouvir: 6 anos
          </Pin>
        )}
      </Anchor>
      <Anchor cam={cam} p={[1.25 * Math.cos(r) * K, (1.6 - 1.25 * Math.sin(r)) * K, 0]} dy={-10}>
        {showRight && (
          <Pin dot={C.red} size={36}>
            Falar: quase zero
          </Pin>
        )}
      </Anchor>
    </AbsoluteFill>
  );
};

/* 10. O APP ENTRA — narrador. Em casa; o tutor sai do celular na palavra "Pragma". */
const Pragma: React.FC = () => {
  const cue = useCue();
  const hit = cue("Pragma");
  const pop = useSpring(hit);
  const cam = useShots([
    { at: 0, from: SHOT.home.wide },
    { at: hit, from: SHOT.home.onBot },
  ]);
  return (
    <AbsoluteFill>
      <Home cam={cam} me={{ headTurn: 20 }} bot={{ mood: "happy", scale: pop }} />
      <Sfx name="whoosh" at={0.02} volume={0.3} />
      <Sfx name="ding" at={hit} volume={0.5} />
      <Anchor cam={cam} p={HOME.overBot}>{pop > 0.7 && <Pin dot={C.indigo}>Tutor de IA</Pin>}</Anchor>
    </AbsoluteFill>
  );
};

/* 11. FALA DO TUTOR — fechado no tutor. */
const Treino: React.FC = () => {
  const cam = useShots([{ at: 0, from: SHOT.home.onBot }]);
  return <Home cam={cam} bot={{ mood: "happy", talking: true }} />;
};

/* 12. O ERRO — fala de "você". No fim da fala: X, som de erro e o que a frase quis dizer. */
const Erro: React.FC = () => {
  const { dur } = useScene();
  const hit = dur - 0.3;
  const after = useAfter(hit);
  const speaking = !useAfter(hit - 0.2);
  const cam = useShots([{ at: 0, from: SHOT.home.onMe }]);
  return (
    <AbsoluteFill>
      <Home cam={cam} me={{ mood: after ? "sad" : "ok", talking: speaking }} bot={{ mood: after ? "wide" : "neutral", tilt: after ? 12 : 0 }} />
      <Sfx name="tick" at={0.02} />
      <Sfx name="bong" at={hit} />
      <Verdict ok={false} at={hit} />
      <Pop at={hit + 0.05} style={{ left: 270, top: 270 }}>
        <Plate tone="red" pad="14px 34px" radius={26} style={{ fontSize: 60, fontWeight: 700 }}>
          = "quero ir embora"
        </Plate>
      </Pop>
    </AbsoluteFill>
  );
};

/* 13. A CORREÇÃO — fala do tutor. A frase certa aparece grande na palavra em que ele a diz. */
const Corrige: React.FC = () => {
  const cue = useCue();
  const cam = useShots([{ at: 0, from: SHOT.home.onBot }]);
  return (
    <AbsoluteFill>
      <Home cam={cam} bot={{ mood: "happy", talking: true }} />
      <Sfx name="tick" at={0.02} />
      <Sfx name="pop" at={cue("to")} />
      <Pop at={cue("to")} style={{ left: 90, top: 250 }}>
        <Plate tone="mint" width={900} pad="30px 30px" style={{ fontSize: 110, fontWeight: 700, textAlign: "center" }}>
          To go, please.
        </Plate>
      </Pop>
    </AbsoluteFill>
  );
};

/* 14. O ACERTO — fala de "você". No fim: certo, som, pulo, estilhaços e carimbo. */
const Certo: React.FC = () => {
  const { dur } = useScene();
  const hit = dur - 0.45;
  const after = useAfter(hit);
  const speaking = !useAfter(hit - 0.1);
  const k = useRamp(hit, hit + 0.7);
  const hop = useBounce(hit, 0.3);
  const cam = useShots([
    { at: 0, from: SHOT.home.onMe },
    { at: hit, from: SHOT.home.both },
  ]);
  return (
    <AbsoluteFill>
      <Home
        cam={cam}
        me={{ mood: after ? "happy" : "ok", talking: speaking, hop, armR: after ? 170 : 80, armL: after ? 170 : 0 }}
        bot={{ mood: "happy" }}
        world={<Burst pos={[0.1, 1.2, 0.6]} k={k} color={C.gold} n={18} power={2.6} />}
      />
      <Sfx name="tick" at={0.02} />
      <Sfx name="ding" at={hit} />
      <Verdict ok at={hit} />
      <div style={{ position: "absolute", left: 320, top: 260 }}>
        <Stamp at={hit + 0.05} tone="mint" size={96}>
          Natural
        </Stamp>
      </div>
    </AbsoluteFill>
  );
};

/* 15. O HÁBITO (pitch) — narrador. No estúdio, sete dias acendem; corte para casa, com a tela real do app. */
const Habito: React.FC = () => {
  const cue = useCue();
  const t = useT();
  const cut = cue("com");
  const after = useAfter(cut);
  const cam = useShots([
    { at: 0, from: SHOT.studio.wide },
    { at: cut, from: SHOT.home.both },
  ]);
  const days = [0, 1, 2, 3, 4, 5, 6];
  const lit = (i: number) => Math.min(1, Math.max(0, (t - 0.1 - i * 0.16) / 0.15));
  return (
    <AbsoluteFill>
      {after ? (
        <Home cam={cam} me={{ mood: "happy", talking: true }} bot={{ mood: "happy" }} />
      ) : (
        <Studio cam={cam} tone="indigo">
          {days.map((i) => (
            <Block key={i} size={[0.38, 0.16 + lit(i) * 0.9, 0.38]} pos={[-1.38 + i * 0.46, (0.16 + lit(i) * 0.9) / 2, 0]} color={lit(i) > 0.5 ? C.mint : "#6C63D9"} glow={lit(i) * 0.25} r={0.06} rough={0.4} />
          ))}
        </Studio>
      )}
      {days.map((i) => (
        <Sfx key={i} name="tick" at={0.12 + i * 0.16} volume={0.4} />
      ))}
      <Pop at={0.05} out={cut} style={{ left: 240, top: 300 }}>
        <Plate tone="white" pad="14px 46px" radius={36} style={{ fontSize: 120, fontWeight: 700, textAlign: "center", color: C.indigo }}>
          5 min<span style={{ fontSize: 62, color: C.inkSoft }}> /dia</span>
        </Plate>
      </Pop>
      <Sfx name="whoosh" at={cut} volume={0.3} />
      <Pop at={cue("corrige")} from="down" style={{ left: 405, top: 235 }}>
        <Phone src="img/08-speak.jpg" width={270} />
      </Pop>
    </AbsoluteFill>
  );
};

/* 16. A VOLTA — narrador. Mesma rua, agora de dia, andando firme. */
const Volta: React.FC = () => {
  const t = useT();
  const { dur } = useScene();
  const cam = useShots([{ at: 0, from: SHOT.street.walk }]);
  return (
    <AbsoluteFill>
      <Street cam={cam} night={false} taxiX={2.5 + t * 6} me={null} world={<Guy pos={[-3.2 + (t / dur) * 2.6, 0.16, -0.5]} turn={90} {...VOCE} mood="happy" walk={1} />} />
      <Sfx name="whoosh" at={0.02} volume={0.3} />
      <Pop at={0.1} from="down" style={{ left: 0, right: 0, top: 240, display: "flex", justifyContent: "center" }}>
        <Pin dot={C.mint} size={48}>
          No dia seguinte
        </Pin>
      </Pop>
    </AbsoluteFill>
  );
};

/* 17. A MESMA PERGUNTA — repete a cena 3, só o plano fechado. */
const Revanche: React.FC = () => {
  const cam = useShots([{ at: 0, from: SHOT.counter.onOther }]);
  return (
    <AbsoluteFill>
      <Counter cam={cam} place="cafe" me={{ mood: "happy" }} other={{ mood: "happy", talking: true, armL: 60 }} />
      <Sfx name="tick" at={0.02} />
    </AbsoluteFill>
  );
};

/* 18. A VITÓRIA — fala de "você". Fechado na fala; corte para o geral com o objeto vindo e a festa. */
const Resposta: React.FC = () => {
  const { dur } = useScene();
  const hit = dur - 1.25;
  const after = useAfter(hit);
  const speaking = !useAfter(hit - 0.1);
  const out = useSpring(hit);
  const k = useRamp(hit, hit + 0.9);
  const hop = useBounce(hit, 0.14);
  const cam = useShots([
    { at: 0, from: SHOT.counter.onMe },
    { at: hit, from: SHOT.counter.wide },
  ]);
  return (
    <AbsoluteFill>
      <Counter
        cam={cam}
        place="cafe"
        itemOut={out}
        me={{ mood: "happy", talking: speaking, armR: after ? 85 : 20, hop }}
        other={{ mood: "happy", armL: after ? 75 : 0 }}
        world={<Burst pos={COUNTER.item} k={k} color={C.gold} n={22} power={3} />}
      />
      <Sfx name="tick" at={0.02} />
      <Sfx name="ding" at={hit} />
      <Verdict ok at={hit} />
      <div style={{ position: "absolute", left: 300, top: 260 }}>
        <Stamp at={hit + 0.05} tone="mint" rotate={-6} size={92}>
          Sem travar
        </Stamp>
      </div>
    </AbsoluteFill>
  );
};

const ep: EpisodeDef = {
  script,
  timing,
  visuals: {
    curso: Curso,
    ny: NY,
    pergunta: Pergunta,
    trava: Trava,
    yes: Yes,
    what: What,
    fila: Fila,
    fora: Fora,
    balanca: Balanca,
    pragma: Pragma,
    treino: Treino,
    erro: Erro,
    corrige: Corrige,
    certo: Certo,
    habito: Habito,
    volta: Volta,
    revanche: Revanche,
    resposta: Resposta,
    /* 19. FECHO — sempre EndCard. */
    fim: () => <EndCard />,
  },
};
export default ep;
