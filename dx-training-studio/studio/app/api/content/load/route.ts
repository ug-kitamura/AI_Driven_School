import { reconcileOrderFiles, loadContentsFolder } from "@/lib/contents-loader";

export async function GET() {
  reconcileOrderFiles(process.cwd());
  const series = loadContentsFolder(process.cwd());
  return Response.json(series);
}
