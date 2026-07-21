import { z } from "zod";
import {
  createFolder,
  createSubFolder,
  jsonError,
  parseJsonBody,
} from "@/lib/workspace-mutations";
import { getProjectRoot } from "@/lib/project-root";

const bodySchema = z.object({
  name: z.string().min(1),
  parentPath: z.string().min(1).optional(),
  autoRenameOnConflict: z.boolean().optional(),
});

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, bodySchema);
  if ("error" in parsed) return parsed.error;

  const projectRoot = getProjectRoot();
  const { name, parentPath, autoRenameOnConflict } = parsed.data;
  const conflictPolicy = autoRenameOnConflict ? "auto-rename" : "error";
  const result = parentPath
    ? createSubFolder(projectRoot, parentPath, name, conflictPolicy)
    : createFolder(projectRoot, name);

  if ("error" in result) return jsonError(String(result.error), 400);
  return Response.json({
    ok: true,
    path: "path" in result ? result.path : parsed.data.name,
  });
}
