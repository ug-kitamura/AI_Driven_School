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

/** どの scopeKey のセッションかを session id の接頭辞で判別できるようにする。 */
function makeSession(scopeKey: string, suffix: string): AgentChatSession {
  const now = new Date().toISOString();
  return {
    id: `${scopeKey}--${suffix}`,
    title: `${scopeKey} の会話`,
    messages: [
      {
        id: `${scopeKey}--msg`,
        role: "user",
        content: `${scopeKey} で送ったメッセージ`,
        createdAt: now,
      },
    ],
    activeSkillId: null,
    createdAt: now,
    updatedAt: now,
  };
}

function makeStorage(scopeKey: string): AgentChatStorage {
  const session = makeSession(scopeKey, "s1");
  return { version: 1, activeSessionId: session.id, sessions: [session] };
}

type SavedCall = { scopeKey: string; storage: AgentChatStorage };

let saved: SavedCall[];
let stored: Record<string, AgentChatStorage>;

function installFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      if (input.startsWith("/api/agent/session?")) {
        const scopeKey = decodeURIComponent(
          new URL(input, "http://localhost").searchParams.get("scope") ?? "",
        );
        if (init?.method === "PUT") {
          const storage = JSON.parse(String(init.body)) as AgentChatStorage;
          saved.push({ scopeKey, storage });
          stored[scopeKey] = storage;
          return { ok: true, json: async () => ({ ok: true }) };
        }
        const existing = stored[scopeKey];
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
function Harness({ scopeKey }: { scopeKey: string }) {
  const draftsRef = useRef<AgentChatDraftMap>(new Map());
  return (
    <AgentChatPane
      key={scopeKey}
      scopeKey={scopeKey}
      currentFilePath={null}
      onOpenSettings={() => {}}
      draftsRef={draftsRef}
      skills={[]}
    />
  );
}

/**
 * 不変条件: どのフォルダへの保存も、そのフォルダに属する session id しか含まない。
 * session id は `<scopeKey>--<suffix>` の形にしてあるので所有者を判定できる。
 */
function assertNoForeignSessions(calls: SavedCall[]) {
  for (const call of calls) {
    for (const session of call.storage.sessions) {
      const owner = session.id.includes("--")
        ? session.id.split("--")[0]
        : call.scopeKey;
      expect(
        owner === call.scopeKey,
        `${call.scopeKey} の保存に ${owner} のセッション (${session.id}) が混入した`,
      ).toBe(true);
    }
  }
}

describe("AgentChatPane の作業スコープ同一性", () => {
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
    const view = render(<Harness scopeKey="proj-a" />);
    expect(await screen.findByText("proj-a で送ったメッセージ")).toBeVisible();

    view.rerender(<Harness scopeKey="proj-b" />);

    // 読み込みの往復を待たず、切替と同時に消えていること。
    // 非同期ロードの完了待ちで前フォルダの会話が残る状態を弾く。
    expect(
      screen.queryByText("proj-a で送ったメッセージ"),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(saved.some((call) => call.scopeKey === "proj-a")).toBe(true);
    });
    assertNoForeignSessions(saved);
  });

  it("切替直後に新規会話を実行しても他フォルダのセッションを書き込まない", async () => {
    const view = render(<Harness scopeKey="proj-a" />);
    await screen.findByText("proj-a で送ったメッセージ");

    // セッション読み込みの完了を待たずに新規会話を実行する（破損の再現経路）
    view.rerender(<Harness scopeKey="proj-b" />);
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
    const view = render(<Harness scopeKey="proj-a" />);
    await screen.findByText("proj-a で送ったメッセージ");

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "書きかけ" },
    });

    view.rerender(<Harness scopeKey="proj-b" />);
    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveValue("");
    });

    view.rerender(<Harness scopeKey="proj-a" />);
    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveValue("書きかけ");
    });
  });
});
