/** ファイルシステム禁止文字を `_` に置換してフォルダ/ファイル名として安全な文字列にする */
export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "_").trim();
}

/** 数値プレフィックス（`01_` 等）とファイル拡張子（`.md`）を除いた表示名を返す */
export function stripPrefix(filename: string): string {
  return filename.replace(/^\d+_/, "").replace(/\.md$/, "");
}

/**
 * スラッグが有効かどうかを検証する。
 * 有効条件: `[a-z0-9-]+`、最大 50 文字、先頭・末尾・連続ハイフン不可。
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length > 50) return false;
  if (!/^[a-z0-9-]+$/.test(slug)) return false;
  if (slug.startsWith("-") || slug.endsWith("-")) return false;
  if (slug.includes("--")) return false;
  return true;
}

/**
 * 任意のテキストを ASCII kebab-case スラッグに変換する。
 * 日本語等の非 ASCII 文字はローマ字ベースの変換は行わず除去する。
 * 最大 50 文字にクリップする。
 */
export function slugify(text: string): string {
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
