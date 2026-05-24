import {
  BarChart3,
  Bell,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  FileDown,
  FileText,
  Layers3,
  Menu,
  Moon,
  PackageSearch,
  Ruler,
  Settings,
  Sun,
  Tags,
  UserRound,
  UsersRound,
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
import { useApiResource } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useSystemSettings } from "@/lib/system-settings";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const items = [
  { icon: Layers3, label: "Dashboard", to: "/dashboard" },
  { icon: BarChart3, label: "Insights", role: "ADMIN", to: "/insights" },
  { icon: Boxes, label: "Almoxarifados", to: "/warehouses" },
  { icon: PackageSearch, label: "Produtos", role: "ADMIN", to: "/products" },
  { icon: Tags, label: "Categorias", role: "ADMIN", to: "/categories" },
  { icon: Ruler, label: "Unidades", role: "ADMIN", to: "/units" },
  { icon: FileText, label: "Notas fiscais", to: "/invoices" },
  { icon: FileDown, label: "Relatorios", to: "/reports" },
  { icon: ClipboardList, label: "Solicitacoes", to: "/requests" },
  { icon: ClipboardCheck, label: "Movimentacoes", to: "/movements" },
  { icon: UsersRound, label: "Usuarios", role: "ADMIN", to: "/users" },
  { icon: Settings, label: "Configuracoes", role: "ADMIN", to: "/settings" },
] satisfies Array<{
  icon: typeof Boxes;
  label: string;
  role?: UserRole;
  to: string;
}>;

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
  if (logoUrl) {
    return (
      <img
        alt=""
        className="h-full w-full rounded-lg object-cover"
        src={logoUrl}
      />
    );
  }

  return <Boxes className="h-5 w-5" />;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { clearSession, session } = useSession();
  const { darkMode, setDarkMode, settings } = useSystemSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const role = session?.user.role ?? "OPERATOR";
  const notificationSeenKey = `almoxarifado-notifications-seen-${session?.user.id ?? "anon"}`;
  const [seenNotificationTotal, setSeenNotificationTotal] = useState(() =>
    Number(localStorage.getItem(notificationSeenKey) ?? 0),
  );
  const title =
    navigationItems(role).find((item) => location.pathname.startsWith(item.to))
      ?.label ?? "Almoxarifado";
  const summary = useApiResource<{
    pendingEntryRequests: number;
    pendingReceipts: number;
    total: number;
  }>("/requests/summary", {
    pendingEntryRequests: 0,
    pendingReceipts: 0,
    total: 0,
  });
  const notificationCount =
    summary.data.total > 0 && summary.data.total !== seenNotificationTotal
      ? summary.data.total
      : 0;

  useEffect(() => {
    setSeenNotificationTotal(Number(localStorage.getItem(notificationSeenKey) ?? 0));
  }, [notificationSeenKey]);

  function logout() {
    clearSession();
    navigate("/login");
  }

  function markNotificationsSeen() {
    localStorage.setItem(notificationSeenKey, String(summary.data.total));
    setSeenNotificationTotal(summary.data.total);
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="hidden border-r bg-card lg:flex lg:flex-col">
        <div className="px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <BrandLogo logoUrl={settings.logoUrl} />
            </div>
            <div>
              <p className="text-sm font-semibold">{settings.systemName}</p>
              <p className="text-xs text-muted-foreground">Almoxarifado</p>
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
                  <p className="font-semibold">{settings.systemName}</p>
                  <p className="text-sm text-muted-foreground">Operacao de estoque</p>
                </div>
                <Navigation role={role} />
              </SheetContent>
            </Sheet>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Controle</p>
              <h1 className="text-lg font-semibold">{title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex h-10 items-center gap-2 rounded-md border bg-card px-3 text-sm text-muted-foreground">
              {darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              <Switch checked={darkMode} onCheckedChange={setDarkMode} />
              <span className="sr-only">Alternar tema</span>
            </label>
            <DropdownMenu onOpenChange={(open) => open && markNotificationsSeen()}>
              <DropdownMenuTrigger asChild>
                <Button aria-label="Notificacoes internas" size="icon" variant="outline">
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
                  {summary.data.pendingEntryRequests} entradas aguardando analise
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate("/requests")}>
                  {summary.data.pendingReceipts} transferencias aguardando recebimento
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <UserRound className="h-4 w-4" />
                  {session?.user.name ?? "Usuario"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={logout}>Sair</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[90rem] p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
