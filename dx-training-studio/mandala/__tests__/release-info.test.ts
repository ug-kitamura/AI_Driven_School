/**
 * サイドバー最上部の更新日時行。
 * - 日時は Asia/Tokyo で整形（UTC のビルドマシンで前日にならないこと）
 * - タグ由来ビルドは番号を併記、それ以外は日時のみ
 * - 日付だけのフォールバック値では時刻をでっち上げない
 * - 何も無ければ行を出さない
 */
import { describe, expect, it } from "vitest";
import {
  buildVersionLine,
  formatUpdateDate,
  resolveReleaseInfo,
} from "../lib/release-info";

describe("formatUpdateDate", () => {
  it("UTC の日時を Asia/Tokyo に換算する（前日にならない）", () => {
    // UTC 21日 03:34 = JST 21日 12:34。実行環境の TZ に依存しないこと
    expect(formatUpdateDate("2026-08-21T03:34:00Z")).toBe("2026.08.21 12:34");
    // UTC 20日 23:00 = JST 21日 08:00（日付境界をまたぐケース）
    expect(formatUpdateDate("2026-08-20T23:00:00Z")).toBe("2026.08.21 08:00");
  });

  it("git の %cI（+09:00 オフセット付き）をそのまま扱える", () => {
    expect(formatUpdateDate("2026-08-21T12:34:56+09:00")).toBe(
      "2026.08.21 12:34",
    );
  });

  it("日付だけの値（changelog フォールバック）は時刻を出さない", () => {
    expect(formatUpdateDate("2026-08-21")).toBe("2026.08.21");
  });

  it("解釈できない値・空は undefined", () => {
    expect(formatUpdateDate("")).toBeUndefined();
    expect(formatUpdateDate("   ")).toBeUndefined();
    expect(formatUpdateDate("not-a-date")).toBeUndefined();
  });
});

describe("buildVersionLine", () => {
  it("日時のみ（Vercel・ローカル・CI）", () => {
    expect(buildVersionLine("2026-08-21T03:34:00Z", undefined)).toBe(
      "2026.08.21 12:34 更新",
    );
  });

  it("タグ由来ビルドは番号を併記する（Pages）", () => {
    expect(buildVersionLine("2026-08-21T03:34:00Z", "v1.2.3")).toBe(
      "2026.08.21 12:34 更新 (v1.2.3)",
    );
  });

  it("空白だけのタグは併記しない（ワークフローが env を空で渡す場合）", () => {
    expect(buildVersionLine("2026-08-21T03:34:00Z", "   ")).toBe(
      "2026.08.21 12:34 更新",
    );
  });

  it("changelog フォールバック（日付のみ）でも成立する", () => {
    expect(buildVersionLine("2026-08-21", "v1.2.3")).toBe(
      "2026.08.21 更新 (v1.2.3)",
    );
  });

  it("日時が無ければタグ名があっても行を出さない（偽の日時をでっち上げない）", () => {
    expect(buildVersionLine(undefined, "v1.2.3")).toBeUndefined();
    expect(buildVersionLine("", "v1.2.3")).toBeUndefined();
  });

  it("日時もタグも無ければ行を出さない", () => {
    expect(buildVersionLine(undefined, undefined)).toBeUndefined();
    expect(buildVersionLine("", "  ")).toBeUndefined();
  });
});

describe("resolveReleaseInfo", () => {
  it("line と release とリポジトリ URL を返す", () => {
    const info = resolveReleaseInfo("v0.1.0", "2026-08-21T03:34:00Z");
    expect(info.line).toBe("2026.08.21 12:34 更新 (v0.1.0)");
    expect(info.release).toBe("v0.1.0");
    expect(info.repositoryUrl).toMatch(/^https:\/\//);
  });

  it("タグ無しでは日時だけの行になる", () => {
    const info = resolveReleaseInfo(undefined, "2026-08-21T03:34:00Z");
    expect(info.line).toBe("2026.08.21 12:34 更新");
    expect(info.release).toBeUndefined();
  });

  it("何も無ければ line を持たない", () => {
    const info = resolveReleaseInfo("", "");
    expect(info.line).toBeUndefined();
  });
});
