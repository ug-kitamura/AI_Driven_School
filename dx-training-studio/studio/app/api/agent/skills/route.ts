import {
  getSkillCatalogRoots,
  listVisibleSkills,
} from "@/lib/agent/skill-loader";
import { getProjectRoot } from "@/lib/project-root";

export async function GET() {
  const roots = getSkillCatalogRoots(getProjectRoot());
  const skills = listVisibleSkills(roots);
  return Response.json({ skills });
}
