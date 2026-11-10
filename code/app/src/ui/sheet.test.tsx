import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sheet } from "./Sheet";

describe("Sheet", () => {
  it("shows its title as a dialog with its children", () => {
    render(
      <Sheet title="Rule on" onClose={() => undefined}>
        <p>Tag</p>
      </Sheet>,
    );
    expect(screen.getByRole("dialog", { name: "Rule on" })).toContainElement(screen.getByText("Tag"));
  });

  it("closes from the scrim and from Escape", async () => {
    const onClose = vi.fn();
    render(
      <Sheet title="Rule on" onClose={onClose}>
        <p>Tag</p>
      </Sheet>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
