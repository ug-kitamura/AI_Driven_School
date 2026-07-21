import { loadWorkspace } from "@/lib/workspace-loader";
import { getProjectRoot } from "@/lib/project-root";

export async function GET() {
  const data = loadWorkspace(getProjectRoot());
  return Response.json(data);
}
