import type { Components } from "react-markdown";
import { LessonPreviewImage } from "@/components/workspace/LessonPreviewImage";

export type PreviewImageContext = {
  availableImagePaths: ReadonlySet<string> | null;
  imageAssetsRevision: number;
};

/** プレビュー用 markdown コンポーネント（画像可用性を Workspace から注入） */
export function createLessonPreviewMarkdownComponents(
  ctx: PreviewImageContext,
): Components {
  return {
    img({ src, alt }) {
      return (
        <LessonPreviewImage
          src={src}
          alt={alt}
          availableImagePaths={ctx.availableImagePaths}
          cacheRevision={ctx.imageAssetsRevision}
        />
      );
    },
  };
}
