import fs from "node:fs";
import path from "node:path";
import { parseWorkScope, workScopeBaseDir } from "@/lib/work-scope";
import { LESSON_CONTENTS_FILENAME } from "@/lib/lesson-paths";

export type ToolPathZone = "project" | "skill" | "contents";

export type ResolvedToolPath = {
  /** 実ファイルシステム上の絶対パス */
  absolutePath: string;
  /** 表示用パス（`contents/...`・`contents-plan/...`・`skill/<id>/...`） */
  relativePath: string;
  /**
   * 書込許可ゾーン内かどうか（dx は 2 ルート: `contents/` 配下または `contents-plan/` 配下）。
   * EBEX ではプロジェクトフォルダ単一ルートの意味だったフラグを、書込可否の意味のまま
   * 両ゾーンに立てる（下流の書込判定・確認ゲートを変えないため）。
   */
  insideProject: boolean;
  /** 実行中スキルのディレクトリ配下かどうか */
  insideSkill: boolean;
  zone: ToolPathZone;
};

export type ToolPathError = { error: string };

/**
 * 正本ツリーの**構造**を壊す書込を拒否する。
 *
 * ローダーは `contents/` 直下のディレクトリをシリーズ、シリーズ直下のディレクトリを
 * コースとして無条件に解釈する（`listLessonFolderNames` と違い `contents.md` の存在を
 * 要求しない）。そのため中間生成物のディレクトリがそこに生まれると、幻のシリーズ・
 * 幻のコースとして画面に現れ、`.meta.json` まで書き込まれてしまう。
 *
 * コース直下の新規ディレクトリは「新しいレッスン」として正当なので許可する。
 * レッスンフォルダ配下はローダーが走査しないため構造上は無害であり、ここでは拒否しない。
 *
 * 「`contents/` に置いてよい成果物はレッスン本文だけ」という**方針**レベルの制限は、
 * frontmatter 検査や構造分類とあわせて後続 change `contents-write-gate` が担う。
 * 本関数は構造の防御に限る。
 *
 * 呼ぶのは書込系ツールのみ。読取は制限しない。
 */
export function checkContentsWriteShape(
  resolved: ResolvedToolPath,
): ToolPathError | null {
  if (resolved.zone !== "contents") return null;

  const parentDir = path.dirname(resolved.absolutePath);
  // 既存ディレクトリへのファイル書込は構造を壊さない
  if (fs.existsSync(parentDir)) return null;

  // 新しいディレクトリが生まれる。その深さがシリーズ・コースと誤解釈されるかを見る。
  // contents/<A>/<B>/... のうち、<A>（シリーズ）と <B>（コース）の位置だけが危険。
  const segments = resolved.relativePath.split("/").slice(1).filter(Boolean);
  // segments.length は末尾のファイル名を含む。
  // 2 = contents/<新A>/file      → <新A> が幻のシリーズ
  // 3 = contents/<A>/<新B>/file  → <新B> が幻のコース
  if (segments.length >= 4) return null;

  const kind = segments.length <= 2 ? "シリーズ" : "コース";
  return {
    error:
      `正本ツリー（contents/）のこの位置に新しいフォルダを作ると、幻の${kind}として` +
      `画面に現れます。中間生成物は contents-plan/ 配下へ書いてください: ${resolved.relativePath}`,
  };
}

export type ResolveToolPathOptions = {
  skillId?: string;
  skillDirAbsolute?: string;
  /**
   * true のとき、相対パスがスキルディレクトリに存在すればスキル側を優先する。
   * 読取・発見ツール向け。書込では false（プロジェクト側へ解決）。
   */
  preferSkillIfExists?: boolean;
  /**
   * 書込ツールから呼ぶときに true。正本ツリーの構造を壊す書込
   * （`contents/` 配下への新規フォルダ作成）を拒否する。
   */
  forWrite?: boolean;
};

/** ホスト非依存の論理プレフィックス（表示・入力の正本） */
export const SKILL_LOGICAL_PREFIX = "skill/";
/** 旧形式入力の互換（実行中スキル id のみ受理） */
export const SKILL_LEGACY_PREFIX = ".claude/skills/";
/** dx の書込ルート 1: 正本ツリー（レッスン草稿の着地） */
export const CONTENTS_DIR_NAME = "contents";
export const CONTENTS_PREFIX = `${CONTENTS_DIR_NAME}/`;
/** dx の書込ルート 2: 作業ツリー（計画書・中間生成物） */
export const CONTENTS_PLAN_DIR_NAME = "contents-plan";
export const CONTENTS_PLAN_PREFIX = `${CONTENTS_PLAN_DIR_NAME}/`;

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
  if (raw.startsWith(CONTENTS_PREFIX) || raw.startsWith(CONTENTS_PLAN_PREFIX)) {
    return null;
  }
  // 作業フォルダ直下の一覧・検索を奪わない
  if (raw === "." || raw === "") return null;

  const candidate = path.resolve(skillDir, raw);
  if (candidate !== skillDir && !candidate.startsWith(skillDir + path.sep)) {
    return null;
  }
  if (!fs.existsSync(candidate)) return null;

  return resolveInsideSkillDir(skillId, skillDir, raw);
}

function resolveUnderRoot(
  projectRoot: string,
  rootDirName: string,
  raw: string,
  zone: ToolPathZone,
  inputPath: string,
): ResolvedToolPath | ToolPathError {
  const rootDir = path.resolve(projectRoot, rootDirName);
  const absolutePath = path.resolve(projectRoot, raw);
  if (
    absolutePath !== rootDir &&
    !absolutePath.startsWith(rootDir + path.sep)
  ) {
    return { error: `不正なパスです: ${inputPath}` };
  }
  if (raw.endsWith("/")) {
    return { error: `不正なパスです: ${inputPath}` };
  }
  return {
    absolutePath,
    relativePath: raw,
    insideProject: true,
    insideSkill: false,
    zone,
  };
}

/**
 * ツール呼び出しが渡すパス文字列を実パスへ解決する。
 *
 * 対応する入力形式:
 * - 明示プレフィックスなしの相対（例: `contents.md`) → 作業フォルダ配下
 *   （フォーカス中のコンテンツフォルダ。レッスン → コース → シリーズ → `contents/`）
 * - `contents/...` → 正本ツリー配下として解釈
 * - `contents-plan/...` → 作業ツリー配下として解釈（計画書・中間生成物）
 * - `skill/<実行中skillId>/...` → skillDirAbsolute（読取許可ゾーン）
 * - `.claude/skills/<実行中skillId>/...` → 互換マップ（同上）
 * - 相対パスがスキル側に実在する場合（preferSkillIfExists）→ スキル側を優先
 *
 * @param workScopeKey `serializeWorkScope` の出力。空文字は `contents/` 直下を表す。
 */
export function resolveToolTargetPath(
  projectRoot: string,
  workScopeKey: string,
  inputPath: string,
  options: ResolveToolPathOptions = {},
): ResolvedToolPath | ToolPathError {
  const raw = inputPath.replace(/\\/g, "/").trim();
  if (!raw) return { error: "path が空です" };
  if (isUnsafePath(raw)) {
    if (raw.includes("..")) return { error: `不正なパスです: ${inputPath}` };
    return {
      error: `contents/ 配下・contents-plan/ 配下・実行中スキル配下のみ操作できます: ${inputPath}`,
    };
  }

  const skillResolved = tryResolveSkillPath(raw, options);
  if (skillResolved) return skillResolved;

  // 書込ルート 2: 作業ツリー（計画書・中間生成物）。明示プレフィックスでのみ届く。
  if (raw === CONTENTS_PLAN_DIR_NAME || raw.startsWith(CONTENTS_PLAN_PREFIX)) {
    return resolveUnderRoot(
      projectRoot,
      CONTENTS_PLAN_DIR_NAME,
      raw,
      "project",
      inputPath,
    );
  }

  // 書込ルート 1: 正本ツリー。レッスン草稿の直接着地に使う。
  if (raw === CONTENTS_DIR_NAME || raw.startsWith(CONTENTS_PREFIX)) {
    const r = resolveUnderRoot(
      projectRoot,
      CONTENTS_DIR_NAME,
      raw,
      "contents",
      inputPath,
    );
    if ("error" in r) return r;
    const shape = options.forWrite ? checkContentsWriteShape(r) : null;
    return shape ?? r;
  }

  // 明示プレフィックスなし → 作業フォルダ（フォーカス中のコンテンツフォルダ）相対
  const scope = parseWorkScope(workScopeKey);
  if (!scope) return { error: `不正なパスです: ${inputPath}` };
  const baseRelative = workScopeBaseDir(scope);
  const combined = `${baseRelative}/${raw}`;

  const resolved = resolveUnderRoot(
    projectRoot,
    CONTENTS_DIR_NAME,
    combined,
    "contents",
    inputPath,
  );
  if ("error" in resolved) return resolved;

  // モデルが素の相対パスを書いた場合でも、
  // 作業フォルダ側に無くスキル側にあればスキルを優先（読取時のみ）
  const shape = options.forWrite ? checkContentsWriteShape(resolved) : null;
  if (shape) return shape;

  if (
    options.preferSkillIfExists &&
    options.skillId &&
    options.skillDirAbsolute &&
    !fs.existsSync(resolved.absolutePath)
  ) {
    const skillFallback = tryResolveSkillPath(raw, {
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

  return resolved;
}
