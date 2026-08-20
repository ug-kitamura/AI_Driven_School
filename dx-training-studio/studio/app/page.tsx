import { Workspace } from "@/components/workspace/Workspace";
import {
  getContentsDir,
  loadContentsFolder,
  readMetaJson,
  reconcileOrderFiles,
} from "@/lib/contents-loader";
import { getProjectRoot } from "@/lib/project-root";
import { WORKSPACE_META } from "@/lib/workspace-meta";

export default function Page() {
  reconcileOrderFiles(getProjectRoot());
  const seriesList = loadContentsFolder(getProjectRoot());
  const githubUrl = readMetaJson(getContentsDir(getProjectRoot())).github_url;

  return (
    <Workspace
      initialSeries={seriesList}
      contentsEmpty={seriesList.length === 0}
      workspace={WORKSPACE_META}
      initialGithubUrl={typeof githubUrl === "string" ? githubUrl : ""}
    />
  );
}
