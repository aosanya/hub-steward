import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ListRow } from "./ListRow";
import { Section } from "./Section";

afterEach(cleanup);

const wishes = [
  { title: "Bench at the Fő utca bus stop", status: "Open" },
  { title: "Streetlight out near number 14", status: "Done" },
  { title: "Pavement edge by the school", status: "Done" },
  { title: "Extra bin at the playground", status: "Declined" },
];

const rowsOf = (items: { title: string; status?: string }[]) => items.map((item) => <ListRow key={item.title} title={item.title} status={item.status} />);

const titles = () => Array.from(document.querySelectorAll(".row .ttl")).map((node) => node.textContent);

describe("a section's own screen filters its rows like a Bulma panel", () => {
  it("lists a tab for each status present, All first, with its count", () => {
    render(<Section word="Wishes and issues" full rows={rowsOf(wishes)} />);
    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual(["All4", "Open1", "Done2", "Declined1"]);
  });

  it("shows only the rows of the chosen tab and marks it selected", () => {
    render(<Section word="Wishes and issues" full rows={rowsOf(wishes)} />);
    fireEvent.click(screen.getByRole("tab", { name: /^Done/ }));
    expect(titles()).toEqual(["Streetlight out near number 14", "Pavement edge by the school"]);
    expect(screen.getByRole("tab", { name: /^Done/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("2 of 4")).toBeTruthy();
  });

  it("filters by title as the search box is typed in", () => {
    render(<Section word="Wishes and issues" full rows={rowsOf(wishes)} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search wishes and issues" }), { target: { value: "bin" } });
    expect(titles()).toEqual(["Extra bin at the playground"]);
    expect(screen.getByText("1 of 4")).toBeTruthy();
  });

  it("combines the tab and the search, and Show all clears both when nothing matches", () => {
    render(<Section word="Wishes and issues" full rows={rowsOf(wishes)} />);
    fireEvent.click(screen.getByRole("tab", { name: /^Open/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search wishes and issues" }), { target: { value: "bin" } });
    expect(titles()).toEqual([]);
    expect(screen.getByText("No match")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(titles()).toHaveLength(4);
    expect(screen.getByRole("tab", { name: /^All/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("draws no tabs when every row has the same status, and none when no row has one", () => {
    const { rerender } = render(<Section word="Bills" full rows={rowsOf(wishes.map((item) => ({ ...item, status: "Open" })))} />);
    expect(screen.queryByRole("tablist")).toBeNull();
    rerender(<Section word="Groups" full rows={rowsOf(wishes.map((item) => ({ title: item.title })))} />);
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("draws no search box for three rows or fewer", () => {
    render(<Section word="Groups" full rows={rowsOf(wishes.slice(0, 3))} />);
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("draws none of it on the resident's page, where the card shows at most three rows", () => {
    render(<Section word="Wishes and issues" rows={rowsOf(wishes)} />);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});
