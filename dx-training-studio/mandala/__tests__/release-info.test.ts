import { describe, expect, it } from "vitest";
import { resolveReleaseInfo } from "../lib/release-info";

describe("resolveReleaseInfo", () => {
  it("タグ名が渡されればそれをリリース番号にする", () => {
    const info = resolveReleaseInfo("v0.1.0");
    expect(info.release).toBe("v0.1.0");
    expect(info.isRelease).toBe(true);
  });

  it("未設定ならリリース番号を持たない", () => {
    const info = resolveReleaseInfo(undefined);
    expect(info.release).toBeUndefined();
    expect(info.isRelease).toBe(false);
  });

  it("空文字・空白だけならリリース番号を持たない", () => {
    // ワークフローが env を空で渡した場合に "" を表示してしまわないこと
    expect(resolveReleaseInfo("").release).toBeUndefined();
    expect(resolveReleaseInfo("   ").release).toBeUndefined();
    expect(resolveReleaseInfo("   ").isRelease).toBe(false);
  });

  it("前後の空白を落とす", () => {
    expect(resolveReleaseInfo(" v1.2.3 ").release).toBe("v1.2.3");
  });

  it("リポジトリ URL を返す", () => {
    expect(resolveReleaseInfo("v0.1.0").repositoryUrl).toMatch(/^https:\/\//);
  });
});
