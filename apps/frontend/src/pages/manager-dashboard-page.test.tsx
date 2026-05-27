import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManagerDashboardPage } from "./manager-dashboard-page";

const dashboardPayload = {
  billingStatusBreakdown: [
    { name: "Pagas", value: 3 },
    { name: "Vencidas", value: 1 },
  ],
  licenseStatusBreakdown: [
    { name: "Vinculadas", value: 2 },
    { name: "Ativas", value: 1 },
  ],
  monthlyRevenueTrend: [
    { name: "Jan/26", value: 1200 },
    { name: "Fev/26", value: 1600 },
  ],
  overdueBillings: [],
  revenueByLicenseType: [{ name: "MONTHLY", value: 1600 }],
  revenueBySystem: [{ name: "Almoxarifado", value: 1600 }],
  totals: {
    activeLicenses: 3,
    activeSubscribers: 2,
    averageTicket: 800,
    cancelledLicenses: 0,
    currentMonthRevenue: 1600,
    expiredLicenses: 0,
    expiringLicenses: 1,
    linkedLicenses: 2,
    monthlyRecurring: 1600,
    openAmount: 400,
    openBillings: 1,
    overdueAmount: 250,
    overdueBillings: 1,
    pendingLicenses: 0,
    totalLicenses: 3,
    totalRevenue: 2800,
    totalSubscribers: 3,
  },
  upcomingExpirations: [],
};

describe("ManagerDashboardPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => dashboardPayload,
        ok: true,
        status: 200,
      })),
    );
  });

  it("shows expanded manager KPIs and chart sections", async () => {
    render(<ManagerDashboardPage />);

    expect(await screen.findByText("Licenças vinculadas")).toBeInTheDocument();
    expect(screen.getByText("Vencimentos em 30 dias")).toBeInTheDocument();
    expect(screen.getByText("Valor vencido")).toBeInTheDocument();
    expect(screen.getByText("Ticket médio")).toBeInTheDocument();
    expect(screen.getByText("Receita mensal")).toBeInTheDocument();
    expect(screen.getByText("Status das licenças")).toBeInTheDocument();
    expect(screen.getByText("Status das cobranças")).toBeInTheDocument();
  });
});
