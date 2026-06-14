/** contents-loader と同一規則のエンティティ ID を組み立てる */

export function buildSeriesId(seriesName: string): string {
  return `series-${seriesName}`;
}

export function buildCourseId(seriesName: string, courseName: string): string {
  return `course-${seriesName}-${courseName}`;
}

export function buildLessonId(
  seriesName: string,
  courseName: string,
  lessonName: string,
): string {
  return `lesson-${seriesName}-${courseName}-${lessonName}`;
}
