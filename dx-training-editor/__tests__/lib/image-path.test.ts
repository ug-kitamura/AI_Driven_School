import { describe, expect, it } from "vitest";
import {
  isSafeImageLogicalPath,
  isStagingPath,
  normalizeImageLogicalPath,
  promoteTargetPath,
  sanitizeUploadFileName,
} from "@/lib/image-path";

describe("isSafeImageLogicalPath", () => {
  it("accepts valid promoted paths", () => {
    expect(isSafeImageLogicalPath("images/uploaded/foo.png")).toBe(true);
  });

  it("accepts valid staging paths", () => {
    expect(isSafeImageLogicalPath("images/uploaded/_staging/foo.png")).toBe(true);
  });

  it("rejects traversal", () => {
    expect(isSafeImageLogicalPath("images/uploaded/../secret.png")).toBe(false);
  });

  it("rejects paths outside images", () => {
    expect(isSafeImageLogicalPath("data/foo.png")).toBe(false);
  });
});

describe("promoteTargetPath", () => {
  it("maps staging to promoted path", () => {
    expect(promoteTargetPath("images/uploaded/_staging/a.png")).toBe(
      "images/uploaded/a.png",
    );
  });

  it("returns null for non-staging", () => {
    expect(promoteTargetPath("images/uploaded/a.png")).toBeNull();
  });
});

describe("isStagingPath", () => {
  it("detects staging segment", () => {
    expect(isStagingPath("images/ai/_staging/x.webp")).toBe(true);
    expect(isStagingPath("images/ai/x.webp")).toBe(false);
  });
});

describe("sanitizeUploadFileName", () => {
  it("uses basename only", () => {
    expect(sanitizeUploadFileName("../../evil.png")).toBe("evil.png");
  });
});

describe("normalizeImageLogicalPath", () => {
  it("normalizes backslashes", () => {
    expect(normalizeImageLogicalPath("images\\uploaded\\a.png")).toBe(
      "images/uploaded/a.png",
    );
  });
});
