import { z } from "zod";
import { jsonError, parseJsonBody, saveFile } from "@/lib/workspace-mutations";
import { getProjectRoot } from "@/lib/project-root";

const bodySchema = z.object({
  folderId: z.string().min(1),
  fileName: z.string().min(1),
  content: z.string(),
});

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, bodySchema);
  if ("error" in parsed) return parsed.error;

  const result = saveFile(
    getProjectRoot(),
    parsed.data.folderId,
    parsed.data.fileName,
    parsed.data.content,
  );
  if ("error" in result) return jsonError(String(result.error), 400);
  return Response.json({ ok: true });
}
