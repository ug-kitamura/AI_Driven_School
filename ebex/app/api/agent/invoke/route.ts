import { z } from "zod";
import {
  buildSkillSystemPrompt,
  getSkillCatalogRoots,
  loadSkill,
  resolveSkillDir,
} from "@/lib/agent/skill-loader";
import {
  enrichUserMessageWithAttachments,
  resolveAttachmentsForMessage,
} from "@/lib/agent/workspace-file-attachments";
import { createAgentLoopSseStream, runAgentLoop } from "@/lib/agent/agent-loop";
import { clientMessagesToLlmMessages } from "@/lib/agent/message-history";
import {
  buildSkillRuntimeContext,
  mergeSkillSystemPrompt,
} from "@/lib/agent/skill-runtime-context";
import { skillMentionsSubagent, SUBAGENT_FALLBACK_MODEL_HINT } from "@/lib/agent/subagent-fallback";
import { markProjectFolderAgentActive } from "@/lib/agent/active-project-folders";

const toolEventSchema = z.object({
  name: z.string(),
  phase: z.enum(["start", "end"]),
  toolUseId: z.string().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  summary: z.string().optional(),
  display: z.string(),
  result: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const attachmentSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
});

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  toolEvents: z.array(toolEventSchema).optional(),
  attachments: z.array(attachmentSchema).optional(),
});

const runtimeFocusSchema = z.object({
  projectFolderId: z.string(),
  currentFileRelativePath: z.string().nullable().optional(),
  preferredOutputDir: z.string().optional(),
});

const bodySchema = z.object({
  skillId: z.string().min(1),
  variables: z.record(z.string(), z.string()).optional(),
  messages: z.array(messageSchema).min(1),
  runtimeFocus: runtimeFocusSchema.optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const projectRoot = process.cwd();
  const skillRoots = getSkillCatalogRoots(projectRoot);
  const skill = loadSkill(skillRoots, parsed.data.skillId);
  if (!skill) {
    return Response.json(
      { error: `スキルが見つかりません: ${parsed.data.skillId}` },
      { status: 404 },
    );
  }

  const variables = parsed.data.variables ?? {};
  const { prompt, missingVariables } = buildSkillSystemPrompt(skill, variables);
  if (missingVariables.length > 0) {
    return Response.json(
      {
        error: `必須変数が不足しています: ${missingVariables.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const focus = parsed.data.runtimeFocus;
  const mentionsSubagent = skillMentionsSubagent(skill.body);
  let systemPrompt = prompt;
  if (focus?.projectFolderId) {
    let runtime = buildSkillRuntimeContext({
      projectFolderId: focus.projectFolderId,
      currentFileRelativePath: focus.currentFileRelativePath,
      skillId: skill.id,
      mentionsSubagent,
    });
    if (focus.preferredOutputDir !== undefined) {
      const dirLabel =
        focus.preferredOutputDir === ""
          ? "プロジェクトフォルダ直下"
          : focus.preferredOutputDir;
      runtime += `\n\nユーザが選んだ出力先の優先候補: \`${dirLabel}\`。`;
    }
    systemPrompt = mergeSkillSystemPrompt(prompt, runtime);
  } else if (mentionsSubagent) {
    systemPrompt = mergeSkillSystemPrompt(
      prompt,
      `## EBEX ランタイム\n\n${SUBAGENT_FALLBACK_MODEL_HINT}`,
    );
  }

  const historyMessages = parsed.data.messages.slice(0, -1);
  const latestMessage = parsed.data.messages[parsed.data.messages.length - 1];
  if (!latestMessage || latestMessage.role !== "user") {
    return Response.json({ error: "Last message must be from user" }, { status: 400 });
  }

  const structuredPaths = latestMessage.attachments?.map((item) => item.path);
  const attachments = resolveAttachmentsForMessage(
    projectRoot,
    latestMessage.content,
    structuredPaths,
  );
  if ("error" in attachments) {
    return Response.json({ error: attachments.error }, { status: 400 });
  }

  const enrichedLatest = {
    ...latestMessage,
    content: enrichUserMessageWithAttachments(
      latestMessage.content,
      attachments.attachments,
    ),
  };

  const invokeMessages = [...historyMessages, enrichedLatest];
  const llmMessages = clientMessagesToLlmMessages(invokeMessages);
  const toolNames = skill.tools ?? [];
  const skillDirAbsolute = resolveSkillDir(skillRoots, skill.id) ?? undefined;

  const releaseActiveFolder = focus?.projectFolderId
    ? markProjectFolderAgentActive(focus.projectFolderId)
    : () => {};

  const stream = createAgentLoopSseStream(async (emit) => {
    try {
      return await runAgentLoop({
        req,
        system: systemPrompt,
        messages: llmMessages,
        toolNames,
        emit,
        signal: req.signal,
        projectFolderId: focus?.projectFolderId,
        skillId: skill.id,
        skillDirAbsolute,
      });
    } finally {
      releaseActiveFolder();
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
