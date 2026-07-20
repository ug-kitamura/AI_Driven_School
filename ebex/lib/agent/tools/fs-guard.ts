import fs from "node:fs";
import path from "node:path";
import { ALLOWED_PREFIX, WORKSPACE_DIR_NAME } from "@/lib/workspace-constants";
import { isPathInsideProjectFolder } from "@/lib/agent/skill-io-boundary";

export type ToolPathZone = "project" | "skill";

export type ResolvedToolPath = {
  /** 実ファイルシステム上の絶対パス */
  absolutePath: string;
  /** 表示用パス（`workspace/...` または `skill/<id>/...`） */
  relativePath: string;
  /** プロジェクトフォルダ（`workspace/<projectFolderId>/`）配下かどうか */
  insideProject: boolean;
  /** 実行中スキルのディレクトリ配下かどうか */
  insideSkill: boolean;
  zone: ToolPathZone;
};

export type ToolPathError = { error: string };

export type ResolveToolPathOptions = {
  skillId?: string;
  skillDirAbsolute?: string;
  /**
   * true のとき、相対パスがスキルディレクトリに存在すればスキル側を優先する。
   * 読取・発見ツール向け。書込では false（プロジェクト側へ解決）。
   */
  preferSkillIfExists?: boolean;
};

/** ホスト非依存の論理プレフィックス（表示・入力の正本） */
export const SKILL_LOGICAL_PREFIX = "skill/";
/** 旧形式入力の互換（実行中スキル id のみ受理） */
export const SKILL_LEGACY_PREFIX = ".claude/skills/";

function isUnsafePath(raw: string): boolean {
  return (
    raw.includes("..") ||
    /^[a-zA-Z]:\//.test(raw) ||
    raw.startsWith("/") ||
    raw.startsWith("~")
  );
}

function resolveInsideSkillDir(
  skillId: string,
  skillDirAbsolute: string,
  relativeWithinSkill: string,
): ResolvedToolPath | ToolPathError {
  const rel = relativeWithinSkill.replace(/\\/g, "/").replace(/^\/+/, "");
  if (rel.includes("..")) {
    return { error: `不正なパスです: ${relativeWithinSkill}` };
  }

  const absolutePath = rel
    ? path.resolve(skillDirAbsolute, rel)
    : path.resolve(skillDirAbsolute);

  if (
    absolutePath !== skillDirAbsolute &&
    !absolutePath.startsWith(skillDirAbsolute + path.sep)
  ) {
    return { error: `不正なパスです: ${relativeWithinSkill}` };
  }

  const displayRel = rel
    ? `${SKILL_LOGICAL_PREFIX}${skillId}/${rel}`
    : `${SKILL_LOGICAL_PREFIX}${skillId}`;
  return {
    absolutePath,
    relativePath: displayRel,
    insideProject: false,
    insideSkill: true,
    zone: "skill",
  };
}

/**
 * 明示スキルパス（論理 `skill/<id>/...` または旧 `.claude/skills/<id>/...`）を解釈する。
 * 実行中スキル以外は拒否。該当しなければ null。
 */
function tryResolveExplicitSkillPath(
  raw: string,
  skillId: string,
  skillDir: string,
): ResolvedToolPath | ToolPathError | null {
  for (const prefix of [SKILL_LOGICAL_PREFIX, SKILL_LEGACY_PREFIX] as const) {
    const skillRootPrefix = `${prefix}${skillId}`;
    if (raw === skillRootPrefix || raw.startsWith(`${skillRootPrefix}/`)) {
      const within = raw.slice(skillRootPrefix.length).replace(/^\//, "");
      return resolveInsideSkillDir(skillId, skillDir, within);
    }
    // 他スキルへの明示パスは拒否（確認ダイアログにも回さない）
    if (raw.startsWith(prefix)) {
      return {
        error: `実行中スキル（${skillId}）以外のスキルファイルは参照できません: ${raw}`,
      };
    }
  }
  return null;
}

function tryResolveSkillPath(
  inputPath: string,
  options: ResolveToolPathOptions,
): ResolvedToolPath | ToolPathError | null {
  const skillId = options.skillId?.trim();
  const skillDir = options.skillDirAbsolute?.trim();
  if (!skillId || !skillDir) return null;

  const raw = inputPath.replace(/\\/g, "/").trim();

  const explicit = tryResolveExplicitSkillPath(raw, skillId, skillDir);
  if (explicit) return explicit;

  if (!options.preferSkillIfExists) return null;
  if (raw.startsWith(ALLOWED_PREFIX)) return null;
  // プロジェクト直下の一覧・検索を奪わない
  if (raw === "." || raw === "") return null;

  const candidate = path.resolve(skillDir, raw);
  if (candidate !== skillDir && !candidate.startsWith(skillDir + path.sep)) {
    return null;
  }
  if (!fs.existsSync(candidate)) return null;

  return resolveInsideSkillDir(skillId, skillDir, raw);
}

/**
 * ツール呼び出しが渡すパス文字列を実パスへ解決する。
 *
 * 対応する入力形式:
 * - プロジェクト相対（例: `output/minutes.md`) → `workspace/<projectFolderId>/...`
 * - `workspace/...` 形式 → `workspace/` 配下として解釈
 * - `skill/<実行中skillId>/...` → skillDirAbsolute（読取許可ゾーン）
 * - `.claude/skills/<実行中skillId>/...` → 互換マップ（同上）
 * - 相対パスがスキル側に実在する場合（preferSkillIfExists）→ スキル側を優先
 */
export function resolveToolTargetPath(
  projectRoot: string,
  projectFolderId: string,
  inputPath: string,
  options: ResolveToolPathOptions = {},
): ResolvedToolPath | ToolPathError {
  const raw = inputPath.replace(/\\/g, "/").trim();
  if (!raw) return { error: "path が空です" };
  if (isUnsafePath(raw)) {
    if (raw.includes("..")) return { error: `不正なパスです: ${inputPath}` };
    return {
      error: `EBEX の workspace 配下または実行中スキル配下のみ操作できます: ${inputPath}`,
    };
  }

  const skillResolved = tryResolveSkillPath(raw, options);
  if (skillResolved) return skillResolved;

  const workspaceDir = path.resolve(projectRoot, WORKSPACE_DIR_NAME);
  const workspaceRelative = raw.startsWith(ALLOWED_PREFIX)
    ? raw.slice(ALLOWED_PREFIX.length)
    : `${projectFolderId}/${raw}`;

  if (!workspaceRelative || workspaceRelative.endsWith("/")) {
    return { error: `不正なパスです: ${inputPath}` };
  }

  const absolutePath = path.resolve(workspaceDir, workspaceRelative);
  if (
    absolutePath !== workspaceDir &&
    !absolutePath.startsWith(workspaceDir + path.sep)
  ) {
    return { error: `不正なパスです: ${inputPath}` };
  }

  const relativePath = `${ALLOWED_PREFIX}${workspaceRelative}`;
  const insideProject = isPathInsideProjectFolder(
    relativePath,
    projectFolderId,
  );

  // モデルが `workspace/<folder>/references/...` と書いた場合でも、
  // プロジェクト側に無くスキル側にあればスキルを優先（読取時のみ）
  if (
    options.preferSkillIfExists &&
    insideProject &&
    options.skillId &&
    options.skillDirAbsolute &&
    !fs.existsSync(absolutePath)
  ) {
    const prefix = `${projectFolderId}/`;
    if (workspaceRelative.startsWith(prefix)) {
      const withinProject = workspaceRelative.slice(prefix.length);
      if (withinProject && withinProject !== ".") {
        const skillFallback = tryResolveSkillPath(withinProject, {
          ...options,
          preferSkillIfExists: true,
        });
        if (
          skillFallback &&
          !("error" in skillFallback) &&
          skillFallback.insideSkill
        ) {
          return skillFallback;
        }
      }
    }
  }

  return {
    absolutePath,
    relativePath,
    insideProject,
    insideSkill: false,
    zone: "project",
  };
}
