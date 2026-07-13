import fs from "node:fs";
import {
  resolveToolTargetPath,
  type ResolveToolPathOptions,
  type ToolPathError,
} from "@/lib/agent/tools/fs-guard";
import type { ToolCall } from "@/lib/agent/llm/types";

export type ConfirmKind = "overwrite" | "outside-project-read" | "outside-project-write";

export type ConfirmRequirement = {
  kind: ConfirmKind;
  /** 表示用の対象パス */
  path: string;
  /** 書込ツールで、既存ファイルへの上書きかどうか */
  isNew: boolean;
};

const READ_TOOL_NAMES = new Set(["list_files", "glob_files", "search_content", "read_file"]);
const WRITE_TOOL_NAMES = new Set(["write_file", "mkdir", "replace_in_file"]);

function extractPathInput(call: ToolCall): string | null {
  const value = call.input?.path;
  return typeof value === "string" && value.trim() ? value : null;
}

function resolveWriteConfirm(
  projectRoot: string,
  projectFolderId: string,
  inputPath: string,
  skillOptions: ResolveToolPathOptions,
  requireExistsForOverwrite: boolean,
): ConfirmRequirement | null {
  const resolved = resolveToolTargetPath(projectRoot, projectFolderId, inputPath, {
    ...skillOptions,
    preferSkillIfExists: false,
  });
  if ("error" in resolved) return null;
  if (resolved.insideSkill) return null;

  const exists = fs.existsSync(resolved.absolutePath);
  if (!resolved.insideProject) {
    return {
      kind: "outside-project-write",
      path: resolved.relativePath,
      isNew: !exists,
    };
  }
  if (exists && requireExistsForOverwrite) {
    return { kind: "overwrite", path: resolved.relativePath, isNew: false };
  }
  return null;
}

/**
 * ツール呼び出しがユーザー確認を要するかどうかを判定する。
 * - プロジェクト内の新規書込・L1/L2 発見/読取は確認不要
 * - 実行中スキル配下の読取は確認不要（書込は実行時に拒否）
 * - プロジェクト内の既存ファイルへの上書きは確認必要（`overwrite`）
 * - プロジェクト外（`workspace/` 配下だが対象プロジェクト外）は読取/書込とも確認必要
 */
export function resolveConfirmRequirement(
  projectRoot: string,
  projectFolderId: string,
  call: ToolCall,
  skillOptions: ResolveToolPathOptions = {},
): ConfirmRequirement | null {
  if (call.name === "copy_file") {
    const from =
      typeof call.input?.from === "string" && call.input.from.trim()
        ? call.input.from
        : null;
    const to =
      typeof call.input?.to === "string" && call.input.to.trim()
        ? call.input.to
        : null;
    if (!from || !to) return null;

    const fromResolved = resolveToolTargetPath(projectRoot, projectFolderId, from, {
      ...skillOptions,
      preferSkillIfExists: true,
    });
    if (!("error" in fromResolved)) {
      if (!fromResolved.insideProject && !fromResolved.insideSkill) {
        return {
          kind: "outside-project-read",
          path: fromResolved.relativePath,
          isNew: false,
        };
      }
    }

    return resolveWriteConfirm(projectRoot, projectFolderId, to, skillOptions, true);
  }

  const isRead = READ_TOOL_NAMES.has(call.name);
  const isWrite = WRITE_TOOL_NAMES.has(call.name);
  if (!isRead && !isWrite) return null;

  const inputPath = extractPathInput(call);
  if (!inputPath) return null;

  if (isRead) {
    const resolved = resolveToolTargetPath(projectRoot, projectFolderId, inputPath, {
      ...skillOptions,
      preferSkillIfExists: true,
    });
    if ("error" in resolved) return null;
    if (resolved.insideProject || resolved.insideSkill) return null;
    return { kind: "outside-project-read", path: resolved.relativePath, isNew: false };
  }

  // write_file / mkdir / replace_in_file
  const requireOverwrite =
    call.name === "write_file" ||
    call.name === "replace_in_file" ||
    call.name === "copy_file";
  return resolveWriteConfirm(
    projectRoot,
    projectFolderId,
    inputPath,
    skillOptions,
    requireOverwrite || call.name === "replace_in_file",
  );
}

export type { ToolPathError };
