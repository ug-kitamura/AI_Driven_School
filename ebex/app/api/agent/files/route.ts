import {
  listWorkspaceFolderFiles,
  orderWorkspaceFilesForPicker,
} from "@/lib/agent/workspace-file-attachments";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const folderId = url.searchParams.get("folderId")?.trim();
  if (!folderId) {
    return Response.json({ error: "folderId が必要です" }, { status: 400 });
  }
  const current = url.searchParams.get("current")?.trim() || undefined;
  const projectRoot = process.cwd();
  const files = orderWorkspaceFilesForPicker(
    listWorkspaceFolderFiles(projectRoot, folderId),
    current,
  );
  return Response.json({ files });
}
