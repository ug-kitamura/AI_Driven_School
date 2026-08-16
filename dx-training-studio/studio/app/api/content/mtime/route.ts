import { getContentsFingerprint, getContentsLatestMtime } from "@/lib/contents-loader";

export async function GET() {
  const cwd = process.cwd();
  return Response.json({
    mtime: getContentsLatestMtime(cwd),
    fingerprint: getContentsFingerprint(cwd),
  });
}
