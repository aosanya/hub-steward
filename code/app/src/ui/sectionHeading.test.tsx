import { render, screen } from "@testing-library/react";
import { SectionHeading } from "./SectionHeading";

describe("SectionHeading", () => {
  it("is one level 2 heading carrying its words", () => {
    render(<SectionHeading>Records</SectionHeading>);
    const heading = screen.getByRole("heading", { level: 2, name: "Records" });
    expect(heading).toHaveClass("heading");
  });
});
