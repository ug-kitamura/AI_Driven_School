import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import {
  buildImageGenerationMessages,
  isUnsupportedPhotoResponse,
} from "@/lib/ai-image-prompt";
import { sanitizeUploadFileName } from "@/lib/image-path";
import { saveStagingImage } from "@/lib/image-store";
import { listLessonImageSlots } from "@/lib/lesson-image-slots";
import { lessonSchema } from "@/lib/schema";

const execFileAsync = promisify(execFile);

const bodySchema = z.object({
  lesson: lessonSchema,
  canonicalPath: z.string().min(1),
});

/** @see https://platform.claude.com/docs/en/about-claude/models/overview */
const DEFAULT_MODEL = "claude-sonnet-4-6";

function resolveApiKey(req: Request): string | null {
  const header = req.headers.get("x-anthropic-api-key")?.trim();
  if (header) return header;
  const env = process.env.ANTHROPIC_API_KEY?.trim();
  return env || null;
}

async function callClaude(apiKey: string, system: string, user: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
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

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const m = trimmed.match(/^```(?:html)?\s*([\s\S]*?)```$/i);
  return m ? m[1].trim() : trimmed;
}

function playwrightHint(): string {
  return "Playwright の Chromium が未導入の可能性があります。start.bat で起動するか、dx-training-editor で npx playwright install chromium を実行してください。";
}

export async function POST(req: Request) {
  const apiKey = resolveApiKey(req);
  if (!apiKey) {
    return Response.json(
      { error: "Anthropic API キーが未設定です。設定ダイアログから入力してください。" },
      { status: 401 },
    );
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const json: unknown = await req.json();
    parsed = bodySchema.parse(json);
  } catch {
    return Response.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const slots = await listLessonImageSlots(process.cwd(), parsed.lesson);
  const slot = slots.find((s) => s.canonicalPath === parsed.canonicalPath);
  if (!slot) {
    return Response.json({ error: "スロットが見つかりません" }, { status: 404 });
  }

  const { system, user } = buildImageGenerationMessages(parsed.lesson, slot);

  let htmlFragment: string;
  try {
    htmlFragment = stripCodeFences(await callClaude(apiKey, system, user));
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成に失敗しました";
    return Response.json({ error: message }, { status: 502 });
  }

  if (isUnsupportedPhotoResponse(htmlFragment)) {
    return Response.json(
      { error: "[photo] スロットの外部画像生成は未対応です" },
      { status: 422 },
    );
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dx-img-gen-"));
  const htmlFile = path.join(tmpDir, "fragment.html");
  const pngFile = path.join(tmpDir, "out.png");
  const scriptPath = path.join(process.cwd(), "scripts", "render-diagram.mjs");

  try {
    await fs.writeFile(htmlFile, htmlFragment, "utf8");
    await execFileAsync(process.execPath, [scriptPath, htmlFile, pngFile], {
      cwd: process.cwd(),
      timeout: 120_000,
    });
    const png = await fs.readFile(pngFile);
    const file = await saveStagingImage(
      process.cwd(),
      "ai",
      sanitizeUploadFileName(slot.fileName),
      png,
    );
    return Response.json({ file });
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
