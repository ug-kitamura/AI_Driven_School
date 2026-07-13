import fs from "node:fs";
import {
  resolveToolTargetPath,
  type ResolveToolPathOptions,
  type ToolPathError,
} from "@/lib/agent/tools/fs-guard";
import type { LlmMessage, ToolCall } from "@/lib/agent/llm/types";

export type ConfirmKind = "overwrite" | "outside-project-read" | "outside-project-write";

export type ConfirmRequirement = {
  kind: ConfirmKind;
  /** 表示用の対象パス */
  path: string;
  /** 書込ツールで、既存ファイルへの上書きかどうか */
  isNew: boolean;
};

export type ConfirmGateOptions = ResolveToolPathOptions & {
  /**
   * 上書き確認をスキップするパス（`workspace/...` 相対）。
   * AI が今セッションで作成したファイル、またはユーザーが一度許可したファイル。
   */
  skipOverwritePaths?: ReadonlySet<string>;
};

const READ_TOOL_NAMES = new Set(["list_files", "glob_files", "search_content", "read_file"]);
const WRITE_TOOL_NAMES = new Set(["write_file", "mkdir", "replace_in_file"]);

function extractPathInput(call: ToolCall): string | null {
  const value = call.input?.path;
  return typeof value === "string" && value.trim() ? value : null;
}

export function normalizeConfirmPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "").trim();
}

function shouldSkipOverwrite(
  relativePath: string,
  skipOverwritePaths?: ReadonlySet<string>,
): boolean {
  if (!skipOverwritePaths || skipOverwritePaths.size === 0) return false;
  const normalized = normalizeConfirmPath(relativePath);
  if (skipOverwritePaths.has(normalized)) return true;
  // input が project 相対（notes.md）で set が workspace/demo/notes.md の場合など
  for (const skipped of skipOverwritePaths) {
    if (skipped === normalized) return true;
    if (skipped.endsWith(`/${normalized}`) || normalized.endsWith(`/${skipped}`)) {
      return true;
    }
  }
  return false;
}

function resolveWriteConfirm(
  projectRoot: string,
  projectFolderId: string,
  inputPath: string,
  options: ConfirmGateOptions,
  requireExistsForOverwrite: boolean,
): ConfirmRequirement | null {
  const { skipOverwritePaths, ...skillOptions } = options;
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
    if (shouldSkipOverwrite(resolved.relativePath, skipOverwritePaths)) {
      return null;
    }
    return { kind: "overwrite", path: resolved.relativePath, isNew: false };
  }
  return null;
}

/**
 * ツール呼び出しがユーザー確認を要するかどうかを判定する。
 * - プロジェクト内の新規書込・L1/L2 発見/読取は確認不要
 * - 実行中スキル配下の読取は確認不要（書込は実行時に拒否）
 * - プロジェクト内の既存ファイルへの上書きは確認必要（`overwrite`）
 *   ただし AI 作成済み／一度許可済みパス（skipOverwritePaths）は不要
 * - プロジェクト外（`workspace/` 配下だが対象プロジェクト外）は読取/書込とも確認必要
 */
export function resolveConfirmRequirement(
  projectRoot: string,
  projectFolderId: string,
  call: ToolCall,
  options: ConfirmGateOptions = {},
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
      ...options,
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

    return resolveWriteConfirm(projectRoot, projectFolderId, to, options, true);
  }

  const isRead = READ_TOOL_NAMES.has(call.name);
  const isWrite = WRITE_TOOL_NAMES.has(call.name);
  if (!isRead && !isWrite) return null;

  const inputPath = extractPathInput(call);
  if (!inputPath) return null;

  if (isRead) {
    const resolved = resolveToolTargetPath(projectRoot, projectFolderId, inputPath, {
      ...options,
      preferSkillIfExists: true,
    });
    if ("error" in resolved) return null;
    if (resolved.insideProject || resolved.insideSkill) return null;
    return { kind: "outside-project-read", path: resolved.relativePath, isNew: false };
  }

  const requireOverwrite =
    call.name === "write_file" ||
    call.name === "replace_in_file" ||
    call.name === "copy_file";
  return resolveWriteConfirm(
    projectRoot,
    projectFolderId,
    inputPath,
    options,
    requireOverwrite || call.name === "replace_in_file",
  );
}

/** 成功した書込系 tool_result から、上書きスキップ用パスを収集する */
export function collectWrittenPathsFromToolResult(result: unknown): string[] {
  if (!result || typeof result !== "object") return [];
  const record = result as Record<string, unknown>;
  const paths: string[] = [];
  if (typeof record.path === "string" && record.path.trim()) {
    paths.push(normalizeConfirmPath(record.path));
  }
  if (typeof record.to === "string" && record.to.trim()) {
    paths.push(normalizeConfirmPath(record.to));
  }
  return paths;
}

/** 過去ターンの tool_result から AI が書いたパスを復元する */
export function seedSkipOverwritePathsFromHistory(messages: LlmMessage[]): Set<string> {
  const paths = new Set<string>();
  for (const message of messages) {
    if (typeof message.content === "string") continue;
    for (const block of message.content) {
      if (block.type !== "tool_result") continue;
      try {
        const parsed: unknown = JSON.parse(block.content);
        for (const path of collectWrittenPathsFromToolResult(parsed)) {
          // エラー結果は path だけ付くことがあるので、成功っぽいキーがあるものに限定
          if (
            parsed &&
            typeof parsed === "object" &&
            ("bytes" in parsed ||
              "replacements" in parsed ||
              "autoTemplateCopy" in parsed ||
              "to" in parsed ||
              ("path" in parsed && !("error" in parsed)))
          ) {
            paths.add(path);
          }
        }
      } catch {
        // ignore
      }
    }
  }
  return paths;
}

export type { ToolPathError };
