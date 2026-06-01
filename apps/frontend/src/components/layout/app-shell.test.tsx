import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LicenseStatus } from "@/lib/types";

const unmanagedLicense: LicenseStatus = {
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

function stubShellFetch(license = unmanagedLicense) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = url.includes("/license/status")
        ? license
        : {
            pendingEntryRequests: 0,
            pendingReceipts: 0,
            total: 0,
          };

      return {
        json: async () => body,
        ok: true,
        status: 200,
      };
    }),
  );
}

async function importShellFor(systemType = "") {
  vi.stubEnv("VITE_TYPE_SYSTEM", systemType);
  vi.resetModules();

  const [{ AppShell }, { SessionProvider }] = await Promise.all([
    import("./app-shell"),
    import("@/lib/session"),
  ]);

  return { AppShell, SessionProvider };
}

describe("AppShell", () => {
  beforeEach(() => {
    stubShellFetch();
    localStorage.clear();
  });

  it("hides admin-only navigation from operators", async () => {
    const { AppShell, SessionProvider } = await importShellFor("");

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <SessionProvider
          initialSession={{
            token: "operator-token",
            user: {
              email: "operador@prefeitura.local",
              id: "operator",
              name: "Operador",
              role: "OPERATOR",
            },
          }}
        >
          <AppShell>
            <p>Conteúdo</p>
          </AppShell>
        </SessionProvider>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Produtos")).not.toBeInTheDocument();
    expect(screen.queryByText("Categorias")).not.toBeInTheDocument();
    expect(screen.queryByText("Unidades")).not.toBeInTheDocument();
    expect(screen.queryByText("Usuários")).not.toBeInTheDocument();
    expect(screen.getByText("Notas fiscais")).toBeInTheDocument();
    expect(screen.getByText("Relatórios")).toBeInTheDocument();
    expect(screen.getByText("Movimentações")).toBeInTheDocument();

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("shows permission-based navigation for operators", async () => {
    const { AppShell, SessionProvider } = await importShellFor("");

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <SessionProvider
          initialSession={{
            token: "operator-token",
            user: {
              email: "operador@prefeitura.local",
              id: "operator",
              name: "Operador",
              permissions: ["ACCESS_PRODUCTS", "MANAGE_USERS", "VIEW_INSIGHTS"],
              role: "OPERATOR",
            },
          }}
        >
          <AppShell>
            <p>ConteÃºdo</p>
          </AppShell>
        </SessionProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("Produtos")).toBeInTheDocument();
    expect(screen.getByText("Insights")).toBeInTheDocument();
    expect(screen.getByText("Usuários")).toBeInTheDocument();
    expect(screen.queryByText("Configurações")).not.toBeInTheDocument();

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("shows the manager navigation when VITE_TYPE_SYSTEM is manager", async () => {
    vi.stubEnv("VITE_TYPE_SYSTEM", "manager");
    vi.resetModules();

    const [{ AppShell: ManagerAppShell }, { SessionProvider: ManagerSessionProvider }] =
      await Promise.all([import("./app-shell"), import("@/lib/session")]);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <ManagerSessionProvider
          initialSession={{
            token: "admin-token",
            user: {
              email: "admin@prefeitura.local",
              id: "admin",
              name: "Admin",
              role: "ADMIN",
            },
          }}
        >
          <ManagerAppShell>
            <p>Conteúdo</p>
          </ManagerAppShell>
        </ManagerSessionProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("Assinantes")).toBeInTheDocument();
    expect(screen.getByText("Faturamento")).toBeInTheDocument();
    expect(screen.getByText("Licenças")).toBeInTheDocument();
    expect(screen.queryByText("Almoxarifados")).not.toBeInTheDocument();
    expect(screen.queryByText("Produtos")).not.toBeInTheDocument();

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("shows the fleet navigation when VITE_TYPE_SYSTEM is fleet", async () => {
    vi.stubEnv("VITE_TYPE_SYSTEM", "fleet");
    vi.resetModules();

    const [{ AppShell: FleetAppShell }, { SessionProvider: FleetSessionProvider }] =
      await Promise.all([import("./app-shell"), import("@/lib/session")]);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <FleetSessionProvider
          initialSession={{
            token: "admin-token",
            user: {
              email: "admin@prefeitura.local",
              id: "admin",
              name: "Admin",
              role: "ADMIN",
            },
          }}
        >
          <FleetAppShell>
            <p>Conteúdo</p>
          </FleetAppShell>
        </FleetSessionProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Ve.culos/)).toBeInTheDocument();
    expect(screen.getByText("Motoristas")).toBeInTheDocument();
    expect(screen.getByText(/Opera..es/)).toBeInTheDocument();
    expect(screen.getByText("Alertas")).toBeInTheDocument();
    expect(screen.queryByText("Almoxarifados")).not.toBeInTheDocument();
    expect(screen.queryByText("Assinantes")).not.toBeInTheDocument();

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("shows the site admin navigation when VITE_TYPE_SYSTEM is site", async () => {
    vi.stubEnv("VITE_TYPE_SYSTEM", "site");
    vi.resetModules();

    const [{ AppShell: SiteAppShell }, { SessionProvider: SiteSessionProvider }] =
      await Promise.all([import("./app-shell"), import("@/lib/session")]);

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <SiteSessionProvider
          initialSession={{
            token: "admin-token",
            user: {
              email: "admin@prefeitura.local",
              id: "admin",
              name: "Admin",
              role: "ADMIN",
            },
          }}
        >
          <SiteAppShell>
            <p>Conteúdo</p>
          </SiteAppShell>
        </SiteSessionProvider>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Site").length).toBeGreaterThan(0);
    expect(screen.getByText("Identidade")).toBeInTheDocument();
    expect(screen.getByText("Banners")).toBeInTheDocument();
    expect(screen.getByText("Sistemas")).toBeInTheDocument();
    expect(screen.getByText("Benefícios")).toBeInTheDocument();
    expect(screen.getByText("Posts")).toBeInTheDocument();
    expect(screen.getByText("Planos")).toBeInTheDocument();
    expect(screen.queryByText("Almoxarifados")).not.toBeInTheDocument();
    expect(screen.queryByText(/Ve.culos/)).not.toBeInTheDocument();
    expect(screen.queryByText("Assinantes")).not.toBeInTheDocument();

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("shows a read-only license banner when client writes are blocked", async () => {
    stubShellFetch({
      ...unmanagedLicense,
      blockWrites: true,
      licenseKey: "ALMO-EXPIRADA",
      message: "Licença vencida. Entre em contato com o responsável pelo sistema.",
      mode: "managed",
      status: "EXPIRED",
      valid: false,
      warningLevel: "blocked",
    });
    const { AppShell, SessionProvider } = await importShellFor("");

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <SessionProvider
          initialSession={{
            token: "admin-token",
            user: {
              email: "admin@prefeitura.local",
              id: "admin",
              name: "Admin",
              role: "ADMIN",
            },
          }}
        >
          <AppShell>
            <p>Conteúdo</p>
          </AppShell>
        </SessionProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Sistema em modo somente leitura")).toBeInTheDocument();
    expect(
      screen.getByText("Licença vencida. Entre em contato com o responsável pelo sistema."),
    ).toBeInTheDocument();
  });

  it("lets users manually retry blocked license validation from the banner", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/license/status")) {
        return {
          json: async () => ({
            ...unmanagedLicense,
            blockWrites: true,
            licenseKey: "ALMO-EXPIRADA",
            message: "Licença vencida. Entre em contato com o responsável pelo sistema.",
            mode: "managed",
            status: "EXPIRED",
            valid: false,
            warningLevel: "blocked",
          }),
          ok: true,
          status: 200,
        };
      }

      if (url.includes("/license/refresh") && init?.method === "POST") {
        return {
          json: async () => ({
            ...unmanagedLicense,
            checkedAt: "2026-05-27T12:00:00.000Z",
            licenseKey: "ALMO-EXPIRADA",
            message: "Licença ativa.",
            mode: "managed",
            status: "LINKED",
            valid: true,
            warningLevel: "none",
          }),
          ok: true,
          status: 200,
        };
      }

      return {
        json: async () => ({
          pendingEntryRequests: 0,
          pendingReceipts: 0,
          total: 0,
        }),
        ok: true,
        status: 200,
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const { AppShell, SessionProvider } = await importShellFor("");

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <SessionProvider
          initialSession={{
            token: "admin-token",
            user: {
              email: "admin@prefeitura.local",
              id: "admin",
              name: "Admin",
              role: "ADMIN",
            },
          }}
        >
          <AppShell>
            <p>Conteúdo</p>
          </AppShell>
        </SessionProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Verificar licença novamente" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/license/refresh"),
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByText("Sistema em modo somente leitura")).not.toBeInTheDocument(),
    );
  });
});
