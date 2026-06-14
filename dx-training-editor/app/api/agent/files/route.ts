import {
  listContentMarkdownFiles,
  orderContentFilesForPicker,
} from "@/lib/agent/file-attachments";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const current = url.searchParams.get("current")?.trim() || undefined;
  const projectRoot = process.cwd();
  const files = orderContentFilesForPicker(
    listContentMarkdownFiles(projectRoot),
    current,
  );
  return Response.json({ files });
}
