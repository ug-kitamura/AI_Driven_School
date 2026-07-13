import { SUBAGENT_FALLBACK_MODEL_HINT } from "@/lib/agent/subagent-fallback";
import { skillHasBaseHtml } from "@/lib/agent/tools/template-write-recovery";

export type SkillRuntimeFocus = {
  projectFolderId: string;
  /** プロジェクトフォルダ根からの相対パス（例: sub/notes.md） */
  currentFileRelativePath?: string | null;
  /** 実行中スキル ID（読取許可ゾーンの案内に使う） */
  skillId?: string;
  /** 実行中スキルの絶対ディレクトリ（テンプレ強制の判定に使う） */
  skillDirAbsolute?: string | null;
  /** スキル本文に「サブエージェント」が含まれるとき true */
  mentionsSubagent?: boolean;
};

/**
 * スキル本文を触らず、場の約束だけを添える短い説明を組み立てる。
 */
export function buildSkillRuntimeContext(focus: SkillRuntimeFocus): string {
  const project = focus.projectFolderId.trim() || "(未選択)";
  const current = focus.currentFileRelativePath?.trim();
  const skillId = focus.skillId?.trim();
  const sameFolder = current?.includes("/")
    ? current.slice(0, current.lastIndexOf("/"))
    : current
      ? "."
      : ".";

  const hasBaseHtml = Boolean(
    focus.skillDirAbsolute &&
      skillHasBaseHtml(focus.skillDirAbsolute),
  );

  const lines = [
    "## EBEX ランタイム（場の約束）",
    "",
    "スキル本文の指示を尊重すること。以下はツール側が添える薄い場の説明である。",
    "",
    "### Scope",
    `既定の舞台はプロジェクトフォルダ \`${project}\`（\`workspace/${project}/\`）である。`,
    ...(skillId
      ? [
          `実行中スキルのファイル（\`SKILL.md\` と同じフォルダ配下、例: \`references/*\`）は確認なしで読み取れる。`,
          `スキル本文の相対パス（例: \`references/purpose.md\`）はスキル側を優先して読むこと。成果物の書込先は \`workspace/${project}/\` 配下である。`,
        ]
      : []),
    "",
    "### Focus",
    current
      ? `入力が明示されていないときの第一の焦点は、いま開いているファイル \`${current}\` である。`
      : "入力が明示されていないとき、開いているファイルは無い。プロジェクト内の文脈から必要なら尋ねること。",
    `出力が明示されていないときの第一の焦点は、開いているファイルと同じフォルダ（\`${sameFolder === "." ? "プロジェクト直下" : sameFolder}\`）、次点はプロジェクトフォルダ直下である。`,
    "",
    "### Boundary",
    "プロジェクトフォルダ外のパスに触れるときは、推測で進めずユーザ確認を前提とすること。",
    "場の中で出力候補が複数あるときは勝手に確定せず、候補を示して選ばせること。",
    ...(hasBaseHtml
      ? [
          "",
          "### HTML template outputs（必須）",
          "このスキルには `references/base.html` がある。`.html` 成果物を作るときは次を **必ず** 守ること。",
          "1. `write_file` で HTML 全文を書いてはならない（ランタイムが初回のみテンプレートコピーへ変換する）。",
          "2. 明示的に行うなら `copy_file` で `references/base.html` を出力先へコピーする。",
          "3. 続けて `replace_in_file` だけで `{{PLACEHOLDER}}` を埋める（複数プレースホルダはできるだけ1回の replacements にまとめる）。",
          "4. コピー後に同じ HTML へ `write_file` を繰り返してはならない。",
        ]
      : []),
    ...(focus.mentionsSubagent
      ? ["", "### Subagent", SUBAGENT_FALLBACK_MODEL_HINT]
      : []),
  ];

  return lines.join("\n");
}

export function mergeSkillSystemPrompt(
  skillPrompt: string,
  runtimeContext: string | null | undefined,
): string {
  const runtime = runtimeContext?.trim();
  if (!runtime) return skillPrompt;
  return `${runtime}\n\n---\n\n${skillPrompt}`;
}
