import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Invoice } from "@/lib/types";
import { InvoiceMovementsDialog, InvoicesPage } from "./invoices-page";

const invoice: Invoice = {
  cnpj: "12.345.678/0001-90",
  companyName: "Papelaria Municipal",
  id: "invoice-paper",
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
      type: "TRANSFERENCIA_ENTRADA",
      warehouse: {
        id: "health",
        name: "Almoxarifado da Saude",
      },
      warehouseId: "health",
    },
  ],
  number: "NF-101",
};

describe("InvoiceMovementsDialog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the stock movements linked to an invoice", () => {
    render(<InvoiceMovementsDialog invoice={invoice} />);

    fireEvent.click(screen.getByLabelText("Consultar movimentacoes da nota NF-101"));

    expect(screen.getByText("Movimentacoes da nota NF-101")).toBeInTheDocument();
    expect(screen.getByText("Papel A4")).toBeInTheDocument();
    expect(screen.getByText("Almoxarifado da Saude")).toBeInTheDocument();
    expect(screen.getByText("3 PCT")).toBeInTheDocument();
  });

  it("filters the list by invoiceId from the query string", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            invoice,
            {
              ...invoice,
              id: "invoice-other",
              number: "NF-202",
            },
          ]),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        ),
      ),
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
  });
});
