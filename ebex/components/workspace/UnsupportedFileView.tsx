"use client";

type Props = {
  fileName: string;
};

export function UnsupportedFileView({ fileName }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-card p-6 text-center">
      <p className="text-sm font-medium">
        このファイル形式はプレビューできません
      </p>
      <p className="text-sm text-muted-foreground">{fileName}</p>
    </div>
  );
}
