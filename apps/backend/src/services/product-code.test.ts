import { describe, expect, it } from "vitest";
import { nextProductCode } from "./product-code.js";

describe("nextProductCode", () => {
  it("formats the next sequence as seven digits", () => {
    expect(nextProductCode("0000042")).toBe("0000043");
  });

  it("starts at one when there are no products yet", () => {
    expect(nextProductCode()).toBe("0000001");
  });

  it("refuses to generate an eighth digit", () => {
    expect(() => nextProductCode("9999999")).toThrow(
      "Limite de codigos de produto atingido.",
    );
  });
});
