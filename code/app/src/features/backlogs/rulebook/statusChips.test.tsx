import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StatusChips } from "./StatusChips";

const labels = () => screen.getAllByRole("button").map((button) => button.textContent);

describe("the status chips", () => {
  it("shows the four statuses of a rule, In force first", () => {
    render(<StatusChips kind="rule" chosen={["in_force", "proposed"]} onToggle={() => undefined} />);
    expect(labels()).toEqual(["In force", "Proposed", "Superseded", "Retired"]);
  });

  it("shows the three statuses of a decision and of a question", () => {
    const { unmount } = render(<StatusChips kind="decision" chosen={[]} onToggle={() => undefined} />);
    expect(labels()).toEqual(["Decided", "Proposed", "Superseded"]);
    unmount();
    render(<StatusChips kind="question" chosen={[]} onToggle={() => undefined} />);
    expect(labels()).toEqual(["Open", "Answered", "Dropped"]);
  });

  it("presses the chosen ones and no others", () => {
    render(<StatusChips kind="rule" chosen={["in_force", "proposed"]} onToggle={() => undefined} />);
    const pressed = screen.getAllByRole("button").map((button) => button.getAttribute("aria-pressed"));
    expect(pressed).toEqual(["true", "true", "false", "false"]);
  });

  it("is a group named Status", () => {
    render(<StatusChips kind="rule" chosen={[]} onToggle={() => undefined} />);
    expect(screen.getByRole("group", { name: "Status" })).toBeInTheDocument();
  });

  it("reports the status of the chip that was tapped", async () => {
    const onToggle = vi.fn();
    render(<StatusChips kind="rule" chosen={["in_force"]} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("button", { name: "Retired" }));
    await userEvent.click(screen.getByRole("button", { name: "In force" }));
    expect(onToggle.mock.calls).toEqual([["retired"], ["in_force"]]);
  });
});
