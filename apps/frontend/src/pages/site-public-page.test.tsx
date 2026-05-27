import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SitePublicPage } from "./site-public-page";

const sitePayload = {
  banners: [
    {
      active: true,
      buttonLabel: "Falar agora",
      buttonUrl: "whatsapp",
      id: "banner-1",
      sortOrder: 1,
      subtitle: "Controle e suporte para a rotina publica.",
      title: "Sistemas para prefeituras",
    },
  ],
  faqs: [
    {
      active: true,
      answer: "O atendimento e feito por WhatsApp.",
      id: "faq-1",
      question: "Como tiro duvidas?",
      sortOrder: 1,
    },
  ],
  features: [
    {
      active: true,
      description: "Indicadores, historico e auditoria em um so lugar.",
      group: "benefits",
      id: "feature-1",
      sortOrder: 1,
      title: "Controle em tempo real",
    },
  ],
  plans: [
    {
      active: true,
      badge: "Sob consulta",
      ctaLabel: "Consultar",
      description: "Para iniciar com um modulo.",
      features: ["Implantacao assistida"],
      id: "plan-1",
      highlighted: true,
      name: "Essencial",
      sortOrder: 1,
    },
  ],
  posts: [
    {
      content: "Conteudo completo",
      id: "post-1",
      published: true,
      slug: "gestao-publica",
      summary: "Boas praticas para digitalizar rotinas.",
      title: "Gestao publica digital",
    },
  ],
  settings: {
    contactEmail: "contato@gema.local",
    eyebrow: "Solucoes municipais",
    footerText: "GEMA Sistemas",
    headline: "Sistemas para gestao publica",
    id: "site",
    primaryColor: "#0f766e",
    primaryCtaLabel: "Falar com especialista",
    secondaryCtaLabel: "Conhecer sistemas",
    siteName: "GEMA Sistemas",
    subheadline: "Frota e almoxarifado para equipes municipais.",
    whatsappMessage: "Ola, quero conhecer os sistemas.",
    whatsappNumber: "5599999999999",
  },
  systems: [
    {
      active: true,
      description: "Controle veiculos, motoristas e custos.",
      features: ["Alertas de vencimento"],
      id: "system-1",
      key: "frota",
      name: "Controle de Frota",
      sortOrder: 1,
      summary: "Gestao completa da frota municipal.",
    },
    {
      active: true,
      description: "Controle produtos, estoques e movimentacoes.",
      features: ["Estoque por almoxarifado"],
      id: "system-2",
      key: "almoxarifado",
      name: "Almoxarifado",
      sortOrder: 2,
      summary: "Estoque municipal com rastreabilidade.",
    },
  ],
};

describe("SitePublicPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => sitePayload,
        status: 200,
      })),
    );
  });

  it("renders systems, plans without prices and WhatsApp CTAs", async () => {
    render(<SitePublicPage />);

    expect(await screen.findByRole("heading", { name: "Sistemas para gestao publica" })).toBeInTheDocument();
    expect(screen.getByText("Controle de Frota")).toBeInTheDocument();
    expect(screen.getAllByText("Almoxarifado").length).toBeGreaterThan(0);
    expect(screen.getByText("Essencial")).toBeInTheDocument();
    expect(screen.getByText("Sob consulta")).toBeInTheDocument();
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: /Falar|Consultar/ })[0]).toHaveAttribute(
        "href",
        expect.stringContaining("wa.me/5599999999999"),
      );
    });
  });
});
