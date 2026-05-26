export const isManagerSystem = import.meta.env.VITE_TYPE_SYSTEM === "manager";

export const systemModeLabel = isManagerSystem
  ? "Gestao de assinaturas"
  : "Operacao de estoque";
