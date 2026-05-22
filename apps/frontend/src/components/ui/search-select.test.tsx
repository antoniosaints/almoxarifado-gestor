import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchSelect } from "./search-select";

describe("SearchSelect", () => {
  it("filters options and returns the chosen value", () => {
    const onValueChange = vi.fn();

    render(
      <SearchSelect
        ariaLabel="Produto"
        onValueChange={onValueChange}
        options={[
          { label: "0000001 - Papel A4", value: "paper" },
          { label: "0000002 - Caneta azul", value: "pen" },
        ]}
        placeholder="Selecione um produto"
        value=""
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Produto" }));
    fireEvent.change(screen.getByPlaceholderText("Buscar..."), {
      target: { value: "papel" },
    });

    expect(screen.getByText("0000001 - Papel A4")).toBeInTheDocument();
    expect(screen.queryByText("0000002 - Caneta azul")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("0000001 - Papel A4"));

    expect(onValueChange).toHaveBeenCalledWith("paper");
  });

  it("opens above the trigger when there is not enough room below", () => {
    const triggerRect = {
      bottom: 760,
      height: 40,
      left: 20,
      right: 320,
      top: 720,
      width: 300,
      x: 20,
      y: 720,
    } as DOMRect;
    const getBoundingClientRect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue(triggerRect);

    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 780,
    });

    render(
      <SearchSelect
        ariaLabel="Unidade"
        onValueChange={() => undefined}
        options={[{ label: "Pacote / PCT", value: "pack" }]}
        placeholder="Selecione"
        value=""
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Unidade" }));

    expect(screen.getByTestId("search-select-panel")).toHaveAttribute(
      "data-side",
      "top",
    );

    getBoundingClientRect.mockRestore();
  });

  it("uses the modal scroll area as the dropdown boundary", () => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 920,
    });

    const getBoundingClientRect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function getRect(this: HTMLElement) {
        if (this.dataset.testid === "modal-scroll-area") {
          return {
            bottom: 720,
            height: 600,
            left: 0,
            right: 720,
            top: 120,
            width: 720,
            x: 0,
            y: 120,
          } as DOMRect;
        }

        if (this.getAttribute("aria-label") === "Unidade") {
          return {
            bottom: 620,
            height: 40,
            left: 360,
            right: 660,
            top: 580,
            width: 300,
            x: 360,
            y: 580,
          } as DOMRect;
        }

        return {
          bottom: 0,
          height: 0,
          left: 0,
          right: 0,
          top: 0,
          width: 0,
          x: 0,
          y: 0,
        } as DOMRect;
      });

    render(
      <div data-testid="modal-scroll-area" style={{ overflowY: "auto" }}>
        <SearchSelect
          ariaLabel="Unidade"
          onValueChange={() => undefined}
          options={[{ label: "Pacote / PCT", value: "pack" }]}
          placeholder="Selecione"
          value=""
        />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Unidade" }));

    expect(screen.getByTestId("search-select-panel")).toHaveAttribute(
      "data-side",
      "top",
    );

    getBoundingClientRect.mockRestore();
  });
});
