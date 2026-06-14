import { listSkills } from "@/lib/agent/skill-loader";

export async function GET() {
  const projectRoot = process.cwd();
  const skills = listSkills(projectRoot);
  return Response.json({ skills });
}
