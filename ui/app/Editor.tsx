import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { EpisodeComposition, type EpisodeProps } from "../../src/engine/EpisodeComposition";
import { FPS, H, W, sceneFrames } from "../../src/kit";
import { api, type Job } from "./api";
import { Dialog, Rich, STATUS, fmtT, plain, who } from "./lib";
import { useJob } from "./useJob";
import { Chat } from "./Chat";

type Issue = { scene?: string; message: string };
type Val = { errors: Issue[]; warnings: Issue[]; ok: boolean };
const STALE = /mudou depois da voz|sem voz\/tempo|sem áudio/;
/** As mensagens do núcleo citam comandos de terminal; aqui a ação é um botão. */
const human = (m: string) => m.replace(/: vid scene \S+ world [^.]*\./, " na aba Mundo.").replace(/\s*(Antes do render final )?[Rr]ode:? `?(node scripts\/)?vid[^.]*\.?`?/g, "").replace(/\s+$/, "") + (STALE.test(m) ? " Use o passo Voz." : "");
const KIND: Record<string, string> = { voice: "Gerando voz", frames: "Gerando folhas de revisão", render: "Renderizando", pack: "Montando pacote" };
const WORLD: Record<string, { label: string; opts: string[] }> = {
  place: { label: "Lugar", opts: ["cafe", "restaurante", "hotel", "imigracao", "aeroporto", "loja", "farmacia"] },
  metaphor: { label: "Metáfora", opts: ["scale", "bars", "pile"] },
  camStyle: { label: "Câmera", opts: ["push", "pull", "slide"] },
};
const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "");

export const Editor: React.FC<{ slug: string; onBack: () => void }> = ({ slug, onBack }) => {
  const [ep, setEp] = useState<any>(null);
  const [val, setVal] = useState<Val | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<"cena" | "mundo" | "problemas" | "chat">("cena");
  const [modal, setModal] = useState<null | "voice" | "sheets" | "video" | "pack">(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const player = useRef<PlayerRef>(null);
  const saveRef = useRef<() => void>(() => {});

  const load = useCallback(async () => {
    try {
      const [e, v] = await Promise.all([api.get(`/api/episodes/${slug}`), api.get<Val>(`/api/episodes/${slug}/validate`)]);
      setEp(e);
      setVal(v);
      setSel((s) => s ?? e.spec.beats[0]?.id ?? null);
      return e;
    } catch (e: any) {
      setErr(e.message);
    }
  }, [slug]);

  const { job, start, attach, clear } = useJob((j) => {
    load();
    if (j.status !== "done") return;
    if (j.kind === "frames") {
      setSheets(j.result.sheets);
      setModal("sheets");
    }
    if (j.kind === "render") setModal("video");
    if (j.kind === "pack") setModal("pack");
  });
  const running = job?.status === "running";

  useEffect(() => {
    load().then((e) => e?.job && attach(e.job));
  }, [load]);
  useEffect(() => {
    if (ep) document.title = `${ep.spec.title} · Estúdio`;
  }, [ep]);

  const props: EpisodeProps | null = useMemo(() => (ep ? { spec: ep.spec, script: ep.script, timing: ep.timing, brand: ep.brand } : null), [ep]);
  const scenes = useMemo(() => {
    if (!ep) return [];
    let at = 0;
    return sceneFrames({ script: ep.script, timing: ep.timing } as any).map((s: any, i: number) => {
      const beat = ep.spec.beats[i];
      const t = ep.timing.scenes?.[s.id];
      const voice = !t ? "none" : t.words.map((w: any) => w.t).join(" ") !== plain(beat.narration) ? "stale" : t.audio ? "ok" : "mute";
      const o = { id: s.id as string, beat, from: at, frames: s.frames as number, voice };
      at += s.frames;
      return o;
    });
  }, [ep]);
  const total = scenes.reduce((a, s) => a + s.frames, 0) || 1;
  const current = scenes.find((s) => frame >= s.from && frame < s.from + s.frames) ?? scenes[0];

  // O Player avisa o quadro atual; durante a reprodução a cena selecionada acompanha.
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const onF = (e: any) => setFrame(e.detail.frame);
    const onP = () => setPlaying(true);
    const onS = () => setPlaying(false);
    p.addEventListener("frameupdate", onF);
    p.addEventListener("play", onP);
    p.addEventListener("pause", onS);
    p.addEventListener("ended", onS);
    return () => {
      p.removeEventListener("frameupdate", onF);
      p.removeEventListener("play", onP);
      p.removeEventListener("pause", onS);
      p.removeEventListener("ended", onS);
    };
  }, [!!props]);
  useEffect(() => {
    if (playing && current && !dirty) setSel(current.id);
  }, [playing, current?.id, dirty]);

  const go = useCallback(
    (id: string, seek = true) => {
      setSel(id);
      setTab((t) => (t === "problemas" ? "cena" : t));
      const s = scenes.find((x) => x.id === id);
      if (seek && s) player.current?.seekTo(s.from + Math.min(s.frames - 1, Math.round(s.frames * 0.6)));
      document.getElementById(`sc-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
    [scenes],
  );
  const toggle = () => player.current?.toggle();

  // O chat editou o episódio: recarrega e deixa a prévia na cena afetada (quando o id existe depois do reload).
  const [focusScene, setFocusScene] = useState<string | null>(null);
  const onChatChanged = useCallback((scene: string | null) => {
    load().then((e) => setFocusScene(scene && e?.spec.beats.some((b: any) => b.id === scene) ? scene : null));
  }, [load]);
  useEffect(() => {
    if (focusScene && scenes.some((s) => s.id === focusScene)) {
      go(focusScene);
      setFocusScene(null);
    }
  }, [focusScene, scenes, go]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveRef.current();
        return;
      }
      if (typing() || modal) return;
      const i = scenes.findIndex((s) => s.id === sel);
      if (e.key === " ") {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowDown" && scenes[i + 1]) {
        e.preventDefault();
        go(scenes[i + 1].id);
      } else if (e.key === "ArrowUp" && scenes[i - 1]) {
        e.preventDefault();
        go(scenes[i - 1].id);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [scenes, sel, modal, go]);

  if (err) return <div className="center"><div><div className="err">{err}</div><button className="btn" style={{ marginTop: 12 }} onClick={onBack}>← Voltar</button></div></div>;
  if (!ep || !props || !val) return <div className="center"><span className="spin" /></div>;

  const beat = ep.spec.beats.find((b: any) => b.id === sel) ?? ep.spec.beats[0];
  const st = STATUS[ep.status] ?? STATUS.draft;
  const scriptErrors = val.errors.filter((e) => !STALE.test(e.message));
  const stale = scenes.some((s) => s.voice === "stale");
  const noVoice = scenes.some((s) => s.voice === "none");
  const mute = scenes.some((s) => s.voice === "mute");
  const voiceOk = !stale && !noVoice && !mute;
  const hasVideo = ep.files.video && (ep.status === "rendered" || ep.status === "packed");
  const hasPack = ep.files.pack.length > 0 && ep.status === "packed";
  const nextStep = scriptErrors.length ? "roteiro" : !voiceOk ? "voz" : !hasVideo ? (sheets.length ? "render" : "revisao") : !hasPack ? "pacote" : "";
  const pct = job && running && job.progress.total ? (job.progress.done / job.progress.total) * 100 : running ? 8 : 0;
  const stepBar = (k: Job["kind"]) => running && job!.kind === k && <span className="bar" style={{ width: `${pct}%` }} />;
  const remove = async () => {
    if (!confirm(`Apagar "${ep.spec.title}"? O áudio e os arquivos gerados deste vídeo também são apagados.`)) return;
    try {
      await api.del(`/api/episodes/${slug}`);
      onBack();
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div className="ed">
      <header className="top">
        <button className="back" onClick={onBack} aria-label="Voltar">←</button>
        <h2>{ep.spec.title}</h2>
        <span className="pill" style={{ ["--c" as any]: st.c }}>{st.label}</span>
        <span className="tag">{ep.spec.format}</span>
        <span className="tag">{ep.spec.freedom}</span>

        <nav className="rail">
          <button className={`step ${scriptErrors.length ? "bad" : "done"}${nextStep === "roteiro" ? " next" : ""}`} onClick={() => setTab("problemas")}>
            <span className="n">{scriptErrors.length || "✓"}</span>Roteiro
          </button>
          <span className="sep" />
          <button className={`step ${voiceOk ? "done" : stale ? "warn" : ""}${nextStep === "voz" ? " next" : ""}`} disabled={running} onClick={() => setModal("voice")}>
            <span className="n">{voiceOk ? "✓" : stale ? "!" : "2"}</span>Voz{stale && <small>refazer</small>}{!stale && mute && <small>só tempos</small>}
            {stepBar("voice")}
          </button>
          <span className="sep" />
          <button className={`step ${sheets.length ? "done" : ""}${nextStep === "revisao" ? " next" : ""}`} disabled={running} onClick={() => (sheets.length ? setModal("sheets") : start("frames", slug, `/api/episodes/${slug}/frames`, {}))}>
            <span className="n">{sheets.length ? "✓" : "3"}</span>Revisão
            {stepBar("frames")}
          </button>
          <span className="sep" />
          <button className={`step ${hasVideo ? "done" : ""}${nextStep === "render" ? " next" : ""}`} disabled={running || noVoice || !!scriptErrors.length} onClick={() => (hasVideo && !stale ? setModal("video") : start("render", slug, `/api/episodes/${slug}/render`, {}))}>
            <span className="n">{hasVideo ? "✓" : "4"}</span>Render
            {stepBar("render")}
          </button>
          <span className="sep" />
          <button className={`step ${hasPack ? "done" : ""}${nextStep === "pacote" ? " next" : ""}`} disabled={running || !ep.files.video} onClick={() => (hasPack ? setModal("pack") : start("pack", slug, `/api/episodes/${slug}/pack`, {}))}>
            <span className="n">{hasPack ? "✓" : "5"}</span>Pacote
            {stepBar("pack")}
          </button>
          <button className="btn ghost danger" style={{ marginLeft: 8 }} onClick={remove} disabled={running} title="Apagar vídeo">Apagar</button>
        </nav>
      </header>

      <div className="cols">
        <section className="col">
          <div className="col-h">
            Roteiro <span className="r mono">{scenes.length} cenas · {fmtT(total / FPS)}</span>
          </div>
          <div className="scroll">
            {scenes.map((s, i) => {
              const w = who(s.beat.speaker);
              const label = s.beat.speaker ? (ep.spec.cast?.[s.beat.speaker]?.label ?? w.label) : w.label;
              return (
                <button key={s.id} id={`sc-${s.id}`} className={`scene${sel === s.id ? " on" : ""}`} style={{ ["--c" as any]: w.c }} onClick={() => go(s.id)}>
                  <span className="i">{i + 1}</span>
                  <span>
                    <span className="hd">
                      <span className="who">{label}</span>
                      <span className="tag">{s.beat.type}</span>
                      {s.voice === "stale" && <span className="flag">● voz desatualizada</span>}
                      {s.voice === "none" && <span className="flag">● sem voz</span>}
                      <span className="secs">{(s.frames / FPS).toFixed(1)}s</span>
                    </span>
                    <span className="tx"><Rich text={s.beat.narration} /></span>
                    {s.beat.sub && <span className="sub" style={{ display: "block" }}>{s.beat.sub}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="col stage">
          <div className={`phone${playing ? "" : " paused"}`} onClick={toggle}>
            <div className="screen">
              <Player ref={player} component={EpisodeComposition as any} inputProps={props as any} durationInFrames={total} compositionWidth={W} compositionHeight={H} fps={FPS} style={{ width: "100%", height: "100%" }} acknowledgeRemotionLicense />
            </div>
            <div className="cover"><b>▶</b></div>
          </div>
          <div className="tl">
            <div className="tl-top">
              <button className="play" onClick={toggle} aria-label={playing ? "Pausar" : "Tocar"}>{playing ? "❚❚" : "▶"}</button>
              <span className="now">{current?.id}</span>
              <span>{current?.beat.type}</span>
              <span className="r">{fmtT(frame / FPS)} / {fmtT(total / FPS)}</span>
            </div>
            <div className="track">
              {scenes.map((s) => (
                <button key={s.id} className={`seg${current?.id === s.id ? " on" : ""}`} style={{ flex: `${s.frames} 0 0`, ["--c" as any]: who(s.beat.speaker).c }} title={`${s.id} · ${(s.frames / FPS).toFixed(1)}s`} onClick={() => { setSel(s.id); player.current?.seekTo(s.from); document.getElementById(`sc-${s.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }}>
                  <span>{s.id}</span>
                </button>
              ))}
              <span className="head" style={{ left: `${(frame / total) * 100}%` }} />
            </div>
            <div className="hint">
              <span><span className="kbd">espaço</span> tocar</span>
              <span><span className="kbd">↑</span> <span className="kbd">↓</span> trocar de cena</span>
              <span><span className="kbd">⌘S</span> salvar</span>
              {mute && !noVoice && <span style={{ color: "var(--warn)" }}>prévia sem voz</span>}
            </div>
          </div>
        </section>

        <section className="col">
          <div className="tabs">
            <button className={`tab${tab === "cena" ? " on" : ""}`} onClick={() => setTab("cena")}>Cena</button>
            <button className={`tab${tab === "mundo" ? " on" : ""}`} onClick={() => setTab("mundo")}>Mundo</button>
            <button className={`tab${tab === "problemas" ? " on" : ""}`} onClick={() => setTab("problemas")}>
              Problemas
              {val.errors.length > 0 && <span className="ct" style={{ ["--c" as any]: "var(--bad)" }}>{val.errors.length}</span>}
              {val.warnings.length > 0 && <span className="ct" style={{ ["--c" as any]: "var(--warn)" }}>{val.warnings.length}</span>}
            </button>
            <button className={`tab${tab === "chat" ? " on" : ""}`} onClick={() => setTab("chat")}>Chat</button>
          </div>
          <Chat slug={slug} active={tab === "chat"} onChanged={onChatChanged} />
          {tab === "cena" && beat && <SceneForm key={beat.id} slug={slug} beat={beat} onSaved={load} onDirty={setDirty} saveRef={saveRef} />}
          {tab === "mundo" && <World slug={slug} spec={ep.spec} onSaved={load} />}
          {tab === "problemas" && (
            <div className="scroll">
              {!val.errors.length && !val.warnings.length && (
                <div className="allgood"><b>✓</b>Nada a apontar.</div>
              )}
              {[...val.errors.map((e) => ({ ...e, bad: true })), ...val.warnings.map((e) => ({ ...e, bad: false }))].map((it, i) => {
                const sc = it.scene ?? it.message.match(/cena (?:\d+ \()?"([a-z0-9]+)"/)?.[1];
                return (
                  <button key={i} className="issue" style={{ ["--c" as any]: it.bad ? "var(--bad)" : "var(--warn)" }} onClick={() => sc && scenes.some((s) => s.id === sc) && go(sc)}>
                    <i>{it.bad ? "!" : "?"}</i>
                    <span>{human(it.message)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {job && (running || job.status === "error") && (
        <div className={`toast${job.status === "error" ? " bad" : ""}`}>
          {running ? <span className="spin" /> : <span style={{ color: "var(--bad)" }}>✕</span>}
          <span>
            <b>{running ? KIND[job.kind] : "Falhou"}</b>
            <span className="mute"> {running ? (job.progress.label ?? "") : job.error?.message}</span>
          </span>
          {running && job.progress.total > 0 && (
            <>
              <span className="pg"><i style={{ width: `${pct}%` }} /></span>
              <span className="mono mute">{job.progress.done}/{job.progress.total}</span>
            </>
          )}
          {!running && <button className="btn ghost" onClick={clear}>Fechar</button>}
        </div>
      )}

      {modal === "voice" && (
        <VoiceDialog
          ep={ep}
          scenes={scenes}
          onClose={() => setModal(null)}
          onGo={(body) => {
            setModal(null);
            start("voice", slug, `/api/episodes/${slug}/voice`, body);
          }}
        />
      )}
      {modal === "sheets" && <Sheets sheets={sheets} onClose={() => setModal(null)} onRedo={() => { setModal(null); start("frames", slug, `/api/episodes/${slug}/frames`, {}); }} />}
      {modal === "video" && (
        <Dialog title="Vídeo renderizado" sub="Assista com som antes de empacotar: pronúncia, volume e sincronia só se conferem ouvindo." onClose={() => setModal(null)} footer={<><button className="btn" onClick={() => { setModal(null); start("render", slug, `/api/episodes/${slug}/render`, {}); }}>Renderizar de novo</button><button className="btn gold" onClick={() => { setModal(null); start("pack", slug, `/api/episodes/${slug}/pack`, {}); }}>Montar pacote →</button></>}>
          <div style={{ display: "grid", placeItems: "center", paddingBottom: 16 }}>
            <video src={`/files/out/${slug}.mp4?v=${Date.now()}`} controls autoPlay style={{ height: "62vh", borderRadius: 18, background: "#000" }} />
          </div>
        </Dialog>
      )}
      {modal === "pack" && <Pack slug={slug} files={ep.files.pack} onClose={() => setModal(null)} />}
    </div>
  );
};

/* ───────── formulário da cena ───────── */
const SceneForm: React.FC<{ slug: string; beat: any; onSaved: () => void; onDirty: (d: boolean) => void; saveRef: React.MutableRefObject<() => void> }> = ({ slug, beat, onSaved, onDirty, saveRef }) => {
  const init = useMemo(() => ({ narration: beat.narration ?? "", sub: beat.sub ?? "", hold: String(beat.hold ?? ""), params: Object.fromEntries(Object.entries(beat.params ?? {}).map(([k, v]) => [k, String(v)])) as Record<string, string> }), [beat]);
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setF(init), [init]);

  const fields = useMemo(() => {
    const o: Record<string, any> = {};
    if (f.narration !== init.narration) o.narration = f.narration;
    if (f.sub !== init.sub) o.sub = f.sub;
    if (f.hold !== init.hold) o.hold = Number(f.hold) || 0;
    for (const k of Object.keys(f.params)) {
      if (f.params[k] === init.params[k]) continue;
      const was = beat.params[k];
      o[`params.${k}`] = typeof was === "number" ? Number(f.params[k]) : typeof was === "boolean" ? f.params[k] === "true" : f.params[k];
    }
    return o;
  }, [f, init, beat]);
  const dirty = Object.keys(fields).length > 0;
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty]);

  const save = async () => {
    if (!dirty || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/api/episodes/${slug}/scene`, { type: "set", id: beat.id, fields });
      await onSaved();
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  };
  saveRef.current = save;
  const w = who(beat.speaker);

  return (
    <>
      <div className="scroll">
        <div className="pad">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="dot" style={{ ["--c" as any]: w.c }} />
            <h3 style={{ fontSize: 18 }}>{beat.id}</h3>
            <span className="tag">{beat.type}</span>
          </div>
          <div className="f">
            <label>Fala <span>[en]inglês[/en] · *ênfase*</span></label>
            <textarea className={`in${f.narration !== init.narration ? " dirty" : ""}`} value={f.narration} onChange={(e) => setF({ ...f, narration: e.target.value })} spellCheck={false} />
            <div className="preview"><Rich text={f.narration || " "} /></div>
          </div>
          <div className="row2">
            <div className="f">
              <label>Tradução na tela</label>
              <input className={`in${f.sub !== init.sub ? " dirty" : ""}`} value={f.sub} onChange={(e) => setF({ ...f, sub: e.target.value })} placeholder="opcional" />
            </div>
            <div className="f">
              <label>Pausa (s)</label>
              <input className={`in${f.hold !== init.hold ? " dirty" : ""}`} value={f.hold} onChange={(e) => setF({ ...f, hold: e.target.value })} inputMode="decimal" placeholder="0" />
            </div>
          </div>
          {Object.keys(f.params).length > 0 && (
            <>
              <div className="col-h" style={{ padding: 0, border: 0, height: "auto" }}>Na tela</div>
              {Object.keys(f.params).map((k) => (
                <div className="f" key={k}>
                  <label>{k}</label>
                  <input className={`in${f.params[k] !== init.params[k] ? " dirty" : ""}`} value={f.params[k]} onChange={(e) => setF({ ...f, params: { ...f.params, [k]: e.target.value } })} />
                </div>
              ))}
            </>
          )}
          {err && <div className="err">{err}</div>}
        </div>
      </div>
      <div className="savebar">
        <button className="btn gold" disabled={!dirty || busy} onClick={save}>{busy && <span className="spin" />}Salvar cena</button>
        <button className="btn ghost" disabled={!dirty || busy} onClick={() => setF(init)}>Desfazer</button>
        {dirty && f.narration !== init.narration && <span className="mute" style={{ fontSize: 12 }}>a voz desta cena será refeita</span>}
      </div>
    </>
  );
};

/* ───────── mundo ───────── */
const World: React.FC<{ slug: string; spec: any; onSaved: () => void }> = ({ slug, spec, onSaved }) => {
  const locked = spec.freedom === "recipe";
  const [err, setErr] = useState<string | null>(null);
  const set = async (k: string, v: string) => {
    setErr(null);
    try {
      await api.post(`/api/episodes/${slug}/scene`, { type: "world", fields: { [k]: v } });
      await onSaved();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const look = spec.world.look?.me ?? {};
  return (
    <div className="scroll">
      <div className="pad">
        {locked && <div className="box mute" style={{ margin: 0 }}>Este vídeo está no nível <b style={{ color: "var(--text)" }}>recipe</b>: o mundo foi sorteado e não muda. Crie no nível <b style={{ color: "var(--text)" }}>guided</b> para escolher.</div>}
        {Object.entries(WORLD).map(([k, d]) => (
          <div className="f" key={k}>
            <label>{d.label}</label>
            <div className="chips">
              {d.opts.map((o) => (
                <button key={o} className={`chip${spec.world[k] === o ? " on" : ""}`} disabled={locked} onClick={() => spec.world[k] !== o && set(k, o)}>{o}</button>
              ))}
            </div>
          </div>
        ))}
        <div className="f">
          <label>Elenco sorteado</label>
          <div className="chips">
            {["shirt", "pants", "hair", "skin"].filter((k) => look[k]).map((k) => (
              <span key={k} className="tag" style={{ height: 28 }}><span className="dot" style={{ ["--c" as any]: look[k], width: 12, height: 12 }} />{k}</span>
            ))}
            {look.hat && look.hat !== "none" && <span className="tag" style={{ height: 28 }}>{look.hat}</span>}
          </div>
        </div>
        {err && <div className="err">{err}</div>}
      </div>
    </div>
  );
};

/* ───────── voz ───────── */
const VoiceDialog: React.FC<{ ep: any; scenes: any[]; onClose: () => void; onGo: (body: any) => void }> = ({ ep, scenes, onClose, onGo }) => {
  const [bal, setBal] = useState<any>(undefined);
  useEffect(() => {
    api.get("/api/voice/balance").then((r) => setBal(r.balance)).catch(() => setBal(null));
  }, []);
  const fresh = scenes.filter((s) => s.voice !== "ok");
  const chars = fresh.reduce((a, s) => a + plain(s.beat.narration).length, 0);
  const left = bal ? bal.limit - bal.used : 0;
  return (
    <Dialog
      title="Gerar voz"
      sub="Confira as falas. Gerar voz gasta créditos do ElevenLabs; falas já gravadas ou em cache não gastam."
      onClose={onClose}
      footer={
        <>
          <span className="l">{fresh.length ? `${fresh.length} fala(s) nova(s), até ~${chars} caracteres` : "Todas as falas já têm voz."}</span>
          <button className="btn" onClick={() => onGo({ provider: "none" })} title="Calcula os tempos sem gerar áudio. Não gasta nada.">Só tempos, sem custo</button>
          <button className="btn gold" disabled={!bal || !fresh.length || chars > left} onClick={() => onGo({ confirm: true })}>Gerar voz</button>
        </>
      }
    >
      <div className="box">
        {bal === undefined && <span className="spin" />}
        {bal === null && <span>Sem chave de voz. Ponha <span className="mono">ELEVENLABS_API_KEY=…</span> no arquivo <span className="mono">.env.local</span> do espaço de trabalho e reinicie.</span>}
        {bal && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Plano <b>{bal.plan}</b></span>
              <span className="mono">{left.toLocaleString("pt-BR")} caracteres livres</span>
            </div>
            <div className="meter">
              <i style={{ width: `${(bal.used / bal.limit) * 100}%` }} />
              <i style={{ width: `${Math.min(100, ((bal.used + chars) / bal.limit) * 100)}%`, opacity: 0.35 }} />
            </div>
            {bal.plan === "free" && <div className="mute" style={{ marginTop: 8, fontSize: 12.5 }}>O plano grátis do ElevenLabs não cobre uso comercial.</div>}
          </>
        )}
      </div>
      {scenes.map((s) => {
        const w = who(s.beat.speaker);
        return (
          <div className="line" key={s.id} style={{ ["--c" as any]: w.c }}>
            <span className="who">{s.beat.speaker ? (ep.spec.cast?.[s.beat.speaker]?.label ?? w.label) : w.label}</span>
            <span><Rich text={s.beat.narration} /></span>
            {s.voice === "ok" ? <span className="tag">já tem</span> : <span className="pill" style={{ ["--c" as any]: "var(--warn)", height: 22 }}>nova</span>}
          </div>
        );
      })}
    </Dialog>
  );
};

/* ───────── folhas de revisão ───────── */
const Sheets: React.FC<{ sheets: string[]; onClose: () => void; onRedo: () => void }> = ({ sheets, onClose, onRedo }) => {
  const [zoom, setZoom] = useState<string | null>(null);
  return (
    <>
      <Dialog wide title="Folhas de revisão" sub="Dois quadros por cena. Confira enquadramento, textos e inglês na tela. Clique para ampliar." onClose={onClose} footer={<><button className="btn" onClick={onRedo}>Gerar de novo</button><button className="btn gold" onClick={onClose}>Tudo certo</button></>}>
        <div className="sheets">{sheets.map((s) => <img key={s} src={s} alt="Folha de revisão" onClick={() => setZoom(s)} />)}</div>
      </Dialog>
      {zoom && <div className="zoom" onClick={() => setZoom(null)}><img src={zoom} alt="" /></div>}
    </>
  );
};

/* ───────── pacote ───────── */
const Pack: React.FC<{ slug: string; files: string[]; onClose: () => void }> = ({ slug, files, onClose }) => {
  const plats = [["reels", "Reels"], ["tiktok", "TikTok"], ["shorts", "Shorts"]].filter(([k]) => files.includes(`${k}.txt`));
  const [p, setP] = useState(plats[0]?.[0] ?? "reels");
  const [txt, setTxt] = useState("");
  const [copied, setCopied] = useState(false);
  const url = (f: string) => `/files/out/${slug}/${encodeURIComponent(f)}`;
  useEffect(() => {
    setCopied(false);
    fetch(url(`${p}.txt`)).then((r) => (r.ok ? r.text() : "")).then(setTxt);
  }, [p]);
  return (
    <Dialog wide title="Pacote de postagem" sub="Nada é publicado daqui. Baixe o vídeo e copie a legenda de cada plataforma." onClose={onClose} footer={<a className="btn gold" href={url("video.mp4")} download={`${slug}.mp4`} style={{ textDecoration: "none" }}>↓ Baixar vídeo</a>}>
      <div className="result">
        <video src={url("video.mp4")} poster={files.includes("thumb.jpg") ? url("thumb.jpg") : undefined} controls />
        <div>
          <div className="plat">
            {plats.map(([k, l]) => <button key={k} className={`tab${p === k ? " on" : ""}`} onClick={() => setP(k)}>{l}</button>)}
            <button className="btn" style={{ marginLeft: "auto", height: 30 }} onClick={() => navigator.clipboard.writeText(txt).then(() => setCopied(true))}>{copied ? "✓ Copiado" : "Copiar"}</button>
          </div>
          <div className="cap">{txt}</div>
          <div className="files">{files.map((f) => <a key={f} className="tag" href={url(f)} target="_blank" rel="noreferrer">{f}</a>)}</div>
        </div>
      </div>
    </Dialog>
  );
};
