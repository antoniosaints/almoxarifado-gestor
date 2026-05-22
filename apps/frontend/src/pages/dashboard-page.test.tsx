import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { Warehouse } from "@/lib/types";
import { DashboardContent } from "./dashboard-page";

const centralWarehouse: Warehouse = {
  active: true,
  category: {
    id: "general",
    name: "Geral",
  },
  categoryId: "general",
  createdAt: "2026-05-22T12:00:00.000Z",
  id: "central",
  isGeneral: true,
  name: "Almoxarifado Central",
  stocks: [],
  summary: {
    lastMovementAt: "2026-05-22T12:00:00.000Z",
    lowStockItems: 1,
    outOfStockItems: 0,
    stockedProducts: 4,
  },
  updatedAt: "2026-05-22T12:00:00.000Z",
};

const healthWarehouse: Warehouse = {
  ...centralWarehouse,
  category: {
    id: "health",
    name: "Saude",
  },
  categoryId: "health",
  id: "health",
  isGeneral: false,
  name: "Almoxarifado da Saude",
};

describe("DashboardContent", () => {
  it("shows the general warehouse before smaller warehouse cards", () => {
    render(
      <MemoryRouter>
        <DashboardContent warehouses={[healthWarehouse, centralWarehouse]} />
      </MemoryRouter>,
    );

    const cards = screen.getAllByRole("article");
    expect(cards[0]).toHaveTextContent("Almoxarifado Central");
    expect(cards[0]).toHaveTextContent("Geral");
  });
});
