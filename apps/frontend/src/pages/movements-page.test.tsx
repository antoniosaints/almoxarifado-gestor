import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Movement } from "@/lib/types";
import { MovementsTable } from "./movements-page";

const movement: Movement = {
  id: "general-entry",
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
  quantity: 8,
  responsibleUser: {
    email: "admin@prefeitura.local",
    id: "admin",
    name: "Administrador",
    role: "ADMIN",
  },
  type: "ENTRADA",
  unitPrice: "14.75",
  warehouse: {
    id: "central",
    name: "Almoxarifado Central",
  },
  warehouseId: "central",
};

describe("MovementsTable", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows unit and total values for priced entries", () => {
    render(<MovementsTable movements={[movement]} />);

    expect(screen.getByText(/R\$\s*14,75/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*118,00/)).toBeInTheDocument();
  });

  it("calls the delete handler from the action button", () => {
    const onDeleteMovement = vi.fn();

    render(
      <MovementsTable
        movements={[movement]}
        onDeleteMovement={onDeleteMovement}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /excluir movimentação de papel a4/i }),
    );

    expect(onDeleteMovement).toHaveBeenCalledWith(movement);
  });

  it("opens a movement audit modal and exports its PDF", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(new Blob(["pdf"], { type: "application/pdf" }), {
        status: 200,
      });
    });
    const appendChild = vi.spyOn(document.body, "appendChild");
    const clickAnchor = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const createObjectUrl = vi.fn(() => "blob:movement-pdf");
    const revokeObjectUrl = vi.fn();

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", {
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl,
    });

    render(<MovementsTable movements={[movement]} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /visualizar movimenta.+o de papel a4/i,
      }),
    );

    const dialog = screen.getByRole("dialog", { name: "Auditoria da movimentacao" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Administrador")).toBeInTheDocument();
    expect(within(dialog).getByText("Almoxarifado Central")).toBeInTheDocument();
    expect(within(dialog).getByText(/R\$\s*118,00/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Exportar PDF" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://127.0.0.1:3333/reports/movements/general-entry",
        expect.any(Object),
      );
    });
    expect(appendChild).toHaveBeenCalled();
    expect(clickAnchor).toHaveBeenCalled();
    expect(createObjectUrl).toHaveBeenCalled();
  });
});
