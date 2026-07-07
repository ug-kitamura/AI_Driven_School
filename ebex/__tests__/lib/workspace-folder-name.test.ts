import { describe, expect, it } from "vitest";
import {
  applyEventDateToSuggestedName,
  resolveEventDatePrefix,
  suggestUntitledFolderName,
} from "@/lib/workspace-folder-name";

describe("suggestUntitledFolderName", () => {
  const date = new Date(2026, 6, 7);

  it("returns untitled1 when no matching folders exist", () => {
    expect(suggestUntitledFolderName([], date)).toBe("20260707-untitled1");
  });

  it("ignores folders with different date prefix", () => {
    expect(
      suggestUntitledFolderName(["20260706-untitled1", "other"], date),
    ).toBe("20260707-untitled1");
  });

  it("increments from max existing number", () => {
    expect(
      suggestUntitledFolderName(
        ["20260707-untitled1", "20260707-untitled3", "20260707-demo"],
        date,
      ),
    ).toBe("20260707-untitled4");
  });
});

describe("resolveEventDatePrefix", () => {
  const today = new Date(2026, 6, 8);

  it("preserves date from existing folder name", () => {
    expect(resolveEventDatePrefix("20260701-old-name", today)).toBe("20260701");
  });

  it("uses today when no date prefix", () => {
    expect(resolveEventDatePrefix("my-folder", today)).toBe("20260708");
  });
});

describe("applyEventDateToSuggestedName", () => {
  it("replaces suggested date with event date", () => {
    expect(
      applyEventDateToSuggestedName("20260708-meeting-notes", "20260701"),
    ).toBe("20260701-meeting-notes");
  });
});
