import { describe, expect, it } from "vitest";
import {
  buildFolderNameUserPrompt,
  normalizeSuggestedFolderName,
  sanitizeFolderSlug,
} from "@/lib/agent/generate-folder-name";

describe("sanitizeFolderSlug", () => {
  it("normalizes to a short slug", () => {
    expect(sanitizeFolderSlug("Meeting Notes!!")).toBe("meeting-notes");
  });
});

describe("normalizeSuggestedFolderName", () => {
  const today = new Date(2026, 6, 12);

  it("keeps a valid dated name", () => {
    expect(normalizeSuggestedFolderName("20260115-kickoff", today)).toBe(
      "20260115-kickoff",
    );
  });

  it("uses today when date is missing", () => {
    expect(normalizeSuggestedFolderName("kickoff-meeting", today)).toBe(
      "20260712-kickoff-meeting",
    );
  });

  it("falls back to untitled when empty", () => {
    expect(normalizeSuggestedFolderName("   ", today)).toBe("20260712-untitled");
  });
});

describe("buildFolderNameUserPrompt", () => {
  it("includes today and paths without excerpts", () => {
    const prompt = buildFolderNameUserPrompt(
      ["notes.md", "recording.mp4"],
      new Date(2026, 6, 12),
    );
    expect(prompt).toContain("20260712");
    expect(prompt).toContain("- notes.md");
    expect(prompt).toContain("- recording.mp4");
    expect(prompt).not.toContain("テキスト抜粋");
  });

  it("includes path list and text excerpts as equal clues", () => {
    const prompt = buildFolderNameUserPrompt(
      ["notes.md", "photo.png"],
      new Date(2026, 6, 12),
      [{ relativePath: "notes.md", content: "# キックオフ議事録" }],
    );
    expect(prompt).toContain("ファイルパス一覧:");
    expect(prompt).toContain("- notes.md");
    expect(prompt).toContain("テキスト抜粋（パス一覧と同格の手がかり）:");
    expect(prompt).toContain("### notes.md");
    expect(prompt).toContain("# キックオフ議事録");
  });
});
