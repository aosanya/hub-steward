import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SectionHeading } from ".";

const show = (ui: ReactElement) =>
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>);

describe("SectionHeading", () => {
  it("shows the title as a second-level heading in a section head", () => {
    const { container } = show(<SectionHeading title="Generated" />);
    expect(container.querySelector(".section-head > h2")).toHaveTextContent("Generated");
    expect(screen.getByRole("heading", { level: 2, name: "Generated" })).toBeInTheDocument();
    expect(container.querySelector(".count")).toBeNull();
    expect(container.querySelector(".section-note")).toBeNull();
  });

  it("shows the count right after the title in the mono style", () => {
    const { container } = show(<SectionHeading title="Generated" count={6} />);
    expect(container.querySelector(".section-head > h2 + .count")).toHaveTextContent("6");
  });

  it("shows a tag at the right with its tone", () => {
    show(<SectionHeading title="Checks" end={{ kind: "tag", text: "Valid", tone: "ok" }} />);
    expect(screen.getByText("Valid")).toHaveClass("tag", "ok");
  });

  it("shows plain text at the right", () => {
    show(<SectionHeading title="Checks" end={{ kind: "text", text: "3 of 4" }} />);
    expect(screen.getByText("3 of 4")).toHaveClass("muted");
  });

  it("shows a link with an arrow at the right", () => {
    const { container } = show(<SectionHeading title="Limits" end={{ kind: "link", label: "See all", to: "/h/x/usage" }} />);
    const link = screen.getByRole("link", { name: "See all" });
    expect(link).toHaveAttribute("href", "/h/x/usage");
    expect(link).toHaveClass("link", "sm");
    expect(container.querySelector(".section-head > a svg")).not.toBeNull();
  });

  it("shows a quiet extra-small button at the right that can be disabled", async () => {
    const onClick = vi.fn();
    const { rerender } = show(<SectionHeading title="Rules" end={{ kind: "button", label: "Add", onClick }} />);
    const button = screen.getByRole("button", { name: "Add" });
    expect(button).toHaveClass("btn", "quiet", "xs");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(
      <MemoryRouter>
        <SectionHeading title="Rules" end={{ kind: "button", label: "Add", onClick, disabled: true }} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("shows the one-line note under the heading", () => {
    const { container } = show(<SectionHeading title="Steps" note="One line under the heading." />);
    expect(container.querySelector(".section-head > .section-note")).toHaveTextContent("One line under the heading.");
  });

  it("keeps the count before the end item and the note last", () => {
    const { container } = show(
      <SectionHeading title="Generated" count="6" end={{ kind: "tag", text: "Valid", tone: "ok" }} note="Note." />,
    );
    const parts = [...(container.querySelector(".section-head") as HTMLElement).children].map((child) => child.className.split(" ")[0] || child.tagName.toLowerCase());
    expect(parts).toEqual(["h2", "count", "tag", "section-note"]);
  });

  it("names the heading so a region can be labelled by it", () => {
    show(<SectionHeading id="steps-heading" title="Steps" />);
    expect(screen.getByRole("heading", { name: "Steps" })).toHaveAttribute("id", "steps-heading");
  });
});
