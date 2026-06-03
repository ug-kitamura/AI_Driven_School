import { describe, expect, it } from "vitest";
import { resolveAnthropicApiKey, resolvePixabayApiKey } from "@/lib/api-keys";

describe("resolveAnthropicApiKey", () => {
  it("prefers header over env", () => {
    const req = new Request("http://localhost", {
      headers: { "x-anthropic-api-key": "header-key" },
    });
    const prev = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "env-key";
    expect(resolveAnthropicApiKey(req)).toBe("header-key");
    process.env.ANTHROPIC_API_KEY = prev;
  });

  it("returns null when unset", () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const req = new Request("http://localhost");
    expect(resolveAnthropicApiKey(req)).toBeNull();
    process.env.ANTHROPIC_API_KEY = prev;
  });
});

describe("resolvePixabayApiKey", () => {
  it("prefers header over env", () => {
    const req = new Request("http://localhost", {
      headers: { "x-pixabay-api-key": "pix-header" },
    });
    const prev = process.env.PIXABAY_API_KEY;
    process.env.PIXABAY_API_KEY = "pix-env";
    expect(resolvePixabayApiKey(req)).toBe("pix-header");
    process.env.PIXABAY_API_KEY = prev;
  });

  it("returns null when unset", () => {
    const prev = process.env.PIXABAY_API_KEY;
    delete process.env.PIXABAY_API_KEY;
    const req = new Request("http://localhost");
    expect(resolvePixabayApiKey(req)).toBeNull();
    process.env.PIXABAY_API_KEY = prev;
  });
});
