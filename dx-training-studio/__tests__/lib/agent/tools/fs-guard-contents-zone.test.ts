import { describe, expect, it } from "vitest";
import path from "node:path";
import { resolveToolTargetPath } from "@/lib/agent/tools/fs-guard";

const PROJECT_ROOT = path.resolve("C:/tmp/dx-root");
/** フォーカス中のレッスン（作業フォルダ = contents/<S>/<C>/<L>/） */
const SCOPE = "シリーズA/コースB/レッスンC";

describe("resolveToolTargetPath（dx 2 ルート境界）", () => {
  it("素の相対パスは作業フォルダ（フォーカス中のコンテンツフォルダ）配下へ解決される", () => {
    const resolved = resolveToolTargetPath(PROJECT_ROOT, SCOPE, "draft.md");
    expect(resolved).not.toHaveProperty("error");
    if ("error" in resolved) return;
    expect(resolved.zone).toBe("contents");
    expect(resolved.insideProject).toBe(true);
    expect(resolved.relativePath).toBe(`contents/${SCOPE}/draft.md`);
    expect(resolved.absolutePath).toBe(
      path.join(PROJECT_ROOT, "contents", ...SCOPE.split("/"), "draft.md"),
    );
  });

  it("フォーカスが無いとき素の相対パスは contents/ 直下へ解決される", () => {
    const resolved = resolveToolTargetPath(PROJECT_ROOT, "", "draft.md");
    expect(resolved).not.toHaveProperty("error");
    if ("error" in resolved) return;
    expect(resolved.relativePath).toBe("contents/draft.md");
  });

  it("contents/ 配下は正本ツリーとして解決される", () => {
    const resolved = resolveToolTargetPath(
      PROJECT_ROOT,
      SCOPE,
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

  it("contents-plan/ 配下は作業ツリーとして解決される", () => {
    const resolved = resolveToolTargetPath(
      PROJECT_ROOT,
      SCOPE,
      "contents-plan/runs/20260811-demo/design-note.md",
    );
    expect(resolved).not.toHaveProperty("error");
    if ("error" in resolved) return;
    expect(resolved.zone).toBe("project");
    expect(resolved.insideProject).toBe(true);
    expect(resolved.relativePath).toBe(
      "contents-plan/runs/20260811-demo/design-note.md",
    );
  });

  it("contents ディレクトリ自体も解決できる（一覧・検索の基点）", () => {
    const resolved = resolveToolTargetPath(PROJECT_ROOT, SCOPE, "contents");
    expect(resolved).not.toHaveProperty("error");
    if ("error" in resolved) return;
    expect(resolved.zone).toBe("contents");
  });

  it("contents を装った親ディレクトリ脱出は拒否される", () => {
    const resolved = resolveToolTargetPath(
      PROJECT_ROOT,
      SCOPE,
      "contents/../data/workspace.json",
    );
    expect(resolved).toHaveProperty("error");
  });

  it("contents- 接頭辞の別ディレクトリは contents ゾーンにならない", () => {
    const resolved = resolveToolTargetPath(
      PROJECT_ROOT,
      SCOPE,
      "contents-backup/file.md",
    );
    expect(resolved).not.toHaveProperty("error");
    if ("error" in resolved) return;
    // 素の相対パスとして作業フォルダ配下へ落ちる（リポ直下には届かない）
    expect(resolved.relativePath).toBe(
      `contents/${SCOPE}/contents-backup/file.md`,
    );
  });

  it("絶対パス・チルダ・ドライブレターは拒否される", () => {
    for (const input of ["/etc/hosts", "~/secrets", "C:/windows/system32"]) {
      const resolved = resolveToolTargetPath(PROJECT_ROOT, SCOPE, input);
      expect(resolved).toHaveProperty("error");
    }
  });

  it(".. を含むパスは拒否される", () => {
    const resolved = resolveToolTargetPath(
      PROJECT_ROOT,
      SCOPE,
      "../../etc/hosts",
    );
    expect(resolved).toHaveProperty("error");
  });

  it("data/ 等の素の相対パスはリポ直下へ届かず作業フォルダ内へ閉じる", () => {
    const resolved = resolveToolTargetPath(
      PROJECT_ROOT,
      SCOPE,
      "data/workspace.json",
    );
    expect(resolved).not.toHaveProperty("error");
    if ("error" in resolved) return;
    expect(
      resolved.absolutePath.startsWith(
        path.join(PROJECT_ROOT, "contents", ...SCOPE.split("/")),
      ),
    ).toBe(true);
  });

  it("workspace/ は特別扱いされず作業フォルダ配下へ閉じる", () => {
    const resolved = resolveToolTargetPath(
      PROJECT_ROOT,
      SCOPE,
      "workspace/other/notes.md",
    );
    expect(resolved).not.toHaveProperty("error");
    if ("error" in resolved) return;
    expect(resolved.relativePath).toBe(
      `contents/${SCOPE}/workspace/other/notes.md`,
    );
  });

  it("不正なスコープは拒否される", () => {
    const resolved = resolveToolTargetPath(PROJECT_ROOT, "../escape", "a.md");
    expect(resolved).toHaveProperty("error");
  });
});
