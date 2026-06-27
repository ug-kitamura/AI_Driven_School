import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  buildSkillSystemPrompt,
  injectSkillVariables,
  listSkills,
  loadSkill,
  parseSkillDocument,
} from "@/lib/agent/skill-loader";

function writeSkill(
  root: string,
  id: string,
  frontmatter: string,
  body: string,
) {
  const dir = path.join(root, ".claude", "skills", id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "SKILL.md"), `---\n${frontmatter}\n---\n\n${body}`, "utf-8");
}

describe("skill-loader", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-loader-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("parses frontmatter name, description, and variables", () => {
    const parsed = parseSkillDocument(`---
name: create-draft
description: |
  選択中レッスンの草稿を生成する
variables:
  - series
  - course
---

Generate a draft for {{series}} / {{course}}.`);

    expect(parsed.name).toBe("create-draft");
    expect(parsed.description).toBe("選択中レッスンの草稿を生成する");
    expect(parsed.variables).toEqual(["series", "course"]);
    expect(parsed.body).toContain("Generate a draft");
  });

  it("injects variables into skill body", () => {
    const result = injectSkillVariables("Series: {{series}}", { series: "DX基礎" });
    expect(result).toBe("Series: DX基礎");
  });

  it("lists skills in alphabetical order", () => {
    writeSkill(tmpDir, "create-draft", "name: draft\ndescription: d", "body");
    writeSkill(tmpDir, "create-structure", "name: structure\ndescription: s", "body");
    writeSkill(tmpDir, "alpha-skill", "name: alpha\ndescription: a", "body");

    const skills = listSkills(tmpDir);
    expect(skills.map((skill) => skill.id)).toEqual([
      "alpha-skill",
      "create-draft",
      "create-structure",
    ]);
  });

  it("returns null when skill is missing", () => {
    expect(loadSkill(tmpDir, "missing-skill")).toBeNull();
  });

  it("reports missing variables before invoke", () => {
    const skill = {
      id: "create-draft",
      name: "draft",
      description: "",
      variables: ["series", "course", "contextItems"],
      body: "{{series}}",
    };
    const { missingVariables } = buildSkillSystemPrompt(skill, {
      series: "A",
      contextItems: "[]",
    });
    expect(missingVariables).toEqual(["course"]);
  });
});
