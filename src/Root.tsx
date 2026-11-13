import React from "react";
import { Composition } from "remotion";
import { Episode, EpisodeDef, episodeFrames, FPS, H, W } from "./kit";
import { buildEpisode } from "./engine/SpecEpisode";

// Todo episódio em src/episodes/<slug>/index.tsx entra sozinho na lista.
const ctx = require.context("./episodes", true, /^\.\/[^/]+\/index\.tsx$/);
// As cenas são funções: não sobrevivem à serialização das props do Remotion,
// então cada episódio vira um componente fechado sobre a própria definição.
const episodes = ctx.keys().map((k) => {
  const ep: EpisodeDef = ctx(k).default;
  const Comp: React.FC = () => <Episode ep={ep} />;
  return { ep, Comp };
});

// Episódios declarativos: episode.json + script.json (compilado) + timing.json.
const specCtx = require.context("./episodes", true, /^\.\/[^/]+\/episode\.json$/);
const scriptCtx = require.context("./episodes", true, /^\.\/[^/]+\/script\.json$/);
const timingCtx = require.context("./episodes", true, /^\.\/[^/]+\/timing\.json$/);
const customCtx = require.context("./episodes", true, /^\.\/[^/]+\/custom\/[^/]+\.tsx$/);
const specs = specCtx.keys().map((k) => {
  const slug = k.split("/")[1];
  const customs: Record<string, React.FC> = {};
  customCtx.keys().filter((c) => c.startsWith(`./${slug}/custom/`)).forEach((c) => (customs[c.split("/").pop()!.replace(".tsx", "")] = customCtx(c).default));
  const ep = buildEpisode(specCtx(k), scriptCtx(`./${slug}/script.json`), timingCtx(`./${slug}/timing.json`), customs);
  const Comp: React.FC = () => <Episode ep={ep} />;
  return { ep, Comp };
});

export const Root: React.FC = () => (
  <>
    {[...episodes, ...specs].map(({ ep, Comp }) => (
      <Composition
        key={ep.script.slug}
        id={ep.script.slug}
        component={Comp}
        width={W}
        height={H}
        fps={FPS}
        durationInFrames={episodeFrames(ep)}
      />
    ))}
  </>
);
