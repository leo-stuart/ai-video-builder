import React, { useEffect } from "react";

/** Nome provisório do produto. Troque aqui quando ele tiver nome. */
export const PRODUCT = "Estúdio";

export const WHO: Record<string, { label: string; c: string }> = {
  narrador: { label: "Narrador", c: "#c3c9d2" },
  voce: { label: "Você", c: "#f0c488" },
  atendente: { label: "Atendente", c: "#f0a096" },
  tutor: { label: "Tutor", c: "#9fd6ff" },
};
export const who = (s?: string) => WHO[s ?? "narrador"] ?? { label: s!, c: "#7ef0c3" };

export const STATUS: Record<string, { label: string; c: string }> = {
  draft: { label: "Rascunho", c: "#9aa1ad" },
  voiced: { label: "Com voz", c: "#9fd6ff" },
  rendered: { label: "Renderizado", c: "#ffb968" },
  packed: { label: "Pronto", c: "#7ef0c3" },
};

const PALETTE = ["#9fd6ff", "#f0c488", "#7ef0c3", "#f0a096", "#c3c9d2"];
export const colorOf = (s: string) => PALETTE[[...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % PALETTE.length];

/** Mostra a narração como ela sai na legenda: inglês em dourado, ênfase em coral. */
export const Rich: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/(\[en\].*?\[\/en\]|\*[^*]+\*)/g).map((p, i) =>
      p.startsWith("[en]") ? (
        <span key={i} className="en">{p.slice(4, -5)}</span>
      ) : p.startsWith("*") && p.length > 1 ? (
        <span key={i} className="em">{p.slice(1, -1)}</span>
      ) : (
        <React.Fragment key={i}>{p}</React.Fragment>
      ),
    )}
  </>
);

/** **assim** vira destaque (a frase da marca). */
export const Bold: React.FC<{ text: string }> = ({ text }) => <>{text.split(/\*\*(.+?)\*\*/g).map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p))}</>;

export const plain = (n: string) => n.replace(/\[\/?en\]|\*/g, "").split(/\s+/).filter(Boolean).join(" ");
export const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export const Dialog: React.FC<{ title: string; sub?: React.ReactNode; wide?: boolean; onClose: () => void; footer?: React.ReactNode; children: React.ReactNode }> = ({ title, sub, wide, onClose, footer, children }) => {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="veil" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dlg${wide ? " wide" : ""}`} role="dialog" aria-label={title}>
        <div className="dlg-h">
          <div>
            <h2>{title}</h2>
            {sub && <p>{sub}</p>}
          </div>
          <button className="x" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        <div className="dlg-b">{children}</div>
        {footer && <div className="dlg-f">{footer}</div>}
      </div>
    </div>
  );
};
