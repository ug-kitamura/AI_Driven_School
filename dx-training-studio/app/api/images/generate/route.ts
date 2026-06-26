import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { resolveAiApiKey } from "@/lib/api-keys";
import {
  buildImageGenerationMessages,
  parseAiGenerationResponse,
} from "@/lib/ai-image-prompt";
import { resolveUniquePngFileName } from "@/lib/image-slug";
import { saveStagingImage } from "@/lib/image-store";
import { resolveAiModel } from "@/lib/resolve-ai-model";
import { lessonSchema } from "@/lib/schema";

const execFileAsync = promisify(execFile);

const bodySchema = z.object({
  lesson: lessonSchema,
  prompt: z.string().min(1),
});

/** @see https://platform.claude.com/docs/en/about-claude/models/overview */

function resolveApiKey(req: Request): string | null {
  return resolveAiApiKey(req);
}

async function callClaude(
  apiKey: string,
  model: string,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  const data = (await res.json()) as {
    error?: { type?: string; message?: string };
    content?: Array<{ type: string; text?: string }>;
  };

  if (!res.ok) {
    const apiMessage = data.error?.message?.trim();
    const apiType = data.error?.type?.trim();
    const detail =
      apiMessage && apiType && !apiMessage.includes(apiType)
        ? `${apiType}: ${apiMessage}`
        : apiMessage || apiType;
    throw new Error(detail ?? "Claude API error");
  }

  const text = data.content
    ?.filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();

  if (!text) throw new Error("empty Claude response");
  return text;
}

function playwrightHint(): string {
  return "Playwright の Chromium が未導入の可能性があります。start.bat で起動するか、dx-training-studio で npx playwright install chromium を実行してください。";
}

export async function POST(req: Request) {
  const apiKey = resolveApiKey(req);
  if (!apiKey) {
    return Response.json(
      { error: "AI API キーが未設定です。設定ダイアログから入力するか、`.env.local` に AI_API_KEY を設定してください。" },
      { status: 401 },
    );
  }

  const modelResult = resolveAiModel(req);
  if (!modelResult.ok) {
    return Response.json({ error: modelResult.error }, { status: 400 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const json: unknown = await req.json();
    parsed = bodySchema.parse(json);
  } catch {
    return Response.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const { system, user } = buildImageGenerationMessages(parsed.lesson, parsed.prompt);

  let generation: ReturnType<typeof parseAiGenerationResponse>;
  try {
    const raw = await callClaude(apiKey, modelResult.model, system, user);
    generation = parseAiGenerationResponse(raw, parsed.prompt);
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成に失敗しました";
    return Response.json({ error: message }, { status: 502 });
  }

  const projectRoot = process.cwd();
  const fileName = await resolveUniquePngFileName(projectRoot, generation.slug);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dx-img-gen-"));
  const htmlFile = path.join(tmpDir, "fragment.html");
  const pngFile = path.join(tmpDir, "out.png");
  const scriptPath = path.join(projectRoot, "scripts", "render-diagram.mjs");

  try {
    await fs.writeFile(htmlFile, generation.html, "utf8");
    await execFileAsync(process.execPath, [scriptPath, htmlFile, pngFile], {
      cwd: projectRoot,
      timeout: 120_000,
    });
    const png = await fs.readFile(pngFile);
    const file = await saveStagingImage(projectRoot, "ai", fileName, png);
    return Response.json({
      file,
      alt: generation.alt,
      slug: generation.slug,
    });
  } catch (error) {
    const stderr =
      error instanceof Error && "stderr" in error
        ? String((error as { stderr?: string }).stderr).trim()
        : "";
    const message = error instanceof Error ? error.message : "PNG 変換に失敗しました";
    const detail = stderr ? `${message}\n${stderr.slice(0, 500)}` : message;
    const isPlaywright =
      /playwright|chromium|Executable doesn't exist/i.test(detail);
    return Response.json(
      {
        error: isPlaywright ? playwrightHint() : detail,
      },
      { status: 500 },
    );
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
