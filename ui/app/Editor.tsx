import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { EpisodeComposition, episodeDuration, type EpisodeProps } from "../../src/engine/EpisodeComposition";
import { FPS, H, W, sceneFrames } from "../../src/kit";
import { api, type Job } from "./api";
import { ErrorBox, Status } from "./App";
import { useJob } from "./useJob";

const STALE = /narração mudou depois da voz/;
const KIND: Record<string, string> = { voice: "Gerar voz", frames: "Folhas de revisão", render: "Renderizar", pack: "Pacote" };

type Modal = null | "voice" | "frames" | "render" | "pack";

export const Editor: React.FC<{ slug: string; onChanged: () => void; onDeleted: () => void }> = ({ slug, onChanged, onDeleted }) => {
  const [ep, setEp] = useState<any>(null);
  const [error, setError] = useState<any>(null);
  const [val, setVal] = useState<{ errors: any[]; warnings: any[]; ok: boolean } | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const player = useRef<PlayerRef>(null);

  const load = useCallback(async () => {
    try {
      const e = await api.get(`/api/episodes/${slug}`);
      setEp(e);
      setError(null);
      return e;
    } catch (e) {
      setError(e);
    }
  }, [slug]);
  const check = useCallback(async () => {
    try {
      setVal(await api.get(`/api/episodes/${slug}/validate`));
    } catch (e: any) {
      setVal({ errors: [{ message: `Não consegui validar: ${e.message}` }], warnings: [], ok: false });
    }
  }, [slug]);

  const { job, start, attach } = useJob(async (j) => {
    await load();
    await check();
    onChanged();
  });

  useEffect(() => {
    load().then((e) => {
      if (e) {
        setSel((s) => s ?? e.spec.beats[0]?.id ?? null);
        if (e.job) attach(e.job);
      }
    });
    check();
  }, [load, check, attach]);

  const inputProps: EpisodeProps | null = useMemo(() => (ep ? { spec: ep.spec, script: ep.script, timing: ep.timing, brand: ep.brand } : null), [ep]);
  const duration = useMemo(() => (inputProps ? episodeDuration(inputProps) : 30), [inputProps]);
  const starts = useMemo(() => {
    const out: Record<string, number> = {};
    if (!ep) return out;
    let f = 0;
    for (const s of sceneFrames({ script: ep.script, timing: ep.timing } as any)) {
      out[s.id] = f;
      f += s.frames;
    }
    return out;
  }, [ep]);

  const select = (id: string) => {
    setSel(id);
    const f = starts[id];
    if (f !== undefined) player.current?.seekTo(f);
  };

  if (error && !ep) return <div className="page"><ErrorBox error={error} onRetry={load} /><a className="btn" href="#/">Voltar</a></div>;
  if (!ep) return <div className="page"><p className="muted">Carregando episódio…</p></div>;

  const beat = ep.spec.beats.find((b: any) => b.id === sel) ?? ep.spec.beats[0];
  const staleIds = new Set<string>((val?.errors ?? []).filter((e) => STALE.test(e.message) && e.scene).map((e) => e.scene));
  const running = job?.status === "running" ? job : null;
  const hasAudio = Object.values<any>(ep.timing.scenes ?? {}).some((s) => s.audio);

  return (
    <div className="editor">
      <header className="ehead">
        <div className="etitle">
          <h1>{ep.spec.title}</h1>
          <div className="row gap wrap">
            <code>{slug}</code>
            <Status s={ep.status} />
            <span className="chip">liberdade {ep.spec.freedom ?? "recipe"}</span>
            <span className="muted">{(duration / FPS).toFixed(1)}s</span>
          </div>
        </div>
        <div className="actions">
          {running && <button className="chip busy" onClick={() => setModal(running.kind)}>{KIND[running.kind]}: {running.progress.done}/{running.progress.total || "…"}</button>}
          <button className="btn" onClick={() => setModal("voice")}>Gerar voz</button>
          <button className="btn" onClick={() => setModal("frames")}>Folhas de revisão</button>
          <button className="btn" onClick={() => setModal("render")}>Renderizar</button>
          <button className="btn" onClick={() => setModal("pack")}>Pacote</button>
          <button className="btn ghost danger" onClick={() => setConfirmDel(true)} title="Apagar episódio">Apagar</button>
        </div>
      </header>

      {staleIds.size > 0 && (
        <div className="alert alert-warn" role="status">
          <span><strong>A narração mudou depois da voz</strong> em {staleIds.size} cena(s) ({[...staleIds].join(", ")}). A prévia usa os tempos antigos: gere a voz de novo antes de renderizar.</span>
          <button className="btn small" onClick={() => setModal("voice")}>Gerar voz…</button>
        </div>
      )}

      <div className="cols">
        <section className="scenes" aria-label="Cenas">
          <h2>Cenas <span className="muted">({ep.spec.beats.length})</span></h2>
          <ol>
            {ep.spec.beats.map((b: any, i: number) => (
              <li key={b.id}>
                <button className={`scene ${b.id === beat?.id ? "on" : ""}`} onClick={() => select(b.id)}>
                  <span className="sn">{i + 1}</span>
                  <span className="sbody">
                    <span className="row gap wrap"><strong>{b.id}</strong><span className="chip">{b.type}</span>{b.speaker && <span className="chip spk">{b.speaker}</span>}{staleIds.has(b.id) && <span className="chip st-draft">voz desatualizada</span>}</span>
                    <span className="snar">{b.narration}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section className="stage" aria-label="Prévia">
          <div className="phone">
            <Player
              ref={player}
              component={EpisodeComposition as any}
              inputProps={inputProps as any}
              durationInFrames={duration}
              compositionWidth={W}
              compositionHeight={H}
              fps={FPS}
              controls
              loop
              clickToPlay
              acknowledgeRemotionLicense
              numberOfSharedAudioTags={12}
              spaceKeyToPlayOrPause={false}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
          <p className="muted small center">{hasAudio ? "Prévia com áudio (voz gerada)." : "Prévia sem áudio: este episódio só tem tempos (voz não gerada)."}</p>
        </section>

        <section className="inspector" aria-label="Cena selecionada">
          {beat && <SceneForm key={`${beat.id}:${JSON.stringify(beat)}`} slug={slug} beat={beat} onSaved={async () => { await load(); await check(); onChanged(); }} />}
          <WorldBox slug={slug} spec={ep.spec} onSaved={async () => { await load(); onChanged(); }} />
        </section>
      </div>

      <section className="valid" aria-label="Validação">
        <div className="row gap between">
          <h2>Validação</h2>
          <span className={`chip ${val?.ok ? "st-packed" : val ? "st-draft" : ""}`}>{val ? `${val.errors.length} erro(s) · ${val.warnings.length} aviso(s)` : "validando…"}</span>
        </div>
        {val && val.errors.length + val.warnings.length === 0 && <p className="muted">Nada a apontar. Pode seguir.</p>}
        <ul>
          {val?.errors.map((e, i) => <ValItem key={`e${i}`} kind="erro" item={e} onPick={select} />)}
          {val?.warnings.map((e, i) => <ValItem key={`w${i}`} kind="aviso" item={e} onPick={select} />)}
        </ul>
      </section>

      {modal === "voice" && <VoiceDialog slug={slug} ep={ep} job={job?.kind === "voice" ? job : null} onStart={(provider) => start("voice", slug, `/api/episodes/${slug}/voice`, { provider, confirm: true })} onClose={() => setModal(null)} />}
      {modal === "frames" && <FramesDialog slug={slug} ep={ep} sel={beat?.id} job={job?.kind === "frames" ? job : null} onStart={(scene) => start("frames", slug, `/api/episodes/${slug}/frames`, { scene })} onClose={() => setModal(null)} />}
      {modal === "render" && <RenderDialog slug={slug} ep={ep} job={job?.kind === "render" ? job : null} stale={staleIds.size > 0} onStart={(force) => start("render", slug, `/api/episodes/${slug}/render`, { force })} onClose={() => setModal(null)} />}
      {modal === "pack" && <PackDialog slug={slug} ep={ep} job={job?.kind === "pack" ? job : null} onStart={() => start("pack", slug, `/api/episodes/${slug}/pack`)} onClose={() => setModal(null)} />}
      {confirmDel && (
        <Dialog title="Apagar episódio?" onClose={() => setConfirmDel(false)}>
          <p>Isso apaga <code>{slug}</code>, o áudio, o vídeo e o pacote dele, e o tira do histórico de variedade. Não dá para desfazer.</p>
          <div className="row gap end">
            <button className="btn" onClick={() => setConfirmDel(false)}>Cancelar</button>
            <button className="btn danger-fill" onClick={async () => { try { await api.del(`/api/episodes/${slug}`); onDeleted(); } catch (e) { setError(e); setConfirmDel(false); } }}>Apagar de vez</button>
          </div>
        </Dialog>
      )}
      {error && ep && <div className="toast"><ErrorBox error={error} /></div>}
    </div>
  );
};

const ValItem: React.FC<{ kind: string; item: any; onPick: (id: string) => void }> = ({ kind, item, onPick }) => (
  <li>
    <button className={`vitem ${kind}`} onClick={() => item.scene && onPick(item.scene)} disabled={!item.scene}>
      <span className={`chip ${kind === "erro" ? "st-draft" : "st-voiced"}`}>{kind}</span>
      {item.scene && <code>{item.scene}</code>}
      <span>{item.message}</span>
    </button>
  </li>
);

/* ───────────── campos da cena ───────────── */

const asText = (v: any) => (typeof v === "string" ? v : JSON.stringify(v, null, typeof v === "object" ? 2 : 0));
const parseLike = (orig: any, txt: string) => {
  if (typeof orig === "string") return txt;
  if (typeof orig === "number") {
    const n = Number(txt);
    if (txt.trim() === "" || Number.isNaN(n)) throw new Error("precisa ser um número");
    return n;
  }
  if (typeof orig === "boolean") {
    if (txt.trim() !== "true" && txt.trim() !== "false") throw new Error("use true ou false");
    return txt.trim() === "true";
  }
  try {
    return JSON.parse(txt);
  } catch {
    throw new Error("JSON inválido");
  }
};

const SceneForm: React.FC<{ slug: string; beat: any; onSaved: () => Promise<void> }> = ({ slug, beat, onSaved }) => {
  const init = () => ({
    narration: beat.narration ?? "",
    sub: beat.sub ?? "",
    banner: beat.banner ?? "",
    hold: String(beat.hold ?? 0),
    params: Object.fromEntries(Object.entries(beat.params ?? {}).map(([k, v]) => [k, asText(v)])) as Record<string, string>,
  });
  const [f, setF] = useState(init);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  const save = async () => {
    setErr(null);
    setOk(false);
    const fields: Record<string, any> = {};
    try {
      if (f.narration !== (beat.narration ?? "")) fields.narration = f.narration;
      if (f.sub !== (beat.sub ?? "")) fields.sub = f.sub;
      if (f.banner !== (beat.banner ?? "")) fields.banner = f.banner;
      if (Number(f.hold) !== (beat.hold ?? 0)) {
        if (Number.isNaN(Number(f.hold)) || Number(f.hold) < 0) throw new Error("hold: precisa ser um número maior ou igual a 0");
        fields.hold = Number(f.hold);
      }
      for (const [k, txt] of Object.entries(f.params)) {
        if (txt !== asText(beat.params[k])) {
          try {
            fields[`params.${k}`] = parseLike(beat.params[k], txt);
          } catch (e: any) {
            throw new Error(`${k}: ${e.message}`);
          }
        }
      }
    } catch (e: any) {
      return setErr(e.message);
    }
    if (!Object.keys(fields).length) return setErr("Nada mudou.");
    setSaving(true);
    try {
      await api.post(`/api/episodes/${slug}/scene`, { type: "set", id: beat.id, fields });
      setOk(true);
      await onSaved();
    } catch (e: any) {
      setErr(e.message);
    }
    setSaving(false);
  };

  const set = (k: string, v: string) => { setF((p) => ({ ...p, [k]: v })); setOk(false); };
  const pk = Object.keys(f.params);
  return (
    <div className="box">
      <h2>Cena <code>{beat.id}</code> <span className="chip">{beat.type}</span></h2>
      <label className="field">
        <span>Narração</span>
        <textarea rows={4} value={f.narration} onChange={(e) => set("narration", e.target.value)} />
        <em className="hint">Inglês entre [en]…[/en]; ênfase com *palavra*.</em>
      </label>
      <label className="field"><span>Sub (tradução curta)</span><input value={f.sub} onChange={(e) => set("sub", e.target.value)} /></label>
      <div className="row gap">
        <label className="field grow"><span>Banner</span><input value={f.banner} onChange={(e) => set("banner", e.target.value)} /></label>
        <label className="field w90"><span>Hold (s)</span><input inputMode="decimal" value={f.hold} onChange={(e) => set("hold", e.target.value)} /></label>
      </div>
      {pk.length > 0 && <h3>Parâmetros</h3>}
      {pk.map((k) => (
        <label className="field" key={k}>
          <span><code>{k}</code></span>
          {f.params[k].length > 50 || f.params[k].includes("\n") ? <textarea rows={Math.min(8, f.params[k].split("\n").length + 1)} value={f.params[k]} onChange={(e) => setF((p) => ({ ...p, params: { ...p.params, [k]: e.target.value } }))} /> : <input value={f.params[k]} onChange={(e) => setF((p) => ({ ...p, params: { ...p.params, [k]: e.target.value } }))} />}
        </label>
      ))}
      {err && <p className="hint bad" role="alert">{err}</p>}
      <div className="row gap">
        <button className="btn primary" onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
        <button className="btn" onClick={() => { setF(init()); setErr(null); setOk(false); }}>Desfazer</button>
        {ok && <span className="ok">Salvo.</span>}
      </div>
    </div>
  );
};

const WorldBox: React.FC<{ slug: string; spec: any; onSaved: () => void }> = ({ slug, spec, onSaved }) => {
  const recipe = (spec.freedom ?? "recipe") === "recipe";
  const w = spec.world ?? {};
  const [f, setF] = useState({ place: w.place ?? "", metaphor: w.metaphor ?? "", camStyle: w.camStyle ?? "" });
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setErr(null);
    try {
      await api.post(`/api/episodes/${slug}/scene`, { type: "world", fields: f });
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  return (
    <div className="box">
      <h2>Mundo do episódio</h2>
      {(["place", "metaphor", "camStyle"] as const).map((k) => (
        <label className="field" key={k}>
          <span>{{ place: "Lugar", metaphor: "Metáfora", camStyle: "Câmera" }[k]}</span>
          <input value={f[k]} readOnly={recipe} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        </label>
      ))}
      {recipe ? <p className="muted small">Somente leitura no nível recipe. Crie o episódio com liberdade guided para mudar o mundo.</p> : (
        <>
          {err && <p className="hint bad">{err}</p>}
          <button className="btn" onClick={save}>Salvar mundo</button>
        </>
      )}
    </div>
  );
};

/* ───────────── diálogos ───────────── */

const Dialog: React.FC<{ title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }> = ({ title, onClose, wide, children }) => {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dialog ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="dhead"><h2>{title}</h2><button className="btn ghost" onClick={onClose} aria-label="Fechar">✕</button></div>
        <div className="dbody">{children}</div>
      </div>
    </div>
  );
};

const Progress: React.FC<{ job: Job }> = ({ job }) => {
  const { done, total, label } = job.progress;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="progress-box" role="status">
      <div className="bar"><div style={{ width: `${total ? pct : 8}%` }} className={total ? "" : "indet"} /></div>
      <div className="row between"><span>{label || job.progress.step}</span><span className="muted">{total ? `${done}/${total}` : ""}</span></div>
    </div>
  );
};

const JobState: React.FC<{ job: Job | null; children?: React.ReactNode }> = ({ job, children }) => {
  if (!job) return null;
  if (job.status === "running") return <Progress job={job} />;
  if (job.status === "error") return <div className="alert alert-error" role="alert"><strong>A tarefa falhou.</strong><pre>{job.error?.message}</pre></div>;
  return <>{children}</>;
};

const VoiceDialog: React.FC<{ slug: string; ep: any; job: Job | null; onStart: (provider?: string) => void; onClose: () => void }> = ({ ep, job, onStart, onClose }) => {
  const [bal, setBal] = useState<any | undefined>(undefined);
  const [mode, setMode] = useState<"none" | "default" | "say">("none");
  useEffect(() => {
    api.get("/api/voice/balance").then((r) => { setBal(r.balance); }).catch(() => setBal(null));
  }, []);
  const lines = ep.spec.beats.map((b: any) => {
    const t = ep.timing.scenes?.[b.id];
    const plain = (s: string) => s.replace(/\[\/?en\]/g, "").replace(/\*/g, "").split(/\s+/).filter(Boolean).join(" ");
    const cached = !!t && t.audio && t.words.map((w: any) => w.t).join(" ") === plain(b.narration);
    return { id: b.id, speaker: b.speaker, text: b.narration, cached, chars: plain(b.narration).length };
  });
  const newChars = lines.filter((l: any) => !l.cached).reduce((a: number, l: any) => a + l.chars, 0);
  const paid = mode === "default";
  const started = !!job;
  return (
    <Dialog title="Gerar voz" onClose={onClose} wide>
      {!started && (
        <>
          <div className="alert alert-info">
            {bal === undefined && "Consultando saldo…"}
            {bal === null && <>Sem chave de voz (<code>ELEVENLABS_API_KEY</code> em <code>.env.local</code> do espaço de trabalho). Dá para gerar só os tempos, ou usar a voz do sistema (rascunho).</>}
            {bal && <>Saldo ElevenLabs: <strong>{(bal.limit - bal.used).toLocaleString("pt-BR")}</strong> caracteres livres (plano {bal.plan}; usados {bal.used.toLocaleString("pt-BR")} de {bal.limit.toLocaleString("pt-BR")}).</>}
          </div>
          <fieldset className="modes">
            <label><input type="radio" checked={mode === "none"} onChange={() => setMode("none")} /> <span><strong>Só tempos, sem custo</strong><small>provider none: calcula a duração das cenas; o vídeo sai mudo.</small></span></label>
            <label><input type="radio" checked={mode === "say"} onChange={() => setMode("say")} /> <span><strong>Voz do sistema (rascunho, sem custo)</strong><small>say do macOS: serve para ouvir o ritmo.</small></span></label>
            <label className={bal ? "" : "off"}><input type="radio" disabled={!bal} checked={mode === "default"} onChange={() => setMode("default")} /> <span><strong>Voz do espaço de trabalho (gasta créditos)</strong><small>cenas já em cache não gastam. Estimativa: até {newChars.toLocaleString("pt-BR")} caracteres novos.</small></span></label>
          </fieldset>
          <h3>Falas ({lines.length})</h3>
          <ol className="lines">
            {lines.map((l: any) => (
              <li key={l.id}><code>{l.id}</code>{l.speaker && <span className="chip spk">{l.speaker}</span>}<span className={`chip ${l.cached ? "st-packed" : "st-voiced"}`}>{l.cached ? "em cache" : "nova"}</span><span>{l.text}</span></li>
            ))}
          </ol>
          <div className="row gap end">
            <button className="btn" onClick={onClose}>Cancelar</button>
            <button className={`btn ${paid ? "danger-fill" : "primary"}`} onClick={() => onStart(mode === "default" ? undefined : mode)}>{paid ? "Sim, gerar voz e gastar créditos" : mode === "say" ? "Sim, gerar voz do sistema" : "Gerar só os tempos"}</button>
          </div>
        </>
      )}
      <JobState job={job}>
        {job?.status === "done" && (
          <div className="alert alert-ok">
            <strong>Voz pronta:</strong> {job.result.seconds.toFixed(1)}s no total, voz "{job.result.provider}".
            {job.result.warnings?.map((w: string, i: number) => <div key={i}>Aviso: {w}</div>)}
            <div className="row end"><button className="btn primary" onClick={onClose}>Fechar</button></div>
          </div>
        )}
      </JobState>
    </Dialog>
  );
};

const FramesDialog: React.FC<{ slug: string; ep: any; sel?: string; job: Job | null; onStart: (scene?: string) => void; onClose: () => void }> = ({ ep, sel, job, onStart, onClose }) => {
  const [scope, setScope] = useState<string>("");
  return (
    <Dialog title="Folhas de revisão" onClose={onClose} wide>
      <div className="row gap wrap">
        <label className="field grow"><span>O que mostrar</span>
          <select value={scope} onChange={(e) => setScope(e.target.value)} disabled={job?.status === "running"}>
            <option value="">Episódio inteiro (2 quadros por cena)</option>
            {ep.spec.beats.map((b: any) => <option key={b.id} value={b.id}>Só a cena {b.id}{b.id === sel ? " (selecionada)" : ""}</option>)}
          </select>
        </label>
        <button className="btn primary" disabled={job?.status === "running"} onClick={() => onStart(scope || undefined)}>Gerar folhas</button>
      </div>
      <JobState job={job}>
        {job?.status === "done" && (
          <div className="sheets">
            {job.result.sheets.map((u: string) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="Folha de revisão" /></a>)}
          </div>
        )}
      </JobState>
      {!job && <p className="muted">As folhas são quadros de cada cena lado a lado, para conferir sem renderizar o vídeo.</p>}
    </Dialog>
  );
};

const RenderDialog: React.FC<{ slug: string; ep: any; job: Job | null; stale: boolean; onStart: (force: boolean) => void; onClose: () => void }> = ({ slug, ep, job, stale, onStart, onClose }) => {
  const [force, setForce] = useState(false);
  const has = ep.files.video;
  const url = job?.status === "done" ? job.result.video : has ? `/files/out/${slug}.mp4` : null;
  const silent = ep.timing.provider === "none";
  return (
    <Dialog title="Renderizar" onClose={onClose} wide>
      {stale && <div className="alert alert-warn">A narração mudou depois da voz. O render recusa até a voz ser gerada de novo.</div>}
      {silent && !stale && <div className="alert alert-info">A voz deste episódio é só tempos (provider none): o vídeo sai mudo.</div>}
      <div className="row gap wrap">
        <button className="btn primary" disabled={job?.status === "running"} onClick={() => onStart(force)}>{has ? "Renderizar de novo" : "Renderizar"}</button>
        <label className="check"><input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> refazer todas as cenas (ignora o cache)</label>
      </div>
      <JobState job={job}>
        {job?.status === "done" && <p className="ok">Pronto: {job.result.seconds}s, {job.result.rendered} cena(s) renderizada(s), {job.result.cached} do cache.{job.result.warnings?.map((w: string) => <span key={w}> {w}</span>)}</p>}
      </JobState>
      {url && job?.status !== "running" && <div className="videobox"><video key={url} src={url} controls playsInline /><a className="btn small" href={url} download>Baixar o vídeo</a></div>}
      {!url && !job && <p className="muted">Ainda não há vídeo. O render só junta o que já tem voz; ele nunca gera voz.</p>}
    </Dialog>
  );
};

const PackDialog: React.FC<{ slug: string; ep: any; job: Job | null; onStart: () => void; onClose: () => void }> = ({ slug, ep, job, onStart, onClose }) => {
  const files: { name: string; url: string }[] = job?.status === "done" ? job.result.files : ep.files.pack.map((n: string) => ({ name: n, url: `/files/out/${slug}/${encodeURIComponent(n)}` }));
  const hasVideo = files.some((f) => f.name === "video.mp4");
  return (
    <Dialog title="Pacote de postagem" onClose={onClose} wide>
      <p className="muted">O pacote reúne vídeo, legendas por plataforma e miniatura. A UI não publica nada: você posta (ou agenda) por fora.</p>
      <button className="btn primary" disabled={job?.status === "running" || !ep.files.video} onClick={onStart}>{files.length ? "Gerar o pacote de novo" : "Gerar pacote"}</button>
      {!ep.files.video && <p className="hint bad">Falta o vídeo: renderize primeiro.</p>}
      <JobState job={job} />
      {files.length > 0 && job?.status !== "running" && (
        <>
          <h3>Arquivos (out/{slug}/)</h3>
          <ul className="files">{files.map((f) => <li key={f.name}><a href={f.url} target="_blank" rel="noreferrer">{f.name}</a> <a className="muted" href={f.url} download>baixar</a></li>)}</ul>
          {hasVideo && <div className="videobox"><video src={`/files/out/${slug}/video.mp4`} controls playsInline /></div>}
        </>
      )}
    </Dialog>
  );
};
