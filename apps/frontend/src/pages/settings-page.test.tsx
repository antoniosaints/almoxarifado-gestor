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

    expect(screen.queryByRole("button", { name: "Resetar dados" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /dados/i }));
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

  it("creates office templates with variable insertion", async () => {
    let templatePayload: unknown;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));

      if (url.pathname === "/office-templates" && (init?.method ?? "GET") === "POST") {
        templatePayload = JSON.parse(String(init?.body));

        return new Response(
          JSON.stringify({
            active: true,
            contentHtml: templatePayload
              ? (templatePayload as { contentHtml: string }).contentHtml
              : "",
            id: "template-1",
            name: "Oficio fornecedor",
            subject: "Aviso",
            variables: ["nome_empresa"],
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 201,
          },
        );
      }

      if (url.pathname === "/office-templates") {
        return new Response(JSON.stringify([]), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("tab", { name: /oficios/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Novo modelo" }));
    fireEvent.change(screen.getByLabelText("Nome do modelo"), {
      target: { value: "Oficio fornecedor" },
    });
    fireEvent.change(screen.getByLabelText("Assunto"), {
      target: { value: "Aviso" },
    });
    fireEvent.click(screen.getByRole("button", { name: "{{nome_empresa}}" }));

    expect(screen.getByLabelText("Conteudo do oficio")).toHaveTextContent(
      "{{nome_empresa}}",
    );

    fireEvent.click(screen.getByRole("button", { name: "Salvar modelo" }));

    await waitFor(() => {
      expect(templatePayload).toMatchObject({
        contentHtml: expect.stringContaining("{{nome_empresa}}"),
        name: "Oficio fornecedor",
        subject: "Aviso",
      });
    });
  });

  it("renders office template html directly in the editor while editing", async () => {
    let templatePayload: unknown;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));

      if (
        url.pathname === "/office-templates/template-1" &&
        init?.method === "PUT"
      ) {
        templatePayload = JSON.parse(String(init.body));

        return new Response(
          JSON.stringify({
            ...(templatePayload as object),
            id: "template-1",
            variables: ["oficio_numero_ano"],
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      if (url.pathname === "/office-templates") {
        return new Response(
          JSON.stringify([
            {
              active: true,
              contentHtml:
                "<p>OFICIO <strong>{{oficio_numero_ano}}</strong></p>",
              description: "Modelo existente",
              id: "template-1",
              name: "Modelo existente",
              subject: "Solicitacao",
              variables: ["oficio_numero_ano"],
            },
          ]),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("tab", { name: /oficios/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Editar Modelo existente" }),
    );

    const editor = screen.getByLabelText("Conteudo do oficio");

    await waitFor(() => {
      expect(editor.querySelector("strong")).not.toBeNull();
    });
    expect(editor).not.toHaveTextContent("<strong>");

    editor.innerHTML = "<p>Texto editado <strong>renderizado</strong></p>";
    fireEvent.input(editor);
    fireEvent.click(screen.getByRole("button", { name: "Salvar modelo" }));

    await waitFor(() => {
      expect(templatePayload).toMatchObject({
        contentHtml: "<p>Texto editado <strong>renderizado</strong></p>",
      });
    });
  });

  it("toggles the active office template directly from the table", async () => {
    let updatePayload: unknown;
    let reserveActive = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));

      if (
        url.pathname === "/office-templates/template-2" &&
        init?.method === "PUT"
      ) {
        updatePayload = JSON.parse(String(init.body));
        reserveActive = (updatePayload as { active: boolean }).active;

        return new Response(
          JSON.stringify({
            ...(updatePayload as object),
            id: "template-2",
            variables: [],
          }),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      if (url.pathname === "/office-templates") {
        return new Response(
          JSON.stringify([
            {
              active: !reserveActive,
              contentHtml: "<p>OFICIO</p>",
              description: "Modelo principal",
              id: "template-1",
              name: "Modelo principal",
              subject: "Solicitacao",
              variables: [],
            },
            {
              active: reserveActive,
              contentHtml: "<p>OFICIO reserva</p>",
              description: "Modelo reserva",
              id: "template-2",
              name: "Modelo reserva",
              subject: "Solicitacao reserva",
              variables: [],
            },
          ]),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("tab", { name: /oficios/i }));
    fireEvent.click(
      await screen.findByRole("switch", { name: "Ativar Modelo reserva" }),
    );

    await waitFor(() => {
      expect(updatePayload).toMatchObject({
        active: true,
        contentHtml: "<p>OFICIO reserva</p>",
        name: "Modelo reserva",
        subject: "Solicitacao reserva",
      });
    });
    expect(await screen.findByText("Modelo ativado.")).toBeInTheDocument();
  });

  it("deletes office templates from the table action", async () => {
    let deletedTemplate = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));

      if (
        url.pathname === "/office-templates/template-1" &&
        init?.method === "DELETE"
      ) {
        deletedTemplate = true;

        return new Response(null, { status: 204 });
      }

      if (url.pathname === "/office-templates") {
        return new Response(
          JSON.stringify(
            deletedTemplate
              ? []
              : [
                  {
                    active: true,
                    contentHtml: "<p>OFICIO</p>",
                    description: "Modelo existente",
                    id: "template-1",
                    name: "Modelo existente",
                    subject: "Solicitacao",
                    variables: [],
                  },
                ],
          ),
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("tab", { name: /oficios/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Excluir Modelo existente" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://127.0.0.1:3333/office-templates/template-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(await screen.findByText("Modelo de oficio excluido.")).toBeInTheDocument();
  });
});
