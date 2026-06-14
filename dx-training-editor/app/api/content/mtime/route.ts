import { getContentsLatestMtime } from "@/lib/contents-loader";

export async function GET() {
  const mtime = getContentsLatestMtime(process.cwd());
  return Response.json({ mtime });
}
