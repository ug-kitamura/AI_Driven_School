"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EnMetaSection } from "@/components/workspace/translation/EnMetaSection";
import { insertChangelogEntry } from "@/lib/changelog-entry";
import { translateChangelog } from "@/lib/translation/client";

const TEXTAREA_CLASS =
  "w-full rounded-md border border-input bg-white px-3 py-2 font-mono text-xs leading-5 shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

type ChangelogData = {
  exists: boolean;
  content: string;
  mtimeMs: number | null;
};

type Props = {
  onTranslationChanged?: () => void;
};

/**
 * ホームの英語ビュー（studio-translation spec）。
 *
 * 全体メタの英訳フィールドと changelog セクション（changelog.en.md）が連動して
 * 切り替わる。翻訳ボタンは1つで、メタ翻訳と changelog の追訳を両方実行し、
 * 結果を分けて提示する（片方の失敗はもう片方を巻き込まない——EnMetaSection 側の
 * afterTranslate 分離で担保）。追訳の挿入はクライアントが行い、保存までは正本に
 * 書かれない——既存エントリに触れない担保は構造で（AI 下書きと同じ流儀）。
 */
export function HomeEnSection({ onTranslationChanged }: Props) {
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [baseMtimeMs, setBaseMtimeMs] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/content/changelog?language=en")
      .then((res) => res.json())
      .then((data: ChangelogData) => {
        if (cancelled) return;
        setContent(data.content);
        setBaseMtimeMs(data.mtimeMs);
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

  const saveChangelog = () => {
    setErrorText(null);
    setStatusText(null);
    void fetch("/api/content/changelog", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, baseMtimeMs, language: "en" }),
    })
      .then(async (res) => {
        const data = (await res.json()) as {
          mtimeMs?: number | null;
          error?: string;
          content?: string;
        };
        if (res.status === 409) {
          setErrorText(
            `${data.error ?? "外部で変更されています"}（保存し直す前に内容を確認してください）`,
          );
          return;
        }
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setBaseMtimeMs(data.mtimeMs ?? null);
        setDirty(false);
        setStatusText("英語版の履歴を保存しました");
        onTranslationChanged?.();
      })
      .catch((err: unknown) => {
        setErrorText(`保存エラー: ${String(err)}`);
      });
  };

  /** 統合翻訳のうち changelog 側。挿入はここ（クライアント）で行い、保存は人 */
  const translateChangelogSide = async (): Promise<string | null> => {
    const result = await translateChangelog();
    if (result.kind === "full") {
      setContent(result.text);
      setDirty(true);
      return "変更履歴: 全文の英訳を作成しました（「履歴を保存」で確定）";
    }
    setContent((prev) => insertChangelogEntry(prev, result.text));
    setDirty(true);
    return "変更履歴: 不足エントリの英訳を挿入しました（「履歴を保存」で確定）";
  };

  return (
    <EnMetaSection
      level="root"
      names={{}}
      onTranslationChanged={onTranslationChanged}
      translateLabel="メタと変更履歴を翻訳"
      afterTranslate={translateChangelogSide}
      extraSection={
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <Label htmlFor="changelog-en">変更履歴（英語版 changelog.en.md）</Label>
          <textarea
            id="changelog-en"
            value={content}
            disabled={loading}
            rows={12}
            className={TEXTAREA_CLASS}
            placeholder="（英語版はまだありません。「メタと変更履歴を翻訳」で全文の英訳を作れます）"
            onChange={(e) => {
              setContent(e.target.value);
              setDirty(true);
              setStatusText(null);
            }}
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={saveChangelog}
              disabled={loading || !dirty}
            >
              履歴を保存
            </Button>
            {statusText ? (
              <p className="text-xs text-muted-foreground">{statusText}</p>
            ) : null}
            {errorText ? (
              <p className="text-xs text-destructive">{errorText}</p>
            ) : null}
          </div>
        </div>
      }
    />
  );
}
