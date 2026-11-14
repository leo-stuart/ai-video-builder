import { useEffect, useRef } from "react";

export type LiveEvent = { type: "episode"; slug: string } | { type: "list" };

/** Avisos do servidor quando um vídeo muda por fora (agente pelo MCP, CLI). Reconecta sozinho. */
export function useLive(onEvent: (e: LiveEvent) => void) {
  const cb = useRef(onEvent);
  cb.current = onEvent;
  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onmessage = (m) => {
      try {
        cb.current(JSON.parse(m.data));
      } catch {}
    };
    return () => es.close();
  }, []);
}
