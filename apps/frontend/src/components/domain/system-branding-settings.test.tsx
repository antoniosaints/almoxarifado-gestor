import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SystemSettings } from "@/lib/types";
import { SystemBrandingSettings } from "./system-branding-settings";

const hookState = vi.hoisted(() => ({
  saveSettings: vi.fn(),
  settings: {
    faviconUrl: null,
    id: "system",
    loginBackgroundUrl: null,
    loginImageUrl: null,
    loginSubtitle: "Entre no sistema",
    loginTitle: "Manager",
    logoUrl: null,
    officeLogoUrl: null,
    primaryColor: "#0f766e",
    reportFooterText: "Rodapé padrão",
    reportLogoUrl: null,
    reportPrimaryColor: "#0f766e",
    reportTitle: "Relatórios padrão",
    systemName: "GEMA",
  } satisfies SystemSettings,
}));

vi.mock("@/lib/system-settings", () => ({
  defaultSystemSettings: hookState.settings,
  useSystemSettings: () => ({
    darkMode: false,
    error: null,
    loading: false,
    saveSettings: hookState.saveSettings,
    setDarkMode: vi.fn(),
    settings: hookState.settings,
  }),
}));

describe("SystemBrandingSettings", () => {
  beforeEach(() => {
    hookState.saveSettings.mockResolvedValue(hookState.settings);
  });

  it("allows manager settings to personalize report PDFs", async () => {
    render(<SystemBrandingSettings />);

    const reportsTab = screen.getByRole("tab", { name: "Relatórios" });
    fireEvent.mouseDown(reportsTab, { button: 0, ctrlKey: false });
    fireEvent.click(reportsTab);
    fireEvent.change(screen.getByLabelText("Título do cabeçalho"), {
      target: { value: "Manager de Licenças" },
    });
    fireEvent.change(screen.getByLabelText("Rodapé"), {
      target: { value: "Documento comercial do manager" },
    });
    fireEvent.change(screen.getByLabelText("Cor do relatório"), {
      target: { value: "#2563eb" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(hookState.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          reportFooterText: "Documento comercial do manager",
          reportPrimaryColor: "#2563eb",
          reportTitle: "Manager de Licenças",
        }),
      ),
    );
  });
});
