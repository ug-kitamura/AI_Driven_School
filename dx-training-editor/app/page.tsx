import { Workspace } from "@/components/workspace/Workspace";
import contentData from "@/data/content.json";
import imagesData from "@/data/images.json";
import workspaceData from "@/data/workspace.json";
import {
  seriesArraySchema,
  imageAssetsSchema,
  workspaceSchema,
} from "@/lib/schema";

export default function Page() {
  const seriesResult = seriesArraySchema.safeParse(contentData);
  const imagesResult = imageAssetsSchema.safeParse(imagesData);
  const wsResult = workspaceSchema.safeParse(workspaceData);

  if (!seriesResult.success || !imagesResult.success || !wsResult.success) {
    const errors = [
      !seriesResult.success &&
        `content.json: ${seriesResult.error.issues[0]?.message}`,
      !imagesResult.success &&
        `images.json: ${imagesResult.error.issues[0]?.message}`,
      !wsResult.success &&
        `workspace.json: ${wsResult.error.issues[0]?.message}`,
    ].filter(Boolean);
    throw new Error(`データの形式が正しくありません:\n${errors.join("\n")}`);
  }

  return (
    <Workspace
      initialSeries={seriesResult.data}
      initialImages={imagesResult.data}
      workspace={wsResult.data}
    />
  );
}
