import { describe, expect, it } from "vitest";
import { resolveMaxOutputTokens } from "@/lib/resolve-max-output-tokens";

function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/test", { headers });
}

describe("resolveMaxOutputTokens", () => {
  it("defaults to 32000 when header is absent", () => {
    const req = requestWithHeaders({});
    expect(resolveMaxOutputTokens(req, "claude-sonnet-4-6")).toBe(32000);
  });

  it("uses header value when within model limit", () => {
    const req = requestWithHeaders({ "x-ai-max-output-tokens": "32000" });
    expect(resolveMaxOutputTokens(req, "claude-sonnet-4-6")).toBe(32000);
  });

  it("clamps to model limit for haiku", () => {
    const req = requestWithHeaders({ "x-ai-max-output-tokens": "32000" });
    expect(resolveMaxOutputTokens(req, "claude-haiku-4-5")).toBe(16384);
  });
});
