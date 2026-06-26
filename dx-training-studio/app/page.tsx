import { Workspace } from "@/components/workspace/Workspace";
import workspaceData from "@/data/workspace.json";
import { reconcileOrderFiles, loadContentsFolder } from "@/lib/contents-loader";
import { workspaceSchema } from "@/lib/schema";

export default function Page() {
  const wsResult = workspaceSchema.safeParse(workspaceData);
  if (!wsResult.success) {
    throw new Error(
      `workspace.json の形式が正しくありません: ${wsResult.error.issues[0]?.message}`,
    );
  }

  reconcileOrderFiles(process.cwd());
  const seriesList = loadContentsFolder(process.cwd());

  return (
    <Workspace
      initialSeries={seriesList}
      contentsEmpty={seriesList.length === 0}
      workspace={wsResult.data}
    />
  );
}
