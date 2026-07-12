import { resolveAiApiKey } from "@/lib/api-keys";
import { AI_KEY_ERROR } from "@/lib/agent/llm/anthropic";
import type { LlmMessage } from "@/lib/agent/llm/types";
import { resolveLlmProvider } from "@/lib/agent/llm/resolve-provider";

export const FOLDER_NAME_MAX_TOKENS = 60;
export const FOLDER_NAME_SLUG_MAX = 40;

export const FOLDER_NAME_SYSTEM_PROMPT = `あなたはプロジェクトフォルダ名の生成器です。
与えられたファイルパス一覧だけを手がかりに、フォルダ名を1行だけ出力してください。

ルール:
- 形式は必ず {YYYYMMDD}-{slug}
- slug は半角英小文字・数字・ハイフン中心（日本語を含めてもよいが短く）
- 最大40文字程度の slug
- 引用符・説明・箇条書きは不要
- ファイルの中身は渡されない。パス名から主題を推定すること
- 日付はパス名から読み取れる場合のみその日付を使い、判断できない場合は今日の日付（ユーザーメッセージに記載）を使う`;

function formatDateYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function sanitizeFolderSlug(raw: string): string {
  const base = raw
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, FOLDER_NAME_SLUG_MAX);
  return base || "untitled";
}

export function normalizeSuggestedFolderName(
  raw: string,
  today: Date = new Date(),
): string {
  const todayYmd = formatDateYmd(today);
  const singleLine = raw
    .trim()
    .split(/\r?\n/)[0]
    ?.trim()
    .replace(/^["'「『]+|["'」』]+$/g, "")
    .trim();

  if (!singleLine) {
    return `${todayYmd}-untitled`;
  }

  const dated = singleLine.match(/^(\d{8})-(.+)$/);
  if (dated?.[1] && dated[2]) {
    return `${dated[1]}-${sanitizeFolderSlug(dated[2])}`;
  }

  return `${todayYmd}-${sanitizeFolderSlug(singleLine)}`;
}

export function buildFolderNameUserPrompt(
  relativePaths: string[],
  today: Date = new Date(),
): string {
  const todayYmd = formatDateYmd(today);
  const list =
    relativePaths.length > 0
      ? relativePaths.map((p) => `- ${p}`).join("\n")
      : "(empty)";
  return `今日の日付: ${todayYmd}\n\nファイルパス一覧:\n${list}`;
}

export function buildFolderNameMessages(
  relativePaths: string[],
  today: Date = new Date(),
): LlmMessage[] {
  return [
    {
      role: "user",
      content: buildFolderNameUserPrompt(relativePaths, today),
    },
  ];
}

export type GenerateFolderNameResult =
  | { ok: true; name: string }
  | { ok: false; error: string; status: number };

export async function generateFolderNameFromPaths(
  req: Request,
  relativePaths: string[],
  today: Date = new Date(),
): Promise<GenerateFolderNameResult> {
  if (relativePaths.length === 0) {
    return { ok: true, name: `${formatDateYmd(today)}-untitled` };
  }

  const apiKey = resolveAiApiKey(req);
  if (!apiKey) {
    return { ok: false, error: AI_KEY_ERROR, status: 401 };
  }

  const providerResult = resolveLlmProvider(req);
  if (!providerResult.ok) {
    return {
      ok: false,
      error: providerResult.error,
      status: providerResult.status,
    };
  }

  const turn = await providerResult.provider.runTurn({
    apiKey,
    model: providerResult.model,
    system: FOLDER_NAME_SYSTEM_PROMPT,
    messages: buildFolderNameMessages(relativePaths, today),
    tools: [],
    maxTokens: FOLDER_NAME_MAX_TOKENS,
    signal: req.signal,
  });

  return {
    ok: true,
    name: normalizeSuggestedFolderName(turn.text, today),
  };
}
