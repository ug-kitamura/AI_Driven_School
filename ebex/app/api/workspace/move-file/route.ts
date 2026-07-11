import { z } from "zod";
import { jsonError, moveFile, parseJsonBody } from "@/lib/workspace-mutations";

const bodySchema = z.object({
  fromFolderId: z.string().min(1),
  fromName: z.string().min(1),
  toFolderId: z.string().min(1),
  toName: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, bodySchema);
  if ("error" in parsed) return parsed.error;

  const { fromFolderId, fromName, toFolderId, toName } = parsed.data;
  const result = moveFile(
    process.cwd(),
    fromFolderId,
    fromName,
    toFolderId,
    toName,
  );
  if ("error" in result) return jsonError(String(result.error), 400);
  return Response.json({ ok: true, newName: result.newName });
}
