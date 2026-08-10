import {
  listWorkspaceFolderFiles,
  orderWorkspaceFilesForPicker,
} from "@/lib/agent/workspace-file-attachments";
import {
  listContentMarkdownFiles,
  orderContentFilesForPicker,
} from "@/lib/agent/file-attachments";
import { getProjectRoot } from "@/lib/project-root";

/**
 * @ 参照ピッカー用のファイル一覧。
 * - `folderId` あり: 案件フォルダ（workspace/<folderId>/）内のファイル
 * - `folderId` なし: 正本ツリー（contents/）のレッスン markdown（従来動作）
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const folderId = url.searchParams.get("folderId")?.trim();
  const current = url.searchParams.get("current")?.trim() || undefined;
  const projectRoot = getProjectRoot();

  if (folderId) {
    const files = orderWorkspaceFilesForPicker(
      listWorkspaceFolderFiles(projectRoot, folderId),
      current,
    ).map((file) => ({
      name: file.name,
      path: file.path,
      relativePath: file.relativePath,
    }));
    return Response.json({ files });
  }

  const files = orderContentFilesForPicker(
    listContentMarkdownFiles(projectRoot),
    current ?? null,
  );
  return Response.json({ files });
}
