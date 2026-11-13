import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { Editor } from "./Editor";
import { Bold, Dialog, STATUS, colorOf } from "./lib";

type Ep = { slug: string; title: string; format: string; freedom: string; status: string };
type Pauta = { id: string; format: string; place: string; title: string; recommended?: boolean };

const useHash = () => {
  const [h, setH] = useState(location.hash);
  useEffect(() => {
    const f = () => setH(location.hash);
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return h;
};

export const App: React.FC = () => {
  const hash = useHash();
  const slug = hash.startsWith("#/e/") ? decodeURIComponent(hash.slice(4)) : null;
  return slug ? <Editor key={slug} slug={slug} onBack={() => (location.hash = "#/")} /> : <Home />;
};

const Home: React.FC = () => {
  const [ws, setWs] = useState<any>(null);
  const [eps, setEps] = useState<Ep[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    Promise.all([api.get("/api/workspace"), api.get<Ep[]>("/api/episodes")])
      .then(([w, e]) => {
        setWs(w);
        setEps(e);
      })
      .catch((e) => setErr(e.message));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    document.title = ws ? `${ws.brand.name} · Estúdio` : "Estúdio";
  }, [ws]);

  if (err) return <div className="center"><div className="err">{err}</div></div>;
  if (!ws || !eps) return <div className="center"><span className="spin" /></div>;
  const count = (s: string) => eps.filter((e) => e.status === s).length;

  return (
    <div className="home">
      <div className="home-in">
        <header className="hero">
          <div>
            <h1>
              <small>Estúdio de vídeos</small>
              {ws.brand.name}
            </h1>
            {ws.brand.tagline && (
              <p>
                <Bold text={ws.brand.tagline} />
              </p>
            )}
          </div>
          <button className="btn gold big" onClick={() => setCreating(true)}>
            ＋ Novo vídeo
          </button>
        </header>

        <div className="stats">
          <div className="stat"><b>{eps.length}</b><span>vídeos</span></div>
          <div className="stat"><b style={{ color: "var(--mint)" }}>{count("packed")}</b><span>prontos para postar</span></div>
          <div className="stat"><b>{count("rendered") + count("voiced")}</b><span>em produção</span></div>
          <div className="stat"><b>{count("draft")}</b><span>rascunhos</span></div>
        </div>

        <div className="grid">
          <button className="poster new" onClick={() => setCreating(true)}>
            <i>＋</i>
            Novo vídeo
          </button>
          {[...eps].reverse().map((e, i) => {
            const st = STATUS[e.status] ?? STATUS.draft;
            const n = e.slug.match(/^ep(\d+)/)?.[1];
            return (
              <button key={e.slug} className="poster" style={{ ["--c" as any]: colorOf(e.format), animationDelay: `${i * 40}ms` }} onClick={() => (location.hash = `#/e/${e.slug}`)}>
                {e.status === "packed" && <img src={`/files/out/${e.slug}/thumb.jpg`} alt="" loading="lazy" onError={(ev) => (ev.currentTarget.style.display = "none")} />}
                {n && <span className="num">{n}</span>}
                <span className="pill st" style={{ ["--c" as any]: st.c }}>
                  <span className="dot" style={{ ["--c" as any]: st.c }} />
                  {st.label}
                </span>
                <h3>{e.title}</h3>
                <div className="meta">{e.format} · {e.freedom}</div>
              </button>
            );
          })}
        </div>
      </div>
      {creating && <NewVideo eps={eps} defaultFreedom={ws.freedom} onClose={() => setCreating(false)} />}
    </div>
  );
};

const NewVideo: React.FC<{ eps: Ep[]; defaultFreedom: string; onClose: () => void }> = ({ eps, onClose }) => {
  const [pautas, setPautas] = useState<Pauta[] | null>(null);
  const [formats, setFormats] = useState<any[]>([]);
  const [pick, setPick] = useState<Pauta | null>(null);
  const [freedom, setFreedom] = useState("recipe");
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const next = useMemo(() => String(Math.max(0, ...eps.map((e) => Number(e.slug.match(/^ep(\d+)/)?.[1] ?? 0))) + 1).padStart(2, "0"), [eps]);
  useEffect(() => {
    Promise.all([api.get<Pauta[]>("/api/pautas"), api.get<any[]>("/api/formats")])
      .then(([p, f]) => {
        setPautas(p);
        setFormats(f);
        const rec = p.find((x) => x.recommended) ?? p[0];
        if (rec) choose(rec);
      })
      .catch((e) => setErr(e.message));
  }, []);
  const choose = (p: Pauta) => {
    setPick(p);
    setSlug(`ep${next}-${p.id}`);
  };
  const create = async () => {
    if (!pick) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post("/api/episodes", { slug, pauta: pick.id, freedom });
      location.hash = `#/e/${r.slug}`;
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  };
  const groups = useMemo(() => {
    const g: Record<string, Pauta[]> = {};
    (pautas ?? []).forEach((p) => (g[p.format] ??= []).push(p));
    return Object.entries(g);
  }, [pautas]);

  return (
    <Dialog
      wide
      title="Novo vídeo"
      sub="Escolha uma pauta pronta. O lugar, o elenco e a câmera são sorteados para não repetir os últimos vídeos."
      onClose={onClose}
      footer={
        <>
          <div className="l" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input className="in mono" style={{ width: 250 }} value={slug} onChange={(e) => setSlug(e.target.value)} aria-label="Identificador" />
            <div className="chips">
              {["recipe", "guided"].map((f) => (
                <button key={f} className={`chip${freedom === f ? " on" : ""}`} onClick={() => setFreedom(f)} title={f === "recipe" ? "Segue o formato; só textos mudam" : "Permite reordenar e trocar cenas"}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn gold" disabled={!pick || busy || !slug} onClick={create}>
            {busy && <span className="spin" />}Criar vídeo
          </button>
        </>
      }
    >
      {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}
      {!pautas && !err && <div style={{ padding: 30, textAlign: "center" }}><span className="spin" /></div>}
      {pautas && !pautas.length && <div className="allgood">Nenhuma pauta pronta sobrando neste espaço de trabalho.</div>}
      {groups.map(([fmt, list]) => {
        const f = formats.find((x) => x.id === fmt);
        return (
          <section key={fmt}>
            <div className="fmt-h">
              <span className="dot" style={{ ["--c" as any]: colorOf(fmt) }} />
              <h3>{f?.title ?? fmt}</h3>
              <span>{f?.desc}</span>
            </div>
            <div className="pautas">
              {list.map((p) => (
                <button key={p.id} className={`pauta${pick?.id === p.id ? " on" : ""}`} onClick={() => choose(p)}>
                  <b>{p.title}</b>
                  <span style={{ display: "flex", gap: 6 }}>
                    <span className="tag">{p.place}</span>
                    {p.recommended && <span className="pill" style={{ ["--c" as any]: "var(--gold)", height: 22 }}>recomendada</span>}
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </Dialog>
  );
};
