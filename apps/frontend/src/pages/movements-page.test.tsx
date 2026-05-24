import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
  type: "ENTRADA",
  unitPrice: "14.75",
  warehouse: {
    id: "central",
    name: "Almoxarifado Central",
  },
  warehouseId: "central",
};

describe("MovementsTable", () => {
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
      screen.getByRole("button", { name: /excluir movimentacao de papel a4/i }),
    );

    expect(onDeleteMovement).toHaveBeenCalledWith(movement);
  });
});
