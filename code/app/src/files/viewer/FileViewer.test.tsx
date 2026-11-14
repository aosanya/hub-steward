import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FileViewer } from "./FileViewer";

const goSource = 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("hi")\n}\n';

describe("file viewer", () => {
  it("shows a markdown file as a page with headings, a link, list items and a table", () => {
    const text = "# Title\n\n## Section\n\nRead [the guide](https://example.com/g).\n\n- one\n- two\n\n| a | b |\n| - | - |\n| 1 | 2 |\n";
    const { container } = render(<FileViewer name="guide.md" extension="md" text={text} size={text.length} />);
    expect(container.querySelector(".doc-page")).not.toBeNull();
    expect(container.querySelector("h1")?.textContent).toBe("Title");
    expect(container.querySelector("h2")?.textContent).toBe("Section");
    const link = container.querySelector("a");
    expect(link).toHaveAttribute("href", "https://example.com/g");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelector("table thead th")?.textContent).toBe("a");
    expect(container.querySelector("table tbody td")?.textContent).toBe("1");
  });

  it("shows a go file with numbered lines and a keyword token", () => {
    const { container } = render(<FileViewer name="main.go" extension="go" text={goSource} size={goSource.length} />);
    const numbers = Array.from(container.querySelectorAll(".code-line .code-no")).map((node) => node.textContent);
    expect(numbers.slice(0, 3)).toEqual(["1", "2", "3"]);
    const keywords = Array.from(container.querySelectorAll(".tok-keyword")).map((node) => node.textContent);
    expect(keywords).toContain("package");
  });

  it("shows a json file with numbered lines and a string token", () => {
    const text = '{\n  "name": "viewer",\n  "count": 3\n}\n';
    const { container } = render(<FileViewer name="package.json" extension="json" text={text} size={text.length} />);
    const numbers = Array.from(container.querySelectorAll(".code-line .code-no")).map((node) => node.textContent);
    expect(numbers.slice(0, 4)).toEqual(["1", "2", "3", "4"]);
    expect(container.querySelector(".tok-string")).not.toBeNull();
  });

  it("shows a txt file in a plain pre without line numbers", () => {
    const { container } = render(<FileViewer name="notes.txt" extension="txt" text={"first\nsecond"} size={12} />);
    const pre = container.querySelector("pre.text-view");
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toBe("first\nsecond");
    expect(container.querySelector(".code-no")).toBeNull();
  });

  it("shows a file with no extension as plain text", () => {
    const { container } = render(<FileViewer name="LICENSE" extension="" text="MIT" size={3} />);
    expect(container.querySelector("pre.text-view")?.textContent).toBe("MIT");
    expect(container.querySelector(".code-view")).toBeNull();
  });

  it("shows a Dockerfile as code", () => {
    const { container } = render(<FileViewer name="Dockerfile" extension="" text={"FROM alpine\nRUN ls"} size={18} />);
    expect(container.querySelector(".code-view")).not.toBeNull();
    expect(container.querySelectorAll(".code-line")).toHaveLength(2);
  });

  it("shows a png with bytes as an image named after the file", () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const { container } = render(<FileViewer name="logo.png" extension="png" text={null} size={8} bytes={bytes} />);
    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    expect(image).toHaveAttribute("alt", "logo.png");
    expect(image?.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
    expect(container.textContent).toContain("logo.png");
  });

  it("draws an svg with a script element as an img and lets no script element or markup reach the page", () => {
    const markup = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    const bytes = new TextEncoder().encode(markup);
    const { container } = render(<FileViewer name="logo.svg" extension="svg" text={null} size={bytes.length} bytes={bytes} />);
    expect(container.querySelector("img")?.getAttribute("src")).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
    expect(container.textContent).not.toContain("alert(1)");
  });

  it("says an image without bytes could not be shown and draws no image", () => {
    const { container } = render(<FileViewer name="logo.png" extension="png" text={null} size={1536} bytes={null} />);
    expect(container.querySelector("img")).toBeNull();
    const withheld = container.querySelector(".withheld");
    expect(withheld).not.toBeNull();
    expect(withheld?.textContent).toContain("logo.png");
    expect(withheld?.textContent).toContain("1.5 KB");
    expect(withheld?.textContent).toContain("This image could not be shown.");
  });

  it("withholds a binary file with its name, size and reason and renders no bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 3]);
    const { container } = render(<FileViewer name="tool.bin" extension="bin" text={null} size={2097152} bytes={bytes} reason="not text" />);
    const withheld = container.querySelector(".withheld");
    expect(withheld).not.toBeNull();
    expect(withheld?.textContent).toContain("tool.bin");
    expect(withheld?.textContent).toContain("2 MB");
    expect(screen.queryByText("This file is not text, so it is not shown.")).not.toBeNull();
    expect(container.querySelector("pre")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).not.toContain("\u0000");
  });

  it("withholds a file that is too large with its own sentence", () => {
    const { container } = render(<FileViewer name="dump.sql" extension="sql" text={null} size={12} reason="too large" />);
    const withheld = container.querySelector(".withheld");
    expect(withheld).not.toBeNull();
    expect(withheld?.textContent).toContain("dump.sql");
    expect(withheld?.textContent).toContain("12 B");
    expect(withheld?.textContent).toContain("This file is too large to show.");
    expect(container.querySelector("pre")).toBeNull();
  });

  it("keeps a very long single line inside the sideways scroll block with its number apart from the code", () => {
    const long = "x".repeat(500);
    const text = `var a = "${long}"`;
    const { container } = render(<FileViewer name="long.go" extension="go" text={text} size={text.length} />);
    const scroll = container.querySelector(".code-scroll");
    expect(scroll).not.toBeNull();
    const line = scroll?.querySelector(".code-line");
    expect(line).not.toBeNull();
    const number = line?.querySelector(".code-no");
    expect(number?.textContent).toBe("1");
    expect(line?.textContent).toContain(long);
    expect(number?.textContent).not.toContain("x");
  });

  it("never lets raw html or a javascript link from markdown reach the page", () => {
    const text = "<script>alert(1)</script>\n\n[x](javascript:alert(1))\n\n<img src=x onerror=alert(1)>";
    const { container } = render(<FileViewer name="evil.md" extension="md" text={text} size={text.length} />);
    expect(container.querySelector(".doc-page")).not.toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("opens a markdown link in a new tab without handing over the opener", () => {
    const text = "[docs](https://example.com/docs)";
    const { container } = render(<FileViewer name="a.md" extension="md" text={text} size={text.length} />);
    const link = container.querySelector("a");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link?.getAttribute("rel")).toContain("noopener");
  });

  it("shows a fenced block in markdown as pre containing code", () => {
    const text = "```go\nfmt.Println(1)\n```\n";
    const { container } = render(<FileViewer name="a.md" extension="md" text={text} size={text.length} />);
    expect(container.querySelector("pre > code")?.textContent).toContain("fmt.Println(1)");
  });
});
