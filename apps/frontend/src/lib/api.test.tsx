import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useApiResource } from "./api";

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
