import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Segmented } from "./Segmented";

const items = [
  { id: "waiting", label: "Waiting · 2" },
  { id: "answered", label: "Answered" },
];

describe("Segmented", () => {
  it("draws each label as a button in one group", () => {
    render(<Segmented items={items} current="waiting" onChange={() => undefined} />);
    const group = screen.getByRole("group");
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(group).toContainElement(screen.getByRole("button", { name: "Waiting · 2" }));
    expect(group).toContainElement(screen.getByRole("button", { name: "Answered" }));
  });

  it("presses only the current one", () => {
    render(<Segmented items={items} current="answered" onChange={() => undefined} />);
    expect(screen.getByRole("button", { name: "Answered" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Waiting · 2" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange once with the id of the other one", async () => {
    const onChange = vi.fn();
    render(<Segmented items={items} current="waiting" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Answered" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("answered");
  });

  it("calls nothing when the current one is pressed", async () => {
    const onChange = vi.fn();
    render(<Segmented items={items} current="waiting" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Waiting · 2" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("names the group when a label is given", () => {
    render(<Segmented items={items} current="waiting" onChange={() => undefined} label="Access for Core team" />);
    expect(screen.getByRole("group", { name: "Access for Core team" })).toBeInTheDocument();
  });

  it("disables every button and calls nothing while disabled", async () => {
    const onChange = vi.fn();
    render(<Segmented items={items} current="waiting" onChange={onChange} disabled />);
    expect(screen.getByRole("button", { name: "Answered" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Answered" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
