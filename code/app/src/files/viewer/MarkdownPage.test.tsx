import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownPage } from "./MarkdownPage";

const page = (source: string) => render(<MarkdownPage source={source} />).container;

describe("markdown page", () => {
  it("renders headings one and two", () => {
    const container = page("# Title\n\n## Section\n\n###### Small");
    expect(container.querySelector(".doc-page")).not.toBeNull();
    expect(container.querySelector("h1")?.textContent).toBe("Title");
    expect(container.querySelector("h2")?.textContent).toBe("Section");
    expect(container.querySelector("h6")?.textContent).toBe("Small");
  });

  it("renders a web link that opens in a new tab without the opener", () => {
    const link = page("Read [the guide](https://example.com/g).").querySelector("a");
    expect(link).toHaveAttribute("href", "https://example.com/g");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link?.getAttribute("rel")).toContain("noopener");
    expect(link?.textContent).toBe("the guide");
  });

  it("renders a mailto link", () => {
    expect(page("[mail](mailto:a@b.co)").querySelector("a")).toHaveAttribute("href", "mailto:a@b.co");
  });

  it("renders bullet and numbered list items with a nested list", () => {
    const container = page("- one\n- two\n  - inner\n\n1. first\n2. second");
    expect(container.querySelectorAll("ul > li")).toHaveLength(3);
    expect(container.querySelector("ul ul li")?.textContent).toBe("inner");
    expect(container.querySelectorAll("ol > li")).toHaveLength(2);
  });

  it("renders a table with header cells and body cells", () => {
    const container = page("| a | b |\n| :-- | --: |\n| 1 | 2 |\n| 3 | 4 |");
    expect(container.querySelectorAll("table thead th")).toHaveLength(2);
    expect(container.querySelector("table thead th")?.textContent).toBe("a");
    expect(container.querySelectorAll("table tbody tr")).toHaveLength(2);
    expect(container.querySelector("table tbody td")?.textContent).toBe("1");
  });

  it("renders a fenced block as code inside pre", () => {
    const container = page("```go\nfmt.Println(1)\n  indented\n```\n\nafter");
    expect(container.querySelector("pre > code")?.textContent).toBe("fmt.Println(1)\n  indented");
    expect(container.querySelector("p")?.textContent).toBe("after");
  });

  it("renders a blockquote", () => {
    const container = page("> quoted text\n> more");
    expect(container.querySelector("blockquote")?.textContent).toContain("quoted text more");
  });

  it("renders a horizontal rule", () => {
    expect(page("above\n\n---\n\nbelow").querySelector("hr")).not.toBeNull();
  });

  it("shows a script tag as text and creates no script element", () => {
    const container = page("<script>alert(1)</script>");
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("gives a javascript link no anchor and keeps its text", () => {
    const container = page("[click](javascript:alert(1)) and [data](data:text/html,x) and [rel](./a.md)");
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("click");
    expect(container.textContent).toContain("rel");
  });

  it("gives an image tag with an error handler no img element", () => {
    const container = page("<img src=x onerror=alert(1)>\n\n![the logo](https://example.com/l.png)");
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(container.textContent).toContain("the logo");
  });

  it("renders emphasis, strong, strikethrough and inline code", () => {
    const container = page("*soft* and _also_ and **hard** and ~~gone~~ and `x < y`");
    expect(container.querySelectorAll("em")).toHaveLength(2);
    expect(container.querySelector("strong")?.textContent).toBe("hard");
    expect(container.querySelector("del")?.textContent).toBe("gone");
    expect(container.querySelector("p code")?.textContent).toBe("x < y");
  });

  it("joins soft line breaks with a space and turns two trailing spaces into a br", () => {
    const container = page("one\ntwo  \nthree");
    expect(container.querySelector("p")?.textContent).toBe("one twothree");
    expect(container.querySelectorAll("br")).toHaveLength(1);
  });

  it("does not crash on an unclosed fence and shows its body", () => {
    const container = page("```\nnever closed\nstill code");
    expect(container.querySelector("pre > code")?.textContent).toBe("never closed\nstill code");
  });

  it("does not crash on unmatched markers", () => {
    const container = page("**open [x](y `tick ~~ _ * \\");
    expect(container.querySelector(".doc-page")).not.toBeNull();
  });

  it("renders empty source as an empty page", () => {
    const container = page("");
    expect(container.querySelector(".doc-page")).not.toBeNull();
    expect(container.querySelector(".doc-page")?.children).toHaveLength(0);
  });

  it("handles a very long run of markers quickly", () => {
    const started = Date.now();
    page("*".repeat(20000) + " " + "[".repeat(20000) + "`".repeat(5000));
    expect(Date.now() - started).toBeLessThan(5000);
  });
});
