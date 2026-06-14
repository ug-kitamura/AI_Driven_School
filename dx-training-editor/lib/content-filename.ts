/** ファイルシステム禁止文字を `_` に置換してフォルダ/ファイル名として安全な文字列にする */
export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "_").trim();
}

/** 数値プレフィックス（`01_` 等）とファイル拡張子（`.md`）を除いた表示名を返す */
export function stripPrefix(filename: string): string {
  return filename.replace(/^\d+_/, "").replace(/\.md$/, "");
}

/** インデックス（0始まり）から 2桁ゼロ埋めプレフィックスを生成する */
export function indexToPrefix(index: number): string {
  return String(index + 1).padStart(2, "0") + "_";
}

/** フォルダ/ファイル名にプレフィックスを付与する */
export function withPrefix(index: number, name: string): string {
  return `${indexToPrefix(index)}${sanitizeFilename(name)}`;
}
