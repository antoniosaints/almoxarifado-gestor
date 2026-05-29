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

  it("opens the office letter for non-general entry requests", async () => {
    const createObjectUrl = vi.fn(() => "blob:office-pdf");
    const revokeObjectUrl = vi.fn();
    const click = vi.fn();
    const appendChild = vi.spyOn(document.body, "appendChild");
    const createElement = vi.spyOn(document, "createElement");
    const OriginalURL = URL;

    vi.stubGlobal("URL", Object.assign(OriginalURL, {
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl,
    }));
    createElement.mockImplementation((tagName: string) => {
      const element = document.createElementNS("http://www.w3.org/1999/xhtml", tagName);

      if (tagName.toLowerCase() === "a") {
        Object.defineProperty(element, "click", { value: click });
      }

      return element as HTMLElement;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));

        if (url.pathname === "/entry-requests/entry-request/office-letter/pdf") {
          return new Response(new Blob(["pdf"], { type: "application/pdf" }), {
            headers: { "Content-Type": "application/pdf" },
            status: 200,
          });
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

    fireEvent.click(within(dialog).getByRole("button", { name: "Exportar PDF" }));

    await waitFor(() => {
      expect(createObjectUrl).toHaveBeenCalled();
      expect(click).toHaveBeenCalled();
    });
    expect(appendChild).toHaveBeenCalled();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:office-pdf");
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
});
