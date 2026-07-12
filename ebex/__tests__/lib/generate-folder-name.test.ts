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
  it("includes today and paths", () => {
    const prompt = buildFolderNameUserPrompt(
      ["notes.md", "recording.mp4"],
      new Date(2026, 6, 12),
    );
    expect(prompt).toContain("20260712");
    expect(prompt).toContain("- notes.md");
    expect(prompt).toContain("- recording.mp4");
  });
});
