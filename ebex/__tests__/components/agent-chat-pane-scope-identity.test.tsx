import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import { useRef } from "react";
import { AgentChatPane } from "@/components/workspace/AgentChatPane";
import type { AgentChatDraftMap } from "@/components/workspace/agent-chat-draft";
import type {
  AgentChatSession,
  AgentChatStorage,
} from "@/lib/agent-chat-storage";
import type { WorkspaceTreeNode } from "@/lib/workspace-loader";

const FOLDERS: WorkspaceTreeNode[] = [
  { name: "proj-a", path: "proj-a", files: ["a.md"], children: [] },
  { name: "proj-b", path: "proj-b", files: ["b.md"], children: [] },
];

/** どの folderId のセッションかを session id の接頭辞で判別できるようにする。 */
function makeSession(folderId: string, suffix: string): AgentChatSession {
  const now = new Date().toISOString();
  return {
    id: `${folderId}--${suffix}`,
    title: `${folderId} の会話`,
    messages: [
      {
        id: `${folderId}--msg`,
        role: "user",
        content: `${folderId} で送ったメッセージ`,
        createdAt: now,
      },
    ],
    activeSkillId: null,
    createdAt: now,
    updatedAt: now,
  };
}

function makeStorage(folderId: string): AgentChatStorage {
  const session = makeSession(folderId, "s1");
  return { version: 1, activeSessionId: session.id, sessions: [session] };
}

type SavedCall = { folderId: string; storage: AgentChatStorage };

let saved: SavedCall[];
let stored: Record<string, AgentChatStorage>;

function installFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      if (input.startsWith("/api/agent/session?")) {
        const folderId = decodeURIComponent(
          new URL(input, "http://localhost").searchParams.get("folderId") ?? "",
        );
        if (init?.method === "PUT") {
          const storage = JSON.parse(String(init.body)) as AgentChatStorage;
          saved.push({ folderId, storage });
          stored[folderId] = storage;
          return { ok: true, json: async () => ({ ok: true }) };
        }
        const existing = stored[folderId];
        if (!existing) {
          return { ok: false, status: 404, json: async () => ({}) };
        }
        return { ok: true, json: async () => existing };
      }
      return { ok: true, json: async () => ({}) };
    }),
  );
}

/** AgentPane と同じく key でリマウントし、下書きを外側で保持するラッパー。 */
function Harness({ folderId }: { folderId: string }) {
  const draftsRef = useRef<AgentChatDraftMap>(new Map());
  return (
    <AgentChatPane
      key={folderId}
      folderId={folderId}
      folders={FOLDERS}
      currentFilePath={null}
      onOpenSettings={() => {}}
      draftsRef={draftsRef}
      skills={[]}
    />
  );
}

/**
 * 不変条件: どのフォルダへの保存も、そのフォルダに属する session id しか含まない。
 * session id は `<folderId>--<suffix>` の形にしてあるので所有者を判定できる。
 */
function assertNoForeignSessions(calls: SavedCall[]) {
  for (const call of calls) {
    for (const session of call.storage.sessions) {
      const owner = session.id.includes("--")
        ? session.id.split("--")[0]
        : call.folderId;
      expect(
        owner === call.folderId,
        `${call.folderId} の保存に ${owner} のセッション (${session.id}) が混入した`,
      ).toBe(true);
    }
  }
}

describe("AgentChatPane のプロジェクトフォルダ同一性", () => {
  beforeEach(() => {
    saved = [];
    stored = { "proj-a": makeStorage("proj-a") };
    installFetch();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("未使用フォルダへ切り替えても前フォルダの会話が残らない", async () => {
    const view = render(<Harness folderId="proj-a" />);
    expect(await screen.findByText("proj-a で送ったメッセージ")).toBeVisible();

    view.rerender(<Harness folderId="proj-b" />);

    // 読み込みの往復を待たず、切替と同時に消えていること。
    // 非同期ロードの完了待ちで前フォルダの会話が残る状態を弾く。
    expect(
      screen.queryByText("proj-a で送ったメッセージ"),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(saved.some((call) => call.folderId === "proj-a")).toBe(true);
    });
    assertNoForeignSessions(saved);
  });

  it("切替直後に新規会話を実行しても他フォルダのセッションを書き込まない", async () => {
    const view = render(<Harness folderId="proj-a" />);
    await screen.findByText("proj-a で送ったメッセージ");

    // セッション読み込みの完了を待たずに新規会話を実行する（破損の再現経路）
    view.rerender(<Harness folderId="proj-b" />);
    fireEvent.click(screen.getByRole("button", { name: /新規/ }));

    await waitFor(() => {
      expect(saved.length).toBeGreaterThan(0);
    });
    assertNoForeignSessions(saved);
    expect(stored["proj-b"]?.sessions ?? []).not.toContainEqual(
      expect.objectContaining({ id: expect.stringContaining("proj-a") }),
    );
  });

  it("下書きは往復で復元され、別フォルダには漏れない", async () => {
    const view = render(<Harness folderId="proj-a" />);
    await screen.findByText("proj-a で送ったメッセージ");

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "書きかけ" },
    });

    view.rerender(<Harness folderId="proj-b" />);
    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveValue("");
    });

    view.rerender(<Harness folderId="proj-a" />);
    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveValue("書きかけ");
    });
  });
});
