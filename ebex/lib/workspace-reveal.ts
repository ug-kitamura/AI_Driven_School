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

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

/** Explorer を開き、対象ウィンドウを最前面にする PowerShell */
export function buildWindowsRevealFocusScript(
  absolutePath: string,
  isFile: boolean,
): string {
  const escaped = escapePowerShellSingleQuoted(absolutePath);
  const selectFlag = isFile ? "$true" : "$false";
  return `
$ErrorActionPreference = 'SilentlyContinue'
$path = '${escaped}'
$select = ${selectFlag}
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class EbexFocus {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
  public static void AllowFocus() {
    keybd_event(0x12, 0, 0, UIntPtr.Zero);
    keybd_event(0x12, 0, 2, UIntPtr.Zero);
  }
}
"@
if ($select) {
  Start-Process -FilePath explorer.exe -ArgumentList ('/select,"{0}"' -f $path)
  $dir = Split-Path -LiteralPath $path
} else {
  Start-Process -FilePath explorer.exe -ArgumentList ('"{0}"' -f $path)
  $dir = $path
}
Start-Sleep -Milliseconds 500
$shell = New-Object -ComObject Shell.Application
foreach ($w in @($shell.Windows())) {
  try {
    if ($null -eq $w.Document) { continue }
    if ($w.Document.Folder.Self.Path -ne $dir) { continue }
    $hwnd = [IntPtr]$w.HWND
    [EbexFocus]::AllowFocus()
    [void][EbexFocus]::ShowWindowAsync($hwnd, 9)
    [void][EbexFocus]::SetForegroundWindow($hwnd)
    break
  } catch {}
}
`.trim();
}

export function encodePowerShellCommand(script: string): string {
  return Buffer.from(script, "utf16le").toString("base64");
}

export function buildRevealCommand(
  absolutePath: string,
  isFile: boolean,
  platform: NodeJS.Platform = process.platform,
): RevealCommand {
  if (platform === "win32") {
    return {
      command: "powershell.exe",
      args: [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
        encodePowerShellCommand(
          buildWindowsRevealFocusScript(absolutePath, isFile),
        ),
      ],
    };
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

  const platform = options?.platform ?? process.platform;
  const command = buildRevealCommand(
    resolved.absolutePath,
    isFile,
    platform,
  );
  const runner = options?.runner ?? defaultRunner;

  try {
    await runner(command.command, command.args);
    return { ok: true };
  } catch (error) {
    // Legacy explorer.exe exits non-zero; PowerShell path should be clean,
    // but keep win32 soft-success for edge environments.
    if (platform === "win32") {
      return { ok: true };
    }
    const message =
      error instanceof Error
        ? error.message
        : "ファイルマネージャを開けませんでした";
    return { error: message, status: 500 };
  }
}
