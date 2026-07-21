import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getPurpose } from "@/app/api/purpose/route";
import { GET as getSkills } from "@/app/api/agent/skills/route";
import { GET as loadWorkspaceRoute } from "@/app/api/workspace/load/route";
import { getEbexRoot } from "@/lib/agent/skill-loader";
import { HOST_MARKER_FILENAME } from "@/lib/project-root";
import { PURPOSE_RELATIVE_PATH } from "@/lib/workspace-paths";

/**
 * `host/ebex/` の擬似ホスト構成。appRoot はモジュール位置から解決されるため
 * 実リポジトリのままで、projectRoot だけが tmp のホスト側に向く。
 */
function makeHostTree(): { host: string; appRoot: string } {
  const base = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "ebex-host-")),
  );
  const host = path.join(base, "dx-training-studio");
  const appRoot = path.join(host, "ebex");
  fs.mkdirSync(appRoot, { recursive: true });
  fs.writeFileSync(path.join(host, HOST_MARKER_FILENAME), "");

  // ホスト側の作業データ
  fs.mkdirSync(path.join(host, "workspace", "20260722-minutes"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(host, "workspace", "20260722-minutes", "notes.md"),
    "# メモ\n",
  );

  // ebex 側にも workspace を置き、こちらが選ばれないことを確かめられるようにする
  fs.mkdirSync(path.join(appRoot, "workspace", "should-not-be-used"), {
    recursive: true,
  });

  return { host, appRoot };
}

function writeSkill(root: string, id: string, description: string): void {
  const dir = path.join(root, ".claude", "skills", id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "SKILL.md"),
    `---\nname: ${id}\ndescription: ${description}\n---\n\n本文\n`,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ホスト配下のルート解決", () => {
  it("workspace はホスト側を読み、ebex 側は使わない", async () => {
    const { appRoot } = makeHostTree();
    vi.spyOn(process, "cwd").mockReturnValue(appRoot);

    const response = await loadWorkspaceRoute();
    const data = (await response.json()) as { folders: { name: string }[] };
    const names = data.folders.map((folder) => folder.name);

    expect(names).toContain("20260722-minutes");
    expect(names).not.toContain("should-not-be-used");
  });

  it("ebe-purpose.md は appRoot 基準で ebex 側から読まれる", async () => {
    const { appRoot } = makeHostTree();
    vi.spyOn(process, "cwd").mockReturnValue(appRoot);

    const response = await getPurpose();
    expect(response.status).toBe(200);

    const text = await response.text();
    const fromEbexRoot = fs.readFileSync(
      path.join(getEbexRoot(), PURPOSE_RELATIVE_PATH),
      "utf-8",
    );
    expect(text).toBe(fromEbexRoot);
  });

  it("ホスト側スキルが一覧に現れ、ebex 側スキルより先に並ぶ", async () => {
    const { host, appRoot } = makeHostTree();
    writeSkill(host, "zeta-host-skill", "ホスト固有スキル");
    vi.spyOn(process, "cwd").mockReturnValue(appRoot);

    const response = await getSkills();
    const data = (await response.json()) as { skills: { id: string }[] };
    const ids = data.skills.map((skill) => skill.id);

    expect(ids).toContain("zeta-host-skill");
    // ebex 同梱スキルが存在する前提で、ホスト側が必ず先頭区画に入る
    const hostIndex = ids.indexOf("zeta-host-skill");
    const ebexIndexes = ids
      .map((id, index) => (id === "zeta-host-skill" ? -1 : index))
      .filter((index) => index >= 0);
    expect(ebexIndexes.length).toBeGreaterThan(0);
    expect(hostIndex).toBeLessThan(Math.min(...ebexIndexes));
  });
});

describe("単体起動のルート解決", () => {
  it("マーカーが無ければ cwd 配下の workspace を読む", async () => {
    const base = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "ebex-solo-")),
    );
    fs.mkdirSync(path.join(base, "workspace", "solo-folder"), {
      recursive: true,
    });
    vi.spyOn(process, "cwd").mockReturnValue(base);

    const response = await loadWorkspaceRoute();
    const data = (await response.json()) as { folders: { name: string }[] };

    expect(data.folders.map((folder) => folder.name)).toContain("solo-folder");
  });
});
