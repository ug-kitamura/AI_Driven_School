import {
  contentTypeForExtension,
  fileExtension,
  resolvePane2Mode,
  resolveViewOnlyKind,
} from "@/lib/file-preview";
import { jsonError, readFileBinary } from "@/lib/workspace-mutations";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const folderId = url.searchParams.get("folderId")?.trim();
  const fileName = url.searchParams.get("fileName")?.trim();
  if (!folderId || !fileName) {
    return jsonError("folderId と fileName が必要です", 400);
  }

  const mode = resolvePane2Mode(fileName);
  const kind = resolveViewOnlyKind(fileName);
  if (mode !== "view-only" || (kind !== "image" && kind !== "pdf")) {
    return jsonError("このファイルはバイナリ配信の対象外です", 400);
  }

  const contentType = contentTypeForExtension(fileExtension(fileName));
  if (!contentType) {
    return jsonError("未対応の Content-Type です", 400);
  }

  const result = readFileBinary(process.cwd(), folderId, fileName);
  if ("error" in result) return jsonError(String(result.error), 404);

  return new Response(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}
