import React, { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, chatStream, type ChatEvent } from "./api";

type Item = { role: "user" | "assistant"; text: string } | { role: "tool"; name: string; summary: string; ok: boolean };
type Cfg = { model: string; effort: string; models: { id: string; label: string; price: { in: string; out: string } }[]; efforts: string[]; hasKey: boolean };

const TOOL_LABEL: Record<string, string> = {
  edit_scene: "editou cena", get_episode: "leu o episódio", validate: "validou", review_frames: "olhou os quadros",
  list_beats: "consultou tipos de cena", list_formats: "consultou formatos", get_workspace: "consultou a marca",
};
const EFFORT_LABEL: Record<string, string> = { low: "baixo", medium: "médio", high: "alto" };

/** **negrito** e `código` do assistente; o resto vai como texto puro. */
const Md: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) =>
      p.startsWith("**") && p.length > 4 ? <b key={i}>{p.slice(2, -2)}</b> : p.startsWith("`") && p.length > 2 ? <code key={i} className="mono">{p.slice(1, -1)}</code> : <React.Fragment key={i}>{p}</React.Fragment>,
    )}
  </>
);

export const Chat: React.FC<{ slug: string; active: boolean; onChanged: (scene: string | null) => void }> = ({ slug, active, onChanged }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [lastModel, setLastModel] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    api.get<Cfg>("/api/workspace/chat").then(setCfg).catch((e) => setErr(e.message));
    api.get(`/api/episodes/${slug}/chat`).then((h) => {
      setItems(h.items);
      setLastModel(h.model);
      setBusy(!!h.busy);
    }).catch((e) => setErr(e.message));
  }, [slug]);

  useEffect(() => {
    if (active) box.current?.focus();
  }, [active]);
  useEffect(() => {
    const el = log.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [items, busy, err, active]);

  const pick = async (patch: { model?: string; effort?: string }) => {
    if (!cfg) return;
    setCfg({ ...cfg, ...patch });
    try {
      setCfg(await api.call("PATCH", "/api/workspace/chat", patch));
    } catch (e: any) {
      setErr(e.message);
      api.get<Cfg>("/api/workspace/chat").then(setCfg).catch(() => {});
    }
  };

  const onEvent = useCallback(
    (e: ChatEvent) => {
      if (e.event === "text") {
        setItems((xs) => {
          const l = xs[xs.length - 1];
          return l?.role === "assistant" ? [...xs.slice(0, -1), { role: "assistant", text: l.text + e.data.delta }] : [...xs, { role: "assistant", text: e.data.delta }];
        });
      } else if (e.event === "tool") setItems((xs) => [...xs, { role: "tool", ...e.data }]);
      else if (e.event === "changed") onChanged(e.data.scene);
      else if (e.event === "done") setLastModel(e.data.model);
      else if (e.event === "error") setErr(e.data.message);
    },
    [onChanged],
  );

  const send = async () => {
    const message = text.trim();
    if (!message || busy) return;
    setText("");
    setErr(null);
    setBusy(true);
    stick.current = true;
    setItems((xs) => [...xs, { role: "user", text: message }]);
    try {
      await chatStream(slug, message, onEvent);
    } catch (e: any) {
      setErr(e instanceof ApiError ? e.message : String(e?.message ?? e));
    } finally {
      setBusy(false);
      box.current?.focus();
    }
  };

  const clear = async () => {
    if (busy) return;
    try {
      await api.del(`/api/episodes/${slug}/chat`);
      setItems([]);
      setLastModel(null);
      setErr(null);
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const m = cfg?.models.find((x) => x.id === cfg.model);
  const switched = items.length > 0 && !!lastModel && !!cfg && cfg.model !== lastModel;
  const thinking = busy && items[items.length - 1]?.role !== "assistant";

  return (
    <div className="chat" hidden={!active}>
      <div className="chat-cfg">
        <select className="in sel" aria-label="Modelo" value={cfg?.model ?? ""} disabled={busy || !cfg} onChange={(e) => pick({ model: e.target.value })}>
          {cfg?.models.map((x) => <option key={x.id} value={x.id}>{x.label} · {x.price.in}/{x.price.out}</option>)}
        </select>
        <div className="chat-sub">
          <div className="chips" role="group" aria-label="Esforço">
          {cfg?.efforts.map((x) => <button key={x} className={`chip${cfg.effort === x ? " on" : ""}`} disabled={busy} title={`Esforço de raciocínio: ${EFFORT_LABEL[x]}`} onClick={() => pick({ effort: x })}>{EFFORT_LABEL[x]}</button>)}
        </div>
          <button className="btn ghost clr" disabled={busy || !items.length} onClick={clear} title="Apagar a conversa deste episódio">Limpar</button>
        </div>
        {m && <div className="chat-price mono">US$ por milhão de tokens · entrada {m.price.in} · saída {m.price.out}</div>}
      </div>

      <div className="chat-log" ref={log} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}>
        {!items.length && !busy && (
          <div className="chat-empty">
            <b>Converse com o Claude sobre este episódio.</b>
            <span>Ele lê e edita as cenas por você. Experimente:</span>
            <button className="chip" onClick={() => setText("Reescreve o roteiro com outro gancho.")}>Reescreve o roteiro com outro gancho</button>
            <button className="chip" onClick={() => setText("Troca o lugar para hotel.")}>Troca o lugar para hotel</button>
            <span className="mute">A voz você gera no passo Voz; o chat só sugere.</span>
          </div>
        )}
        {items.map((it, i) =>
          it.role === "tool" ? (
            <div key={i} className={`cmsg tool${it.ok ? "" : " bad"}`} title={it.summary}>
              <i className="dot" style={{ ["--c" as any]: it.ok ? "var(--ok)" : "var(--bad)" }} />
              <span className="n">{TOOL_LABEL[it.name] ?? it.name}</span>
              <span className="s">{it.summary}</span>
            </div>
          ) : (
            <div key={i} className={`cmsg ${it.role}`}>
              <Md text={it.text} />
            </div>
          ),
        )}
        {thinking && <div className="cmsg assistant typing" aria-label="Claude está respondendo"><i /><i /><i /></div>}
        {err && <div className="err" role="alert">{err}</div>}
      </div>

      {cfg && !cfg.hasKey && <div className="chat-note warn">Sem chave: ponha <span className="mono">ANTHROPIC_API_KEY</span> no <span className="mono">.env.local</span> do espaço de trabalho.</div>}
      {switched && <div className="chat-note warn">Você trocou de modelo no meio da conversa. O raciocínio guardado pelo modelo anterior pode não ser lido por este (a API descarta o que não entende) e o cache recomeça. Se as respostas ficarem estranhas, limpe a conversa.</div>}

      <form className="chat-in" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <textarea
          ref={box}
          className="in"
          rows={2}
          value={text}
          placeholder="Peça uma edição…  (Enter envia, Shift+Enter quebra a linha)"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
        />
        <button className="btn gold" type="submit" disabled={busy || !text.trim()}>{busy ? <span className="spin" /> : "Enviar"}</button>
      </form>
    </div>
  );
};
