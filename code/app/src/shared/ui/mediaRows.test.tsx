import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { statusTone } from "./Chip";
import { ListRow } from "./ListRow";
import { Section } from "./Section";

afterEach(cleanup);

const rowsOf = (...titles: string[]) => titles.map((title) => <ListRow key={title} title={title} meta="a lighter line" />);

describe("rows inside a section card read as media objects", () => {
  it("shows a square tile with the title's first letter when the section names no icon", () => {
    const { container } = render(<Section word="Groups" rows={rowsOf("Zöldhalom Seniors' Club")} />);
    expect(container.querySelector(".row .lead")?.textContent).toBe("Z");
  });

  it("shows the section's icon in the tile instead of the letter", () => {
    const { container } = render(<Section word="Groups" icon="users" rows={rowsOf("Zöldhalom Seniors' Club")} />);
    const tile = container.querySelector(".row .lead");
    expect(tile?.querySelector("svg[data-icon='users']")).not.toBeNull();
    expect(tile?.textContent).toBe("");
  });

  it("draws no tile in a plain section such as Personal detail", () => {
    const { container } = render(<Section word="Personal detail" plain rows={rowsOf("Name")} />);
    expect(container.querySelector(".row .lead")).toBeNull();
  });

  it("draws no tile for a row outside any section", () => {
    const { container } = render(<ListRow title="Name" />);
    expect(container.querySelector(".row .lead")).toBeNull();
  });
});

describe("a status tag is light: warning while open, success when done, neutral otherwise", () => {
  it("picks the tone from the status words", () => {
    expect(statusTone("Open")).toBe("waiting");
    expect(statusTone("received")).toBe("waiting");
    expect(statusTone("Paid")).toBe("success");
    expect(statusTone("done")).toBe("success");
    expect(statusTone("Overdue")).toBeUndefined();
    expect(statusTone("")).toBeUndefined();
  });
});
