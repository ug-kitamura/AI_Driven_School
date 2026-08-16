/**
 * コース直下のフラット `{lesson}.md` を `{lesson}/contents.md` に移行する。
 *
 * Usage: npx tsx scripts/migrate-lesson-folders.ts
 */
import { migrateAllLessonFolders } from "../lib/migrate-lesson-folders";

const total = migrateAllLessonFolders(process.cwd());
console.log(`Done. Migrated ${total} lesson file(s).`);
