import React from "react";
import { Composition } from "remotion";
import { BrandProvider, Episode, EpisodeDef, episodeFrames, FPS, H, W } from "./kit";
import { DEFAULT_PROPS, EpisodeComposition, episodeDuration, type EpisodeProps } from "./engine/EpisodeComposition";

// Composição única: o episódio vem por inputProps { spec, script, timing, brand }.
// Nenhum episódio é registrado em código.

/* ───────────── legado (só referência e catálogo) ─────────────
 * ep03 e catalogo são episódios antigos em TSX. Usam imagens `img/…` e áudio
 * `audio/…` do Pragma, que moram em workspaces/pragma/public/. Só renderizam
 * com VB_WORKSPACE (ou --workspace) apontando para o espaço de trabalho do
 * Pragma, que é quem monta o diretório público do bundle. */
const LEGACY_BRAND = { name: "Pragma", tagline: "Pare de estudar inglês. **Comece a falar.**", cta: "Link na bio", logo: "img/logo-mark.png", productShots: ["img/08-speak.jpg"] };
const legacyCtx = require.context("./legacy", true, /^\.\/[^/]+\/index\.tsx$/);
const legacy = legacyCtx.keys().map((k) => {
  const ep: EpisodeDef = legacyCtx(k).default;
  // As cenas são funções: não sobrevivem às props do Remotion, então cada episódio vira um componente fechado.
  const Comp: React.FC = () => (
    <BrandProvider brand={LEGACY_BRAND}>
      <Episode ep={ep} />
    </BrandProvider>
  );
  return { ep, Comp };
});

export const Root: React.FC = () => (
  <>
    <Composition
      id="Episode"
      component={EpisodeComposition as React.FC<any>}
      width={W}
      height={H}
      fps={FPS}
      durationInFrames={30}
      defaultProps={DEFAULT_PROPS}
      calculateMetadata={({ props }) => ({ durationInFrames: episodeDuration(props as unknown as EpisodeProps) })}
    />
    {legacy.map(({ ep, Comp }) => (
      <Composition key={ep.script.slug} id={ep.script.slug} component={Comp} width={W} height={H} fps={FPS} durationInFrames={episodeFrames(ep)} />
    ))}
  </>
);
