import fs from "node:fs";
import path from "node:path";
import type { ToolCall } from "@/lib/agent/llm/types";
import { resolveToolTargetPath } from "@/lib/agent/tools/fs-guard";
import {
  executeRegisteredTool,
  type ToolExecutionContext,
  type ToolExecutionOutcome,
} from "@/lib/agent/tools/registry";

export const SKILL_BASE_HTML_REL = "references/base.html";

const STYLESHEET_LINK_RE =
  /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']style\.css["'][^>]*>/i;

/** 壊れた／巨大な write_file をテンプレ copy に寄せる対象か */
export function isHtmlWritePath(filePath: string): boolean {
  return /\.html?$/i.test(filePath.trim());
}

export function skillHasBaseHtml(skillDirAbsolute?: string): boolean {
  if (!skillDirAbsolute?.trim()) return false;
  return fs.existsSync(path.join(skillDirAbsolute, "references", "base.html"));
}

/**
 * 不完全な tool input JSON から path 文字列を拾う（パース失敗時のリカバリ用）。
 */
export function extractPathFromPartialJson(partialJson: string): string | null {
  const match = partialJson.match(/"path"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (!match) return null;
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return null;
  }
}

export function resolveWriteFileTargetPath(call: ToolCall): string | null {
  const fromInput = call.input?.path;
  if (typeof fromInput === "string" && fromInput.trim()) {
    return fromInput.trim();
  }
  if (call.partialJson) {
    const extracted = extractPathFromPartialJson(call.partialJson);
    if (extracted?.trim()) return extracted.trim();
  }
  return null;
}

function inlineStylesheetIfPresent(
  html: string,
  skillDirAbsolute: string,
): { html: string; inlined: boolean } {
  const cssPath = path.join(skillDirAbsolute, "references", "style.css");
  if (!fs.existsSync(cssPath) || !STYLESHEET_LINK_RE.test(html)) {
    return { html, inlined: false };
  }
  const css = fs.readFileSync(cssPath, "utf-8");
  const inlined = html.replace(
    STYLESHEET_LINK_RE,
    `<style>\n${css}\n</style>`,
  );
  return { html: inlined, inlined: true };
}

/**
 * HTML 向け write_file を、スキルの base.html コピー（＋ style.css インライン）に置き換える。
 * モデルの content は使わない（トークン切れ対策）。
 */
export async function executeTemplateHtmlCopyWrite(
  context: ToolExecutionContext,
  destPath: string,
): Promise<ToolExecutionOutcome | null> {
  const skillDir = context.skillDirAbsolute?.trim();
  if (!skillDir || !skillHasBaseHtml(skillDir)) return null;
  if (!isHtmlWritePath(destPath)) return null;

  const copyOutcome = await executeRegisteredTool(
    "copy_file",
    { from: SKILL_BASE_HTML_REL, to: destPath },
    context,
  );
  if (extractError(copyOutcome.result)) {
    return copyOutcome;
  }

  const destResolved = resolveToolTargetPath(
    context.projectRoot,
    context.projectFolderId,
    destPath,
    {
      skillId: context.skillId,
      skillDirAbsolute: context.skillDirAbsolute,
      preferSkillIfExists: false,
    },
  );
  if ("error" in destResolved) {
    return {
      result: { error: destResolved.error },
      display: { summary: "error", display: `✗ ${destResolved.error}` },
    };
  }

  let html = fs.readFileSync(destResolved.absolutePath, "utf-8");
  const { html: nextHtml, inlined } = inlineStylesheetIfPresent(html, skillDir);
  html = nextHtml;
  if (inlined) {
    fs.writeFileSync(destResolved.absolutePath, html, "utf-8");
  }

  const bytes = Buffer.byteLength(html, "utf-8");
  return {
    result: {
      path: destResolved.relativePath,
      autoTemplateCopy: true,
      cssInlined: inlined,
      bytes,
      next: inlined
        ? "base.html をコピーし style.css をインライン化しました。続けて replace_in_file のみで {{PLACEHOLDER}} を埋めてください。HTML 全文の write_file は使わないでください。"
        : "base.html をコピーしました。続けて replace_in_file のみで {{PLACEHOLDER}} を埋めてください。HTML 全文の write_file は使わないでください。",
    },
    display: {
      summary: "template copy",
      display: inlined
        ? `📋 自動コピー+CSS: ${SKILL_BASE_HTML_REL} → ${destResolved.relativePath}`
        : `📋 自動コピー: ${SKILL_BASE_HTML_REL} → ${destResolved.relativePath}`,
    },
  };
}

function extractError(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const error = (result as { error?: unknown }).error;
  return typeof error === "string" && error.trim() ? error : null;
}

/**
 * write_file をテンプレコピーへ強制／リカバリするかどうか。
 * スキルに references/base.html があり、宛先が .html なら常に寄せる（保証）。
 */
export function shouldForceTemplateHtmlCopy(
  call: ToolCall,
  skillDirAbsolute?: string,
): boolean {
  if (call.name !== "write_file") return false;
  if (!skillHasBaseHtml(skillDirAbsolute)) return false;
  const dest = resolveWriteFileTargetPath(call);
  return Boolean(dest && isHtmlWritePath(dest));
}
