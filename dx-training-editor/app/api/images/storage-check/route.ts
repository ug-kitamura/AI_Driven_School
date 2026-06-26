import {
  resolveCanonicalBackend,
  storageErrorResponse,
} from "@/lib/image-storage/resolve";

export async function GET() {
  try {
    const backend = resolveCanonicalBackend(process.cwd(), "storage");
    await backend.listCanonical();
    return Response.json({ ok: true });
  } catch (error) {
    const storageResponse = storageErrorResponse(error);
    if (storageResponse) return storageResponse;
    return Response.json(
      { error: error instanceof Error ? error.message : "ストレージ確認に失敗しました" },
      { status: 500 },
    );
  }
}
