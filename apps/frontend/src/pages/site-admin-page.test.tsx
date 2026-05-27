import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteAdminPage } from "./site-admin-page";

const adminPayload = {
  banners: [],
  faqs: [
    {
      active: true,
      answer: "Pelo WhatsApp.",
      id: "faq-1",
      question: "Como falar?",
      sortOrder: 1,
    },
  ],
  features: [],
  plans: [
    {
      active: true,
      badge: "Sob consulta",
      ctaLabel: "Consultar",
      description: "Plano inicial.",
      features: ["Implantação"],
      highlighted: false,
      id: "plan-1",
      name: "Essencial",
      sortOrder: 1,
    },
  ],
  posts: [],
  settings: {
    contactEmail: "contato@gema.local",
    eyebrow: "Soluções municipais",
    footerText: "GEMA Sistemas",
    headline: "Sistemas para gestão pública",
    id: "site",
    primaryColor: "#0f766e",
    primaryCtaLabel: "Falar com especialista",
    secondaryCtaLabel: "Conhecer sistemas",
    siteName: "GEMA Sistemas",
    subheadline: "Frota e almoxarifado.",
    whatsappMessage: "Olá, quero conhecer os sistemas.",
    whatsappNumber: "5599999999999",
  },
  systems: [
    {
      active: true,
      description: "Controle de frota.",
      features: ["Alertas"],
      id: "system-1",
      key: "frota",
      name: "Controle de Frota",
      sortOrder: 1,
      summary: "Frota municipal.",
    },
  ],
};

describe("SiteAdminPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => ({
        ok: true,
        json: async () => (init?.method === "PUT" ? { ...adminPayload.settings, siteName: "GEMA Pro" } : adminPayload),
        status: 200,
      })),
    );
  });

  it("loads editable site areas and saves identity settings", async () => {
    render(<SiteAdminPage />);

    expect(await screen.findByRole("heading", { name: "Admin do site" })).toBeInTheDocument();
    expect(screen.getByText("Identidade e contato")).toBeInTheDocument();
    expect(screen.getAllByText("Banners").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sistemas").length).toBeGreaterThan(0);
    expect(screen.getByText("Benefícios")).toBeInTheDocument();
    expect(screen.getAllByText("Posts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Planos").length).toBeGreaterThan(0);
    expect(screen.getByText("FAQ")).toBeInTheDocument();
    expect(screen.getByText("Controle de Frota")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nome do site"), {
      target: { value: "GEMA Pro" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar identidade" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/site/admin/settings"),
        expect.objectContaining({ method: "PUT" }),
      );
    });
  });
});
