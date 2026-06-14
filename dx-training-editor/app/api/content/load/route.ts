import { normalizeContentsFolder, loadContentsFolder } from "@/lib/contents-loader";

export async function GET() {
  normalizeContentsFolder(process.cwd());
  const series = loadContentsFolder(process.cwd());
  return Response.json(series);
}
