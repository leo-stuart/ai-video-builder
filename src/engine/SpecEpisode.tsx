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
export const buildEpisode = (spec: EpisodeSpec, script: any, timing: any): EpisodeDef => {
  const ctx = { world: spec.world };
  const visuals: Record<string, React.FC> = {};
  for (const b of spec.beats) {
    // Cenas em código (custom:) ficam fora do MVP: o validador as recusa antes do render.
    if (b.type.startsWith("custom:")) throw new Error(`beat "${b.id}": tipos custom: ainda não são suportados.`);
    visuals[b.id] = () => <ScenePlayer data={b.scene ?? expand(b, spec.world)} ctx={ctx} />;
  }
  return { script, timing, visuals, progress: false } as EpisodeDef;
};
