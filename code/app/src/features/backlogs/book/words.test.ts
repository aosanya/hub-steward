import { describe, expect, it } from "vitest";
import * as book from "./words";

const sentencesOf = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (typeof value === "function") return sentencesOf((value as (...args: unknown[]) => unknown)(new Date(2026, 10, 25)));
  if (value && typeof value === "object") return Object.values(value).flatMap(sentencesOf);
  return [];
};

describe("the words of the Book", () => {
  it("has no blank word and no word padded with spaces", () => {
    const sentences = Object.entries(book)
      .filter(([name]) => name !== "joinWords")
      .flatMap(([, value]) => sentencesOf(value));
    expect(sentences.length).toBeGreaterThan(5);
    expect(sentences.filter((sentence) => sentence !== sentence.trim() || sentence.trim() === "")).toEqual([]);
  });

  it("names the button and the title", () => {
    expect(book.bookButton).toBe("Book");
    expect(book.readAsBookButton).toBe("Read as a book");
    expect(book.readAsBookHint).toBe("Open every rule in force as one page to read or print");
    expect(book.bookTitle).toBe("Best practices");
  });

  it("says the day the Book was read in full", () => {
    expect(book.readOnWords(new Date(2026, 10, 25))).toBe("Read on 25 November 2026");
  });

  it("leads the two reference sentences", () => {
    expect(book.cameFromWords).toBe("Came from");
    expect(book.doneRightInWords).toBe("Done right in");
  });

  it("says nothing in force and a failed load", () => {
    expect(book.emptyWords).toBe("No rules are in force yet.");
    expect(book.loadFailedWords).toBe("The Book could not be loaded.");
  });
});

describe("joinWords", () => {
  it("leaves one item alone", () => {
    expect(book.joinWords(["A"])).toEqual(["A"]);
  });

  it("joins two with and", () => {
    expect(book.joinWords(["A", "B"])).toEqual(["A", " and ", "B"]);
  });

  it("joins three with commas and a last and", () => {
    expect(book.joinWords(["A", "B", "C"]).join("")).toBe("A, B and C");
  });

  it("gives nothing for nothing and keeps the items themselves", () => {
    expect(book.joinWords([])).toEqual([]);
    const item = { code: "ISS-1" };
    expect(book.joinWords([item, item])[0]).toBe(item);
  });
});
