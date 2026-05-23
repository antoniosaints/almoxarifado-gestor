import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SessionProvider } from "@/lib/session";
import type { Warehouse } from "@/lib/types";
import { WarehouseTabs } from "./warehouse-detail-page";

const warehouse: Warehouse = {
  active: true,
  category: {
    id: "health",
    name: "Saude",
  },
  categoryId: "health",
  createdAt: "2026-05-22T12:00:00.000Z",
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
  updatedAt: "2026-05-22T12:00:00.000Z",
};

const warehouseWithStock: Warehouse = {
  ...warehouse,
  stocks: [
    {
      currentQuantity: 8,
      id: "health-paper",
      lastMovementAt: null,
      minimumQuantity: 2,
      product: {
        active: true,
        category: {
          id: "office",
          name: "Expediente",
        },
        categoryId: "office",
        code: "0000001",
        id: "paper",
        name: "Papel A4",
        unit: {
          abbreviation: "PCT",
          id: "pack",
          name: "Pacote",
        },
        unitId: "pack",
      },
      productId: "paper",
      warehouseId: "health",
    },
  ],
};

describe("WarehouseTabs", () => {
  it("hides the transfer tab outside the general warehouse", () => {
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
          <WarehouseTabs
            movements={[]}
            onMinimumChange={() => Promise.resolve()}
            onMovementSaved={() => Promise.resolve()}
            onStockDeleted={() => Promise.resolve()}
            products={[]}
            warehouse={warehouse}
            warehouses={[warehouse]}
          />
        </SessionProvider>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Transferir")).not.toBeInTheDocument();
  });

  it("shows direct entries and entry requests to operators outside the general warehouse", () => {
    render(
      <MemoryRouter>
        <SessionProvider
          initialSession={{
            token: "operator-token",
            user: {
              email: "operador@prefeitura.local",
              id: "operator",
              name: "Operador",
              role: "OPERATOR",
            },
          }}
        >
          <WarehouseTabs
            movements={[]}
            onMinimumChange={() => Promise.resolve()}
            onMovementSaved={() => Promise.resolve()}
            onStockDeleted={() => Promise.resolve()}
            products={[]}
            warehouse={warehouse}
            warehouses={[warehouse]}
          />
        </SessionProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("Entrada de estoque")).toBeInTheDocument();
    expect(screen.getByText("Solicitar entrada")).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Solicitar entrada" }),
    ).not.toBeInTheDocument();
  });

  it("uses row actions instead of inline minimum stock inputs", () => {
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
          <WarehouseTabs
            movements={[]}
            onMinimumChange={() => Promise.resolve()}
            onMovementSaved={() => Promise.resolve()}
            onStockDeleted={() => Promise.resolve()}
            products={[warehouseWithStock.stocks[0].product]}
            warehouse={warehouseWithStock}
            warehouses={[warehouseWithStock]}
          />
        </SessionProvider>
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText("Estoque minimo de Papel A4")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Editar estoque de Papel A4")).toBeInTheDocument();
    expect(screen.getByLabelText("Remover estoque de Papel A4")).toBeInTheDocument();
  });
});
