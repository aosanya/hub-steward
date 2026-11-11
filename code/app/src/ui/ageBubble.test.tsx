import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgeBubble } from "./AgeBubble";

const now = Date.parse("2026-11-11T12:00:00Z");

describe("AgeBubble", () => {
  it("shows the age of an open issue in a plain chip with the creation time as its title", () => {
    render(<AgeBubble created="2026-11-11T11:55:00Z" now={now} />);
    const bubble = screen.getByText("5 min");
    expect(bubble.className).toBe("chip");
    expect(bubble.getAttribute("title")).toMatch(/^Created .*2026/);
  });

  it("shows the time taken by a closed issue, with both times in its title", () => {
    render(<AgeBubble created="2026-11-09T09:00:00Z" ended="2026-11-11T09:00:00Z" closed now={now} />);
    const bubble = screen.getByText("2 days");
    expect(bubble.getAttribute("title")).toMatch(/Created .*2026.*finished .*2026/);
  });

  it("shows nothing for a closed issue with no finish time", () => {
    const { container } = render(<AgeBubble created="2026-11-09T09:00:00Z" closed now={now} />);
    expect(container.textContent).toBe("");
  });

  it("shows nothing when the created time is missing", () => {
    const { container } = render(<AgeBubble now={now} />);
    expect(container.textContent).toBe("");
  });
});
