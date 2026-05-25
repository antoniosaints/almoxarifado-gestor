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

const outsideProduct: Product = {
  active: true,
  category: {
    id: "cleaning",
    name: "Limpeza",
  },
  categoryId: "cleaning",
  code: "0000003",
  id: "detergent",
  name: "Detergente",
  unit: {
    abbreviation: "UN",
    id: "unit",
    name: "Unidade",
  },
  unitId: "unit",
};

const generalWarehouseWithStock: Warehouse = {
  ...warehouseWithStock,
  id: "central",
  isGeneral: true,
  name: "Almoxarifado Central",
  stocks: [
    warehouseWithStock.stocks[0],
    {
      currentQuantity: 0,
      id: "central-detergent",
      lastMovementAt: null,
      minimumQuantity: 0,
      product: outsideProduct,
      productId: outsideProduct.id,
      totalValue: 0,
      unitPriceAverage: 0,
      warehouseId: "central",
    },
  ],
};

function openOverviewTab() {
  const overviewTab = screen.getByRole("tab", { name: "Visao geral" });

  fireEvent.pointerDown(overviewTab, { button: 0, ctrlKey: false });
  fireEvent.click(overviewTab);
}

function openStockTab() {
  const stockTab = screen.getByRole("tab", { name: "Estoque" });

  fireEvent.pointerDown(stockTab, { button: 0, ctrlKey: false });
  fireEvent.click(stockTab);
}

function openHistoryTab() {
  const historyTab = screen.getByRole("tab", { name: "Historico" });

  fireEvent.pointerDown(historyTab, { button: 0, ctrlKey: false });
  fireEvent.click(historyTab);
}

describe("WarehouseTabs", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

    openStockTab();

    expect(screen.getByText("Incluir Estoque")).toBeInTheDocument();
    expect(screen.getByText("Solicitar")).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Solicitar" }),
    ).not.toBeInTheDocument();
  });

  it("shows entry requests to admins outside the general warehouse", () => {
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

    openStockTab();

    expect(screen.getByRole("button", { name: "Solicitar" })).toBeInTheDocument();
  });

  it("hides entry requests in the general warehouse", () => {
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
            warehouse={generalWarehouseWithStock}
            warehouses={[generalWarehouseWithStock, warehouse]}
          />
        </SessionProvider>
      </MemoryRouter>,
    );

    openStockTab();

    expect(screen.queryByRole("button", { name: "Solicitar" })).not.toBeInTheDocument();
  });

  it("only offers products already stocked in the warehouse for operator requests", () => {
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
            products={[warehouseWithStock.stocks[0].product, outsideProduct]}
            warehouse={warehouseWithStock}
            warehouses={[warehouseWithStock]}
          />
        </SessionProvider>
      </MemoryRouter>,
    );

    openStockTab();

    fireEvent.click(screen.getByRole("button", { name: "Solicitar" }));
    fireEvent.click(screen.getByRole("button", { name: "Produto" }));

    expect(screen.getByText("0000001 - Papel A4")).toBeInTheDocument();
    expect(screen.queryByText("0000003 - Detergente")).not.toBeInTheDocument();
  });

  it("only offers products with available stock for transfers from the general warehouse", () => {
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
            products={[warehouseWithStock.stocks[0].product, outsideProduct]}
            warehouse={generalWarehouseWithStock}
            warehouses={[generalWarehouseWithStock, warehouse]}
          />
        </SessionProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Transferir" }));
    fireEvent.click(screen.getByRole("button", { name: "Produto" }));

    expect(screen.getByText("0000001 - Papel A4")).toBeInTheDocument();
    expect(screen.queryByText("0000003 - Detergente")).not.toBeInTheDocument();
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

    openStockTab();

    expect(screen.queryByLabelText("Estoque minimo de Papel A4")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Editar estoque de Papel A4")).toBeInTheDocument();
    expect(screen.getByLabelText("Remover estoque de Papel A4")).toBeInTheDocument();
  });

  it("shows stock total value and movement action without state or unit price columns", () => {
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
                invoice: {
                  cnpj: "12345678000190",
                  companyName: "Fornecedor Municipal",
                  id: "invoice-1",
                  issueDate: "2026-05-23T12:00:00.000Z",
                  number: "NF-1",
                },
                invoiceId: "invoice-1",
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

    openStockTab();

    expect(screen.queryByRole("columnheader", { name: "Estado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Valor unitario" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: "Valor total" })[0]).toBeInTheDocument();
    expect(screen.getAllByText("R$ 186,64")[0]).toBeInTheDocument();
    expect(screen.getByLabelText("Ver movimentacoes de Papel A4")).toBeInTheDocument();
    expect(screen.getAllByText("Entrada - 23/05/2026, 09:00")[0]).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Ver movimentacoes de Papel A4"));
    expect(screen.getByRole("link", { name: "Abrir nota NF-1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeInTheDocument();
  });

  it("offers a filtered movement export from the history tab", () => {
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
                invoice: {
                  cnpj: "12345678000190",
                  companyName: "Fornecedor Municipal",
                  id: "invoice-1",
                  issueDate: "2026-05-23T12:00:00.000Z",
                  number: "NF-1",
                },
                invoiceId: "invoice-1",
                movementDate: "2026-05-23T12:00:00.000Z",
                product: warehouseWithStock.stocks[0].product,
                productId: "paper",
                quantity: 8,
                type: "ENTRADA",
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

    openHistoryTab();
    fireEvent.click(screen.getByRole("button", { name: "Exportar movimentacoes" }));

    expect(screen.getByRole("dialog", { name: "Exportar movimentacoes" })).toBeInTheDocument();
    expect(screen.getByLabelText("Periodo de")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtrar nota fiscal" })).toHaveTextContent(
      "Todas as notas",
    );
    expect(screen.getByRole("button", { name: "Filtrar produto" })).toHaveTextContent(
      "Todos os produtos",
    );
  });

  it("selects all stocks in bulk admin dialogs", () => {
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

    openStockTab();
    fireEvent.click(screen.getByRole("button", { name: "Zerar estoques" }));
    expect(screen.getByText("0 de 1 estoque(s) selecionado(s).")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Selecionar todos" }));

    expect(screen.getByText("1 de 1 estoque(s) selecionado(s).")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Limpar selecao" })).toBeInTheDocument();
  });

  it("shows statistical overview instead of duplicating the stock table", () => {
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

    openOverviewTab();

    expect(screen.queryByLabelText("Buscar produto no estoque...")).not.toBeInTheDocument();
    expect(screen.getByText("Valor total em estoque")).toBeInTheDocument();
    expect(screen.getByText("Distribuicao por categoria")).toBeInTheDocument();
  });

  it("uses stock as the first tab and remembers the selected tab", () => {
    const { unmount } = render(
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

    expect(screen.getByLabelText("Buscar produto no estoque...")).toBeInTheDocument();

    openHistoryTab();
    expect(window.localStorage.getItem("warehouse-tab-health")).toBe("history");
    unmount();

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

    expect(
      screen.getByRole("button", { name: "Exportar movimentacoes" }),
    ).toBeInTheDocument();
  });

  it("keeps the include stock modal open after creating a new product", async () => {
    let movementEntryCalls = 0;
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

        if (method === "POST" && url.pathname === "/movements/entry") {
          movementEntryCalls += 1;

          return new Response(JSON.stringify({ message: "Escolha um produto." }), {
            headers: { "Content-Type": "application/json" },
            status: 400,
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

    fireEvent.click(await screen.findByRole("tab", { name: "Estoque" }));
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
    expect(screen.queryByText("Escolha um produto.")).not.toBeInTheDocument();
    expect(movementEntryCalls).toBe(0);

    resolvePendingProductsReload?.(
      new Response(JSON.stringify([createdProduct]), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
  });
});
