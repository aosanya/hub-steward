import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetOpenAgency } from "../../../shared/wakala/openAgency";
import { RulebookPage } from "./RulebookPage";
import { arrive, at, backlogsClient, clientOf, ready, rule } from "./rulebookFixture";
import type { RulebookClient } from "./types";

vi.mock("../../../shared/wakala/mcp", async () => {
  const actual = await vi.importActual<typeof import("../../../shared/wakala/mcp")>("../../../shared/wakala/mcp");
  return { ...actual, callTool: async () => ({ items: [] }) };
});

beforeEach(arrive);

afterEach(() => {
  cleanup();
  forgetOpenAgency();
});

const route = "/a/:agencyId/backlogs/:backlogId/rulebook";

const open = (client: RulebookClient, search = "?kind=rule", backlog = "b1") => at(`/a/hub-1/backlogs/${backlog}/rulebook${search}`, route, <RulebookPage client={client} backlogs={backlogsClient} />);

const rules = [
  rule({ code: "R-1", title: "No comments in code", tags: ["code"] }),
  rule({ code: "R-2", title: "Font sizes are in rem", tags: ["css", "app"], status: "proposed" }),
];

const choices = () => Array.from(screen.getByRole("group", { name: "View" }).querySelectorAll("button")).map((button) => button.textContent);

describe("the rulebook list on a phone", () => {
  it("shows the backlog name, the five choices with Rules pressed, and the count", async () => {
    open(clientOf({ list: async () => ready(rules) }));
    expect(await screen.findByText("2 rules")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sprint 1" })).toBeInTheDocument();
    expect(choices()).toEqual(["List", "Board", "Rules", "Decisions", "Questions"]);
    expect(screen.getByRole("button", { name: "Rules" })).toHaveAttribute("aria-pressed", "true");
  });

  it("says All issues for the all pseudo-backlog and asks for it by that id", async () => {
    const list = vi.fn(async () => ready(rules));
    open(clientOf({ list }), "?kind=rule", "all");
    expect(await screen.findByRole("heading", { name: "All issues" })).toBeInTheDocument();
    await screen.findByText("2 rules");
    expect(list).toHaveBeenCalledWith("all", "rule", { statuses: ["in_force", "proposed"] });
  });

  it("gives each row its code, title, status and tags, with a chevron", async () => {
    open(clientOf({ list: async () => ready(rules) }));
    const row = await screen.findByRole("row", { name: /R-2/ });
    expect(within(row).getByText("R-2")).toBeInTheDocument();
    expect(within(row).getByText("Font sizes are in rem")).toBeInTheDocument();
    expect(within(row).getByText("Proposed")).toBeInTheDocument();
    expect(within(row).getByText("css")).toBeInTheDocument();
    expect(within(row).getByText("app")).toBeInTheDocument();
    expect(row.textContent).toContain("›");
  });

  it("says which rule replaced a superseded row and plain Retired for a retired one", async () => {
    const held = [rule({ code: "R-6", title: "A comment says why", status: "superseded", supersededBy: "R-1" }), rule({ code: "R-7", title: "Mark Done in place", status: "retired" })];
    open(clientOf({ list: async () => ready(held) }));
    expect(await screen.findByText("Superseded by R-1")).toBeInTheDocument();
    expect(screen.getByText("Retired", { selector: "tbody .chip" })).toBeInTheDocument();
  });

  it("asks for In force and Proposed rules at first, and shows those chips pressed", async () => {
    const list = vi.fn(async () => ready(rules));
    open(clientOf({ list }));
    await screen.findByText("2 rules");
    expect(list).toHaveBeenCalledWith("b1", "rule", { statuses: ["in_force", "proposed"] });
    const chips = within(screen.getByRole("group", { name: "Status" })).getAllByRole("button");
    expect(chips.map((chip) => `${chip.textContent}:${chip.getAttribute("aria-pressed")}`)).toEqual(["In force:true", "Proposed:true", "Superseded:false", "Retired:false"]);
  });

  it.each([
    ["decision", ["decided", "proposed"], "Decisions"],
    ["question", ["open"], "Questions"],
  ])("takes the kind %s from the address", async (kind, statuses, label) => {
    const list = vi.fn(async () => ready([rule({ kind: kind as "decision", code: "D-3", title: "A file link", status: statuses[0] })]));
    open(clientOf({ list }), `?kind=${kind}`);
    await screen.findByText("1 " + kind);
    expect(list).toHaveBeenCalledWith("b1", kind, { statuses });
    expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the priority of a question beside its status", async () => {
    open(clientOf({ list: async () => ready([rule({ kind: "question", code: "Q-1", title: "A bad example?", status: "open", priority: "P1" })]) }), "?kind=question");
    expect(await screen.findByText("P1")).toBeInTheDocument();
    expect(screen.getByText("Open", { selector: "tbody .chip" })).toBeInTheDocument();
  });

  it("asks again with a status that is tapped on, and again without it when tapped off", async () => {
    const list = vi.fn(async () => ready(rules));
    open(clientOf({ list }));
    await screen.findByText("2 rules");
    await userEvent.click(screen.getByRole("button", { name: "Superseded" }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith("b1", "rule", { statuses: ["in_force", "proposed", "superseded"] }));
    await userEvent.click(screen.getByRole("button", { name: "Proposed" }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith("b1", "rule", { statuses: ["in_force", "superseded"] }));
  });

  it("writes the chosen statuses into the address, so Back from a record keeps them", async () => {
    open(clientOf({ list: async () => ready(rules) }));
    await screen.findByText("2 rules");
    await userEvent.click(screen.getByRole("button", { name: "Superseded" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/a/hub-1/backlogs/b1/rulebook?kind=rule&status=in_force&status=proposed&status=superseded"));
    await userEvent.click(await screen.findByRole("row", { name: /R-2/ }));
    expect(JSON.parse(screen.getByTestId("state").textContent ?? "").backTo).toBe("/a/hub-1/backlogs/b1/rulebook?kind=rule&status=in_force&status=proposed&status=superseded");
  });

  it("takes the statuses of the address when they belong to the kind", async () => {
    const list = vi.fn(async () => ready(rules));
    open(clientOf({ list }), "?kind=rule&status=retired&status=bogus");
    await screen.findByText("2 rules");
    expect(list).toHaveBeenCalledWith("b1", "rule", { statuses: ["retired"] });
  });

  it("asks nothing and says so when every chip is off", async () => {
    const list = vi.fn(async () => ready(rules));
    open(clientOf({ list }), "?kind=question");
    await screen.findByText("2 questions");
    list.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByText("Nothing at this status")).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
  });

  it("has a search box named for the kind, with the count beside it in the filter bar", async () => {
    open(clientOf({ list: async () => ready(rules) }), "?kind=decision");
    const box = await screen.findByRole("searchbox", { name: "Search decisions" });
    expect(box.closest(".filter-bar")).not.toBeNull();
    expect(screen.getByText("2 decisions").closest(".filter-bar")).not.toBeNull();
  });

  it("narrows the loaded list within the chosen statuses, with no new hub call", async () => {
    const list = vi.fn(async () => ready(rules));
    open(clientOf({ list }));
    await screen.findByText("2 rules");
    await userEvent.type(screen.getByRole("searchbox", { name: "Search rules" }), "font");
    expect(await screen.findByText("1 rule")).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /R-1/ })).toBeNull();
    expect(screen.getByRole("row", { name: /R-2/ })).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("looks through the body and the tags too", async () => {
    open(clientOf({ list: async () => ready([rule({ code: "R-1", body: "Names carry the meaning." }), rule({ code: "R-2", title: "Other", tags: ["css"] })]) }));
    await screen.findByText("2 rules");
    await userEvent.type(screen.getByRole("searchbox", { name: "Search rules" }), "meaning");
    expect(await screen.findByText("1 rule")).toBeInTheDocument();
    await userEvent.clear(screen.getByRole("searchbox", { name: "Search rules" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Search rules" }), "CSS");
    expect(await screen.findByRole("row", { name: /R-2/ })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /R-1/ })).toBeNull();
  });

  it("says nothing matches the search when the words fit no record", async () => {
    open(clientOf({ list: async () => ready(rules) }));
    await screen.findByText("2 rules");
    await userEvent.type(screen.getByRole("searchbox", { name: "Search rules" }), "zebra");
    expect(await screen.findByText("Nothing matches the search")).toBeInTheDocument();
    expect(screen.queryByText("No rules bear on this backlog yet.")).toBeNull();
  });

  it("starts from the search text of the address", async () => {
    open(clientOf({ list: async () => ready(rules) }), "?kind=rule&q=font");
    expect(await screen.findByText("1 rule")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search rules" })).toHaveValue("font");
  });

  it("keeps the search text and the statuses in the address, so Back from a record returns to them", async () => {
    open(clientOf({ list: async () => ready(rules) }));
    await screen.findByText("2 rules");
    await userEvent.type(screen.getByRole("searchbox", { name: "Search rules" }), "font");
    await userEvent.click(await screen.findByRole("row", { name: /R-2/ }));
    expect(JSON.parse(screen.getByTestId("state").textContent ?? "").backTo).toBe("/a/hub-1/backlogs/b1/rulebook?kind=rule&status=in_force&status=proposed&q=font");
  });

  it("keeps the search text when a status chip is tapped", async () => {
    const list = vi.fn(async () => ready(rules));
    open(clientOf({ list }), "?kind=rule&q=font");
    await screen.findByText("1 rule");
    await userEvent.click(screen.getByRole("button", { name: "Retired" }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith("b1", "rule", { statuses: ["in_force", "proposed", "retired"] }));
    expect(screen.getByRole("searchbox", { name: "Search rules" })).toHaveValue("font");
    expect(screen.getByTestId("where")).toHaveTextContent("q=font");
  });

  it("clears the search with the shared clear button", async () => {
    open(clientOf({ list: async () => ready(rules) }), "?kind=rule&q=font");
    await screen.findByText("1 rule");
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(await screen.findByText("2 rules")).toBeInTheDocument();
  });

  it("starts the search afresh on another view", async () => {
    open(clientOf({ list: async () => ready(rules) }), "?kind=rule&q=font");
    await screen.findByText("1 rule");
    await userEvent.click(screen.getByRole("button", { name: "Decisions" }));
    expect(await screen.findByRole("searchbox", { name: "Search decisions" })).toHaveValue("");
  });

  it("says Loading while it waits", () => {
    open(clientOf({ list: () => new Promise(() => undefined) }));
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  it("says what is empty for the kind", async () => {
    open(clientOf({ list: async () => ready([]) }), "?kind=decision");
    expect(await screen.findByText("No decisions bear on this backlog yet.")).toBeInTheDocument();
  });

  it("says it could not be loaded and tries again on the button", async () => {
    const list = vi.fn().mockResolvedValueOnce({ state: "failed" }).mockResolvedValue(ready(rules));
    open(clientOf({ list }));
    expect(await screen.findByText("The rules could not be loaded.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("2 rules")).toBeInTheDocument();
  });

  it("shows the no-access card, with no switch and no chips, for a viewer without rule.read", async () => {
    open(clientOf({ list: async () => ({ state: "no_access" }) }));
    expect(await screen.findByText("You do not have access to the rules yet. Ask the Product owner.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "View" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Status" })).toBeNull();
  });
});

describe("the rulebook list is one table", () => {
  const three = [rule({ code: "R-1" }), rule({ code: "R-2", title: "Font sizes are in rem", tags: ["css", "app"], status: "proposed" }), rule({ code: "R-3", title: "Work on main", tags: [] })];

  it("is one table with a header row and one row per rule", async () => {
    open(clientOf({ list: async () => ready(three) }));
    await screen.findByText("3 rules");
    expect(screen.getAllByRole("table")).toHaveLength(1);
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(within(rows[0]).getAllByRole("columnheader")).toHaveLength(4);
    expect(within(screen.getAllByRole("table")[0]).getAllByRole("rowgroup")).toHaveLength(2);
  });

  it("orders the columns Code, Title, Status, Tags", async () => {
    open(clientOf({ list: async () => ready(three) }));
    await screen.findByText("3 rules");
    expect(screen.getAllByRole("columnheader").map((head) => head.textContent)).toEqual(["Code", "Title", "Status", "Tags"]);
    const cells = within(screen.getByRole("row", { name: /R-2/ })).getAllByRole("cell");
    expect(cells.slice(0, 4).map((cell) => cell.textContent)).toEqual(["R-2", "Font sizes are in rem", "Proposed", "cssapp"]);
  });

  it("draws no card, no list row and no row button for a rule", async () => {
    open(clientOf({ list: async () => ready(three) }));
    await screen.findByText("3 rules");
    const table = screen.getByRole("table");
    expect(table.querySelector(".card, .row, .rows, button")).toBeNull();
    expect(document.querySelector(".card:not(.empty)")).toBeNull();
  });

  it("keeps the whole row tappable, with a chevron at its end", async () => {
    open(clientOf({ list: async () => ready(three) }));
    const row = await screen.findByRole("row", { name: /R-3/ });
    expect(row.lastElementChild?.textContent).toBe("›");
    await userEvent.click(within(row).getByText("›"));
    expect(screen.getByTestId("where")).toHaveTextContent("/a/hub-1/backlogs/rule/R-3");
  });

  it("makes the title a real link named by code and title, so a row has a role and a name", async () => {
    open(clientOf({ list: async () => ready(three) }));
    const link = await screen.findByRole("link", { name: "R-3 Work on main" });
    expect(link).toHaveAttribute("href", "/a/hub-1/backlogs/rule/R-3");
    expect(within(screen.getByRole("table")).getAllByRole("link")).toHaveLength(3);
    expect(screen.getByRole("row", { name: /R-3/ })).not.toHaveAttribute("tabindex");
  });

  it("opens the record from the keyboard on the link, once", async () => {
    open(clientOf({ list: async () => ready(three) }));
    const link = await screen.findByRole("link", { name: "R-1 No comments in code" });
    link.focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByTestId("where")).toHaveTextContent("/a/hub-1/backlogs/rule/R-1");
    expect(JSON.parse(screen.getByTestId("state").textContent ?? "")).toEqual({ backTo: "/a/hub-1/backlogs/b1/rulebook?kind=rule", backLabel: "Rules" });
  });

  it("shows a priority only on a question", async () => {
    open(clientOf({ list: async () => ready([rule({ code: "R-9", title: "Stray priority", priority: "P1" })]) }));
    const row = await screen.findByRole("row", { name: /R-9/ });
    expect(within(row).getAllByRole("cell")[2].textContent).toBe("In force");
  });

  it("puts the priority of a question in its Status cell", async () => {
    open(clientOf({ list: async () => ready([rule({ kind: "question", code: "Q-1", title: "A bad example?", status: "open", priority: "P2" })]) }), "?kind=question");
    const row = await screen.findByRole("row", { name: /Q-1/ });
    expect(within(row).getAllByRole("cell")[2].textContent).toBe("P2Open");
  });
});

describe("moving on from the rulebook list", () => {
  it("opens the record on a tap, and remembers the list to come back to", async () => {
    open(clientOf({ list: async () => ready(rules) }), "?kind=rule&status=in_force");
    await userEvent.click(await screen.findByRole("row", { name: /R-2/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/a/hub-1/backlogs/rule/R-2");
    expect(JSON.parse(screen.getByTestId("state").textContent ?? "")).toEqual({ backTo: "/a/hub-1/backlogs/b1/rulebook?kind=rule&status=in_force", backLabel: "Rules" });
  });

  it("switches to the Decisions of the same backlog", async () => {
    const list = vi.fn(async () => ready(rules));
    open(clientOf({ list }));
    await screen.findByText("2 rules");
    await userEvent.click(screen.getByRole("button", { name: "Decisions" }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith("b1", "decision", { statuses: ["decided", "proposed"] }));
    expect(screen.getByRole("button", { name: "Decisions" })).toHaveAttribute("aria-pressed", "true");
  });

  it("goes back to the Board and the List of the backlog", async () => {
    open(clientOf({ list: async () => ready(rules) }));
    await screen.findByText("2 rules");
    await userEvent.click(screen.getByRole("button", { name: "Board" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/a/hub-1/backlogs/b1/board");
  });

  it("goes back to the List of the backlog", async () => {
    open(clientOf({ list: async () => ready(rules) }));
    await screen.findByText("2 rules");
    await userEvent.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/a/hub-1/backlogs/b1");
    expect(screen.getByTestId("where").textContent).not.toContain("board");
  });

  it("goes back to the view of All issues in place of a board address", async () => {
    open(clientOf({ list: async () => ready(rules) }), "?kind=rule", "all");
    await screen.findByText("2 rules");
    await userEvent.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/a/hub-1/backlogs/all?view=list");
  });

  it.each([
    ["Board", "/a/hub-1/backlogs/s1/smart"],
    ["List", "/a/hub-1/backlogs/s1/smart?view=list"],
  ])("goes back to %s of a smart backlog at its own address", async (name, address) => {
    const smartClient = { ...backlogsClient, backlogs: async () => [{ id: "s1", name: "Ready", steps: [], issues: 0, kind: "smart" as const }] };
    at("/a/hub-1/backlogs/s1/rulebook?kind=rule", route, <RulebookPage client={clientOf({ list: async () => ready(rules) })} backlogs={smartClient} />);
    await screen.findByRole("heading", { name: "Ready" });
    await userEvent.click(screen.getByRole("button", { name }));
    expect(screen.getByTestId("where")).toHaveTextContent(address);
  });

  it("says Backlog for a backlog it does not know", async () => {
    open(clientOf({ list: async () => ready(rules) }), "?kind=rule", "nope");
    expect(await screen.findByRole("heading", { name: "Backlog" })).toBeInTheDocument();
  });

  it("goes back to Backlogs from the back link", async () => {
    open(clientOf({ list: async () => ready(rules) }));
    await userEvent.click(await screen.findByRole("button", { name: /Backlogs/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/a/hub-1/backlogs");
  });
});

describe("the Book button of the Rules choice", () => {
  it("shows Read as a book on the Rules choice and goes to the Book with the Rules list as the back", async () => {
    open(clientOf({ list: async () => ready(rules) }), "?kind=rule&status=in_force");
    await screen.findByText("2 rules");
    const user = userEvent.setup();
    expect(screen.getByRole("button", { name: "Read as a book" })).toHaveAttribute("title", "Open every rule in force as one page to read or print");
    await user.click(screen.getByRole("button", { name: "Read as a book" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/a/hub-1/backlogs/book");
    expect(JSON.parse(screen.getByTestId("state").textContent ?? "")).toEqual({ backTo: "/a/hub-1/backlogs/b1/rulebook?kind=rule&status=in_force", backLabel: "Rules" });
  });

  it("is on All issues too", async () => {
    open(clientOf({ list: async () => ready(rules) }), "?kind=rule", "all");
    await screen.findByText("2 rules");
    expect(screen.getByRole("button", { name: "Read as a book" })).toBeInTheDocument();
  });

  it("is not on Decisions or Questions", async () => {
    open(clientOf({ list: async () => ready([]) }), "?kind=decision");
    await screen.findByRole("button", { name: "Decisions" });
    expect(screen.queryByRole("button", { name: "Read as a book" })).toBeNull();
    cleanup();
    open(clientOf({ list: async () => ready([]) }), "?kind=question");
    await screen.findByRole("button", { name: "Questions" });
    expect(screen.queryByRole("button", { name: "Read as a book" })).toBeNull();
  });

  it("is not drawn for a viewer without rule.read, who has no Rules list", async () => {
    open(clientOf({ list: async () => ({ state: "no_access" }) }));
    await screen.findByText("You do not have access to the rules yet. Ask the Product owner.");
    expect(screen.queryByRole("button", { name: "Read as a book" })).toBeNull();
  });
});
