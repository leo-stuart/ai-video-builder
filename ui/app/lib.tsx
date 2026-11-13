import React, { useEffect } from "react";

export const WHO: Record<string, { label: string; c: string }> = {
  narrador: { label: "Narrador", c: "#b9b6e6" },
  voce: { label: "Você", c: "#ffc234" },
  atendente: { label: "Atendente", c: "#ff7a59" },
  tutor: { label: "Tutor", c: "#7b72ff" },
};
export const who = (s?: string) => WHO[s ?? "narrador"] ?? { label: s!, c: "#28c5e7" };

export const STATUS: Record<string, { label: string; c: string }> = {
  draft: { label: "Rascunho", c: "#9d9ac8" },
  voiced: { label: "Com voz", c: "#28c5e7" },
  rendered: { label: "Renderizado", c: "#ffc234" },
  packed: { label: "Pronto", c: "#19c99a" },
};

const PALETTE = ["#7b72ff", "#ff7a59", "#19c99a", "#b57cff", "#28c5e7", "#ffc234", "#ff5d6c"];
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
