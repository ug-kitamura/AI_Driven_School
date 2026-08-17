"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MetaViewShell } from "@/components/workspace/meta-views/MetaViewShell";
import {
  META_DIALOG_CONTROL,
  META_DIALOG_STACK,
  MetaDialogField,
} from "@/components/workspace/metaDialogLayout";
import { fetchImageList } from "@/lib/image-list-client";
import { getImageStorageMode } from "@/lib/image-api-client";
import { isCanonicalImagePath, isMp4Path, toImageApiUrl } from "@/lib/image-path";
import { cn } from "@/lib/utils";
import type { ImageAsset } from "@/lib/schema";

/** Select は空文字を値に使えないため、未設定を表すセンチネル */
const HERO_UNSET = "__unset__";

type WorkspaceMetaValues = {
  name: string;
  description: string;
  hero: string;
  github_url: string;
};

type Props = {
  workspaceName: string;
  onSaveError?: (message: string) => void;
};

/** ホーム選択時のペイン2: 全体メタ（contents/.meta.json）の編集ビュー */
export function WorkspaceMetaView({ workspaceName, onSaveError }: Props) {
  const [values, setValues] = useState<WorkspaceMetaValues>({
    name: "",
    description: "",
    hero: "",
    github_url: "",
  });
  const [loading, setLoading] = useState(true);
  const [heroCandidates, setHeroCandidates] = useState<ImageAsset[]>([]);
  const [urlError, setUrlError] = useState(false);

  useEffect(() => {
    // loading は初期値 true。ここで再セットしない（マウント時に1回だけ読む）
    let cancelled = false;
    void fetch("/api/content/workspace-meta")
      .then((res) => res.json())
      .then((data: Partial<WorkspaceMetaValues>) => {
        if (cancelled) return;
        setValues({
          name: data.name ?? "",
          description: data.description ?? "",
          hero: data.hero ?? "",
          github_url: data.github_url ?? "",
        });
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

  useEffect(() => {
    let cancelled = false;
    void fetchImageList("used").then((result) => {
      if (cancelled) return;
      setHeroCandidates(result.files.filter((f) => !isMp4Path(f.path)));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const heroItems = useMemo(
    () => [
      { value: HERO_UNSET, label: "未設定" },
      ...heroCandidates.map((f) => ({ value: f.name, label: f.name })),
    ],
    [heroCandidates],
  );

  const heroPreviewUrl = useMemo(() => {
    if (!values.hero) return null;
    const asset = heroCandidates.find((f) => f.name === values.hero);
    const path = asset?.path ?? `images/${values.hero}`;
    const storageMode = isCanonicalImagePath(path)
      ? getImageStorageMode()
      : undefined;
    return toImageApiUrl(path, storageMode ? { storageMode } : undefined);
  }, [values.hero, heroCandidates]);

  const isValidUrl = (value: string) => {
    if (!value.trim()) return true;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  };

  const handleSave = () => {
    if (!isValidUrl(values.github_url)) {
      setUrlError(true);
      return;
    }
    setUrlError(false);
    void fetch("/api/content/workspace-meta", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      })
      .catch((err: unknown) => {
        onSaveError?.(`全体メタ保存エラー: ${String(err)}`);
      });
  };

  return (
    <MetaViewShell
      title={values.name.trim() || workspaceName}
      kindLabel="全体"
      onSave={handleSave}
      saveDisabled={loading}
    >
      <div className={META_DIALOG_STACK}>
        <MetaDialogField>
          <Label htmlFor="workspace-meta-name">名前（サイト名）</Label>
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
          <Label htmlFor="workspace-meta-hero">ヒーロー画像</Label>
          <Select
            items={heroItems}
            value={values.hero || HERO_UNSET}
            onValueChange={(v) => {
              if (!v) return;
              setValues((prev) => ({
                ...prev,
                hero: v === HERO_UNSET ? "" : v,
              }));
            }}
          >
            <SelectTrigger
              id="workspace-meta-hero"
              className={cn(META_DIALOG_CONTROL, "w-full")}
              disabled={loading}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {heroItems.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            正本 `images/` の画像から選びます。公開サイトは切り抜かずに表示するため、横長（3.75:1 前後）の画像を使ってください
          </p>
          {heroPreviewUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={heroPreviewUrl}
              alt={values.hero}
              className="max-h-40 w-full rounded border border-border object-contain"
            />
          ) : null}
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
      </div>
    </MetaViewShell>
  );
}
