export type WarehouseCategory = {
  color?: string | null;
  description?: string | null;
  icon?: string | null;
  id: string;
  name: string;
};

export type ProductCategory = {
  description?: string | null;
  id: string;
  name: string;
};

export type UnitOfMeasure = {
  abbreviation: string;
  id: string;
  name: string;
};

export type Product = {
  active: boolean;
  category: ProductCategory;
  categoryId: string;
  code: string;
  description?: string | null;
  id: string;
  name: string;
  unit: UnitOfMeasure;
  unitId: string;
};

export type Stock = {
  currentQuantity: number;
  id: string;
  lastMovementAt?: string | null;
  minimumQuantity: number;
  product: Product;
  productId: string;
  totalValue: number | string;
  unitPriceAverage: number | string;
  warehouse?: Warehouse;
  warehouseId: string;
};

export type WarehouseSummary = {
  lastMovementAt: string | null;
  lowStockItems: number;
  outOfStockItems: number;
  stockedProducts: number;
};

export type Warehouse = {
  active: boolean;
  category: WarehouseCategory;
  categoryId: string;
  createdAt: string;
  description?: string | null;
  id: string;
  isGeneral: boolean;
  movements?: Movement[];
  name: string;
  stocks: Stock[];
  summary: WarehouseSummary;
  updatedAt: string;
};

export type MovementType =
  | "ENTRADA"
  | "SAIDA"
  | "TRANSFERENCIA_SAIDA"
  | "TRANSFERENCIA_ENTRADA";

export type UserRole = "ADMIN" | "OPERATOR";

export type User = {
  email: string;
  id: string;
  name: string;
  role: UserRole;
};

export type Session = {
  token: string;
  user: User;
};

export type SystemSettings = {
  id: string;
  loginBackgroundUrl?: string | null;
  loginImageUrl?: string | null;
  loginSubtitle: string;
  loginTitle: string;
  logoUrl?: string | null;
  primaryColor: string;
  reportFooterText: string;
  reportLogoUrl?: string | null;
  reportPrimaryColor: string;
  reportTitle: string;
  systemName: string;
};

export type Invoice = {
  cnpj: string;
  companyAddress?: string | null;
  companyCity?: string | null;
  companyName: string;
  companyPhone?: string | null;
  companyState?: string | null;
  companyTradeName?: string | null;
  companyZipCode?: string | null;
  id: string;
  invoiceKey?: string | null;
  issueDate: string;
  municipalRegistration?: string | null;
  movements?: Movement[];
  number: string;
  observation?: string | null;
  series?: string | null;
  stateRegistration?: string | null;
  totalValue?: number | string;
};

export type UserWarehouseAssignment = {
  id: string;
  warehouse: Pick<Warehouse, "category" | "id" | "name">;
  warehouseId: string;
};

export type ManagedUser = User & {
  active: boolean;
  isDefaultAdmin: boolean;
  warehouseAssignments: UserWarehouseAssignment[];
};

export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type TransferRequestStatus =
  | "PENDING_RECEIPT"
  | "RECEIVED"
  | "CANCELLED";

export type EntryRequest = {
  createdAt: string;
  id: string;
  movementDate: string;
  observation?: string | null;
  product: Pick<Product, "code" | "id" | "name" | "unit">;
  quantity: number;
  requestedBy: Pick<User, "email" | "id" | "name">;
  reviewedAt?: string | null;
  reviewedBy?: Pick<User, "email" | "id" | "name"> | null;
  status: RequestStatus;
  warehouse: Pick<Warehouse, "category" | "id" | "name">;
};

export type TransferRequest = {
  createdAt: string;
  createdBy: Pick<User, "email" | "id" | "name">;
  destinationWarehouse: Pick<Warehouse, "category" | "id" | "name">;
  id: string;
  movementDate: string;
  observation?: string | null;
  product: Pick<Product, "code" | "id" | "name" | "unit">;
  quantity: number;
  receivedAt?: string | null;
  receivedBy?: Pick<User, "email" | "id" | "name"> | null;
  sourceWarehouse: Pick<Warehouse, "category" | "id" | "name">;
  status: TransferRequestStatus;
};

export type Movement = {
  destinationNote?: string | null;
  destinationWarehouse?: Pick<Warehouse, "id" | "name"> | null;
  id: string;
  invoice?: Invoice | null;
  invoiceId?: string | null;
  movementDate: string;
  observation?: string | null;
  product: Pick<Product, "code" | "id" | "name" | "unit">;
  productId: string;
  quantity: number;
  responsibleUser?: User;
  sourceWarehouse?: Pick<Warehouse, "id" | "name"> | null;
  type: MovementType;
  unitPrice?: number | string | null;
  warehouse: Pick<Warehouse, "id" | "name">;
  warehouseId: string;
};

export type InsightsSummary = {
  activeProducts: number;
  activeWarehouses: number;
  invoices: number;
  lowStockItems: number;
  monthlyEntries: number;
  monthlyMovements: number;
  monthlyOutputs: number;
  monthlyTransfers: number;
  monthlyValue: number;
  outOfStockItems: number;
  pendingRequests: number;
  products: number;
  stockItems: number;
  stockQuantity: number;
  warehouses: number;
};

export type WarehouseRiskInsight = {
  category: string;
  lowStockItems: number;
  name: string;
  outOfStockItems: number;
  totalItems: number;
  warehouseId: string;
};

export type TopProductInsight = {
  code: string;
  name: string;
  product: Product;
  productId: string;
  quantityMoved: number;
  stocks: Stock[];
  unit: string;
};

export type RecentInvoiceInsight = Invoice & {
  movementCount: number;
};

export type AlertStockInsight = Stock & {
  state: "LOW" | "ZERO";
};

export type Insights = {
  alertStocks: AlertStockInsight[];
  recentInvoices: RecentInvoiceInsight[];
  topProducts: TopProductInsight[];
  totals: InsightsSummary;
  warehouseRisk: WarehouseRiskInsight[];
};
