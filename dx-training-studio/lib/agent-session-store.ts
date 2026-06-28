import fs from "node:fs";
import path from "node:path";
import { findLessonLocationById } from "@/lib/contents-loader";
import { LESSON_SESSION_FILENAME } from "@/lib/lesson-paths";
import type { AgentChatStorage } from "@/lib/agent-chat-storage";
import { parseAgentChatStorage } from "@/lib/agent-chat-storage";

export function isAgentSessionFsWritable(): boolean {
  return process.env.AGENT_SESSION_FS !== "disabled";
}

export function resolveLessonSessionPath(
  projectRoot: string,
  lessonId: string,
): string | null {
  const location = findLessonLocationById(projectRoot, lessonId);
  if (!location) return null;
  return path.join(location.lessonDir, LESSON_SESSION_FILENAME);
}

export function readLessonSessionFile(
  projectRoot: string,
  lessonId: string,
): AgentChatStorage | null {
  const sessionPath = resolveLessonSessionPath(projectRoot, lessonId);
  if (!sessionPath || !fs.existsSync(sessionPath)) return null;
  try {
    const raw = fs.readFileSync(sessionPath, "utf-8");
    return parseAgentChatStorage(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeLessonSessionFile(
  projectRoot: string,
  lessonId: string,
  storage: AgentChatStorage,
): void {
  if (!isAgentSessionFsWritable()) {
    throw new Error("AGENT_SESSION_FS_DISABLED");
  }
  const sessionPath = resolveLessonSessionPath(projectRoot, lessonId);
  if (!sessionPath) {
    throw new Error(`Lesson not found: ${lessonId}`);
  }
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(sessionPath, JSON.stringify(storage, null, 2), "utf-8");
}
