import { describe, expect, it } from "vitest";
import {
  resolveInitialViewMode,
  resolveMarkdownLink,
  resolvePane2Mode,
  resolveViewOnlyKind,
  supportsPreview,
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
