import {
  listWorkspaceFolderFiles,
  orderWorkspaceFilesForPicker,
} from "@/lib/agent/workspace-file-attachments";
import { getProjectRoot } from "@/lib/project-root";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const folderId = url.searchParams.get("folderId")?.trim();
  if (!folderId) {
    return Response.json({ error: "folderId が必要です" }, { status: 400 });
  }
  const current = url.searchParams.get("current")?.trim() || undefined;
  const projectRoot = getProjectRoot();
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
