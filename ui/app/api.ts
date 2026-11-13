// Cliente fino da API local (/api/*). Erros do core chegam como { code, message }.
export class ApiError extends Error {
  code: string;
  details?: any;
  constructor(code: string, message: string, details?: any) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

async function call<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError("offline", "Não consegui falar com o servidor local. Ele está rodando?");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.code ?? "http", data?.message ?? `erro ${res.status}`, data?.details);
  return data as T;
}

export const api = {
  call: <T = any>(m: string, u: string, b?: unknown) => call<T>(m, u, b ?? {}),
  get: <T = any>(u: string) => call<T>("GET", u),
  post: <T = any>(u: string, b?: unknown) => call<T>("POST", u, b ?? {}),
  del: <T = any>(u: string) => call<T>("DELETE", u),
};

export type Job = {
  id: string;
  kind: "voice" | "frames" | "render" | "pack";
  slug: string;
  status: "running" | "done" | "error";
  progress: { step: string; done: number; total: number; label?: string };
  result: any;
  error: { code: string; message: string } | null;
};

export type ChatEvent =
  | { event: "text"; data: { delta: string } }
  | { event: "tool"; data: { name: string; summary: string; ok: boolean } }
  | { event: "changed"; data: { scene: string | null } }
  | { event: "done"; data: { stop: string; model: string; usage?: any } }
  | { event: "error"; data: { code: string; message: string } };

/** Manda uma mensagem ao chat do episódio e entrega os eventos SSE (text, tool, changed, done, error) conforme chegam. */
export async function chatStream(slug: string, message: string, onEvent: (e: ChatEvent) => void, signal?: AbortSignal) {
  let res: Response;
  try {
    res = await fetch(`/api/episodes/${slug}/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message }), signal });
  } catch (e: any) {
    if (e?.name === "AbortError") return;
    throw new ApiError("offline", "Não consegui falar com o servidor local. Ele está rodando?");
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new ApiError(data?.code ?? "http", data?.message ?? `erro ${res.status}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const ev = /^event: (.+)$/m.exec(block)?.[1];
      const data = /^data: (.+)$/m.exec(block)?.[1];
      if (ev && data) onEvent({ event: ev, data: JSON.parse(data) } as ChatEvent);
    }
  }
}
