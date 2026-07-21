import { z } from "zod";
import { generateFolderNameFromPaths } from "@/lib/agent/generate-folder-name";
import { listFolderRelativePathsForNaming } from "@/lib/workspace-folder-path-list";
import { listFolderTextExcerptsForNaming } from "@/lib/workspace-folder-text-excerpts";
import { jsonError, parseJsonBody } from "@/lib/workspace-mutations";
import { folderExists } from "@/lib/workspace-paths";
import { getProjectRoot } from "@/lib/project-root";

const bodySchema = z.object({
  folderId: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, bodySchema);
  if ("error" in parsed) return parsed.error;

  const { folderId } = parsed.data;
  if (folderId.includes("/")) {
    return jsonError("プロジェクトフォルダのみ指定できます", 400);
  }
  if (!folderExists(getProjectRoot(), folderId)) {
    return jsonError("フォルダが見つかりません", 404);
  }

  const paths = listFolderRelativePathsForNaming(getProjectRoot(), folderId);
  const excerpts = listFolderTextExcerptsForNaming(getProjectRoot(), folderId);
  const result = await generateFolderNameFromPaths(
    req,
    paths,
    new Date(),
    excerpts,
  );
  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return Response.json({ name: result.name });
}
