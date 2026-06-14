import { describe, expect, it } from "vitest";
import {
  filterBuiltinCommands,
  filterContentFiles,
  filterSkills,
} from "@/lib/agent-chat-suggestions";
import type { SkillSummary } from "@/lib/agent/skill-loader";

const skills: SkillSummary[] = [
  {
    id: "create-draft",
    name: "レッスン草稿作成",
    description: "レッスン本文の草稿を生成します",
  },
  {
    id: "create-structure",
    name: "構造設計",
    description: "シリーズ構成を設計します",
  },
];

describe("filterSkills", () => {
  it("matches skill id by substring", () => {
    expect(filterSkills(skills, "draft", false).map((skill) => skill.id)).toEqual([
      "create-draft",
    ]);
  });

  it("matches skill name by substring", () => {
    expect(filterSkills(skills, "構造", false).map((skill) => skill.id)).toEqual([
      "create-structure",
    ]);
  });

  it("hides create-draft when disabled", () => {
    expect(filterSkills(skills, "", true).map((skill) => skill.id)).toEqual([
      "create-structure",
    ]);
  });
});

describe("filterContentFiles", () => {
  const files = [
    { path: "contents/a/intro.md", name: "intro.md" },
    { path: "contents/b/lesson.md", name: "lesson.md" },
  ];

  it("matches file path substring", () => {
    expect(filterContentFiles(files, "contents/b")).toHaveLength(1);
  });

  it("matches file name substring", () => {
    expect(filterContentFiles(files, "intro")).toHaveLength(1);
  });
});

describe("filterBuiltinCommands", () => {
  it("lists commands when query empty", () => {
    expect(filterBuiltinCommands("").map((command) => command.id)).toEqual(["clear", "export"]);
  });

  it("filters commands by name substring", () => {
    expect(filterBuiltinCommands("export").map((command) => command.id)).toEqual(["export"]);
  });
});
