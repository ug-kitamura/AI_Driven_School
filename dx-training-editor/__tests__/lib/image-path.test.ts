import { describe, expect, it } from "vitest";
import {
  isCanonicalImagePath,
  isSafeImageLogicalPath,
  isStagingImagePath,
  normalizeImageLogicalPath,
  promoteTargetPath,
  sanitizeUploadFileName,
} from "@/lib/image-path";

describe("isSafeImageLogicalPath", () => {
  it("accepts canonical paths", () => {
    expect(isSafeImageLogicalPath("images/foo.png")).toBe(true);
  });

  it("accepts staging paths", () => {
    expect(isSafeImageLogicalPath("images/uploaded/foo.png")).toBe(true);
    expect(isSafeImageLogicalPath("images/ai/foo.png")).toBe(true);
  });

  it("rejects legacy _staging paths", () => {
    expect(isSafeImageLogicalPath("images/uploaded/_staging/foo.png")).toBe(
      false,
    );
  });

  it("rejects traversal", () => {
    expect(isSafeImageLogicalPath("images/../secret.png")).toBe(false);
  });

  it("rejects paths outside images", () => {
    expect(isSafeImageLogicalPath("data/foo.png")).toBe(false);
  });
});

describe("isCanonicalImagePath", () => {
  it("rejects source-only segment", () => {
    expect(isCanonicalImagePath("images/uploaded")).toBe(false);
  });
});

describe("promoteTargetPath", () => {
  it("maps staging to canonical path", () => {
    expect(promoteTargetPath("images/uploaded/a.png")).toBe("images/a.png");
    expect(promoteTargetPath("images/ai/a.png")).toBe("images/a.png");
  });

  it("returns null for non-staging", () => {
    expect(promoteTargetPath("images/a.png")).toBeNull();
  });
});

describe("isStagingImagePath", () => {
  it("detects staging paths", () => {
    expect(isStagingImagePath("images/ai/x.webp")).toBe(true);
    expect(isStagingImagePath("images/x.webp")).toBe(false);
  });
});

describe("sanitizeUploadFileName", () => {
  it("uses basename only", () => {
    expect(sanitizeUploadFileName("../../evil.png")).toBe("evil.png");
  });
});

describe("normalizeImageLogicalPath", () => {
  it("normalizes backslashes", () => {
    expect(normalizeImageLogicalPath("images\\foo.png")).toBe("images/foo.png");
  });
});
