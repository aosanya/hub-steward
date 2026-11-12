import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ActionsMenu } from "./ActionsMenu";

const show = (onSelect = vi.fn()) => {
  render(
    <MemoryRouter>
      <ActionsMenu actions={[{ label: "Edit rules", onSelect }, { label: "Change who has access", to: "/access" }]} />
    </MemoryRouter>,
  );
  return onSelect;
};

describe("the Actions dropdown", () => {
  it("shows only the button until it is tapped", () => {
    show();
    expect(screen.getByRole("button", { name: "Actions" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Edit rules" })).toBeNull();
  });

  it("lists the actions when tapped and runs one, then closes", async () => {
    const onSelect = show();
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("link", { name: "Change who has access" })).toHaveAttribute("href", "/access");
    await userEvent.click(screen.getByRole("button", { name: "Edit rules" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Edit rules" })).toBeNull();
  });

  it("closes on Escape and on a tap outside", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "Edit rules" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    await userEvent.click(document.body);
    expect(screen.queryByRole("button", { name: "Edit rules" })).toBeNull();
  });

  it("draws nothing when there are no actions", () => {
    render(<ActionsMenu actions={[]} />);
    expect(screen.queryByRole("button", { name: "Actions" })).toBeNull();
  });
});

describe("the Actions dropdown as an icon button", () => {
  it("shows the icon, names the button by its label, and draws a danger action in the danger colour", async () => {
    render(
      <MemoryRouter>
        <ActionsMenu icon="⋯" label="Piece 4 menu" actions={[{ label: "Rename", onSelect: () => {} }, { label: "Delete", danger: true, onSelect: () => {} }]} />
      </MemoryRouter>,
    );
    const button = screen.getByRole("button", { name: "Piece 4 menu" });
    expect(button).toHaveTextContent("⋯");
    expect(button).not.toHaveTextContent("▾");
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("danger");
    expect(screen.getByRole("button", { name: "Rename" })).not.toHaveClass("danger");
  });
});
