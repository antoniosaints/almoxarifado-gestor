import {
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileDown,
  FileText,
  HelpCircle,
  Image,
  KeyRound,
  Layers3,
  Menu,
  MessageCircle,
  Moon,
  Newspaper,
  PackageSearch,
  PanelTop,
  RefreshCw,
  Ruler,
  Settings,
  Sun,
  Tags,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { api, useApiResource } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/assets";
import { useRouteLoading } from "@/lib/route-loading";
import { useSession } from "@/lib/session";
import {
  isFleetSystem,
  isManagerSystem,
  isSiteSystem,
  systemModeLabel,
} from "@/lib/system-mode";
import { useSystemSettings } from "@/lib/system-settings";
import type { LicenseStatus, UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const initialLicenseStatus: LicenseStatus = {
  blockWrites: false,
  checkedAt: null,
  daysUntilExpiration: null,
  expiresAt: null,
  licenseKey: null,
  message: "Controle de licença não configurado.",
  mode: "unmanaged",
  offline: false,
  status: "UNMANAGED",
  valid: true,
  warningLevel: "none",
};

const operationItems = [
  { icon: Layers3, label: "Dashboard", to: "/dashboard" },
  { icon: BarChart3, label: "Insights", role: "ADMIN", to: "/insights" },
  { icon: Boxes, label: "Almoxarifados", to: "/warehouses" },
  { icon: PackageSearch, label: "Produtos", role: "ADMIN", to: "/products" },
  { icon: Tags, label: "Categorias", role: "ADMIN", to: "/categories" },
  { icon: Ruler, label: "Unidades", role: "ADMIN", to: "/units" },
  { icon: FileText, label: "Notas fiscais", to: "/invoices" },
  { icon: FileDown, label: "Relatórios", to: "/reports" },
  { icon: ClipboardList, label: "Solicitações", to: "/requests" },
  { icon: ClipboardCheck, label: "Movimentações", to: "/movements" },
  { icon: UsersRound, label: "Usuários", role: "ADMIN", to: "/users" },
  { icon: Settings, label: "Configurações", role: "ADMIN", to: "/settings" },
] satisfies Array<{
  icon: typeof Boxes;
  label: string;
  role?: UserRole;
  to: string;
}>;

const managerItems = [
  { icon: Layers3, label: "Dashboard", to: "/dashboard" },
  { icon: Building2, label: "Assinantes", role: "ADMIN", to: "/subscribers" },
  { icon: CreditCard, label: "Faturamento", role: "ADMIN", to: "/billing" },
  { icon: KeyRound, label: "Licenças", role: "ADMIN", to: "/licenses" },
  { icon: Settings, label: "Configurações", role: "ADMIN", to: "/settings" },
] satisfies Array<{
  icon: typeof Boxes;
  label: string;
  role?: UserRole;
  to: string;
}>;

const fleetItems = [
  { icon: Layers3, label: "Dashboard", to: "/dashboard" },
  { icon: Boxes, label: "Veículos", to: "/vehicles" },
  { icon: UsersRound, label: "Motoristas", to: "/drivers" },
  { icon: ClipboardCheck, label: "Operações", to: "/operations" },
  { icon: Bell, label: "Alertas", to: "/alerts" },
  { icon: FileDown, label: "Relatórios", to: "/reports" },
  { icon: Settings, label: "Configurações", role: "ADMIN", to: "/settings" },
] satisfies Array<{
  icon: typeof Boxes;
  label: string;
  role?: UserRole;
  to: string;
}>;

const siteItems = [
  { icon: Layers3, label: "Site", role: "ADMIN", to: "/admin" },
  { icon: Settings, label: "Identidade", role: "ADMIN", to: "/admin/identity" },
  { icon: Image, label: "Banners", role: "ADMIN", to: "/admin/banners" },
  { icon: Boxes, label: "Sistemas", role: "ADMIN", to: "/admin/systems" },
  { icon: PanelTop, label: "Benefícios", role: "ADMIN", to: "/admin/features" },
  { icon: Newspaper, label: "Posts", role: "ADMIN", to: "/admin/posts" },
  { icon: CreditCard, label: "Planos", role: "ADMIN", to: "/admin/plans" },
  { icon: HelpCircle, label: "FAQ", role: "ADMIN", to: "/admin/faq" },
  { icon: MessageCircle, label: "Contato", role: "ADMIN", to: "/admin/contact" },
  { icon: Settings, label: "Configurações", role: "ADMIN", to: "/settings" },
] satisfies Array<{
  icon: typeof Boxes;
  label: string;
  role?: UserRole;
  to: string;
}>;

const items = isManagerSystem
  ? managerItems
  : isSiteSystem
    ? siteItems
    : isFleetSystem
      ? fleetItems
      : operationItems;

function navigationItems(role: UserRole) {
  return items.filter((item) => !item.role || item.role === role);
}

function Navigation({ role }: { role: UserRole }) {
  return (
    <nav className="grid gap-1">
      {navigationItems(role).map(({ icon: Icon, label, to }) => (
        <NavLink
          className={({ isActive }) =>
            cn(
              "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-foreground/75 transition hover:bg-muted hover:text-foreground",
              isActive && "bg-primary text-primary-foreground hover:bg-primary",
            )
          }
          key={to}
          to={to}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function BrandLogo({ logoUrl }: { logoUrl?: string | null }) {
  const resolvedLogoUrl = resolveAssetUrl(logoUrl);

  if (resolvedLogoUrl) {
    return (
      <img
        alt=""
        className="h-full w-full rounded-lg object-cover"
        src={resolvedLogoUrl}
      />
    );
  }

  return <Boxes className="h-5 w-5" />;
}

function RouteLoadingSlide({ active }: { active: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }

    const timer = window.setTimeout(() => setVisible(true), 120);

    return () => window.clearTimeout(timer);
  }, [active]);

  return (
    <div className="pointer-events-none sticky top-16 z-20 h-0">
      <div
        aria-hidden={!visible}
        className={cn(
          "overflow-hidden border-b bg-background/90 text-xs text-muted-foreground shadow-sm backdrop-blur transition duration-200",
          visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
        )}
        role="status"
      >
        <div className="mx-auto flex h-8 w-full max-w-[90rem] items-center gap-3 px-4 md:px-6">
          <span className="whitespace-nowrap">Carregando...</span>
          <div className="relative h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="route-loading-slide absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary" />
          </div>
        </div>
      </div>
    </div>
  );
}

function licenseBannerTitle(status: LicenseStatus) {
  if (status.blockWrites) {
    return "Sistema em modo somente leitura";
  }

  if (status.warningLevel === "expires_today") {
    return "Licença vence hoje";
  }

  if (status.warningLevel === "unvalidated") {
    return "Licença aguardando validação";
  }

  return "Licença próxima do vencimento";
}

function LicenseStatusBanner({
  dismissible,
  onDismiss,
  onRefresh,
  refreshError,
  refreshing,
  status,
}: {
  dismissible: boolean;
  onDismiss: () => void;
  onRefresh: () => void;
  refreshError: string | null;
  refreshing: boolean;
  status: LicenseStatus;
}) {
  const blocked = status.blockWrites || status.warningLevel === "unvalidated";
  const canRefresh =
    status.mode === "managed" &&
    (status.blockWrites || status.offline || status.warningLevel === "unvalidated");

  return (
    <div
      className={cn(
        "border-b px-4 py-3 md:px-6",
        blocked
          ? "border-destructive/25 bg-destructive/10 text-destructive"
          : "border-amber-300/60 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
      )}
      role="status"
    >
      <div className="mx-auto flex w-full max-w-[90rem] flex-wrap items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{licenseBannerTitle(status)}</p>
          <p className="text-sm opacity-90">
            {status.message}
            {status.offline ? " Última validação conhecida mantida por falta de conexão." : ""}
          </p>
          {refreshError ? (
            <p className="mt-1 text-xs font-medium opacity-90">{refreshError}</p>
          ) : null}
        </div>
        {canRefresh ? (
          <Button
            aria-label="Verificar licença novamente"
            className="shrink-0"
            disabled={refreshing}
            onClick={onRefresh}
            size="sm"
            variant={blocked ? "destructive" : "outline"}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            {refreshing ? "Verificando..." : "Verificar novamente"}
          </Button>
        ) : null}
        {dismissible ? (
          <Button
            aria-label="Fechar aviso de licença"
            className="h-8 w-8 shrink-0"
            onClick={onDismiss}
            size="icon"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { clearSession, session } = useSession();
  const { darkMode, setDarkMode, settings } = useSystemSettings();
  const routeLoading = useRouteLoading();
  const location = useLocation();
  const navigate = useNavigate();
  const role = session?.user.role ?? "OPERATOR";
  const routeKey = `${location.pathname}${location.search}`;
  const notificationsEnabled = !isManagerSystem && !isFleetSystem && !isSiteSystem;
  const licenseStatusEnabled = !isManagerSystem && !isSiteSystem;
  const notificationSeenKey = `almoxarifado-notifications-seen-${session?.user.id ?? "anon"}`;
  const [seenNotificationTotal, setSeenNotificationTotal] = useState(() =>
    Number(localStorage.getItem(notificationSeenKey) ?? 0),
  );
  const [dismissedLicenseWarning, setDismissedLicenseWarning] = useState(() =>
    localStorage.getItem("license-warning-dismissed") ?? "",
  );
  const [licenseRefreshError, setLicenseRefreshError] = useState<string | null>(null);
  const [refreshingLicense, setRefreshingLicense] = useState(false);
  const title =
    [...navigationItems(role)]
      .sort((left, right) => right.to.length - left.to.length)
      .find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))
      ?.label ??
    (isManagerSystem
      ? "Gestão"
      : isSiteSystem
        ? "Site"
        : isFleetSystem
          ? "Frota"
          : "Almoxarifado");
  const summary = useApiResource<{
    pendingEntryRequests: number;
    pendingReceipts: number;
    total: number;
  }>("/requests/summary", {
    pendingEntryRequests: 0,
    pendingReceipts: 0,
    total: 0,
  }, {
    enabled: notificationsEnabled,
  });
  const licenseStatus = useApiResource<LicenseStatus>(
    "/license/status",
    initialLicenseStatus,
    {
      enabled: licenseStatusEnabled,
    },
  );
  const notificationCount =
    notificationsEnabled &&
    summary.data.total > 0 &&
    summary.data.total !== seenNotificationTotal
      ? summary.data.total
      : 0;
  const licenseWarningKey = [
    licenseStatus.data.licenseKey ?? "license",
    licenseStatus.data.expiresAt ?? "sem-vencimento",
    licenseStatus.data.warningLevel,
  ].join(":");
  const licenseBannerDismissible =
    licenseStatus.data.warningLevel === "warning" && !licenseStatus.data.blockWrites;
  const licenseBannerVisible =
    licenseStatus.data.mode === "managed" &&
    !licenseStatus.loading &&
    (licenseStatus.data.blockWrites ||
      licenseStatus.data.offline ||
      licenseStatus.data.warningLevel !== "none") &&
    (!licenseBannerDismissible || dismissedLicenseWarning !== licenseWarningKey);

  useEffect(() => {
    setSeenNotificationTotal(Number(localStorage.getItem(notificationSeenKey) ?? 0));
  }, [notificationSeenKey]);

  function logout() {
    clearSession();
    navigate("/login");
  }

  function markNotificationsSeen() {
    if (!notificationsEnabled) {
      return;
    }

    localStorage.setItem(notificationSeenKey, String(summary.data.total));
    setSeenNotificationTotal(summary.data.total);
  }

  function dismissLicenseWarning() {
    localStorage.setItem("license-warning-dismissed", licenseWarningKey);
    setDismissedLicenseWarning(licenseWarningKey);
  }

  async function refreshLicenseStatus() {
    if (refreshingLicense) {
      return;
    }

    setRefreshingLicense(true);
    setLicenseRefreshError(null);

    try {
      const nextStatus = await api<LicenseStatus>("/license/refresh", {
        body: JSON.stringify({}),
        method: "POST",
      });

      licenseStatus.setData(nextStatus);
      setDismissedLicenseWarning("");
    } catch (caughtError) {
      setLicenseRefreshError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível verificar a licença agora.",
      );
    } finally {
      setRefreshingLicense(false);
    }
  }

  const subtitle = import.meta.env.VITE_NAME_SYSTEM ?? "GEMA - Gestão Municipal de Almoxarifado.";
  const defaultBrandTitle = isManagerSystem
    ? "Gestor de licenças"
    : isSiteSystem
      ? "Admin do site"
    : isFleetSystem
      ? "Controle de frota"
      : settings.loginTitle;
  const brandTitle = settings.systemName || defaultBrandTitle;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="hidden border-r bg-card lg:flex lg:flex-col">
        <div className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid w-12 place-items-center rounded-lg border text-primary-foreground">
              <BrandLogo logoUrl={settings.logoUrl} />
            </div>
            <div>
              <p className="text-sm font-semibold">{brandTitle}</p>
              <p className="text-xs text-muted-foreground">
                {isManagerSystem || isFleetSystem || isSiteSystem
                  ? systemModeLabel
                  : subtitle}
              </p>
            </div>
          </div>
        </div>
        <Separator />
        <div className="flex-1 p-4">
          <Navigation role={role} />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button aria-label="Abrir menu" className="lg:hidden" size="icon" variant="outline">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <div className="mb-5 pr-8">
                  <p className="font-semibold">
                    {isManagerSystem || isFleetSystem || isSiteSystem
                      ? brandTitle
                      : settings.systemName}
                  </p>
                  <p className="text-sm text-muted-foreground">{systemModeLabel}</p>
                </div>
                <Navigation role={role} />
              </SheetContent>
            </Sheet>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">
                {isManagerSystem
                  ? "Gestão"
                  : isSiteSystem
                    ? "Site"
                    : isFleetSystem
                      ? "Frota"
                      : "Controle"}
              </p>
              <h1 className="text-lg font-semibold">{title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex h-10 items-center gap-2 rounded-md border bg-card px-3 text-sm text-muted-foreground">
              {darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              <Switch checked={darkMode} onCheckedChange={setDarkMode} />
              <span className="sr-only">Alternar tema</span>
            </label>
            {notificationsEnabled ? (
              <DropdownMenu onOpenChange={(open) => open && markNotificationsSeen()}>
                <DropdownMenuTrigger asChild>
                  <Button aria-label="Notificações internas" size="icon" variant="outline">
                    <Bell className="h-4 w-4" />
                    {notificationCount ? (
                      <span className="absolute -mr-7 -mt-7 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[11px] font-semibold text-white">
                        {notificationCount}
                      </span>
                    ) : null}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuItem onSelect={() => navigate("/requests")}>
                    {summary.data.pendingEntryRequests} entradas aguardando análise
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate("/requests")}>
                    {summary.data.pendingReceipts} transferências aguardando recebimento
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <UserRound className="h-4 w-4" />
                  {session?.user.name ?? "Usuário"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={logout}>Sair</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <RouteLoadingSlide active={routeLoading.active} />
        {licenseBannerVisible ? (
          <LicenseStatusBanner
            dismissible={licenseBannerDismissible}
            onDismiss={dismissLicenseWarning}
            onRefresh={() => void refreshLicenseStatus()}
            refreshError={licenseRefreshError}
            refreshing={refreshingLicense}
            status={licenseStatus.data}
          />
        ) : null}
        <main className="mx-auto w-full max-w-[90rem] p-4 md:p-6">
          <div className="route-transition-frame" key={routeKey}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
