import { z } from "zod";
import { toggleFavorite } from "@/lib/workspace-favorites-io";
import { parseJsonBody } from "@/lib/workspace-mutations";

const bodySchema = z.object({
  folderPath: z.string().min(1),
  fileName: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, bodySchema);
  if ("error" in parsed) return parsed.error;

  const favorites = toggleFavorite(
    process.cwd(),
    parsed.data.folderPath,
    parsed.data.fileName,
  );
  return Response.json({ favorites });
}
