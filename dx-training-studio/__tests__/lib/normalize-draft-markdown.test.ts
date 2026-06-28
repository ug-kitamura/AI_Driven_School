import { describe, expect, it } from "vitest";
import { normalizeDraftMarkdownForLesson } from "@/lib/lesson-frontmatter";

describe("normalizeDraftMarkdownForLesson", () => {
  const fallbacks = {
    series: "Git完全マスターシリーズ",
    course: "Gitブランチ操作コース",
    lesson: "ブランチとは何か",
    status: "open" as const,
    description: "説明",
    tags: ["git", "branch"],
    estimated_minutes: 15,
    author: "",
  };

  const ctx = {
    seriesName: fallbacks.series,
    courseName: fallbacks.course,
  };

  it("maps draft status to open", () => {
    const input = `---
series: Git完全マスターシリーズ
course: Gitブランチ操作コース
lesson: ブランチとは何か
status: draft
description: AI説明
tags: [git, ブランチ]
estimated_minutes: 20
author: 
---

# タイトル
`;
    const result = normalizeDraftMarkdownForLesson(input, ctx, fallbacks);
    expect(result).toContain("status: open");
    expect(result).not.toContain("status: draft");
  });

  it("removes invalid tags and keeps fallback tags", () => {
    const input = `---
series: Git完全マスターシリーズ
course: Gitブランチ操作コース
lesson: ブランチとは何か
status: open
description: AI説明
tags: [git, ブランチ, branch]
estimated_minutes: 15
author: 
---

# タイトル
`;
    const result = normalizeDraftMarkdownForLesson(input, ctx, fallbacks);
    expect(result).toContain("tags: [git, branch]");
    expect(result).not.toMatch(/tags:.*ブランチ/);
  });
});
