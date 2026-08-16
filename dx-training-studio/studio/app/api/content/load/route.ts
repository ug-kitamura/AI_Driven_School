import { reconcileOrderFiles, loadContentsFolder } from "@/lib/contents-loader";
import { getProjectRoot } from "@/lib/project-root";

export async function GET() {
  reconcileOrderFiles(getProjectRoot());
  const series = loadContentsFolder(getProjectRoot());
  return Response.json(series);
}
