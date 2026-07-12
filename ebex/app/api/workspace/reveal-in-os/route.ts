import { z } from "zod";
import { jsonError, parseJsonBody } from "@/lib/workspace-mutations";
import { revealTargetInOs } from "@/lib/workspace-reveal";

const bodySchema = z
  .object({
    folderPath: z.string().min(1),
    fileName: z.string().min(1).optional(),
  })
  .strict();

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, bodySchema);
  if ("error" in parsed) return parsed.error;

  const { folderPath, fileName } = parsed.data;
  const result = await revealTargetInOs(
    process.cwd(),
    fileName ? { folderPath, fileName } : { folderPath },
  );
  if ("error" in result) {
    return jsonError(result.error, result.status);
  }
  return Response.json({ ok: true });
}
