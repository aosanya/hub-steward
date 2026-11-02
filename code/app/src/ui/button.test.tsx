import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Button } from "./Button";

describe("Button", () => {
  it("is a quiet button that does not submit", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Back</Button>);
    const button = screen.getByRole("button", { name: "Back" });
    expect(button.className).toBe("btn quiet");
    expect(button.getAttribute("type")).toBe("button");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("carries a given class and kind", () => {
    render(<Button kind="primary" className="inline">Save</Button>);
    expect(screen.getByRole("button", { name: "Save" }).className).toBe("btn primary inline");
  });

  it("is a link with the same classes when it is given a place to go", () => {
    render(
      <MemoryRouter>
        <Button kind="primary" className="inline" to="/market/seed/join">Join</Button>
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "Join" });
    expect(link.getAttribute("href")).toBe("/market/seed/join");
    expect(link.className).toBe("btn primary inline");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
