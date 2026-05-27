import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Invoice } from "@/lib/types";
import { InvoiceMovementsDialog, InvoicesPage } from "./invoices-page";

const invoice: Invoice = {
  cnpj: "12.345.678/0001-90",
  companyAddress: "Rua Central, 100, Centro",
  companyCity: "Curitiba",
  companyName: "Papelaria Municipal",
  companyPhone: "4133334444",
  companyState: "PR",
  companyTradeName: "Papelaria Centro",
  companyZipCode: "80000000",
  id: "invoice-paper",
  invoiceKey: "41260512345678000190550010000001011000001010",
  issueDate: "2026-05-21T12:00:00.000Z",
  movements: [
    {
      id: "movement-paper",
      movementDate: "2026-05-22T12:00:00.000Z",
      product: {
        code: "0000001",
        id: "paper",
        name: "Papel A4",
        unit: {
          abbreviation: "PCT",
          id: "pack",
          name: "Pacote",
        },
      },
      productId: "paper",
      quantity: 3,
      responsibleUser: {
        email: "admin@prefeitura.local",
        id: "admin",
        name: "Administrador",
        role: "ADMIN",
      },
      type: "TRANSFERENCIA_ENTRADA",
      unitPrice: 40,
      warehouse: {
        id: "health",
        name: "Almoxarifado da Saude",
      },
      warehouseId: "health",
    },
  ],
  number: "NF-101",
  series: "1",
  stateRegistration: "1234567890",
  totalValue: 120.5,
};

describe("InvoiceMovementsDialog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the stock movements linked to an invoice", () => {
    render(<InvoiceMovementsDialog invoice={invoice} />);

    fireEvent.click(screen.getByLabelText("Consultar movimentações da nota NF-101"));

    expect(screen.getByText("Movimentações da nota NF-101")).toBeInTheDocument();
    expect(screen.getByText("Papel A4")).toBeInTheDocument();
    expect(screen.getByText("Almoxarifado da Saude")).toBeInTheDocument();
    expect(screen.getByText("3 PCT")).toBeInTheDocument();
    expect(screen.getByText("Papelaria Centro")).toBeInTheDocument();
    expect(screen.getByText("Rua Central, 100, Centro")).toBeInTheDocument();
    expect(screen.getByText("R$ 120,50")).toBeInTheDocument();
    expect(screen.getByText("Administrador")).toBeInTheDocument();
  });

  it("filters the list by invoiceId from the query string", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        const payloadByPath: Record<string, unknown> = {
          "/invoices": [
            invoice,
            {
              ...invoice,
              id: "invoice-other",
              number: "NF-202",
            },
          ],
          "/product-categories": [{ id: "office", name: "Expediente" }],
          "/warehouses": [
            {
              active: true,
              category: { id: "general", name: "Geral" },
              categoryId: "general",
              createdAt: "2026-05-22T12:00:00.000Z",
              id: "central",
              isGeneral: true,
              name: "Almoxarifado Central",
              stocks: [],
              summary: {
                lastMovementAt: null,
                lowStockItems: 0,
                outOfStockItems: 0,
                stockedProducts: 0,
              },
              updatedAt: "2026-05-22T12:00:00.000Z",
            },
          ],
        };

        return new Response(JSON.stringify(payloadByPath[url.pathname] ?? []), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }),
    );

    render(
      <MemoryRouter initialEntries={["/invoices?invoiceId=invoice-paper"]}>
        <InvoicesPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("NF-101")).toBeInTheDocument();
    });

    expect(screen.queryByText("NF-202")).not.toBeInTheDocument();
    expect(screen.getByText("Valor da nota")).toBeInTheDocument();
    expect(screen.getByText("R$ 120,50")).toBeInTheDocument();
  });

  it("shows an XML summary and sends product mappings before importing", async () => {
    let importPayload: unknown;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const method = init?.method ?? "GET";

        if (method === "POST" && url.pathname === "/invoices/import-xml/preview") {
          return new Response(
            JSON.stringify({
              invoice: {
                cnpj: "12345678000190",
                companyAddress: "Rua Central, 100, Centro",
                companyCity: "Curitiba",
                companyName: "Fornecedor Municipal LTDA",
                companyPhone: "4133334444",
                companyState: "PR",
                companyTradeName: "Fornecedor Municipal",
                invoiceKey: "41260512345678000190550010000001231000001234",
                issueDate: "2026-05-22T12:30:00.000Z",
                number: "123",
                series: "1",
                stateRegistration: "1234567890",
                totalValue: 91,
              },
              items: [
                {
                  code: "PAP-EXT",
                  index: 0,
                  name: "Papel A4 do XML",
                  quantity: 2,
                  suggestedProduct: null,
                  totalValue: 51,
                  unit: "PCT",
                  unitPrice: 25.5,
                },
              ],
            }),
            {
              headers: { "Content-Type": "application/json" },
              status: 200,
            },
          );
        }

        if (method === "POST" && url.pathname === "/invoices/import-xml") {
          importPayload = JSON.parse(String(init?.body));

          return new Response(JSON.stringify({ invoice }), {
            headers: { "Content-Type": "application/json" },
            status: 201,
          });
        }

        const payloadByPath: Record<string, unknown> = {
          "/invoices": [],
          "/product-categories": [{ id: "office", name: "Expediente" }],
          "/products": [
            {
              active: true,
              category: { id: "office", name: "Expediente" },
              categoryId: "office",
              code: "0000002",
              id: "paper",
              name: "Papel A4 catálogo",
              unit: { abbreviation: "PCT", id: "pack", name: "Pacote" },
              unitId: "pack",
            },
          ],
          "/warehouses": [
            {
              active: true,
              category: { id: "general", name: "Geral" },
              categoryId: "general",
              createdAt: "2026-05-22T12:00:00.000Z",
              id: "central",
              isGeneral: true,
              name: "Almoxarifado Central",
              stocks: [],
              summary: {
                lastMovementAt: null,
                lowStockItems: 0,
                outOfStockItems: 0,
                stockedProducts: 0,
              },
              updatedAt: "2026-05-22T12:00:00.000Z",
            },
          ],
        };

        return new Response(JSON.stringify(payloadByPath[url.pathname] ?? []), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }),
    );

    render(
      <MemoryRouter>
        <InvoicesPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Importar XML" }));

    const file = new File(["<xml />"], "nota.xml", { type: "text/xml" });
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve("<xml />"),
    });

    fireEvent.change(screen.getByLabelText("XML da nota"), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByText("Fornecedor Municipal LTDA")).toBeInTheDocument();
    });

    expect(screen.getByText("Papel A4 do XML")).toBeInTheDocument();
    expect(screen.getByText("R$ 91,00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Produto do item 1" }));
    fireEvent.click(screen.getByText("0000002 - Papel A4 catálogo"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar importação" }));

    await waitFor(() => {
      expect(importPayload).toMatchObject({
        categoryId: "office",
        productMappings: [{ itemIndex: 0, productId: "paper" }],
        warehouseId: "central",
        xml: "<xml />",
      });
    });
  });
});
