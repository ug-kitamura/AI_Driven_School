import { Workspace } from "@/components/workspace/Workspace";
import { reconcileOrderFiles, loadContentsFolder } from "@/lib/contents-loader";
import { WORKSPACE_META } from "@/lib/workspace-meta";

export default function Page() {
  reconcileOrderFiles(process.cwd());
  const seriesList = loadContentsFolder(process.cwd());

  return (
    <Workspace
      initialSeries={seriesList}
      contentsEmpty={seriesList.length === 0}
      workspace={WORKSPACE_META}
    />
  );
}
