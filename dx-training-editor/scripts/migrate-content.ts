/**
 * data/content.json → contents/ フォルダ構成への移行スクリプト
 * 実行: npx ts-node scripts/migrate-content.ts
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "_").trim();
}
function withPrefix(index: number, name: string): string {
  return `${String(index + 1).padStart(2, "0")}_${sanitizeFilename(name)}`;
}

const ROOT = path.resolve(__dirname, "..");
const CONTENT_JSON = path.join(ROOT, "data", "content.json");
const CONTENTS_DIR = path.join(ROOT, "contents");

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

interface LessonData {
  id: string;
  series: string;
  course: string;
  lesson: string;
  status: string;
  description: string;
  tags: string[];
  estimated_minutes: number;
  author: string;
  content: string;
}

interface CourseData {
  id: string;
  name: string;
  target_audience?: string;
  prerequisites: string[];
  next_courses: string[];
  lessons: LessonData[];
}

interface SeriesData {
  id: string;
  name: string;
  courses: CourseData[];
}

async function main() {
  if (!fs.existsSync(CONTENT_JSON)) {
    console.error(`エラー: ${CONTENT_JSON} が見つかりません`);
    process.exit(1);
  }

  if (fs.existsSync(CONTENTS_DIR)) {
    const answer = await ask(
      `contents/ フォルダがすでに存在します。上書きしますか？ (y/N): `,
    );
    if (answer.toLowerCase() !== "y") {
      console.log("キャンセルしました");
      process.exit(0);
    }
    fs.rmSync(CONTENTS_DIR, { recursive: true, force: true });
    console.log("既存の contents/ を削除しました");
  }

  fs.mkdirSync(CONTENTS_DIR, { recursive: true });

  const raw = fs.readFileSync(CONTENT_JSON, "utf-8");
  const seriesList = JSON.parse(raw) as SeriesData[];

  const seriesOrder: string[] = []; // 互換用（未使用）

  for (let si = 0; si < seriesList.length; si++) {
    const series = seriesList[si];
    const seriesDirName = withPrefix(si, series.name);
    const seriesDir = path.join(CONTENTS_DIR, seriesDirName);
    fs.mkdirSync(seriesDir, { recursive: true });
    seriesOrder.push(series.name);

    for (let ci = 0; ci < series.courses.length; ci++) {
      const course = series.courses[ci];
      const courseDirName = withPrefix(ci, course.name);
      const courseDir = path.join(seriesDir, courseDirName);
      fs.mkdirSync(courseDir, { recursive: true });

      const courseJson = {
        target_audience: course.target_audience ?? "",
        prerequisites: course.prerequisites ?? [],
        next_courses: course.next_courses ?? [],
      };
      fs.writeFileSync(
        path.join(courseDir, ".meta.json"),
        JSON.stringify(courseJson, null, 2),
        "utf-8",
      );

      for (let li = 0; li < course.lessons.length; li++) {
        const lesson = course.lessons[li];
        const lessonFileName = `${withPrefix(li, lesson.lesson)}.md`;
        fs.writeFileSync(
          path.join(courseDir, lessonFileName),
          lesson.content,
          "utf-8",
        );
      }

      console.log(
        `  ✓ ${series.name} / ${course.name} (${course.lessons.length} レッスン)`,
      );
    }
  }

  console.log(
    `\n移行完了: ${seriesList.length} シリーズ → contents/ フォルダを生成しました`,
  );
  console.log("data/content.json はバックアップとして残してあります");
}

main().catch((err) => {
  console.error("エラー:", err);
  process.exit(1);
});
