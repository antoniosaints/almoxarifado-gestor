import { describe, expect, it } from "vitest";
import {
  formatCpfCnpj,
  formatPhone,
  isValidCpf,
  isValidCpfCnpj,
  isValidPhone,
} from "./masks";

describe("document and phone masks", () => {
  it("formats and validates CPF values", () => {
    expect(formatCpfCnpj("52998224725")).toBe("529.982.247-25");
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });

  it("formats and validates CNPJ values", () => {
    expect(formatCpfCnpj("12345678000195")).toBe("12.345.678/0001-95");
    expect(isValidCpfCnpj("12.345.678/0001-95")).toBe(true);
    expect(isValidCpfCnpj("12.345.678/0001-00")).toBe(false);
  });

  it("formats and validates phone values", () => {
    expect(formatPhone("11987654321")).toBe("(11) 98765-4321");
    expect(formatPhone("1133334444")).toBe("(11) 3333-4444");
    expect(isValidPhone("(11) 98765-4321")).toBe(true);
    expect(isValidPhone("(11) 333-4444")).toBe(false);
  });
});
