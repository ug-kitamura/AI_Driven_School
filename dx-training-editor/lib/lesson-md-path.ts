/** 将来 export 先と一致する git HEAD 上のレッスン .md 相対パス（`/` 区切り） */
export function resolveLessonMdPath(
  series: string,
  course: string,
  lesson: string,
): string {
  const segments = ["src", series, course, `${lesson}.md`];
  return segments.join("/");
}
