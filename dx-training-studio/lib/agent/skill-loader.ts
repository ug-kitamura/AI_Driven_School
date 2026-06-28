import fs from "node:fs";
import path from "node:path";

export type SkillSummary = {
  id: string;
  name: string;
  description: string;
};

export type LoadedSkill = SkillSummary & {
  body: string;
  variables: string[];
  tools: string[];
};

const SKILLS_DIR = path.join(".claude", "skills");
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function getSkillsDir(projectRoot: string): string {
  return path.join(projectRoot, SKILLS_DIR);
}

export function listSkills(projectRoot: string): SkillSummary[] {
  const skillsDir = getSkillsDir(projectRoot);
  if (!fs.existsSync(skillsDir)) return [];

  const entries = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const skills: SkillSummary[] = [];
  for (const id of entries) {
    const skill = loadSkill(projectRoot, id);
    if (skill) {
      skills.push({ id: skill.id, name: skill.name, description: skill.description });
    }
  }
  return skills;
}

export function loadSkill(projectRoot: string, skillId: string): LoadedSkill | null {
  const skillPath = path.join(getSkillsDir(projectRoot), skillId, "SKILL.md");
  if (!fs.existsSync(skillPath)) return null;

  const raw = fs.readFileSync(skillPath, "utf-8");
  const parsed = parseSkillDocument(raw);
  return {
    id: skillId,
    name: parsed.name || skillId,
    description: parsed.description,
    variables: parsed.variables,
    tools: parsed.tools,
    body: parsed.body,
  };
}

export function injectSkillVariables(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      return variables[key] ?? "";
    }
    return match;
  });
}

export function buildSkillSystemPrompt(
  skill: LoadedSkill,
  variables: Record<string, string>,
): { prompt: string; missingVariables: string[] } {
  const missingVariables = skill.variables.filter(
    (name) => !Object.prototype.hasOwnProperty.call(variables, name),
  );
  return {
    prompt: injectSkillVariables(skill.body, variables),
    missingVariables,
  };
}

export function parseSkillDocument(raw: string): {
  name: string;
  description: string;
  variables: string[];
  tools: string[];
  body: string;
} {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    return { name: "", description: "", variables: [], tools: [], body: raw.trim() };
  }

  const frontmatter = parseSkillFrontmatter(match[1]);
  return {
    name: frontmatter.name,
    description: frontmatter.description,
    variables: frontmatter.variables,
    tools: frontmatter.tools,
    body: match[2].trim(),
  };
}

function parseSkillFrontmatter(yaml: string): {
  name: string;
  description: string;
  variables: string[];
  tools: string[];
} {
  let name = "";
  let description = "";
  const variables: string[] = [];
  const tools: string[] = [];
  let inDescription = false;
  let inVariables = false;
  let inTools = false;
  let descriptionIndent = 0;

  const lines = yaml.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (inDescription) {
      const indent = line.length - line.trimStart().length;
      if (indent > descriptionIndent && line.trimStart().length > 0) {
        description += (description ? "\n" : "") + line.trimStart();
        continue;
      }
      inDescription = false;
    }

    if (inVariables) {
      if (/^-\s+/.test(trimmed)) {
        variables.push(trimmed.slice(2).trim());
        continue;
      }
      inVariables = false;
    }

    if (inTools) {
      if (/^-\s+/.test(trimmed)) {
        tools.push(trimmed.slice(2).trim());
        continue;
      }
      inTools = false;
    }

    if (trimmed.startsWith("variables:")) {
      const inline = trimmed.slice("variables:".length).trim();
      if (inline.startsWith("[") && inline.endsWith("]")) {
        const inner = inline.slice(1, -1);
        for (const item of inner.split(",")) {
          const value = item.trim();
          if (value) variables.push(value);
        }
      } else if (!inline) {
        inVariables = true;
      }
      continue;
    }

    if (trimmed.startsWith("tools:")) {
      const inline = trimmed.slice("tools:".length).trim();
      if (inline.startsWith("[") && inline.endsWith("]")) {
        const inner = inline.slice(1, -1);
        for (const item of inner.split(",")) {
          const value = item.trim();
          if (value) tools.push(value);
        }
      } else if (!inline) {
        inTools = true;
      }
      continue;
    }

    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    const rawValue = trimmed.slice(colon + 1);
    const value = rawValue.trim();

    switch (key) {
      case "name":
        name = value;
        break;
      case "description":
        if (value === "|" || value === ">") {
          inDescription = true;
          descriptionIndent = line.length - line.trimStart().length;
          description = "";
        } else {
          description = stripQuotes(value);
        }
        break;
      default:
        break;
    }
  }

  return { name, description: description.trim(), variables, tools };
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
