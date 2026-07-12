"use client";

type Props = {
  folderPath: string;
  fileName: string;
};

export function ImageFileView({ folderPath, fileName }: Props) {
  const src = `/api/workspace/file?folderId=${encodeURIComponent(folderPath)}&fileName=${encodeURIComponent(fileName)}`;
  return (
    <div className="flex h-full min-h-0 items-center justify-center overflow-auto bg-card p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={fileName}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}
