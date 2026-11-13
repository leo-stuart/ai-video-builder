import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Job } from "./api";

/** Dispara uma tarefa longa (POST → { jobId }) e acompanha por polling em /api/jobs/:id. */
export function useJob(onDone?: (j: Job) => void) {
  const [job, setJob] = useState<Job | null>(null);
  const timer = useRef<any>(null);
  const done = useRef(onDone);
  done.current = onDone;

  const poll = useCallback((id: string) => {
    clearTimeout(timer.current);
    const tick = async () => {
      try {
        const j = await api.get<Job>(`/api/jobs/${id}`);
        setJob(j);
        if (j.status === "running") timer.current = setTimeout(tick, 400);
        else done.current?.(j);
      } catch (e: any) {
        setJob((p) => (p ? { ...p, status: "error", error: { code: e.code ?? "error", message: e.message } } : p));
      }
    };
    tick();
  }, []);

  const start = useCallback(
    async (kind: Job["kind"], slug: string, url: string, body?: unknown) => {
      setJob({ id: "", kind, slug, status: "running", progress: { step: "start", done: 0, total: 0, label: "enviando" }, result: null, error: null });
      try {
        const { jobId } = await api.post<{ jobId: string }>(url, body);
        poll(jobId);
      } catch (e: any) {
        setJob({ id: "", kind, slug, status: "error", progress: { step: "start", done: 0, total: 0 }, result: null, error: { code: e.code ?? "error", message: e.message } });
      }
    },
    [poll],
  );

  const attach = useCallback((j: Job) => {
    setJob(j);
    if (j.status === "running") poll(j.id);
  }, [poll]);

  useEffect(() => () => clearTimeout(timer.current), []);
  return { job, start, attach, clear: () => setJob(null) };
}
