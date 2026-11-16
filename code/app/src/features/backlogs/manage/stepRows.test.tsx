import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StepsEditor } from "./StepsEditor";

const steps = [
  { key: "a", id: "s1", name: "To do", held: 0 },
  { key: "b", id: "s2", name: "Doing", held: 0 },
];

describe("a step row", () => {
  it("keeps rename, up, down and remove together in one line of controls", () => {
    render(<StepsEditor steps={steps} onChange={() => undefined} showHeld={false} />);
    const group = screen.getByRole("button", { name: "Rename To do" }).parentElement as HTMLElement;
    expect(group.className).toBe("icbs");
    ["Move To do up", "Move To do down", "Remove To do"].forEach((name) => expect(screen.getByRole("button", { name }).parentElement).toBe(group));
  });
});
