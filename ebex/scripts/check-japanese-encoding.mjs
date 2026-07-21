import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET_DIRS = ["components", "lib", "app", "__tests__", "scripts"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".md", ".json"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "coverage"]);

/**
 * `.bat` は ASCII のみ許可する。cmd.exe はバッチファイルをコンソールの
 * コードページ（日本語 Windows では CP932）で読むため、UTF-8 の日本語を
 * 書くと化けるだけでなく、2 バイト文字の解釈で行が壊れてコメントの断片が
 * コマンドとして実行される。
 */
const ASCII_ONLY_EXTENSIONS = new Set([".bat"]);
const NON_ASCII_RE = /[^\x00-\x7F]/;

const SUSPICIOUS_PATTERNS = [
  { name: "replacement-char", regex: /\uFFFD/ },
  { name: "run-of-question-marks", regex: /["'`][^"'`]*\?{3,}[^"'`]*["'`]/ },
  { name: "mojibake-utf8-as-latin", regex: /(?:ã.|â.|Ã.|ï¿½)/ },
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    const ext = path.extname(entry.name);
    if (EXTENSIONS.has(ext)) files.push(fullPath);
  }
  return files;
}

function isUtf8WithoutBom(buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf
  ) {
    return false;
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

const issues = [];

for (const dirName of TARGET_DIRS) {
  const dirPath = path.join(ROOT, dirName);
  if (!fs.existsSync(dirPath)) continue;

  for (const filePath of walk(dirPath)) {
    const relPath = path.relative(ROOT, filePath).replaceAll("\\", "/");
    const buffer = fs.readFileSync(filePath);

    if (!isUtf8WithoutBom(buffer)) {
      issues.push({
        file: relPath,
        kind: "invalid-utf8-or-bom",
        detail: "UTF-8 (no BOM) required",
      });
      continue;
    }

    const text = buffer.toString("utf8");
    const lines = text.split(/\r?\n/);

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.regex.test(line)) {
          issues.push({
            file: relPath,
            kind: pattern.name,
            detail: `line ${i + 1}: ${line.trim().slice(0, 120)}`,
          });
        }
      }
    }
  }
}

// ASCII 限定ファイル（リポジトリ直下の `.bat` と TARGET_DIRS 配下）
function collectAsciiOnlyFiles() {
  const found = [];
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (entry.isDirectory()) continue;
    if (ASCII_ONLY_EXTENSIONS.has(path.extname(entry.name))) {
      found.push(path.join(ROOT, entry.name));
    }
  }
  for (const dirName of TARGET_DIRS) {
    const dirPath = path.join(ROOT, dirName);
    if (!fs.existsSync(dirPath)) continue;
    const stack = [dirPath];
    while (stack.length > 0) {
      const dir = stack.pop();
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (ASCII_ONLY_EXTENSIONS.has(path.extname(entry.name))) {
          found.push(full);
        }
      }
    }
  }
  return found;
}

for (const filePath of collectAsciiOnlyFiles()) {
  const relPath = path.relative(ROOT, filePath).replaceAll("\\", "/");
  const lines = fs.readFileSync(filePath, "latin1").split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    if (!NON_ASCII_RE.test(lines[i])) continue;
    issues.push({
      file: relPath,
      kind: "non-ascii-in-batch-file",
      detail: `line ${i + 1}: .bat must be ASCII-only (cmd.exe reads it as CP932)`,
    });
  }
}

if (issues.length > 0) {
  console.error("Japanese / UTF-8 encoding issues detected:\n");
  for (const issue of issues) {
    console.error(`- ${issue.file} [${issue.kind}] ${issue.detail}`);
  }
  process.exit(1);
}

console.log("check-japanese-encoding: OK");
