export type SkillRuntimeFocus = {
  projectFolderId: string;
  /** プロジェクトフォルダ根からの相対パス（例: sub/notes.md） */
  currentFileRelativePath?: string | null;
};

/**
 * スキル本文を触らず、場の約束だけを添える短い説明を組み立てる。
 */
export function buildSkillRuntimeContext(focus: SkillRuntimeFocus): string {
  const project = focus.projectFolderId.trim() || "(未選択)";
  const current = focus.currentFileRelativePath?.trim();
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
