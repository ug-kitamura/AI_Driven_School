import { describe, expect, it } from "vitest";
import {
  formatVttTimestamp,
  parseVtt,
  resolveInitialViewMode,
  resolveMarkdownLink,
  resolvePane2Mode,
  resolveViewOnlyKind,
  supportsPreview,
  vttSpeakerHue,
} from "@/lib/file-preview";

describe("resolveInitialViewMode", () => {
  it("閲覧主目的の拡張子は preview 初期", () => {
    expect(resolveInitialViewMode("page.html")).toBe("preview");
    expect(resolveInitialViewMode("index.HTM")).toBe("preview");
    expect(resolveInitialViewMode("data.csv")).toBe("preview");
    expect(resolveInitialViewMode("subs.vtt")).toBe("preview");
  });

  it("編集主目的の拡張子は edit 初期", () => {
    expect(resolveInitialViewMode("notes.md")).toBe("edit");
    expect(resolveInitialViewMode("config.json")).toBe("edit");
    expect(resolveInitialViewMode("values.yml")).toBe("edit");
    expect(resolveInitialViewMode("values.yaml")).toBe("edit");
  });
});

describe("resolveMarkdownLink", () => {
  const dir = "demo/docs";

  it("アンカーは anchor になる", () => {
    expect(resolveMarkdownLink("#見出し", dir)).toEqual({
      type: "anchor",
      id: "見出し",
    });
    expect(resolveMarkdownLink("#%E8%A6%8B", dir)).toEqual({
      type: "anchor",
      id: "見",
    });
  });

  it("外部 URL は copy-external になる", () => {
    expect(resolveMarkdownLink("https://example.com/a?b=1", dir)).toEqual({
      type: "copy-external",
      url: "https://example.com/a?b=1",
    });
    expect(resolveMarkdownLink("HTTP://example.com", dir)).toEqual({
      type: "copy-external",
      url: "HTTP://example.com",
    });
  });

  it("プロジェクト内相対パスは open-file になる", () => {
    expect(resolveMarkdownLink("./notes.md", dir)).toEqual({
      type: "open-file",
      folderPath: "demo/docs",
      fileName: "notes.md",
    });
    expect(resolveMarkdownLink("../sub/deep.md", dir)).toEqual({
      type: "open-file",
      folderPath: "demo/sub",
      fileName: "deep.md",
    });
    expect(resolveMarkdownLink("notes.md#section", dir)).toEqual({
      type: "open-file",
      folderPath: "demo/docs",
      fileName: "notes.md",
    });
  });

  it("プロジェクト外へ抜ける相対パスは blocked になる", () => {
    expect(resolveMarkdownLink("../../other/x.md", dir)).toEqual({
      type: "blocked",
    });
    expect(resolveMarkdownLink("../../../etc/passwd", dir)).toEqual({
      type: "blocked",
    });
  });

  it("スキーム付き・絶対パス・空 href は blocked になる", () => {
    expect(resolveMarkdownLink("mailto:a@example.com", dir)).toEqual({
      type: "blocked",
    });
    expect(resolveMarkdownLink("javascript:alert(1)", dir)).toEqual({
      type: "blocked",
    });
    expect(resolveMarkdownLink("/absolute/path.md", dir)).toEqual({
      type: "blocked",
    });
    expect(resolveMarkdownLink("", dir)).toEqual({ type: "blocked" });
  });

  it("プロジェクトフォルダ自体へのリンクは blocked になる", () => {
    expect(resolveMarkdownLink("..", dir)).toEqual({ type: "blocked" });
  });
});

describe("resolvePane2Mode", () => {
  it("maps edit-preview extensions", () => {
    expect(resolvePane2Mode("notes.md")).toBe("edit-preview");
    expect(resolvePane2Mode("page.HTML")).toBe("edit-preview");
    expect(resolvePane2Mode("data.csv")).toBe("edit-preview");
    expect(resolvePane2Mode("config.json")).toBe("edit-preview");
    expect(resolvePane2Mode("values.yml")).toBe("edit-preview");
    expect(resolvePane2Mode("values.yaml")).toBe("edit-preview");
    expect(resolvePane2Mode("subs.vtt")).toBe("edit-preview");
  });

  it("maps edit-only extensions", () => {
    expect(resolvePane2Mode("main.py")).toBe("edit-only");
    expect(resolvePane2Mode("app.js")).toBe("edit-only");
    expect(resolvePane2Mode("App.jsx")).toBe("edit-only");
    expect(resolvePane2Mode("index.ts")).toBe("edit-only");
    expect(resolvePane2Mode("Button.tsx")).toBe("edit-only");
    expect(resolvePane2Mode("styles.css")).toBe("edit-only");
    expect(resolvePane2Mode("run.bat")).toBe("edit-only");
    expect(resolvePane2Mode("script.ps1")).toBe("edit-only");
    expect(resolvePane2Mode("deploy.sh")).toBe("edit-only");
    expect(resolvePane2Mode("readme.txt")).toBe("edit-only");
  });

  it("maps view-only extensions", () => {
    expect(resolvePane2Mode("photo.png")).toBe("view-only");
    expect(resolvePane2Mode("photo.jpg")).toBe("view-only");
    expect(resolvePane2Mode("photo.jpeg")).toBe("view-only");
    expect(resolvePane2Mode("icon.webp")).toBe("view-only");
    expect(resolvePane2Mode("anim.gif")).toBe("view-only");
    expect(resolvePane2Mode("logo.svg")).toBe("view-only");
    expect(resolvePane2Mode("doc.pdf")).toBe("view-only");
    expect(resolvePane2Mode("archive.zip")).toBe("view-only");
  });

  it("treats unknown binary extensions as unsupported", () => {
    expect(resolvePane2Mode("setup.exe")).toBe("unsupported");
    expect(resolvePane2Mode("lib.dll")).toBe("unsupported");
    expect(resolvePane2Mode("data.bin")).toBe("unsupported");
    expect(resolvePane2Mode("archive.rar")).toBe("unsupported");
    expect(resolvePane2Mode("archive.7z")).toBe("unsupported");
    expect(resolvePane2Mode("noext")).toBe("unsupported");
  });
});

describe("supportsPreview", () => {
  it("is a thin wrapper for edit-preview", () => {
    expect(supportsPreview("a.md")).toBe(true);
    expect(supportsPreview("a.py")).toBe(false);
    expect(supportsPreview("a.png")).toBe(false);
  });
});

describe("resolveViewOnlyKind", () => {
  it("resolves image / pdf / zip", () => {
    expect(resolveViewOnlyKind("a.png")).toBe("image");
    expect(resolveViewOnlyKind("a.pdf")).toBe("pdf");
    expect(resolveViewOnlyKind("a.zip")).toBe("zip");
    expect(resolveViewOnlyKind("a.md")).toBe(null);
  });
});

describe("parseVtt", () => {
  it("<v 話者名> タグから話者と本文を抽出する", () => {
    const vtt = [
      "WEBVTT",
      "",
      "00:00:02.000 --> 00:00:06.500",
      "<v 北村>皆さん、お疲れ様です。</v>",
    ].join("\n");
    expect(parseVtt(vtt)).toEqual([
      {
        start: "00:00:02.000",
        end: "00:00:06.500",
        speaker: "北村",
        text: "皆さん、お疲れ様です。",
      },
    ]);
  });

  it("行頭の「話者名:」をフォールバックとして話者に使う", () => {
    const vtt = [
      "00:00:01.000 --> 00:00:03.000",
      "鈴木: よろしくお願いします",
    ].join("\n");
    expect(parseVtt(vtt)).toEqual([
      {
        start: "00:00:01.000",
        end: "00:00:03.000",
        speaker: "鈴木",
        text: "よろしくお願いします",
      },
    ]);
  });

  it("話者を特定できない cue は speaker が null になる", () => {
    const vtt = ["00:00:04.000 --> 00:00:05.000", "拍手が起きる"].join("\n");
    expect(parseVtt(vtt)[0]).toMatchObject({
      speaker: null,
      text: "拍手が起きる",
    });
  });

  it("終了時刻の後ろの配置設定を無視する", () => {
    const vtt = [
      "00:00:00.000 --> 00:00:02.000 align:start",
      "<v A>hi</v>",
    ].join("\n");
    expect(parseVtt(vtt)[0]).toMatchObject({
      start: "00:00:00.000",
      end: "00:00:02.000",
    });
  });
});

describe("vttSpeakerHue", () => {
  it("同一話者名は常に同じ色相を返す", () => {
    expect(vttSpeakerHue("北村")).toBe(vttSpeakerHue("北村"));
  });

  it("0–359 の範囲に収まる", () => {
    const hue = vttSpeakerHue("鈴木");
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
  });
});

describe("formatVttTimestamp", () => {
  it("ミリ秒を除去する", () => {
    expect(formatVttTimestamp("00:00:02.000")).toBe("00:00:02");
    expect(formatVttTimestamp("01:23:45.678")).toBe("01:23:45");
  });
});
