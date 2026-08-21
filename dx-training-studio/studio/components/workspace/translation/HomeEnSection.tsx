"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { EnMetaSection } from "@/components/workspace/translation/EnMetaSection";
import { insertChangelogEntry } from "@/lib/changelog-entry";
import {
  translateChangelog,
  type TranslationFreshness,
} from "@/lib/translation/client";

const TEXTAREA_CLASS =
  "w-full rounded-md border border-input bg-white px-3 py-2 font-mono text-xs leading-5 shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

type ChangelogData = {
  exists: boolean;
  content: string;
  mtimeMs: number | null;
};

type Props = {
  /** 未取得は undefined。`stale` のとき EnMetaSection が赤字1行を出す */
  translationStatus?: TranslationFreshness;
  onTranslationChanged?: () => void;
};

/**
 * ホームの英語ビュー（studio-translation / studio-changelog-editor spec）。
 *
 * 全体メタの英訳フィールドと changelog セクション（changelog.en.md）が連動して
 * 切り替わる。
 *
 * - 翻訳ボタンは1つで、メタ翻訳と changelog の追訳を両方実行し、結果を分けて
 *   提示する（片方の失敗はもう片方を巻き込まない——EnMetaSection 側の
 *   afterTranslate 分離で担保）
 * - ⚠ **保存も1つ**。changelog 専用の保存ボタンは持たない。書くのは dirty な
 *   ときだけ——触っていない changelog.en.md へ PUT を投げると、楽観ロックの
 *   せいでメタだけ直した保存が競合で落ちる
 * - 追訳の挿入はクライアントが行い、保存までは正本に書かれない——既存エントリに
 *   触れない担保は構造で（AI 下書きと同じ流儀）
 */
export function HomeEnSection({
  translationStatus,
  onTranslationChanged,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [baseMtimeMs, setBaseMtimeMs] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
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

  /** ホームの保存に合流する。dirty でなければ null を返して「書くものが無い」を伝える */
  const saveChangelog = (): Promise<void> | null => {
    if (!dirty) return null;
    setErrorText(null);
    return fetch("/api/content/changelog", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, baseMtimeMs, language: "en" }),
    })
      .then(async (res) => {
        const data = (await res.json()) as {
          mtimeMs?: number | null;
          error?: string;
        };
        if (res.status === 409) {
          setErrorText(
            `${data.error ?? "外部で変更されています"}（保存し直す前に内容を確認してください）`,
          );
          throw new Error("conflict");
        }
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setBaseMtimeMs(data.mtimeMs ?? null);
        setDirty(false);
      })
      .catch((err: unknown) => {
        setErrorText((prev) => prev ?? `保存エラー: ${String(err)}`);
        throw err;
      });
  };

  /** 統合翻訳のうち changelog 側。挿入はここ（クライアント）で行い、保存は人 */
  const translateChangelogSide = async (): Promise<string | null> => {
    const result = await translateChangelog();
    if (result.kind === "full") {
      setContent(result.text);
      setDirty(true);
      return "変更履歴: 全文の英訳を作成しました（保存で確定）";
    }
    setContent((prev) => insertChangelogEntry(prev, result.text));
    setDirty(true);
    return "変更履歴: 不足エントリの英訳を挿入しました（保存で確定）";
  };

  return (
    <EnMetaSection
      level="root"
      names={{}}
      translationStatus={translationStatus}
      onTranslationChanged={onTranslationChanged}
      afterTranslate={translateChangelogSide}
      afterSave={saveChangelog}
      extraSection={
        <div className="flex flex-col gap-2">
          <Label htmlFor="changelog-en">Changelog</Label>
          <textarea
            id="changelog-en"
            value={content}
            disabled={loading}
            rows={12}
            className={TEXTAREA_CLASS}
            placeholder="（英語版はまだありません。「原文から翻訳」で全文の英訳を作れます）"
            onChange={(e) => {
              setContent(e.target.value);
              setDirty(true);
            }}
          />
          {errorText ? (
            <p className="text-xs text-destructive">{errorText}</p>
          ) : null}
        </div>
      }
    />
  );
}
