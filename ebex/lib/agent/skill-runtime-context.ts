import { SUBAGENT_FALLBACK_MODEL_HINT } from "@/lib/agent/subagent-fallback";
import { skillHasScriptsDir } from "@/lib/agent/tools/registry";

export type SkillRuntimeFocus = {
  projectFolderId: string;
  /** プロジェクトフォルダ根からの相対パス（例: sub/notes.md） */
  currentFileRelativePath?: string | null;
  /** 実行中スキル ID（読取許可ゾーンの案内に使う） */
  skillId?: string;
  /** 実行中スキルの絶対ディレクトリ */
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

  const lines = [
    "## EBEX ランタイム（場の約束）",
    "",
    "スキル本文の指示を尊重すること。以下はツール側が添える薄い場の説明である。",
    "",
    "### Scope",
    `既定の舞台はプロジェクトフォルダ \`${project}\`（\`workspace/${project}/\`）である。`,
    ...(skillId
      ? [
          `実行中スキルの参照ファイル（\`SKILL.md\` と同じフォルダ配下、例: \`references/*\`）は確認なしで発見（list/glob/search）および読取できる。`,
          `スキル本文の相対パス（例: \`references/purpose.md\`）はスキル側を優先して読むこと。成果物の書込先は \`workspace/${project}/\` 配下である。`,
          `大きな成果物は本文を tool 引数に載せず、成果物の形で経路を選ぶこと。(1) 額縁テンプレートがスキルにあるなら \`copy_file\` でプロジェクト内へコピーし、\`replace_in_file\` / \`replace_between\`（大きな本文は \`from_path\`）で 1 回数 KB の断片を差し込む（必要なら \`append_file\` で partial を積む）。(2) モデルが新たに創作する長文なら \`generate_and_write\`（材料をファイルへ書き出して \`context_paths\` で渡し、\`sections\` で分割）。(3) 大量レコードの機械変換なら \`run_script\`${skillHasScriptsDir(focus.skillDirAbsolute ?? undefined) ? "（スキルの `scripts/` にスクリプトがあれば `run_skill_script`）" : ""}。`,
          "額縁や模範回答など大きな参照ファイルは、差し込み位置の把握に必要な範囲を超えて読み込まないこと。子生成へ渡す材料は `context_paths` を使う。",
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
