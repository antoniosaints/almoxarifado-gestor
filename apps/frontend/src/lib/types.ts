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

export type UnitConversion = {
  active: boolean;
  factorToBase: number | string;
  fromUnit: UnitOfMeasure;
  fromUnitId: string;
  id: string;
  productId: string;
};

export type Product = {
  active: boolean;
  category: ProductCategory;
  categoryId: string;
  code: string;
  description?: string | null;
  id: string;
  minimumQuantity: number;
  name: string;
  unit: UnitOfMeasure;
  unitConversions?: UnitConversion[];
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

export type AppPermission =
  | "MANAGE_WAREHOUSES"
  | "MANAGE_UNITS"
  | "MANAGE_CATEGORIES"
  | "APPROVE_REQUESTS"
  | "APPROVE_TRANSFERS"
  | "MANAGE_SETTINGS"
  | "VIEW_INSIGHTS"
  | "MANAGE_USERS"
  | "ACCESS_PRODUCTS"
  | "MANAGE_UNIT_CONVERSIONS"
  | "CREATE_PRODUCTS"
  | "IMPORT_PRODUCTS_CSV"
  | "ZERO_STOCKS"
  | "DELETE_STOCKS";

export type PermissionProfilePermission = {
  key: AppPermission;
};

export type PermissionProfile = {
  active: boolean;
  description?: string | null;
  id: string;
  name: string;
  permissions: PermissionProfilePermission[];
  userCount?: number;
};

export type PermissionDefinition = {
  description: string;
  group: string;
  key: AppPermission;
  label: string;
};

export type User = {
  email: string;
  id: string;
  name: string;
  permissionProfile?: Pick<PermissionProfile, "id" | "name"> | null;
  permissionProfileId?: string | null;
  permissions?: AppPermission[];
  role: UserRole;
};

export type Session = {
  token: string;
  user: User;
};

export type SystemSettings = {
  faviconUrl?: string | null;
  id: string;
  loginBackgroundUrl?: string | null;
  loginImageUrl?: string | null;
  loginSubtitle: string;
  loginTitle: string;
  logoUrl?: string | null;
  officeLogoUrl?: string | null;
  primaryColor: string;
  reportFooterText: string;
  reportLogoUrl?: string | null;
  reportPrimaryColor: string;
  reportTitle: string;
  systemName: string;
};

export type SiteSettings = {
  contactEmail?: string | null;
  eyebrow: string;
  faviconUrl?: string | null;
  footerText: string;
  headline: string;
  heroImageUrl?: string | null;
  id: string;
  logoUrl?: string | null;
  primaryColor: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  siteName: string;
  subheadline: string;
  whatsappMessage: string;
  whatsappNumber: string;
};

export type SiteBanner = {
  active: boolean;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
  id: string;
  imageUrl?: string | null;
  sortOrder: number;
  subtitle?: string | null;
  title: string;
};

export type SiteSystem = {
  active: boolean;
  description?: string | null;
  features: string[];
  id: string;
  imageUrl?: string | null;
  key: string;
  name: string;
  sortOrder: number;
  summary: string;
};

export type SiteFeature = {
  active: boolean;
  description: string;
  group: string;
  icon?: string | null;
  id: string;
  sortOrder: number;
  title: string;
};

export type SitePost = {
  content: string;
  coverImageUrl?: string | null;
  id: string;
  published: boolean;
  publishedAt?: string | null;
  slug: string;
  summary: string;
  title: string;
};

export type SitePlan = {
  active: boolean;
  badge?: string | null;
  ctaLabel: string;
  description: string;
  features: string[];
  highlighted: boolean;
  id: string;
  name: string;
  sortOrder: number;
};

export type SiteFaq = {
  active: boolean;
  answer: string;
  id: string;
  question: string;
  sortOrder: number;
};

export type SiteContent = {
  banners: SiteBanner[];
  faqs: SiteFaq[];
  features: SiteFeature[];
  plans: SitePlan[];
  posts: SitePost[];
  settings: SiteSettings;
  systems: SiteSystem[];
};

export type Supplier = {
  active: boolean;
  address?: string | null;
  city?: string | null;
  cnpj: string;
  email?: string | null;
  id: string;
  municipalRegistration?: string | null;
  name: string;
  notes?: string | null;
  phone?: string | null;
  state?: string | null;
  stateRegistration?: string | null;
  tradeName?: string | null;
  zipCode?: string | null;
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
  supplier?: Supplier | null;
  supplierId?: string | null;
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
export type EntryRequestType = "ENTRY" | "AD_HOC_OUTPUT";

export type TransferRequestStatus =
  | "PENDING_RECEIPT"
  | "RECEIVED"
  | "CANCELLED";

export type EntryRequest = {
  createdAt: string;
  id: string;
  items?: EntryRequestItem[];
  movementDate: string;
  observation?: string | null;
  reason?: string | null;
  product: Pick<Product, "code" | "id" | "name" | "unit">;
  quantity: number;
  conversionFactor?: number | string | null;
  requestedBy: Pick<User, "email" | "id" | "name">;
  reviewedAt?: string | null;
  reviewedBy?: Pick<User, "email" | "id" | "name"> | null;
  sourceQuantity?: number | string | null;
  sourceUnit?: UnitOfMeasure | null;
  sourceUnitId?: string | null;
  status: RequestStatus;
  type?: EntryRequestType;
  warehouse: Pick<Warehouse, "category" | "id" | "isGeneral" | "name">;
};

export type EntryRequestItem = {
  id: string;
  product: Pick<Product, "code" | "id" | "name" | "unit">;
  productId: string;
  quantity: number;
  conversionFactor?: number | string | null;
  sourceQuantity?: number | string | null;
  sourceUnit?: UnitOfMeasure | null;
  sourceUnitId?: string | null;
};

export type OfficeLetter = {
  contentHtml: string;
  documentHtml: string;
  header: {
    logoUrl?: string | null;
    subtitle: string;
    title: string;
  };
  items: Array<{
    productName: string;
    quantity: number;
    unit: string;
  }>;
  number: number;
  numberFormatted: string;
  request: {
    id: string;
    status: RequestStatus;
    warehouseId: string;
  };
  subject: string;
  year: number;
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
  conversionFactor?: number | string | null;
  receivedAt?: string | null;
  receivedBy?: Pick<User, "email" | "id" | "name"> | null;
  sourceQuantity?: number | string | null;
  sourceUnit?: UnitOfMeasure | null;
  sourceUnitId?: string | null;
  sourceWarehouse: Pick<Warehouse, "category" | "id" | "name">;
  status: TransferRequestStatus;
};

export type Movement = {
  createdAt?: string;
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
  conversionFactor?: number | string | null;
  sourceQuantity?: number | string | null;
  sourceUnit?: UnitOfMeasure | null;
  sourceUnitId?: string | null;
  sourceUnitPrice?: number | string | null;
  sourceWarehouse?: Pick<Warehouse, "id" | "name"> | null;
  type: MovementType;
  unitPrice?: number | string | null;
  updatedAt?: string;
  warehouse: Pick<Warehouse, "id" | "name">;
  warehouseId: string;
};

export type OfficeFontFamily =
  | "Arial"
  | "Times New Roman"
  | "Calibri"
  | "Georgia"
  | "Verdana"
  | "Courier New";

export type OfficeLetterTemplate = {
  active: boolean;
  contentHtml: string;
  description?: string | null;
  footerText?: string | null;
  fontFamily: OfficeFontFamily;
  fontSize: number;
  headerAlignment: "LEFT" | "CENTER" | "RIGHT";
  headerImageUrl?: string | null;
  headerText?: string | null;
  id: string;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  name: string;
  subject: string;
  variables: string[];
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

export type WarehouseCsvPreviewRow = {
  alreadyImported: boolean;
  canImport: boolean;
  cnpj: string;
  companyName: string;
  errors: string[];
  index: number;
  invoiceNumber: string;
  issueDate?: string | null;
  observation?: string | null;
  productName: string;
  quantity: number;
  rowNumber: number;
  suggestedProduct?: Pick<Product, "code" | "id" | "name" | "unit"> | null;
  suggestedUnit?: UnitOfMeasure | null;
  convertedQuantity?: number | null;
  convertedUnitPrice?: number | null;
  totalValue: number;
  unit: string;
  unitPrice: number;
  warnings: string[];
  willImport: boolean;
};

export type WarehouseCsvPreview = {
  rows: WarehouseCsvPreviewRow[];
};

export type ProductCsvPreviewRow = {
  canImport: boolean;
  categoryName: string;
  code: string | null;
  errors: string[];
  existingProduct?: Pick<Product, "code" | "id" | "name"> | null;
  index: number;
  minimumQuantity: number;
  productName: string;
  rowNumber: number;
  unit: string;
  warnings: string[];
  willImport: boolean;
};

export type ProductCsvPreview = {
  rows: ProductCsvPreviewRow[];
};

export type ManagerLicenseStatus =
  | "PENDING"
  | "ACTIVE"
  | "LINKED"
  | "CANCELLED"
  | "EXPIRED";

export type ManagerLicenseType = "MONTHLY" | "ANNUAL" | "LIFETIME" | "TRIAL";

export type ManagerBillingStatus = "OPEN" | "PAID" | "OVERDUE" | "CANCELLED";

export type ManagerGatewayProvider = "MERCADO_PAGO";

export type ManagerBillingPaymentMethod = "PIX" | "BOLETO";

export type ManagerBillingPaymentStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "REFUNDED"
  | "EXPIRED";

export type LicenseStatus = {
  blockWrites: boolean;
  checkedAt: string | null;
  daysUntilExpiration: number | null;
  expiresAt: string | null;
  lastError?: string | null;
  licenseKey: string | null;
  message: string;
  mode: "managed" | "unmanaged";
  offline: boolean;
  status: string;
  subscriberName?: string | null;
  systemKey?: string | null;
  valid: boolean;
  warningLevel: "none" | "warning" | "expires_today" | "blocked" | "unvalidated";
};

export type ManagerSubscriber = {
  active: boolean;
  billings?: ManagerBilling[];
  city?: string | null;
  createdAt: string;
  document?: string | null;
  email: string;
  id: string;
  licenses?: ManagerLicense[];
  name: string;
  notes?: string | null;
  phone?: string | null;
  state?: string | null;
  updatedAt: string;
};

export type ManagerLicense = {
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  expiresAt?: string | null;
  id: string;
  licenseKey: string;
  linkedAt?: string | null;
  linkedDomain?: string | null;
  linkedIp?: string | null;
  linkedUserAgent?: string | null;
  lastValidationAt?: string | null;
  lastValidationDomain?: string | null;
  lastValidationIp?: string | null;
  lastValidationUserAgent?: string | null;
  monthlyValue: number | string;
  seats: number;
  startsAt: string;
  status: ManagerLicenseStatus;
  subscriber?: ManagerSubscriber;
  subscriberId: string;
  systemKey: string;
  type: ManagerLicenseType;
  updatedAt: string;
  validatedAt?: string | null;
  validationBlockedAt?: string | null;
  validationBlockedReason?: string | null;
  validationCount?: number;
};

export type ManagerBilling = {
  amount: number | string;
  createdAt: string;
  description?: string | null;
  dueDate: string;
  id: string;
  license?: ManagerLicense | null;
  licenseId?: string | null;
  paidAt?: string | null;
  payments?: ManagerBillingPayment[];
  reference: string;
  status: ManagerBillingStatus;
  subscriber?: ManagerSubscriber;
  subscriberId: string;
  systemKey: string;
  updatedAt: string;
};

export type ManagerBillingPayment = {
  amount: number | string;
  barcode?: string | null;
  billingId: string;
  cancelledAt?: string | null;
  createdAt: string;
  expiresAt?: string | null;
  externalReference: string;
  gatewayConfigId?: string | null;
  id: string;
  method: ManagerBillingPaymentMethod;
  paidAt?: string | null;
  provider: ManagerGatewayProvider;
  providerPaymentId?: string | null;
  qrCode?: string | null;
  qrCodeBase64?: string | null;
  refundedAt?: string | null;
  status: ManagerBillingPaymentStatus;
  statusDetail?: string | null;
  ticketUrl?: string | null;
  updatedAt: string;
};

export type ManagerGatewayConfig = {
  accountId?: string | null;
  active: boolean;
  accessTokenPreview?: string | null;
  availableMethods: ManagerBillingPaymentMethod[];
  clientId?: string | null;
  clientSecretConfigured: boolean;
  configured: boolean;
  connectedAt?: string | null;
  id: string;
  label: string;
  liveMode: boolean;
  provider: ManagerGatewayProvider;
  publicKeyPreview?: string | null;
  redirectUri: string;
  webhookSecretConfigured: boolean;
  webhookUrl: string;
};

export type ManagerDashboard = {
  billingStatusBreakdown: Array<{ name: string; value: number }>;
  licenseStatusBreakdown: Array<{ name: string; value: number }>;
  monthlyRevenueTrend: Array<{ name: string; value: number }>;
  overdueBillings: ManagerBilling[];
  revenueByLicenseType: Array<{ name: string; value: number }>;
  revenueBySystem: Array<{ name: string; value: number }>;
  totals: {
    activeLicenses: number;
    activeSubscribers: number;
    averageTicket: number;
    cancelledLicenses: number;
    currentMonthRevenue: number;
    expiredLicenses: number;
    expiringLicenses: number;
    linkedLicenses: number;
    monthlyRecurring: number;
    openAmount: number;
    openBillings: number;
    overdueAmount: number;
    overdueBillings: number;
    pendingLicenses: number;
    totalLicenses: number;
    totalRevenue: number;
    totalSubscribers: number;
  };
  upcomingExpirations: ManagerLicense[];
};

export type FleetVehicleStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "MAINTENANCE"
  | "TRANSFERRED"
  | "DISPOSED";

export type FleetDriverStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export type FleetMaintenanceType =
  | "PREVENTIVE"
  | "CORRECTIVE"
  | "PREDICTIVE"
  | "EMERGENCY";

export type FleetMaintenanceStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_PART"
  | "COMPLETED"
  | "CANCELLED";

export type FleetHealthStatus = "OK" | "ATTENTION" | "OVERDUE";

export type FleetStructure = {
  active: boolean;
  id: string;
  name: string;
  notes?: string | null;
  type?: string | null;
};

export type FleetDriver = {
  cnhHealth?: "VALID" | "EXPIRING" | "EXPIRED" | "UNKNOWN";
  cpf?: string | null;
  currentVehicles?: FleetVehicle[];
  email?: string | null;
  id: string;
  licenseCategory?: string | null;
  licenseExpiresAt?: string | null;
  licenseIssuedAt?: string | null;
  licenseNumber?: string | null;
  licenseStatus?: string | null;
  name: string;
  notes?: string | null;
  phone?: string | null;
  status: FleetDriverStatus;
};

export type FleetVehicle = {
  acquisitionDate?: string | null;
  acquisitionValue: number | string;
  brand: string;
  chassis?: string | null;
  color?: string | null;
  currentDriver?: FleetDriver | null;
  currentDriverId?: string | null;
  currentHourmeter?: number | string | null;
  currentOdometer: number;
  currentStructure?: FleetStructure | null;
  currentStructureId?: string | null;
  fuelType: string;
  id: string;
  manufactureYear?: number | null;
  model: string;
  modelYear?: number | null;
  notes?: string | null;
  plate: string;
  renavam?: string | null;
  status: FleetVehicleStatus;
  tankCapacity: number | string;
  vehicleType: string;
};

export type FleetReading = {
  driver?: FleetDriver | null;
  driverId?: string | null;
  hourmeter?: number | string | null;
  id: string;
  notes?: string | null;
  odometer?: number | null;
  readingDate: string;
  structure?: FleetStructure | null;
  structureId?: string | null;
  vehicle: FleetVehicle;
  vehicleId: string;
};

export type FleetFueling = {
  driver?: FleetDriver | null;
  driverId?: string | null;
  fiscalDocument?: string | null;
  fuelType: string;
  fuelingDate: string;
  hourmeter?: number | string | null;
  id: string;
  notes?: string | null;
  odometer?: number | null;
  quantity: number | string;
  supplier?: string | null;
  totalPrice: number | string;
  unitPrice: number | string;
  vehicle: FleetVehicle;
  vehicleId: string;
};

export type FleetAllocation = {
  destinationStructure: FleetStructure;
  destinationStructureId: string;
  driverId?: string | null;
  endDate?: string | null;
  id: string;
  notes?: string | null;
  originStructure?: FleetStructure | null;
  originStructureId?: string | null;
  reason?: string | null;
  startDate: string;
  vehicle: FleetVehicle;
  vehicleId: string;
};

export type FleetTransfer = {
  destinationStructure: FleetStructure;
  destinationStructureId: string;
  driver?: FleetDriver | null;
  driverId?: string | null;
  hourmeter?: number | string | null;
  id: string;
  notes?: string | null;
  odometer?: number | null;
  originStructure?: FleetStructure | null;
  originStructureId?: string | null;
  transferDate: string;
  vehicle: FleetVehicle;
  vehicleCondition?: string | null;
  vehicleId: string;
};

export type FleetMaintenance = {
  completedAt?: string | null;
  hourmeter?: number | string | null;
  id: string;
  laborCost: number | string;
  notes?: string | null;
  odometer?: number | null;
  openedAt: string;
  partsCost: number | string;
  partsUsed?: string | null;
  performedServices?: string | null;
  problemDescription: string;
  status: FleetMaintenanceStatus;
  supplier?: string | null;
  totalCost: number | string;
  type: FleetMaintenanceType;
  vehicle: FleetVehicle;
  vehicleId: string;
};

export type FleetLifecycleHealth = {
  daysUsed?: number | null;
  hoursUsed?: number | null;
  kmUsed?: number | null;
  percent: number;
  status: FleetHealthStatus;
};

export type FleetScheduledService = {
  active: boolean;
  health?: FleetLifecycleHealth | null;
  id: string;
  intervalDays?: number | null;
  intervalHours?: number | string | null;
  intervalKm?: number | null;
  lastDoneAt?: string | null;
  lastHourmeter?: number | string | null;
  lastOdometer?: number | null;
  serviceType: string;
  vehicle?: FleetVehicle | null;
  vehicleId?: string | null;
  vehicleType?: string | null;
};

export type FleetOilControl = {
  health: FleetLifecycleHealth;
  id: string;
  intervalDays?: number | null;
  intervalHours?: number | string | null;
  intervalKm?: number | null;
  lastChangeDate: string;
  lastHourmeter?: number | string | null;
  lastOdometer?: number | null;
  oilType: string;
  vehicle: FleetVehicle;
  vehicleId: string;
};

export type FleetBeltControl = {
  beltType: string;
  health: FleetLifecycleHealth;
  id: string;
  installedAt: string;
  lifetimeDays?: number | null;
  lifetimeHours?: number | string | null;
  lifetimeKm?: number | null;
  vehicle: FleetVehicle;
  vehicleId: string;
};

export type FleetTire = {
  brand?: string | null;
  estimatedLifeKm?: number | null;
  id: string;
  installedAt?: string | null;
  installedKm?: number | null;
  model?: string | null;
  position: string;
  serialNumber?: string | null;
  status: string;
  vehicle: FleetVehicle;
  vehicleId: string;
};

export type FleetSettings = {
  beltAlertPercent: number;
  driverLicenseAlertDays: number;
  fuelTypes: string;
  id: string;
  lists: {
    fuelTypes: string[];
    maintenanceTypes: string[];
    preventiveServiceTypes: string[];
    vehicleTypes: string[];
  };
  maintenanceAlertDays: number;
  maintenanceTypes: string;
  oilAlertPercent: number;
  preventiveServiceTypes: string;
  primaryControlUnit: "KM" | "HOURS" | "BOTH";
  vehicleTypes: string;
};

export type FleetDashboard = {
  alerts: {
    belt: FleetBeltControl[];
    cnhExpired: FleetDriver[];
    cnhExpiring: FleetDriver[];
    maintenanceOpen: FleetMaintenance[];
    oil: FleetOilControl[];
    services: FleetScheduledService[];
    vehiclesInMaintenance: FleetVehicle[];
    vehiclesNoDriver: FleetVehicle[];
  };
  costs: {
    byVehicle: Array<{
      fuelCost: number;
      maintenanceCost: number;
      totalCost: number;
      vehicle: FleetVehicle;
    }>;
    monthlyFuelCost: number;
    monthlyMaintenanceCost: number;
    totalFuelCost: number;
  };
  metrics: {
    averageCostPerHour: number;
    averageCostPerKm: number;
    averageKmPerLiter: number;
    averageLitersPerHour: number;
  };
  totals: {
    activeVehicles: number;
    cnhExpired: number;
    cnhExpiring: number;
    drivers: number;
    inactiveVehicles: number;
    maintenanceVehicles: number;
    pendingPreventiveServices: number;
    totalVehicles: number;
  };
};

export type FleetReports = {
  cnhAlerts: {
    expired: FleetDriver[];
    expiring: FleetDriver[];
  };
  costsByStructure: Array<{
    structure: FleetStructure;
    total: number;
    vehicles: number;
  }>;
  costsByVehicle: FleetDashboard["costs"]["byVehicle"];
  drivers: FleetDriver[];
  fuelings: FleetFueling[];
  maintenances: FleetMaintenance[];
  transfers: FleetTransfer[];
  vehicles: FleetVehicle[];
  vehiclesByStructure: Array<{
    structure: FleetStructure;
    vehicles: FleetVehicle[];
  }>;
};
