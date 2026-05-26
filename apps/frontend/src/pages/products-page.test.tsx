import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Product, Stock } from "@/lib/types";
import { ProductStocksDialog, readCsvFile } from "./products-page";

const product: Product = {
  active: true,
  category: {
    id: "office",
    name: "Expediente",
  },
  categoryId: "office",
  code: "0000001",
  id: "paper",
  minimumQuantity: 0,
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

describe("readCsvFile", () => {
  it("decodes Windows-1252 CSV files with accented names", async () => {
    const bytes = Uint8Array.from([
      ...Array.from("id;nome;unidade;minimo;categoria\n;A").map((char) =>
        char.charCodeAt(0),
      ),
      0xe7,
      0xfa,
      ...Array.from("car;UN;1;Patrim").map((char) => char.charCodeAt(0)),
      0xf4,
      ...Array.from("nio").map((char) => char.charCodeAt(0)),
    ]);
    const file = new File([bytes], "produtos.csv", { type: "text/csv" });

    await expect(readCsvFile(file)).resolves.toContain("Açúcar");
    await expect(readCsvFile(file)).resolves.toContain("Patrimônio");
  });
});
