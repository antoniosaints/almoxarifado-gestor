import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManagerLicensesPage } from "./manager-licenses-page";

describe("ManagerLicensesPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const body = url.includes("/manager/subscribers") ? [] : [];

        return {
          json: async () => body,
          ok: true,
          status: 200,
        };
      }),
    );
  });

  it("explains how to configure client license validation", async () => {
    render(<ManagerLicensesPage />);

    expect(await screen.findByRole("heading", { name: "Licenças" })).toBeInTheDocument();
    expect(screen.getByText("Configuração do cliente")).toBeInTheDocument();
    expect(screen.getByText(/URL_VALIDATION_LICENSE=/)).toBeInTheDocument();
    expect(screen.getByText(/LICENSE_SYSTEM=/)).toBeInTheDocument();
    expect(screen.getByText(/SECRET_VALIDATION_LICENSE=/)).toBeInTheDocument();
  });

  it("allows manually linking an active license", async () => {
    const activeLicense = {
      createdAt: "2026-05-01T00:00:00.000Z",
      expiresAt: "2026-06-15T00:00:00.000Z",
      id: "license-1",
      licenseKey: "ALMO-TESTE-001",
      monthlyValue: 250,
      seats: 5,
      startsAt: "2026-05-01T00:00:00.000Z",
      status: "ACTIVE",
      subscriber: { id: "subscriber-1", name: "Cliente Municipal" },
      subscriberId: "subscriber-1",
      systemKey: "Almoxarifado",
      type: "MONTHLY",
      updatedAt: "2026-05-01T00:00:00.000Z",
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/manager/licenses/license-1/link")) {
        return {
          json: async () => ({ ...activeLicense, status: "LINKED" }),
          ok: true,
          status: 200,
        };
      }

      if (url.includes("/manager/subscribers")) {
        return {
          json: async () => [{ email: "cliente@example.com", id: "subscriber-1", name: "Cliente Municipal" }],
          ok: true,
          status: 200,
        };
      }

      return {
        json: async () => [activeLicense],
        ok: true,
        status: 200,
      };
    });

    vi.stubGlobal("fetch", fetchMock);
    render(<ManagerLicensesPage />);

    expect(await screen.findByText("ALMO-TESTE-001")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Vincular licença ALMO-TESTE-001" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/manager/licenses/license-1/link"),
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });
});
