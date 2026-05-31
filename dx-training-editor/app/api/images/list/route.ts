import { listPromotedImages, listStagingImages } from "@/lib/image-store";
import { isImageSource } from "@/lib/image-path";

export async function GET(req: Request) {
  const scope = new URL(req.url).searchParams.get("scope") ?? "staging";
  const sourceRaw = new URL(req.url).searchParams.get("source") ?? "uploaded";

  try {
    if (scope === "staging") {
      if (!isImageSource(sourceRaw)) {
        return Response.json({ error: "source が不正です" }, { status: 400 });
      }
      const files = await listStagingImages(process.cwd(), sourceRaw);
      return Response.json({ files });
    }

    if (scope === "used") {
      const files = await listPromotedImages(process.cwd());
      return Response.json({ files });
    }

    return Response.json({ error: "scope が不正です" }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "一覧取得に失敗しました" },
      { status: 500 },
    );
  }
}
