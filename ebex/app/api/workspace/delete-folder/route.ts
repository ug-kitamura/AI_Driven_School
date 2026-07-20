import { z } from "zod";
import {
  deleteFolder,
  jsonError,
  parseJsonBody,
} from "@/lib/workspace-mutations";
import {
  AGENT_BUSY_FOLDER_ERROR,
  isAgentLockedProjectFolder,
  isProjectFolderAgentActive,
} from "@/lib/agent/active-project-folders";
import { getProjectFolderId } from "@/lib/workspace-path-utils";

const bodySchema = z.object({
  folderId: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, bodySchema);
  if ("error" in parsed) return parsed.error;

  const projectId = getProjectFolderId(parsed.data.folderId);
  if (
    isAgentLockedProjectFolder(parsed.data.folderId, projectId) &&
    isProjectFolderAgentActive(projectId)
  ) {
    return jsonError(AGENT_BUSY_FOLDER_ERROR, 409);
  }

  const result = deleteFolder(process.cwd(), parsed.data.folderId);
  if ("error" in result) return jsonError(String(result.error), 400);
  return Response.json({ ok: true });
}
