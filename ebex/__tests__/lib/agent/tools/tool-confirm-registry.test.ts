import { describe, expect, it, vi, afterEach } from "vitest";
import {
  awaitToolConfirmDecision,
  resolveToolConfirmDecision,
} from "@/lib/agent/tools/tool-confirm-registry";

describe("tool-confirm-registry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves approve decision", async () => {
    const pending = awaitToolConfirmDecision("tool-1");
    expect(resolveToolConfirmDecision("tool-1", "approve")).toBe(true);
    await expect(pending).resolves.toBe("approve");
  });

  it("resolves reject decision", async () => {
    const pending = awaitToolConfirmDecision("tool-2");
    expect(resolveToolConfirmDecision("tool-2", "reject")).toBe(true);
    await expect(pending).resolves.toBe("reject");
  });

  it("returns false for unknown toolUseId", () => {
    expect(resolveToolConfirmDecision("missing", "approve")).toBe(false);
  });

  it("resolves as timeout after TTL", async () => {
    vi.useFakeTimers();
    const pending = awaitToolConfirmDecision("tool-ttl", 1000);
    vi.advanceTimersByTime(1001);
    await expect(pending).resolves.toBe("timeout");
    expect(resolveToolConfirmDecision("tool-ttl", "approve")).toBe(false);
  });
});
