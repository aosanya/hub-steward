import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { anchorOf, BookContents } from "./BookContents";
import { numbered } from "./bookFixture";

const rules = [numbered(1, { title: "No comments in code" }), numbered(2, { title: "Font sizes are in rem" })];

const shown = () =>
  render(
    <>
      <BookContents rules={rules} />
      {rules.map((rule) => (
        <h3 key={rule.code} id={anchorOf(rule.code)}>
          {rule.title}
        </h3>
      ))}
    </>,
  );

const linkTo = (code: string) => screen.getByRole("link", { name: new RegExp(code) });

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

describe("the Book contents", () => {
  it("sits in a navigation landmark named Contents", () => {
    shown();
    expect(screen.getByRole("navigation", { name: "Contents" })).toBeTruthy();
  });

  it("keeps list semantics for every rule inside that landmark", () => {
    shown();
    const nav = screen.getByRole("navigation", { name: "Contents" });
    expect(within(nav).getByRole("list").getAttribute("role")).toBe("list");
    expect(within(nav).getAllByRole("listitem")).toHaveLength(2);
  });

  it("moves focus to the heading of the rule that was picked", () => {
    shown();
    fireEvent.click(linkTo("R-2"));
    const target = document.getElementById(anchorOf("R-2"));
    expect(document.activeElement).toBe(target);
    expect(target?.getAttribute("tabindex")).toBe("-1");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("leaves the other headings out of the tab order", () => {
    shown();
    fireEvent.click(linkTo("R-2"));
    expect(document.getElementById(anchorOf("R-1"))?.hasAttribute("tabindex")).toBe(false);
  });

  it.each([
    ["control", { ctrlKey: true }],
    ["command", { metaKey: true }],
    ["shift", { shiftKey: true }],
    ["alt", { altKey: true }],
    ["middle button", { button: 1 }],
  ])("leaves a %s click to the browser", (_name, init) => {
    shown();
    const notPrevented = fireEvent.click(linkTo("R-2"), init);
    expect(notPrevented).toBe(true);
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(document.getElementById(anchorOf("R-2")));
  });

  it("stops the browser jumping when a plain click is handled", () => {
    shown();
    expect(fireEvent.click(linkTo("R-1"))).toBe(false);
  });

  it("leaves a heading that is not on the page alone", () => {
    render(<BookContents rules={rules} />);
    expect(() => fireEvent.click(linkTo("R-1"))).not.toThrow();
  });
});

describe("the Book contents styles", () => {
  const css = readFileSync(resolve(__dirname, "book.css"), "utf8");

  it("keeps a picked heading clear of the sticky bar", () => {
    expect(css).toMatch(/scroll-margin-top:\s*[\d.]+rem/);
  });
});
