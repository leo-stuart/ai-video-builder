import type { Macro } from "./beats/common";
import * as T from "./beats/travou";
import * as F from "./beats/formats2";

/** Todos os tipos de cena conhecidos. A chave é o `type` do beat no episode.json. */
export const REGISTRY: Record<string, Macro> = {
  "hook-walk-out": T.hookWalkOut,
  "arrive-need": T.arriveNeed,
  ask: T.ask,
  freeze: T.freeze,
  "line-me": T.lineMe,
  "line-other": T.lineOther,
  crowd: T.crowd,
  "walk-out-street": T.walkOutStreet,
  metaphor: T.metaphor,
  "app-enter": T.appEnter,
  "tutor-line": T.tutorLine,
  "user-error": T.userError,
  "user-success": T.userSuccess,
  "pitch-habit": T.pitchHabit,
  "walk-street": T.walkStreet,
  win: T.win,
  "end-card": T.endCard,
  "scene-data": (b) => {
    throw new Error(`cena "${b.id}": o tipo scene-data precisa de uma cena em dados: vid scene <slug> scene ${b.id} --json '{…}'`);
  },
  "title-card": F.titleCard,
  statement: F.statement,
  "say-me": F.sayMe,
  heard: F.heard,
  compare: F.compare,
  "quiz-question": F.quizQuestion,
  "quiz-answer": F.quizAnswer,
};
