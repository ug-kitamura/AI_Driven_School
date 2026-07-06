import { z } from "zod";
import { jsonError, parseJsonBody, renameFile } from "@/lib/workspace-mutations";

const bodySchema = z.object({
  folderId: z.string().min(1),
  fromName: z.string().min(1),
  toName: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, bodySchema);
  if ("error" in parsed) return parsed.error;

  const result = renameFile(
    process.cwd(),
    parsed.data.folderId,
    parsed.data.fromName,
    parsed.data.toName,
  );
  if ("error" in result) return jsonError(String(result.error), 400);
  return Response.json({ ok: true, newName: result.newName });
}
