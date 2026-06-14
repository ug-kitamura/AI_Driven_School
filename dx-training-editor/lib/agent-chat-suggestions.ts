import type { SkillSummary } from "@/lib/agent/skill-loader";

export type AgentFileOption = {
  path: string;
  name: string;
};

export type AgentBuiltinCommand = {
  id: "clear" | "export";
  name: string;
  description: string;
};

export const AGENT_BUILTIN_COMMANDS: AgentBuiltinCommand[] = [
  {
    id: "clear",
    name: "会話を削除",
    description: "現在のセッションを履歴から削除します",
  },
  {
    id: "export",
    name: "会話をエクスポート",
    description: "現在のセッションを Markdown でダウンロードします",
  },
];

export function filterBuiltinCommands(
  query: string,
): AgentBuiltinCommand[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return AGENT_BUILTIN_COMMANDS;
  return AGENT_BUILTIN_COMMANDS.filter((command) => {
    const haystack = `${command.id} ${command.name} ${command.description}`.toLowerCase();
    return haystack.includes(normalized);
  });
}

export function filterSkills(
  skills: SkillSummary[],
  query: string,
  createDraftDisabled: boolean,
): SkillSummary[] {
  const normalized = query.trim().toLowerCase();
  return skills
    .filter((skill) => {
      if (skill.id === "create-draft" && createDraftDisabled) return false;
      if (!normalized) return true;
      const haystack = `${skill.id} ${skill.name} ${skill.description}`.toLowerCase();
      return haystack.includes(normalized);
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function orderSlashSuggestionItems<
  TSkill extends { id: string },
  TCommand extends { id: string },
>(skills: TSkill[], commands: TCommand[]): Array<
  | { kind: "skill"; item: TSkill }
  | { kind: "command"; item: TCommand }
> {
  return [
    ...skills.map((item) => ({ kind: "skill" as const, item })),
    ...commands.map((item) => ({ kind: "command" as const, item })),
  ];
}

export function filterContentFiles(
  files: AgentFileOption[],
  query: string,
): AgentFileOption[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return files;
  return files.filter((file) => {
    const haystack = `${file.path} ${file.name}`.toLowerCase();
    return haystack.includes(normalized);
  });
}
