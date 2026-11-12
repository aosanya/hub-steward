import { render, screen } from "@testing-library/react";
import { SectionHeading } from "./SectionHeading";

describe("SectionHeading", () => {
  it("is one level 2 heading carrying its words", () => {
    render(<SectionHeading>Records</SectionHeading>);
    const heading = screen.getByRole("heading", { level: 2, name: "Records" });
    expect(heading).toHaveClass("heading");
  });
});

describe("SectionHeading with an action", () => {
  it("keeps the heading on its own and puts the action beside it in one row", () => {
    render(<SectionHeading action={<button type="button">Mark all read</button>}>Updates</SectionHeading>);
    const heading = screen.getByRole("heading", { level: 2, name: "Updates" });
    const row = heading.closest(".heading-row") as HTMLElement;
    expect(row).toContainElement(screen.getByRole("button", { name: "Mark all read" }));
  });
});
