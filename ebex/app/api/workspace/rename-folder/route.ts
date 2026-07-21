import { z } from "zod";
import {
  jsonError,
  parseJsonBody,
  renameFolder,
} from "@/lib/workspace-mutations";
import {
  AGENT_BUSY_FOLDER_ERROR,
  isAgentLockedProjectFolder,
  isProjectFolderAgentActive,
} from "@/lib/agent/active-project-folders";
import { getProjectFolderId } from "@/lib/workspace-path-utils";
import { getProjectRoot } from "@/lib/project-root";

const bodySchema = z.object({
  fromPath: z.string().min(1),
  toPath: z.string().min(1),
  autoRenameOnConflict: z.boolean().optional(),
});

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, bodySchema);
  if ("error" in parsed) return parsed.error;

  const projectId = getProjectFolderId(parsed.data.fromPath);
  if (
    isAgentLockedProjectFolder(parsed.data.fromPath, projectId) &&
    isProjectFolderAgentActive(projectId)
  ) {
    return jsonError(AGENT_BUSY_FOLDER_ERROR, 409);
  }

  const result = renameFolder(
    getProjectRoot(),
    parsed.data.fromPath,
    parsed.data.toPath,
    parsed.data.autoRenameOnConflict ? "auto-rename" : "error",
  );
  if ("error" in result) return jsonError(String(result.error), 400);
  return Response.json({ ok: true, newPath: result.newPath });
}
