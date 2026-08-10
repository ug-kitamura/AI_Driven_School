export const WORKSPACE_DIR_NAME = "workspace";
export const ALLOWED_PREFIX = `${WORKSPACE_DIR_NAME}/`;

/** Pane 1 ツリー行の内部ドラッグを識別する dataTransfer MIME タイプ */
export const INTERNAL_DRAG_MIME = "application/x-ebex-tree";

/**
 * ドラッグ元ファイルの所属プロジェクトを表す MIME タイプ。
 * dragover 中は dataTransfer.getData が使えないため、
 * types に載る MIME タイプ名自体へプロジェクト ID を埋め込んで判定する。
 * types は ASCII 小文字化されるため、両側で同じ正規化を行う。
 */
export function internalDragProjectMime(projectFolderId: string): string {
  return `application/x-ebex-tree-project;${encodeURIComponent(projectFolderId).toLowerCase()}`;
}

export type InternalDragPayload =
  | { kind: "file"; folderPath: string; fileName: string }
  | { kind: "folder"; folderPath: string };

export function parseInternalDragPayload(
  raw: string,
): InternalDragPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<InternalDragPayload>;
    if (parsed.kind === "file" && parsed.folderPath && parsed.fileName) {
      return {
        kind: "file",
        folderPath: parsed.folderPath,
        fileName: parsed.fileName,
      };
    }
    if (parsed.kind === "folder" && parsed.folderPath) {
      return { kind: "folder", folderPath: parsed.folderPath };
    }
    return null;
  } catch {
    return null;
  }
}
