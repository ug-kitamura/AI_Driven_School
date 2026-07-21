import path from "node:path";
import { Workspace } from "@/components/workspace/Workspace";
import { loadWorkspace } from "@/lib/workspace-loader";
import { getEbexRoot } from "@/lib/agent/skill-loader";
import { getProjectRoot } from "@/lib/project-root";

// projectRoot は起動時の配置で決まる。静的プリレンダリングだとビルド時の値
// （workspace 一覧・ホスト表示名）が焼き付くため、リクエスト毎に解決させる。
export const dynamic = "force-dynamic";

export default function Page() {
  const projectRoot = getProjectRoot();
  const { folders } = loadWorkspace(projectRoot);

  // projectRoot が appRoot と異なる = ホスト配下。Pane 1 に "for {name}" を出す。
  const hostName =
    path.resolve(projectRoot) === path.resolve(getEbexRoot())
      ? null
      : path.basename(projectRoot);

  return <Workspace initialFolders={folders} hostName={hostName} />;
}
