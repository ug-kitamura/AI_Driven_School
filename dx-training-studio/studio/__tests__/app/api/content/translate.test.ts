import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as postMeta } from "@/app/api/content/translate/meta/route";
import { POST as postBody } from "@/app/api/content/translate/lesson-body/route";
import { POST as postChangelog } from "@/app/api/content/translate/changelog/route";
import { anthropicProvider } from "@/lib/agent/llm/anthropic";
import {
  computeBodySourceHash,
  computeMetaSourceHash,
} from "@/lib/translation/freshness";

vi.mock("@/lib/agent/llm/anthropic", () => ({
  AI_KEY_ERROR: "AI API キーが未設定です",
  anthropicProvider: { runTurn: vi.fn() },
}));

const runTurn = vi.mocked(anthropicProvider.runTurn);

describe("/api/content/translate/*", () => {
  const roots: string[] = [];
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    cwdSpy?.mockRestore();
    runTurn.mockReset();
    for (const root of roots) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    roots.length = 0;
  });

  // ⚠ cwd 偽装を忘れると実 contents/ を汚染する。すべてのテストで最初に setup() を呼ぶこと
  function setup(options: { contract?: boolean } = {}): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "translate-api-"));
    roots.push(root);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(path.join(root, "studio"));
    const lessonDir = path.join(root, "contents", "シリーズA", "コースB", "レッスンC");
    fs.mkdirSync(lessonDir, { recursive: true });
    fs.writeFileSync(path.join(lessonDir, "contents.md"), "# 見出し\n\n本文\n", "utf-8");
    fs.writeFileSync(
      path.join(lessonDir, ".meta.json"),
      JSON.stringify({ description: "説明" }),
      "utf-8",
    );
    fs.writeFileSync(
      path.join(root, "contents", "シリーズA", "コースB", ".meta.json"),
      JSON.stringify({ target: "初心者", catch: "キャッチ", description: "コース説明" }),
      "utf-8",
    );
    if (options.contract !== false) {
      fs.mkdirSync(path.join(root, "contracts"), { recursive: true });
      fs.writeFileSync(
        path.join(root, "contracts", "translation-contract.md"),
        "# 翻訳契約\n<<CONTRACT-MARK>>\n",
        "utf-8",
      );
    }
    return root;
  }

  function request(url: string, body: unknown): Request {
    return new Request(`http://localhost${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ai-api-key": "test-key",
      },
      body: JSON.stringify(body),
    });
  }

  it("meta: キー無しは 401", async () => {
    setup();
    const res = await postMeta(
      new Request("http://localhost/api/content/translate/meta", {
        method: "POST",
        body: JSON.stringify({ level: "course", series: "シリーズA", course: "コースB" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("meta: 契約が無ければ 500 で止まる", async () => {
    setup({ contract: false });
    const res = await postMeta(
      request("/api/content/translate/meta", {
        level: "course",
        series: "シリーズA",
        course: "コースB",
      }),
    );
    expect(res.status).toBe(500);
    expect(runTurn).not.toHaveBeenCalled();
  });

  it("meta: フィールドとサーバー計算の en_source_hash を返し、Sonnet 5 固定・契約注入", async () => {
    setup();
    runTurn.mockResolvedValue({
      text: JSON.stringify({
        fields: { name_en: "Course B", target_en: "Beginners", junk: "x" },
      }),
    } as never);
    const res = await postMeta(
      request("/api/content/translate/meta", {
        level: "course",
        series: "シリーズA",
        course: "コースB",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.fields).toEqual({ name_en: "Course B", target_en: "Beginners" });
    expect(data.en_source_hash).toBe(
      computeMetaSourceHash({
        level: "course",
        name: "コースB",
        catch: "キャッチ",
        description: "コース説明",
        target: "初心者",
      }),
    );
    const call = runTurn.mock.calls[0]![0] as {
      model: string;
      system: string;
      messages: Array<{ content: string }>;
    };
    expect(call.model).toBe("claude-sonnet-5");
    expect(call.system).toContain("<<CONTRACT-MARK>>");
    expect(call.messages[0]!.content).toContain("初心者");
  });

  it("meta: 正本には書かない", async () => {
    const root = setup();
    runTurn.mockResolvedValue({
      text: JSON.stringify({ fields: { name_en: "Course B" } }),
    } as never);
    const metaPath = path.join(root, "contents", "シリーズA", "コースB", ".meta.json");
    const before = fs.readFileSync(metaPath, "utf-8");
    await postMeta(
      request("/api/content/translate/meta", {
        level: "course",
        series: "シリーズA",
        course: "コースB",
      }),
    );
    expect(fs.readFileSync(metaPath, "utf-8")).toBe(before);
  });

  it("lesson-body: 本文とサーバー計算のハッシュを分けて返す", async () => {
    setup();
    runTurn.mockResolvedValue({
      text: JSON.stringify({ body: "# Heading\n\nBody\n" }),
    } as never);
    const res = await postBody(
      request("/api/content/translate/lesson-body", {
        series: "シリーズA",
        course: "コースB",
        lesson: "レッスンC",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.body).toBe("# Heading\n\nBody\n");
    expect(data.sourceHash).toBe(computeBodySourceHash("# 見出し\n\n本文\n"));
  });

  it("lesson-body: 見出しが大幅に欠けた訳文は 502", async () => {
    const root = setup();
    const lessonPath = path.join(
      root,
      "contents",
      "シリーズA",
      "コースB",
      "レッスンC",
      "contents.md",
    );
    fs.writeFileSync(lessonPath, "# A\n\n## B\n\n## C\n\n## D\n", "utf-8");
    runTurn.mockResolvedValue({ text: JSON.stringify({ body: "# A\n" }) } as never);
    const res = await postBody(
      request("/api/content/translate/lesson-body", {
        series: "シリーズA",
        course: "コースB",
        lesson: "レッスンC",
      }),
    );
    expect(res.status).toBe(502);
  });

  it("changelog: 英語版があれば entries、無ければ full", async () => {
    const root = setup();
    fs.writeFileSync(
      path.join(root, "contents", "changelog.md"),
      "# 変更履歴\n\n## 2026-08-21\n\n- 追加\n",
      "utf-8",
    );
    runTurn.mockResolvedValue({
      text: JSON.stringify({ full: "# Changelog\n\n## 2026-08-21\n\n- Added\n" }),
    } as never);
    const res = await postChangelog(request("/api/content/translate/changelog", {}));
    const data = await res.json();
    expect(data.kind).toBe("full");

    fs.writeFileSync(
      path.join(root, "contents", "changelog.en.md"),
      "# Changelog\n\n## 2026-08-15\n\n- First\n",
      "utf-8",
    );
    runTurn.mockResolvedValue({
      text: JSON.stringify({ entries: "## 2026-08-21\n\n- Added\n" }),
    } as never);
    const res2 = await postChangelog(request("/api/content/translate/changelog", {}));
    const data2 = await res2.json();
    expect(data2.kind).toBe("entries");
    expect(data2.text).toContain("2026-08-21");
  });

  it("不正な応答はリトライ後 502", async () => {
    setup();
    runTurn.mockResolvedValue({ text: "not json" } as never);
    const res = await postMeta(
      request("/api/content/translate/meta", {
        level: "lesson",
        series: "シリーズA",
        course: "コースB",
        lesson: "レッスンC",
      }),
    );
    expect(res.status).toBe(502);
    expect(runTurn).toHaveBeenCalledTimes(2);
  });
});
