import { z } from "zod";
import {
  createFolder,
  createSubFolder,
  jsonError,
  parseJsonBody,
} from "@/lib/workspace-mutations";

const bodySchema = z.union([
  z.object({
    name: z.string().min(1),
  }),
  z.object({
    parentPath: z.string().min(1),
    name: z.string().min(1),
  }),
]);

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, bodySchema);
  if ("error" in parsed) return parsed.error;

  const projectRoot = process.cwd();
  const result =
    "parentPath" in parsed.data
      ? createSubFolder(projectRoot, parsed.data.parentPath, parsed.data.name)
      : createFolder(projectRoot, parsed.data.name);

  if ("error" in result) return jsonError(String(result.error), 400);
  return Response.json({ ok: true, path: "path" in result ? result.path : parsed.data.name });
}
