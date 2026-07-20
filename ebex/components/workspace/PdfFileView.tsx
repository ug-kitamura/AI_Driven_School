"use client";

type Props = {
  folderPath: string;
  fileName: string;
};

export function PdfFileView({ folderPath, fileName }: Props) {
  const src = `/api/workspace/file?folderId=${encodeURIComponent(folderPath)}&fileName=${encodeURIComponent(fileName)}`;
  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <iframe
        title={fileName}
        src={src}
        className="h-full w-full flex-1 border-0"
      />
    </div>
  );
}
