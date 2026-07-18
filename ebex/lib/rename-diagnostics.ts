import fs from "node:fs";
import path from "node:path";
import { getDiagnosticsLogPath, getMetaDir } from "@/lib/workspace-meta";

/** プローブ対象エントリ数の上限（病的に大きいフォルダでの暴走防止） */
const PROBE_ENTRY_LIMIT = 200;

export type LockedEntry = {
  path: string;
  code: string;
};

export type RenameDiagnosticsRecord = {
  type: "rename";
  timestamp: string;
  code: string;
  fromPath: string;
  toPath: string;
  fromAbsolutePath: string;
  toAbsolutePath: string;
  fromPathLength: number;
  toPathLength: number;
  targetExists: boolean;
  targetExistsCaseInsensitive: boolean;
  lockedEntries: LockedEntry[];
  probeTruncated: boolean;
  controlTest: { ok: boolean; code?: string };
};

export function errorCodeOf(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (typeof code === "string" && code) return code;
  }
  return "UNKNOWN";
}

/**
 * 診断レコードを `.meta/diagnostics.log` へ JSON Lines で追記する。
 * `.meta` が使えない場合はアプリルート直下へフォールバックする。
 * 記録の失敗が呼び出し元の動作を妨げることはない。
 */
export function appendDiagnosticsRecord(
  projectRoot: string,
  record: Record<string, unknown>,
): void {
  const line = `${JSON.stringify(record)}\n`;
  try {
    fs.mkdirSync(getMetaDir(projectRoot), { recursive: true });
    fs.appendFileSync(getDiagnosticsLogPath(projectRoot), line, "utf-8");
    return;
  } catch {
    /* フォールバックへ */
  }
  try {
    fs.appendFileSync(
      path.join(projectRoot, "diagnostics.log"),
      line,
      "utf-8",
    );
  } catch {
    /* 記録失敗は握りつぶす（診断は本体動作を妨げない） */
  }
}

type RenameFn = (from: string, to: string) => void;

const defaultRename: RenameFn = (from, to) => fs.renameSync(from, to);

/**
 * フォルダ配下の各エントリを「一時名へ rename → 即戻す」ことで、
 * どのエントリが他プロセスにロックされているかを特定する。
 * ディレクトリは子を先に調べてから自身をプローブする（post-order）。
 * renameFn はテスト用の注入ポイント。
 */
export function collectLockedEntries(
  rootAbsolutePath: string,
  renameFn: RenameFn = defaultRename,
): { lockedEntries: LockedEntry[]; probeTruncated: boolean } {
  const lockedEntries: LockedEntry[] = [];
  let probed = 0;
  let truncated = false;

  function probe(absolutePath: string, relativePath: string): void {
    if (probed >= PROBE_ENTRY_LIMIT) {
      truncated = true;
      return;
    }
    probed += 1;
    const tempPath = `${absolutePath}.__ebexprobe`;
    try {
      renameFn(absolutePath, tempPath);
    } catch (error) {
      lockedEntries.push({ path: relativePath, code: errorCodeOf(error) });
      return;
    }
    try {
      renameFn(tempPath, absolutePath);
    } catch {
      // 戻しに失敗した場合は一度だけ再試行し、残骸が出たら記録する
      try {
        renameFn(tempPath, absolutePath);
      } catch {
        lockedEntries.push({
          path: relativePath,
          code: "PROBE_RESIDUE",
        });
      }
    }
  }

  function walk(dirAbsolutePath: string, relative: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirAbsolutePath, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (truncated) return;
      const abs = path.join(dirAbsolutePath, entry.name);
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(abs, rel);
        probe(abs, rel);
      } else {
        probe(abs, rel);
      }
    }
  }

  walk(rootAbsolutePath, "");
  return { lockedEntries, probeTruncated: truncated };
}

/**
 * 対照テスト: 同じ親ディレクトリに一時フォルダを作成して即リネームする。
 * 失敗すれば環境全体（EDR ポリシー等）、成功すれば対象フォルダ固有の問題と
 * 切り分けられる。
 */
export function runControlRenameTest(parentAbsolutePath: string): {
  ok: boolean;
  code?: string;
} {
  const base = path.join(
    parentAbsolutePath,
    `.__ebex-diag-${Date.now().toString(36)}`,
  );
  const renamed = `${base}-renamed`;
  try {
    fs.mkdirSync(base);
    fs.renameSync(base, renamed);
    fs.rmdirSync(renamed);
    return { ok: true };
  } catch (error) {
    for (const leftover of [base, renamed]) {
      try {
        fs.rmSync(leftover, { recursive: true, force: true });
      } catch {
        /* 後始末の失敗は無視 */
      }
    }
    return { ok: false, code: errorCodeOf(error) };
  }
}

function existsCaseInsensitive(absolutePath: string): boolean {
  const parent = path.dirname(absolutePath);
  const name = path.basename(absolutePath).toLowerCase();
  try {
    return fs
      .readdirSync(parent)
      .some((entry) => entry.toLowerCase() === name);
  } catch {
    return false;
  }
}

/**
 * リネーム失敗の診断本体。基本情報・ロックプローブ・対照テストの結果を
 * 1 レコードにまとめて追記する。例外は投げない。
 */
export function diagnoseRenameFailure(
  projectRoot: string,
  params: {
    fromPath: string;
    toPath: string;
    fromAbsolutePath: string;
    toAbsolutePath: string;
    error: unknown;
  },
): RenameDiagnosticsRecord {
  const probe = collectLockedEntries(params.fromAbsolutePath);
  const record: RenameDiagnosticsRecord = {
    type: "rename",
    timestamp: new Date().toISOString(),
    code: errorCodeOf(params.error),
    fromPath: params.fromPath,
    toPath: params.toPath,
    fromAbsolutePath: params.fromAbsolutePath,
    toAbsolutePath: params.toAbsolutePath,
    fromPathLength: params.fromAbsolutePath.length,
    toPathLength: params.toAbsolutePath.length,
    targetExists: fs.existsSync(params.toAbsolutePath),
    targetExistsCaseInsensitive: existsCaseInsensitive(params.toAbsolutePath),
    lockedEntries: probe.lockedEntries,
    probeTruncated: probe.probeTruncated,
    controlTest: runControlRenameTest(path.dirname(params.fromAbsolutePath)),
  };
  appendDiagnosticsRecord(projectRoot, record as unknown as Record<string, unknown>);
  return record;
}
