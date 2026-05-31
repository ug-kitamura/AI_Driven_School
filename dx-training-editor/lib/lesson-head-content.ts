import { execSync } from "child_process";
import path from "node:path";
import { seriesArraySchema } from "@/lib/schema";
import { resolveLessonMdPath } from "@/lib/lesson-md-path";

export const CONTENT_JSON_REL = "data/content.json";

export type HeadSource = "git-md" | "content-json" | "empty";

export type ResolvedHeadContent = {
  content: string;
  headSource: HeadSource;
  path: string;
};

export type ResolveHeadError = {
  error: string;
};

/** git リポジトリ root からの相対パス（モノレポでは `dx-training-editor/...`） */
export function toRepoRelativePath(
  projectRoot: string,
  repoRoot: string,
  relativePath: string,
): string {
  const projectRel = path.relative(repoRoot, projectRoot).replace(/\\/g, "/");
  if (projectRel === "" || projectRel === ".") return relativePath;
  return `${projectRel}/${relativePath}`;
}

export function findLessonContentInSeriesJson(
  json: unknown,
  lessonId: string,
): string | null {
  const parsed = seriesArraySchema.safeParse(json);
  if (!parsed.success) return null;
  for (const series of parsed.data) {
    for (const course of series.courses) {
      for (const lesson of course.lessons) {
        if (lesson.id === lessonId) return lesson.content;
      }
    }
  }
  return null;
}

function getGitRepoRoot(projectRoot: string): string | null {
  try {
    return execSync("git rev-parse --show-toplevel", {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
  } catch {
    return null;
  }
}

function gitShowHead(repoRoot: string, pathFromRepoRoot: string): string | null {
  try {
    return execSync(`git show HEAD:${pathFromRepoRoot}`, {
      cwd: repoRoot,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
}

function parseContentJson(raw: string, lessonId: string): string | null {
  try {
    return findLessonContentInSeriesJson(JSON.parse(raw), lessonId);
  } catch {
    return null;
  }
}

export function resolveHeadContent(
  projectRoot: string,
  lessonId: string,
  series: string,
  course: string,
  lesson: string,
): ResolvedHeadContent | ResolveHeadError {
  const mdPath = resolveLessonMdPath(series, course, lesson);
  const repoRoot = getGitRepoRoot(projectRoot);

  if (!repoRoot) {
    return { error: "git リポジトリが見つかりません" };
  }

  const mdRepoPath = toRepoRelativePath(projectRoot, repoRoot, mdPath);
  const mdContent = gitShowHead(repoRoot, mdRepoPath);
  if (mdContent !== null) {
    return {
      content: mdContent,
      headSource: "git-md",
      path: mdPath,
    };
  }

  const contentJsonRepoPath = toRepoRelativePath(
    projectRoot,
    repoRoot,
    CONTENT_JSON_REL,
  );
  const contentJsonRaw = gitShowHead(repoRoot, contentJsonRepoPath);
  if (contentJsonRaw !== null) {
    const fromJson = parseContentJson(contentJsonRaw, lessonId);
    if (fromJson !== null) {
      return {
        content: fromJson,
        headSource: "content-json",
        path: mdPath,
      };
    }
  }

  return {
    content: "",
    headSource: "empty",
    path: mdPath,
  };
}
