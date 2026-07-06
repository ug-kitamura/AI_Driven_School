export const LESSON_CONTENTS_FILENAME = "contents.md";
export const LESSON_SESSION_FILENAME = "session.json";

export function lessonContentsRelativePath(
  series: string,
  course: string,
  lesson: string,
): string {
  return `contents/${series}/${course}/${lesson}/${LESSON_CONTENTS_FILENAME}`;
}
