import { listVisibleSkills } from "@/lib/agent/skill-loader";

export async function GET() {
  const projectRoot = process.cwd();
  const skills = listVisibleSkills(projectRoot);
  return Response.json({ skills });
}
