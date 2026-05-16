import { execSync } from "child_process";

export async function GET(req: Request) {
  const path = new URL(req.url).searchParams.get("path");
  if (!path) {
    return Response.json({ error: "path is required" }, { status: 400 });
  }
  try {
    const diff = execSync(`git diff HEAD -- "${path}"`, {
      cwd: process.cwd(),
      encoding: "utf-8",
      timeout: 5000,
    });
    return Response.json({ diff: diff || "" });
  } catch {
    return Response.json({ diff: "" });
  }
}
