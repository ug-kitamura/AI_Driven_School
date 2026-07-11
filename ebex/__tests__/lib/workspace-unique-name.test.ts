import { describe, expect, it } from "vitest";
import {
  resolveUniqueFileName,
  resolveUniqueFolderName,
} from "@/lib/workspace-unique-name";

describe("resolveUniqueFileName", () => {
  it("returns desired name when no conflict", () => {
    expect(resolveUniqueFileName(["other.md"], "test.md")).toBe("test.md");
  });

  it("appends -2 when base name exists", () => {
    expect(resolveUniqueFileName(["test.md"], "test.md")).toBe("test-2.md");
  });

  it("uses max suffix + 1", () => {
    expect(resolveUniqueFileName(["test.md", "test-2.md"], "test.md")).toBe(
      "test-3.md",
    );
  });

  it("handles files without extension", () => {
    expect(resolveUniqueFileName(["README"], "README")).toBe("README-2");
  });
});

describe("resolveUniqueFolderName", () => {
  it("returns desired name when no conflict", () => {
    expect(resolveUniqueFolderName(["other"], "folder")).toBe("folder");
  });

  it("appends -2 when folder exists", () => {
    expect(resolveUniqueFolderName(["folder"], "folder")).toBe("folder-2");
  });

  it("uses max suffix + 1", () => {
    expect(resolveUniqueFolderName(["folder", "folder-2"], "folder")).toBe(
      "folder-3",
    );
  });
});
