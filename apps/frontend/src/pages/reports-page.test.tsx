import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Warehouse } from "@/lib/types";
import { ReportsPage } from "./reports-page";

const warehouses: Warehouse[] = [
  {
    active: true,
    category: {
      id: "health",
      name: "Saude",
    },
    categoryId: "health",
    createdAt: "2026-05-23T12:00:00.000Z",
    id: "health",
    isGeneral: false,
    name: "Almoxarifado da Saude",
    stocks: [],
    summary: {
      lastMovementAt: null,
      lowStockItems: 0,
      outOfStockItems: 0,
      stockedProducts: 0,
    },
    updatedAt: "2026-05-23T12:00:00.000Z",
  },
];

function mockReportFetch() {
  const requestedPaths: string[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requestedPaths.push(`${url.pathname}${url.search}`);

      if (url.pathname === "/warehouses") {
        return new Response(JSON.stringify(warehouses), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      return new Response(new Blob(["pdf"], { type: "application/pdf" }), {
        headers: { "Content-Type": "application/pdf" },
        status: 200,
      });
    }),
  );

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:report"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

  return requestedPaths;
}

describe("ReportsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("opens an invoice export pre-modal with invoice-specific filters", async () => {
    const requestedPaths = mockReportFetch();

    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Exportar PDF" }).length).toBe(3);
    });

    fireEvent.change(screen.getByLabelText("Período de"), {
      target: { value: "2026-05-01" },
    });
    fireEvent.change(screen.getByLabelText("Período até"), {
      target: { value: "2026-05-31" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Exportar PDF" })[2]);

    fireEvent.change(screen.getByLabelText("Empresa"), {
      target: { value: "Papelaria" },
    });
    fireEvent.change(screen.getByLabelText("CNPJ"), {
      target: { value: "123" },
    });
    fireEvent.change(screen.getByLabelText("Nota fiscal"), {
      target: { value: "NF-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Exportar notas" }));

    await waitFor(() => {
      expect(
        requestedPaths.some((path) =>
          path.includes(
            "/reports/invoices?from=2026-05-01&to=2026-05-31&companyName=Papelaria&cnpj=123&number=NF-10",
          ),
        ),
      ).toBe(true);
    });
  });

  it("opens a warehouse selector before exporting movement reports", async () => {
    const requestedPaths = mockReportFetch();

    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Exportar PDF" }).length).toBe(3);
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Exportar PDF" })[0]);
    fireEvent.click(screen.getByLabelText("Almoxarifado da Saude"));
    fireEvent.click(
      screen.getByRole("button", { name: "Exportar movimentações" }),
    );

    await waitFor(() => {
      expect(
        requestedPaths.some((path) =>
          path.includes("/reports/movements?warehouseIds=health"),
        ),
      ).toBe(true);
    });
  });
});
