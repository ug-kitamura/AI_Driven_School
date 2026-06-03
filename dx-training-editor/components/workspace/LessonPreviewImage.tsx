"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import {
  isSafeImageLogicalPath,
  normalizeImageLogicalPath,
  toImageApiUrl,
} from "@/lib/image-path";

type Props = {
  src?: string | Blob;
  alt?: string;
  availableImagePaths?: ReadonlySet<string> | null;
  cacheRevision?: number;
};

function MissingImagePlaceholder({
  label,
  alt,
}: {
  label: string;
  alt?: string;
}) {
  return (
    <div
      role="img"
      aria-label={alt ? `${alt}（画像が存在しません）` : "画像が存在しません"}
      className="my-4 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-3 text-destructive"
    >
      <ImageOff className="h-5 w-5 shrink-0" />
      <span className="min-w-0 text-sm">
        画像が存在しません
        <span className="mt-0.5 block truncate text-xs opacity-80">{label}</span>
      </span>
    </div>
  );
}

export function LessonPreviewImage({
  src,
  alt,
  availableImagePaths = null,
  cacheRevision = 0,
}: Props) {
  const [failed, setFailed] = useState(false);

  const logicalPath =
    src && typeof src === "string" && isSafeImageLogicalPath(src)
      ? normalizeImageLogicalPath(src)
      : null;

  const isKnownMissing = Boolean(
    logicalPath &&
      availableImagePaths &&
      !availableImagePaths.has(logicalPath),
  );

  const resolved =
    src && typeof src === "string"
      ? logicalPath
        ? `${toImageApiUrl(logicalPath)}&v=${cacheRevision}`
        : src
      : null;

  const label = logicalPath ?? resolved ?? "";

  useEffect(() => {
    setFailed(false);
  }, [resolved, isKnownMissing, cacheRevision]);

  if (!src || typeof src !== "string") return null;

  if (isKnownMissing || failed) {
    return <MissingImagePlaceholder label={label} alt={alt} />;
  }

  if (!resolved) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={resolved}
      src={resolved}
      alt={alt ?? ""}
      className="my-4 max-w-full rounded-md"
      onError={() => setFailed(true)}
    />
  );
}
