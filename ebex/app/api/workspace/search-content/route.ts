import { searchWorkspaceContent } from "@/lib/workspace-content-search";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const result = searchWorkspaceContent(process.cwd(), q);
  return Response.json(result);
}
