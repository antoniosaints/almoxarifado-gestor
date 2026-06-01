import { RequestStatus, TransferRequestStatus } from "@prisma/client";
import { Router } from "express";
import { asyncHandler, requirePermission } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

export const insightRoutes = Router();

insightRoutes.use(requirePermission("VIEW_INSIGHTS"));

insightRoutes.get(
  "/",
  asyncHandler(async (_request, response) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [warehouses, products, stocks, monthlyMovements, invoices, pendingEntryRequests, pendingReceipts] =
      await Promise.all([
        prisma.warehouse.findMany({
          include: {
            category: true,
            stocks: true,
          },
          orderBy: { name: "asc" },
        }),
        prisma.product.findMany({
          select: {
            active: true,
            id: true,
          },
        }),
        prisma.stock.findMany({
          include: {
            product: {
              include: {
                category: true,
                unit: true,
              },
            },
            warehouse: {
              include: {
                category: true,
              },
            },
          },
        }),
        prisma.stockMovement.findMany({
          where: {
            movementDate: {
              gte: monthStart,
            },
          },
          include: {
            product: {
              include: {
                category: true,
                unit: true,
              },
            },
            warehouse: true,
          },
          orderBy: { movementDate: "desc" },
        }),
        prisma.invoice.findMany({
          include: {
            movements: {
              include: {
                destinationWarehouse: true,
                product: {
                  include: {
                    unit: true,
                  },
                },
                responsibleUser: true,
                sourceWarehouse: true,
                warehouse: true,
              },
              orderBy: { movementDate: "desc" },
            },
          },
          orderBy: [{ issueDate: "desc" }, { number: "asc" }],
          take: 5,
        }),
        prisma.entryRequest.count({
          where: { status: RequestStatus.PENDING },
        }),
        prisma.transferRequest.count({
          where: { status: TransferRequestStatus.PENDING_RECEIPT },
        }),
      ]);

    const lowStockItems = stocks.filter(
      (stock) =>
        stock.currentQuantity > 0 && stock.currentQuantity <= stock.minimumQuantity,
    );
    const outOfStockItems = stocks.filter((stock) => stock.currentQuantity === 0);
    const riskByWarehouse = new Map<
      string,
      {
        category: string;
        lowStockItems: number;
        name: string;
        outOfStockItems: number;
        totalItems: number;
        warehouseId: string;
      }
    >();

    for (const stock of stocks) {
      const atRisk =
        stock.currentQuantity === 0 ||
        (stock.currentQuantity > 0 && stock.currentQuantity <= stock.minimumQuantity);

      if (!atRisk) {
        continue;
      }

      const current = riskByWarehouse.get(stock.warehouseId) ?? {
        category: stock.warehouse.category.name,
        lowStockItems: 0,
        name: stock.warehouse.name,
        outOfStockItems: 0,
        totalItems: 0,
        warehouseId: stock.warehouseId,
      };

      current.totalItems += 1;

      if (stock.currentQuantity === 0) {
        current.outOfStockItems += 1;
      } else {
        current.lowStockItems += 1;
      }

      riskByWarehouse.set(stock.warehouseId, current);
    }

    const productMovement = new Map<
      string,
      {
        code: string;
        name: string;
        product: (typeof monthlyMovements)[number]["product"];
        productId: string;
        quantityMoved: number;
        unit: string;
      }
    >();

    for (const movement of monthlyMovements) {
      const current = productMovement.get(movement.productId) ?? {
        code: movement.product.code,
        name: movement.product.name,
        product: movement.product,
        productId: movement.productId,
        quantityMoved: 0,
        unit: movement.product.unit.abbreviation,
      };

      current.quantityMoved += movement.quantity;
      productMovement.set(movement.productId, current);
    }

    const monthlyValue = monthlyMovements.reduce((total, movement) => {
      const unitPrice =
        movement.unitPrice === null || movement.unitPrice === undefined
          ? 0
          : Number(movement.unitPrice);

      return total + unitPrice * movement.quantity;
    }, 0);

    response.json({
      recentInvoices: invoices.map((invoice) => ({
        ...invoice,
        companyName: invoice.companyName,
        id: invoice.id,
        issueDate: invoice.issueDate,
        movementCount: invoice.movements.length,
        number: invoice.number,
      })),
      topProducts: [...productMovement.values()]
        .sort((left, right) => right.quantityMoved - left.quantityMoved)
        .map((product) => ({
          ...product,
          stocks: stocks.filter((stock) => stock.productId === product.productId),
        }))
        .slice(0, 5),
      alertStocks: [...lowStockItems, ...outOfStockItems]
        .sort((left, right) => {
          const leftSeverity = left.currentQuantity === 0 ? 1 : 0;
          const rightSeverity = right.currentQuantity === 0 ? 1 : 0;

          return (
            rightSeverity - leftSeverity ||
            left.currentQuantity - right.currentQuantity ||
            left.product.name.localeCompare(right.product.name)
          );
        })
        .map((stock) => ({
          ...stock,
          state: stock.currentQuantity === 0 ? "ZERO" : "LOW",
        })),
      totals: {
        activeProducts: products.filter((product) => product.active).length,
        activeWarehouses: warehouses.filter((warehouse) => warehouse.active).length,
        invoices: await prisma.invoice.count(),
        lowStockItems: lowStockItems.length,
        monthlyEntries: monthlyMovements.filter((movement) =>
          movement.type.includes("ENTRADA"),
        ).length,
        monthlyMovements: monthlyMovements.length,
        monthlyOutputs: monthlyMovements.filter((movement) =>
          movement.type.includes("SAIDA"),
        ).length,
        monthlyTransfers: monthlyMovements.filter((movement) =>
          movement.type.includes("TRANSFERENCIA"),
        ).length,
        monthlyValue,
        outOfStockItems: outOfStockItems.length,
        pendingRequests: pendingEntryRequests + pendingReceipts,
        products: products.length,
        stockItems: stocks.length,
        stockQuantity: stocks.reduce(
          (total, stock) => total + stock.currentQuantity,
          0,
        ),
        warehouses: warehouses.length,
      },
      warehouseRisk: [...riskByWarehouse.values()]
        .sort((left, right) => right.totalItems - left.totalItems)
        .slice(0, 8),
    });
  }),
);
