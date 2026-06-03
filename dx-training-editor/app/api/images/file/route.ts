import fs from "node:fs/promises";
import {
  moveImageToTrash,
  mimeTypeForPath,
  resolveAbsoluteImagePath,
} from "@/lib/image-store";
import { isSafeImageLogicalPath, isStagingPath } from "@/lib/image-path";

export async function GET(req: Request) {
  const pathParam = new URL(req.url).searchParams.get("path");
  if (!pathParam || !isSafeImageLogicalPath(pathParam)) {
    return Response.json({ error: "path が不正です" }, { status: 400 });
  }

  const absolute = resolveAbsoluteImagePath(process.cwd(), pathParam);
  if (!absolute) {
    return Response.json({ error: "path が不正です" }, { status: 400 });
  }

  try {
    const data = await fs.readFile(absolute);
    return new Response(data, {
      headers: {
        "Content-Type": mimeTypeForPath(pathParam),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return Response.json({ error: "ファイルが見つかりません" }, { status: 404 });
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const pathParam = url.searchParams.get("path");
  const force = url.searchParams.get("force") === "1";

  if (!pathParam || !isSafeImageLogicalPath(pathParam)) {
    return Response.json({ error: "path が不正です" }, { status: 400 });
  }

  if (isStagingPath(pathParam)) {
    try {
      await moveImageToTrash(process.cwd(), pathParam);
      return Response.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "削除に失敗しました";
      return Response.json({ error: message }, { status: 404 });
    }
  }

  const referenceCount = Number(url.searchParams.get("referenceCount") ?? "0");
  if (referenceCount > 0 && !force) {
    return Response.json(
      { error: "参照中の画像です。確認後 force=1 で削除してください" },
      { status: 409 },
    );
  }

  try {
    await moveImageToTrash(process.cwd(), pathParam);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "削除に失敗しました";
    return Response.json({ error: message }, { status: 404 });
  }
}
