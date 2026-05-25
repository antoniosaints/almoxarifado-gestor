import { describe, expect, it } from "vitest";
import { resolveAssetUrl } from "./assets";

describe("resolveAssetUrl", () => {
  it("prefixes local upload paths with the configured backend asset URL", () => {
    expect(resolveAssetUrl("/uploads/settings/favicon.png")).toBe(
      "http://127.0.0.1:3333/uploads/settings/favicon.png",
    );
  });

  it("keeps external URLs unchanged", () => {
    expect(resolveAssetUrl("https://cdn.example.com/logo.png")).toBe(
      "https://cdn.example.com/logo.png",
    );
  });
});
