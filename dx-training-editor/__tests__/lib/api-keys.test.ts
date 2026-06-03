import { describe, expect, it } from "vitest";
import { resolveAiApiKey, resolvePixabayApiKey } from "@/lib/api-keys";

describe("resolveAiApiKey", () => {
  it("prefers env over header", () => {
    const req = new Request("http://localhost", {
      headers: { "x-ai-api-key": "header-key" },
    });
    const prev = process.env.AI_API_KEY;
    process.env.AI_API_KEY = "env-key";
    expect(resolveAiApiKey(req)).toBe("env-key");
    process.env.AI_API_KEY = prev;
  });

  it("falls back to header when env unset", () => {
    const prev = process.env.AI_API_KEY;
    delete process.env.AI_API_KEY;
    const req = new Request("http://localhost", {
      headers: { "x-ai-api-key": "header-key" },
    });
    expect(resolveAiApiKey(req)).toBe("header-key");
    process.env.AI_API_KEY = prev;
  });

  it("returns null when unset", () => {
    const prev = process.env.AI_API_KEY;
    delete process.env.AI_API_KEY;
    const req = new Request("http://localhost");
    expect(resolveAiApiKey(req)).toBeNull();
    process.env.AI_API_KEY = prev;
  });
});

describe("resolvePixabayApiKey", () => {
  it("prefers env over header", () => {
    const req = new Request("http://localhost", {
      headers: { "x-pixabay-api-key": "pix-header" },
    });
    const prev = process.env.PIXABAY_API_KEY;
    process.env.PIXABAY_API_KEY = "pix-env";
    expect(resolvePixabayApiKey(req)).toBe("pix-env");
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
