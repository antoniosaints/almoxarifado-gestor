import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SessionProvider } from "@/lib/session";
import { AppShell } from "./app-shell";

describe("AppShell", () => {
  it("hides admin-only navigation from operators", () => {
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
            <p>Conteudo</p>
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
            <p>Conteudo</p>
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
            <p>Conteudo</p>
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
            <p>Conteudo</p>
          </SiteAppShell>
        </SiteSessionProvider>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Site").length).toBeGreaterThan(0);
    expect(screen.getByText("Identidade")).toBeInTheDocument();
    expect(screen.getByText("Banners")).toBeInTheDocument();
    expect(screen.getByText("Sistemas")).toBeInTheDocument();
    expect(screen.getByText("Posts")).toBeInTheDocument();
    expect(screen.getByText("Planos")).toBeInTheDocument();
    expect(screen.queryByText("Almoxarifados")).not.toBeInTheDocument();
    expect(screen.queryByText(/Ve.culos/)).not.toBeInTheDocument();
    expect(screen.queryByText("Assinantes")).not.toBeInTheDocument();

    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
