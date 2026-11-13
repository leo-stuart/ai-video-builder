import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "./api";
import { Editor } from "./Editor";

export const STATUS: Record<string, string> = { draft: "rascunho", voiced: "com voz", rendered: "renderizado", packed: "empacotado" };
export const Status: React.FC<{ s: string }> = ({ s }) => <span className={`chip st-${s}`}>{STATUS[s] ?? s}</span>;

const useHash = () => {
  const [h, setH] = useState(location.hash || "#/");
  useEffect(() => {
    const f = () => setH(location.hash || "#/");
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  return h;
};

export const ErrorBox: React.FC<{ error: { message: string; code?: string } | null; onRetry?: () => void }> = ({ error, onRetry }) =>
  error ? (
    <div className="alert alert-error" role="alert">
      <div>{error.message}</div>
      {onRetry && <button className="btn small" onClick={onRetry}>Tentar de novo</button>}
    </div>
  ) : null;

export const App: React.FC = () => {
  const hash = useHash();
  const [ws, setWs] = useState<any>(null);
  const [eps, setEps] = useState<any[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const [w, e] = await Promise.all([api.get("/api/workspace"), api.get("/api/episodes")]);
      setWs(w);
      setEps(e);
    } catch (e: any) {
      setError(e);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const m = hash.match(/^#\/ep\/([a-z0-9-]+)/);
  const slug = m?.[1];
  const isNew = hash.startsWith("#/new");

  return (
    <div className="app">
      <aside className="side">
        <a className="brand" href="#/">
          <span className="logo">▶</span>
          <span>
            <strong>{ws?.brand?.name || "Builder"}</strong>
            <small>Builder de vídeos</small>
          </span>
        </a>
        <a className="btn primary block" href="#/new">+ Novo episódio</a>
        <nav className="eplist" aria-label="Episódios">
          {eps === null && !error && <p className="muted pad">Carregando…</p>}
          {eps?.length === 0 && <p className="muted pad">Nenhum episódio ainda.</p>}
          {eps?.map((e) => (
            <a key={e.slug} href={`#/ep/${e.slug}`} className={`epitem ${e.slug === slug ? "active" : ""}`}>
              <span className="eptitle">{e.title}</span>
              <span className="epmeta">
                <code>{e.slug}</code>
                <Status s={e.status} />
              </span>
            </a>
          ))}
        </nav>
        <p className="wspath" title={ws?.path}>{ws?.path?.split("/").slice(-2).join("/")}</p>
      </aside>
      <main className="main">
        {error && <div className="pad"><ErrorBox error={error} onRetry={reload} /></div>}
        {!error && isNew && <NewEpisode eps={eps ?? []} ws={ws} onCreated={async (s) => { await reload(); location.hash = `#/ep/${s}`; }} />}
        {!error && slug && <Editor key={slug} slug={slug} onChanged={reload} onDeleted={async () => { await reload(); location.hash = "#/"; }} />}
        {!error && !isNew && !slug && <Home eps={eps} />}
      </main>
    </div>
  );
};

const Home: React.FC<{ eps: any[] | null }> = ({ eps }) => (
  <div className="page">
    <h1>Episódios</h1>
    {eps === null && <p className="muted">Carregando…</p>}
    {eps?.length === 0 && (
      <div className="empty">
        <h2>Este espaço de trabalho ainda não tem episódios</h2>
        <p>Escolha uma pauta e crie o primeiro episódio. O roteiro já vem montado; você só ajusta as falas.</p>
        <a className="btn primary" href="#/new">Criar o primeiro episódio</a>
      </div>
    )}
    <div className="cards">
      {eps?.map((e) => (
        <a key={e.slug} className="card" href={`#/ep/${e.slug}`}>
          <div className="row between"><code>{e.slug}</code><Status s={e.status} /></div>
          <h3>{e.title}</h3>
          <p className="muted">formato {e.format ?? "-"} · liberdade {e.freedom}</p>
        </a>
      ))}
    </div>
  </div>
);

const FREEDOM = [
  ["", "Padrão do espaço de trabalho"],
  ["recipe", "recipe: só trocar falas e textos"],
  ["guided", "guided: também inserir, mover e trocar cenas"],
  ["free", "free: cenas montadas em dados"],
];

const nextSlug = (eps: any[], pautaId: string) => {
  const n = eps.reduce((mx, e) => Math.max(mx, Number(e.slug.match(/^ep(\d+)-/)?.[1] ?? 0)), 0) + 1;
  return `ep${String(n).padStart(2, "0")}-${pautaId}`.slice(0, 48);
};

const NewEpisode: React.FC<{ eps: any[]; ws: any; onCreated: (slug: string) => void }> = ({ eps, ws, onCreated }) => {
  const [pautas, setPautas] = useState<any[] | null>(null);
  const [pick, setPick] = useState<string>("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const [freedom, setFreedom] = useState("");
  const [err, setErr] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/api/pautas").then((p) => {
      setPautas(p);
      const r = p.find((x: any) => x.recommended) ?? p[0];
      if (r) setPick(r.id);
    }).catch(setErr);
  }, []);
  useEffect(() => {
    if (!touched && pick) setSlug(nextSlug(eps, pick));
  }, [pick, eps, touched]);

  const chosen = useMemo(() => pautas?.find((p) => p.id === pick), [pautas, pick]);
  const valid = /^ep\d\d-[a-z0-9-]+$/.test(slug);

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post("/api/episodes", { slug, pauta: pick, freedom: freedom || undefined });
      onCreated(r.slug);
    } catch (e) {
      setErr(e);
      setBusy(false);
    }
  };

  return (
    <div className="page narrow">
      <h1>Novo episódio</h1>
      <ErrorBox error={err} />
      {pautas === null && !err && <p className="muted">Carregando pautas…</p>}
      {pautas?.length === 0 && (
        <div className="empty">
          <h2>Não há pautas livres</h2>
          <p>Todas as pautas do playbook já foram usadas, ou o espaço de trabalho não tem pautas em <code>playbook/pautas/</code>. Crie o episódio pela linha de comando com <code>vid new</code>.</p>
        </div>
      )}
      {!!pautas?.length && (
        <>
          <h2>1. Pauta</h2>
          <div className="pautas" role="radiogroup" aria-label="Pautas">
            {pautas.map((p) => (
              <label key={p.id} className={`pauta ${pick === p.id ? "on" : ""}`}>
                <input type="radio" name="pauta" checked={pick === p.id} onChange={() => setPick(p.id)} />
                <span>
                  <strong>{p.title}</strong>
                  {p.recommended && <span className="chip st-rendered">recomendada</span>}
                  <small>{p.id} · formato {p.format} · lugar {p.place}</small>
                </span>
              </label>
            ))}
          </div>
          <h2>2. Nome do episódio</h2>
          <label className="field">
            <span>Slug (epNN-tema)</span>
            <input value={slug} onChange={(e) => { setSlug(e.target.value.toLowerCase()); setTouched(true); }} spellCheck={false} />
            {!valid && <em className="hint bad">Use o padrão epNN-tema, só letras minúsculas, números e hífen.</em>}
            {eps.some((e) => e.slug === slug) && <em className="hint bad">Já existe um episódio com esse nome.</em>}
          </label>
          <label className="field">
            <span>Nível de liberdade</span>
            <select value={freedom} onChange={(e) => setFreedom(e.target.value)}>
              {FREEDOM.map(([v, t]) => <option key={v} value={v}>{t}{v === "" && ws?.freedom ? ` (${ws.freedom})` : ""}</option>)}
            </select>
          </label>
          <div className="row gap">
            <button className="btn primary" disabled={!valid || busy || eps.some((e) => e.slug === slug)} onClick={create}>{busy ? "Criando…" : `Criar e abrir${chosen ? `: ${chosen.title}` : ""}`}</button>
            <a className="btn" href="#/">Cancelar</a>
          </div>
        </>
      )}
    </div>
  );
};
