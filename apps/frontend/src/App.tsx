import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { CategoriesPage } from "@/pages/categories-page";
import { DashboardPage } from "@/pages/dashboard-page";
import { FleetAlertsPage } from "@/pages/fleet-alerts-page";
import { FleetDashboardPage } from "@/pages/fleet-dashboard-page";
import { FleetDriversPage } from "@/pages/fleet-drivers-page";
import { FleetOperationsPage } from "@/pages/fleet-operations-page";
import { FleetReportsPage } from "@/pages/fleet-reports-page";
import { FleetSettingsPage } from "@/pages/fleet-settings-page";
import { FleetVehiclesPage } from "@/pages/fleet-vehicles-page";
import { InsightsPage } from "@/pages/insights-page";
import { InvoicesPage } from "@/pages/invoices-page";
import { LoginPage } from "@/pages/login-page";
import { ManagerBillingPage } from "@/pages/manager-billing-page";
import { ManagerDashboardPage } from "@/pages/manager-dashboard-page";
import { ManagerLicensesPage } from "@/pages/manager-licenses-page";
import { ManagerSubscribersPage } from "@/pages/manager-subscribers-page";
import { MovementsPage } from "@/pages/movements-page";
import { ProductsPage } from "@/pages/products-page";
import { ReportsPage } from "@/pages/reports-page";
import { RequestsPage } from "@/pages/requests-page";
import { SiteAdminPage } from "@/pages/site-admin-page";
import { SitePublicPage } from "@/pages/site-public-page";
import { SystemBrandingSettingsPage } from "@/pages/system-branding-settings-page";
import { UnitsPage } from "@/pages/units-page";
import { UsersPage } from "@/pages/users-page";
import { SettingsPage } from "@/pages/settings-page";
import { WarehouseDetailPage } from "@/pages/warehouse-detail-page";
import { WarehousesPage } from "@/pages/warehouses-page";
import { useSession } from "@/lib/session";
import { isFleetSystem, isManagerSystem, isSiteSystem } from "@/lib/system-mode";

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

function AdminRoute({
  children,
  redirectTo = "/dashboard",
}: {
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const { session } = useSession();

  if (session?.user.role !== "ADMIN") {
    return <Navigate replace to={redirectTo} />;
  }

  return children;
}

export function App() {
  const location = useLocation();
  const appFrameKey = location.pathname === "/login" ? "login" : "app";

  return (
    <div className="app-route-frame" key={appFrameKey}>
      <Routes>
        {isSiteSystem ? (
          <>
            <Route element={<SitePublicPage />} path="/" />
            <Route element={<LoginPage />} path="/login" />
            <Route element={<ProtectedLayout />}>
              <Route
                element={
                  <AdminRoute redirectTo="/">
                    <SiteAdminPage />
                  </AdminRoute>
                }
                path="/admin"
              />
              <Route
                element={
                  <AdminRoute redirectTo="/">
                    <SiteAdminPage />
                  </AdminRoute>
                }
                path="/admin/:section"
              />
              <Route
                element={
                  <AdminRoute redirectTo="/">
                    <SystemBrandingSettingsPage />
                  </AdminRoute>
                }
                path="/settings"
              />
            </Route>
            <Route element={<Navigate replace to="/" />} path="*" />
          </>
        ) : (
          <>
        <Route element={<LoginPage />} path="/login" />
        <Route element={<ProtectedLayout />}>
          {isManagerSystem ? (
            <>
              <Route element={<ManagerDashboardPage />} path="/dashboard" />
              <Route
                element={
                  <AdminRoute>
                    <ManagerSubscribersPage />
                  </AdminRoute>
                }
                path="/subscribers"
              />
              <Route
                element={
                  <AdminRoute>
                    <ManagerBillingPage />
                  </AdminRoute>
                }
                path="/billing"
              />
              <Route
                element={
                  <AdminRoute>
                    <ManagerLicensesPage />
                  </AdminRoute>
                }
                path="/licenses"
              />
              <Route
                element={
                  <AdminRoute>
                    <SystemBrandingSettingsPage />
                  </AdminRoute>
                }
                path="/settings"
              />
            </>
          ) : isFleetSystem ? (
            <>
              <Route element={<FleetDashboardPage />} path="/dashboard" />
              <Route element={<FleetVehiclesPage />} path="/vehicles" />
              <Route element={<FleetDriversPage />} path="/drivers" />
              <Route element={<FleetOperationsPage />} path="/operations" />
              <Route element={<FleetAlertsPage />} path="/alerts" />
              <Route element={<FleetReportsPage />} path="/reports" />
              <Route
                element={
                  <AdminRoute>
                    <FleetSettingsPage />
                  </AdminRoute>
                }
                path="/settings"
              />
            </>
          ) : (
            <>
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
            </>
          )}
        </Route>
        <Route element={<Navigate replace to="/dashboard" />} path="*" />
          </>
        )}
      </Routes>
    </div>
  );
}
