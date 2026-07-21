import fs from "node:fs";
import path from "node:path";
import { PURPOSE_RELATIVE_PATH } from "@/lib/workspace-paths";

export async function GET() {
  const purposePath = path.join(process.cwd(), PURPOSE_RELATIVE_PATH);
  if (!fs.existsSync(purposePath)) {
    return new Response(`${PURPOSE_RELATIVE_PATH} が見つかりません`, {
      status: 404,
    });
  }
  const text = fs.readFileSync(purposePath, "utf-8");
  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
