import {
  getWorkspaceFingerprint,
  getWorkspaceLatestMtime,
} from "@/lib/workspace-loader";

export async function GET() {
  const cwd = process.cwd();
  return Response.json({
    mtime: getWorkspaceLatestMtime(cwd),
    fingerprint: getWorkspaceFingerprint(cwd),
  });
}
