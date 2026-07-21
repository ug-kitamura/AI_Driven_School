import JSZip from "jszip";
import { resolvePane2Mode, resolveViewOnlyKind } from "@/lib/file-preview";
import { jsonError, readFileBinary } from "@/lib/workspace-mutations";
import { getProjectRoot } from "@/lib/project-root";

const MAX_ZIP_ENTRIES = 2000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const folderId = url.searchParams.get("folderId")?.trim();
  const fileName = url.searchParams.get("fileName")?.trim();
  if (!folderId || !fileName) {
    return jsonError("folderId と fileName が必要です", 400);
  }

  if (
    resolvePane2Mode(fileName) !== "view-only" ||
    resolveViewOnlyKind(fileName) !== "zip"
  ) {
    return jsonError("zip ファイルのみ一覧できます", 400);
  }

  const result = readFileBinary(getProjectRoot(), folderId, fileName);
  if ("error" in result) return jsonError(String(result.error), 404);

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(result.buffer);
  } catch {
    return jsonError("zip の解析に失敗しました", 400);
  }

  const entries: Array<{ path: string; size?: number }> = [];
  let truncated = false;

  const names = Object.keys(zip.files).sort((a, b) => a.localeCompare(b, "ja"));
  for (const name of names) {
    if (entries.length >= MAX_ZIP_ENTRIES) {
      truncated = true;
      break;
    }
    const entry = zip.files[name];
    if (!entry || entry.dir) continue;
    entries.push({ path: name });
  }

  return Response.json({ entries, truncated });
}
