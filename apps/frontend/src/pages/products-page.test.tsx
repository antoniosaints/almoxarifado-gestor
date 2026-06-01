import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Product, Stock } from "@/lib/types";
import {
  ProductConversionsDialog,
  ProductStocksDialog,
  readCsvFile,
} from "./products-page";

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

const boxUnit = {
  abbreviation: "CX",
  id: "box",
  name: "Caixa",
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

describe("ProductConversionsDialog", () => {
  it("creates product unit conversions from the product page", async () => {
    const onChanged = vi.fn();
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          active: true,
          factorToBase: 10,
          fromUnit: boxUnit,
          fromUnitId: boxUnit.id,
          id: "paper-box",
          productId: product.id,
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 201,
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ProductConversionsDialog
        onChanged={onChanged}
        product={{
          ...product,
          unit: {
            abbreviation: "RSM",
            id: "ream",
            name: "Resma",
          },
          unitConversions: [],
          unitId: "ream",
        }}
        units={[product.unit, boxUnit]}
      />,
    );

    fireEvent.click(screen.getByLabelText("Configurar conversões de Papel A4"));
    fireEvent.click(screen.getByRole("button", { name: "Nova conversão" }));

    expect(screen.getByRole("dialog", { name: "Nova conversão" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Unidade de entrada ou saída" }));
    fireEvent.click(screen.getByText("Caixa / CX"));
    fireEvent.change(screen.getByLabelText("Equivale a"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar conversão" }));

    await screen.findByText("1 CX = 10 RSM");

    expect(screen.getByText("Conversões de Papel A4")).toBeInTheDocument();
    await waitFor(() => {
      expect(onChanged).toHaveBeenCalledWith([
        expect.objectContaining({
          factorToBase: 10,
          fromUnitId: "box",
          id: "paper-box",
        }),
      ]);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/products/paper/unit-conversions"),
      expect.objectContaining({
        body: JSON.stringify({
          active: true,
          factorToBase: "10",
          fromUnitId: "box",
        }),
        method: "POST",
      }),
    );
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
