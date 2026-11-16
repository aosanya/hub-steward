import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PublishReport } from "./PublishReport";
import { type PublishClient, type PublishedReport } from "./publishApi";

const report: PublishedReport = { version: 2, gitPath: "reports/arrivals.pdf", publishedAt: "2026-11-13T09:30:00Z" };

const clientOf = (): PublishClient => ({
  holds: vi.fn(async () => true),
  closedFormId: vi.fn(async () => "f1"),
  latest: vi.fn(async () => null),
  files: vi.fn(async () => [{ name: "arrivals.pdf", path: "reports/arrivals.pdf", version: "abc1234def5678", committedAt: "2026-11-13T09:30:00Z" }]),
  publish: vi.fn(async () => report),
});

const phoneWidth = 390;
const originalWidth = window.innerWidth;

const resizeTo = (width: number) => {
  window.innerWidth = width;
  window.dispatchEvent(new Event("resize"));
};

const show = async () => {
  let container!: HTMLElement;
  await act(async () => {
    container = render(<PublishReport formName="Arrival" client={clientOf()} />).container;
  });
  return container;
};

beforeEach(() => resizeTo(phoneWidth));

afterEach(() => {
  cleanup();
  resizeTo(originalWidth);
  vi.restoreAllMocks();
});

describe("the publish report list on a phone", () => {
  it("finds the report file entry and the Publish button by role inside the container", async () => {
    const container = await show();
    expect(window.innerWidth).toBe(phoneWidth);
    expect(container).toContainElement(screen.getByRole("button", { name: /arrivals\.pdf/ }));
    expect(container).toContainElement(screen.getByRole("button", { name: "Publish" }));
  });

  it("is built from the shared ListRow and Button parts", async () => {
    const container = await show();
    const rows = container.querySelectorAll(".rows > .row");
    expect(rows).toHaveLength(1);
    expect(rows[0].querySelector(".ttl")).toHaveTextContent("arrivals.pdf");
    expect(container.querySelector("input")).toBeNull();
    const button = screen.getByRole("button", { name: "Publish" });
    expect(button).toHaveClass("btn", "primary");
  });

  it("sets no pixel width and no font size inline on any element", async () => {
    const container = await show();
    container.querySelectorAll("[style]").forEach((element) => {
      const style = element.getAttribute("style") ?? "";
      expect(style).not.toMatch(/(^|;)\s*width\s*:\s*[\d.]+px/i);
      expect(style).not.toMatch(/font-size/i);
    });
  });

  it("shows the version, file and date as a paragraph after a publish", async () => {
    const container = await show();
    await userEvent.click(screen.getByRole("button", { name: /arrivals\.pdf/ }));
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    const line = await screen.findByText(/Version 2/);
    expect(line.tagName).toBe("P");
    expect(container).toContainElement(line);
    expect(line).toHaveTextContent(/reports\/arrivals\.pdf/);
    expect(line).toHaveTextContent(/2026/);
  });
});

const styles = readFileSync(resolve(process.cwd(), "src/app.css"), "utf8");

describe("the field styles", () => {
  it("gives .field no fixed pixel width", () => {
    const rule = styles.match(/(^|\n)\.field\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule![2]).not.toMatch(/(^|[;\s])(min-|max-)?width\s*:\s*[\d.]+px/i);
  });
});
