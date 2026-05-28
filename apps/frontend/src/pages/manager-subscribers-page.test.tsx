import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManagerSubscribersPage } from "./manager-subscribers-page";

const subscriber = {
  active: true,
  billings: [
    {
      amount: 250,
      createdAt: "2026-05-01T00:00:00.000Z",
      dueDate: "2026-05-10T00:00:00.000Z",
      id: "billing-1",
      payments: [],
      reference: "2026-05",
      status: "OPEN",
      subscriberId: "subscriber-1",
      systemKey: "Almoxarifado",
      updatedAt: "2026-05-01T00:00:00.000Z",
    },
  ],
  city: "Sao Paulo",
  createdAt: "2026-05-01T00:00:00.000Z",
  document: "12.345.678/0001-90",
  email: "cliente@example.com",
  id: "subscriber-1",
  licenses: [
    {
      createdAt: "2026-05-01T00:00:00.000Z",
      expiresAt: "2026-06-15T00:00:00.000Z",
      id: "license-1",
      licenseKey: "ALMO-TESTE-001",
      linkedAt: "2026-05-02T12:00:00.000Z",
      linkedDomain: "almox.cliente.gov.br",
      linkedIp: "203.0.113.10",
      monthlyValue: 250,
      seats: 5,
      startsAt: "2026-05-01T00:00:00.000Z",
      status: "LINKED",
      subscriberId: "subscriber-1",
      systemKey: "Almoxarifado",
      type: "MONTHLY",
      updatedAt: "2026-05-02T12:00:00.000Z",
    },
  ],
  name: "Cliente Municipal",
  notes: "Atendimento prioritario.",
  phone: "(11) 99999-0000",
  state: "SP",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

describe("ManagerSubscribersPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        json: async () => (url.includes("/manager/gateways") ? [] : [subscriber]),
        ok: true,
        status: 200,
      })),
    );
  });

  it("opens a subscriber details modal with operational tabs", async () => {
    render(<ManagerSubscribersPage />);

    expect(await screen.findByText("Cliente Municipal")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver detalhes de Cliente Municipal" }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Cliente Municipal" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("tab", { name: "Geral" })).toBeInTheDocument();
    expect(within(dialog).getByRole("tab", { name: /Licen/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("tab", { name: /Cobran/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("tab", { name: "Gateway" })).toBeInTheDocument();
    expect(within(dialog).getByRole("tab", { name: "Vencimentos" })).toBeInTheDocument();

    const licensesTab = within(dialog).getByRole("tab", { name: /Licen/ });
    fireEvent.mouseDown(licensesTab, { button: 0, ctrlKey: false });
    fireEvent.click(licensesTab);
    expect(await within(dialog).findByText("ALMO-TESTE-001")).toBeInTheDocument();
    expect(within(dialog).getByText(/almox\.cliente\.gov\.br/)).toBeInTheDocument();

    const billingsTab = within(dialog).getByRole("tab", { name: /Cobran/ });
    fireEvent.mouseDown(billingsTab, { button: 0, ctrlKey: false });
    fireEvent.click(billingsTab);
    expect(await within(dialog).findByText("2026-05")).toBeInTheDocument();
  });
});
