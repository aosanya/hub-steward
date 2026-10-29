import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Roster, type RosterRow } from "./Roster";
import { loadFromList, pageByKey, type RosterLoad } from "./usePagedRoster";

type Person = { id: string; name: string };

const people = (count: number): Person[] =>
  Array.from({ length: count }, (_, i) => ({ id: `ac${String(i).padStart(3, "0")}`, name: `Member ${String(i).padStart(3, "0")}` }));

const rowOf = (p: Person): RosterRow => ({ key: p.id, title: p.name });
const keyOf = (p: Person) => p.id;

const listLoad = (all: Person[]): RosterLoad<Person> => vi.fn(loadFromList(all, keyOf));

describe("roster paging", () => {
  it("shows 50 of 120 and asks the next page with the last key", async () => {
    const load = listLoad(people(120));
    render(<Roster load={load} toRow={rowOf} />);
    expect(await screen.findByText("Member 049")).toBeInTheDocument();
    expect(screen.queryByText("Member 050")).not.toBeInTheDocument();
    expect(load).toHaveBeenCalledWith(50, "", "");

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(await screen.findByText("Member 099")).toBeInTheDocument();
    expect(load).toHaveBeenLastCalledWith(50, "ac049", "");
    expect(screen.getByText("Member 000")).toBeInTheDocument();
  });

  it("hides Show more on a short page", async () => {
    render(<Roster load={listLoad(people(30))} toRow={rowOf} />);
    expect(await screen.findByText("Member 029")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("hides Show more when a full page is followed by an empty one", async () => {
    render(<Roster load={listLoad(people(50))} toRow={rowOf} />);
    fireEvent.click(await screen.findByRole("button", { name: "Show more" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument());
    expect(screen.getAllByText(/^Member /)).toHaveLength(50);
  });

  it("uses the next key the tool answers with", async () => {
    const load: RosterLoad<Person> = vi.fn(async (_limit, after) =>
      after ? { items: [{ id: "z", name: "Grace Adhiambo" }] } : { items: [{ id: "a", name: "Asha Otieno" }], next: "cursor-1" },
    );
    render(<Roster load={load} toRow={rowOf} pageSize={1} />);
    fireEvent.click(await screen.findByRole("button", { name: "Show more" }));
    expect(await screen.findByText("Grace Adhiambo")).toBeInTheDocument();
    expect(load).toHaveBeenLastCalledWith(1, "cursor-1", "");
  });

  it("builds a key page only when the page is full", () => {
    expect(pageByKey(people(3), 3, keyOf).next).toBe("ac002");
    expect(pageByKey(people(2), 3, keyOf).next).toBeUndefined();
    expect(pageByKey([], 3, keyOf).next).toBeUndefined();
  });
});

describe("roster search", () => {
  it("filters the loaded rows by name and by key", async () => {
    const all = [{ id: "ac1", name: "Asha Otieno" }, { id: "ac2", name: "Grace Adhiambo" }];
    render(<Roster load={listLoad(all)} toRow={rowOf} />);
    await screen.findByText("Asha Otieno");
    await userEvent.type(screen.getByLabelText("Search by name"), "grace");
    expect(screen.queryByText("Asha Otieno")).not.toBeInTheDocument();
    expect(screen.getByText("Grace Adhiambo")).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Search by name"));
    await userEvent.type(screen.getByLabelText("Search by name"), "ac1");
    expect(screen.getByText("Asha Otieno")).toBeInTheDocument();
    expect(screen.queryByText("Grace Adhiambo")).not.toBeInTheDocument();
  });

  it("says no one matches when nothing loaded matches and nothing more is left", async () => {
    render(<Roster load={listLoad(people(3))} toRow={rowOf} />);
    await screen.findByText("Member 000");
    await userEvent.type(screen.getByLabelText("Search by name"), "zzz");
    expect(screen.getByText(/No one matches/)).toBeInTheDocument();
  });

  it("keeps Show more when the match may be on a page not loaded yet", async () => {
    render(<Roster load={listLoad(people(120))} toRow={rowOf} />);
    await screen.findByText("Member 000");
    await userEvent.type(screen.getByLabelText("Search by name"), "Member 077");
    expect(screen.queryByText("Member 077")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(await screen.findByText("Member 077")).toBeInTheDocument();
    expect(screen.queryByText("Member 000")).not.toBeInTheDocument();
  });

  it("refetches with the term when the tool searches", async () => {
    const load: RosterLoad<Person> = vi.fn(async (_l, _a, term) =>
      term ? { items: [{ id: "ac9", name: "Grace Adhiambo" }] } : { items: [{ id: "ac1", name: "Asha Otieno" }] },
    );
    render(<Roster load={load} toRow={rowOf} serverSearch />);
    await screen.findByText("Asha Otieno");
    await userEvent.type(screen.getByLabelText("Search by name"), "Gra");
    expect(await screen.findByText("Grace Adhiambo")).toBeInTheDocument();
    expect(screen.queryByText("Asha Otieno")).not.toBeInTheDocument();
    expect(load).toHaveBeenLastCalledWith(50, "", "Gra");
  });
});

describe("roster states", () => {
  it("announces the first page loading as a small note and draws no card", () => {
    const pending: RosterLoad<Person> = vi.fn(() => new Promise<never>(() => {}));
    const { container } = render(<Roster load={pending} toRow={rowOf} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(screen.getByRole("status")).toHaveClass("roster-note");
    expect(container.querySelector(".card")).toBeNull();
  });

  it("shows the empty card with no search box", async () => {
    render(<Roster load={listLoad([])} toRow={rowOf} emptyTitle="No farmers yet" />);
    expect(await screen.findByText("No farmers yet")).toBeInTheDocument();
    expect(screen.queryByLabelText("Search by name")).not.toBeInTheDocument();
  });

  it("shows an error card when the first page fails", async () => {
    render(<Roster load={vi.fn().mockRejectedValue(new Error("down"))} toRow={rowOf} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("The list could not be loaded.");
  });

  it("keeps the loaded rows and says so when a later page fails", async () => {
    const load: RosterLoad<Person> = vi
      .fn()
      .mockResolvedValueOnce(pageByKey(people(50), 50, keyOf))
      .mockRejectedValueOnce(new Error("down"));
    render(<Roster load={load} toRow={rowOf} />);
    fireEvent.click(await screen.findByRole("button", { name: "Show more" }));
    expect(await screen.findByText("More could not be loaded.")).toBeInTheDocument();
    expect(screen.getByText("Member 049")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show more" })).toBeEnabled();
  });
});
