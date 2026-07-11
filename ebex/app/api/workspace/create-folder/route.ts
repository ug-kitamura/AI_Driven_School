import { z } from "zod";
import {
  createFolder,
  createSubFolder,
  jsonError,
  parseJsonBody,
} from "@/lib/workspace-mutations";

const bodySchema = z.object({
  name: z.string().min(1),
  parentPath: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, bodySchema);
  if ("error" in parsed) return parsed.error;

  const projectRoot = process.cwd();
  const { name, parentPath } = parsed.data;
  const result = parentPath
    ? createSubFolder(projectRoot, parentPath, name)
    : createFolder(projectRoot, name);

  if ("error" in result) return jsonError(String(result.error), 400);
  return Response.json({
    ok: true,
    path: "path" in result ? result.path : parsed.data.name,
  });
}
