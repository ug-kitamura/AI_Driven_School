#!/usr/bin/env node
/**
 * Vercel workaround for Next.js 16 + Root Directory:
 * post-build validation resolves paths from the git repo root, not the app
 * subdirectory. Mirror this project into the parent on Vercel only.
 */
import fs from "node:fs/promises";
import path from "node:path";

if (!process.env.VERCEL) {
  console.log("vercel-postbuild: skipped (not running on Vercel)");
  process.exit(0);
}

const projectRoot = process.cwd();
const repoRoot = path.dirname(projectRoot);

if (projectRoot === repoRoot) {
  console.log("vercel-postbuild: skipped (app is at repo root)");
  process.exit(0);
}

const entries = await fs.readdir(projectRoot, { withFileTypes: true });
for (const entry of entries) {
  const src = path.join(projectRoot, entry.name);
  const dest = path.join(repoRoot, entry.name);
  await fs.rm(dest, { recursive: true, force: true });
  await fs.cp(src, dest, { recursive: true, force: true });
}

console.log(`vercel-postbuild: mirrored ${projectRoot} -> ${repoRoot}`);
