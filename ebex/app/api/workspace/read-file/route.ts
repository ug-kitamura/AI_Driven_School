import { readFileContent, jsonError } from "@/lib/workspace-mutations";
import { getProjectRoot } from "@/lib/project-root";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const folderId = url.searchParams.get("folderId")?.trim();
  const fileName = url.searchParams.get("fileName")?.trim();
  if (!folderId || !fileName) {
    return jsonError("folderId と fileName が必要です", 400);
  }

  const result = readFileContent(getProjectRoot(), folderId, fileName);
  if ("error" in result) return jsonError(String(result.error), 404);
  return Response.json({ content: result.content });
}
