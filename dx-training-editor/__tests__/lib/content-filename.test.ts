import { describe, expect, it } from "vitest";
import {
  sanitizeFilename,
  stripPrefix,
  isValidSlug,
  slugify,
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

describe("isValidSlug", () => {
  it("accepts valid slugs", () => {
    expect(isValidSlug("git-actions")).toBe(true);
    expect(isValidSlug("course-123")).toBe(true);
    expect(isValidSlug("a")).toBe(true);
  });

  it("rejects slugs with uppercase letters", () => {
    expect(isValidSlug("GitActions")).toBe(false);
  });

  it("rejects slugs with leading or trailing hyphens", () => {
    expect(isValidSlug("-slug")).toBe(false);
    expect(isValidSlug("slug-")).toBe(false);
  });

  it("rejects slugs with consecutive hyphens", () => {
    expect(isValidSlug("slug--name")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidSlug("")).toBe(false);
  });

  it("rejects slugs longer than 50 characters", () => {
    expect(isValidSlug("a".repeat(51))).toBe(false);
    expect(isValidSlug("a".repeat(50))).toBe(true);
  });

  it("rejects slugs with non-ASCII characters", () => {
    expect(isValidSlug("git-アクション")).toBe(false);
  });
});

describe("slugify", () => {
  it("converts ASCII text to kebab-case", () => {
    expect(slugify("GitHub Actions")).toBe("github-actions");
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("removes non-ASCII characters", () => {
    const result = slugify("GitHubアクション");
    expect(result).toBe("github");
  });

  it("collapses multiple spaces and hyphens", () => {
    expect(slugify("a   b")).toBe("a-b");
    expect(slugify("a--b")).toBe("a-b");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("  hello  ")).toBe("hello");
  });

  it("clips to 50 characters", () => {
    const long = "abcdefghij".repeat(6);
    expect(slugify(long).length).toBeLessThanOrEqual(50);
  });

  it("returns empty string for purely non-ASCII input", () => {
    const result = slugify("日本語タイトル");
    expect(result).toBe("");
  });
});
