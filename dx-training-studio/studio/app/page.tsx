import { Workspace } from "@/components/workspace/Workspace";
import { reconcileOrderFiles, loadContentsFolder } from "@/lib/contents-loader";
import { getProjectRoot } from "@/lib/project-root";
import { WORKSPACE_META } from "@/lib/workspace-meta";

export default function Page() {
  reconcileOrderFiles(getProjectRoot());
  const seriesList = loadContentsFolder(getProjectRoot());

  return (
    <Workspace
      initialSeries={seriesList}
      contentsEmpty={seriesList.length === 0}
      workspace={WORKSPACE_META}
    />
  );
}
