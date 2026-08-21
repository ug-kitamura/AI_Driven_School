"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MetaViewShell } from "@/components/workspace/meta-views/MetaViewShell";
import {
  ChangelogDraftButton,
  WorkspaceChangelogSection,
  type ChangelogControls,
} from "@/components/workspace/meta-views/WorkspaceChangelogSection";
import {
  META_DIALOG_CONTROL,
  META_DIALOG_STACK,
  MetaDialogField,
} from "@/components/workspace/metaDialogLayout";
import { HomeEnSection } from "@/components/workspace/translation/HomeEnSection";
import {
  LanguageToggleControl,
  type EditLanguage,
} from "@/components/workspace/translation/LanguageToggleControl";
import { PaneActionBar } from "@/components/workspace/PaneActionBar";
import { SaveButton } from "@/components/workspace/SaveButton";
import type { TranslationFreshness } from "@/lib/translation/client";

type WorkspaceMetaValues = {
  name: string;
  description: string;
  github_url: string;
};

const EMPTY_VALUES: WorkspaceMetaValues = {
  name: "",
  description: "",
  github_url: "",
};

type Props = {
  workspaceName: string;
  onSaveError?: (message: string) => void;
  /** 保存成功時に GitHub リンクを通知する（ヘッダーのアイコン表示が追随する） */
  onGithubUrlSaved?: (url: string) => void;
  editLanguage: EditLanguage;
  onEditLanguageChange: (language: EditLanguage) => void;
  translationStatus: TranslationFreshness | undefined;
  onTranslationChanged?: () => void;
};

/**
 * ホーム選択時のペイン2: 全体メタ（contents/.meta.json）の編集ビュー。
 *
 * ⚠ 保存は**この画面に1つだけ**（workspace-meta-views spec）。全体メタと
 * 変更履歴（contents/changelog.md）の両方を1回の操作で確定する。ただし
 * **dirty なものだけ書く**——触っていない changelog へ PUT を投げると、
 * 楽観ロックのせいで「名前を直しただけなのに履歴の競合で失敗する」という
 * 筋の通らない挙動になる。
 *
 * ⚠ ヒーロー画像の編集 UI は置かない。`hero` フィールド自体は PUT の
 * 「省略＝保全」規約で保たれる（フォームが送らない＝消えない）。
 */
export function WorkspaceMetaView({
  workspaceName,
  onSaveError,
  onGithubUrlSaved,
  editLanguage,
  onEditLanguageChange,
  translationStatus,
  onTranslationChanged,
}: Props) {
  const [values, setValues] = useState<WorkspaceMetaValues>(EMPTY_VALUES);
  const [loading, setLoading] = useState(true);
  const [urlError, setUrlError] = useState(false);
  /** 保存済みの値。これとの差で全体メタの dirty を導出する */
  const savedRef = useRef<WorkspaceMetaValues>(EMPTY_VALUES);
  const [changelogControls, setChangelogControls] =
    useState<ChangelogControls | null>(null);

  useEffect(() => {
    // loading は初期値 true。ここで再セットしない（マウント時に1回だけ読む）
    let cancelled = false;
    void fetch("/api/content/workspace-meta")
      .then((res) => res.json())
      .then((data: Partial<WorkspaceMetaValues>) => {
        if (cancelled) return;
        const loaded = {
          name: data.name ?? "",
          description: data.description ?? "",
          github_url: data.github_url ?? "",
        };
        savedRef.current = loaded;
        setValues(loaded);
      })
      .catch(() => {
        // 読み込めなくても空フォームで編集は続けられる
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isValidUrl = (value: string) => {
    if (!value.trim()) return true;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  };

  /** ⚠ 保存時にだけ読む（描画には要らない値なので ref のままイベント内で参照する） */
  const isMetaDirty = () =>
    values.name !== savedRef.current.name ||
    values.description !== savedRef.current.description ||
    values.github_url !== savedRef.current.github_url;

  const saveMeta = (): Promise<void> =>
    fetch("/api/content/workspace-meta", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        savedRef.current = values;
        onGithubUrlSaved?.(values.github_url.trim());
      })
      .catch((err: unknown) => {
        onSaveError?.(`全体メタ保存エラー: ${String(err)}`);
        throw err;
      });

  /**
   * ホームの唯一の保存。dirty な対象にだけ書く。
   * ⚠ 片方の失敗でもう片方を止めない——両方投げてから結果を集める。
   * 変更履歴のエラーはセクション自身が表示するので、ここでは握って落とす。
   */
  const handleSave = async (): Promise<void> => {
    if (!isValidUrl(values.github_url)) {
      setUrlError(true);
      throw new Error("invalid url");
    }
    setUrlError(false);
    const jobs: Promise<unknown>[] = [];
    if (isMetaDirty()) jobs.push(saveMeta());
    if (changelogControls?.dirty) jobs.push(changelogControls.save());
    if (jobs.length === 0) return;
    const results = await Promise.allSettled(jobs);
    if (results.some((r) => r.status === "rejected")) {
      throw new Error("save failed");
    }
  };

  const headerControls = (
    <LanguageToggleControl
      language={editLanguage}
      onLanguageChange={onEditLanguageChange}
    />
  );

  if (editLanguage === "en") {
    return (
      <MetaViewShell
        title={values.name.trim() || workspaceName}
        kindLabel="全体"
        headerExtra={headerControls}
      >
        {/* 英語ビューはメタと changelog（英語版）が連動して切り替わる。
            ボタン列・赤字・保存の統合は HomeEnSection（EnMetaSection）側が持つ */}
        <HomeEnSection
          translationStatus={translationStatus}
          onTranslationChanged={onTranslationChanged}
        />
      </MetaViewShell>
    );
  }

  return (
    <MetaViewShell
      title={values.name.trim() || workspaceName}
      kindLabel="全体"
      headerExtra={headerControls}
      actionBar={
        <PaneActionBar
          aiSlot={<ChangelogDraftButton controls={changelogControls} />}
          saveSlot={<SaveButton onSave={handleSave} disabled={loading} />}
        />
      }
    >
      <div className={META_DIALOG_STACK}>
        <MetaDialogField>
          <Label htmlFor="workspace-meta-name">名前</Label>
          <Input
            id="workspace-meta-name"
            value={values.name}
            disabled={loading}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="例: DX Training Mandala"
            className={META_DIALOG_CONTROL}
          />
        </MetaDialogField>
        <MetaDialogField>
          <Label htmlFor="workspace-meta-description">説明</Label>
          <textarea
            id="workspace-meta-description"
            value={values.description}
            disabled={loading}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, description: e.target.value }))
            }
            rows={4}
            className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
            placeholder="カリキュラム全体の説明（公開サイトの全体トップに表示）"
          />
        </MetaDialogField>
        <MetaDialogField>
          <Label htmlFor="workspace-meta-github">GitHub リンク</Label>
          <Input
            id="workspace-meta-github"
            value={values.github_url}
            disabled={loading}
            onChange={(e) => {
              setUrlError(false);
              setValues((prev) => ({ ...prev, github_url: e.target.value }));
            }}
            placeholder="https://github.com/..."
            className={META_DIALOG_CONTROL}
          />
          {urlError ? (
            <p className="text-xs text-destructive">URL 形式で入力してください</p>
          ) : null}
        </MetaDialogField>
        {/* 正本は .meta.json ではなく contents/changelog.md。保存は上の1つに合流する */}
        <WorkspaceChangelogSection onControlsReady={setChangelogControls} />
      </div>
    </MetaViewShell>
  );
}
