import cors from "cors";
import express from "express";
import { authenticate, errorHandler } from "./lib/http.js";
import { authRoutes } from "./routes/auth-routes.js";
import { entryRequestRoutes } from "./routes/entry-request-routes.js";
import { insightRoutes } from "./routes/insight-routes.js";
import { invoiceRoutes } from "./routes/invoice-routes.js";
import { movementRoutes } from "./routes/movement-routes.js";
import { productCategoryRoutes } from "./routes/product-category-routes.js";
import { productRoutes } from "./routes/product-routes.js";
import { reportRoutes } from "./routes/report-routes.js";
import { requestSummaryRoutes } from "./routes/request-summary-routes.js";
import {
  publicSettingsRoutes,
  settingsRoutes,
} from "./routes/settings-routes.js";
import { stockRoutes } from "./routes/stock-routes.js";
import { transferRequestRoutes } from "./routes/transfer-request-routes.js";
import { uploadRoutes } from "./routes/upload-routes.js";
import { unitRoutes } from "./routes/unit-routes.js";
import { userRoutes } from "./routes/user-routes.js";
import { warehouseCategoryRoutes } from "./routes/warehouse-category-routes.js";
import { warehouseRoutes } from "./routes/warehouse-routes.js";
import { getLocalUploadRoot } from "./services/upload-service.js";

export const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://127.0.0.1:5173",
  }),
);
app.use("/uploads", express.static(getLocalUploadRoot()));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT ?? "1mb" }));

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.use("/auth", authRoutes);
app.use("/settings", publicSettingsRoutes);
app.use(authenticate);
app.use("/uploads", uploadRoutes);
app.use("/entry-requests", entryRequestRoutes);
app.use("/insights", insightRoutes);
app.use("/invoices", invoiceRoutes);
app.use("/requests", requestSummaryRoutes);
app.use("/transfer-requests", transferRequestRoutes);
app.use("/users", userRoutes);
app.use("/warehouses", warehouseRoutes);
app.use("/warehouse-categories", warehouseCategoryRoutes);
app.use("/products", productRoutes);
app.use("/product-categories", productCategoryRoutes);
app.use("/units", unitRoutes);
app.use("/stocks", stockRoutes);
app.use("/movements", movementRoutes);
app.use("/reports", reportRoutes);
app.use("/settings", settingsRoutes);
app.use(errorHandler);
