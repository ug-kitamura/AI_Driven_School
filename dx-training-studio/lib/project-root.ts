import path from "node:path";

/**
 * projectRoot = ユーザーの作業データの基準ルート。
 * `contents/` / `contents-plan/` はここを基準に解決する。
 *
 * dx-training-studio は単体起動のみのため、EBEX の二層ルート
 * （`.ebex.host` 検出）は持たず、常に `process.cwd()` を返す。
 * パス基準には `process.cwd()` を直接使わず、必ず本関数を経由すること
 * （EBEX との diff 同期と、将来ルート規則を変える際の一点変更のため）。
 */
export function getProjectRoot(): string {
  return path.resolve(process.cwd());
}
