/**
 * contents/ フォルダを数値プレフィックス形式からスラッグベース形式へ移行するスクリプト
 * 冪等: 既にスラッグ形式のフォルダはスキップ
 *
 * 実行: npx tsx scripts/migrate-content.ts
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const CONTENTS_DIR = path.join(ROOT, "contents");

// ===== ユーティリティ =====

function stripNumericPrefix(name: string): string {
  return name.replace(/^\d+_/, "").replace(/\.md$/, "");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\x00-\x7F]/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
}

function isValidSlug(s: string): boolean {
  if (!s || s.length > 50) return false;
  if (!/^[a-z0-9-]+$/.test(s)) return false;
  if (s.startsWith("-") || s.endsWith("-")) return false;
  if (s.includes("--")) return false;
  return true;
}

/** 既存スラッグリストで重複しない名前を生成する */
function uniqueSlug(base: string, usedSlugs: Set<string>): string {
  if (!usedSlugs.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!usedSlugs.has(candidate)) return candidate;
  }
  throw new Error(`スラッグの一意化に失敗しました: ${base}`);
}

function writeJsonIfNotExists(filePath: string, data: unknown): void {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
    console.log(`    作成: ${path.relative(ROOT, filePath)}`);
  }
}

function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

// ===== エントリーポイント =====

function main() {
  if (!fs.existsSync(CONTENTS_DIR)) {
    console.error(`エラー: ${CONTENTS_DIR} が見つかりません`);
    process.exit(1);
  }

  const seriesEntries = fs
    .readdirSync(CONTENTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  const seriesOrderPath = path.join(CONTENTS_DIR, "_series-order.json");
  const existingSeriesOrder: string[] = fs.existsSync(seriesOrderPath)
    ? (JSON.parse(fs.readFileSync(seriesOrderPath, "utf-8")) as string[])
    : [];

  const usedSeriesSlugs = new Set<string>(existingSeriesOrder);
  const newSeriesOrder: string[] = [...existingSeriesOrder];

  let seriesMigrated = 0;
  let coursesMigrated = 0;
  let lessonsMigrated = 0;

  for (const seriesEntry of seriesEntries) {
    const oldSeriesDirName = seriesEntry.name;
    const oldSeriesDir = path.join(CONTENTS_DIR, oldSeriesDirName);

    // シリーズのスラッグ決定
    const seriesTitleJa = stripNumericPrefix(oldSeriesDirName);
    let seriesSlug: string;

    if (isValidSlug(oldSeriesDirName)) {
      // 既にスラッグ形式
      seriesSlug = oldSeriesDirName;
    } else {
      seriesSlug = slugify(seriesTitleJa) || uniqueSlug("series", usedSeriesSlugs);
      seriesSlug = uniqueSlug(seriesSlug, usedSeriesSlugs);
    }

    // フォルダのリネーム（必要な場合）
    const newSeriesDir = path.join(CONTENTS_DIR, seriesSlug);
    if (oldSeriesDir !== newSeriesDir) {
      if (fs.existsSync(newSeriesDir)) {
        console.warn(`  警告: ${seriesSlug} はすでに存在します。スキップ。`);
        continue;
      }
      fs.renameSync(oldSeriesDir, newSeriesDir);
      console.log(`  シリーズ: ${oldSeriesDirName} → ${seriesSlug}/`);
    } else {
      console.log(`  シリーズ: ${seriesSlug}/ (変更なし)`);
    }

    usedSeriesSlugs.add(seriesSlug);
    if (!newSeriesOrder.includes(seriesSlug)) {
      newSeriesOrder.push(seriesSlug);
    }

    // _meta.json 作成（存在しない場合）
    const seriesMetaPath = path.join(newSeriesDir, "_meta.json");
    writeJsonIfNotExists(seriesMetaPath, { title: { ja: seriesTitleJa } });

    // コースフォルダの処理
    const courseEntries = fs
      .readdirSync(newSeriesDir, { withFileTypes: true })
      .filter(
        (e) =>
          e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "ja"));

    const courseOrderPath = path.join(newSeriesDir, "_course-order.json");
    const existingCourseOrder: string[] = fs.existsSync(courseOrderPath)
      ? (JSON.parse(fs.readFileSync(courseOrderPath, "utf-8")) as string[])
      : [];
    const usedCourseSlugs = new Set<string>(existingCourseOrder);
    const newCourseOrder: string[] = [...existingCourseOrder];

    for (const courseEntry of courseEntries) {
      const oldCourseDirName = courseEntry.name;
      const oldCourseDir = path.join(newSeriesDir, oldCourseDirName);

      const courseTitleJa = stripNumericPrefix(oldCourseDirName);
      let courseSlug: string;

      if (isValidSlug(oldCourseDirName)) {
        courseSlug = oldCourseDirName;
      } else {
        courseSlug = slugify(courseTitleJa) || uniqueSlug("course", usedCourseSlugs);
        courseSlug = uniqueSlug(courseSlug, usedCourseSlugs);
      }

      const newCourseDir = path.join(newSeriesDir, courseSlug);
      if (oldCourseDir !== newCourseDir) {
        if (fs.existsSync(newCourseDir)) {
          console.warn(`    警告: ${courseSlug} はすでに存在します。スキップ。`);
          continue;
        }
        fs.renameSync(oldCourseDir, newCourseDir);
        console.log(`    コース: ${oldCourseDirName} → ${courseSlug}/`);
        coursesMigrated++;
      }

      usedCourseSlugs.add(courseSlug);
      if (!newCourseOrder.includes(courseSlug)) {
        newCourseOrder.push(courseSlug);
      }

      // _meta.json 作成（存在しない場合）
      const courseMetaPath = path.join(newCourseDir, "_meta.json");
      if (!fs.existsSync(courseMetaPath)) {
        // 旧 .meta.json を読み込んで target_audience を移行
        const oldMetaPath = path.join(newCourseDir, ".meta.json");
        let targetAudience = "";
        if (fs.existsSync(oldMetaPath)) {
          try {
            const old = JSON.parse(fs.readFileSync(oldMetaPath, "utf-8")) as {
              target_audience?: string;
            };
            targetAudience = old.target_audience ?? "";
          } catch {
            // ignore
          }
        }
        writeJsonIfNotExists(courseMetaPath, {
          title: { ja: courseTitleJa },
          ...(targetAudience ? { target_audience: { ja: targetAudience } } : {}),
        });
      }

      // _mandala.json 作成（存在しない場合）
      const mandalaPath = path.join(newCourseDir, "_mandala.json");
      if (!fs.existsSync(mandalaPath)) {
        const oldMetaPath = path.join(newCourseDir, ".meta.json");
        let prerequisites: string[] = [];
        let nextCourses: string[] = [];
        if (fs.existsSync(oldMetaPath)) {
          try {
            const old = JSON.parse(fs.readFileSync(oldMetaPath, "utf-8")) as {
              prerequisites?: string[];
              next_courses?: string[];
            };
            prerequisites = old.prerequisites ?? [];
            nextCourses = old.next_courses ?? [];
          } catch {
            // ignore
          }
        }
        writeJsonIfNotExists(mandalaPath, {
          prerequisites,
          next_courses: nextCourses,
        });
      }

      // レッスンファイルの処理
      const lessonFiles = fs
        .readdirSync(newCourseDir)
        .filter(
          (f) =>
            f.endsWith(".md") &&
            !f.endsWith(".en.md") &&
            !f.startsWith("_") &&
            !f.startsWith("."),
        )
        .sort((a, b) => a.localeCompare(b, "ja"));

      const lessonOrderPath = path.join(newCourseDir, "_lesson-order.json");
      const existingLessonOrder: string[] = fs.existsSync(lessonOrderPath)
        ? (JSON.parse(fs.readFileSync(lessonOrderPath, "utf-8")) as string[])
        : [];
      const usedLessonSlugs = new Set<string>(existingLessonOrder);
      const newLessonOrder: string[] = [...existingLessonOrder];

      for (const lessonFile of lessonFiles) {
        const lessonName = stripNumericPrefix(lessonFile);
        let lessonSlug: string;

        const baseName = lessonFile.replace(/\.md$/, "");
        if (isValidSlug(baseName)) {
          lessonSlug = baseName;
        } else {
          lessonSlug = slugify(lessonName) || uniqueSlug("lesson", usedLessonSlugs);
          lessonSlug = uniqueSlug(lessonSlug, usedLessonSlugs);
        }

        const oldLessonPath = path.join(newCourseDir, lessonFile);
        const newLessonPath = path.join(newCourseDir, `${lessonSlug}.md`);

        if (oldLessonPath !== newLessonPath) {
          if (!fs.existsSync(newLessonPath)) {
            fs.renameSync(oldLessonPath, newLessonPath);
            console.log(`      レッスン: ${lessonFile} → ${lessonSlug}.md`);
            lessonsMigrated++;
          }
        }

        usedLessonSlugs.add(lessonSlug);
        if (!newLessonOrder.includes(lessonSlug)) {
          newLessonOrder.push(lessonSlug);
        }
      }

      // _lesson-order.json を書き込み（変更があった場合）
      const lessonOrderChanged =
        JSON.stringify(newLessonOrder) !== JSON.stringify(existingLessonOrder);
      if (lessonOrderChanged || !fs.existsSync(lessonOrderPath)) {
        writeJson(lessonOrderPath, newLessonOrder);
        console.log(`      _lesson-order.json 更新 (${newLessonOrder.length} 件)`);
      }
    }

    // _course-order.json を書き込み
    const courseOrderChanged =
      JSON.stringify(newCourseOrder) !== JSON.stringify(existingCourseOrder);
    if (courseOrderChanged || !fs.existsSync(courseOrderPath)) {
      writeJson(courseOrderPath, newCourseOrder);
      console.log(`    _course-order.json 更新 (${newCourseOrder.length} 件)`);
    }

    seriesMigrated++;
  }

  // _series-order.json を書き込み
  const seriesOrderChanged =
    JSON.stringify(newSeriesOrder) !== JSON.stringify(existingSeriesOrder);
  if (seriesOrderChanged || !fs.existsSync(seriesOrderPath)) {
    writeJson(seriesOrderPath, newSeriesOrder);
    console.log(`\n_series-order.json 更新 (${newSeriesOrder.length} 件)`);
  }

  console.log(
    `\n移行完了: ${seriesMigrated} シリーズ, ${coursesMigrated} コース, ${lessonsMigrated} レッスン を変換`,
  );
  console.log("スラッグ変換できなかった名前は元のフォルダ名がそのまま使われています。");
  console.log("曼陀羅の prerequisites/next_courses は手動でスラッグに更新が必要な場合があります。");
}

main();
