"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LessonDiffView } from "@/components/workspace/LessonDiffView";
import { aiRequestHeaders, AI_KEY_ERROR } from "@/lib/agent-request-headers";
import {
  CHANGELOG_INITIAL_TEMPLATE,
  CHANGELOG_PROMISE_TEXT,
  insertChangelogEntry,
} from "@/lib/changelog-entry";
import { createLessonContentDiff } from "@/lib/lesson-content-diff";
import { loadWorkspaceSettings } from "@/lib/workspace-settings";

/** GET /api/content/changelog の応答 */
type ChangelogData = {
  exists: boolean;
  content: string;
  mtimeMs: number | null;
  firstEntryDate: string | null;
};

type DraftResponse = {
  entry: string | null;
  notes: string[];
  baselineDate: string | null;
  usedLessons: { series: string; course: string; lesson: string }[];
  truncated: boolean;
  message?: string;
  error?: string;
};

const TEXTAREA_CLASS =
  "w-full rounded-md border border-input bg-white px-3 py-2 font-mono text-xs leading-5 shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

/**
 * ホームのペイン2・GitHub リンクの下に置く変更履歴の編集セクション。
 *
 * - 正本は `contents/changelog.md`（⚠ 生成物 `mandala/content/changelog.md` と
 *   1 文字違い。ここが触るのは contents/ 側だけ）
 * - 手動編集が一次手段。保存はこのセクション専用のボタンで行う
 *   （全体メタの保存と混ぜない——対象ファイルが違う）
 * - AI 下書きは「新規エントリ」だけを受け取り、挿入はクライアントが行う。
 *   差分を見て人が採否するまで正本は変わらない
 */
export function WorkspaceChangelogSection() {
  // 既定は折りたたみ。全体メタの編集を主役に保ち、履歴は必要なときだけ開く
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [baseMtimeMs, setBaseMtimeMs] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // AI 下書き
  const [sinceDate, setSinceDate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [draftEntry, setDraftEntry] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<string[]>([]);
  const [draftInfo, setDraftInfo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/content/changelog")
      .then((res) => res.json())
      .then((data: ChangelogData) => {
        if (cancelled) return;
        setContent(data.content);
        setBaseMtimeMs(data.mtimeMs);
        if (data.firstEntryDate) setSinceDate(data.firstEntryDate);
      })
      .catch(() => {
        // 読み込めなくても空から編集を始められる
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = (nextContent: string, onDone?: () => void) => {
    setErrorText(null);
    setStatusText(null);
    void fetch("/api/content/changelog", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: nextContent, baseMtimeMs }),
    })
      .then(async (res) => {
        const data = (await res.json()) as {
          ok?: boolean;
          mtimeMs?: number | null;
          error?: string;
          content?: string;
        };
        if (res.status === 409) {
          setErrorText(
            `${data.error ?? "外部で変更されています"}（再読込すると外部の内容に置き換わります）`,
          );
          return;
        }
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setContent(nextContent);
        setBaseMtimeMs(data.mtimeMs ?? null);
        setDirty(false);
        setStatusText("保存しました");
        onDone?.();
      })
      .catch((err: unknown) => {
        setErrorText(`保存エラー: ${String(err)}`);
      });
  };

  const reload = () => {
    setLoading(true);
    setErrorText(null);
    void fetch("/api/content/changelog")
      .then((res) => res.json())
      .then((data: ChangelogData) => {
        setContent(data.content);
        setBaseMtimeMs(data.mtimeMs);
        setDirty(false);
      })
      .finally(() => setLoading(false));
  };

  const generateDraft = () => {
    setGenerating(true);
    setErrorText(null);
    setStatusText(null);
    setDraftEntry(null);
    setDraftNotes([]);
    setDraftInfo(null);
    const settings = loadWorkspaceSettings();
    void fetch("/api/content/changelog/draft", {
      method: "POST",
      headers: aiRequestHeaders(settings),
      body: JSON.stringify(sinceDate ? { since: sinceDate } : {}),
    })
      .then(async (res) => {
        const data = (await res.json()) as DraftResponse;
        if (res.status === 401) {
          setErrorText(AI_KEY_ERROR);
          return;
        }
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        if (!data.entry) {
          setDraftInfo(data.message ?? "下書きは生成されませんでした");
          return;
        }
        setDraftEntry(data.entry);
        setDraftNotes(data.notes);
        setDraftInfo(
          `対象 ${data.usedLessons.length} レッスン${data.truncated ? "（多数のため一部に絞りました）" : ""}`,
        );
      })
      .catch((err: unknown) => {
        setErrorText(`下書きエラー: ${String(err)}`);
      })
      .finally(() => setGenerating(false));
  };

  const proposedContent =
    draftEntry !== null ? insertChangelogEntry(content, draftEntry) : null;

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <button
        type="button"
        className="flex items-center gap-1 text-sm font-medium text-foreground"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="size-4" aria-hidden />
        ) : (
          <ChevronRight className="size-4" aria-hidden />
        )}
        変更履歴
      </button>
      {open ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            公開サイトの変更履歴ページの正本（contents/changelog.md）。
            {CHANGELOG_PROMISE_TEXT}
          </p>
          <textarea
            aria-label="変更履歴"
            value={content}
            disabled={loading}
            rows={12}
            className={TEXTAREA_CLASS}
            placeholder={CHANGELOG_INITIAL_TEMPLATE}
            onChange={(e) => {
              setContent(e.target.value);
              setDirty(true);
              setStatusText(null);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => save(content)}
              disabled={loading || !dirty}
            >
              履歴を保存
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={generateDraft}
              disabled={loading || generating}
            >
              {generating ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-4" aria-hidden />
              )}
              AI で下書き
            </Button>
            <div className="ml-auto flex items-center gap-1">
              <Label
                htmlFor="changelog-since"
                className="text-xs text-muted-foreground"
              >
                基準日
              </Label>
              <Input
                id="changelog-since"
                type="date"
                value={sinceDate}
                onChange={(e) => setSinceDate(e.target.value)}
                className="h-8 w-36 text-xs"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            AI は基準日以降に更新されたレッスンを材料にします。clone
            直後などはファイルの更新時刻が当てにならないため、基準日を指定し直してください。
          </p>
          {statusText ? (
            <p className="text-xs text-muted-foreground">{statusText}</p>
          ) : null}
          {errorText ? (
            <div className="flex items-center gap-2">
              <p className="text-xs text-destructive">{errorText}</p>
              <Button size="sm" variant="outline" onClick={reload}>
                再読込
              </Button>
            </div>
          ) : null}
          {draftInfo && draftEntry === null ? (
            <p className="text-xs text-muted-foreground">{draftInfo}</p>
          ) : null}
          {draftEntry !== null && proposedContent !== null ? (
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <p className="text-xs font-medium">
                AI 下書き（編集してから反映できます）
                {draftInfo ? (
                  <span className="ml-2 font-normal text-muted-foreground">
                    {draftInfo}
                  </span>
                ) : null}
              </p>
              <textarea
                aria-label="AI 下書きエントリ"
                value={draftEntry}
                rows={8}
                className={TEXTAREA_CLASS}
                onChange={(e) => setDraftEntry(e.target.value)}
              />
              {draftNotes.length > 0 ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
                  <p className="text-xs font-medium">
                    AI からの指摘（履歴には書き込まれません）
                  </p>
                  <ul className="list-disc pl-4 text-xs">
                    {draftNotes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="max-h-64 overflow-auto rounded border border-border">
                <LessonDiffView
                  diff={createLessonContentDiff(
                    "contents/changelog.md",
                    content,
                    proposedContent,
                  )}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    save(proposedContent, () => {
                      setDraftEntry(null);
                      setDraftNotes([]);
                      setDraftInfo(null);
                    })
                  }
                >
                  この内容で保存
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDraftEntry(null);
                    setDraftNotes([]);
                    setDraftInfo(null);
                  }}
                >
                  破棄
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
