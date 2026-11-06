import { render, screen } from "@testing-library/react";
import { ListRow } from "./ListRow";

describe("ListRow", () => {
  it("shows two equal meta lines both", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<ListRow title="Yes" meta={["Same words", "Same words"]} />);
    expect(screen.getAllByText("Same words")).toHaveLength(2);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("shows a code on its own first meta line marked as code, before the other meta lines", () => {
    const { container } = render(<ListRow title="Siaya farmers" code="G-S7F-4KM-2RX" meta="Approval needed" />);
    const lines = Array.from(container.querySelectorAll(".meta"));
    expect(lines.map((el) => el.textContent)).toEqual(["G-S7F-4KM-2RX", "Approval needed"]);
    expect(lines.map((el) => el.classList.contains("code"))).toEqual([true, false]);
  });

  it("derives the lead letter from the title only when asked", () => {
    const { container, rerender } = render(<ListRow title="  siaya farmers" lead />);
    expect(container.querySelector(".lead")?.textContent).toBe("S");
    rerender(<ListRow title="siaya farmers" />);
    expect(container.querySelector(".lead")).toBeNull();
  });

  it("hides the chevron from the row's name and leaves any other end words in it", () => {
    render(
      <>
        <ListRow title="Opens" end="›" onClick={() => undefined} />
        <ListRow title="Costs" end="KES 500" onClick={() => undefined} />
      </>,
    );
    expect(screen.getByRole("button", { name: "Opens" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Costs KES 500" })).toBeInTheDocument();
  });

  it("puts a given class on the row, button or not", () => {
    const { container, rerender } = render(<ListRow title="A" className="room" />);
    expect(container.querySelector("div.row.room")).not.toBeNull();
    rerender(<ListRow title="A" className="room" onClick={() => undefined} />);
    expect(container.querySelector("button.row.room")).not.toBeNull();
  });

  it("gives a given role to the row, button or not, and none otherwise", () => {
    const { container, rerender } = render(<ListRow title="A" role="menuitem" onClick={() => undefined} />);
    expect(container.querySelector('button.row[role="menuitem"]')).not.toBeNull();
    rerender(<ListRow title="A" role="listitem" />);
    expect(container.querySelector('div.row[role="listitem"]')).not.toBeNull();
    rerender(<ListRow title="A" onClick={() => undefined} />);
    expect(container.querySelector("button.row")?.hasAttribute("role")).toBe(false);
  });
});
