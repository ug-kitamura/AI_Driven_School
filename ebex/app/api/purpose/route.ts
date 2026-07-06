import fs from "node:fs";
import path from "node:path";
import { PURPOSE_FILENAME } from "@/lib/workspace-paths";

export async function GET() {
  const purposePath = path.join(process.cwd(), PURPOSE_FILENAME);
  if (!fs.existsSync(purposePath)) {
    return new Response("purpose.md が見つかりません", { status: 404 });
  }
  const text = fs.readFileSync(purposePath, "utf-8");
  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
