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
