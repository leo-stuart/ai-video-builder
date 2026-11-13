// CATÁLOGO: uma cena por cenário e por câmera de SHOT. Não é um episódio.
// Veja com: node scripts/sheet.mjs catalogo --per 1
import React from "react";
import { AbsoluteFill } from "remotion";
import { Anchor, Bars, Burst, C, COUNTER, Counter, EpisodeDef, Guy, Home, PLACES, Pile, Pin, Place, SHOT, Scale, School, Stamp, Street, Studio, VOCE, Verdict, Sfx, barTop, useAfter, useCue, useRamp, useShots, useSpring, useT } from "../../kit";
import script from "./script.json";
import timing from "./timing.json";

const visuals: Record<string, React.FC> = {};

(Object.keys(PLACES) as Place[]).forEach((place) => {
  visuals[`p${place}`] = () => <Counter cam={useShots([{ at: 0, from: SHOT.counter.wide }])} place={place} other={{ mood: "happy", talking: true, armL: 60 }} />;
});
(Object.keys(SHOT.counter) as (keyof typeof SHOT.counter)[]).forEach((k) => {
  visuals[`c${k.toLowerCase()}`] = () => <Counter cam={useShots([{ at: 0, from: SHOT.counter[k] }])} queue={k.startsWith("queue") ? 4 : 0} other={{ talking: true }} />;
});
(Object.keys(SHOT.street) as (keyof typeof SHOT.street)[]).forEach((k) => {
  visuals[`s${k.toLowerCase()}`] = () => <Street cam={useShots([{ at: 0, from: SHOT.street[k] }])} taxiX={3} />;
});
visuals.sdia = () => <Street cam={useShots([{ at: 0, from: SHOT.street.establish }])} night={false} sign="HOTEL" taxiX={3} />;
(Object.keys(SHOT.home) as (keyof typeof SHOT.home)[]).forEach((k) => {
  visuals[`h${k.toLowerCase()}`] = () => <Home cam={useShots([{ at: 0, from: SHOT.home[k] }])} bot={{ mood: "happy", talking: true }} />;
});
(Object.keys(SHOT.school) as (keyof typeof SHOT.school)[]).forEach((k) => {
  visuals[`e${k.toLowerCase()}`] = () => <School cam={useShots([{ at: 0, from: SHOT.school[k] }])} world={<Guy pos={[0, 0, 0.7]} {...VOCE} mood="happy" />} />;
});
visuals.twide = () => (
  <Studio cam={useShots([{ at: 0, from: SHOT.studio.wide }])}>
    <Scale scale={0.72} tilt={-17} left={<Pile n={5} />} />
  </Studio>
);
visuals.tside = () => {
  const cam = useShots([{ at: 0, from: SHOT.studio.side }]);
  return (
    <AbsoluteFill>
      <Studio cam={cam} tone="noite">
        <Bars values={[1, 0.12]} />
      </Studio>
      <Anchor cam={cam} p={barTop(0, 2, 1)}>
        <Pin dot={C.mint}>barTop(0, 2, 1)</Pin>
      </Anchor>
      <Anchor cam={cam} p={barTop(1, 2, 0.12)}>
        <Pin dot={C.red}>barTop(1, 2, 0.12)</Pin>
      </Anchor>
    </AbsoluteFill>
  );
};
visuals.tclose = () => (
  <Studio cam={useShots([{ at: 0, from: SHOT.studio.close }])} tone="menta">
    <Guy {...VOCE} mood="happy" talking armR={95} />
  </Studio>
);
visuals.gice = () => {
  const cam = useShots([{ at: 0, from: SHOT.counter.lowMe }]);
  return (
    <AbsoluteFill>
      <Counter cam={cam} ice={1} me={{ mood: "wide" }} />
      <Verdict ok={false} at={0} />
      <Anchor cam={cam} p={COUNTER.overMe}>
        <Pin dot={C.sky}>COUNTER.overMe</Pin>
      </Anchor>
    </AbsoluteFill>
  );
};
visuals.gburst = () => {
  const t = useT();
  return (
    <AbsoluteFill>
      <Counter cam={useShots([{ at: 0, from: SHOT.counter.wide }])} itemOut={1} me={{ mood: "happy", armR: 85 }} other={{ mood: "happy", armL: 75 }} world={<Burst pos={COUNTER.item} k={Math.min(0.99, t / 1.6)} color={C.gold} n={22} power={3} />} />
      <Verdict ok at={0} />
      <div style={{ position: "absolute", left: 300, top: 260 }}>
        <Stamp at={0} tone="mint" size={92}>
          Stamp
        </Stamp>
      </div>
    </AbsoluteFill>
  );
};
visuals.gpile = () => {
  const cam = useShots([{ at: 0, from: SHOT.studio.wide }]);
  return (
    <AbsoluteFill>
      <Studio cam={cam} tone="coral">
        <Pile n={8} k={1} />
      </Studio>
      <Anchor cam={cam} p={[0, 1.7, 0]}>
        <Pin dot={C.gold}>Pin sobre Pile</Pin>
      </Anchor>
    </AbsoluteFill>
  );
};

/* RECEITAS para a cena 9 (a causa). Copie o componente inteiro para o seu episódio. */

/** Barras: muito de um, quase nada do outro. */
const CausaBarras: React.FC = () => {
  const cue = useCue();
  const grow = useSpring(cue("problema") + 0.2, false);
  const showSmall = useAfter(cue("falou"));
  const cam = useShots([
    { at: 0, from: SHOT.studio.wide },
    { at: cue("É"), from: SHOT.studio.side },
  ]);
  return (
    <AbsoluteFill>
      <Studio cam={cam} tone="noite">
        <Bars values={[1, 0.08]} k={grow} />
      </Studio>
      <Sfx name="bong" at={cue("problema") + 0.25} volume={0.5} />
      <Sfx name="tick" at={cue("É")} />
      <Sfx name="pop" at={cue("falou")} />
      <Anchor cam={cam} p={barTop(0, 2, grow)}>
        <Pin dot={C.mint} size={36}>
          Lendo: 6 anos
        </Pin>
      </Anchor>
      <Anchor cam={cam} p={barTop(1, 2, 0.08)}>
        {showSmall && (
          <Pin dot={C.red} size={36}>
            Falando: 2 horas
          </Pin>
        )}
      </Anchor>
    </AbsoluteFill>
  );
};

/** Pilha: os anos de estudo caem um por um; ao lado, "você" continua mudo. */
const CausaPilha: React.FC = () => {
  const cue = useCue();
  const fill = useRamp(cue("problema"), cue("É"));
  const sad = useAfter(cue("falou"));
  const cam = useShots([
    { at: 0, from: SHOT.studio.wide },
    { at: cue("É"), from: SHOT.studio.side },
  ]);
  return (
    <AbsoluteFill>
      <Studio cam={cam} tone="coral">
        <Pile n={6} k={fill} pos={[-0.8, 0, 0]} />
        <Guy pos={[0.8, 0, 0]} turn={-20} {...VOCE} mood={sad ? "sad" : "ok"} outL={sad ? 35 : 0} outR={sad ? 35 : 0} />
      </Studio>
      <Sfx name="tick" at={cue("É")} />
      <Sfx name="bong" at={cue("falou")} volume={0.5} />
      <Anchor cam={cam} p={[-0.8, 1.45, 0]}>
        <Pin dot={C.mint} size={36}>
          6 anos de curso
        </Pin>
      </Anchor>
      <Anchor cam={cam} p={[0.8, 2.4, 0]}>
        {sad && (
          <Pin dot={C.red} size={36}>
            Nunca falou
          </Pin>
        )}
      </Anchor>
    </AbsoluteFill>
  );
};
visuals.rbarras = CausaBarras;
visuals.rpilha = CausaPilha;

const ep: EpisodeDef = { script, timing, visuals };
export default ep;
