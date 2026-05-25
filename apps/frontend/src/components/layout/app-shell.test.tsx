import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
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
    expect(screen.queryByText("Usuarios")).not.toBeInTheDocument();
    expect(screen.getByText("Notas fiscais")).toBeInTheDocument();
    expect(screen.getByText("Relatorios")).toBeInTheDocument();
    expect(screen.getByText("Movimentações")).toBeInTheDocument();
  });
});
