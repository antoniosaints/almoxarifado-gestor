import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "@/lib/session";
import type { Product, Warehouse } from "@/lib/types";
import { WarehouseDetailPage, WarehouseTabs } from "./warehouse-detail-page";

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
      totalValue: 186.64,
      unitPriceAverage: 23.33,
      warehouseId: "health",
    },
  ],
};

const createdProduct: Product = {
  active: true,
  category: {
    id: "office",
    name: "Expediente",
  },
  categoryId: "office",
  code: "0000002",
  id: "new-paper",
  name: "Clips galvanizado",
  unit: {
    abbreviation: "CX",
    id: "box",
    name: "Caixa",
  },
  unitId: "box",
};

describe("WarehouseTabs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

    expect(screen.getByText("Incluir Estoque")).toBeInTheDocument();
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

  it("shows stock value columns and movement action without the state column", () => {
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
            movements={[
              {
                id: "movement-1",
                movementDate: "2026-05-23T12:00:00.000Z",
                product: warehouseWithStock.stocks[0].product,
                productId: "paper",
                quantity: 8,
                type: "ENTRADA",
                unitPrice: 23.33,
                warehouse: {
                  id: "health",
                  name: "Almoxarifado da Saude",
                },
                warehouseId: "health",
              },
            ]}
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

    expect(screen.queryByRole("columnheader", { name: "Estado" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: "Valor unitario" })[0]).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: "Valor total" })[0]).toBeInTheDocument();
    expect(screen.getAllByText("R$ 23,33")[0]).toBeInTheDocument();
    expect(screen.getAllByText("R$ 186,64")[0]).toBeInTheDocument();
    expect(screen.getByLabelText("Ver movimentacoes de Papel A4")).toBeInTheDocument();
    expect(screen.getAllByText("Entrada - 23/05/2026, 09:00")[0]).toBeInTheDocument();
  });

  it("keeps the include stock modal open after creating a new product", async () => {
    let productListCalls = 0;
    let resolvePendingProductsReload: ((response: Response) => void) | undefined;
    const pendingProductsReload = new Promise<Response>((resolve) => {
      resolvePendingProductsReload = resolve;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const method = init?.method ?? "GET";

        if (method === "POST" && url.pathname === "/products") {
          return new Response(JSON.stringify(createdProduct), {
            headers: { "Content-Type": "application/json" },
            status: 201,
          });
        }

        if (url.pathname === "/products") {
          productListCalls += 1;

          if (productListCalls > 1) {
            return pendingProductsReload;
          }

          return new Response(JSON.stringify([]), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          });
        }

        const payloadByPath: Record<string, unknown> = {
          "/entry-requests/available-products": [],
          "/movements": [],
          "/product-categories": [createdProduct.category],
          "/units": [createdProduct.unit],
          "/warehouses": [warehouse],
          "/warehouses/health": warehouse,
        };

        return new Response(JSON.stringify(payloadByPath[url.pathname] ?? []), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }),
    );

    render(
      <MemoryRouter initialEntries={["/warehouses/health"]}>
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
          <Routes>
            <Route element={<WarehouseDetailPage />} path="/warehouses/:warehouseId" />
          </Routes>
        </SessionProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Incluir Estoque" }));
    fireEvent.click(screen.getByRole("button", { name: "Novo produto" }));
    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: createdProduct.name },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar produto" }));

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "Incluir Estoque" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Estoque minimo inicial")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Produto" })).toHaveTextContent(
      "0000002 - Clips galvanizado",
    );

    resolvePendingProductsReload?.(
      new Response(JSON.stringify([createdProduct]), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
  });
});
