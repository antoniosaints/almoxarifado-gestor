import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "@/lib/session";
import type { EntryRequest, TransferRequest } from "@/lib/types";
import { RequestsPage } from "./requests-page";

const product = {
  code: "0000001",
  id: "paper",
  name: "Papel A4",
  unit: {
    abbreviation: "PCT",
    id: "pack",
    name: "Pacote",
  },
};

const warehouse = {
  category: {
    id: "health",
    name: "Saude",
  },
  id: "health",
  name: "Almoxarifado da Saude",
};

const centralWarehouse = {
  category: {
    id: "general",
    name: "Geral",
  },
  id: "central",
  name: "Almoxarifado Central",
};

const entryRequest: EntryRequest = {
  createdAt: "2026-05-23T12:00:00.000Z",
  id: "entry-request",
  movementDate: "2026-05-23T12:00:00.000Z",
  product,
  quantity: 4,
  requestedBy: {
    email: "operador@prefeitura.local",
    id: "operator",
    name: "Operador",
  },
  status: "PENDING",
  warehouse,
};

const transferRequest: TransferRequest = {
  createdAt: "2026-05-23T12:00:00.000Z",
  createdBy: {
    email: "admin@prefeitura.local",
    id: "admin",
    name: "Administrador",
  },
  destinationWarehouse: warehouse,
  id: "transfer-request",
  movementDate: "2026-05-23T12:00:00.000Z",
  product,
  quantity: 2,
  sourceWarehouse: centralWarehouse,
  status: "PENDING_RECEIPT",
};

describe("RequestsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("offers quick access to the related warehouse from requests and receipts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        const payload =
          url.pathname === "/entry-requests"
            ? [entryRequest]
            : url.pathname === "/transfer-requests"
              ? [transferRequest]
              : [];

        return new Response(JSON.stringify(payload), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }),
    );

    render(
      <MemoryRouter>
        <SessionProvider
          initialSession={{
            token: "admin-token",
            user: {
              email: "admin@prefeitura.local",
              id: "admin",
              name: "Administrador",
              role: "ADMIN",
            },
          }}
        >
          <RequestsPage />
        </SessionProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Papel A4")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("link", {
        name: "Abrir almoxarifado Almoxarifado da Saude",
      }),
    ).toHaveAttribute("href", "/warehouses/health");

    fireEvent.click(screen.getByRole("tab", { name: "Recebimentos" }));

    expect(
      screen.getByRole("link", {
        name: "Abrir destino Almoxarifado da Saude",
      }),
    ).toHaveAttribute("href", "/warehouses/health");
  });
});
