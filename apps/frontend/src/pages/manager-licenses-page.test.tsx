import { render, screen } from "@testing-library/react";
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
});
