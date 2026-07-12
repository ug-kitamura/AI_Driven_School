import { getSkillCatalogRoots, listVisibleSkills } from "@/lib/agent/skill-loader";

export async function GET() {
  const roots = getSkillCatalogRoots(process.cwd());
  const skills = listVisibleSkills(roots);
  return Response.json({ skills });
}
