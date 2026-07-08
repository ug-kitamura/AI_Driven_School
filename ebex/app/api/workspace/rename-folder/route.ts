import { z } from "zod";
import { jsonError, parseJsonBody, renameFolder } from "@/lib/workspace-mutations";

const bodySchema = z.object({
  fromPath: z.string().min(1),
  toPath: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, bodySchema);
  if ("error" in parsed) return parsed.error;

  const result = renameFolder(
    process.cwd(),
    parsed.data.fromPath,
    parsed.data.toPath,
  );
  if ("error" in result) return jsonError(String(result.error), 400);
  return Response.json({ ok: true, newPath: result.newPath });
}
