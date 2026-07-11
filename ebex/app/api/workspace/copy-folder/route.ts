import { z } from "zod";
import { copyFolder, jsonError, parseJsonBody } from "@/lib/workspace-mutations";

const bodySchema = z.object({
  fromPath: z.string().min(1),
  toParentPath: z.string().min(1),
  toName: z.string().min(1).optional(),
  autoRenameOnConflict: z.boolean().optional(),
});

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, bodySchema);
  if ("error" in parsed) return parsed.error;

  const { fromPath, toParentPath, toName, autoRenameOnConflict } = parsed.data;
  const result = copyFolder(
    process.cwd(),
    fromPath,
    toParentPath,
    toName,
    autoRenameOnConflict ? "auto-rename" : "error",
  );
  if ("error" in result) return jsonError(String(result.error), 400);
  return Response.json({ ok: true, path: result.path });
}
