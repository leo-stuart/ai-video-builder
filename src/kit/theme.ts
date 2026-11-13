import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

/** Cores do design system do Pragma (Codigo/lib/design_system/pragma_palette.dart). */
export const C = {
  cream: "#FFF9F1",
  creamAlt: "#FBF4EA",
  sand: "#EFE8DD",
  border: "#EDE4D6",
  borderLip: "#E2D6C4",
  ink: "#1E1B4B",
  inkSoft: "#67648B",
  muted: "#AEAAC4",
  white: "#FFFFFF",
  indigo: "#4F46E5",
  indigoLip: "#3730A3",
  indigoSoft: "#EEEDFF",
  mint: "#19C99A",
  mintLip: "#0E9F74",
  mintSoft: "#DDF8EE",
  coral: "#FF7A59",
  coralLip: "#E0603F",
  coralSoft: "#FFE9E2",
  red: "#E5484D",
  redLip: "#C7353A",
  redSoft: "#FFE6E1",
  gold: "#FFC234",
  goldLip: "#E5A512",
  goldSoft: "#FFF1CC",
  lilac: "#B57CFF",
  lilacLip: "#9257E8",
  lilacSoft: "#F1E8FF",
  teal: "#17B0A6",
  sky: "#28C5E7",
  night: "#14122E",
} as const;

export const F = {
  display: "Fredoka",
  body: "Nunito",
} as const;

export const W = 1080;
export const H = 1920;
export const FPS = 30;

/**
 * Área segura: a interface do Reels/TikTok/Shorts cobre o topo, o rodapé e a
 * coluna de botões à direita. Nada importante fora deste retângulo.
 */
export const SAFE = { top: 220, bottom: 1500, left: 60, right: 960 } as const;

/** Linha de base das legendas (centro do bloco). */
export const CAPTION_Y = 1390;

let loading: Promise<unknown> | null = null;
/** Carrega as fontes da marca. A promessa resolve quando já dá para desenhar com elas. */
export const loadFonts = () => {
  loading ??= Promise.all([
    loadFont({ family: F.display, url: staticFile("fonts/Fredoka.ttf"), weight: "300 700" }),
    loadFont({ family: F.body, url: staticFile("fonts/Nunito-Bold.ttf"), weight: "700" }),
    loadFont({ family: F.body, url: staticFile("fonts/Nunito-ExtraBold.ttf"), weight: "800" }),
  ]);
  return loading;
};
