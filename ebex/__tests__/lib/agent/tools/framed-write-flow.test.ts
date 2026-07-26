import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { executeRegisteredTool } from "@/lib/agent/tools/registry";
import type { ToolExecutionContext } from "@/lib/agent/tools/registry";
import type { LlmProvider } from "@/lib/agent/llm/provider";
import { createFolder } from "@/lib/workspace-mutations";
import { getWorkspaceDir } from "@/lib/workspace-paths";

/**
 * 額縁保護（丸ごと上書きの退避）と marker 差し込みを、実スキルの額縁に対して
 * ライブモデルなしで検証する。
 * - visual-explainer: 単一区間（CONTENT）の額縁
 * - meeting-minutes-ebe: 複数区間（AGENDA_LIST 他）の額縁
 * 子 LLM はスタブに差し替え、生成本文だけを固定して経路の挙動を見る。
 */
const SKILLS_DIR = path.resolve(process.cwd(), ".claude", "skills");

function stubProvider(text: string): LlmProvider {
  return {
    runTurn: vi.fn(async () => ({
      text,
      stopReason: "end_turn" as const,
      toolCalls: [],
    })),
    async *streamTurn() {
      throw new Error("not used");
    },
  };
}

function setup(skillId: string, generatedText: string) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-framed-flow-"));
  createFolder(tmpDir, "demo");
  const skillDir = path.join(SKILLS_DIR, skillId);
  const projectDir = path.join(getWorkspaceDir(tmpDir), "demo");
  const context: ToolExecutionContext = {
    projectRoot: tmpDir,
    projectFolderId: "demo",
    skillId,
    skillDirAbsolute: skillDir,
    generate: {
      provider: stubProvider(generatedText),
      apiKey: "test-key",
      model: "claude-test",
      maxTokens: 1000,
    },
  };
  return { tmpDir, projectDir, context };
}

async function copyFrame(
  context: ToolExecutionContext,
  to: string,
): Promise<void> {
  const outcome = await executeRegisteredTool(
    "copy_file",
    { from: "references/base.html", to },
    context,
  );
  expect(outcome.result).toMatchObject({ to: `workspace/demo/${to}` });
}

describe("framed write protection against the real visual-explainer frame", () => {
  it("keeps the frame and diverts when generate_and_write targets it directly", async () => {
    const { tmpDir, projectDir, context } = setup(
      "visual-explainer",
      "<div>図解本文</div>",
    );
    await copyFrame(context, "output/diagram.html");
    const framePath = path.join(projectDir, "output", "diagram.html");
    const frameBefore = fs.readFileSync(framePath, "utf-8");

    const outcome = await executeRegisteredTool(
      "generate_and_write",
      {
        purpose: "図解生成",
        path: "output/diagram.html",
        instruction: "図解本文を書く",
      },
      context,
    );

    // 額縁は 1 バイトも変わらない（head の CDN 読み込みが残る）
    expect(fs.readFileSync(framePath, "utf-8")).toBe(frameBefore);
    expect(frameBefore).toContain("cdn.tailwindcss.com");
    // 生成物は退避先に残る
    expect(outcome.result).toMatchObject({
      diverted: true,
      path: "workspace/demo/_work/output__diagram.html",
      markerNames: ["CONTENT"],
    });
    expect(
      fs.readFileSync(
        path.join(projectDir, "_work", "output__diagram.html"),
        "utf-8",
      ),
    ).toBe("<div>図解本文</div>");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("splices into CONTENT and keeps the head, print CSS and footer", async () => {
    const { tmpDir, projectDir, context } = setup(
      "visual-explainer",
      "<div>図解本文</div>",
    );
    await copyFrame(context, "output/diagram.html");
    const framePath = path.join(projectDir, "output", "diagram.html");

    const outcome = await executeRegisteredTool(
      "generate_and_write",
      {
        purpose: "図解生成",
        path: "output/diagram.html",
        instruction: "図解本文を書く",
        marker: "CONTENT",
      },
      context,
    );

    expect(outcome.result).toMatchObject({
      path: "workspace/demo/output/diagram.html",
      marker: "CONTENT",
    });
    const written = fs.readFileSync(framePath, "utf-8");
    expect(written).toContain("cdn.tailwindcss.com");
    expect(written).toContain("<!DOCTYPE html>");
    expect(written).toContain("</html>");
    expect(written).toContain("<div>図解本文</div>");
    // マーカー自体は残る（以降の差し替えが効く）
    expect(written).toContain("<!-- CONTENT_START -->");
    expect(written).toContain("<!-- CONTENT_END -->");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("framed write protection against the real meeting-minutes-ebe frame", () => {
  it("splices into one section without touching the others", async () => {
    const { tmpDir, projectDir, context } = setup(
      "meeting-minutes-ebe",
      "<section>議題の詳細</section>",
    );
    await copyFrame(context, "output/minutes.html");
    const framePath = path.join(projectDir, "output", "minutes.html");

    await executeRegisteredTool(
      "generate_and_write",
      {
        purpose: "議事録",
        path: "output/minutes.html",
        instruction: "議題の詳細を書く",
        marker: "AGENDA_DETAILS",
      },
      context,
    );

    const written = fs.readFileSync(framePath, "utf-8");
    expect(written).toContain("<section>議題の詳細</section>");
    // 他 3 区間は空のまま残る
    for (const marker of [
      "AGENDA_LIST",
      "ACTION_PLAN",
      "PURPOSE_CONTRIBUTION",
    ]) {
      expect(written).toContain(`<!-- ${marker}_START -->`);
      expect(written).toContain(`<!-- ${marker}_END -->`);
    }
    // 額縁のスタイルとプレースホルダは維持される
    expect(written).toContain("{{MEETING_TITLE}}");
    expect(written).toContain("cdn.tailwindcss.com");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reports the remaining empty sections after a splice", async () => {
    const { tmpDir, context } = setup(
      "meeting-minutes-ebe",
      "<section>議題の詳細</section>",
    );
    await copyFrame(context, "output/minutes.html");

    const outcome = await executeRegisteredTool(
      "generate_and_write",
      {
        purpose: "議事録",
        path: "output/minutes.html",
        instruction: "議題の詳細を書く",
        marker: "AGENDA_DETAILS",
      },
      context,
    );

    const result = outcome.result as {
      templateStatus: { complete: boolean; emptySections: string[] };
    };
    expect(result.templateStatus.complete).toBe(false);
    expect(result.templateStatus.emptySections).toEqual([
      "ACTION_PLAN",
      "AGENDA_LIST",
      "PURPOSE_CONTRIBUTION",
    ]);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
