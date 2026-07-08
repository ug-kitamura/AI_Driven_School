import { z } from "zod";
import {
  jsonError,
  parseJsonBody,
  readFolderTextSample,
} from "@/lib/workspace-mutations";
import { suggestFolderSlug } from "@/lib/workspace-slug";
import { folderExists } from "@/lib/workspace-paths";

const bodySchema = z.object({
  folderId: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, bodySchema);
  if ("error" in parsed) return parsed.error;

  const { folderId } = parsed.data;
  if (!folderExists(process.cwd(), folderId)) {
    return jsonError("フォルダが見つかりません", 404);
  }

  const sample = readFolderTextSample(process.cwd(), folderId);
  const suggested = sample ? suggestFolderSlug(sample.split("\n")[0] ?? "") : suggestFolderSlug("");

  return Response.json({ name: suggested });
}
