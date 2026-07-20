import { z } from "zod";
import {
  deleteFile,
  jsonError,
  parseJsonBody,
} from "@/lib/workspace-mutations";

const bodySchema = z.object({
  folderId: z.string().min(1),
  fileName: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, bodySchema);
  if ("error" in parsed) return parsed.error;

  const result = deleteFile(
    process.cwd(),
    parsed.data.folderId,
    parsed.data.fileName,
  );
  if ("error" in result) return jsonError(String(result.error), 400);
  return Response.json({ ok: true });
}
