import { z } from "zod";
import { jsonError, parseJsonBody, renameFolder } from "@/lib/workspace-mutations";

const bodySchema = z.object({
  fromId: z.string().min(1),
  toId: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, bodySchema);
  if ("error" in parsed) return parsed.error;

  const result = renameFolder(
    process.cwd(),
    parsed.data.fromId,
    parsed.data.toId,
  );
  if ("error" in result) return jsonError(String(result.error), 400);
  return Response.json({ ok: true, newId: result.newId });
}
