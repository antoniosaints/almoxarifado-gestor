const systemType = (import.meta.env.VITE_TYPE_SYSTEM ?? "").toLowerCase();

export const isManagerSystem = systemType === "manager";
export const isFleetSystem = systemType === "fleet" || systemType === "frota";
export const isSiteSystem = systemType === "site";

export const systemModeLabel = isManagerSystem
  ? "Gestão de assinaturas"
  : isSiteSystem
    ? "Site institucional"
  : isFleetSystem
    ? "Controle de frota"
    : "Operação de estoque";
