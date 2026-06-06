import type { ImageGridItem } from "@/components/workspace/ImageGrid";
import type { Lesson, Series } from "@/lib/schema";
import type { Pane3Mode } from "@/components/workspace/Workspace";

export type ImageManagerTab = "used" | "upload" | "ai" | "web";

export type TabNotice = { message: string; tone: "error" | "success" };

export type PendingDelete = ImageGridItem & {
  referenceCount: number;
  kind: "referenced" | "simple";
  tab: ImageManagerTab;
};

export type ImageManagerPaneProps = {
  series: Series[];
  lesson: Lesson | undefined;
  pane3Mode: Pane3Mode;
  onInsertImage: (markdown: string) => boolean;
  /** null = コメント外（プロンプト上書きしない）、string = コメント内テキスト */
  editorCommentPrompt: string | null;
  editorCursorOffset: number | null;
  pane4Open: boolean;
  onTogglePane4: () => void;
  onImageAssetsChanged?: (removedPaths?: string | string[]) => void;
};
