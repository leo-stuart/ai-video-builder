import React, { createContext, useContext } from "react";

/** Marca do espaço de trabalho (workspace.json → brand). Caminhos de imagem são relativos a `public/`. */
export type Brand = {
  name: string;
  /** Frase da tela final. O trecho entre ** vai em destaque. */
  tagline?: string;
  cta?: string;
  logo?: string;
  productShots?: string[];
};

export const EMPTY_BRAND: Brand = { name: "" };

const BrandContext = createContext<Brand>(EMPTY_BRAND);
export const BrandProvider: React.FC<{ brand: Brand; children: React.ReactNode }> = ({ brand, children }) => <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
export const useBrand = () => useContext(BrandContext);

/** "Pare de estudar. **Comece a falar.**" → texto + <b>destaque</b>. */
export const renderTagline = (tagline: string): React.ReactNode[] =>
  tagline
    .split("**")
    .map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part))
    .filter((p) => p !== "");
