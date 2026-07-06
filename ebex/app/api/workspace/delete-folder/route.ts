import { z } from "zod";
import { deleteFolder, jsonError, parseJsonBody } from "@/lib/workspace-mutations";

const bodySchema = z.object({
  folderId: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, bodySchema);
  if ("error" in parsed) return parsed.error;

  const result = deleteFolder(process.cwd(), parsed.data.folderId);
  if ("error" in result) return jsonError(String(result.error), 400);
  return Response.json({ ok: true });
}
