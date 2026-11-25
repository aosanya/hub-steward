import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useView, ViewSwitch } from "./ViewSwitch";

const labels = () => screen.getAllByRole("button").map((button) => button.textContent);

const Probe = () => {
  const [view, choose] = useView();
  const place = useLocation();
  return (
    <>
      <p data-testid="view">{view}</p>
      <p data-testid="search">{place.search}</p>
      <button type="button" onClick={() => choose("rules")}>
        pick rules
      </button>
      <button type="button" onClick={() => choose("list")}>
        pick list
      </button>
    </>
  );
};

const probe = (at: string) =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <Probe />
    </MemoryRouter>,
  );

describe("the view switch", () => {
  it("offers List and Board only, unless the viewer may read rules", () => {
    render(<ViewSwitch current="board" onChange={() => undefined} />);
    expect(labels()).toEqual(["List", "Board"]);
  });

  it("offers List, Board, Rules, Decisions and Questions when the viewer may read rules", () => {
    render(<ViewSwitch current="board" onChange={() => undefined} mayReadRules />);
    expect(labels()).toEqual(["List", "Board", "Rules", "Decisions", "Questions"]);
  });

  it("offers two when mayReadRules is false", () => {
    render(<ViewSwitch current="list" onChange={() => undefined} mayReadRules={false} />);
    expect(labels()).toEqual(["List", "Board"]);
  });

  it("marks the current choice, including a rulebook one", () => {
    render(<ViewSwitch current="decisions" onChange={() => undefined} mayReadRules />);
    expect(screen.getByRole("button", { name: "Decisions" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Board" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reports the choice by id", async () => {
    const onChange = vi.fn();
    render(<ViewSwitch current="board" onChange={onChange} mayReadRules />);
    await userEvent.click(screen.getByRole("button", { name: "Questions" }));
    await userEvent.click(screen.getByRole("button", { name: "List" }));
    expect(onChange.mock.calls).toEqual([["questions"], ["list"]]);
  });
});

describe("useView", () => {
  it("answers board by default and list for view=list", () => {
    probe("/x");
    expect(screen.getByTestId("view")).toHaveTextContent("board");
  });

  it("answers list for view=list", () => {
    probe("/x?view=list");
    expect(screen.getByTestId("view")).toHaveTextContent("list");
  });

  it("answers board for a stale view=rules", () => {
    probe("/x?view=rules");
    expect(screen.getByTestId("view")).toHaveTextContent("board");
  });

  it("keeps view=list when Rules is picked, and does not flip to Board", async () => {
    probe("/x?view=list");
    await userEvent.click(screen.getByRole("button", { name: "pick rules" }));
    expect(screen.getByTestId("view")).toHaveTextContent("list");
    expect(screen.getByTestId("search")).toHaveTextContent("?view=list");
  });

  it("writes only list or board, and leaves the address alone for a rulebook choice", async () => {
    probe("/x");
    await userEvent.click(screen.getByRole("button", { name: "pick rules" }));
    expect(screen.getByTestId("search")).toHaveTextContent("");
    await userEvent.click(screen.getByRole("button", { name: "pick list" }));
    expect(screen.getByTestId("search")).toHaveTextContent("?view=list");
  });
});
