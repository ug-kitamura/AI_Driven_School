import {
  getWorkspaceFingerprint,
  getWorkspaceLatestMtime,
} from "@/lib/workspace-loader";
import { getProjectRoot } from "@/lib/project-root";

export async function GET() {
  const projectRoot = getProjectRoot();
  return Response.json({
    mtime: getWorkspaceLatestMtime(projectRoot),
    fingerprint: getWorkspaceFingerprint(projectRoot),
  });
}
