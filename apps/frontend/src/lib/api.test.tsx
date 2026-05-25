import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiUpload, useApiResource } from "./api";

function ResourceProbe() {
  const resource = useApiResource<{ name: string }>("/probe", { name: "" });

  if (resource.loading) {
    return <p>Carregando</p>;
  }

  return <p>{resource.data.name}</p>;
}

describe("useApiResource", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("finishes loading when React StrictMode remounts effects in development", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ name: "Dados carregados" }),
        ok: true,
        status: 200,
      })),
    );

    render(
      <StrictMode>
        <ResourceProbe />
      </StrictMode>,
    );

    expect(screen.getByText("Carregando")).toBeInTheDocument();
    expect(await screen.findByText("Dados carregados")).toBeInTheDocument();
  });
});

describe("apiUpload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the file as the request body instead of JSON", async () => {
    const file = new File(["logo"], "logo.png", { type: "image/png" });
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ url: "/uploads/settings/logo.png" }),
      ok: true,
      status: 201,
    }));

    vi.stubGlobal("fetch", fetchMock);

    await expect(apiUpload("/uploads/settings/brand-logo", file)).resolves.toEqual({
      url: "/uploads/settings/logo.png",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3333/uploads/settings/brand-logo",
      expect.objectContaining({
        body: file,
        headers: expect.objectContaining({
          "Content-Type": "image/png",
        }),
        method: "POST",
      }),
    );
  });
});
