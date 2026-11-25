import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookPage } from "./BookPage";
import { arrive, bookAt, bookClientOf, leave, numbered, readyRules } from "./bookFixture";

vi.mock("../../inbox/useNeedsYou", () => ({ useNeedsYou: () => ({ count: 0, newsUnread: false, failed: false, refreshInvitations: () => undefined }) }));

const wideQuery = "(min-width: 48rem)";

beforeEach(() => {
  arrive();
  window.matchMedia = ((query: string) => ({
    matches: query === wideQuery,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as never;
});

afterEach(() => {
  leave();
  Reflect.deleteProperty(window, "matchMedia");
});

describe("the Book on a wide window at 1440 x 900", () => {
  it("is one article in one column, with the contents above the rules", async () => {
    bookAt(<BookPage client={bookClientOf(readyRules([numbered(1), numbered(2)]))} />);
    await screen.findByRole("heading", { level: 1, name: "Best practices" });
    expect(document.querySelectorAll("article")).toHaveLength(1);
    const article = document.querySelector("article") as HTMLElement;
    const children = Array.from(article.children).map((one) => one.className || one.tagName.toLowerCase());
    expect(children).toEqual(["h1", "book-read", "book-contents", "book-rule", "book-rule"]);
  });

  it("holds the column to 40rem, as the style says", () => {
    const css = readFileSync(resolve(__dirname, "book.css"), "utf8");
    expect(css).toMatch(/\.book\s*\{[^}]*max-width:\s*40rem[^}]*margin:\s*0 auto/);
  });
});
