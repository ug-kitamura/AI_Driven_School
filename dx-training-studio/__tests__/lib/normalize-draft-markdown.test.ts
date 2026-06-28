import { describe, expect, it } from "vitest";
import {
  estimateDraftMinutes,
  inferDraftTagsFromText,
  normalizeDraftMarkdownForLesson,
  resolveDraftTags,
} from "@/lib/lesson-frontmatter";

describe("normalizeDraftMarkdownForLesson", () => {
  const fallbacks = {
    series: "Git完全マスターシリーズ",
    course: "Git環境構築コース",
    lesson: "最初のコミット",
    status: "open" as const,
    description: "説明",
    tags: [] as string[],
    estimated_minutes: 0,
    author: "",
  };

  const ctx = {
    seriesName: fallbacks.series,
    courseName: fallbacks.course,
  };

  it("maps draft status to open", () => {
    const input = `---
series: Git完全マスターシリーズ
course: Git環境構築コース
lesson: 最初のコミット
status: draft
description: AI説明
tags: []
estimated_minutes: 0
author: 
---

# タイトル
`;
    const result = normalizeDraftMarkdownForLesson(input, ctx, fallbacks, {
      availableTags: ["git", "setup"],
    });
    expect(result).toContain("status: open");
    expect(result).not.toContain("status: draft");
  });

  it("infers tags when lesson and draft tags are empty", () => {
    const input = `---
series: Git完全マスターシリーズ
course: Git環境構築コース
lesson: 最初のコミット
status: open
description: Git commit 手順
tags: []
estimated_minutes: 0
author: 
---

# 最初のコミット

git add と git commit の流れを学びます。
`;
    const result = normalizeDraftMarkdownForLesson(input, ctx, fallbacks, {
      availableTags: ["git", "setup", "python"],
      contextItemTags: ["branch-strategy"],
    });
    expect(result).toContain("tags: [git]");
    expect(result).not.toMatch(/tags:.*ブランチ/);
  });

  it("estimates minutes when lesson meta is zero", () => {
    const body = `# 最初のコミット\n\n${"手順\n".repeat(40)}`;
    const input = `---
series: Git完全マスターシリーズ
course: Git環境構築コース
lesson: 最初のコミット
status: open
description: ""
tags: []
estimated_minutes: 0
author: 
---
${body}
`;
    const result = normalizeDraftMarkdownForLesson(input, ctx, fallbacks, {
      availableTags: ["git"],
    });
    expect(result).toMatch(/estimated_minutes: [1-9]\d*/);
    expect(result).not.toContain("estimated_minutes: 0");
  });
});

describe("resolveDraftTags", () => {
  it("prefers valid parsed tags", () => {
    expect(
      resolveDraftTags({
        parsedTags: ["git", "commit"],
        fallbackTags: [],
        availableTags: [],
        contextItemTags: [],
        bodyText: "",
      }),
    ).toEqual(["git", "commit"]);
  });

  it("uses context item tags when parsed tags are empty", () => {
    expect(
      resolveDraftTags({
        parsedTags: [],
        fallbackTags: [],
        availableTags: ["git"],
        contextItemTags: ["branch-strategy", "git"],
        bodyText: "",
      }),
    ).toEqual(["branch-strategy", "git"]);
  });
});

describe("inferDraftTagsFromText", () => {
  it("matches available tags in body text", () => {
    expect(
      inferDraftTagsFromText("git commit の手順", ["git", "python"]),
    ).toEqual(["git"]);
  });
});

describe("estimateDraftMinutes", () => {
  it("returns at least 10 for non-empty body", () => {
    expect(estimateDraftMinutes("# Title\n\nSome content.")).toBeGreaterThanOrEqual(
      10,
    );
  });
});
