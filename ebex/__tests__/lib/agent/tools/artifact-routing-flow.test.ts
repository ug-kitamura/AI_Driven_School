import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { executeRegisteredTool } from "@/lib/agent/tools/registry";
import {
  collectWrittenPathsFromToolResult,
  resolveConfirmRequirement,
} from "@/lib/agent/tools/confirm-gate";
import type { ToolCall } from "@/lib/agent/llm/types";
import { createFolder } from "@/lib/workspace-mutations";
import { getWorkspaceDir } from "@/lib/workspace-paths";

/**
 * ebex-agent-artifact-routing の受け入れ基準の機構を、ライブモデルなしで決定的に検証する。
 * 実 skill の references/base.html（CSS インライン済みの自己完結テンプレート）を使い、
 *   copy_file（額縁コピー）→ replace_in_file（プレースホルダ一括置換）→ replace_between（区間差し込み）
 * の主経路が「確認ダイアログゼロ」で通り、成果物にプレースホルダが残らないことを確認する。
 */
const SKILL_DIR = path.resolve(
  process.cwd(),
  ".claude",
  "skills",
  "minutes-maid",
);

describe("artifact routing: copy→fill main route", () => {
  it("builds HTML from base.html with zero confirmation prompts", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-routing-"));
    const folderId = "20260712-minutes";
    createFolder(tmpDir, folderId);

    const context = {
      projectRoot: tmpDir,
      projectFolderId: folderId,
      skillId: "minutes-maid",
      skillDirAbsolute: SKILL_DIR,
    };
    // agent-loop と同じく、成功した書込パスを上書きスキップ集合へ蓄積する
    const skipOverwritePaths = new Set<string>();
    const confirmOptions = {
      skillId: context.skillId,
      skillDirAbsolute: context.skillDirAbsolute,
      skipOverwritePaths,
    };

    const runStep = async (call: ToolCall) => {
      const requirement = resolveConfirmRequirement(
        tmpDir,
        folderId,
        call,
        confirmOptions,
      );
      // 主経路のどのステップでも確認要求は発生しない
      expect(requirement).toBeNull();
      const outcome = await executeRegisteredTool(
        call.name,
        call.input,
        context,
      );
      expect(outcome.result).not.toHaveProperty("error");
      for (const p of collectWrittenPathsFromToolResult(outcome.result)) {
        skipOverwritePaths.add(p);
      }
      return outcome;
    };

    // 1) 額縁テンプレートをプロジェクトへコピー（新規先・確認不要）
    await runStep({
      id: "c1",
      name: "copy_file",
      input: { from: "references/base.html", to: "output/minutes.html" },
    });

    // 2) base.html は自己完結（CSS インライン済み）なのでスタイル操作は不要。
    //    区間差し込みが確認なしで通ることを検証する
    await runStep({
      id: "r1",
      name: "replace_between",
      input: {
        path: "output/minutes.html",
        start_marker: "<!-- AGENDA_ITEMS_START -->",
        end_marker: "<!-- AGENDA_ITEMS_END -->",
        content: '<li><a href="#topic-1">議題1</a></li>',
      },
    });

    // 3) 代表的なプレースホルダを数 KB 未満の断片で差し込む
    await runStep({
      id: "r2",
      name: "replace_in_file",
      input: {
        path: "output/minutes.html",
        replacements: {
          MEETING_TITLE: "月次定例会議",
          DATE: "2026年7月12日",
          ATTENDEES: "参加22名／欠席1名（田中さん）",
          MINUTES_WRITER: "北村さん",
          YEAR: "2026",
          MONTH: "7",
        },
      },
    });

    const written = fs.readFileSync(
      path.join(getWorkspaceDir(tmpDir), folderId, "output", "minutes.html"),
      "utf-8",
    );
    // 外部 CSS リンクは残らず、差し込んだ値が入っている
    expect(written).not.toContain('href="style.css"');
    expect(written).toContain("<style>");
    expect(written).toContain("月次定例会議");
    expect(written).toContain("北村さん");
    // 差し込んだプレースホルダは消えている
    expect(written).not.toContain("{{MEETING_TITLE}}");
    expect(written).not.toContain("{{MINUTES_WRITER}}");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("requires exactly one confirmation when regenerating over an existing output", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-routing-"));
    const folderId = "20260712-minutes";
    createFolder(tmpDir, folderId);
    // 既存の成果物（前回生成）を置く
    fs.mkdirSync(path.join(getWorkspaceDir(tmpDir), folderId, "output"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(getWorkspaceDir(tmpDir), folderId, "output", "minutes.html"),
      "<html>old</html>",
    );

    const confirmOptions = {
      skillId: "minutes-maid",
      skillDirAbsolute: SKILL_DIR,
      skipOverwritePaths: new Set<string>(),
    };
    // 再生成時、既存先への copy_file は 1 回だけ上書き確認が出る
    const requirement = resolveConfirmRequirement(
      tmpDir,
      folderId,
      {
        id: "c1",
        name: "copy_file",
        input: { from: "references/base.html", to: "output/minutes.html" },
      },
      confirmOptions,
    );
    expect(requirement).toMatchObject({ kind: "overwrite" });

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
