import fs from "node:fs";
import path from "node:path";
import { PURPOSE_RELATIVE_PATH } from "@/lib/workspace-paths";
import { getEbexRoot } from "@/lib/agent/skill-loader";

export async function GET() {
  // ebe-purpose.md は製品同梱物なので appRoot 基準で解決する。
  // ホスト配布時も host/ebex/contracts/ を読み、host/contracts/ は見ない。
  const purposePath = path.join(getEbexRoot(), PURPOSE_RELATIVE_PATH);
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
