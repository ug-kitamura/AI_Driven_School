import { saveStagingImage } from "@/lib/image-store";
import { isImageSource } from "@/lib/image-path";

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "フォームデータが不正です" }, { status: 400 });
  }

  const file = formData.get("file");
  const sourceRaw = formData.get("source")?.toString() ?? "uploaded";
  if (!(file instanceof File)) {
    return Response.json({ error: "file が必要です" }, { status: 400 });
  }
  if (!isImageSource(sourceRaw)) {
    return Response.json({ error: "source が不正です" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "画像ファイルのみアップロードできます" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const entry = await saveStagingImage(
      process.cwd(),
      sourceRaw,
      file.name,
      buffer,
    );
    return Response.json({ file: entry });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "アップロードに失敗しました" },
      { status: 500 },
    );
  }
}
