import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { CategoriesPage } from "@/pages/categories-page";
import { DashboardPage } from "@/pages/dashboard-page";
import { InsightsPage } from "@/pages/insights-page";
import { InvoicesPage } from "@/pages/invoices-page";
import { LoginPage } from "@/pages/login-page";
import { MovementsPage } from "@/pages/movements-page";
import { ProductsPage } from "@/pages/products-page";
import { ReportsPage } from "@/pages/reports-page";
import { RequestsPage } from "@/pages/requests-page";
import { UnitsPage } from "@/pages/units-page";
import { UsersPage } from "@/pages/users-page";
import { SettingsPage } from "@/pages/settings-page";
import { WarehouseDetailPage } from "@/pages/warehouse-detail-page";
import { WarehousesPage } from "@/pages/warehouses-page";
import { useSession } from "@/lib/session";

function ProtectedLayout() {
  const { session } = useSession();

  if (!session) {
    return <Navigate replace to="/login" />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { session } = useSession();

  if (session?.user.role !== "ADMIN") {
    return <Navigate replace to="/dashboard" />;
  }

  return children;
}

export function App() {
  const location = useLocation();
  const appFrameKey = location.pathname === "/login" ? "login" : "app";

  return (
    <div className="app-route-frame" key={appFrameKey}>
      <Routes>
        <Route element={<LoginPage />} path="/login" />
        <Route element={<ProtectedLayout />}>
          <Route element={<DashboardPage />} path="/dashboard" />
          <Route
            element={
              <AdminRoute>
                <InsightsPage />
              </AdminRoute>
            }
            path="/insights"
          />
          <Route element={<WarehousesPage />} path="/warehouses" />
          <Route element={<WarehouseDetailPage />} path="/warehouses/:warehouseId" />
          <Route
            element={
              <AdminRoute>
                <ProductsPage />
              </AdminRoute>
            }
            path="/products"
          />
          <Route
            element={
              <AdminRoute>
                <CategoriesPage />
              </AdminRoute>
            }
            path="/categories"
          />
          <Route
            element={
              <AdminRoute>
                <UnitsPage />
              </AdminRoute>
            }
            path="/units"
          />
          <Route element={<InvoicesPage />} path="/invoices" />
          <Route element={<ReportsPage />} path="/reports" />
          <Route element={<MovementsPage />} path="/movements" />
          <Route element={<RequestsPage />} path="/requests" />
          <Route
            element={
              <AdminRoute>
                <UsersPage />
              </AdminRoute>
            }
            path="/users"
          />
          <Route
            element={
              <AdminRoute>
                <SettingsPage />
              </AdminRoute>
            }
            path="/settings"
          />
        </Route>
        <Route element={<Navigate replace to="/dashboard" />} path="*" />
      </Routes>
    </div>
  );
}
