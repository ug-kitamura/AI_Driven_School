import { z } from "zod";
import {
  createFile,
  jsonError,
  parseJsonBody,
} from "@/lib/workspace-mutations";

const bodySchema = z.object({
  folderId: z.string().min(1),
  fileName: z.string().min(1),
  content: z.string().optional(),
  autoRenameOnConflict: z.boolean().optional(),
});

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, bodySchema);
  if ("error" in parsed) return parsed.error;

  const result = createFile(
    process.cwd(),
    parsed.data.folderId,
    parsed.data.fileName,
    parsed.data.content ?? "",
    parsed.data.autoRenameOnConflict ? "auto-rename" : "error",
  );
  if ("error" in result) return jsonError(String(result.error), 400);
  return Response.json({ ok: true, fileName: result.fileName });
}
