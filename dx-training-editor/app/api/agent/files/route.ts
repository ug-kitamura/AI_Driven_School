import { listContentMarkdownFiles } from "@/lib/agent/file-attachments";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q) {
    return Response.json({ files: [] });
  }

  const projectRoot = process.cwd();
  const files = listContentMarkdownFiles(projectRoot, q);
  return Response.json({ files });
}
