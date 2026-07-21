import { readFavorites } from "@/lib/workspace-favorites-io";
import { getProjectRoot } from "@/lib/project-root";

export async function GET() {
  const favorites = readFavorites(getProjectRoot());
  return Response.json({ favorites });
}
