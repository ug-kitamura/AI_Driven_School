import { ALLOWED_PREFIX } from "@/lib/workspace-constants";

export type OutputDestinationChoice = "same-folder" | "project-root";

export type OutputDestinationOption = {
  id: OutputDestinationChoice;
  label: string;
  /** プロジェクト根からの相対ディレクトリ（'' は直下） */
  relativeDir: string;
};

/**
 * パスが当該プロジェクトフォルダの `_work/` 配下か（workspace/<folderId>/_work/...）。
 * `_work/` はスキルが差し込み用の断片を書き溜める中間ファイル置き場であり、
 * 上書き確認の対象から恒常的に除外するために使う。
 */
export function isPathInsideWorkDir(
  pathLike: string,
  projectFolderId: string,
): boolean {
  const normalized = pathLike.replace(/\\/g, "/").trim();
  if (!projectFolderId || !normalized) return false;
  const prefix = `${ALLOWED_PREFIX}${projectFolderId}/_work/`;
  return normalized.startsWith(prefix);
}

/**
 * パスが当該プロジェクトフォルダ配下か（workspace/<folderId>/...）。
 */
export function isPathInsideProjectFolder(
  pathLike: string,
  projectFolderId: string,
): boolean {
  const normalized = pathLike.replace(/\\/g, "/").trim();
  if (!projectFolderId || !normalized) return false;
  if (normalized.includes("..")) return false;

  const prefix = `${ALLOWED_PREFIX}${projectFolderId}/`;
  if (normalized.startsWith(prefix)) return true;

  // プロジェクト相対（例: sub/a.md）は内側とみなす
  if (
    !normalized.startsWith(ALLOWED_PREFIX) &&
    !/^[a-zA-Z]:\//.test(normalized) &&
    !normalized.startsWith("/") &&
    !normalized.startsWith("~")
  ) {
    return true;
  }

  return false;
}

/**
 * テキスト中から、プロジェクト外を指しそうなパス断片を拾う（ヒューリスティック）。
 */
export function findOutsideProjectPathHints(
  text: string,
  projectFolderId: string,
): string[] {
  if (!text.trim() || !projectFolderId) return [];

  const candidates = new Set<string>();
  const patterns = [
    /@(workspace\/[^\s@]+)/g,
    /\b(workspace\/[^\s)'"`]+)/g,
    /\b([A-Za-z]:[\\/][^\s)'"`]+)/g,
    /(~\/[^\s)'"`]+)/g,
    /(?<![A-Za-z0-9_/.-])(\.\.\/[^\s)'"`]+)/g,
  ];

  for (const re of patterns) {
    for (const match of text.matchAll(re)) {
      const raw = (match[1] ?? match[0]).replace(/[.,;:]+$/, "");
      if (!raw) continue;
      if (!isPathInsideProjectFolder(raw, projectFolderId)) {
        candidates.add(raw);
      }
    }
  }

  // workspace/other-project/...
  for (const match of text.matchAll(
    /\bworkspace\/([^/\s]+)(?:\/[^\s)'"`]*)?/g,
  )) {
    const otherId = match[1];
    if (otherId && otherId !== projectFolderId) {
      candidates.add(match[0].replace(/[.,;:]+$/, ""));
    }
  }

  return [...candidates];
}

export function listDefaultOutputDestinations(
  projectFolderId: string,
  currentFileRelativePath?: string | null,
): OutputDestinationOption[] {
  const options: OutputDestinationOption[] = [];
  const current = currentFileRelativePath?.replace(/\\/g, "/").trim();

  if (current) {
    const slash = current.lastIndexOf("/");
    const sameDir = slash === -1 ? "" : current.slice(0, slash);
    options.push({
      id: "same-folder",
      label:
        sameDir === ""
          ? "開いているファイルと同じフォルダ（プロジェクト直下）"
          : `開いているファイルと同じフォルダ（${sameDir}/）`,
      relativeDir: sameDir,
    });
  }

  options.push({
    id: "project-root",
    label: `プロジェクトフォルダ直下（${projectFolderId}/）`,
    relativeDir: "",
  });

  // same-folder が直下と同じなら重複除去
  if (
    options.length === 2 &&
    options[0].id === "same-folder" &&
    options[0].relativeDir === ""
  ) {
    return [options[0]];
  }

  return options;
}
