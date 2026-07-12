import fs from "node:fs";
import path from "node:path";
import type { ToolDefinition } from "@/lib/agent/llm/types";
import { resolveToolTargetPath } from "@/lib/agent/tools/fs-guard";

export type ToolExecutionDisplay = {
  summary: string;
  display: string;
  tags?: string[];
};

export type ToolExecutionOutcome = {
  result: unknown;
  display: ToolExecutionDisplay;
};

export type ToolExecutionContext = {
  projectRoot: string;
  projectFolderId: string;
  skillId?: string;
  skillDirAbsolute?: string;
};

function skillPathOptions(
  context: ToolExecutionContext,
  preferSkillIfExists: boolean,
) {
  return {
    skillId: context.skillId,
    skillDirAbsolute: context.skillDirAbsolute,
    preferSkillIfExists,
  };
}

const SEARCH_RESULT_LIMIT = 50;
const READ_CHAR_LIMIT = 100_000;
const IGNORED_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
]);

const TOOL_SCHEMAS = {
  list_files: {
    name: "list_files",
    description:
      "プロジェクトフォルダ配下のディレクトリ内のファイル・サブフォルダを一覧する。path 省略時はプロジェクト直下を対象とする。",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "一覧するディレクトリのパス（プロジェクト相対、省略時は直下）",
        },
      },
    },
  },
  glob_files: {
    name: "glob_files",
    description:
      "プロジェクトフォルダ配下でファイル名パターン（*, **, ? を含む glob）に一致するファイルを検索する。",
    input_schema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "glob パターン（例: '**/*.md'）",
        },
        path: {
          type: "string",
          description: "検索基点のディレクトリ（プロジェクト相対、省略時は直下）",
        },
      },
      required: ["pattern"],
    },
  },
  search_content: {
    name: "search_content",
    description:
      "プロジェクトフォルダ配下のテキストファイル内容を検索する（grep 相当）。ヒット件数には上限がある。",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "検索する文字列" },
        path: {
          type: "string",
          description: "検索基点のディレクトリ（プロジェクト相対、省略時は直下）",
        },
      },
      required: ["query"],
    },
  },
  read_file: {
    name: "read_file",
    description:
      "指定パスのファイル内容を読み取る。文字数上限を超える場合は切り詰められる。",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "読み取るファイルのパス（プロジェクト相対）" },
      },
      required: ["path"],
    },
  },
  write_file: {
    name: "write_file",
    description:
      "指定パスにファイルを書き込む。既存ファイルへの上書きはユーザー確認を経てから実行される。",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "書き込み先パス（プロジェクト相対）" },
        content: { type: "string", description: "書き込む内容" },
      },
      required: ["path", "content"],
    },
  },
  mkdir: {
    name: "mkdir",
    description: "指定パスのディレクトリを作成する（再帰的に作成する）。",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "作成するディレクトリのパス（プロジェクト相対）" },
      },
      required: ["path"],
    },
  },
} as const satisfies Record<string, ToolDefinition>;

export type RegisteredToolName = keyof typeof TOOL_SCHEMAS;

export function isRegisteredToolName(name: string): name is RegisteredToolName {
  return name in TOOL_SCHEMAS;
}

/**
 * L1-L3 の実ファイル I/O ツールは、スキル frontmatter の `tools` 自己申告に関わらず
 * 常に LLM へ渡す（EBEX ランタイムが提供する基盤ツールのため）。
 * `names` に含まれるその他のツール名（例: `search_company_context`）は、
 * 実装されていれば追加で解決される。
 */
export function resolveToolDefinitions(names: string[]): ToolDefinition[] {
  const requested = new Set(names);
  return Object.values(TOOL_SCHEMAS).filter(
    (definition) => isRegisteredToolName(definition.name) || requested.has(definition.name),
  );
}

function display(summary: string, text: string, tags?: string[]): ToolExecutionDisplay {
  return { summary, display: text, tags };
}

function errorOutcome(message: string): ToolExecutionOutcome {
  return { result: { error: message }, display: display("error", `✗ ${message}`) };
}

function globToRegExp(pattern: string): RegExp {
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === "*") {
      if (pattern[i + 1] === "*") {
        out += ".*";
        i += 1;
        if (pattern[i + 1] === "/") i += 1;
      } else {
        out += "[^/]*";
      }
    } else if (char === "?") {
      out += "[^/]";
    } else if (".+^${}()|[]\\".includes(char)) {
      out += `\\${char}`;
    } else {
      out += char;
    }
  }
  return new RegExp(`^${out}$`);
}

function walkFiles(
  rootAbsolute: string,
  baseAbsolute: string,
  onFile: (relativePath: string, absolutePath: string) => boolean,
): void {
  const stack: string[] = [baseAbsolute];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir || !fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || IGNORED_DIR_NAMES.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      const relative = path.relative(rootAbsolute, abs).replace(/\\/g, "/");
      const shouldContinue = onFile(relative, abs);
      if (!shouldContinue) return;
    }
  }
}

function executeListFiles(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): ToolExecutionOutcome {
  const targetInput = typeof input.path === "string" && input.path.trim() ? input.path : "";
  const resolved = resolveToolTargetPath(
    context.projectRoot,
    context.projectFolderId,
    targetInput || ".",
    skillPathOptions(context, true),
  );
  if ("error" in resolved) return errorOutcome(resolved.error);
  if (!fs.existsSync(resolved.absolutePath)) {
    return errorOutcome(`ディレクトリが見つかりません: ${resolved.relativePath}`);
  }
  const stat = fs.statSync(resolved.absolutePath);
  if (!stat.isDirectory()) {
    return errorOutcome(`ディレクトリではありません: ${resolved.relativePath}`);
  }

  const entries = fs
    .readdirSync(resolved.absolutePath, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith(".") && !IGNORED_DIR_NAMES.has(entry.name))
    .map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? ("dir" as const) : ("file" as const),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  return {
    result: { path: resolved.relativePath, entries },
    display: display(
      `${entries.length} 件`,
      `📁 ${resolved.relativePath} — ${entries.length} 件`,
    ),
  };
}

function executeGlobFiles(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): ToolExecutionOutcome {
  const pattern = typeof input.pattern === "string" ? input.pattern.trim() : "";
  if (!pattern) return errorOutcome("pattern が空です");
  const baseInput = typeof input.path === "string" && input.path.trim() ? input.path : "";

  const rootResolved = resolveToolTargetPath(
    context.projectRoot,
    context.projectFolderId,
    ".",
    skillPathOptions(context, false),
  );
  const baseResolved = resolveToolTargetPath(
    context.projectRoot,
    context.projectFolderId,
    baseInput || ".",
    skillPathOptions(context, true),
  );
  if ("error" in rootResolved) return errorOutcome(rootResolved.error);
  if ("error" in baseResolved) return errorOutcome(baseResolved.error);

  const walkRoot = baseResolved.insideSkill
    ? baseResolved.absolutePath
    : rootResolved.absolutePath;
  const regex = globToRegExp(pattern);
  const matches: string[] = [];
  let truncated = false;

  walkFiles(walkRoot, baseResolved.absolutePath, (relative) => {
    const displayPath = baseResolved.insideSkill
      ? `${baseResolved.relativePath.replace(/\/$/, "")}/${relative}`.replace(
          /\/+/g,
          "/",
        )
      : relative;
    if (regex.test(relative) || regex.test(displayPath)) {
      matches.push(baseResolved.insideSkill ? displayPath : relative);
      if (matches.length >= SEARCH_RESULT_LIMIT) {
        truncated = true;
        return false;
      }
    }
    return true;
  });

  return {
    result: { pattern, matches, truncated },
    display: display(
      `${matches.length} 件${truncated ? "（上限あり）" : ""}`,
      `🔍 glob: ${pattern} — ${matches.length} 件${truncated ? `（上限 ${SEARCH_RESULT_LIMIT} 件で切り詰め）` : ""}`,
    ),
  };
}

function executeSearchContent(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): ToolExecutionOutcome {
  const query = typeof input.query === "string" ? input.query : "";
  if (!query.trim()) return errorOutcome("query が空です");
  const baseInput = typeof input.path === "string" && input.path.trim() ? input.path : "";

  const rootResolved = resolveToolTargetPath(
    context.projectRoot,
    context.projectFolderId,
    ".",
    skillPathOptions(context, false),
  );
  const baseResolved = resolveToolTargetPath(
    context.projectRoot,
    context.projectFolderId,
    baseInput || ".",
    skillPathOptions(context, true),
  );
  if ("error" in rootResolved) return errorOutcome(rootResolved.error);
  if ("error" in baseResolved) return errorOutcome(baseResolved.error);

  const walkRoot = baseResolved.insideSkill
    ? baseResolved.absolutePath
    : rootResolved.absolutePath;
  const needle = query.toLowerCase();
  const hits: Array<{ path: string; line: number; text: string }> = [];
  let truncated = false;

  walkFiles(walkRoot, baseResolved.absolutePath, (relative, absolute) => {
    let content: string;
    try {
      content = fs.readFileSync(absolute, "utf-8");
    } catch {
      return true;
    }
    const displayPath = baseResolved.insideSkill
      ? `${baseResolved.relativePath.replace(/\/$/, "")}/${relative}`.replace(
          /\/+/g,
          "/",
        )
      : relative;
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(needle)) {
        hits.push({
          path: displayPath,
          line: i + 1,
          text: lines[i].trim().slice(0, 300),
        });
        if (hits.length >= SEARCH_RESULT_LIMIT) {
          truncated = true;
          return false;
        }
      }
    }
    return true;
  });

  return {
    result: { query, hits, truncated },
    display: display(
      `${hits.length} 件${truncated ? "（上限あり）" : ""}`,
      `🔎 検索: ${query} — ${hits.length} 件${truncated ? `（上限 ${SEARCH_RESULT_LIMIT} 件で切り詰め）` : ""}`,
    ),
  };
}

function executeReadFile(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): ToolExecutionOutcome {
  const inputPath = typeof input.path === "string" ? input.path : "";
  if (!inputPath.trim()) return errorOutcome("path が空です");
  const resolved = resolveToolTargetPath(
    context.projectRoot,
    context.projectFolderId,
    inputPath,
    skillPathOptions(context, true),
  );
  if ("error" in resolved) return errorOutcome(resolved.error);
  if (!fs.existsSync(resolved.absolutePath)) {
    return errorOutcome(`ファイルが見つかりません: ${resolved.relativePath}`);
  }
  const stat = fs.statSync(resolved.absolutePath);
  if (!stat.isFile()) {
    return errorOutcome(`ファイルではありません: ${resolved.relativePath}`);
  }

  const raw = fs.readFileSync(resolved.absolutePath, "utf-8");
  const truncated = raw.length > READ_CHAR_LIMIT;
  const content = truncated ? raw.slice(0, READ_CHAR_LIMIT) : raw;

  return {
    result: {
      path: resolved.relativePath,
      content,
      truncated,
      ...(truncated ? { totalChars: raw.length } : {}),
    },
    display: display(
      `${content.length} 文字${truncated ? "（切り詰め）" : ""}`,
      `📄 読取: ${resolved.relativePath}${truncated ? `（先頭 ${READ_CHAR_LIMIT} 文字に切り詰め）` : ""}`,
    ),
  };
}

function executeWriteFile(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): ToolExecutionOutcome {
  const inputPath = typeof input.path === "string" ? input.path : "";
  const content = typeof input.content === "string" ? input.content : "";
  if (!inputPath.trim()) return errorOutcome("path が空です");
  const resolved = resolveToolTargetPath(
    context.projectRoot,
    context.projectFolderId,
    inputPath,
    skillPathOptions(context, false),
  );
  if ("error" in resolved) return errorOutcome(resolved.error);
  if (resolved.insideSkill) {
    return errorOutcome(
      `スキルディレクトリへの書込はできません: ${resolved.relativePath}`,
    );
  }

  fs.mkdirSync(path.dirname(resolved.absolutePath), { recursive: true });
  fs.writeFileSync(resolved.absolutePath, content, "utf-8");
  const bytes = Buffer.byteLength(content, "utf-8");

  return {
    result: { path: resolved.relativePath, bytes },
    display: display(`${bytes} bytes`, `💾 書込: ${resolved.relativePath}（${bytes} bytes）`),
  };
}

function executeMkdir(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): ToolExecutionOutcome {
  const inputPath = typeof input.path === "string" ? input.path : "";
  if (!inputPath.trim()) return errorOutcome("path が空です");
  const resolved = resolveToolTargetPath(
    context.projectRoot,
    context.projectFolderId,
    inputPath,
    skillPathOptions(context, false),
  );
  if ("error" in resolved) return errorOutcome(resolved.error);
  if (resolved.insideSkill) {
    return errorOutcome(
      `スキルディレクトリへの作成はできません: ${resolved.relativePath}`,
    );
  }

  fs.mkdirSync(resolved.absolutePath, { recursive: true });

  return {
    result: { path: resolved.relativePath },
    display: display("作成済み", `📁 作成: ${resolved.relativePath}`),
  };
}

/**
 * 削除・コマンド実行はツールとして存在させない（安全境界）。
 * モデルがこれらの名前でツール呼び出しを試みた場合のフォールバック案内。
 */
function buildBlockedOutcome(name: string, input: Record<string, unknown>): ToolExecutionOutcome {
  const target = typeof input.path === "string" ? input.path : undefined;
  const command =
    typeof input.command === "string"
      ? input.command
      : typeof input.script === "string"
        ? input.script
        : undefined;

  if (command) {
    return {
      result: {
        blocked: true,
        command,
        reason: "EBEX はセキュリティ上の理由から任意のコマンド・スクリプト実行を許可していません",
        guidance: "ご自身のターミナルで上記コマンドを実行してください。",
      },
      display: display("blocked", `🚫 コマンド実行をブロック: ${command}`),
    };
  }

  return {
    result: {
      blocked: true,
      path: target,
      reason: "EBEX は自動的にファイルを削除しません",
      guidance: "対象ファイルはご自身で手動削除してください。",
    },
    display: display("blocked", `🚫 削除をブロック${target ? `: ${target}` : ""}`),
  };
}

const BLOCKED_TOOL_NAME_HINTS = ["delete", "remove", "rm", "unlink", "exec", "run_command", "shell", "script"];

export function isLikelyBlockedToolName(name: string): boolean {
  const lower = name.toLowerCase();
  return BLOCKED_TOOL_NAME_HINTS.some((hint) => lower.includes(hint));
}

export async function executeRegisteredTool(
  name: string,
  input: Record<string, unknown> = {},
  context?: ToolExecutionContext,
): Promise<ToolExecutionOutcome> {
  if (!context) {
    return errorOutcome(`プロジェクトフォルダが未選択のため tool を実行できません: ${name}`);
  }

  switch (name) {
    case "list_files":
      return executeListFiles(context, input);
    case "glob_files":
      return executeGlobFiles(context, input);
    case "search_content":
      return executeSearchContent(context, input);
    case "read_file":
      return executeReadFile(context, input);
    case "write_file":
      return executeWriteFile(context, input);
    case "mkdir":
      return executeMkdir(context, input);
    default:
      if (isLikelyBlockedToolName(name)) {
        return buildBlockedOutcome(name, input);
      }
      return errorOutcome(`未知の tool: ${name}`);
  }
}
