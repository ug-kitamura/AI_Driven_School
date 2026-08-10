import { describe, expect, it } from "vitest";
import path from "node:path";
import { resolveToolTargetPath } from "@/lib/agent/tools/fs-guard";

const PROJECT_ROOT = path.resolve("C:/tmp/dx-root");
const FOLDER_ID = "20260810-onenote";

describe("resolveToolTargetPath（dx 2 ルート境界）", () => {
  it("素の相対パスは案件フォルダ配下へ解決される", () => {
    const resolved = resolveToolTargetPath(
      PROJECT_ROOT,
      FOLDER_ID,
      "output/draft.md",
    );
    expect(resolved).not.toHaveProperty("error");
    if ("error" in resolved) return;
    expect(resolved.zone).toBe("project");
    expect(resolved.insideProject).toBe(true);
    expect(resolved.relativePath).toBe(`workspace/${FOLDER_ID}/output/draft.md`);
    expect(resolved.absolutePath).toBe(
      path.join(PROJECT_ROOT, "workspace", FOLDER_ID, "output", "draft.md"),
    );
  });

  it("contents/ 配下は第 2 の書込可ゾーンとして解決される", () => {
    const resolved = resolveToolTargetPath(
      PROJECT_ROOT,
      FOLDER_ID,
      "contents/series-a/course-b/lesson-c.md",
    );
    expect(resolved).not.toHaveProperty("error");
    if ("error" in resolved) return;
    expect(resolved.zone).toBe("contents");
    expect(resolved.insideProject).toBe(true);
    expect(resolved.insideSkill).toBe(false);
    expect(resolved.relativePath).toBe("contents/series-a/course-b/lesson-c.md");
    expect(resolved.absolutePath).toBe(
      path.join(PROJECT_ROOT, "contents", "series-a", "course-b", "lesson-c.md"),
    );
  });

  it("contents ディレクトリ自体も解決できる（一覧・検索の基点）", () => {
    const resolved = resolveToolTargetPath(PROJECT_ROOT, FOLDER_ID, "contents");
    expect(resolved).not.toHaveProperty("error");
    if ("error" in resolved) return;
    expect(resolved.zone).toBe("contents");
  });

  it("contents を装った親ディレクトリ脱出は拒否される", () => {
    const resolved = resolveToolTargetPath(
      PROJECT_ROOT,
      FOLDER_ID,
      "contents/../data/workspace.json",
    );
    expect(resolved).toHaveProperty("error");
  });

  it("contents- 接頭辞の別ディレクトリは contents ゾーンにならない", () => {
    const resolved = resolveToolTargetPath(
      PROJECT_ROOT,
      FOLDER_ID,
      "contents-backup/file.md",
    );
    expect(resolved).not.toHaveProperty("error");
    if ("error" in resolved) return;
    // 素の相対パスとして案件フォルダ配下へ落ちる（リポ直下には届かない）
    expect(resolved.zone).toBe("project");
    expect(resolved.relativePath).toBe(
      `workspace/${FOLDER_ID}/contents-backup/file.md`,
    );
  });

  it("絶対パス・チルダ・ドライブレターは拒否される", () => {
    for (const input of ["/etc/hosts", "~/secrets", "C:/windows/system32"]) {
      const resolved = resolveToolTargetPath(PROJECT_ROOT, FOLDER_ID, input);
      expect(resolved).toHaveProperty("error");
    }
  });

  it(".. を含むパスは拒否される", () => {
    const resolved = resolveToolTargetPath(
      PROJECT_ROOT,
      FOLDER_ID,
      "../../etc/hosts",
    );
    expect(resolved).toHaveProperty("error");
  });

  it("data/ 等の素の相対パスはリポ直下へ届かず案件フォルダ内へ閉じる", () => {
    const resolved = resolveToolTargetPath(
      PROJECT_ROOT,
      FOLDER_ID,
      "data/workspace.json",
    );
    expect(resolved).not.toHaveProperty("error");
    if ("error" in resolved) return;
    expect(resolved.absolutePath.startsWith(
      path.join(PROJECT_ROOT, "workspace", FOLDER_ID),
    )).toBe(true);
  });
});
