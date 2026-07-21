import { searchWorkspaceContent } from "@/lib/workspace-content-search";
import { getProjectRoot } from "@/lib/project-root";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const result = searchWorkspaceContent(getProjectRoot(), q);
  return Response.json(result);
}
