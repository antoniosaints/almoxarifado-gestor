import { describe, expect, it, vi } from "vitest";
import {
  officeLetterFileSuffix,
  officeLetterPrintPath,
  openOfficeLetterPrintWindow,
} from "./office-letter";

describe("office letter frontend export helpers", () => {
  it("builds the frontend print route for an entry request", () => {
    expect(officeLetterPrintPath("entry-request")).toBe(
      "/requests/entry-request/office-letter/print",
    );
  });

  it("normalizes office letter numbers for file suffixes", () => {
    expect(officeLetterFileSuffix("001/2026", "entry-request")).toBe("001-2026");
    expect(officeLetterFileSuffix("", "entry-request")).toBe("entry-request");
  });

  it("opens the frontend print route in a new browser tab", () => {
    const open = vi.fn(() => ({ closed: false }) as Window);

    expect(openOfficeLetterPrintWindow("entry-request", open)).toBe(true);
    expect(open).toHaveBeenCalledWith(
      "/requests/entry-request/office-letter/print",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("reports when the browser blocks the print popup", () => {
    const open = vi.fn(() => null);

    expect(openOfficeLetterPrintWindow("entry-request", open)).toBe(false);
  });
});
