import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CurrencyInput } from "./currency-input";

describe("CurrencyInput", () => {
  it("keeps the R$ prefix fixed and emits a normalized decimal value", () => {
    const onValueChange = vi.fn();

    render(
      <CurrencyInput
        aria-label="Valor"
        onValueChange={onValueChange}
        value=""
      />,
    );

    expect(screen.getByText("R$")).toBeInTheDocument();

    const input = screen.getByLabelText("Valor");

    fireEvent.change(input, { target: { value: "123456" } });

    expect(input).toHaveValue("1.234,56");
    expect(onValueChange).toHaveBeenLastCalledWith("1234.56");
  });

  it("formats an existing decimal value using Brazilian currency input text", () => {
    render(<CurrencyInput aria-label="Valor" value="35.5" />);

    expect(screen.getByLabelText("Valor")).toHaveValue("35,50");
    expect(screen.getByText("R$")).toBeInTheDocument();
  });
});
