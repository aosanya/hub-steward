import { describe, expect, it } from "vitest";
import { linkOf, noteOf, noteTime } from "./issueNotes";

describe("the Log of an issue", () => {
  it("a link with a label and a web address is tappable under its label", () => {
    expect(linkOf("commit 3f9a1c2 https://example.test/commit/3f9a1c2")).toEqual({ label: "commit 3f9a1c2", href: "https://example.test/commit/3f9a1c2" });
  });

  it("a bare web address is its own label and a file path is not tappable", () => {
    expect(linkOf("https://example.test/run/481")).toEqual({ label: "https://example.test/run/481", href: "https://example.test/run/481" });
    expect(linkOf("loader/importer.go")).toEqual({ label: "loader/importer.go" });
  });

  it("an entry reads the writer, kind, text, links and time the hub sends", () => {
    expect(noteOf({ id: "n1", author_id: "w1", kind: "worker", text: "Done.", links: ["a", "", 3], created_at: "2026-11-10T14:02:00Z" })).toEqual({ id: "n1", author: "w1", kind: "worker", text: "Done.", links: ["a"], at: "2026-11-10T14:02:00Z", automatic: false });
    expect(noteOf({}).kind).toBe("person");
  });

  it("the time reads as a day, a month, and the hour and minute", () => {
    expect(noteTime("2026-11-10T14:02:00")).toBe("10 Nov, 14:02");
    expect(noteTime("not a time")).toBe("not a time");
  });
});
