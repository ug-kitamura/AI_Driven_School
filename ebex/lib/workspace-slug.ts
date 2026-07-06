export function suggestFolderSlug(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const slug = base || "untitled";
  return `${y}${m}${d}-${slug}`;
}
