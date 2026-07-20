import { describe, expect, it } from "vitest";
import {
  isForeignActiveStream,
  isStopDisabledForScope,
} from "@/lib/agent/session-stream-ownership";

describe("isForeignActiveStream", () => {
  it("is true when a different folder owns the active stream", () => {
    expect(isForeignActiveStream("projectA", "projectB")).toBe(true);
  });

  it("is false when the displayed folder owns the stream", () => {
    expect(isForeignActiveStream("projectA", "projectA")).toBe(false);
  });

  it("is false when there is no tracked owner", () => {
    expect(isForeignActiveStream(null, "projectB")).toBe(false);
  });
});

describe("isStopDisabledForScope", () => {
  it("disables stop on a non-owning folder while streaming", () => {
    // 元プロジェクト(projectA)のストリーム進行中に projectB を表示している
    expect(isStopDisabledForScope(true, "projectA", "projectB")).toBe(true);
  });

  it("keeps stop enabled on the owning folder while streaming", () => {
    expect(isStopDisabledForScope(true, "projectA", "projectA")).toBe(false);
  });

  it("does not disable when not streaming", () => {
    expect(isStopDisabledForScope(false, "projectA", "projectB")).toBe(false);
  });
});
