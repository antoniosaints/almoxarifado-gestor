import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "@/lib/session";
import { OfficeLetterPrintPage } from "./office-letter-print-page";

function renderPrintPage() {
  return render(
    <MemoryRouter initialEntries={["/requests/entry-request/office-letter/print"]}>
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
          <Route
            element={<OfficeLetterPrintPage />}
            path="/requests/:requestId/office-letter/print"
          />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  );
}

describe("OfficeLetterPrintPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads and prints the frontend-rendered office letter", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

      expect(url.pathname).toBe("/entry-requests/entry-request/office-letter");

      return new Response(
        JSON.stringify({
          contentHtml: "<p>Conteudo do oficio</p>",
          documentHtml:
            '<article data-office-letter-document="true"><h1>Oficio 001/2026</h1><p>Papel A4 - 4 PCT.</p></article>',
          header: {
            logoUrl: null,
            subtitle: "Almoxarifado da Saude",
            title: "Saude",
          },
          items: [{ productName: "Papel A4", quantity: 4, unit: "PCT" }],
          number: 1,
          numberFormatted: "001/2026",
          request: {
            id: "entry-request",
            status: "PENDING",
            warehouseId: "health",
          },
          subject: "Solicitacao de material/equipamento",
          year: 2026,
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    renderPrintPage();

    expect(await screen.findByText("Oficio 001/2026")).toBeInTheDocument();
    expect(screen.getByText("Papel A4 - 4 PCT.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Imprimir / Salvar PDF" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Imprimir / Salvar PDF" }));

    await waitFor(() => {
      expect(print).toHaveBeenCalledTimes(1);
    });
  });
});
