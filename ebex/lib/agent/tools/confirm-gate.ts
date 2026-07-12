import fs from "node:fs";
import { resolveToolTargetPath, type ToolPathError } from "@/lib/agent/tools/fs-guard";
import type { ToolCall } from "@/lib/agent/llm/types";

export type ConfirmKind = "overwrite" | "outside-project-read" | "outside-project-write";

export type ConfirmRequirement = {
  kind: ConfirmKind;
  /** `workspace/...` 形式の対象パス */
  path: string;
  /** 書込ツールで、既存ファイルへの上書きかどうか */
  isNew: boolean;
};

const READ_TOOL_NAMES = new Set(["list_files", "glob_files", "search_content", "read_file"]);
const WRITE_TOOL_NAMES = new Set(["write_file", "mkdir"]);

function extractPathInput(call: ToolCall): string | null {
  const value = call.input?.path;
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * ツール呼び出しがユーザー確認を要するかどうかを判定する。
 * - プロジェクト内の新規書込・L1/L2 発見/読取は確認不要
 * - プロジェクト内の既存ファイルへの上書きは確認必要（`overwrite`）
 * - プロジェクト外（`workspace/` 配下だが対象プロジェクト外）は読取/書込とも確認必要
 */
export function resolveConfirmRequirement(
  projectRoot: string,
  projectFolderId: string,
  call: ToolCall,
): ConfirmRequirement | null {
  const isRead = READ_TOOL_NAMES.has(call.name);
  const isWrite = WRITE_TOOL_NAMES.has(call.name);
  if (!isRead && !isWrite) return null;

  const inputPath = extractPathInput(call);
  if (!inputPath) return null;

  const resolved = resolveToolTargetPath(projectRoot, projectFolderId, inputPath);
  if ("error" in resolved) return null; // 実行時にエラーとして処理される

  if (isRead) {
    if (resolved.insideProject) return null;
    return { kind: "outside-project-read", path: resolved.relativePath, isNew: false };
  }

  // write_file / mkdir
  const exists = fs.existsSync(resolved.absolutePath);
  if (!resolved.insideProject) {
    return {
      kind: "outside-project-write",
      path: resolved.relativePath,
      isNew: !exists,
    };
  }
  if (exists && call.name === "write_file") {
    return { kind: "overwrite", path: resolved.relativePath, isNew: false };
  }
  return null;
}

export type { ToolPathError };
