/**
 * 既存の contents/ フォルダを新フォーマット（プレフィックスなし・.meta.json 順序管理）に変換する。
 * 実行: npx ts-node scripts/migrate-content.ts
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const CONTENTS_DIR = path.join(ROOT, "contents");

const OLD_META_FILES = ["_series-order.json", "_course-order.json", "_lesson-order.json", "_mandala.json", "_meta.json"];

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer); });
  });
}

function stripPrefix(name: string): string {
  return name.replace(/^\d+_/, "");
}

function readJson(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {};
  try { return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>; }
  catch { return {}; }
}

function writeMetaJson(dir: string, data: Record<string, unknown>): void {
  fs.writeFileSync(path.join(dir, ".meta.json"), JSON.stringify(data, null, 2), "utf-8");
}

function numericSort(a: string, b: string): number {
  const na = parseInt(a.match(/^(\d+)/)?.[1] ?? "0", 10);
  const nb = parseInt(b.match(/^(\d+)/)?.[1] ?? "0", 10);
  return na !== nb ? na - nb : a.localeCompare(b);
}

async function main() {
  if (!fs.existsSync(CONTENTS_DIR)) {
    console.error(`エラー: ${CONTENTS_DIR} が見つかりません`);
    process.exit(1);
  }

  const answer = await ask("contents/ フォルダをプレフィックスなし形式に変換しますか？ (y/N): ");
  if (answer.toLowerCase() !== "y") {
    console.log("キャンセルしました");
    process.exit(0);
  }

  // ===== シリーズ処理 =====
  const seriesDirs = fs.readdirSync(CONTENTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(numericSort);

  const seriesOrder: string[] = [];

  for (const seriesDirName of seriesDirs) {
    const oldSeriesPath = path.join(CONTENTS_DIR, seriesDirName);
    const newSeriesName = stripPrefix(seriesDirName);
    const newSeriesPath = path.join(CONTENTS_DIR, newSeriesName);

    if (oldSeriesPath !== newSeriesPath) {
      fs.renameSync(oldSeriesPath, newSeriesPath);
      console.log(`  [series] ${seriesDirName} → ${newSeriesName}`);
    }
    seriesOrder.push(newSeriesName);

    // ===== コース処理 =====
    const courseDirs = fs.readdirSync(newSeriesPath, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort(numericSort);

    const courseOrder: string[] = [];

    for (const courseDirName of courseDirs) {
      const oldCoursePath = path.join(newSeriesPath, courseDirName);
      const newCourseName = stripPrefix(courseDirName);
      const newCoursePath = path.join(newSeriesPath, newCourseName);

      if (oldCoursePath !== newCoursePath) {
        fs.renameSync(oldCoursePath, newCoursePath);
        console.log(`    [course] ${courseDirName} → ${newCourseName}`);
      }
      courseOrder.push(newCourseName);

      // ===== レッスン処理 =====
      const lessonFiles = fs.readdirSync(newCoursePath)
        .filter((f) => f.endsWith(".md"))
        .sort(numericSort);

      const lessonOrder: string[] = [];

      for (const lessonFileName of lessonFiles) {
        const oldLessonPath = path.join(newCoursePath, lessonFileName);
        const newLessonName = stripPrefix(lessonFileName); // "01_レッスン.md" → "レッスン.md"
        const newLessonPath = path.join(newCoursePath, newLessonName);

        if (oldLessonPath !== newLessonPath) {
          fs.renameSync(oldLessonPath, newLessonPath);
          console.log(`      [lesson] ${lessonFileName} → ${newLessonName}`);
        }
        lessonOrder.push(newLessonName.slice(0, -3)); // .md を除く
      }

      // ===== コース .meta.json 生成 =====
      const existingMeta = readJson(path.join(newCoursePath, ".meta.json"));
      const mandala = readJson(path.join(newCoursePath, "_mandala.json"));

      const target_audience =
        typeof existingMeta.target_audience === "string" ? existingMeta.target_audience : "";
      const prerequisites = Array.isArray(existingMeta.prerequisites)
        ? existingMeta.prerequisites
        : Array.isArray(mandala.prerequisites)
          ? mandala.prerequisites
          : [];
      const next_courses = Array.isArray(existingMeta.next_courses)
        ? existingMeta.next_courses
        : Array.isArray(mandala.next_courses)
          ? mandala.next_courses
          : [];

      writeMetaJson(newCoursePath, { order: lessonOrder, target_audience, prerequisites, next_courses });

      // 旧ファイル削除
      for (const oldFile of OLD_META_FILES) {
        const p = path.join(newCoursePath, oldFile);
        if (fs.existsSync(p)) { fs.unlinkSync(p); }
      }
    }

    // シリーズ .meta.json 生成（course order のみ）
    writeMetaJson(newSeriesPath, { order: courseOrder });

    // 旧ファイル削除
    for (const oldFile of OLD_META_FILES) {
      const p = path.join(newSeriesPath, oldFile);
      if (fs.existsSync(p)) { fs.unlinkSync(p); }
    }
  }

  // contents/.meta.json 生成（series order のみ）
  writeMetaJson(CONTENTS_DIR, { order: seriesOrder });

  // contents/ 直下の旧ファイル削除
  for (const oldFile of OLD_META_FILES) {
    const p = path.join(CONTENTS_DIR, oldFile);
    if (fs.existsSync(p)) { fs.unlinkSync(p); }
  }

  console.log(`\n移行完了: ${seriesOrder.length} シリーズを変換しました`);
}

main().catch((err) => {
  console.error("エラー:", err);
  process.exit(1);
});
