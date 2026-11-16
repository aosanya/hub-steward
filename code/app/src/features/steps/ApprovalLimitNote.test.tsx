import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApprovalLimitNote } from "./ApprovalLimitNote";

describe("the approval limit note", () => {
  it("shows the amount in forints", () => {
    render(<ApprovalLimitNote limit={{ amount: 500000 }} />);
    expect(screen.getByText("Your approval limit: 500 000 Ft")).toBeTruthy();
  });

  it("says no upper limit is written when the amount is missing", () => {
    render(<ApprovalLimitNote limit={{}} />);
    expect(screen.getByText("No upper limit is written to your role.")).toBeTruthy();
  });

  it("shows nothing without a limit", () => {
    const { container } = render(<ApprovalLimitNote limit={undefined} />);
    expect(container.innerHTML).toBe("");
  });
});
