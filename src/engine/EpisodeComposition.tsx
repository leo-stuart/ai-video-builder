import React, { useMemo } from "react";
import { BrandProvider, Episode, episodeFrames, type Brand, type EpisodeDef } from "../kit";
import { buildEpisode } from "./SpecEpisode";
import type { EpisodeSpec } from "./types";

/** O que o Remotion (render, folhas de revisão) e o @remotion/player passam à composição única. */
export type EpisodeProps = { spec: EpisodeSpec; script: any; timing: any; brand: Brand };

/** Placeholder para o Studio abrir sem props: uma tela final vazia. */
export const DEFAULT_PROPS: EpisodeProps = {
  spec: { slug: "vazio", title: "vazio", world: { place: "cafe", look: {}, camStyle: "push", studioTone: "indigo", metaphor: "scale" }, beats: [{ id: "fim", type: "end-card", narration: "Fim." }] },
  script: { slug: "vazio", title: "vazio", scenes: [{ id: "fim", narration: "Fim.", captions: false }] },
  timing: { provider: "none", scenes: {} },
  brand: { name: "Marca" },
};

export const episodeDuration = (p: EpisodeProps) => episodeFrames({ script: p.script, timing: p.timing } as EpisodeDef);

export const EpisodeComposition: React.FC<EpisodeProps> = ({ spec, script, timing, brand }) => {
  const ep = useMemo(() => buildEpisode(spec, script, timing), [spec, script, timing]);
  return (
    <BrandProvider brand={brand}>
      <Episode ep={ep} />
    </BrandProvider>
  );
};
