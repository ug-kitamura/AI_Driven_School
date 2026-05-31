import { describe, expect, it } from "vitest";
import { resolveLessonMdPath } from "@/lib/lesson-md-path";

describe("resolveLessonMdPath", () => {
  it("builds src path from series, course, and lesson names", () => {
    expect(
      resolveLessonMdPath("Gitシリーズ", "環境構築", "インストール手順"),
    ).toBe("src/Gitシリーズ/環境構築/インストール手順.md");
  });
});
