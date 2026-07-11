import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET_DIRS = ["components", "lib", "app", "__tests__", "scripts"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".md", ".json"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "coverage"]);

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
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
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
      issues.push({ file: relPath, kind: "invalid-utf8-or-bom", detail: "UTF-8 (no BOM) required" });
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

if (issues.length > 0) {
  console.error("Japanese / UTF-8 encoding issues detected:\n");
  for (const issue of issues) {
    console.error(`- ${issue.file} [${issue.kind}] ${issue.detail}`);
  }
  process.exit(1);
}

console.log("check-japanese-encoding: OK");
