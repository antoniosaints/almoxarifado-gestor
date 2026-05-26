const systemType = (import.meta.env.VITE_TYPE_SYSTEM ?? "").toLowerCase();

export const isManagerSystem = systemType === "manager";
export const isFleetSystem = systemType === "fleet" || systemType === "frota";

export const systemModeLabel = isManagerSystem
  ? "Gestao de assinaturas"
  : isFleetSystem
    ? "Controle de frota"
    : "Operacao de estoque";
