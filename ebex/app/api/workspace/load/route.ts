import { loadWorkspace } from "@/lib/workspace-loader";

export async function GET() {
  const data = loadWorkspace(process.cwd());
  return Response.json(data);
}
