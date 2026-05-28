import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    localStorage.clear();
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

  it("keeps the selected subscriber detail tab after billing operations reload data", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/manager/gateways")) {
        return { json: async () => [], ok: true, status: 200 };
      }

      if (url.includes("/manager/billings/billing-1/faturar")) {
        return {
          json: async () => ({
            ...subscriber.billings[0],
            payments: [{ id: "payment-1", method: "PIX", status: "PENDING" }],
          }),
          ok: true,
          status: 200,
        };
      }

      return { json: async () => [subscriber], ok: true, status: 200 };
    });

    vi.stubGlobal("fetch", fetchMock);
    render(<ManagerSubscribersPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Ver detalhes de Cliente Municipal" }),
    );

    let dialog = await screen.findByRole("dialog");
    const billingsTab = within(dialog).getByRole("tab", { name: /Cobran/ });
    fireEvent.mouseDown(billingsTab, { button: 0, ctrlKey: false });
    fireEvent.click(billingsTab);
    expect(billingsTab).toHaveAttribute("aria-selected", "true");

    fireEvent.click(within(dialog).getByRole("button", { name: "Faturar" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Confirmar faturamento" }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/manager/billings/billing-1/faturar"),
        expect.objectContaining({ method: "POST" }),
      ),
    );

    dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("tab", { name: /Cobran/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("opens Pix details in a dedicated modal without exposing the long code in the billing card", async () => {
    const longPixCode = "00020101021226890014br.gov.bcb.pix2567pix.example.gov.br/qr/v2/" +
      "assinante-cliente-municipal-cobranca-2026-05-com-codigo-muito-longo";
    const subscriberWithPix = {
      ...subscriber,
      billings: [
        {
          ...subscriber.billings[0],
          payments: [
            {
              amount: 250,
              billingId: "billing-1",
              createdAt: "2026-05-01T00:00:00.000Z",
              externalReference: "billing-1-pix",
              id: "payment-1",
              method: "PIX",
              provider: "MERCADO_PAGO",
              providerPaymentId: "123",
              qrCode: longPixCode,
              qrCodeBase64: "iVBORw0KGgo=",
              status: "PENDING",
              updatedAt: "2026-05-01T00:00:00.000Z",
            },
          ],
        },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        json: async () => (url.includes("/manager/gateways") ? [] : [subscriberWithPix]),
        ok: true,
        status: 200,
      })),
    );
    render(<ManagerSubscribersPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Ver detalhes de Cliente Municipal" }),
    );
    const dialog = await screen.findByRole("dialog");
    const billingsTab = within(dialog).getByRole("tab", { name: /Cobran/ });
    fireEvent.mouseDown(billingsTab, { button: 0, ctrlKey: false });
    fireEvent.click(billingsTab);

    expect(within(dialog).queryByText(longPixCode)).not.toBeInTheDocument();
    fireEvent.click(await within(dialog).findByRole("button", { name: /Ver Pix/ }));

    const pixDialog = await screen.findByRole("dialog", { name: "Pix da cobrança" });
    expect(within(pixDialog).getByDisplayValue(longPixCode)).toBeInTheDocument();
    expect(within(pixDialog).getByRole("button", { name: "Copiar Pix" })).toBeInTheDocument();
  });

  it("reloads subscriber details when a websocket billing update arrives for the open subscriber", async () => {
    class FakeWebSocket {
      static instances: FakeWebSocket[] = [];
      onclose: (() => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onopen: (() => void) | null = null;
      readyState = 1;
      url: string;

      constructor(url: string) {
        this.url = url;
        FakeWebSocket.instances.push(this);
      }

      close() {
        this.onclose?.();
      }
    }

    const fetchMock = vi.fn(async (url: string) => ({
      json: async () => (url.includes("/manager/gateways") ? [] : [subscriber]),
      ok: true,
      status: 200,
    }));

    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubGlobal("fetch", fetchMock);
    localStorage.setItem(
      "almoxarifado-session",
      JSON.stringify({
        token: "session-token",
        user: { email: "admin@example.com", id: "user-1", name: "Admin", role: "ADMIN" },
      }),
    );

    render(<ManagerSubscribersPage />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Ver detalhes de Cliente Municipal" }),
    );

    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    FakeWebSocket.instances[0].onmessage?.(
      new MessageEvent("message", {
        data: JSON.stringify({
          billingId: "billing-1",
          status: "PAID",
          subscriberId: "subscriber-1",
          type: "manager.billing.updated",
        }),
      }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(FakeWebSocket.instances[0].url).toContain("/manager/realtime");
    expect(FakeWebSocket.instances[0].url).toContain("token=session-token");
  });
});
