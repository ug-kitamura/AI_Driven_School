import { z } from "zod";
import {
  buildSkillSystemPrompt,
  loadSkill,
} from "@/lib/agent/skill-loader";
import {
  enrichUserMessageWithAttachments,
  resolveAttachmentsForMessage,
} from "@/lib/agent/file-attachments";
import {
  streamAnthropicMessages,
  type AnthropicMessage,
} from "@/lib/agent/anthropic-stream";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const bodySchema = z.object({
  skillId: z.string().min(1),
  variables: z.record(z.string(), z.string()).optional(),
  messages: z.array(messageSchema).min(1),
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
  const skill = loadSkill(projectRoot, parsed.data.skillId);
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

  const anthropicMessages: AnthropicMessage[] = [];
  for (let i = 0; i < parsed.data.messages.length; i++) {
    const message = parsed.data.messages[i];
    if (message.role !== "user") {
      anthropicMessages.push(message);
      continue;
    }

    const attachments = resolveAttachmentsForMessage(projectRoot, message.content);
    if ("error" in attachments) {
      return Response.json({ error: attachments.error }, { status: 400 });
    }

    anthropicMessages.push({
      role: "user",
      content: enrichUserMessageWithAttachments(message.content, attachments.attachments),
    });
  }

  return streamAnthropicMessages({
    req,
    system: prompt,
    messages: anthropicMessages,
  });
}
