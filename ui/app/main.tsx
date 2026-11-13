import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

// Remotion 4.0.543 passa `ref` a um componente de função (AbsoluteFill); o React 18.3 avisa disso em dev.
// É ruído do pacote, sem efeito: filtramos só esse aviso e deixamos passar o resto.
const origError = console.error;
console.error = (...a: any[]) => {
  if (typeof a[0] === "string" && (a[0].includes("`ref` is not a prop") || a[0].includes("Function components cannot be given refs"))) return;
  origError(...a);
};

createRoot(document.getElementById("root")!).render(<App />);
