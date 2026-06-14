import { describe, expect, it } from "vitest";
import {
  sanitizeFilename,
  stripPrefix,
  indexToPrefix,
  withPrefix,
} from "@/lib/content-filename";

describe("sanitizeFilename", () => {
  it("passes through normal strings", () => {
    expect(sanitizeFilename("Gitブランチ戦略")).toBe("Gitブランチ戦略");
  });

  it("replaces forbidden characters with underscore", () => {
    expect(sanitizeFilename("レッスン/テスト")).toBe("レッスン_テスト");
    expect(sanitizeFilename("a:b*c?d\"e<f>g|h")).toBe("a_b_c_d_e_f_g_h");
    expect(sanitizeFilename("a\\b")).toBe("a_b");
  });

  it("trims leading and trailing whitespace", () => {
    expect(sanitizeFilename("  name  ")).toBe("name");
  });
});

describe("stripPrefix", () => {
  it("removes numeric prefix from folder name", () => {
    expect(stripPrefix("01_コース名")).toBe("コース名");
    expect(stripPrefix("12_長いコース名")).toBe("長いコース名");
  });

  it("removes numeric prefix and .md extension from file name", () => {
    expect(stripPrefix("01_レッスン名.md")).toBe("レッスン名");
  });

  it("returns name unchanged if no prefix", () => {
    expect(stripPrefix("コース名")).toBe("コース名");
  });
});

describe("indexToPrefix", () => {
  it("generates zero-padded prefix", () => {
    expect(indexToPrefix(0)).toBe("01_");
    expect(indexToPrefix(8)).toBe("09_");
    expect(indexToPrefix(9)).toBe("10_");
  });
});

describe("withPrefix", () => {
  it("combines prefix with sanitized name", () => {
    expect(withPrefix(0, "コース名")).toBe("01_コース名");
    expect(withPrefix(2, "レッスン/テスト")).toBe("03_レッスン_テスト");
  });
});
