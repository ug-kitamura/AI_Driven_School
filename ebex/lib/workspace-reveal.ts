import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import {
  resolveFilePath,
  resolveFolderPath,
} from "@/lib/workspace-paths";

const execFileAsync = promisify(execFile);

export type RevealTarget =
  | { folderPath: string; fileName?: undefined }
  | { folderPath: string; fileName: string };

export type RevealCommand = {
  command: string;
  args: string[];
};

export function buildRevealCommand(
  absolutePath: string,
  isFile: boolean,
  platform: NodeJS.Platform = process.platform,
): RevealCommand {
  if (platform === "win32") {
    if (isFile) {
      return { command: "explorer.exe", args: [`/select,${absolutePath}`] };
    }
    return { command: "explorer.exe", args: [absolutePath] };
  }
  if (platform === "darwin") {
    if (isFile) {
      return { command: "open", args: ["-R", absolutePath] };
    }
    return { command: "open", args: [absolutePath] };
  }
  if (isFile) {
    return { command: "xdg-open", args: [path.dirname(absolutePath)] };
  }
  return { command: "xdg-open", args: [absolutePath] };
}

export type RevealRunner = (
  command: string,
  args: readonly string[],
) => Promise<unknown>;

const defaultRunner: RevealRunner = (command, args) =>
  execFileAsync(command, [...args]);

export async function revealTargetInOs(
  projectRoot: string,
  target: RevealTarget,
  options?: {
    platform?: NodeJS.Platform;
    runner?: RevealRunner;
  },
): Promise<{ ok: true } | { error: string; status: number }> {
  const isFile = Boolean(target.fileName);
  const resolved = isFile
    ? resolveFilePath(projectRoot, target.folderPath, target.fileName!)
    : resolveFolderPath(projectRoot, target.folderPath);

  if ("error" in resolved) {
    return { error: resolved.error, status: 400 };
  }

  if (!fs.existsSync(resolved.absolutePath)) {
    return {
      error: isFile ? "ファイルが見つかりません" : "フォルダが見つかりません",
      status: 404,
    };
  }

  const command = buildRevealCommand(
    resolved.absolutePath,
    isFile,
    options?.platform ?? process.platform,
  );
  const runner = options?.runner ?? defaultRunner;

  try {
    await runner(command.command, command.args);
    return { ok: true };
  } catch (error) {
    // Windows explorer.exe often exits non-zero even when it opens successfully.
    if ((options?.platform ?? process.platform) === "win32") {
      return { ok: true };
    }
    const message =
      error instanceof Error
        ? error.message
        : "ファイルマネージャを開けませんでした";
    return { error: message, status: 500 };
  }
}
