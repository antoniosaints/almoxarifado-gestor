import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./settings-page";

describe("SettingsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends catalog reset options when resetting system data", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Resetar dados" }));
    fireEvent.change(screen.getByLabelText("Senha do admin"), {
      target: { value: "admin123" },
    });
    fireEvent.change(screen.getByLabelText("Categorias de produtos"), {
      target: { value: "KEEP" },
    });
    fireEvent.change(screen.getByLabelText("Categorias de almoxarifados"), {
      target: { value: "RESET_DEFAULTS" },
    });
    fireEvent.change(screen.getByLabelText("Unidades de medida"), {
      target: { value: "KEEP" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("Catálogos após o reset")).toBeInTheDocument();
    expect(screen.getAllByText("Manter atuais")).toHaveLength(2);
    expect(screen.getByText("Restaurar padrão do sistema")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Apagar definitivamente" }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://127.0.0.1:3333/settings/reset-data",
        expect.objectContaining({
          body: JSON.stringify({
            password: "admin123",
            productCategories: "KEEP",
            units: "KEEP",
            warehouseCategories: "RESET_DEFAULTS",
          }),
          method: "POST",
        }),
      );
    });
  });
});
