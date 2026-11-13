import type { Cam } from "../kit";

/** Um instante dentro da cena: segundos, palavra da narração, fim da cena ou fração da duração. */
export type At = number | { cue: string; nth?: number; offset?: number } | { end: number } | { frac: number };

export type SetName = "counter" | "street" | "home" | "school" | "studio" | "endcard";

export type ShotDef = { at: At; shot?: string; from?: Cam; to?: Cam | string };
export type Obj = { kind: string; [k: string]: any };
export type Part = { at?: At; set: SetName; props?: Record<string, any>; shots?: ShotDef[]; objects?: Obj[] };
export type Overlay = { type: "pin" | "plate" | "stamp" | "mark" | "verdict" | "phone" | "sfx"; at?: At; until?: At; [k: string]: any };

/** Uma cena inteira como dado. É o que o ScenePlayer desenha. */
export type SceneData = { parts: Part[]; overlays?: Overlay[] };

export type Beat = {
  id: string;
  type: string;
  narration: string;
  speaker?: string;
  sub?: string;
  banner?: string;
  hold?: number;
  captions?: boolean;
  params?: Record<string, any>;
  /** Cena escrita à mão em dados. Substitui o macro do `type` (níveis guided e free). */
  scene?: SceneData;
};

export type LookSlice = Record<string, any>;
export type World = {
  place: string;
  look: { me?: LookSlice; other?: LookSlice };
  camStyle: "push" | "pull" | "slide";
  studioTone: "indigo" | "noite" | "menta" | "coral";
  metaphor: "scale" | "bars" | "pile";
};

export type EpisodeSpec = {
  slug: string;
  title: string;
  number?: number;
  series?: string;
  format?: string;
  freedom?: string;
  seed?: number;
  eleven?: string;
  captions?: { y?: number; size?: number };
  post?: { caption: string; hashtags: string[]; shortsTitle?: string };
  cast?: Record<string, any>;
  world: World;
  beats: Beat[];
};
