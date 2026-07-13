import fs from "node:fs";
import path from "node:path";
import type { ToolDefinition } from "@/lib/agent/llm/types";
import { resolveToolTargetPath } from "@/lib/agent/tools/fs-guard";
import { isLikelySubagentToolName } from "@/lib/agent/subagent-fallback";
import {
  checkScriptSyntax,
  runScriptInSandbox,
} from "@/lib/agent/tools/script-sandbox";
import {
  SEARCH_UNAVAILABLE_NOTICE,
  SEARCH_UNCONFIGURED_NOTICE,
  type SearchProvider,
  type SearchSessionState,
} from "@/lib/agent/tools/search-provider";
import { WORKSPACE_DIR_NAME } from "@/lib/workspace-constants";

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
  /** web_search のバックエンドとサーキットブレーカー状態（agent loop が構築） */
  search?: {
    provider: SearchProvider | null;
    session: SearchSessionState;
  };
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
      "プロジェクトフォルダ、または実行中スキル配下のディレクトリ内のファイル・サブフォルダを一覧する。path 省略時はプロジェクト直下を対象とする。スキル相対（例: references）はスキル側を優先する。",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "一覧するディレクトリのパス（プロジェクト相対、またはスキル相対。省略時はプロジェクト直下）",
        },
      },
    },
  },
  glob_files: {
    name: "glob_files",
    description:
      "プロジェクトフォルダ配下、および実行中スキル配下でファイル名パターン（*, **, ? を含む glob）に一致するファイルを検索する。path 省略時の既定はプロジェクト直下。references/* などスキル側に実体があるパターンはスキルゾーンも検索する。",
    input_schema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "glob パターン（例: '**/*.md', 'references/*'）",
        },
        path: {
          type: "string",
          description:
            "検索基点のディレクトリ（プロジェクト相対またはスキル相対、省略時はプロジェクト直下）",
        },
      },
      required: ["pattern"],
    },
  },
  search_content: {
    name: "search_content",
    description:
      "プロジェクトフォルダ配下、および実行中スキル配下のテキストファイル内容を検索する（grep 相当）。ヒット件数には上限がある。",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "検索する文字列" },
        path: {
          type: "string",
          description:
            "検索基点のディレクトリ（プロジェクト相対またはスキル相対、省略時はプロジェクト直下）",
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
        path: {
          type: "string",
          description: "読み取るファイルのパス（プロジェクト相対）",
        },
      },
      required: ["path"],
    },
  },
  write_file: {
    name: "write_file",
    description:
      "指定パスにファイルを書き込む。既存ファイルへの上書きはユーザー確認を経てから実行される。大きな成果物の一発書き込みには向かない（入力が途中で切れやすい）。テンプレートがある場合は copy_file し、replace_in_file / replace_between（大きな本文は from_path）/ append_file で組み立てること。",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "書き込み先パス（プロジェクト相対）",
        },
        content: { type: "string", description: "書き込む内容" },
      },
      required: ["path", "content"],
    },
  },
  copy_file: {
    name: "copy_file",
    description:
      "ファイルをコピーする。スキルの references/base.html など大きなテンプレートを成果物先へ置くときに write_file での再生成より優先する。コピー元はプロジェクトまたは実行中スキル配下、コピー先はプロジェクト配下のみ。既存先への上書きはユーザー確認を経る。",
    input_schema: {
      type: "object",
      properties: {
        from: {
          type: "string",
          description:
            "コピー元パス（プロジェクト相対、または skill/<id>/... / references/...）",
        },
        to: {
          type: "string",
          description: "コピー先パス（プロジェクト相対）",
        },
      },
      required: ["from", "to"],
    },
  },
  replace_in_file: {
    name: "replace_in_file",
    description:
      "プロジェクト内ファイルの文字列を置換する。copy_file 後に {{PLACEHOLDER}} を埋める用途を想定。replacements（プレースホルダ map）または old_string/new_string を指定する。大きな本文を write_file で書き直す代わりにこれを使う。",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "対象ファイルのパス（プロジェクト相対）",
        },
        replacements: {
          type: "object",
          description:
            "プレースホルダ名（MEETING_TITLE または {{MEETING_TITLE}}）から置換文字列への map",
          additionalProperties: { type: "string" },
        },
        old_string: {
          type: "string",
          description:
            "置換前の文字列（replacements の代わりに単発置換する場合）",
        },
        new_string: {
          type: "string",
          description: "置換後の文字列（old_string とセット）",
        },
      },
      required: ["path"],
    },
  },
  replace_between: {
    name: "replace_between",
    description:
      "プロジェクト内ファイルで start_marker と end_marker の最初の組の間だけを差し替える（マーカー自体は残す）。差し込み本文は content または from_path のいずれか一方。大きなブロックは from_path（＋ append_file で積んだ partial）を優先する。",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "対象ファイルのパス（プロジェクト相対）",
        },
        start_marker: {
          type: "string",
          description: "区間開始マーカー（残す）",
        },
        end_marker: { type: "string", description: "区間終了マーカー（残す）" },
        content: {
          type: "string",
          description: "差し込み本文（from_path と排他）",
        },
        from_path: {
          type: "string",
          description:
            "差し込み本文の元ファイル（プロジェクトまたは実行中スキル。content と排他）",
        },
      },
      required: ["path", "start_marker", "end_marker"],
    },
  },
  append_file: {
    name: "append_file",
    description:
      "プロジェクト内ファイルの末尾に追記する。存在しない場合は新規作成する。大きな本文を複数ターンで partial に積み、最後に replace_between の from_path で差し込む用途を想定。",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "追記先パス（プロジェクト相対）" },
        content: { type: "string", description: "追記する内容" },
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
        path: {
          type: "string",
          description: "作成するディレクトリのパス（プロジェクト相対）",
        },
      },
      required: ["path"],
    },
  },
  run_script: {
    name: "run_script",
    description:
      "Node.js（CommonJS）スクリプトをサンドボックスで実行する。大きな成果物（HTML 等）の生成に最優先で使うこと: 本文を tool 引数に書かず、ディスク上のデータ（md ドラフト・テンプレート等）を読んで変換・書込するロジックだけをコードにする。fs 読取はプロジェクトと実行中スキル、書込はプロジェクト内のみ。ネットワークアクセスは禁止。実行前にユーザー確認が入る。",
    input_schema: {
      type: "object",
      properties: {
        purpose: {
          type: "string",
          description:
            "何のために実行するかの一文（ユーザー確認ダイアログに表示される）",
        },
        code: {
          type: "string",
          description:
            'CommonJS スクリプト本文。1行目は const fs = require("fs"); で始め、相対パスで読み書きする。成果物の本文を文字列リテラルで埋め込まず、ディスクから読んで組み立てること',
        },
        writes: {
          type: "array",
          items: { type: "string" },
          description: "書き込み予定のファイルパス（プロジェクト相対）の一覧",
        },
      },
      required: ["purpose", "code", "writes"],
    },
  },
  run_skill_script: {
    name: "run_skill_script",
    description:
      "実行中スキルに同梱されたスクリプト（scripts/ 配下）をサンドボックスで実行する。スキルに scripts/ がある場合は run_script より優先する。fs 読取はプロジェクトと実行中スキル、書込はプロジェクト内のみ。実行前にユーザー確認が入る。",
    input_schema: {
      type: "object",
      properties: {
        script_path: {
          type: "string",
          description:
            "実行するスクリプトのスキル相対パス（例: scripts/build-html.cjs）",
        },
        args: {
          type: "array",
          items: { type: "string" },
          description: "スクリプトへ渡す引数（任意）",
        },
        purpose: {
          type: "string",
          description:
            "何のために実行するかの一文（ユーザー確認ダイアログに表示される）",
        },
      },
      required: ["script_path", "purpose"],
    },
  },
  web_search: {
    name: "web_search",
    description:
      "web 検索を実行し、タイトル・URL・スニペットの一覧を返す。実行前にユーザー確認が入る。検索が利用できない環境では、その旨の案内が返る（再試行しないこと）。",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "検索クエリ（ユーザー確認ダイアログに全文表示される）",
        },
        purpose: {
          type: "string",
          description:
            "何のために検索するかの一文（ユーザー確認ダイアログに表示される）",
        },
      },
      required: ["query", "purpose"],
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
    (definition) =>
      isRegisteredToolName(definition.name) || requested.has(definition.name),
  );
}

function display(
  summary: string,
  text: string,
  tags?: string[],
): ToolExecutionDisplay {
  return { summary, display: text, tags };
}

function errorOutcome(message: string): ToolExecutionOutcome {
  return {
    result: { error: message },
    display: display("error", `✗ ${message}`),
  };
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
      if (entry.name.startsWith(".") || IGNORED_DIR_NAMES.has(entry.name))
        continue;
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

function skillDisplayPath(
  skillId: string,
  relativeFromSkillRoot: string,
): string {
  const rel = relativeFromSkillRoot.replace(/\\/g, "/").replace(/^\/+/, "");
  return rel ? `skill/${skillId}/${rel}` : `skill/${skillId}`;
}

type DiscoveryWalkZone = {
  rootAbsolute: string;
  baseAbsolute: string;
  toDisplayPath: (relativeFromRoot: string, absolutePath: string) => string;
};

function buildProjectWalkZone(
  projectRootAbsolute: string,
  baseAbsolute: string,
): DiscoveryWalkZone {
  return {
    rootAbsolute: projectRootAbsolute,
    baseAbsolute,
    toDisplayPath: (relativeFromRoot) => relativeFromRoot,
  };
}

function buildSkillWalkZone(
  context: ToolExecutionContext,
  baseAbsolute: string,
): DiscoveryWalkZone | null {
  const skillId = context.skillId?.trim();
  const skillDir = context.skillDirAbsolute?.trim();
  if (!skillId || !skillDir || !fs.existsSync(skillDir)) return null;
  return {
    rootAbsolute: skillDir,
    baseAbsolute,
    toDisplayPath: (relativeFromRoot) =>
      skillDisplayPath(skillId, relativeFromRoot),
  };
}

/**
 * L1 の walk 対象を決める。
 * - path が skill に解決 → skill のみ
 * - path 省略（`.`）→ project のみ（スキル直下で置き換えない）
 *   スキルへのフォールバックは呼び出し側で project 0 件時に行う
 */
function resolveDiscoveryWalkZones(
  context: ToolExecutionContext,
  pathInput: string,
): DiscoveryWalkZone[] | { error: string } {
  const baseResolved = resolveToolTargetPath(
    context.projectRoot,
    context.projectFolderId,
    pathInput || ".",
    skillPathOptions(context, true),
  );
  if ("error" in baseResolved) return { error: baseResolved.error };

  if (baseResolved.insideSkill) {
    const skillZone = buildSkillWalkZone(context, baseResolved.absolutePath);
    if (!skillZone) return { error: "実行中スキルディレクトリがありません" };
    return [skillZone];
  }

  const projectRootResolved = resolveToolTargetPath(
    context.projectRoot,
    context.projectFolderId,
    ".",
    skillPathOptions(context, false),
  );
  if ("error" in projectRootResolved)
    return { error: projectRootResolved.error };

  return [
    buildProjectWalkZone(
      projectRootResolved.absolutePath,
      baseResolved.absolutePath,
    ),
  ];
}

/** path 省略かつ project 0 件のとき、スキルゾーンを追加検索するか */
function shouldFallbackToSkillZone(
  pathOmitted: boolean,
  matchCount: number,
  context: ToolExecutionContext,
): boolean {
  if (!pathOmitted || matchCount > 0) return false;
  return Boolean(context.skillDirAbsolute?.trim() && context.skillId?.trim());
}

function executeListFiles(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): ToolExecutionOutcome {
  const targetInput =
    typeof input.path === "string" && input.path.trim() ? input.path : "";
  const resolved = resolveToolTargetPath(
    context.projectRoot,
    context.projectFolderId,
    targetInput || ".",
    skillPathOptions(context, true),
  );
  if ("error" in resolved) return errorOutcome(resolved.error);
  if (!fs.existsSync(resolved.absolutePath)) {
    return errorOutcome(
      `ディレクトリが見つかりません: ${resolved.relativePath}`,
    );
  }
  const stat = fs.statSync(resolved.absolutePath);
  if (!stat.isDirectory()) {
    return errorOutcome(`ディレクトリではありません: ${resolved.relativePath}`);
  }

  const entries = fs
    .readdirSync(resolved.absolutePath, { withFileTypes: true })
    .filter(
      (entry) =>
        !entry.name.startsWith(".") && !IGNORED_DIR_NAMES.has(entry.name),
    )
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

function matchGlobPath(
  regex: RegExp,
  relativeFromRoot: string,
  absolutePath: string,
  baseAbsolute: string,
  displayPath: string,
): boolean {
  const fromBase = path
    .relative(baseAbsolute, absolutePath)
    .replace(/\\/g, "/");
  return (
    regex.test(relativeFromRoot) ||
    regex.test(fromBase) ||
    regex.test(displayPath)
  );
}

function executeGlobFiles(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): ToolExecutionOutcome {
  const pattern = typeof input.pattern === "string" ? input.pattern.trim() : "";
  if (!pattern) return errorOutcome("pattern が空です");
  const pathProvided = typeof input.path === "string" && input.path.trim();
  const baseInput = pathProvided ? String(input.path).trim() : "";
  const pathOmitted = !baseInput || baseInput === ".";

  const zones = resolveDiscoveryWalkZones(context, baseInput || ".");
  if ("error" in zones) return errorOutcome(zones.error);

  const regex = globToRegExp(pattern);
  const matches: string[] = [];
  let truncated = false;

  const collectFromZones = (walkZones: DiscoveryWalkZone[]) => {
    for (const zone of walkZones) {
      walkFiles(zone.rootAbsolute, zone.baseAbsolute, (relative, absolute) => {
        const displayPath = zone.toDisplayPath(relative, absolute);
        if (
          matchGlobPath(
            regex,
            relative,
            absolute,
            zone.baseAbsolute,
            displayPath,
          )
        ) {
          matches.push(displayPath);
          if (matches.length >= SEARCH_RESULT_LIMIT) {
            truncated = true;
            return false;
          }
        }
        return true;
      });
      if (truncated) return;
    }
  };

  collectFromZones(zones);

  if (
    shouldFallbackToSkillZone(pathOmitted, matches.length, context) &&
    !zones.some((z) => z.rootAbsolute === context.skillDirAbsolute)
  ) {
    const skillZone = buildSkillWalkZone(context, context.skillDirAbsolute!);
    if (skillZone) {
      collectFromZones([skillZone]);
    }
  }

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
  const pathProvided = typeof input.path === "string" && input.path.trim();
  const baseInput = pathProvided ? String(input.path).trim() : "";
  const pathOmitted = !baseInput || baseInput === ".";

  const zones = resolveDiscoveryWalkZones(context, baseInput || ".");
  if ("error" in zones) return errorOutcome(zones.error);

  const needle = query.toLowerCase();
  const hits: Array<{ path: string; line: number; text: string }> = [];
  let truncated = false;

  const searchZones = (walkZones: DiscoveryWalkZone[]) => {
    for (const zone of walkZones) {
      walkFiles(zone.rootAbsolute, zone.baseAbsolute, (relative, absolute) => {
        let content: string;
        try {
          content = fs.readFileSync(absolute, "utf-8");
        } catch {
          return true;
        }
        const displayPath = zone.toDisplayPath(relative, absolute);
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
      if (truncated) return;
    }
  };

  searchZones(zones);

  if (
    shouldFallbackToSkillZone(pathOmitted, hits.length, context) &&
    !zones.some((z) => z.rootAbsolute === context.skillDirAbsolute)
  ) {
    const skillZone = buildSkillWalkZone(context, context.skillDirAbsolute!);
    if (skillZone) {
      searchZones([skillZone]);
    }
  }

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
    display: display(
      `${bytes} bytes`,
      `💾 書込: ${resolved.relativePath}（${bytes} bytes）`,
    ),
  };
}

function executeCopyFile(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): ToolExecutionOutcome {
  const fromPath = typeof input.from === "string" ? input.from : "";
  const toPath = typeof input.to === "string" ? input.to : "";
  if (!fromPath.trim() || !toPath.trim()) {
    return errorOutcome("from / to が空です");
  }

  const fromResolved = resolveToolTargetPath(
    context.projectRoot,
    context.projectFolderId,
    fromPath,
    skillPathOptions(context, true),
  );
  if ("error" in fromResolved) return errorOutcome(fromResolved.error);

  const toResolved = resolveToolTargetPath(
    context.projectRoot,
    context.projectFolderId,
    toPath,
    skillPathOptions(context, false),
  );
  if ("error" in toResolved) return errorOutcome(toResolved.error);
  if (toResolved.insideSkill) {
    return errorOutcome(
      `スキルディレクトリへのコピーはできません: ${toResolved.relativePath}`,
    );
  }

  if (!fs.existsSync(fromResolved.absolutePath)) {
    return errorOutcome(
      `ファイルが見つかりません: ${fromResolved.relativePath}`,
    );
  }
  const fromStat = fs.statSync(fromResolved.absolutePath);
  if (!fromStat.isFile()) {
    return errorOutcome(`ファイルではありません: ${fromResolved.relativePath}`);
  }

  fs.mkdirSync(path.dirname(toResolved.absolutePath), { recursive: true });
  fs.copyFileSync(fromResolved.absolutePath, toResolved.absolutePath);
  const bytes = fromStat.size;

  return {
    result: {
      from: fromResolved.relativePath,
      to: toResolved.relativePath,
      bytes,
    },
    display: display(
      `${bytes} bytes`,
      `📋 コピー: ${fromResolved.relativePath} → ${toResolved.relativePath}（${bytes} bytes）`,
    ),
  };
}

function executeReplaceInFile(
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
      `スキルディレクトリへの置換はできません: ${resolved.relativePath}`,
    );
  }
  if (!fs.existsSync(resolved.absolutePath)) {
    return errorOutcome(`ファイルが見つかりません: ${resolved.relativePath}`);
  }
  if (!fs.statSync(resolved.absolutePath).isFile()) {
    return errorOutcome(`ファイルではありません: ${resolved.relativePath}`);
  }

  let content = fs.readFileSync(resolved.absolutePath, "utf-8");
  let replacementsCount = 0;

  const map =
    input.replacements &&
    typeof input.replacements === "object" &&
    !Array.isArray(input.replacements)
      ? (input.replacements as Record<string, unknown>)
      : null;

  if (map) {
    for (const [key, value] of Object.entries(map)) {
      if (typeof value !== "string") continue;
      const placeholder =
        key.includes("{{") || key.includes("}}") ? key : `{{${key}}}`;
      if (!content.includes(placeholder)) continue;
      const parts = content.split(placeholder);
      replacementsCount += parts.length - 1;
      content = parts.join(value);
    }
  } else {
    const oldString =
      typeof input.old_string === "string" ? input.old_string : "";
    const newString =
      typeof input.new_string === "string" ? input.new_string : "";
    if (!oldString) {
      return errorOutcome("replacements または old_string が必要です");
    }
    if (!content.includes(oldString)) {
      return errorOutcome(
        `置換対象が見つかりません: ${oldString.slice(0, 80)}`,
      );
    }
    const parts = content.split(oldString);
    replacementsCount = parts.length - 1;
    content = parts.join(newString);
  }

  if (replacementsCount === 0) {
    return errorOutcome("置換対象が見つかりません（0 件）");
  }

  fs.writeFileSync(resolved.absolutePath, content, "utf-8");

  return {
    result: {
      path: resolved.relativePath,
      replacements: replacementsCount,
    },
    display: display(
      `${replacementsCount} 件`,
      `✏️ 置換: ${resolved.relativePath}（${replacementsCount} 件）`,
    ),
  };
}

function executeReplaceBetween(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): ToolExecutionOutcome {
  const inputPath = typeof input.path === "string" ? input.path : "";
  const startMarker =
    typeof input.start_marker === "string" ? input.start_marker : "";
  const endMarker =
    typeof input.end_marker === "string" ? input.end_marker : "";
  if (!inputPath.trim()) return errorOutcome("path が空です");
  if (!startMarker) return errorOutcome("start_marker が空です");
  if (!endMarker) return errorOutcome("end_marker が空です");

  const hasContent = typeof input.content === "string";
  const hasFromPath =
    typeof input.from_path === "string" && input.from_path.trim();
  if (hasContent && hasFromPath) {
    return errorOutcome("content と from_path は同時に指定できません");
  }
  if (!hasContent && !hasFromPath) {
    return errorOutcome("content または from_path のいずれか一方が必要です");
  }

  let insertContent: string;
  if (hasFromPath) {
    const fromResolved = resolveToolTargetPath(
      context.projectRoot,
      context.projectFolderId,
      String(input.from_path).trim(),
      skillPathOptions(context, true),
    );
    if ("error" in fromResolved) return errorOutcome(fromResolved.error);
    if (!fs.existsSync(fromResolved.absolutePath)) {
      return errorOutcome(
        `ファイルが見つかりません: ${fromResolved.relativePath}`,
      );
    }
    if (!fs.statSync(fromResolved.absolutePath).isFile()) {
      return errorOutcome(
        `ファイルではありません: ${fromResolved.relativePath}`,
      );
    }
    const raw = fs.readFileSync(fromResolved.absolutePath, "utf-8");
    if (raw.length > READ_CHAR_LIMIT) {
      return errorOutcome(
        `from_path のファイルが大きすぎます（上限 ${READ_CHAR_LIMIT} 文字）: ${fromResolved.relativePath}`,
      );
    }
    insertContent = raw;
  } else {
    insertContent = input.content as string;
  }

  const resolved = resolveToolTargetPath(
    context.projectRoot,
    context.projectFolderId,
    inputPath,
    skillPathOptions(context, false),
  );
  if ("error" in resolved) return errorOutcome(resolved.error);
  if (resolved.insideSkill) {
    return errorOutcome(
      `スキルディレクトリへの置換はできません: ${resolved.relativePath}`,
    );
  }
  if (!fs.existsSync(resolved.absolutePath)) {
    return errorOutcome(`ファイルが見つかりません: ${resolved.relativePath}`);
  }
  if (!fs.statSync(resolved.absolutePath).isFile()) {
    return errorOutcome(`ファイルではありません: ${resolved.relativePath}`);
  }

  const original = fs.readFileSync(resolved.absolutePath, "utf-8");
  const startIndex = original.indexOf(startMarker);
  if (startIndex < 0) {
    return errorOutcome(
      `start_marker が見つかりません: ${startMarker.slice(0, 80)}`,
    );
  }
  const afterStart = startIndex + startMarker.length;
  const endIndex = original.indexOf(endMarker, afterStart);
  if (endIndex < 0) {
    return errorOutcome(
      `end_marker が見つかりません: ${endMarker.slice(0, 80)}`,
    );
  }

  const next =
    original.slice(0, afterStart) + insertContent + original.slice(endIndex);
  fs.writeFileSync(resolved.absolutePath, next, "utf-8");
  const replacedChars = endIndex - afterStart;
  const insertedChars = insertContent.length;

  return {
    result: {
      path: resolved.relativePath,
      replacedChars,
      insertedChars,
      bytes: Buffer.byteLength(next, "utf-8"),
    },
    display: display(
      `${insertedChars} 文字`,
      `✏️ 区間置換: ${resolved.relativePath}（${replacedChars} → ${insertedChars} 文字）`,
    ),
  };
}

function executeAppendFile(
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
      `スキルディレクトリへの追記はできません: ${resolved.relativePath}`,
    );
  }

  const exists = fs.existsSync(resolved.absolutePath);
  if (exists && !fs.statSync(resolved.absolutePath).isFile()) {
    return errorOutcome(`ファイルではありません: ${resolved.relativePath}`);
  }

  fs.mkdirSync(path.dirname(resolved.absolutePath), { recursive: true });
  fs.appendFileSync(resolved.absolutePath, content, "utf-8");
  const bytes = Buffer.byteLength(content, "utf-8");

  return {
    result: {
      path: resolved.relativePath,
      bytes,
      created: !exists,
    },
    display: display(
      `${bytes} bytes`,
      `📎 追記: ${resolved.relativePath}（${bytes} bytes${exists ? "" : "・新規"}）`,
    ),
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

function projectDirAbsolute(context: ToolExecutionContext): string {
  return path.resolve(
    context.projectRoot,
    WORKSPACE_DIR_NAME,
    context.projectFolderId,
  );
}

export const SCRIPT_TOOL_NAMES = new Set(["run_script", "run_skill_script"]);

export function isScriptToolName(name: string): boolean {
  return SCRIPT_TOOL_NAMES.has(name);
}

/** run_script の code として受理する別名キー（モデルの入力ゆらぎ救済） */
const RUN_SCRIPT_CODE_ALIASES = ["script", "content", "source", "js"] as const;

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export type NormalizedScriptToolCall = {
  name: string;
  input: Record<string, unknown>;
};

/**
 * スクリプト系ツール呼び出しの入力ゆらぎを救済する（broken 判定・確認・実行より前に適用）。
 * - run_script: code が別名キー（script / content / source / js）にある場合は code へ移す
 * - run_script: code が無く script_path だけがある場合は run_skill_script として扱う
 * - run_skill_script: script_path が無く code 相当がある場合は run_script として扱う
 */
export function normalizeScriptToolCall(
  name: string,
  input: Record<string, unknown>,
): NormalizedScriptToolCall {
  if (!isScriptToolName(name)) return { name, input };

  const code =
    nonEmptyString(input.code) ??
    RUN_SCRIPT_CODE_ALIASES.reduce<string | null>(
      (found, alias) => found ?? nonEmptyString(input[alias]),
      null,
    );
  const scriptPath = nonEmptyString(input.script_path);

  if (name === "run_script") {
    if (code) {
      return code === input.code
        ? { name, input }
        : { name, input: { ...input, code } };
    }
    if (scriptPath) {
      return { name: "run_skill_script", input };
    }
    return { name, input };
  }

  // run_skill_script
  if (scriptPath) return { name, input };
  if (code) {
    return { name: "run_script", input: { ...input, code } };
  }
  return { name, input };
}

const SKILL_SCRIPT_ZONE_ERROR =
  "run_skill_script は実行中スキルの scripts/ 配下のスクリプトのみ実行できます";

type ResolvedSkillScript = {
  absolutePath: string;
  relativePath: string;
};

/** run_skill_script の script_path を検証・解決する（実行中スキルの scripts/ 配下のみ） */
export function resolveSkillScriptPath(
  context: ToolExecutionContext,
  scriptPathInput: string,
): ResolvedSkillScript | { error: string } {
  const skillId = context.skillId?.trim();
  if (!skillId || !context.skillDirAbsolute?.trim()) {
    return {
      error: "実行中スキルがないため run_skill_script は使用できません",
    };
  }
  const resolved = resolveToolTargetPath(
    context.projectRoot,
    context.projectFolderId,
    scriptPathInput,
    skillPathOptions(context, true),
  );
  if ("error" in resolved) return { error: resolved.error };
  if (
    !resolved.insideSkill ||
    !resolved.relativePath.startsWith(`skill/${skillId}/scripts/`)
  ) {
    // scripts/ 相対で指定されたがスキル側に実在しない場合は「見つからない」として返す
    const normalizedInput = scriptPathInput
      .replace(/\\/g, "/")
      .replace(/^\.\//, "");
    if (!resolved.insideSkill && normalizedInput.startsWith("scripts/")) {
      return {
        error: `ファイルが見つかりません: skill/${skillId}/${normalizedInput}`,
      };
    }
    return { error: `${SKILL_SCRIPT_ZONE_ERROR}: ${resolved.relativePath}` };
  }
  if (!fs.existsSync(resolved.absolutePath)) {
    return { error: `ファイルが見つかりません: ${resolved.relativePath}` };
  }
  if (!fs.statSync(resolved.absolutePath).isFile()) {
    return { error: `ファイルではありません: ${resolved.relativePath}` };
  }
  return {
    absolutePath: resolved.absolutePath,
    relativePath: resolved.relativePath,
  };
}

function scriptFailureOutcome(result: {
  error: string;
  stderr?: string;
  exitCode?: number | null;
  timedOut?: boolean;
}): ToolExecutionOutcome {
  return {
    result: {
      error: result.error,
      ...(result.stderr ? { stderr: result.stderr } : {}),
      ...(typeof result.exitCode === "number"
        ? { exitCode: result.exitCode }
        : {}),
      ...(result.timedOut ? { timedOut: true } : {}),
      recoverable: true,
      guidance:
        "エラー内容をもとにスクリプトを修正して再実行してください。成果物の本文を文字列リテラルで埋め込まず、ディスク上のファイルを読んで組み立てること。",
    },
    display: display("error", `✗ ${result.error}`),
  };
}

function executeRunScriptWritesTargets(
  context: ToolExecutionContext,
  writesInput: unknown,
): { writes: string[] } | { error: string } {
  const raw = Array.isArray(writesInput) ? writesInput : [];
  const writes: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string" || !entry.trim()) continue;
    const resolved = resolveToolTargetPath(
      context.projectRoot,
      context.projectFolderId,
      entry,
      skillPathOptions(context, false),
    );
    if ("error" in resolved) return { error: resolved.error };
    if (!resolved.insideProject) {
      return {
        error: `writes はプロジェクト内のパスのみ宣言できます: ${resolved.relativePath}`,
      };
    }
    writes.push(resolved.relativePath);
  }
  return { writes };
}

async function executeRunScript(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): Promise<ToolExecutionOutcome> {
  const code = typeof input.code === "string" ? input.code : "";
  if (!code.trim()) return errorOutcome("code が空です");

  const writesResult = executeRunScriptWritesTargets(context, input.writes);
  if ("error" in writesResult) return errorOutcome(writesResult.error);

  const runResult = await runScriptInSandbox(
    { kind: "code", code },
    {
      projectDirAbsolute: projectDirAbsolute(context),
      skillDirAbsolute: context.skillDirAbsolute,
    },
  );
  if (!runResult.ok) return scriptFailureOutcome(runResult);

  return {
    result: {
      writes: writesResult.writes,
      stdout: runResult.stdout,
      durationMs: runResult.durationMs,
    },
    display: display(
      `${runResult.durationMs}ms`,
      `🧩 スクリプト実行: ${writesResult.writes.join(", ") || "(書込宣言なし)"}（${runResult.durationMs}ms）`,
    ),
  };
}

async function executeRunSkillScript(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): Promise<ToolExecutionOutcome> {
  const scriptPathInput =
    typeof input.script_path === "string" ? input.script_path : "";
  if (!scriptPathInput.trim()) return errorOutcome("script_path が空です");

  const resolved = resolveSkillScriptPath(context, scriptPathInput);
  if ("error" in resolved) return errorOutcome(resolved.error);

  const args = Array.isArray(input.args)
    ? input.args.filter((arg): arg is string => typeof arg === "string")
    : [];

  const runResult = await runScriptInSandbox(
    { kind: "file", scriptPathAbsolute: resolved.absolutePath, args },
    {
      projectDirAbsolute: projectDirAbsolute(context),
      skillDirAbsolute: context.skillDirAbsolute,
    },
  );
  if (!runResult.ok) return scriptFailureOutcome(runResult);

  return {
    result: {
      script: resolved.relativePath,
      stdout: runResult.stdout,
      durationMs: runResult.durationMs,
    },
    display: display(
      `${runResult.durationMs}ms`,
      `🧩 スキルスクリプト実行: ${resolved.relativePath}（${runResult.durationMs}ms）`,
    ),
  };
}

/** 劣化契約の返却（error キーを持たせず、安全停止カウンタに乗せない） */
function searchUnavailableOutcome(notice: string): ToolExecutionOutcome {
  return {
    result: { unavailable: true, notice },
    display: display("利用不可", `🔎 web 検索は利用できません`),
  };
}

async function executeWebSearch(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): Promise<ToolExecutionOutcome> {
  const query = typeof input.query === "string" ? input.query.trim() : "";
  if (!query) return errorOutcome("query が空です");

  const search = context.search;
  if (!search || !search.provider) {
    if (search) search.session.unavailable = true;
    return searchUnavailableOutcome(SEARCH_UNCONFIGURED_NOTICE);
  }
  if (search.session.unavailable) {
    return searchUnavailableOutcome(SEARCH_UNAVAILABLE_NOTICE);
  }

  const outcome = await search.provider.search(query);
  if (!outcome.ok) {
    // 最初の失敗でセッション内の検索を閉じる（サーキットブレーカー）
    search.session.unavailable = true;
    return {
      result: {
        unavailable: true,
        notice: `${SEARCH_UNAVAILABLE_NOTICE}（詳細: ${outcome.error}）`,
      },
      display: display("失敗", `🔎 web 検索に失敗: ${outcome.error}`),
    };
  }

  return {
    result: { query, results: outcome.results },
    display: display(
      `${outcome.results.length} 件`,
      `🔎 web 検索: ${query} — ${outcome.results.length} 件`,
    ),
  };
}

/**
 * スクリプト系ツールの事前検査（ユーザー確認ダイアログより先に行う）。
 * - run_script: 構文チェック。壊れたコードの承認をユーザーに求めない
 * - run_skill_script: スクリプトの存在・ゾーン検査。存在しないスクリプトの承認を求めない
 * 問題がなければ null を返し、確認ゲートへ進む。
 */
export async function preflightScriptToolCall(
  name: string,
  input: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionOutcome | null> {
  if (name === "run_script") {
    const code = typeof input.code === "string" ? input.code : "";
    if (!code.trim()) return null; // broken tool_use 経路で処理される
    const syntax = await checkScriptSyntax(code);
    if (!syntax.ok) {
      return {
        result: {
          error: `スクリプトの構文エラー: ${syntax.error}`,
          recoverable: true,
          guidance: "構文エラーを修正したスクリプトで再実行してください。",
        },
        display: display("error", "✗ スクリプトの構文エラー"),
      };
    }
    return null;
  }
  if (name === "run_skill_script") {
    const scriptPathInput =
      typeof input.script_path === "string" ? input.script_path : "";
    if (!scriptPathInput.trim()) return null;
    const resolved = resolveSkillScriptPath(context, scriptPathInput);
    if ("error" in resolved) return errorOutcome(resolved.error);
    return null;
  }
  return null;
}

/**
 * 削除・コマンド実行はツールとして存在させない（安全境界）。
 * モデルがこれらの名前でツール呼び出しを試みた場合のフォールバック案内。
 */
function buildBlockedOutcome(
  name: string,
  input: Record<string, unknown>,
): ToolExecutionOutcome {
  if (isLikelySubagentToolName(name)) {
    return {
      result: {
        blocked: true,
        reason: "EBEX はサブエージェントの起動に対応していません",
        guidance:
          "同一セッション内で自ら役割を順に実行してください。サブエージェントは起動しません。",
      },
      display: display("blocked", `🚫 サブエージェント起動をブロック: ${name}`),
    };
  }

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
        reason:
          "EBEX はセキュリティ上の理由から任意のシェルコマンド実行を許可していません（許可されるのはサンドボックス化された Node スクリプト実行のみ）",
        guidance:
          "ファイルの変換・生成が目的なら run_script（Node.js / CommonJS）を使用してください。fs 読取はプロジェクトと実行中スキル、書込はプロジェクト内のみです。",
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
    display: display(
      "blocked",
      `🚫 削除をブロック${target ? `: ${target}` : ""}`,
    ),
  };
}

const BLOCKED_TOOL_NAME_HINTS = [
  "delete",
  "remove",
  "rm",
  "unlink",
  "exec",
  "run_command",
  "shell",
  "script",
];

export function isLikelyBlockedToolName(name: string): boolean {
  // run_script / run_skill_script は登録済みツール（"script" ヒントに先行して除外）
  if (isRegisteredToolName(name)) return false;
  if (isLikelySubagentToolName(name)) return true;
  const lower = name.toLowerCase();
  return BLOCKED_TOOL_NAME_HINTS.some((hint) => lower.includes(hint));
}

export async function executeRegisteredTool(
  name: string,
  input: Record<string, unknown> = {},
  context?: ToolExecutionContext,
): Promise<ToolExecutionOutcome> {
  if (!context) {
    return errorOutcome(
      `プロジェクトフォルダが未選択のため tool を実行できません: ${name}`,
    );
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
    case "copy_file":
      return executeCopyFile(context, input);
    case "replace_in_file":
      return executeReplaceInFile(context, input);
    case "replace_between":
      return executeReplaceBetween(context, input);
    case "append_file":
      return executeAppendFile(context, input);
    case "mkdir":
      return executeMkdir(context, input);
    case "run_script":
      return executeRunScript(context, input);
    case "run_skill_script":
      return executeRunSkillScript(context, input);
    case "web_search":
      return executeWebSearch(context, input);
    default:
      if (isLikelyBlockedToolName(name)) {
        return buildBlockedOutcome(name, input);
      }
      return errorOutcome(`未知の tool: ${name}`);
  }
}
