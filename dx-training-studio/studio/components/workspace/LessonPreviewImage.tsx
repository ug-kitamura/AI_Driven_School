"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { LessonPreviewVideo } from "@/components/workspace/LessonPreviewVideo";
import {
  isMp4Path,
  resolveImageLogicalPathFromMarkdown,
  resolveToAvailablePath,
  toImageApiUrl,
} from "@/lib/image-path";
import { getImageStorageMode } from "@/lib/image-api-client";

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
    <span
      role="img"
      aria-label={alt ? `${alt}（画像が存在しません）` : "画像が存在しません"}
      className="my-4 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-3 text-destructive"
    >
      <ImageOff className="h-5 w-5 shrink-0" />
      <span className="min-w-0 text-sm">
        画像が存在しません
        <span className="mt-0.5 block truncate text-xs opacity-80">{label}</span>
      </span>
    </span>
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
    src && typeof src === "string"
      ? resolveImageLogicalPathFromMarkdown(src)
      : null;

  const fetchPath =
    logicalPath && availableImagePaths
      ? (resolveToAvailablePath(logicalPath, availableImagePaths) ?? logicalPath)
      : logicalPath;

  const isKnownMissing = Boolean(
    logicalPath &&
      availableImagePaths &&
      !resolveToAvailablePath(logicalPath, availableImagePaths),
  );

  const resolved =
    src && typeof src === "string"
      ? fetchPath
        ? `${toImageApiUrl(fetchPath, { storageMode: getImageStorageMode() })}&v=${cacheRevision}`
        : src
      : null;

  const label = logicalPath ?? (typeof src === "string" ? src : "") ?? "";

  useEffect(() => {
    setFailed(false);
  }, [resolved, isKnownMissing, cacheRevision]);

  if (!src || typeof src !== "string") return null;

  if (logicalPath && isMp4Path(logicalPath)) {
    return (
      <LessonPreviewVideo
        src={src}
        alt={alt}
        availableImagePaths={availableImagePaths}
        cacheRevision={cacheRevision}
      />
    );
  }

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
      className="my-4 block h-auto max-w-full rounded-md"
      onError={() => setFailed(true)}
    />
  );
}
