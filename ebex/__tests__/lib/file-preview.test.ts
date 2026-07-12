import { describe, expect, it } from "vitest";
import {
  resolvePane2Mode,
  resolveViewOnlyKind,
  supportsPreview,
} from "@/lib/file-preview";

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
