import React from "react";
import { EpisodeDef } from "../kit";
import { ScenePlayer } from "./ScenePlayer";
import { REGISTRY } from "./registry";
import type { Beat, EpisodeSpec, World } from "./types";

const expand = (b: Beat, w: World) => {
  const macro = REGISTRY[b.type];
  if (!macro) throw new Error(`beat "${b.id}": o tipo "${b.type}" não existe. Tipos: ${Object.keys(REGISTRY).join(", ")}`);
  return macro(b, w);
};

/** Transforma um episode.json (+ script e tempos) em um EpisodeDef que o Remotion sabe montar. */
export const buildEpisode = (spec: EpisodeSpec, script: any, timing: any, customs: Record<string, React.FC> = {}): EpisodeDef => {
  const ctx = { world: spec.world };
  const visuals: Record<string, React.FC> = {};
  for (const b of spec.beats) {
    if (b.type.startsWith("custom:")) {
      const C = customs[b.type.slice(7)];
      if (!C) throw new Error(`beat "${b.id}": falta src/episodes/${spec.slug}/custom/${b.type.slice(7)}.tsx`);
      visuals[b.id] = C;
    } else visuals[b.id] = () => <ScenePlayer data={b.scene ?? expand(b, spec.world)} ctx={ctx} />;
  }
  return { script, timing, visuals, progress: false } as EpisodeDef;
};
