import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "@/lib/session";
import type { EntryRequest, TransferRequest } from "@/lib/types";
import { RequestsPage } from "./requests-page";

const product = {
  category: {
    id: "office",
    name: "Expediente",
  },
  code: "0000001",
  id: "paper",
  name: "Papel A4",
  unit: {
    abbreviation: "PCT",
    id: "pack",
    name: "Pacote",
  },
};

const secondProduct = {
  category: {
    id: "office",
    name: "Expediente",
  },
  code: "0000002",
  id: "pen",
  name: "Caneta azul",
  unit: {
    abbreviation: "UN",
    id: "unit",
    name: "Unidade",
  },
};

const warehouse = {
  category: {
    id: "health",
    name: "Saude",
  },
  id: "health",
  isGeneral: false,
  name: "Almoxarifado da Saude",
};

const centralWarehouse = {
  category: {
    id: "general",
    name: "Geral",
  },
  id: "central",
  isGeneral: true,
  name: "Almoxarifado Central",
};

const warehousesPayload = [
  {
    ...centralWarehouse,
    active: true,
    categoryId: "general",
    createdAt: "2026-05-20T12:00:00.000Z",
    isGeneral: true,
    stocks: [
      {
        currentQuantity: 10,
        id: "central-paper",
        minimumQuantity: 0,
        product,
        productId: product.id,
        totalValue: 100,
        unitPriceAverage: 10,
        warehouseId: "central",
      },
    ],
    summary: {
      lastMovementAt: null,
      lowStockItems: 0,
      outOfStockItems: 0,
      stockedProducts: 1,
    },
    updatedAt: "2026-05-20T12:00:00.000Z",
  },
  {
    ...warehouse,
    active: true,
    categoryId: "health",
    createdAt: "2026-05-20T12:00:00.000Z",
    isGeneral: false,
    stocks: [
      {
        currentQuantity: 3,
        id: "health-paper",
        minimumQuantity: 0,
        product,
        productId: product.id,
        totalValue: 30,
        unitPriceAverage: 10,
        warehouseId: "health",
      },
    ],
    summary: {
      lastMovementAt: null,
      lowStockItems: 0,
      outOfStockItems: 0,
      stockedProducts: 1,
    },
    updatedAt: "2026-05-20T12:00:00.000Z",
  },
];

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
    vi.restoreAllMocks();
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

  it("hides rejected requests by default and shows them when filtered in", async () => {
    const rejectedRequest: EntryRequest = {
      ...entryRequest,
      id: "rejected-request",
      product: secondProduct,
      status: "REJECTED",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        const payload =
          url.pathname === "/entry-requests"
            ? [entryRequest, rejectedRequest]
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

    // Padrão: Pendente + Aprovado (a rejeitada fica escondida).
    await waitFor(() => {
      expect(screen.getByText("Papel A4")).toBeInTheDocument();
    });
    expect(screen.queryByText("Caneta azul")).not.toBeInTheDocument();

    // Ligando "Rejeitado" a solicitação aparece.
    fireEvent.click(screen.getByRole("button", { name: "Rejeitado" }));
    expect(await screen.findByText("Caneta azul")).toBeInTheDocument();

    // Desligando "Pendente" a pendente some.
    fireEvent.click(screen.getByRole("button", { name: "Pendente" }));
    await waitFor(() => {
      expect(screen.queryByText("Papel A4")).not.toBeInTheDocument();
    });
  });

  it("opens the office letter for non-general entry requests", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue({} as Window);
    const requestedPaths: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        requestedPaths.push(url.pathname);

        if (url.pathname === "/entry-requests/entry-request/office-letter/pdf") {
          throw new Error("The frontend should not request backend office PDFs.");
        }

        const payload =
          url.pathname === "/entry-requests"
            ? [entryRequest]
            : url.pathname === "/entry-requests/entry-request/office-letter"
              ? {
                  contentHtml:
                    "<p>Venho solicitar:</p><p>Papel A4 - 4 PCT.</p>",
                  documentHtml:
                    '<article data-office-letter-document="true"><h1>Documento fiel do ofÃ­cio</h1><p>Papel A4 - 4 PCT.</p></article>',
                  header: {
                    logoUrl: "/uploads/settings/office-logo.png?v=1",
                    subtitle: "Almoxarifado da Saude",
                    title: "Saude",
                  },
                  items: [
                    {
                      productName: "Papel A4",
                      quantity: 4,
                      unit: "PCT",
                    },
                  ],
                  number: 1,
                  numberFormatted: "001/2026",
                  request: {
                    id: "entry-request",
                    status: "PENDING",
                    warehouseId: "health",
                  },
                  subject: "Solicitação de material/equipamento",
                  year: 2026,
                }
              : url.pathname === "/transfer-requests"
                ? []
                : url.pathname === "/warehouses"
                  ? warehousesPayload
                  : url.pathname === "/invoices"
                    ? []
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

    fireEvent.click(await screen.findByRole("button", { name: "Ver ofício" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Ofício da solicitação",
    });

    expect(within(dialog).getByText("Documento fiel do ofÃ­cio")).toBeInTheDocument();
    expect(within(dialog).getByText("Papel A4 - 4 PCT.")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Abrir PDF" }));

    await waitFor(() => {
      expect(open).toHaveBeenCalledWith(
        "/requests/entry-request/office-letter/print",
        "_blank",
        "noopener,noreferrer",
      );
    });
    expect(requestedPaths).not.toContain(
      "/entry-requests/entry-request/office-letter/pdf",
    );
  });

  it("opens a direct request dialog with warehouse and product fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        const payload =
          url.pathname === "/entry-requests"
            ? []
            : url.pathname === "/transfer-requests"
              ? []
              : url.pathname === "/warehouses"
                ? [warehouse]
                : url.pathname === "/entry-requests/available-products"
                  ? [product]
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

    fireEvent.click(await screen.findByRole("button", { name: "Solicitar" }));

    expect(
      screen.getByRole("dialog", { name: "Solicitar entrada" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Almoxarifado destino")).toBeInTheDocument();
    expect(screen.getByLabelText("Produto")).toBeInTheDocument();
  });

  it("sends multiple items when creating a direct entry request", async () => {
    let requestPayload: unknown;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));

      if (url.pathname === "/entry-requests" && init?.method === "POST") {
        requestPayload = JSON.parse(String(init.body));

        return new Response(JSON.stringify({ id: "new-request" }), {
          headers: { "Content-Type": "application/json" },
          status: 201,
        });
      }

      const payload =
        url.pathname === "/entry-requests"
          ? []
          : url.pathname === "/transfer-requests"
            ? []
            : url.pathname === "/warehouses"
              ? [warehouse]
              : url.pathname === "/entry-requests/available-products"
                ? [product, secondProduct]
                : [];

      return new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    });

    vi.stubGlobal("fetch", fetchMock);

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

    fireEvent.click(await screen.findByRole("button", { name: "Solicitar" }));
    await screen.findByText("0000001 - Papel A4");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar item" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Produto 2")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Produto 2"));
    fireEvent.click(await screen.findByRole("button", { name: "0000002 - Caneta azul" }));

    const dialog = screen.getByRole("dialog", { name: "Solicitar entrada" });
    const quantities = within(dialog).getAllByLabelText("Quantidade");
    fireEvent.change(quantities[0], { target: { value: "3" } });
    fireEvent.change(quantities[1], { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitação" }));

    await waitFor(() => {
      expect(requestPayload).toMatchObject({
        items: [
          { productId: product.id, quantity: 3 },
          { productId: secondProduct.id, quantity: 2 },
        ],
        productId: product.id,
        quantity: 3,
      });
    });
  });

  it("shows approval stock summary and sends adjusted quantity", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));

      if (url.pathname === "/entry-requests/entry-request/approve") {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toMatchObject({
          items: [
            {
              productId: product.id,
              quantity: 2,
            },
          ],
          quantity: 2,
        });

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      const payload =
        url.pathname === "/entry-requests"
          ? [entryRequest]
          : url.pathname === "/transfer-requests"
            ? []
            : url.pathname === "/warehouses"
              ? warehousesPayload
              : url.pathname === "/invoices"
                ? []
                : [];

      return new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    });

    vi.stubGlobal("fetch", fetchMock);

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

    fireEvent.click(await screen.findByRole("button", { name: "Aprovar" }));
    fireEvent.change(screen.getByLabelText("Quantidade aprovada"), {
      target: { value: "2" },
    });

    expect(screen.getByText("Estoque geral: 10 PCT")).toBeInTheDocument();
    expect(screen.getByText("Após aprovar: 8 PCT")).toBeInTheDocument();
    expect(screen.getByText("Destino atual: 3 PCT")).toBeInTheDocument();
    expect(screen.getByText("Destino após entrada: 5 PCT")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar aprovação" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://127.0.0.1:3333/entry-requests/entry-request/approve",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("opens a transfer dialog from requests page with destination warehouse", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        const payload =
          url.pathname === "/entry-requests"
            ? []
            : url.pathname === "/transfer-requests"
              ? []
              : url.pathname === "/warehouses"
                ? warehousesPayload
                : url.pathname === "/entry-requests/available-products"
                  ? [product]
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

    fireEvent.click(await screen.findByRole("button", { name: "Transferir" }));

    expect(screen.getByRole("dialog", { name: "Transferir produto" })).toBeInTheDocument();
    expect(screen.getByLabelText("Almoxarifado destino")).toBeInTheDocument();
    expect(screen.getByLabelText("Produto")).toBeInTheDocument();
  });

  it("creates an ad hoc output request from the requests page", async () => {
    let requestPayload: unknown;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));

      if (url.pathname === "/entry-requests/ad-hoc-output" && init?.method === "POST") {
        requestPayload = JSON.parse(String(init.body));

        return new Response(JSON.stringify({ id: "ad-hoc-output" }), {
          headers: { "Content-Type": "application/json" },
          status: 201,
        });
      }

      const payload =
        url.pathname === "/entry-requests"
          ? []
          : url.pathname === "/transfer-requests"
            ? []
            : url.pathname === "/warehouses"
              ? warehousesPayload
              : url.pathname === "/invoices"
                ? []
                : [];

      return new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    });

    vi.stubGlobal("fetch", fetchMock);

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

    fireEvent.click(
      await screen.findByRole("button", { name: "Solicitar saída avulsa" }),
    );

    const dialog = screen.getByRole("dialog", { name: "Saída avulsa" });
    expect(within(dialog).getByText("Saldo disponível: 10 PCT")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Quantidade"), {
      target: { value: "2" },
    });
    fireEvent.change(within(dialog).getByLabelText("Motivo da solicitação"), {
      target: { value: "Evento municipal" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Enviar solicitação" }));

    await waitFor(() => {
      expect(requestPayload).toMatchObject({
        items: [{ productId: product.id, quantity: 2, unitId: product.unit.id }],
        productId: product.id,
        quantity: 2,
        reason: "Evento municipal",
        warehouseId: centralWarehouse.id,
      });
    });
  });
});
