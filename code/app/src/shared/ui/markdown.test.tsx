import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";

describe("markdown", () => {
  it("shows bold, inline code and links without their marks", () => {
    const { container } = render(<Markdown text={"Make **three** tables like `chapter` and read [the guide](https://example.com/g)."} />);
    expect(container.textContent).toBe("Make three tables like chapter and read the guide.");
    expect(container.querySelector("strong")?.textContent).toBe("three");
    expect(container.querySelector("code")?.textContent).toBe("chapter");
    expect(screen.getByRole("link", { name: "the guide" })).toHaveAttribute("href", "https://example.com/g");
  });

  it("keeps line breaks inside a paragraph and starts a new paragraph at a blank line", () => {
    const { container } = render(<Markdown text={"one\ntwo\n\nthree"} />);
    expect(container.querySelectorAll("p")).toHaveLength(2);
    expect(container.querySelectorAll("br")).toHaveLength(1);
  });

  it("makes bullet and numbered lists", () => {
    const { container } = render(<Markdown text={"Steps:\n- first\n- second\n1. one\n2. two"} />);
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
  });

  it("does not turn a link that is not http or https into a link and never injects markup", () => {
    const { container } = render(<Markdown text={"[x](javascript:alert(1)) <b>raw</b>"} />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<b>raw</b>");
  });

  it("lets a bold run cross a code span that holds an asterisk", () => {
    const text = "never added beside them. **reconciled against the existing `tier*`/`hierarchy`/`role` tables and the plane, at HEAD**";
    const { container } = render(<Markdown text={text} />);
    expect(container.textContent).not.toContain("**");
    expect(container.textContent).toBe("never added beside them. reconciled against the existing tier*/hierarchy/role tables and the plane, at HEAD");
    const strong = container.querySelector("strong") as HTMLElement;
    expect(strong.querySelectorAll("code")).toHaveLength(3);
  });

  it("leaves an unmatched pair of asterisks as they were written", () => {
    const { container } = render(<Markdown text="a ** b" />);
    expect(container.textContent).toBe("a ** b");
  });

  it("shows emphasis written with single asterisks and leaves stray asterisks alone", () => {
    const { container } = render(<Markdown text={"the *hash* of it, 2 * 3 * 4 and a lone * star"} />);
    expect(container.querySelector("em")?.textContent).toBe("hash");
    expect(container.textContent).toBe("the hash of it, 2 * 3 * 4 and a lone * star");
  });

  it("shows only the words of a link that points at a file or any other address that is not http or https", () => {
    const { container } = render(<Markdown text={"see [the spec](../../developer/documentation/2.%20design/a.md) and [mail](mailto:a@b.c)"} />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe("see the spec and mail");
  });

  it("keeps a javascript link and a script tag inert", () => {
    const { container } = render(<Markdown text={"[go](javascript:alert(1)) <script>alert(2)</script> *<img src=x onerror=alert(3)>*"} />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<script>alert(2)</script>");
  });
});
