import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Product, Stock } from "@/lib/types";
import { ProductStocksDialog } from "./products-page";

const product: Product = {
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
};

const stock: Stock = {
  currentQuantity: 12,
  id: "central-paper",
  minimumQuantity: 4,
  product,
  productId: product.id,
  totalValue: 279.96,
  unitPriceAverage: 23.33,
  warehouse: {
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
      lastMovementAt: null,
      lowStockItems: 0,
      outOfStockItems: 0,
      stockedProducts: 1,
    },
    updatedAt: "2026-05-22T12:00:00.000Z",
  },
  warehouseId: "central",
};

describe("ProductStocksDialog", () => {
  it("shows warehouse stocks for the selected product", () => {
    render(<ProductStocksDialog product={product} stocks={[stock]} />);

    fireEvent.click(screen.getByLabelText("Consultar estoques de Papel A4"));

    expect(screen.getByText("Estoques de Papel A4")).toBeInTheDocument();
    expect(screen.getByText("Almoxarifado Central")).toBeInTheDocument();
    expect(screen.getByText("12 PCT")).toBeInTheDocument();
  });
});
