"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  META_DIALOG_CONTROL,
  META_DIALOG_STACK,
  MetaDialogField,
} from "@/components/workspace/metaDialogLayout";
import {
  fetchMetaEn,
  saveMetaEn,
  translateMeta,
  type UnitLevel,
  type UnitNames,
} from "@/lib/translation/client";

/** 階層ごとの英語ビュー項目（表示順・ラベル・原文キー）。author_en は別扱い（手編集のみ） */
const EN_FIELD_DEFS: Record<
  UnitLevel,
  Array<{ enKey: string; label: string; jaKey: string; multiline?: boolean }>
> = {
  root: [
    { enKey: "name_en", label: "Name（サイト名）", jaKey: "name" },
    { enKey: "description_en", label: "Description", jaKey: "description", multiline: true },
  ],
  series: [
    { enKey: "name_en", label: "Name（シリーズ名）", jaKey: "name" },
    { enKey: "catch_en", label: "Catch", jaKey: "catch" },
    { enKey: "description_en", label: "Description", jaKey: "description", multiline: true },
  ],
  course: [
    { enKey: "name_en", label: "Name（コース名）", jaKey: "name" },
    { enKey: "catch_en", label: "Catch", jaKey: "catch" },
    { enKey: "description_en", label: "Description", jaKey: "description", multiline: true },
    { enKey: "target_en", label: "Intended audience（受講対象者）", jaKey: "target" },
  ],
  lesson: [
    { enKey: "name_en", label: "Name（レッスン名）", jaKey: "name" },
    { enKey: "description_en", label: "Description", jaKey: "description", multiline: true },
  ],
};

const TEXTAREA_CLASS =
  "w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

type Props = {
  level: UnitLevel;
  names: UnitNames;
  /** レッスンのみ: author_en の手編集欄を出す。保存は onSaveAuthorEn が担う */
  authorEnEditable?: boolean;
  onSaveAuthorEn?: (authorEn: string) => void;
  /** 保存・翻訳適用の後に呼ぶ（Workspace が鮮度チップを再取得する） */
  onTranslationChanged?: () => void;
  /** ホーム統合用: フィールドとボタン行の間に差し込む追加セクション（changelog） */
  extraSection?: React.ReactNode;
  /**
   * ホーム統合用: メタ翻訳の後に続けて実行する追加翻訳（changelog 追訳）。
   * 戻り値は結果メッセージ。失敗はメタ側の結果を巻き込まず、個別のエラーとして出す
   */
  afterTranslate?: () => Promise<string | null>;
  /** 翻訳ボタンのラベル（ホームは「メタと変更履歴を翻訳」等に変える） */
  translateLabel?: string;
};

/**
 * 英語ビューの共通フォーム（studio-translation spec）。
 *
 * - 翻訳対象フィールドだけを、日本語原文の併記つきで編集する
 * - 「原文から翻訳し直す」はフィールドを埋めるだけ（正本に書かない）
 * - 保存は専用経路（PUT /api/content/meta-en）——`_en` と `en_source_hash` 以外に触れない
 * - `en_source_hash` は翻訳ボタン経由の値だけを保存に添える（手入力の訳は鮮度不明のまま）
 */
export function EnMetaSection({
  level,
  names,
  authorEnEditable = false,
  onSaveAuthorEn,
  onTranslationChanged,
  extraSection,
  afterTranslate,
  translateLabel = "原文から翻訳し直す",
}: Props) {
  const defs = EN_FIELD_DEFS[level];
  const [loading, setLoading] = useState(true);
  const [ja, setJa] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [authorEn, setAuthorEn] = useState("");
  /** 翻訳ボタン経由で得たハッシュ。手入力だけの保存では添えない */
  const [pendingHash, setPendingHash] = useState<string | undefined>(undefined);
  const [translating, setTranslating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchMetaEn(level, names)
      .then((data) => {
        if (cancelled) return;
        setJa(data.ja as Record<string, string>);
        setValues(data.en);
        if (data.author_en !== undefined) setAuthorEn(data.author_en);
      })
      .catch((err: unknown) => {
        if (!cancelled) setErrorText(`読み込みエラー: ${String(err)}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // 対象ユニットが変わったときだけ読み直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, names.series, names.course, names.lesson]);

  const handleTranslate = () => {
    setTranslating(true);
    setErrorText(null);
    setStatusText(null);
    void (async () => {
      let metaMessage: string;
      try {
        const result = await translateMeta(level, names);
        setValues((prev) => ({ ...prev, ...result.fields }));
        setPendingHash(result.en_source_hash);
        metaMessage = "メタを翻訳しました。内容を確認して保存してください";
      } catch (err) {
        setErrorText(`翻訳エラー: ${String(err)}`);
        setTranslating(false);
        return;
      }
      // 追加翻訳（changelog 追訳）はメタの結果を巻き込まない——エラーは個別に出す
      if (afterTranslate) {
        try {
          const extraMessage = await afterTranslate();
          setStatusText(
            extraMessage ? `${metaMessage}／${extraMessage}` : metaMessage,
          );
        } catch (err) {
          setStatusText(metaMessage);
          setErrorText(`変更履歴の追訳エラー: ${String(err)}`);
        }
      } else {
        setStatusText(metaMessage);
      }
      setTranslating(false);
    })();
  };

  const handleSave = () => {
    setSaving(true);
    setErrorText(null);
    setStatusText(null);
    const fields: Record<string, string> = {};
    for (const def of defs) fields[def.enKey] = values[def.enKey] ?? "";
    void saveMetaEn({ level, names, fields, enSourceHash: pendingHash })
      .then(() => {
        setStatusText("保存しました");
        setPendingHash(undefined);
        if (authorEnEditable) onSaveAuthorEn?.(authorEn);
        onTranslationChanged?.();
      })
      .catch((err: unknown) => {
        setErrorText(`保存エラー: ${String(err)}`);
      })
      .finally(() => setSaving(false));
  };

  return (
    <div className={META_DIALOG_STACK}>
      {defs.map((def) => (
        <MetaDialogField key={def.enKey}>
          <Label htmlFor={`en-meta-${def.enKey}`}>{def.label}</Label>
          {/* 日本語原文の併記（読取専用）。後編集の拠り所 */}
          <p className="text-xs text-muted-foreground">
            原文: {ja[def.jaKey]?.trim() ? ja[def.jaKey] : "（未設定）"}
          </p>
          {def.multiline ? (
            <textarea
              id={`en-meta-${def.enKey}`}
              value={values[def.enKey] ?? ""}
              disabled={loading}
              rows={3}
              className={TEXTAREA_CLASS}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [def.enKey]: e.target.value }))
              }
            />
          ) : (
            <Input
              id={`en-meta-${def.enKey}`}
              value={values[def.enKey] ?? ""}
              disabled={loading}
              className={META_DIALOG_CONTROL}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [def.enKey]: e.target.value }))
              }
            />
          )}
        </MetaDialogField>
      ))}
      {authorEnEditable ? (
        <MetaDialogField>
          <Label htmlFor="en-meta-author-en">Author（英語表記・手編集のみ）</Label>
          <p className="text-xs text-muted-foreground">
            人名のローマ字表記は本人の流儀のため、翻訳ボタンは触りません
          </p>
          <Input
            id="en-meta-author-en"
            value={authorEn}
            disabled={loading}
            className={META_DIALOG_CONTROL}
            onChange={(e) => setAuthorEn(e.target.value)}
          />
        </MetaDialogField>
      ) : null}
      {extraSection}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleTranslate}
          disabled={loading || translating}
        >
          {translating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-4" aria-hidden />
          )}
          {translateLabel}
        </Button>
        <Button size="sm" onClick={handleSave} disabled={loading || saving}>
          保存
        </Button>
      </div>
      {statusText ? (
        <p className="text-xs text-muted-foreground">{statusText}</p>
      ) : null}
      {errorText ? <p className="text-xs text-destructive">{errorText}</p> : null}
    </div>
  );
}
