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
      subtitle: "Controle e suporte para a rotina pública.",
      title: "Sistemas para prefeituras",
    },
  ],
  faqs: [
    {
      active: true,
      answer: "O atendimento é feito por WhatsApp.",
      id: "faq-1",
      question: "Como tiro dúvidas?",
      sortOrder: 1,
    },
  ],
  features: [
    {
      active: true,
      description: "Indicadores, histórico e auditoria em um só lugar.",
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
      description: "Para iniciar com um módulo.",
      features: ["Implantação assistida"],
      id: "plan-1",
      highlighted: true,
      name: "Essencial",
      sortOrder: 1,
    },
  ],
  posts: [
    {
      content: "Conteúdo completo",
      id: "post-1",
      published: true,
      slug: "gestao-publica",
      summary: "Boas práticas para digitalizar rotinas.",
      title: "Gestão pública digital",
    },
  ],
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
    subheadline: "Frota e almoxarifado para equipes municipais.",
    whatsappMessage: "Olá, quero conhecer os sistemas.",
    whatsappNumber: "5599999999999",
  },
  systems: [
    {
      active: true,
      description: "Controle veículos, motoristas e custos.",
      features: ["Alertas de vencimento"],
      id: "system-1",
      key: "frota",
      name: "Controle de Frota",
      sortOrder: 1,
      summary: "Gestão completa da frota municipal.",
    },
    {
      active: true,
      description: "Controle produtos, estoques e movimentações.",
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

    expect(await screen.findByRole("heading", { name: "Sistemas para gestão pública" })).toBeInTheDocument();
    expect(screen.getByText("Controle de Frota")).toBeInTheDocument();
    expect(screen.getAllByText("Almoxarifado").length).toBeGreaterThan(0);
    expect(screen.getByText("Essencial")).toBeInTheDocument();
    expect(screen.getByText("Sob consulta")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Benefícios" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Soluções por rotina municipal" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Informações e novidades" })).toBeInTheDocument();
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: /Falar|Consultar/ })[0]).toHaveAttribute(
        "href",
        expect.stringContaining("wa.me/5599999999999"),
      );
    });
  });
});
