import { loadContentsFolder } from "@/lib/contents-loader";

export async function GET() {
  const series = loadContentsFolder(process.cwd());
  return Response.json(series);
}
