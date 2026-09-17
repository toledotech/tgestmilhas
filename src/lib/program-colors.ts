// Compartilhado entre Explorar, Minhas Milhas e o calendário de preços —
// pra todo programa aparecer sempre com a mesma cor em qualquer tela.
export const PROGRAM_LABEL: Record<string, string> = {
  smiles: "Smiles",
  latampass: "LATAM Pass",
  tudoazul: "TudoAzul",
  azulpelomundo: "Azul Pelo Mundo",
  iberiaplus: "Iberia Plus",
};

export const PROGRAM_COLOR: Record<string, string> = {
  smiles: "#f97316",
  latampass: "#dc2626",
  tudoazul: "#2563eb",
  azulpelomundo: "#0891b2",
  iberiaplus: "#7c3aed",
};

export const DEFAULT_PROGRAM_COLOR = "#64748b";

export function hexToRgba(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
