import type {
  FleetDriver,
  FleetHealthStatus,
  FleetMaintenanceStatus,
  FleetMaintenanceType,
  FleetVehicleStatus,
} from "@/lib/types";

export const vehicleStatusLabels: Record<FleetVehicleStatus, string> = {
  ACTIVE: "Ativo",
  DISPOSED: "Baixado",
  INACTIVE: "Inativo",
  MAINTENANCE: "Em manutenção",
  TRANSFERRED: "Transferido",
};

export const driverStatusLabels: Record<FleetDriver["status"], string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  SUSPENDED: "Suspenso",
};

export const maintenanceTypeLabels: Record<FleetMaintenanceType, string> = {
  CORRECTIVE: "Corretiva",
  EMERGENCY: "Emergencial",
  PREDICTIVE: "Preditiva",
  PREVENTIVE: "Preventiva",
};

export const maintenanceStatusLabels: Record<FleetMaintenanceStatus, string> = {
  CANCELLED: "Cancelada",
  COMPLETED: "Concluída",
  IN_PROGRESS: "Em andamento",
  OPEN: "Aberta",
  WAITING_PART: "Aguardando peça",
};

export function vehicleStatusVariant(status: FleetVehicleStatus) {
  if (status === "ACTIVE") {
    return "success" as const;
  }

  if (status === "MAINTENANCE" || status === "TRANSFERRED") {
    return "low" as const;
  }

  return "zero" as const;
}

export function driverCnhLabel(driver: Pick<FleetDriver, "cnhHealth">) {
  const labels = {
    EXPIRED: "CNH vencida",
    EXPIRING: "CNH próxima",
    UNKNOWN: "Sem vencimento",
    VALID: "CNH válida",
  };

  return labels[driver.cnhHealth ?? "UNKNOWN"];
}

export function healthLabel(status?: FleetHealthStatus | null) {
  if (status === "OVERDUE") {
    return "Vencido";
  }

  if (status === "ATTENTION") {
    return "Atenção";
  }

  return "Em dia";
}

export function healthVariant(status?: FleetHealthStatus | null) {
  if (status === "OVERDUE") {
    return "zero" as const;
  }

  if (status === "ATTENTION") {
    return "low" as const;
  }

  return "success" as const;
}

export function dateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function todayDateInput() {
  return new Date().toISOString().slice(0, 10);
}

export function numberValue(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}
