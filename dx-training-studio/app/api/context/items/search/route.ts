import { dbErrorResponse } from "@/lib/context-db/resolve";
import { getContextRepository } from "@/lib/context-db/repository";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    if (!q) {
      return Response.json({ error: "q パラメータが必要です" }, { status: 400 });
    }

    const repo = getContextRepository();
    const items = await repo.searchItems(q);
    return Response.json({ items });
  } catch (error) {
    const dbResponse = dbErrorResponse(error);
    if (dbResponse) return dbResponse;
    return Response.json(
      { error: error instanceof Error ? error.message : "検索に失敗しました" },
      { status: 500 },
    );
  }
}
