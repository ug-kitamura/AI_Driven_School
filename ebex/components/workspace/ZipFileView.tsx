"use client";

import { useEffect, useState } from "react";

type ZipEntry = {
  path: string;
  size?: number;
};

type Props = {
  folderPath: string;
  fileName: string;
};

export function ZipFileView({ folderPath, fileName }: Props) {
  const [entries, setEntries] = useState<ZipEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams({
      folderId: folderPath,
      fileName,
    });

    void fetch(`/api/workspace/zip-entries?${params.toString()}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(data?.error ?? "zip の読み込みに失敗しました");
        }
        return (await res.json()) as {
          entries: ZipEntry[];
          truncated?: boolean;
        };
      })
      .then((data) => {
        if (cancelled) return;
        setEntries(data.entries);
        setTruncated(Boolean(data.truncated));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [folderPath, fileName]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-card p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!entries) {
    return (
      <div className="flex h-full items-center justify-center bg-card p-4 text-sm text-muted-foreground">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="workspace-scrollbar flex h-full min-h-0 flex-col gap-2 overflow-y-auto bg-card p-4">
      {truncated ? (
        <p className="text-xs text-muted-foreground">
          件数上限に達したため、一覧は途中までです
        </p>
      ) : null}
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">エントリがありません</p>
      ) : (
        <ul className="flex flex-col gap-1 font-mono text-sm">
          {entries.map((entry) => (
            <li key={entry.path} className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 break-all">{entry.path}</span>
              {typeof entry.size === "number" ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {entry.size.toLocaleString()} B
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
