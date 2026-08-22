import { describe, expect, it, afterEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { SaveButton } from "@/components/workspace/SaveButton";
import { SeriesMetaView } from "@/components/workspace/meta-views/SeriesMetaView";
import { StaleTranslationNotice } from "@/components/workspace/translation/StaleTranslationNotice";
import { STALE_NOTICE_TEXT } from "@/components/workspace/translation/translationLabels";
import type { Series } from "@/lib/schema";

const seriesItem: Series = {
  id: "srs-1",
  name: "はじめにシリーズ",
  slug: "start",
  catch: "ここから旅がはじまる",
  description: "最初のシリーズ",
  courses: [],
};

function stubMetaEnFetch() {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/content/meta-en")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ja: { name: "はじめにシリーズ", catch: "旅の始まり", description: "説明" },
            en: { name_en: "Getting Started", catch_en: "", description_en: "" },
            en_source_hash: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
  vi.stubGlobal("fetch", fetchMock);
}

function renderSeries(
  language: "ja" | "en",
  status: "untranslated" | "fresh" | "stale" | undefined,
) {
  return render(
    <SeriesMetaView
      seriesItem={seriesItem}
      onRenameSeries={() => {}}
      onSaveMeta={() => {}}
      editLanguage={language}
      onEditLanguageChange={() => {}}
      translationStatus={status}
    />,
  );
}

describe("SaveButton", () => {
  afterEach(cleanup);

  it("保存が成功したらチェックマークで知らせる", async () => {
    render(<SaveButton onSave={() => Promise.resolve()} />);
    expect(screen.queryByText("保存しました")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /保存/ }));
    await waitFor(() => expect(screen.getByText("保存しました")).toBeTruthy());
  });

  it("保存が失敗したらチェックマークを出さない", async () => {
    render(<SaveButton onSave={() => Promise.reject(new Error("boom"))} />);
    fireEvent.click(screen.getByRole("button", { name: /保存/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /保存/ }).hasAttribute("disabled")).toBe(
        false,
      ),
    );
    expect(screen.queryByText("保存しました")).toBeNull();
  });
});

describe("StaleTranslationNotice", () => {
  afterEach(cleanup);

  it("stale のときだけ赤字1行を描く", () => {
    const { rerender } = render(<StaleTranslationNotice status="stale" />);
    expect(screen.getByText(STALE_NOTICE_TEXT)).toBeTruthy();

    rerender(<StaleTranslationNotice status="fresh" />);
    expect(screen.queryByText(STALE_NOTICE_TEXT)).toBeNull();

    rerender(<StaleTranslationNotice status="untranslated" />);
    expect(screen.queryByText(STALE_NOTICE_TEXT)).toBeNull();

    rerender(<StaleTranslationNotice status={undefined} />);
    expect(screen.queryByText(STALE_NOTICE_TEXT)).toBeNull();
  });
});

describe("メタビューの配置と鮮度の見せ方", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("日本語ビューでは stale でも赤字を出さない", () => {
    renderSeries("ja", "stale");
    expect(screen.queryByText(STALE_NOTICE_TEXT)).toBeNull();
  });

  it("英語ビューで stale なら赤字を出す", async () => {
    stubMetaEnFetch();
    renderSeries("en", "stale");
    await waitFor(() =>
      expect(screen.getByText(STALE_NOTICE_TEXT)).toBeTruthy(),
    );
  });

  it("英語ビューでも untranslated なら赤字を出さない", async () => {
    stubMetaEnFetch();
    renderSeries("en", "untranslated");
    await waitFor(() => expect(screen.getByLabelText("Series name")).toBeTruthy());
    expect(screen.queryByText(STALE_NOTICE_TEXT)).toBeNull();
  });

  it("鮮度チップを表示しない", () => {
    renderSeries("ja", "stale");
    expect(screen.queryByText("未翻訳")).toBeNull();
    expect(screen.queryByText("英語版が古い")).toBeNull();
    expect(screen.queryByText("最新として扱う")).toBeNull();
  });

  it("ヘッダーには保存ボタンを置かない（本文側にだけある）", () => {
    const { container } = renderSeries("ja", undefined);
    const header = container.querySelector(".h-12");
    expect(header).toBeTruthy();
    expect(header!.textContent).not.toContain("保存");
    expect(screen.getByRole("button", { name: /保存/ })).toBeTruthy();
  });

  it("英語ビューの項目順は 名前 → 説明 → キャッチ", async () => {
    stubMetaEnFetch();
    renderSeries("en", undefined);
    await waitFor(() => expect(screen.getByLabelText("Series name")).toBeTruthy());
    const labels = screen
      .getAllByText(/^(Series name|Description|Catch)$/)
      .map((el) => el.textContent);
    expect(labels).toEqual(["Series name", "Description", "Catch"]);
  });
});
