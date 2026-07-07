import { describe, expect, it } from "vitest";
import {
  getProjectFolderId,
  resolveFilePath,
  resolveFolderPath,
  validateFileName,
  validateFolderId,
  validateRelativeFolderPath,
} from "@/lib/workspace-paths";

describe("validateRelativeFolderPath", () => {
  it("allows nested paths", () => {
    expect(validateRelativeFolderPath("demo")).toBeNull();
    expect(validateRelativeFolderPath("demo/sub")).toBeNull();
    expect(validateRelativeFolderPath("demo/sub/inner")).toBeNull();
  });

  it("rejects traversal and malformed paths", () => {
    expect(validateRelativeFolderPath("../evil")).not.toBeNull();
    expect(validateRelativeFolderPath("demo/../evil")).not.toBeNull();
    expect(validateRelativeFolderPath("/demo")).not.toBeNull();
    expect(validateRelativeFolderPath("demo/")).not.toBeNull();
    expect(validateRelativeFolderPath("demo//sub")).not.toBeNull();
  });
});

describe("validateFolderId", () => {
  it("rejects slashes in single segment names", () => {
    expect(validateFolderId("foo/bar")).not.toBeNull();
  });
});

describe("resolveFolderPath", () => {
  const projectRoot = "/tmp/ebex-project";

  it("resolves nested folder paths under workspace", () => {
    const resolved = resolveFolderPath(projectRoot, "demo/sub");
    expect("error" in resolved).toBe(false);
    if ("error" in resolved) return;
    expect(resolved.absolutePath.replace(/\\/g, "/")).toContain(
      "/workspace/demo/sub",
    );
  });

  it("rejects traversal", () => {
    expect("error" in resolveFolderPath(projectRoot, "../outside")).toBe(true);
  });
});

describe("resolveFilePath", () => {
  const projectRoot = "/tmp/ebex-project";

  it("resolves nested file paths", () => {
    const resolved = resolveFilePath(projectRoot, "demo/sub", "notes.md");
    expect("error" in resolved).toBe(false);
    if ("error" in resolved) return;
    expect(resolved.absolutePath.replace(/\\/g, "/")).toContain(
      "/workspace/demo/sub/notes.md",
    );
  });
});

describe("getProjectFolderId", () => {
  it("returns first segment", () => {
    expect(getProjectFolderId("demo/sub/inner")).toBe("demo");
  });
});

describe("validateFileName", () => {
  it("rejects session.json as file name", () => {
    expect(validateFileName("session.json")).not.toBeNull();
  });
});
