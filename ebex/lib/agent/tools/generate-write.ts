import fs from "node:fs";
import path from "node:path";
import { resolveToolTargetPath } from "@/lib/agent/tools/fs-guard";
import type { LlmMessage } from "@/lib/agent/llm/types";
import type {
  ToolExecutionContext,
  ToolExecutionOutcome,
} from "@/lib/agent/tools/registry";

/** 1 回の generate_and_write で許容するセクション数の上限 */
export const GENERATE_MAX_SECTIONS = 12;

/** 1 セクションあたりの max_tokens 継続呼び出しの上限 */
export const GENERATE_MAX_CONTINUATIONS_PER_SECTION = 4;

/**
 * 生成合計文字数の上限。
 * replace_between の from_path 読取上限（registry の READ_CHAR_LIMIT）と一致させ、
 * 「生成できたのに差し込めない」不整合を防ぐ。
 */
export const GENERATE_TOTAL_CHAR_LIMIT = 100_000;

/** context_paths の 1 ファイルあたりの読取上限 */
export const GENERATE_CONTEXT_FILE_CHAR_LIMIT = 50_000;

/** 継続呼び出しに添える、生成済み本文の末尾抜粋の長さ */
const PREVIOUS_TAIL_CHAR_LIMIT = 2_000;

/** 子 LLM への固定 system prompt（本文のみ出力の契約） */
const GENERATOR_SYSTEM_PROMPT =
  "あなたはファイル生成器である。指示された成果物の本文のみを出力する。前置き・後書き・説明文・コードフェンス（```）を出力してはならない。出力はそのままファイルへ書き込まれる。";

const CONTINUE_PROMPT =
  "出力が上限で途中終了しました。直前の出力の続きだけを、既出部分を一切繰り返さずに出力してください。";

export const GENERATE_RETRY_GUIDANCE =
  "sections をより細かく分割する、instruction を絞る、または成果物を複数ファイルに分けて再実行してください。";

export type GenerateWriteInput = {
  purpose: string;
  path: string;
  instruction: string;
  sections: string[];
  contextPaths: string[];
};

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string => typeof entry === "string" && !!entry.trim(),
  );
}

export function parseGenerateWriteInput(
  input: Record<string, unknown>,
): GenerateWriteInput | { error: string } {
  const targetPath = nonEmptyString(input.path);
  const instruction = nonEmptyString(input.instruction);
  if (!targetPath) return { error: "path が空です" };
  if (!instruction) return { error: "instruction が空です" };

  const sections = stringArray(input.sections);
  if (sections.length > GENERATE_MAX_SECTIONS) {
    return {
      error: `sections が多すぎます（上限 ${GENERATE_MAX_SECTIONS} 件）。成果物を複数ファイルに分けてください`,
    };
  }

  return {
    purpose: nonEmptyString(input.purpose) ?? "",
    path: targetPath,
    instruction,
    sections,
    contextPaths: stringArray(input.context_paths),
  };
}

type ResolvedContextFile = {
  displayPath: string;
  content: string;
  truncated: boolean;
};

/**
 * context_paths を読取ゾーン（プロジェクト配下＋実行中スキル配下）で解決し、
 * 内容を読取上限つきで収集する。ゾーン外・不存在はエラー。
 */
export function resolveGenerateContextFiles(
  context: ToolExecutionContext,
  contextPaths: string[],
): ResolvedContextFile[] | { error: string } {
  const files: ResolvedContextFile[] = [];
  for (const entry of contextPaths) {
    const resolved = resolveToolTargetPath(
      context.projectRoot,
      context.projectFolderId,
      entry,
      {
        skillId: context.skillId,
        skillDirAbsolute: context.skillDirAbsolute,
        preferSkillIfExists: true,
      },
    );
    if ("error" in resolved) return { error: resolved.error };
    if (!resolved.insideProject && !resolved.insideSkill) {
      return {
        error: `context_paths はプロジェクト内または実行中スキル配下のみ指定できます: ${resolved.relativePath}`,
      };
    }
    if (
      !fs.existsSync(resolved.absolutePath) ||
      !fs.statSync(resolved.absolutePath).isFile()
    ) {
      return { error: `ファイルが見つかりません: ${resolved.relativePath}` };
    }
    const raw = fs.readFileSync(resolved.absolutePath, "utf-8");
    const truncated = raw.length > GENERATE_CONTEXT_FILE_CHAR_LIMIT;
    files.push({
      displayPath: resolved.relativePath,
      content: truncated ? raw.slice(0, GENERATE_CONTEXT_FILE_CHAR_LIMIT) : raw,
      truncated,
    });
  }
  return files;
}

function buildSectionPrompt(
  input: GenerateWriteInput,
  contextFiles: ResolvedContextFile[],
  sectionIndex: number,
  previousTail: string,
): string {
  const lines: string[] = ["# 生成指示", input.instruction.trim()];

  if (contextFiles.length > 0) {
    lines.push("", "# 参考資料");
    for (const file of contextFiles) {
      lines.push(
        "",
        `## ${file.displayPath}${file.truncated ? "（先頭のみ抜粋）" : ""}`,
        file.content,
      );
    }
  }

  if (input.sections.length > 0) {
    lines.push(
      "",
      "# 全体のセクション構成",
      ...input.sections.map((section, i) => `${i + 1}. ${section}`),
      "",
      "# 今回出力する範囲",
      `セクション ${sectionIndex + 1}: ${input.sections[sectionIndex]}`,
      "このセクションの本文のみを出力すること。他のセクションの内容を出力してはならない。",
    );
  }

  if (previousTail) {
    lines.push(
      "",
      "# 直前までに生成済みの本文（末尾抜粋。繰り返さず、この続きとして自然につながるように出力する）",
      previousTail,
    );
  }

  return lines.join("\n");
}

/** 出力全体がコードフェンスで囲まれている場合のみ剥がす（防御的救済） */
export function stripEnclosingCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = /^```[^\n]*\n([\s\S]*?)\n?```$/.exec(trimmed);
  return match ? match[1] : text;
}

function errorOutcome(message: string): ToolExecutionOutcome {
  return {
    result: { error: message },
    display: { summary: "error", display: `✗ ${message}` },
  };
}

function generateFailureOutcome(
  message: string,
  completedSections: number,
): ToolExecutionOutcome {
  return {
    result: {
      error: message,
      completedSections,
      recoverable: true,
      guidance: GENERATE_RETRY_GUIDANCE,
    },
    display: { summary: "error", display: `✗ ${message}` },
  };
}

/**
 * generate_and_write の実行本体。
 * 親の tool 引数には本文を載せず、サーバ内の子 LLM 呼び出しで
 * セクションごとに本文を生成（max_tokens 継続つき）し、
 * 全セクション完了後に 1 回でファイルへ書き込む（途中失敗ではファイルを残さない）。
 */
export async function executeGenerateAndWrite(
  context: ToolExecutionContext,
  input: Record<string, unknown>,
): Promise<ToolExecutionOutcome> {
  const generate = context.generate;
  if (!generate) {
    return errorOutcome(
      "generate_and_write を実行するための LLM 設定がありません",
    );
  }

  const parsed = parseGenerateWriteInput(input);
  if ("error" in parsed) return errorOutcome(parsed.error);

  const targetResolved = resolveToolTargetPath(
    context.projectRoot,
    context.projectFolderId,
    parsed.path,
    {
      skillId: context.skillId,
      skillDirAbsolute: context.skillDirAbsolute,
      preferSkillIfExists: false,
    },
  );
  if ("error" in targetResolved) return errorOutcome(targetResolved.error);
  if (targetResolved.insideSkill) {
    return errorOutcome(
      `スキルディレクトリへの書込はできません: ${targetResolved.relativePath}`,
    );
  }

  const contextFiles = resolveGenerateContextFiles(
    context,
    parsed.contextPaths,
  );
  if ("error" in contextFiles) return errorOutcome(contextFiles.error);

  const startedAt = Date.now();
  const sectionCount = Math.max(parsed.sections.length, 1);
  const sectionTexts: string[] = [];
  let totalContinuations = 0;

  for (let i = 0; i < sectionCount; i += 1) {
    const generatedSoFar = sectionTexts.join("\n\n");
    const previousTail = generatedSoFar.slice(-PREVIOUS_TAIL_CHAR_LIMIT);
    const firstPrompt = buildSectionPrompt(
      parsed,
      contextFiles,
      i,
      previousTail,
    );

    let sectionText = "";
    let continuations = 0;

    try {
      let messages: LlmMessage[] = [{ role: "user", content: firstPrompt }];
      for (;;) {
        const turn = await generate.provider.runTurn({
          apiKey: generate.apiKey,
          model: generate.model,
          system: GENERATOR_SYSTEM_PROMPT,
          messages,
          tools: [],
          maxTokens: generate.maxTokens,
          signal: generate.signal,
        });
        sectionText += turn.text;

        const totalChars =
          generatedSoFar.length +
          (generatedSoFar ? 2 : 0) +
          sectionText.length;
        if (totalChars > GENERATE_TOTAL_CHAR_LIMIT) {
          return generateFailureOutcome(
            `生成合計サイズが上限（${GENERATE_TOTAL_CHAR_LIMIT} 文字）を超えました`,
            sectionTexts.length,
          );
        }

        if (turn.stopReason !== "max_tokens") break;
        if (continuations >= GENERATE_MAX_CONTINUATIONS_PER_SECTION) {
          return generateFailureOutcome(
            `セクション ${i + 1} の生成が継続上限（${GENERATE_MAX_CONTINUATIONS_PER_SECTION} 回）でも完了しませんでした`,
            sectionTexts.length,
          );
        }
        continuations += 1;
        totalContinuations += 1;
        messages = [
          { role: "user", content: firstPrompt },
          { role: "assistant", content: sectionText },
          { role: "user", content: CONTINUE_PROMPT },
        ];
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "子 LLM 呼び出しに失敗しました";
      return generateFailureOutcome(
        `生成に失敗しました: ${message}`,
        sectionTexts.length,
      );
    }

    const cleaned = stripEnclosingCodeFence(sectionText).trim();
    if (!cleaned) {
      return generateFailureOutcome(
        `セクション ${i + 1} の生成結果が空でした`,
        sectionTexts.length,
      );
    }
    sectionTexts.push(cleaned);
  }

  const output = sectionTexts.join("\n\n");
  fs.mkdirSync(path.dirname(targetResolved.absolutePath), { recursive: true });
  fs.writeFileSync(targetResolved.absolutePath, output, "utf-8");
  const bytes = Buffer.byteLength(output, "utf-8");
  const durationMs = Date.now() - startedAt;

  return {
    result: {
      path: targetResolved.relativePath,
      bytes,
      sections: sectionCount,
      continuations: totalContinuations,
      durationMs,
    },
    display: {
      summary: `${bytes} bytes`,
      display: `🪄 生成書込: ${targetResolved.relativePath}（${bytes} bytes・${sectionCount} セクション・継続 ${totalContinuations} 回）`,
    },
  };
}
