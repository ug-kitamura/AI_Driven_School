import { readFavorites } from "@/lib/workspace-favorites-io";

export async function GET() {
  const favorites = readFavorites(process.cwd());
  return Response.json({ favorites });
}
