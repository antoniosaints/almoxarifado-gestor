import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManagerBillingPage } from "./manager-billing-page";

const subscriber = {
  active: true,
  createdAt: "2026-05-01T00:00:00.000Z",
  email: "cliente@example.com",
  id: "subscriber-1",
  name: "Cliente Municipal",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

const license = {
  createdAt: "2026-05-01T00:00:00.000Z",
  expiresAt: "2026-06-15T00:00:00.000Z",
  id: "license-1",
  licenseKey: "ALMO-TESTE-001",
  monthlyValue: 250,
  seats: 5,
  startsAt: "2026-05-01T00:00:00.000Z",
  status: "ACTIVE",
  subscriber,
  subscriberId: "subscriber-1",
  systemKey: "Almoxarifado",
  type: "MONTHLY",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

const billing = {
  amount: 250,
  createdAt: "2026-05-01T00:00:00.000Z",
  dueDate: "2026-05-10T00:00:00.000Z",
  id: "billing-1",
  license,
  licenseId: "license-1",
  payments: [],
  reference: "2026-05",
  status: "OPEN",
  subscriber,
  subscriberId: "subscriber-1",
  systemKey: "Almoxarifado",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

describe("ManagerBillingPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/manager/licenses")) {
          return { json: async () => [license], ok: true, status: 200 };
        }

        if (url.includes("/manager/subscribers")) {
          return { json: async () => [subscriber], ok: true, status: 200 };
        }

        return { json: async () => [billing], ok: true, status: 200 };
      }),
    );
  });

  it("exposes Pix, boleto and delete actions for open billings", async () => {
    render(<ManagerBillingPage />);

    expect(await screen.findByText("2026-05")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Gerar Pix para cobrança 2026-05" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Gerar boleto para cobrança 2026-05" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Apagar cobrança 2026-05" }),
    ).toBeInTheDocument();
  });

  it("generates gateway billings and deletes open billings from the billing menu", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/manager/licenses")) {
        return { json: async () => [license], ok: true, status: 200 };
      }

      if (url.includes("/manager/subscribers")) {
        return { json: async () => [subscriber], ok: true, status: 200 };
      }

      if (url.includes("/manager/billings/billing-1/faturar")) {
        return { json: async () => ({ ...billing, payments: [] }), ok: true, status: 200 };
      }

      if (url.includes("/manager/billings/billing-1") && init?.method === "DELETE") {
        return { json: async () => null, ok: true, status: 204 };
      }

      return { json: async () => [billing], ok: true, status: 200 };
    });

    vi.stubGlobal("fetch", fetchMock);
    render(<ManagerBillingPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Gerar Pix para cobrança 2026-05" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Gerar boleto para cobrança 2026-05" }));
    fireEvent.click(screen.getByRole("button", { name: "Apagar cobrança 2026-05" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/manager/billings/billing-1/faturar"),
        expect.objectContaining({
          body: JSON.stringify({
            gatewayProvider: "MERCADO_PAGO",
            method: "PIX",
            mode: "GATEWAY",
          }),
          method: "POST",
        }),
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/manager/billings/billing-1/faturar"),
      expect.objectContaining({
        body: JSON.stringify({
          gatewayProvider: "MERCADO_PAGO",
          method: "BOLETO",
          mode: "GATEWAY",
        }),
        method: "POST",
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/manager/billings/billing-1"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
