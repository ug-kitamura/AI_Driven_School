import { describe, expect, it } from "vitest";
import {
  getFileExtension,
  getFileIconColorClass,
  resolveFileIconCategory,
} from "@/lib/workspace-file-icon";
import {
  buildRenamedFolderPath,
  getFolderBaseName,
} from "@/lib/workspace-tree";

describe("resolveFileIconCategory", () => {
  it("classifies common file types", () => {
    expect(resolveFileIconCategory("notes.md")).toBe("text");
    expect(resolveFileIconCategory("page.html")).toBe("code");
    expect(resolveFileIconCategory("index.htm")).toBe("code");
    expect(resolveFileIconCategory("app.ts")).toBe("code");
    expect(resolveFileIconCategory("App.tsx")).toBe("code");
    expect(resolveFileIconCategory("page.jsx")).toBe("code");
    expect(resolveFileIconCategory("script.groovy")).toBe("code");
    expect(resolveFileIconCategory("run.bat")).toBe("code");
    expect(resolveFileIconCategory("deploy.sh")).toBe("code");
    expect(resolveFileIconCategory("config.json")).toBe("code");
    expect(resolveFileIconCategory("values.yaml")).toBe("code");
    expect(resolveFileIconCategory("data.csv")).toBe("table");
    expect(resolveFileIconCategory("Photo.PNG")).toBe("image");
    expect(resolveFileIconCategory("photo.jpeg")).toBe("image");
    expect(resolveFileIconCategory("icon.svg")).toBe("image");
    expect(resolveFileIconCategory("clip.mp4")).toBe("video");
    expect(resolveFileIconCategory("anim.gif")).toBe("video");
    expect(resolveFileIconCategory("voice.mp3")).toBe("audio");
    expect(resolveFileIconCategory("subs.vtt")).toBe("audio");
    expect(resolveFileIconCategory("archive.zip")).toBe("zip");
    expect(resolveFileIconCategory("slides.pptx")).toBe("other");
    expect(resolveFileIconCategory("unknown.xyz")).toBe("other");
  });

  it("classifies secret files by name and extension", () => {
    expect(resolveFileIconCategory(".env")).toBe("secret");
    expect(resolveFileIconCategory(".env.local")).toBe("secret");
    expect(resolveFileIconCategory(".env.template")).toBe("secret");
    expect(resolveFileIconCategory(".env.example")).toBe("secret");
    expect(resolveFileIconCategory("server.crt")).toBe("secret");
  });
});

describe("getFileIconColorClass", () => {
  it("uses chart-1 with higher dark-mode contrast for every file category", () => {
    expect(getFileIconColorClass("text")).toBe("text-chart-1/60 dark:text-chart-1");
    expect(getFileIconColorClass("code")).toBe("text-chart-1/60 dark:text-chart-1");
    expect(getFileIconColorClass("image")).toBe("text-chart-1/60 dark:text-chart-1");
    expect(getFileIconColorClass("secret")).toBe("text-chart-1/60 dark:text-chart-1");
    expect(getFileIconColorClass("zip")).toBe("text-chart-1/60 dark:text-chart-1");
    expect(getFileIconColorClass("other")).toBe("text-chart-1/60 dark:text-chart-1");
  });
});

describe("getFileExtension", () => {
  it("handles compound extensions case-insensitively", () => {
    expect(getFileExtension("archive.tar.gz")).toBe(".tar.gz");
    expect(getFileExtension("Archive.TAR.GZ")).toBe(".tar.gz");
  });
});

describe("folder rename helpers", () => {
  it("extracts folder base name", () => {
    expect(getFolderBaseName("parent/child")).toBe("child");
    expect(getFolderBaseName("foo")).toBe("foo");
  });

  it("builds renamed folder path", () => {
    expect(buildRenamedFolderPath("parent/child", "newchild")).toBe(
      "parent/newchild",
    );
    expect(buildRenamedFolderPath("foo", "bar")).toBe("bar");
  });

  it("treats case-only folder rename as a change", () => {
    expect(getFolderBaseName("Foo")).not.toBe(getFolderBaseName("foo"));
  });
});
