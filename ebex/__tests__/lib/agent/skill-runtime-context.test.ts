import { describe, expect, it } from "vitest";
import {
  buildSkillRuntimeContext,
  mergeSkillSystemPrompt,
} from "@/lib/agent/skill-runtime-context";
import {
  findOutsideProjectPathHints,
  isPathInsideProjectFolder,
  listDefaultOutputDestinations,
} from "@/lib/agent/skill-io-boundary";

describe("buildSkillRuntimeContext", () => {
  it("mentions scope focus and boundary", () => {
    const text = buildSkillRuntimeContext({
      projectFolderId: "demo",
      currentFileRelativePath: "sub/notes.md",
    });
    expect(text).toContain("Scope");
    expect(text).toContain("demo");
    expect(text).toContain("sub/notes.md");
    expect(text).toContain("Boundary");
  });

  it("mentions skill read zone when skillId is set", () => {
    const text = buildSkillRuntimeContext({
      projectFolderId: "demo",
      skillId: "minutes-maid",
    });
    expect(text).toContain("references/*");
    expect(text).toContain("references/purpose.md");
    expect(text).not.toContain(".claude/skills/");
  });
});

describe("mergeSkillSystemPrompt", () => {
  it("prepends runtime context", () => {
    expect(mergeSkillSystemPrompt("SKILL", "RUNTIME")).toContain("RUNTIME");
    expect(mergeSkillSystemPrompt("SKILL", "RUNTIME")).toContain("SKILL");
    expect(mergeSkillSystemPrompt("SKILL", null)).toBe("SKILL");
  });
});

describe("isPathInsideProjectFolder", () => {
  it("accepts workspace prefix and relative paths", () => {
    expect(isPathInsideProjectFolder("workspace/demo/a.md", "demo")).toBe(true);
    expect(isPathInsideProjectFolder("sub/a.md", "demo")).toBe(true);
    expect(isPathInsideProjectFolder("workspace/other/a.md", "demo")).toBe(false);
    expect(isPathInsideProjectFolder("~/Downloads/x.md", "demo")).toBe(false);
  });
});

describe("findOutsideProjectPathHints", () => {
  it("finds other project and home paths", () => {
    const hints = findOutsideProjectPathHints(
      "see workspace/other/file.md and ~/Downloads/a.md",
      "demo",
    );
    expect(hints.some((h) => h.includes("other"))).toBe(true);
    expect(hints.some((h) => h.includes("Downloads"))).toBe(true);
  });

  it("ignores in-project paths", () => {
    expect(
      findOutsideProjectPathHints("use @workspace/demo/notes.md", "demo"),
    ).toEqual([]);
  });
});

describe("listDefaultOutputDestinations", () => {
  it("puts same folder before project root", () => {
    const options = listDefaultOutputDestinations("demo", "sub/notes.md");
    expect(options.map((o) => o.id)).toEqual(["same-folder", "project-root"]);
    expect(options[0].relativeDir).toBe("sub");
  });

  it("dedupes when current file is at project root", () => {
    const options = listDefaultOutputDestinations("demo", "notes.md");
    expect(options).toHaveLength(1);
    expect(options[0].id).toBe("same-folder");
  });
});
