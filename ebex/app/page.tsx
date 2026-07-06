import { Workspace } from "@/components/workspace/Workspace";
import { loadWorkspace } from "@/lib/workspace-loader";

export default function Page() {
  const { folders } = loadWorkspace(process.cwd());

  return <Workspace initialFolders={folders} />;
}
