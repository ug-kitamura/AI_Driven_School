import fs from "node:fs";
import path from "node:path";
import {
  FAVORITES_FILENAME,
  type FavoriteEntry,
} from "@/lib/workspace-favorites";
import {
  SESSION_FILENAME,
  getProjectFolderId,
} from "@/lib/workspace-path-utils";
import { getWorkspaceDir } from "@/lib/workspace-paths";
import { parseAgentChatStorage } from "@/lib/agent-chat-storage";

export const META_DIR_NAME = ".meta";
export const META_JSON_FILENAME = "meta.json";
export const META_SESSIONS_DIR_NAME = "sessions";
export const META_FAVORITES_FILENAME = "favorites.json";
export const DIAGNOSTICS_LOG_FILENAME = "diagnostics.log";

/**
 * meta.json の 1 レコード。ino（NTFS fileID）がプロジェクト同一性の主キー、
 * folderPath は自己修復（ino が変わった場合の照合）用の予備キー。
 * ino は 64bit 値で Number の安全域を超えるため bigint を文字列化して保持する。
 */
export type MetaEntry = {
  ino: string;
  folderPath: string;
  createdAt: string;
};

type MetaFile = {
  version: 1;
  projects: MetaEntry[];
};

export function getMetaDir(projectRoot: string): string {
  return path.join(getWorkspaceDir(projectRoot), META_DIR_NAME);
}

export function getMetaJsonPath(projectRoot: string): string {
  return path.join(getMetaDir(projectRoot), META_JSON_FILENAME);
}

export function getMetaSessionsDir(projectRoot: string): string {
  return path.join(getMetaDir(projectRoot), META_SESSIONS_DIR_NAME);
}

export function getMetaSessionPath(projectRoot: string, ino: string): string {
  return path.join(getMetaSessionsDir(projectRoot), `${ino}.json`);
}

export function getMetaFavoritesPath(projectRoot: string): string {
  return path.join(getMetaDir(projectRoot), META_FAVORITES_FILENAME);
}

export function getDiagnosticsLogPath(projectRoot: string): string {
  return path.join(getMetaDir(projectRoot), DIAGNOSTICS_LOG_FILENAME);
}

/** フォルダの NTFS fileID を bigint stat で取得する。失敗時は null。 */
export function statFolderIno(absolutePath: string): string | null {
  try {
    const stat = fs.statSync(absolutePath, { bigint: true });
    if (!stat.isDirectory()) return null;
    return stat.ino.toString();
  } catch {
    return null;
  }
}

export function readMetaRegistry(projectRoot: string): MetaEntry[] {
  const metaPath = getMetaJsonPath(projectRoot);
  if (!fs.existsSync(metaPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as MetaFile;
    if (parsed.version !== 1 || !Array.isArray(parsed.projects)) return [];
    return parsed.projects.filter(
      (entry): entry is MetaEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.ino === "string" &&
        !!entry.ino &&
        typeof entry.folderPath === "string" &&
        !!entry.folderPath &&
        typeof entry.createdAt === "string",
    );
  } catch {
    return [];
  }
}

export function writeMetaRegistry(
  projectRoot: string,
  entries: MetaEntry[],
): void {
  fs.mkdirSync(getMetaDir(projectRoot), { recursive: true });
  const payload: MetaFile = { version: 1, projects: entries };
  fs.writeFileSync(
    getMetaJsonPath(projectRoot),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf-8",
  );
}

/** workspace 直下のプロジェクトフォルダ一覧（dot 始まりは除外）を ino つきで返す。 */
export function listProjectFolderInos(
  projectRoot: string,
): Array<{ folderPath: string; absolutePath: string; ino: string }> {
  const workspaceDir = getWorkspaceDir(projectRoot);
  if (!fs.existsSync(workspaceDir)) return [];
  const results: Array<{
    folderPath: string;
    absolutePath: string;
    ino: string;
  }> = [];
  for (const entry of fs.readdirSync(workspaceDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const absolutePath = path.join(workspaceDir, entry.name);
    const ino = statFolderIno(absolutePath);
    if (!ino) continue;
    results.push({ folderPath: entry.name, absolutePath, ino });
  }
  return results;
}

/** ino → 現在のプロジェクトフォルダ名の実測マップ（台帳を経由しない生値）。 */
export function buildLiveInoMap(projectRoot: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const folder of listProjectFolderInos(projectRoot)) {
    map.set(folder.ino, folder.folderPath);
  }
  return map;
}

export type RegistryResolution =
  | { kind: "match"; entry: MetaEntry; folderPathChanged: boolean }
  | { kind: "relink"; entry: MetaEntry; oldIno: string }
  | { kind: "new" };

/**
 * 自己修復の判定（純関数）。
 * 1. ino 一致 → match（folderPath が古ければ更新が必要）
 * 2. ino 不一致・folderPath 一致 → relink（コピー・復元で ino が変わった）
 * 3. どちらも不一致 → new
 */
export function decideRegistryResolution(
  entries: MetaEntry[],
  ino: string,
  folderPath: string,
): RegistryResolution {
  const byIno = entries.find((entry) => entry.ino === ino);
  if (byIno) {
    return {
      kind: "match",
      entry: byIno,
      folderPathChanged: byIno.folderPath !== folderPath,
    };
  }
  const byPath = entries.find((entry) => entry.folderPath === folderPath);
  if (byPath) {
    return { kind: "relink", entry: byPath, oldIno: byPath.ino };
  }
  return { kind: "new" };
}

function applyResolution(
  projectRoot: string,
  entries: MetaEntry[],
  ino: string,
  folderPath: string,
  createdAtFallback?: string,
): { entries: MetaEntry[]; changed: boolean } {
  const decision = decideRegistryResolution(entries, ino, folderPath);
  if (decision.kind === "match") {
    if (!decision.folderPathChanged) return { entries, changed: false };
    decision.entry.folderPath = folderPath;
    return { entries, changed: true };
  }
  if (decision.kind === "relink") {
    const oldSession = getMetaSessionPath(projectRoot, decision.oldIno);
    const newSession = getMetaSessionPath(projectRoot, ino);
    if (fs.existsSync(oldSession) && !fs.existsSync(newSession)) {
      fs.renameSync(oldSession, newSession);
    }
    decision.entry.ino = ino;
    return { entries, changed: true };
  }
  entries.push({
    ino,
    folderPath,
    createdAt: createdAtFallback ?? new Date().toISOString(),
  });
  return { entries, changed: true };
}

/**
 * プロジェクトフォルダの ino を解決し、台帳を自己修復する。
 * folderId はサブフォルダパスでもよい（先頭セグメントをプロジェクトとして扱う）。
 */
export function resolveProjectIno(
  projectRoot: string,
  folderId: string,
): { ino: string } | { error: string } {
  const projectFolderId = getProjectFolderId(folderId.trim());
  if (!projectFolderId || projectFolderId.startsWith(".")) {
    return { error: "不正なフォルダパスです" };
  }
  const absolutePath = path.join(getWorkspaceDir(projectRoot), projectFolderId);
  const ino = statFolderIno(absolutePath);
  if (!ino) return { error: `フォルダが見つかりません: ${projectFolderId}` };

  const entries = readMetaRegistry(projectRoot);
  const applied = applyResolution(projectRoot, entries, ino, projectFolderId);
  if (applied.changed) writeMetaRegistry(projectRoot, applied.entries);
  return { ino };
}

/** 台帳から folderPath でエントリを引く（フォルダ削除後など stat 不能時用）。 */
export function findRegistryEntryByPath(
  projectRoot: string,
  folderPath: string,
): MetaEntry | null {
  const projectFolderId = getProjectFolderId(folderPath);
  return (
    readMetaRegistry(projectRoot).find(
      (entry) => entry.folderPath === projectFolderId,
    ) ?? null
  );
}

/** EBEX 内リネーム成功時の台帳追従（ino は不変なので folderPath のみ更新）。 */
export function onProjectFolderRenamed(
  projectRoot: string,
  fromFolderPath: string,
  toFolderPath: string,
): void {
  if (fromFolderPath.includes("/") || toFolderPath.includes("/")) return;
  const entries = readMetaRegistry(projectRoot);
  const entry = entries.find((e) => e.folderPath === fromFolderPath);
  if (!entry) return;
  entry.folderPath = toFolderPath;
  writeMetaRegistry(projectRoot, entries);
}

/** プロジェクトフォルダ削除時の台帳・セッション掃除。削除前に呼ぶこと。 */
export function onProjectFolderDeleted(
  projectRoot: string,
  folderPath: string,
): void {
  if (folderPath.includes("/")) return;
  const entries = readMetaRegistry(projectRoot);
  const index = entries.findIndex((e) => e.folderPath === folderPath);
  if (index < 0) return;
  const [removed] = entries.splice(index, 1);
  writeMetaRegistry(projectRoot, entries);
  const sessionPath = getMetaSessionPath(projectRoot, removed.ino);
  try {
    if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath);
  } catch {
    /* セッション掃除の失敗は削除本体を妨げない */
  }
}

/**
 * 台帳の全体同期（再構築を含む）。
 * 全プロジェクトフォルダを走査して自己修復を適用し、
 * 実在しないエントリ（ino・folderPath とも不一致）を台帳から除去する。
 * 除去されたエントリの孤児セッションファイルも削除する。
 */
export function syncMetaRegistry(projectRoot: string): MetaEntry[] {
  const folders = listProjectFolderInos(projectRoot);
  let entries = readMetaRegistry(projectRoot);
  let changed = false;

  for (const folder of folders) {
    const applied = applyResolution(
      projectRoot,
      entries,
      folder.ino,
      folder.folderPath,
      creationTimeOf(folder.absolutePath),
    );
    entries = applied.entries;
    changed = changed || applied.changed;
  }

  const liveInos = new Set(folders.map((f) => f.ino));
  const livePaths = new Set(folders.map((f) => f.folderPath));
  const kept: MetaEntry[] = [];
  for (const entry of entries) {
    if (liveInos.has(entry.ino) || livePaths.has(entry.folderPath)) {
      kept.push(entry);
      continue;
    }
    changed = true;
    const sessionPath = getMetaSessionPath(projectRoot, entry.ino);
    try {
      if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath);
    } catch {
      /* 孤児掃除の失敗は同期を妨げない */
    }
  }

  if (changed) writeMetaRegistry(projectRoot, kept);
  return kept;
}

function creationTimeOf(absolutePath: string): string {
  try {
    return fs.statSync(absolutePath).birthtime.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * 旧形式データの一括マイグレーション。
 * meta.json の存在を完了マーカーとし、存在すれば同期のみ行う。
 * 個々の移行は「コピー → 検証 → 元の削除」の順で行い、再実行しても安全。
 */
export function ensureWorkspaceMeta(projectRoot: string): void {
  if (fs.existsSync(getMetaJsonPath(projectRoot))) {
    syncMetaRegistry(projectRoot);
    return;
  }
  migrateWorkspaceMeta(projectRoot);
}

function migrateWorkspaceMeta(projectRoot: string): void {
  const folders = listProjectFolderInos(projectRoot);
  fs.mkdirSync(getMetaSessionsDir(projectRoot), { recursive: true });

  const entries: MetaEntry[] = folders.map((folder) => ({
    ino: folder.ino,
    folderPath: folder.folderPath,
    createdAt: creationTimeOf(folder.absolutePath),
  }));

  for (const folder of folders) {
    migrateLegacySessionFile(projectRoot, folder.absolutePath, folder.ino);
  }

  migrateLegacyFavorites(projectRoot, folders);

  // 完了マーカー: meta.json は最後に書く（途中クラッシュ時は次回起動で全体を再実行）
  writeMetaRegistry(projectRoot, entries);
}

function migrateLegacySessionFile(
  projectRoot: string,
  folderAbsolutePath: string,
  ino: string,
): void {
  const legacyPath = path.join(folderAbsolutePath, SESSION_FILENAME);
  if (!fs.existsSync(legacyPath)) return;

  let raw: string;
  try {
    raw = fs.readFileSync(legacyPath, "utf-8");
  } catch {
    return;
  }
  const storage = parseStorageSafe(raw);
  if (!storage) return; // 破損ファイルは移行せず残す（データを消さない）

  const targetPath = getMetaSessionPath(projectRoot, ino);
  fs.writeFileSync(targetPath, raw, "utf-8");

  // 検証: 書き込んだ内容が読み戻せてスキーマに適合することを確認してから元を削除
  const verify = parseStorageSafe(fs.readFileSync(targetPath, "utf-8"));
  if (!verify) return;
  fs.unlinkSync(legacyPath);
}

function parseStorageSafe(raw: string) {
  try {
    return parseAgentChatStorage(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** 保存形式のお気に入りエントリ（ino ＋ プロジェクトフォルダ内相対パス）。 */
export type StoredFavoriteEntry = {
  ino: string;
  fileName: string;
};

function migrateLegacyFavorites(
  projectRoot: string,
  folders: Array<{ folderPath: string; ino: string }>,
): void {
  const legacyPath = path.join(projectRoot, FAVORITES_FILENAME);
  if (!fs.existsSync(legacyPath)) return;

  let legacy: { favorites?: FavoriteEntry[] };
  try {
    legacy = JSON.parse(fs.readFileSync(legacyPath, "utf-8"));
  } catch {
    return;
  }
  if (!Array.isArray(legacy.favorites)) return;

  const inoByFolder = new Map(folders.map((f) => [f.folderPath, f.ino]));
  const stored: StoredFavoriteEntry[] = [];
  for (const entry of legacy.favorites) {
    if (typeof entry?.folderPath !== "string" || !entry.folderPath) continue;
    if (typeof entry?.fileName !== "string" || !entry.fileName) continue;
    const top = getProjectFolderId(entry.folderPath);
    const ino = inoByFolder.get(top);
    if (!ino) continue; // 実在しないフォルダのお気に入りは捨てる
    const subPath = entry.folderPath.slice(top.length + 1);
    stored.push({
      ino,
      fileName: subPath ? `${subPath}/${entry.fileName}` : entry.fileName,
    });
  }

  writeStoredFavorites(projectRoot, stored);

  // 検証: 読み戻し可能なら旧ファイルを削除
  try {
    JSON.parse(fs.readFileSync(getMetaFavoritesPath(projectRoot), "utf-8"));
    fs.unlinkSync(legacyPath);
  } catch {
    /* 検証失敗時は旧ファイルを残す */
  }
}

type StoredFavoritesFile = {
  favorites: StoredFavoriteEntry[];
};

export function readStoredFavorites(
  projectRoot: string,
): StoredFavoriteEntry[] {
  const filePath = getMetaFavoritesPath(projectRoot);
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(
      fs.readFileSync(filePath, "utf-8"),
    ) as StoredFavoritesFile;
    if (!Array.isArray(parsed.favorites)) return [];
    return parsed.favorites.filter(
      (entry): entry is StoredFavoriteEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.ino === "string" &&
        !!entry.ino &&
        typeof entry.fileName === "string" &&
        !!entry.fileName,
    );
  } catch {
    return [];
  }
}

export function writeStoredFavorites(
  projectRoot: string,
  favorites: StoredFavoriteEntry[],
): void {
  fs.mkdirSync(getMetaDir(projectRoot), { recursive: true });
  const seen = new Set<string>();
  const deduped = favorites.filter((entry) => {
    const key = `${entry.ino}/${entry.fileName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const payload: StoredFavoritesFile = { favorites: deduped };
  fs.writeFileSync(
    getMetaFavoritesPath(projectRoot),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf-8",
  );
}
